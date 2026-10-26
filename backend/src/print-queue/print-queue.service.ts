import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrintService, filamentPricePerGram } from '../print/print.service.js';
import {
  FinishQueueEntryDto,
  PublicQueueRequestDto,
  QUEUE_MAX_PENDING_SHARE_REQUESTS,
  QueueEntryDto,
  QueueFilamentDto,
  ReorderQueueDto,
  UpdateQueueEntryDto,
} from './dto/print-queue.js';
import { Prisma } from '../generated/prisma/client.js';
import { DEFAULT_COST_SETTINGS } from '../cost-settings/cost-settings.service.js';
import {
  computeQueueEntryFilamentCost,
  quoteQueueEntry,
} from './queue-cost.js';

const entryInclude = {
  printItem: { select: { id: true, name: true } },
  filaments: {
    orderBy: { position: 'asc' },
    include: { filament: { select: { spoolLevel: true } } },
  },
} satisfies Prisma.PrintQueueEntryInclude;

type EntryWithRelations = Prisma.PrintQueueEntryGetPayload<{
  include: typeof entryInclude;
  omit: { userId: true };
}>;

type SavedPrintItem = Awaited<ReturnType<PrintService['getItemById']>>;

// Pendentes: o que ainda não foi concluído, na ordem da fila.
const pendingOrder = [
  { position: 'asc' },
  { createdAt: 'asc' },
] satisfies Prisma.PrintQueueEntryOrderByWithRelationInput[];

// Fila vista pelo link público: só o que é da peça (ver getSharedQueue).
const sharedEntrySelect = {
  id: true,
  name: true,
  units: true,
  totalMinutes: true,
  printerName: true,
  fromShareLink: true,
  lastFailureAt: true,
  startedAt: true,
  // Para as gramas e o custo; não saem como estão.
  printerId: true,
  filaments: { select: { grams: true, pricePerGram: true } },
} satisfies Prisma.PrintQueueEntrySelect;

type SharedEntryRow = Prisma.PrintQueueEntryGetPayload<{
  select: typeof sharedEntrySelect;
}>;

// Quantos concluídos o link mostra: só os mais recentes.
const SHARED_DONE_LIMIT = 5;

@Injectable()
export class PrintQueueService {
  constructor(
    private prisma: PrismaService,
    private printService: PrintService,
  ) {}

  // O item precisa ser do usuário do token. De outro usuário responde 404,
  // sem revelar que existe.
  private async findOwnedEntry(
    entryId: string,
    userId: string,
    { pendingOnly = false } = {},
  ) {
    const entry = await this.prisma.printQueueEntry.findFirst({
      where: {
        id: entryId,
        userId,
        ...(pendingOnly && { completedAt: null }),
      },
      omit: { userId: true },
      include: entryInclude,
    });

    if (!entry) {
      throw new NotFoundException('Item não encontrado na fila.');
    }

    return entry;
  }

  private async findOwnedPrintItem(userId: string, printItemId: string) {
    const item = await this.prisma.printItem.findFirst({
      where: { id: printItemId, userId },
      select: { id: true, name: true },
    });
    if (!item) {
      throw new NotFoundException('Impressão não encontrada.');
    }
    return item;
  }

  private async findOwnedPrinter(userId: string, printerId: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: printerId, userId },
      select: { id: true, name: true },
    });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada.');
    }
    return printer;
  }

  // Como nos registros: cada filamento entra com o preço e o nome de hoje, e
  // o orçamento não muda se o filamento mudar ou for excluído depois.
  private async snapshotFilaments(userId: string, usages: QueueFilamentDto[]) {
    const ids = usages.map((usage) => usage.filamentId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Filamento repetido no item.');
    }

    const filaments = await this.prisma.filament.findMany({
      where: { id: { in: ids }, userId },
      select: {
        id: true,
        colorName: true,
        type: true,
        colors: true,
        minPricePaid: true,
        maxPricePaid: true,
        spoolWeightGrams: true,
        brand: { select: { name: true } },
      },
    });
    if (filaments.length !== ids.length) {
      throw new NotFoundException('Filamento não encontrado.');
    }

    return usages.map((usage, position) => {
      const filament = filaments.find((f) => f.id === usage.filamentId)!;
      return {
        position,
        grams: usage.grams,
        pricePerGram: filamentPricePerGram(filament),
        colorName: filament.colorName,
        type: filament.type,
        brandName: filament.brand.name,
        colors: filament.colors,
        filamentId: filament.id,
      };
    });
  }

  // "   " passa no @IsNotEmpty, mas vira texto vazio depois do trim.
  private requireText(value: string, message: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(message);
    return trimmed;
  }

  private normalizeOptional(value: string | null | undefined) {
    return value?.trim() || null;
  }

  private toResponse({
    printItem,
    printerId,
    printerName,
    lastFailureAt,
    lastFailureReason,
    createdItem,
    filaments,
    ...entry
  }: EntryWithRelations) {
    return {
      id: entry.id,
      name: entry.name,
      position: entry.position,
      units: entry.units,
      totalMinutes: entry.totalMinutes,
      customer: entry.customer,
      modelUrl: entry.modelUrl,
      note: entry.note,
      fromShareLink: entry.fromShareLink,
      requesterContact: entry.requesterContact,
      requestedColors: entry.requestedColors,
      createdAt: entry.createdAt,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      // null quando a impressão foi excluída depois.
      printItem,
      printer: { id: printerId, name: printerName },
      lastFailure: lastFailureAt
        ? { at: lastFailureAt, reason: lastFailureReason ?? '' }
        : null,
      result:
        entry.completedAt && printItem
          ? { item: printItem, createdItem }
          : null,
      // Mesmo formato dos filamentos de um registro em Impressões.
      filaments: filaments.map((usage) => ({
        id: usage.id,
        grams: usage.grams,
        filament: {
          id: usage.filamentId,
          colorName: usage.colorName,
          type: usage.type,
          brandName: usage.brandName,
          colors: usage.colors,
          pricePerGram: usage.pricePerGram,
          spoolLevel: usage.filament?.spoolLevel ?? null,
        },
      })),
    };
  }

  private async getPending(userId: string) {
    const pending = await this.prisma.printQueueEntry.findMany({
      where: { userId, completedAt: null },
      omit: { userId: true },
      include: entryInclude,
      orderBy: pendingOrder,
    });
    return pending.map((entry) => this.toResponse(entry));
  }

  async getQueue(userId: string) {
    const [pending, done] = await Promise.all([
      this.getPending(userId),
      this.prisma.printQueueEntry.findMany({
        where: { userId, completedAt: { not: null } },
        omit: { userId: true },
        include: entryInclude,
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    return { pending, done: done.map((entry) => this.toResponse(entry)) };
  }

  async getEntryById(entryId: string, userId: string) {
    return this.toResponse(await this.findOwnedEntry(entryId, userId));
  }

  // Campos comuns ao criar e ao editar, já validados contra o usuário.
  private async buildEntryData(userId: string, data: UpdateQueueEntryDto) {
    if (data.printItemId) {
      await this.findOwnedPrintItem(userId, data.printItemId);
    }
    const printer = await this.findOwnedPrinter(userId, data.printerId);
    const filaments = await this.snapshotFilaments(userId, data.filaments);
    return {
      fields: {
        name: this.requireText(data.name, 'Dê um nome para a peça.'),
        units: data.units,
        totalMinutes: data.totalMinutes,
        customer: this.normalizeOptional(data.customer),
        modelUrl: this.normalizeOptional(data.modelUrl),
        note: this.normalizeOptional(data.note),
        printItemId: data.printItemId ?? null,
        printerId: printer.id,
        printerName: printer.name,
      },
      filaments,
    };
  }

  async createEntry(userId: string, data: QueueEntryDto) {
    const { fields, filaments } = await this.buildEntryData(userId, data);
    const entryData = { ...fields, userId, filaments: { create: filaments } };

    let entry: EntryWithRelations;
    if (data.position === 'first') {
      // Abre a posição 0 empurrando os pendentes, na mesma transação.
      const [, created] = await this.prisma.$transaction([
        this.prisma.printQueueEntry.updateMany({
          where: { userId, completedAt: null },
          data: { position: { increment: 1 } },
        }),
        this.prisma.printQueueEntry.create({
          data: { ...entryData, position: 0 },
          omit: { userId: true },
          include: entryInclude,
        }),
      ]);
      entry = created;
    } else {
      entry = await this.prisma.printQueueEntry.create({
        data: { ...entryData, position: await this.nextPosition(userId) },
        omit: { userId: true },
        include: entryInclude,
      });
    }

    return {
      message: 'Item adicionado à fila',
      data: this.toResponse(entry),
    };
  }

  // Só os pendentes: o concluído já virou registro em Impressões. Os
  // filamentos são trocados inteiros e entram com o preço de hoje, como um
  // orçamento novo.
  async updateEntry(
    entryId: string,
    userId: string,
    data: UpdateQueueEntryDto,
  ) {
    const current = await this.findOwnedEntry(entryId, userId, {
      pendingOnly: true,
    });
    const { fields, filaments } = await this.buildEntryData(userId, data);

    const entry = await this.prisma.printQueueEntry.update({
      where: { id: entryId },
      data: {
        ...fields,
        // Trocou de impressora: não está mais na que estava.
        ...(fields.printerId !== current.printerId && { startedAt: null }),
        filaments: { deleteMany: {}, create: filaments },
      },
      omit: { userId: true },
      include: entryInclude,
    });

    return {
      message: 'Item da fila atualizado',
      data: this.toResponse(entry),
    };
  }

  async reorder(userId: string, data: ReorderQueueDto) {
    const pending = await this.prisma.printQueueEntry.findMany({
      where: { userId, completedAt: null },
      select: { id: true },
      orderBy: pendingOrder,
    });
    const pendingIds = pending.map((entry) => entry.id);

    if (new Set(data.ids).size !== data.ids.length) {
      throw new BadRequestException('Item repetido na ordem.');
    }
    if (data.ids.some((id) => !pendingIds.includes(id))) {
      throw new NotFoundException('Item não encontrado na fila.');
    }

    // O que não veio na lista (adicionado em outra aba) fica no fim, na ordem
    // em que estava.
    const ordered = [
      ...data.ids,
      ...pendingIds.filter((id) => !data.ids.includes(id)),
    ];
    await this.prisma.$transaction(
      ordered.map((id, position) =>
        this.prisma.printQueueEntry.update({
          where: { id },
          data: { position },
        }),
      ),
    );

    return {
      message: 'Ordem da fila atualizada',
      data: await this.getPending(userId),
    };
  }

  async deleteEntry(entryId: string, userId: string) {
    await this.findOwnedEntry(entryId, userId);
    await this.prisma.printQueueEntry.delete({ where: { id: entryId } });
    return { message: 'Item removido da fila' };
  }

  // Posição no fim dos pendentes.
  private async nextPosition(userId: string) {
    const last = await this.prisma.printQueueEntry.aggregate({
      where: { userId, completedAt: null },
      _max: { position: true },
    });
    return (last._max.position ?? -1) + 1;
  }

  // Marca que o item está na impressora agora. Cada impressora imprime um
  // de cada vez: o que estava nela antes perde a marcação.
  async startEntry(entryId: string, userId: string) {
    const entry = await this.findOwnedEntry(entryId, userId, {
      pendingOnly: true,
    });
    if (!entry.printerId) {
      throw new BadRequestException(
        'Escolha a impressora do item antes de iniciar.',
      );
    }

    const [, started] = await this.prisma.$transaction([
      this.prisma.printQueueEntry.updateMany({
        where: {
          userId,
          printerId: entry.printerId,
          completedAt: null,
          startedAt: { not: null },
          id: { not: entryId },
        },
        data: { startedAt: null },
      }),
      this.prisma.printQueueEntry.update({
        where: { id: entryId },
        data: { startedAt: new Date() },
        omit: { userId: true },
        include: entryInclude,
      }),
    ]);

    return {
      message: 'Item marcado como imprimindo',
      data: this.toResponse(started),
    };
  }

  // Tira a marcação sem concluir (começou por engano, foi pausado...).
  async stopEntry(entryId: string, userId: string) {
    await this.findOwnedEntry(entryId, userId, { pendingOnly: true });
    const entry = await this.prisma.printQueueEntry.update({
      where: { id: entryId },
      data: { startedAt: null },
      omit: { userId: true },
      include: entryInclude,
    });
    return {
      message: 'Item voltou a esperar na fila',
      data: this.toResponse(entry),
    };
  }

  // ---------------------------------------------------------------------------
  // Link público

  async getShareLink(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { queueShareToken: true },
    });
    return { token: user.queueShareToken };
  }

  // Cria o link ou troca por um novo; o antigo para de funcionar na hora.
  // 128 bits aleatórios: o link é a única "senha" de quem pede.
  async regenerateShareLink(userId: string) {
    const token = randomBytes(16).toString('base64url');
    await this.prisma.user.update({
      where: { id: userId },
      data: { queueShareToken: token },
    });
    return { message: 'Link da fila criado', token };
  }

  async disableShareLink(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { queueShareToken: null },
    });
    return { message: 'Link da fila desativado', token: null };
  }

  // Token inválido ou desativado responde 404, sem dizer qual dos dois.
  private async findShareOwner(token: string) {
    const owner = await this.prisma.user.findUnique({
      where: { queueShareToken: token },
      select: { id: true, name: true },
    });
    if (!owner) {
      throw new NotFoundException('Link não encontrado ou desativado.');
    }
    return owner;
  }

  // O que a página pública mostra: a fila na ordem e os concluídos recentes,
  // só com o que diz respeito à peça, mais as gramas, o custo e o preço
  // sugerido de cada item. Cliente, contato, observação e link do modelo
  // ficam de fora: muitos pedidos são de outras pessoas. Custo e preço vêm
  // prontos, sem as configurações e as impressoras que entram na conta.
  async getSharedQueue(token: string) {
    const owner = await this.findShareOwner(token);

    const [pending, done, savedSettings] = await Promise.all([
      this.prisma.printQueueEntry.findMany({
        where: { userId: owner.id, completedAt: null },
        select: sharedEntrySelect,
        orderBy: pendingOrder,
      }),
      this.prisma.printQueueEntry.findMany({
        where: { userId: owner.id, completedAt: { not: null } },
        select: { ...sharedEntrySelect, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: SHARED_DONE_LIMIT,
      }),
      this.prisma.costSettings.findUnique({
        where: { userId: owner.id },
        select: {
          energyCostPerKwh: true,
          otherFixedCost: true,
          failureReservePercent: true,
          laborCostPerHour: true,
          prepMinutesPerPiece: true,
          defaultMarginPercent: true,
        },
      }),
    ]);

    const printerIds = [
      ...new Set(
        [...pending, ...done].flatMap((e) =>
          e.printerId ? [e.printerId] : [],
        ),
      ),
    ];
    const printers = printerIds.length
      ? await this.prisma.printer.findMany({
          where: { id: { in: printerIds }, userId: owner.id },
          select: {
            id: true,
            powerConsumptionW: true,
            energyCostPerKwh: true,
            maintenanceCostPerHour: true,
          },
        })
      : [];
    const settings = savedSettings ?? DEFAULT_COST_SETTINGS;

    // Pendentes e concluídos mostram a mesma estimativa: a da fila. O gasto
    // real fica no registro em Impressões, que não é público.
    const toShared = ({
      lastFailureAt,
      printerId,
      filaments,
      ...entry
    }: SharedEntryRow) => {
      const grams = filaments.reduce((sum, f) => sum + f.grams, 0);
      const quote = quoteQueueEntry(
        { ...entry, filaments },
        printers.find((p) => p.id === printerId) ?? null,
        settings,
      );
      return {
        ...entry,
        // Só que voltou para a fila; o motivo fica com o dono.
        retrying: lastFailureAt !== null,
        // 0: filamento ainda não informado.
        grams: Math.round(grams * 10) / 10,
        // Só o filamento; aparece mesmo antes de ter o tempo.
        filamentCost: computeQueueEntryFilamentCost({ ...entry, filaments }),
        // null: sem filamento ou sem tempo, ainda não dá para orçar.
        cost: quote?.cost ?? null,
        // Preço sugerido, como na fila do usuário.
        price: quote?.price ?? null,
      };
    };

    return {
      ownerName: owner.name,
      pending: pending.map(toShared),
      // Concluir com sucesso limpa a falha: aqui o "retrying" é sempre false.
      done: done.map(({ completedAt, ...entry }) => ({
        ...toShared(entry),
        completedAt: completedAt!,
      })),
    };
  }

  // Entra no fim da fila, marcado como pedido do link. Devolve só o id, para
  // a página de quem pediu achar o pedido na fila.
  async createShareRequest(token: string, data: PublicQueueRequestDto) {
    const owner = await this.findShareOwner(token);

    const pendingRequests = await this.prisma.printQueueEntry.count({
      where: { userId: owner.id, completedAt: null, fromShareLink: true },
    });
    if (pendingRequests >= QUEUE_MAX_PENDING_SHARE_REQUESTS) {
      throw new BadRequestException(
        'A fila está cheia de pedidos agora. Tente de novo mais tarde.',
      );
    }

    const entry = await this.prisma.printQueueEntry.create({
      select: { id: true },
      data: {
        name: this.requireText(data.name, 'Diga o que quer imprimir.'),
        customer: this.requireText(data.requesterName, 'Diga seu nome.'),
        requesterContact: this.normalizeOptional(data.contact),
        requestedColors: this.requireText(data.colors, 'Diga as cores.'),
        units: data.units,
        totalMinutes: 0,
        modelUrl: this.requireText(data.modelUrl, 'Mande o link do modelo.'),
        note: this.normalizeOptional(data.note),
        printerId: null,
        printerName: '',
        fromShareLink: true,
        position: await this.nextPosition(owner.id),
        userId: owner.id,
      },
    });

    return { message: 'Pedido enviado', id: entry.id };
  }

  // Grava o registro em Impressões (pelo PrintService, com as mesmas regras
  // de lá) e atualiza o item: sucesso sai da fila, falha volta marcada.
  async finishEntry(
    entryId: string,
    userId: string,
    data: FinishQueueEntryDto,
  ) {
    const entry = await this.findOwnedEntry(entryId, userId, {
      pendingOnly: true,
    });
    const { record } = data;
    const isFailure = record.outcome === 'FAILURE';

    if (data.printItemId && data.newItem) {
      throw new BadRequestException(
        'Escolha só um lugar para registrar: uma impressão existente ou uma nova.',
      );
    }
    if (!isFailure && !data.printItemId && !data.newItem) {
      throw new BadRequestException('Escolha onde registrar a impressão.');
    }
    // Checado antes de gravar: sem impressão, nada mais pediria o motivo.
    const failureReason = this.normalizeOptional(record.failureReason);
    if (isFailure && !failureReason) {
      throw new BadRequestException('Conte o que aconteceu na falha.');
    }

    let saved: { item: SavedPrintItem; recordId: string } | null = null;

    if (data.printItemId) {
      const result = await this.printService.addRecord(
        data.printItemId,
        userId,
        isFailure ? { ...record, makeDefault: false } : record,
      );
      saved = { item: result.data, recordId: result.recordId };
    } else if (data.newItem && !isFailure) {
      const result = await this.printService.createItem(userId, {
        name: data.newItem.name,
        categoryId: data.newItem.categoryId ?? null,
        modelUrl: entry.modelUrl,
        derivedFromId: null,
        firstRecord: record,
      });
      saved = {
        item: result.data,
        recordId: result.data.defaultRecordId!,
      };
    }

    const updated = await this.prisma.printQueueEntry.update({
      where: { id: entryId },
      data: isFailure
        ? {
            lastFailureAt: record.printedAt,
            lastFailureReason: failureReason,
            printItemId: saved?.item.id ?? entry.printItemId,
            // Saiu da impressora; volta para a fila esperando a vez.
            startedAt: null,
          }
        : {
            startedAt: null,
            completedAt: new Date(),
            createdItem: Boolean(data.newItem),
            lastFailureAt: null,
            lastFailureReason: null,
            printItemId: saved!.item.id,
          },
      omit: { userId: true },
      include: entryInclude,
    });

    return {
      message: isFailure
        ? 'Falha registrada; o item voltou para a fila'
        : 'Item concluído',
      data: this.toResponse(updated),
      // A impressão onde o registro foi gravado (as fotos vão depois, pela
      // rota de fotos do registro).
      item: saved?.item ?? null,
      recordId: saved?.recordId ?? null,
    };
  }
}
