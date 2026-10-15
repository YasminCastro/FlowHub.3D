import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogItemDto } from './dto/catalog.js';
import { Prisma } from '../generated/prisma/client.js';

const itemInclude = {
  category: { select: { id: true, name: true, color: true } },
  variants: { orderBy: { position: 'asc' } },
  photos: { orderBy: { position: 'asc' }, select: { photoId: true } },
} satisfies Prisma.CatalogItemInclude;

type ItemWithRelations = Prisma.CatalogItemGetPayload<{
  include: typeof itemInclude;
  omit: { userId: true };
}>;

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // O item precisa ser do usuário do token. De outro usuário responde 404,
  // sem revelar que existe.
  private async findOwnedItem(itemId: string, userId: string) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: itemId, userId },
      omit: { userId: true },
      include: itemInclude,
    });

    if (!item) {
      throw new NotFoundException('Item do catálogo não encontrado.');
    }

    return item;
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

  private async ensureOwnedPrintItems(userId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const found = await this.prisma.printItem.count({
      where: { id: { in: unique }, userId },
    });
    if (found !== unique.length) {
      throw new NotFoundException('Impressão não encontrada.');
    }
  }

  // Só fotos dos registros das impressões ligadas ao item.
  private async ensureLinkedPhotos(
    userId: string,
    printItemIds: string[],
    photoIds: string[],
  ) {
    if (new Set(photoIds).size !== photoIds.length) {
      throw new BadRequestException('Foto repetida no item.');
    }
    if (!photoIds.length) return;
    const found = await this.prisma.printPhoto.count({
      where: {
        id: { in: photoIds },
        record: { item: { id: { in: printItemIds }, userId } },
      },
    });
    if (found !== photoIds.length) {
      throw new BadRequestException(
        'As fotos precisam ser das impressões ligadas ao item.',
      );
    }
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

  // Centavos: o preço digitado não guarda resto de conta.
  private roundPrice(value: number | null | undefined) {
    return value == null ? null : Math.round(value * 100) / 100;
  }

  // Valida e monta o que é comum a criar e editar. As variações e as fotos
  // são substituídas inteiras.
  private async buildItemData(userId: string, data: CatalogItemDto) {
    const { kind } = data;

    if (kind === 'SINGLE' && data.variants.length !== 1) {
      throw new BadRequestException('Peça única tem uma impressão só.');
    }

    const variants = data.variants.map((variant, position) => ({
      position,
      label: kind === 'SIZES' ? (variant.label?.trim() ?? '') : '',
      printItemId: variant.printItemId,
      priceOverride:
        kind === 'KIT' ? null : this.roundPrice(variant.priceOverride),
    }));

    if (kind === 'SIZES') {
      if (variants.some((v) => !v.label)) {
        throw new BadRequestException('Dê um nome para cada tamanho.');
      }
      const labels = variants.map((v) => v.label.toLocaleLowerCase('pt-BR'));
      if (new Set(labels).size !== labels.length) {
        throw new BadRequestException('Tamanho repetido no item.');
      }
    }

    const printItemIds = variants.map((v) => v.printItemId);
    if (data.categoryId) {
      await this.ensureOwnedCategory(userId, data.categoryId);
    }
    await this.ensureOwnedPrintItems(userId, printItemIds);
    const photoIds = data.photoIds ?? [];
    await this.ensureLinkedPhotos(userId, printItemIds, photoIds);

    return {
      fields: {
        name: this.requireText(data.name, 'Dê um nome para o item.'),
        description: this.normalizeOptional(data.description),
        categoryId: data.categoryId ?? null,
        kind,
        kitPrice: kind === 'KIT' ? this.roundPrice(data.kitPrice) : null,
      },
      variants,
      photos: photoIds.map((photoId, position) => ({ photoId, position })),
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
        throw new ConflictException(
          'Já existe um item no catálogo com esse nome.',
        );
      }
      throw error;
    }
  }

  private toResponse({ variants, photos, ...item }: ItemWithRelations) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      kind: item.kind,
      // printItemId null: a impressão foi excluída depois.
      variants: variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        printItemId: variant.printItemId,
        priceOverride: variant.priceOverride,
      })),
      kitPrice: item.kitPrice,
      photoIds: photos.map((photo) => photo.photoId),
      createdAt: item.createdAt,
    };
  }

  async createItem(userId: string, data: CatalogItemDto) {
    const { fields, variants, photos } = await this.buildItemData(userId, data);

    const item = await this.withUniqueNameConflict(() =>
      this.prisma.catalogItem.create({
        data: {
          ...fields,
          userId,
          variants: { create: variants },
          photos: { create: photos },
        },
        omit: { userId: true },
        include: itemInclude,
      }),
    );

    return {
      message: 'Item adicionado ao catálogo',
      data: this.toResponse(item),
    };
  }

  async getAllItems(userId: string) {
    const items = await this.prisma.catalogItem.findMany({
      where: { userId },
      omit: { userId: true },
      include: itemInclude,
      orderBy: { name: 'asc' },
    });

    return items.map((item) => this.toResponse(item));
  }

  async getItemById(itemId: string, userId: string) {
    return this.toResponse(await this.findOwnedItem(itemId, userId));
  }

  async updateItem(itemId: string, userId: string, data: CatalogItemDto) {
    await this.findOwnedItem(itemId, userId);
    const { fields, variants, photos } = await this.buildItemData(userId, data);

    // Uma escrita só: troca as variações e as fotos junto com os campos.
    const item = await this.withUniqueNameConflict(() =>
      this.prisma.catalogItem.update({
        where: { id: itemId },
        data: {
          ...fields,
          variants: { deleteMany: {}, create: variants },
          photos: { deleteMany: {}, create: photos },
        },
        omit: { userId: true },
        include: itemInclude,
      }),
    );

    return {
      message: 'Item do catálogo atualizado',
      data: this.toResponse(item),
    };
  }

  async deleteItem(itemId: string, userId: string) {
    await this.findOwnedItem(itemId, userId);
    // Variações e fotos escolhidas saem junto (onDelete: Cascade); as
    // impressões e os arquivos das fotos ficam.
    await this.prisma.catalogItem.delete({ where: { id: itemId } });
    return { message: 'Item removido do catálogo' };
  }
}
