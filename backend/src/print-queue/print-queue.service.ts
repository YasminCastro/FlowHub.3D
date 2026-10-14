import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrintService, filamentPricePerGram } from '../print/print.service.js';
import {
  FinishQueueEntryDto,
  QueueEntryDto,
  QueueFilamentDto,
  ReorderQueueDto,
} from './dto/print-queue.js';
import { Prisma } from '../generated/prisma/client.js';

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
      createdAt: entry.createdAt,
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

  async createEntry(userId: string, data: QueueEntryDto) {
    if (data.printItemId) {
      await this.findOwnedPrintItem(userId, data.printItemId);
    }
    const printer = await this.findOwnedPrinter(userId, data.printerId);
    const filaments = await this.snapshotFilaments(userId, data.filaments);
    const entryData = {
      name: this.requireText(data.name, 'Dê um nome para a peça.'),
      units: data.units,
      totalMinutes: data.totalMinutes,
      customer: this.normalizeOptional(data.customer),
      modelUrl: this.normalizeOptional(data.modelUrl),
      printItemId: data.printItemId ?? null,
      printerId: printer.id,
      printerName: printer.name,
      userId,
      filaments: { create: filaments },
    };

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
      const last = await this.prisma.printQueueEntry.aggregate({
        where: { userId, completedAt: null },
        _max: { position: true },
      });
      entry = await this.prisma.printQueueEntry.create({
        data: { ...entryData, position: (last._max.position ?? -1) + 1 },
        omit: { userId: true },
        include: entryInclude,
      });
    }

    return {
      message: 'Item adicionado à fila',
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
          }
        : {
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
