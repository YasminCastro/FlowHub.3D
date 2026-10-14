import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AddPrintRecordDto,
  PRINT_MAX_PHOTOS,
  UpdatePrintRecordDto,
  PrintFilamentUsageDto,
  PrintItemDto,
  PrintRecordDto,
} from './dto/print.js';
import { PrintPhotoStorage, printPhotoUrl } from './print-photo-storage.js';
import { detectImageExtension } from '../journal/journal-photo-storage.js';
import { Prisma } from '../generated/prisma/client.js';

const recordInclude = {
  filaments: {
    orderBy: { position: 'asc' },
    include: { filament: { select: { spoolLevel: true } } },
  },
  photos: {
    select: { id: true, filename: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PrintRecordInclude;

const itemInclude = {
  category: { select: { id: true, name: true, color: true } },
  derivedFrom: { select: { id: true, name: true } },
  derivatives: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
  records: {
    include: recordInclude,
    orderBy: [{ printedAt: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.PrintItemInclude;

type ItemWithRelations = Prisma.PrintItemGetPayload<{
  include: typeof itemInclude;
  omit: { userId: true };
}>;

type RecordWithRelations = ItemWithRelations['records'][number];

export type UploadedPhoto = { buffer: Buffer };

type ExistingUsage = RecordWithRelations['filaments'][number];

// Preço por grama: média do que já foi pago pelo rolo, dividida pelo peso.
export function filamentPricePerGram(filament: {
  minPricePaid: number;
  maxPricePaid: number | null;
  spoolWeightGrams: number;
}) {
  if (filament.spoolWeightGrams <= 0) return 0;
  const paid =
    (filament.minPricePaid + (filament.maxPricePaid ?? filament.minPricePaid)) /
    2;
  return paid / filament.spoolWeightGrams;
}

@Injectable()
export class PrintService {
  constructor(
    private prisma: PrismaService,
    private photoStorage: PrintPhotoStorage,
  ) {}

  // A peça precisa ser do usuário do token. De outro usuário responde 404,
  // sem revelar que existe.
  private async findOwnedItem(itemId: string, userId: string) {
    const item = await this.prisma.printItem.findFirst({
      where: { id: itemId, userId },
      omit: { userId: true },
      include: itemInclude,
    });

    if (!item) {
      throw new NotFoundException('Impressão não encontrada.');
    }

    return item;
  }

  private findRecord(item: ItemWithRelations, recordId: string) {
    const record = item.records.find((r) => r.id === recordId);
    if (!record) {
      throw new NotFoundException('Registro não encontrado.');
    }
    return record;
  }

  private async ensureOwnedCategory(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }
  }

  private async ensureOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.printItem.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Impressão de origem não encontrada.');
    }
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

  // Cada filamento entra com o preço e a identificação de hoje: o custo do
  // registro não muda depois. Na edição, o que o registro já tinha mantém o
  // preço e o nome do dia em que foi registrado.
  private async snapshotFilaments(
    userId: string,
    usages: PrintFilamentUsageDto[],
    existing: ExistingUsage[] = [],
  ) {
    const rows = usages.map((usage) => {
      if (usage.usageId) {
        const kept = existing.find((e) => e.id === usage.usageId);
        if (!kept) {
          throw new NotFoundException('Filamento do registro não encontrado.');
        }
        return { usage, kept };
      }
      if (!usage.filamentId) {
        throw new BadRequestException('Escolha o filamento.');
      }
      const kept = existing.find((e) => e.filamentId === usage.filamentId);
      return { usage, kept: kept ?? null };
    });

    const keys = rows.map(
      ({ usage, kept }) => kept?.filamentId ?? kept?.id ?? usage.filamentId,
    );
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Filamento repetido no registro.');
    }

    const newIds = rows
      .filter((row) => !row.kept)
      .map((row) => row.usage.filamentId!);
    const filaments = newIds.length
      ? await this.prisma.filament.findMany({
          where: { id: { in: newIds }, userId },
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
        })
      : [];
    if (filaments.length !== newIds.length) {
      throw new NotFoundException('Filamento não encontrado.');
    }

    return rows.map(({ usage, kept }, position) => {
      if (kept) {
        return {
          position,
          grams: usage.grams,
          pricePerGram: kept.pricePerGram,
          colorName: kept.colorName,
          type: kept.type,
          brandName: kept.brandName,
          colors: kept.colors,
          filamentId: kept.filamentId,
        };
      }
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

  private async buildRecordData(
    userId: string,
    data: PrintRecordDto,
    existing: ExistingUsage[] = [],
  ) {
    const isFailure = data.outcome === 'FAILURE';
    const failureReason = this.normalizeOptional(data.failureReason);

    if (isFailure && !failureReason) {
      throw new BadRequestException('Conte o que aconteceu na falha.');
    }
    // A falha pode ter parado antes de gastar; o sucesso não.
    if (!isFailure) {
      if (data.totalMinutes <= 0) {
        throw new BadRequestException('Informe o tempo da impressão.');
      }
      if (data.filaments.some((usage) => usage.grams <= 0)) {
        throw new BadRequestException('Informe as gramas de cada filamento.');
      }
    }

    const printer = await this.findOwnedPrinter(userId, data.printerId);
    const filaments = await this.snapshotFilaments(
      userId,
      data.filaments,
      existing,
    );
    const settings = data.settings
      ? {
          slicer: this.requireText(data.settings.slicer, 'Informe o fatiador.'),
          layerHeightMm: data.settings.layerHeightMm,
          infillPercent: data.settings.infillPercent,
          infillPattern: this.requireText(
            data.settings.infillPattern,
            'Informe o padrão de preenchimento.',
          ),
          walls: data.settings.walls,
          temperatureC: data.settings.temperatureC ?? null,
          extras: data.settings.extras?.trim() ?? '',
        }
      : {
          slicer: null,
          layerHeightMm: null,
          infillPercent: null,
          infillPattern: null,
          walls: null,
          temperatureC: null,
          extras: '',
        };

    return {
      printedAt: data.printedAt,
      units: data.units,
      totalMinutes: data.totalMinutes,
      printerId: printer.id,
      printerName: printer.name,
      ...settings,
      outcome: data.outcome,
      failureReason: isFailure ? failureReason : null,
      note: this.normalizeOptional(data.note),
      changeSummary: this.normalizeOptional(data.changeSummary),
      filaments: { create: filaments },
    };
  }

  // A checagem do nome repetido fica com o índice único do banco; o erro
  // vira 409 em vez de 500.
  private async withUniqueNameConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma impressão com esse nome.');
      }
      throw error;
    }
  }

  private toRecordResponse({
    printerId,
    printerName,
    slicer,
    layerHeightMm,
    infillPercent,
    infillPattern,
    walls,
    temperatureC,
    extras,
    filaments,
    photos,
    ...record
  }: RecordWithRelations) {
    return {
      id: record.id,
      printedAt: record.printedAt,
      units: record.units,
      totalMinutes: record.totalMinutes,
      outcome: record.outcome,
      failureReason: record.failureReason,
      note: record.note,
      changeSummary: record.changeSummary,
      createdAt: record.createdAt,
      printer: { id: printerId, name: printerName },
      // Sem fatiador, o registro não tem configuração.
      settings:
        slicer == null
          ? null
          : {
              slicer,
              layerHeightMm,
              infillPercent,
              infillPattern,
              walls,
              temperatureC,
              extras,
            },
      filaments: filaments.map((usage) => ({
        id: usage.id,
        grams: usage.grams,
        filament: {
          // null quando o filamento foi excluído; o resto é do dia do registro.
          id: usage.filamentId,
          colorName: usage.colorName,
          type: usage.type,
          brandName: usage.brandName,
          colors: usage.colors,
          pricePerGram: usage.pricePerGram,
          spoolLevel: usage.filament?.spoolLevel ?? null,
        },
      })),
      photos: photos.map((photo) => ({
        id: photo.id,
        url: printPhotoUrl(photo.filename),
      })),
    };
  }

  private toResponse({ records, ...item }: ItemWithRelations) {
    return {
      ...item,
      defaultRecordId: records.find((r) => r.isDefault)?.id ?? null,
      records: records.map((record) => this.toRecordResponse(record)),
    };
  }

  async createItem(userId: string, data: PrintItemDto) {
    if (data.firstRecord.outcome !== 'SUCCESS') {
      throw new BadRequestException(
        'A primeira impressão vira o registro padrão e precisa ter dado certo.',
      );
    }
    if (data.categoryId)
      await this.ensureOwnedCategory(userId, data.categoryId);
    if (data.derivedFromId) {
      await this.ensureOwnedItem(userId, data.derivedFromId);
    }
    const firstRecord = await this.buildRecordData(userId, data.firstRecord);

    const item = await this.withUniqueNameConflict(() =>
      this.prisma.printItem.create({
        data: {
          name: this.requireText(data.name, 'Dê um nome para a peça.'),
          modelUrl: this.normalizeOptional(data.modelUrl),
          categoryId: data.categoryId ?? null,
          derivedFromId: data.derivedFromId ?? null,
          userId,
          records: { create: { ...firstRecord, isDefault: true } },
        },
        omit: { userId: true },
        include: itemInclude,
      }),
    );

    return {
      message: 'Impressão criada com sucesso',
      data: this.toResponse(item),
    };
  }

  async getAllItems(userId: string) {
    const items = await this.prisma.printItem.findMany({
      where: { userId },
      omit: { userId: true },
      include: itemInclude,
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => this.toResponse(item));
  }

  async getItemById(itemId: string, userId: string) {
    return this.toResponse(await this.findOwnedItem(itemId, userId));
  }

  async deleteItem(itemId: string, userId: string) {
    const item = await this.findOwnedItem(itemId, userId);

    // Registros, filamentos usados e fotos saem junto (onDelete: Cascade);
    // os arquivos, depois que o banco confirmou. Derivadas ficam soltas.
    await this.prisma.printItem.delete({ where: { id: itemId } });
    await this.removeFiles(
      item.records.flatMap((r) => r.photos.map((photo) => photo.filename)),
    );

    return { message: 'Impressão excluída com sucesso' };
  }

  async addRecord(itemId: string, userId: string, data: AddPrintRecordDto) {
    await this.findOwnedItem(itemId, userId);
    const makeDefault = data.makeDefault ?? false;
    if (makeDefault && data.outcome !== 'SUCCESS') {
      throw new BadRequestException(
        'Só um registro que deu certo pode ser o padrão.',
      );
    }
    const record = await this.buildRecordData(userId, data);
    // Id gerado aqui: a tela usa para mandar as fotos logo em seguida.
    const recordId = randomUUID();

    // Um padrão por peça: desmarca o atual na mesma transação.
    await this.prisma.$transaction([
      ...(makeDefault
        ? [
            this.prisma.printRecord.updateMany({
              where: { itemId, isDefault: true },
              data: { isDefault: false },
            }),
          ]
        : []),
      this.prisma.printRecord.create({
        data: { ...record, id: recordId, itemId, isDefault: makeDefault },
        select: { id: true },
      }),
    ]);

    return {
      message: 'Registro adicionado com sucesso',
      data: await this.getItemById(itemId, userId),
      recordId,
    };
  }

  async updateRecord(
    itemId: string,
    recordId: string,
    userId: string,
    data: UpdatePrintRecordDto,
  ) {
    const item = await this.findOwnedItem(itemId, userId);
    const current = this.findRecord(item, recordId);
    const isFailure = data.outcome !== 'SUCCESS';
    if (isFailure && (current.isDefault || data.makeDefault)) {
      throw new BadRequestException(
        current.isDefault
          ? 'O registro padrão precisa ter dado certo. Marque outro como padrão antes.'
          : 'Só um registro que deu certo pode ser o padrão.',
      );
    }
    const { filaments, ...record } = await this.buildRecordData(
      userId,
      data,
      current.filaments,
    );
    const makeDefault = !current.isDefault && (data.makeDefault ?? false);

    // Os filamentos enviados substituem a lista. Virar padrão desmarca o
    // atual na mesma transação.
    await this.prisma.$transaction([
      ...(makeDefault
        ? [
            this.prisma.printRecord.updateMany({
              where: { itemId, isDefault: true },
              data: { isDefault: false },
            }),
          ]
        : []),
      this.prisma.printRecord.update({
        where: { id: recordId },
        data: {
          ...record,
          // Sem texto novo, o "O que mudou" continua o mesmo.
          changeSummary: isFailure
            ? null
            : data.changeSummary !== undefined
              ? record.changeSummary
              : current.changeSummary,
          ...(makeDefault && { isDefault: true }),
          filaments: { deleteMany: {}, create: filaments.create },
        },
      }),
    ]);

    return {
      message: 'Registro atualizado com sucesso',
      data: await this.getItemById(itemId, userId),
    };
  }

  async setDefaultRecord(itemId: string, recordId: string, userId: string) {
    const item = await this.findOwnedItem(itemId, userId);
    const record = this.findRecord(item, recordId);
    if (record.outcome !== 'SUCCESS') {
      throw new BadRequestException(
        'Só um registro que deu certo pode ser o padrão.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.printRecord.updateMany({
        where: { itemId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.printRecord.update({
        where: { id: recordId },
        data: { isDefault: true },
      }),
    ]);

    return {
      message: 'Registro padrão atualizado',
      data: await this.getItemById(itemId, userId),
    };
  }

  async deleteRecord(itemId: string, recordId: string, userId: string) {
    const item = await this.findOwnedItem(itemId, userId);
    const record = this.findRecord(item, recordId);

    if (item.records.length === 1) {
      throw new BadRequestException(
        'A impressão precisa de pelo menos um registro. Exclua a impressão inteira.',
      );
    }

    // Sem o padrão, o sucesso mais recente assume (a lista já vem do mais
    // novo para o mais antigo).
    const successor = record.isDefault
      ? item.records.find((r) => r.id !== recordId && r.outcome === 'SUCCESS')
      : undefined;
    if (record.isDefault && !successor) {
      throw new BadRequestException(
        'Este é o único registro que deu certo e é o padrão da peça.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.printRecord.delete({ where: { id: recordId } }),
      ...(successor
        ? [
            this.prisma.printRecord.update({
              where: { id: successor.id },
              data: { isDefault: true },
            }),
          ]
        : []),
    ]);
    await this.removeFiles(record.photos.map((photo) => photo.filename));

    return {
      message: 'Registro excluído com sucesso',
      data: await this.getItemById(itemId, userId),
    };
  }

  async addPhotos(
    itemId: string,
    recordId: string,
    userId: string,
    files: UploadedPhoto[],
  ) {
    const item = await this.findOwnedItem(itemId, userId);
    const record = this.findRecord(item, recordId);

    if (!files.length) {
      throw new BadRequestException('Envie pelo menos uma foto.');
    }
    if (record.photos.length + files.length > PRINT_MAX_PHOTOS) {
      throw new BadRequestException(
        `Cada registro aceita até ${PRINT_MAX_PHOTOS} fotos.`,
      );
    }

    const extensions = files.map((file) => detectImageExtension(file.buffer));
    if (extensions.some((ext) => !ext)) {
      throw new BadRequestException(
        'Só são aceitas imagens JPG, PNG, WEBP ou GIF.',
      );
    }

    const filenames: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        filenames.push(
          await this.photoStorage.save(file.buffer, extensions[i]!),
        );
      }
      await this.prisma.printPhoto.createMany({
        data: filenames.map((filename) => ({ filename, recordId })),
      });
    } catch (error) {
      // Nada de arquivo órfão se o banco falhar no meio.
      await this.removeFiles(filenames);
      throw error;
    }

    return {
      message: 'Fotos adicionadas com sucesso',
      data: await this.getItemById(itemId, userId),
    };
  }

  async deletePhoto(
    itemId: string,
    recordId: string,
    photoId: string,
    userId: string,
  ) {
    const item = await this.findOwnedItem(itemId, userId);
    const photo = this.findRecord(item, recordId).photos.find(
      (p) => p.id === photoId,
    );

    if (!photo) {
      throw new NotFoundException('Foto não encontrada.');
    }

    await this.prisma.printPhoto.delete({ where: { id: photoId } });
    await this.removeFiles([photo.filename]);

    return {
      message: 'Foto excluída com sucesso',
      data: await this.getItemById(itemId, userId),
    };
  }

  private async removeFiles(filenames: string[]) {
    await Promise.allSettled(
      filenames.map((filename) => this.photoStorage.remove(filename)),
    );
  }
}
