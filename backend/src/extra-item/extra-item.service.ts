import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ExtraItemDto,
  ExtraItemLotDto,
  UpdateExtraItemDto,
} from './dto/extra-item.js';
import { Prisma } from '../generated/prisma/client.js';

// Do mais recente para o mais antigo; no mesmo dia, o cadastrado por último.
const lotsOrderBy = [
  { purchasedAt: 'desc' },
  { createdAt: 'desc' },
] satisfies Prisma.ExtraItemLotOrderByWithRelationInput[];

const lotSelect = {
  id: true,
  price: true,
  quantity: true,
  purchasedAt: true,
} satisfies Prisma.ExtraItemLotSelect;

const itemInclude = {
  lots: { select: lotSelect, orderBy: lotsOrderBy },
} satisfies Prisma.ExtraItemInclude;

type ItemWithLots = Prisma.ExtraItemGetPayload<{
  include: typeof itemInclude;
  omit: { userId: true };
}>;

const DUPLICATE_MESSAGE = 'Já existe um item extra com esse nome.';

@Injectable()
export class ExtraItemService {
  constructor(private prisma: PrismaService) {}

  // O item precisa ser do usuário do token. De outro usuário responde 404,
  // sem revelar que existe.
  private async findOwnedItem(itemId: string, userId: string) {
    const item = await this.prisma.extraItem.findFirst({
      where: { id: itemId, userId },
      omit: { userId: true },
      include: itemInclude,
    });

    if (!item) {
      throw new NotFoundException('Item extra não encontrado.');
    }

    return item;
  }

  // "Argola" e "argola" são o mesmo item.
  private async ensureNotDuplicate(
    userId: string,
    name: string,
    ignoreItemId?: string,
  ) {
    const duplicate = await this.prisma.extraItem.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        ...(ignoreItemId && { id: { not: ignoreItemId } }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }
  }

  // "   " passa no @IsNotEmpty, mas vira texto vazio depois do trim.
  private normalizeName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Informe o nome do item.');
    }
    return trimmed;
  }

  private normalizeNotes(value: string | null | undefined) {
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

  // O lote mais recente define o custo unitário; o resto é o resumo do
  // histórico que a lista e o detalhe mostram.
  private withSummary({ lots, ...item }: ItemWithLots) {
    const latest = lots[0];
    return {
      ...item,
      lotPrice: latest?.price ?? 0,
      lotQuantity: latest?.quantity ?? 0,
      lotCount: lots.length,
      totalInvested: lots.reduce((sum, lot) => sum + lot.price, 0),
      lastPurchasedAt: latest?.purchasedAt ?? null,
    };
  }

  private withHistory(item: ItemWithLots) {
    return { ...this.withSummary(item), lots: item.lots };
  }

  async createItem(userId: string, data: ExtraItemDto) {
    const name = this.normalizeName(data.name);
    await this.ensureNotDuplicate(userId, name);

    const item = await this.withUniqueConflict(() =>
      this.prisma.extraItem.create({
        data: {
          name,
          notes: this.normalizeNotes(data.notes) ?? null,
          userId,
          lots: {
            create: {
              price: data.lotPrice,
              quantity: data.lotQuantity,
              purchasedAt: data.purchasedAt ?? new Date(),
            },
          },
        },
        omit: { userId: true },
        include: itemInclude,
      }),
    );

    return {
      message: 'Item extra criado com sucesso',
      data: this.withHistory(item),
    };
  }

  async getAllItems(userId: string) {
    const items = await this.prisma.extraItem.findMany({
      where: { userId },
      omit: { userId: true },
      include: itemInclude,
      orderBy: { name: 'asc' },
    });

    return items.map((item) => this.withSummary(item));
  }

  async getItemById(itemId: string, userId: string) {
    return this.withHistory(await this.findOwnedItem(itemId, userId));
  }

  async updateItem(itemId: string, userId: string, data: UpdateExtraItemDto) {
    const current = await this.findOwnedItem(itemId, userId);

    const name =
      data.name !== undefined ? this.normalizeName(data.name) : current.name;
    if (name.toLowerCase() !== current.name.toLowerCase()) {
      await this.ensureNotDuplicate(userId, name, itemId);
    }

    const latestLot = current.lots[0];
    const correctsLot =
      latestLot &&
      (data.lotPrice !== undefined || data.lotQuantity !== undefined);

    const item = await this.withUniqueConflict(() =>
      this.prisma.extraItem.update({
        where: { id: itemId },
        data: {
          name,
          notes: this.normalizeNotes(data.notes),
          ...(correctsLot && {
            lots: {
              update: {
                where: { id: latestLot.id },
                data: { price: data.lotPrice, quantity: data.lotQuantity },
              },
            },
          }),
        },
        omit: { userId: true },
        include: itemInclude,
      }),
    );

    return {
      message: 'Item extra atualizado com sucesso',
      data: this.withHistory(item),
    };
  }

  // Recompra: o lote entra no histórico e, se for o mais recente, passa a
  // definir o custo unitário.
  async addLot(itemId: string, userId: string, data: ExtraItemLotDto) {
    await this.findOwnedItem(itemId, userId);

    const item = await this.prisma.extraItem.update({
      where: { id: itemId },
      data: {
        lots: {
          create: {
            price: data.price,
            quantity: data.quantity,
            purchasedAt: data.purchasedAt,
          },
        },
      },
      omit: { userId: true },
      include: itemInclude,
    });

    return {
      message: 'Lote registrado com sucesso',
      data: this.withHistory(item),
    };
  }

  // Lote registrado por engano. O último não sai: sem lote não há custo
  // unitário, e nesse caso o certo é excluir o item.
  async deleteLot(itemId: string, lotId: string, userId: string) {
    const current = await this.findOwnedItem(itemId, userId);

    if (!current.lots.some((lot) => lot.id === lotId)) {
      throw new NotFoundException('Lote não encontrado.');
    }
    if (current.lots.length === 1) {
      throw new BadRequestException(
        'Este é o único lote do item. Para removê-lo, exclua o item.',
      );
    }

    const item = await this.prisma.extraItem.update({
      where: { id: itemId },
      data: { lots: { delete: { id: lotId } } },
      omit: { userId: true },
      include: itemInclude,
    });

    return {
      message: 'Lote excluído com sucesso',
      data: this.withHistory(item),
    };
  }

  async deleteItem(itemId: string, userId: string) {
    await this.findOwnedItem(itemId, userId);

    // Os lotes saem junto (onDelete: Cascade).
    await this.prisma.extraItem.delete({ where: { id: itemId } });

    return { message: 'Item extra excluído com sucesso' };
  }
}
