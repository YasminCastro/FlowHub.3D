import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FilamentDto,
  FilamentNoteDto,
  FilamentPurchaseDto,
  UpdateFilamentDto,
} from './dto/filament.js';
import { Prisma } from '../generated/prisma/client.js';

const brandInclude = {
  brand: { select: { id: true, name: true } },
} satisfies Prisma.FilamentInclude;

const detailInclude = {
  ...brandInclude,
  notes: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.FilamentInclude;

const DUPLICATE_MESSAGE = 'Esse filamento já está cadastrado.';

@Injectable()
export class FilamentService {
  constructor(private prisma: PrismaService) {}

  // O filamento precisa ser do usuário do token. De outro usuário responde
  // 404, sem revelar que existe.
  private async findOwnedFilament(filamentId: string, userId: string) {
    const filament = await this.prisma.filament.findFirst({
      where: { id: filamentId, userId },
      omit: { userId: true },
      include: detailInclude,
    });

    if (!filament) {
      throw new NotFoundException('Filamento não encontrado.');
    }

    return filament;
  }

  private async findOwnedNote(
    filamentId: string,
    noteId: string,
    userId: string,
  ) {
    const note = await this.prisma.filamentNote.findFirst({
      where: { id: noteId, filamentId, filament: { userId } },
    });

    if (!note) {
      throw new NotFoundException('Observação não encontrada.');
    }

    return note;
  }

  // A marca também precisa ser do usuário: não dá para pendurar um
  // filamento na marca de outra pessoa.
  private async ensureOwnedBrand(brandId: string, userId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, userId },
      select: { id: true },
    });

    if (!brand) {
      throw new NotFoundException('Marca não encontrada.');
    }
  }

  // "Marrom" e "marrom" da mesma marca e tipo são o mesmo filamento.
  private async ensureNotDuplicate(
    userId: string,
    key: { brandId: string; type: string; colorName: string },
    ignoreFilamentId?: string,
  ) {
    const duplicate = await this.prisma.filament.findFirst({
      where: {
        userId,
        brandId: key.brandId,
        type: { equals: key.type, mode: 'insensitive' },
        colorName: { equals: key.colorName, mode: 'insensitive' },
        ...(ignoreFilamentId && { id: { not: ignoreFilamentId } }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }
  }

  private ensureValidPriceRange(min: number, max: number | null | undefined) {
    if (max != null && min > max) {
      throw new BadRequestException(
        'O preço mínimo não pode ser maior que o máximo.',
      );
    }
  }

  // "#6E473B" e "#6e473b" são a mesma cor; guarda sempre minúsculo.
  private normalizeColors(colors: string[]) {
    return colors.map((color) => color.toLowerCase());
  }

  // "   " passa no @IsNotEmpty, mas vira texto vazio depois do trim.
  private normalizeRequired(value: string, message: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(message);
    }
    return trimmed;
  }

  private normalizeOptional(value: string | null | undefined) {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  // A checagem de duplicado roda antes de gravar; se duas requisições iguais
  // chegam juntas, o índice único do banco barra a segunda. Esse erro vira
  // 409, como a checagem normal, em vez de um 500.
  private async withUniqueConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async createFilament(userId: string, data: FilamentDto) {
    const { notes, ...filamentData } = data;
    const type = this.normalizeRequired(data.type, 'Informe o tipo.');
    const colorName = this.normalizeRequired(
      data.colorName,
      'Informe o nome da cor.',
    );
    this.ensureValidPriceRange(data.minPricePaid, data.maxPricePaid);
    await this.ensureOwnedBrand(data.brandId, userId);
    await this.ensureNotDuplicate(userId, {
      brandId: data.brandId,
      type,
      colorName,
    });

    const filament = await this.withUniqueConflict(() =>
      this.prisma.filament.create({
        data: {
          ...filamentData,
          type,
          colorName,
          colors: this.normalizeColors(data.colors),
          lastPurchasedAt: data.lastPurchasedAt ?? new Date(),
          ratingComment: data.rating
            ? this.normalizeOptional(data.ratingComment)
            : null,
          userId,
          ...(notes?.trim() && {
            notes: { create: { content: notes.trim() } },
          }),
        },
        omit: { userId: true },
        include: detailInclude,
      }),
    );

    return { message: 'Filamento criado com sucesso', data: filament };
  }

  async getAllFilaments(userId: string) {
    return this.prisma.filament.findMany({
      where: { userId },
      omit: { userId: true },
      include: brandInclude,
      orderBy: { colorName: 'asc' },
    });
  }

  async getFilamentById(filamentId: string, userId: string) {
    return this.findOwnedFilament(filamentId, userId);
  }

  async updateFilament(
    filamentId: string,
    userId: string,
    data: UpdateFilamentDto,
  ) {
    const current = await this.findOwnedFilament(filamentId, userId);
    const { notes, ...filamentData } = data;

    // Num PATCH parcial, o que não veio continua o que está salvo.
    const brandId = data.brandId ?? current.brandId;
    const type =
      data.type !== undefined
        ? this.normalizeRequired(data.type, 'Informe o tipo.')
        : current.type;
    const colorName =
      data.colorName !== undefined
        ? this.normalizeRequired(data.colorName, 'Informe o nome da cor.')
        : current.colorName;
    this.ensureValidPriceRange(
      data.minPricePaid ?? current.minPricePaid,
      data.maxPricePaid !== undefined
        ? data.maxPricePaid
        : current.maxPricePaid,
    );

    if (data.brandId !== undefined && data.brandId !== current.brandId) {
      await this.ensureOwnedBrand(data.brandId, userId);
    }
    if (
      brandId !== current.brandId ||
      type !== current.type ||
      colorName !== current.colorName
    ) {
      await this.ensureNotDuplicate(
        userId,
        { brandId, type, colorName },
        filamentId,
      );
    }

    const updateData: Prisma.FilamentUncheckedUpdateInput = {
      ...filamentData,
      type,
      colorName,
    };
    if (data.colors !== undefined) {
      updateData.colors = this.normalizeColors(data.colors);
    }
    if (data.ratingComment !== undefined) {
      updateData.ratingComment = this.normalizeOptional(data.ratingComment);
    }
    // Sem nota, o comentário da nota não faz sentido.
    if (data.rating === null) {
      updateData.ratingComment = null;
    }
    // A data de quando acabou acompanha o nível. Marcar FINISHED de novo não
    // move a data original.
    if (data.spoolLevel === 'FINISHED' && !current.finishedAt) {
      updateData.finishedAt = new Date();
    } else if (data.spoolLevel && data.spoolLevel !== 'FINISHED') {
      updateData.finishedAt = null;
    }
    if (notes?.trim()) {
      updateData.notes = { create: { content: notes.trim() } };
    }

    const filament = await this.withUniqueConflict(() =>
      this.prisma.filament.update({
        where: { id: filamentId },
        data: updateData,
        omit: { userId: true },
        include: detailInclude,
      }),
    );

    return { message: 'Filamento atualizado com sucesso', data: filament };
  }

  // Mais uma compra do mesmo filamento: soma a compra, abre a faixa de preço
  // se o valor pago ficou fora dela e volta o filamento para o estoque.
  async addPurchase(
    filamentId: string,
    userId: string,
    data: FilamentPurchaseDto,
  ) {
    const current = await this.findOwnedFilament(filamentId, userId);
    const prices = [
      current.minPricePaid,
      current.maxPricePaid ?? current.minPricePaid,
      data.pricePaid,
    ];
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    const filament = await this.prisma.filament.update({
      where: { id: filamentId },
      data: {
        purchaseCount: { increment: 1 },
        minPricePaid: min,
        maxPricePaid: max === min ? null : max,
        // Uma compra antiga registrada depois não volta a data da última.
        lastPurchasedAt:
          current.lastPurchasedAt &&
          current.lastPurchasedAt > new Date(data.purchasedAt)
            ? current.lastPurchasedAt
            : data.purchasedAt,
        availability: 'AVAILABLE',
        // Rolo novo: carretel cheio.
        spoolLevel: 'FULL',
        finishedAt: null,
      },
      omit: { userId: true },
      include: detailInclude,
    });

    return { message: 'Compra registrada com sucesso', data: filament };
  }

  async deleteFilament(filamentId: string, userId: string) {
    await this.findOwnedFilament(filamentId, userId);

    await this.prisma.filament.delete({ where: { id: filamentId } });

    return { message: 'Filamento excluído com sucesso' };
  }

  async addNote(filamentId: string, userId: string, data: FilamentNoteDto) {
    await this.findOwnedFilament(filamentId, userId);

    const note = await this.prisma.filamentNote.create({
      data: {
        content: this.normalizeRequired(
          data.content,
          'A observação não pode ficar vazia.',
        ),
        filamentId,
      },
    });

    return { message: 'Observação adicionada com sucesso', data: note };
  }

  async updateNote(
    filamentId: string,
    noteId: string,
    userId: string,
    data: FilamentNoteDto,
  ) {
    await this.findOwnedNote(filamentId, noteId, userId);

    const note = await this.prisma.filamentNote.update({
      where: { id: noteId },
      data: {
        content: this.normalizeRequired(
          data.content,
          'A observação não pode ficar vazia.',
        ),
      },
    });

    return { message: 'Observação atualizada com sucesso', data: note };
  }

  async deleteNote(filamentId: string, noteId: string, userId: string) {
    await this.findOwnedNote(filamentId, noteId, userId);

    await this.prisma.filamentNote.delete({ where: { id: noteId } });

    return { message: 'Observação excluída com sucesso' };
  }
}
