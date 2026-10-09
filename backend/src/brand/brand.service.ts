import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BrandDto, BrandNoteDto, UpdateBrandDto } from './dto/brand.js';
import { Prisma } from '../generated/prisma/client.js';

const notesInclude = {
  notes: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.BrandInclude;

@Injectable()
export class BrandService {
  constructor(private prisma: PrismaService) {}

  // A marca precisa ser do usuário do token. De outro usuário responde 404,
  // sem revelar que existe.
  private async findOwnedBrand(brandId: string, userId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, userId },
      omit: { userId: true },
      include: notesInclude,
    });

    if (!brand) {
      throw new NotFoundException('Marca não encontrada.');
    }

    return brand;
  }

  private async findOwnedNote(brandId: string, noteId: string, userId: string) {
    const note = await this.prisma.brandNote.findFirst({
      where: { id: noteId, brandId, brand: { userId } },
    });

    if (!note) {
      throw new NotFoundException('Observação não encontrada.');
    }

    return note;
  }

  // "Voolt3D" e "voolt3d" são a mesma marca.
  private async ensureNameAvailable(
    name: string,
    userId: string,
    ignoreBrandId?: string,
  ) {
    const duplicate = await this.prisma.brand.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        ...(ignoreBrandId && { id: { not: ignoreBrandId } }),
      },
    });

    if (duplicate) {
      throw new ConflictException('Essa marca já existe.');
    }
  }

  private ensureValidPriceRange(
    min: number | null | undefined,
    max: number | null | undefined,
  ) {
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'O preço mínimo não pode ser maior que o máximo.',
      );
    }
  }

  // Tira espaços e repetidas ("Preto" e "preto"), mantendo a primeira.
  private normalizeColors(colors: string[]) {
    const seen = new Set<string>();
    return colors
      .map((color) => color.trim())
      .filter((color) => {
        const key = color.toLowerCase();
        if (!color || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  // "   " passa no @IsNotEmpty, mas vira nome vazio depois do trim.
  private normalizeName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Informe o nome da marca.');
    }
    return trimmed;
  }

  private normalizeNoteContent(content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('A observação não pode ficar vazia.');
    }
    return trimmed;
  }

  // A checagem de nome repetido roda antes de gravar; se duas requisições
  // com o mesmo nome chegam juntas, o índice único do banco barra a segunda.
  // Esse erro vira 409, como a checagem normal, em vez de um 500.
  private async withUniqueNameConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Essa marca já existe.');
      }
      throw error;
    }
  }

  async createBrand(userId: string, data: BrandDto) {
    const { notes, preferredColors, ...brandData } = data;
    const name = this.normalizeName(brandData.name);
    this.ensureValidPriceRange(
      brandData.researchedMinPricePerKg,
      brandData.researchedMaxPricePerKg,
    );
    await this.ensureNameAvailable(name, userId);

    const brand = await this.withUniqueNameConflict(() =>
      this.prisma.brand.create({
        data: {
          ...brandData,
          name,
          userId,
          ...(preferredColors && {
            preferredColors: this.normalizeColors(preferredColors),
          }),
          ...(notes?.trim() && {
            notes: { create: { content: notes.trim() } },
          }),
        },
        omit: { userId: true },
        include: notesInclude,
      }),
    );

    return { message: 'Marca criada com sucesso', data: brand };
  }

  async getAllBrands(userId: string, archived = false) {
    return this.prisma.brand.findMany({
      where: { userId, archivedAt: archived ? { not: null } : null },
      omit: { userId: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBrandById(brandId: string, userId: string) {
    return this.findOwnedBrand(brandId, userId);
  }

  async updateBrand(brandId: string, userId: string, data: UpdateBrandDto) {
    const current = await this.findOwnedBrand(brandId, userId);
    const { archived, notes, preferredColors, ...brandData } = data;

    // Num PATCH parcial, o lado que não veio continua o que está salvo.
    this.ensureValidPriceRange(
      brandData.researchedMinPricePerKg !== undefined
        ? brandData.researchedMinPricePerKg
        : current.researchedMinPricePerKg,
      brandData.researchedMaxPricePerKg !== undefined
        ? brandData.researchedMaxPricePerKg
        : current.researchedMaxPricePerKg,
    );

    const updateData: Prisma.BrandUpdateInput = { ...brandData };
    if (brandData.name !== undefined) {
      updateData.name = this.normalizeName(brandData.name);
      await this.ensureNameAvailable(updateData.name, userId, brandId);
    }
    // Arquivar de novo não move a data original do arquivamento.
    if (archived === true && !current.archivedAt) {
      updateData.archivedAt = new Date();
    } else if (archived === false) {
      updateData.archivedAt = null;
    }
    if (notes?.trim()) {
      updateData.notes = { create: { content: notes.trim() } };
    }
    // A lista enviada substitui a anterior inteira.
    if (preferredColors) {
      updateData.preferredColors = this.normalizeColors(preferredColors);
    }

    const brand = await this.withUniqueNameConflict(() =>
      this.prisma.brand.update({
        where: { id: brandId },
        data: updateData,
        omit: { userId: true },
        include: notesInclude,
      }),
    );

    return { message: 'Marca atualizada com sucesso', data: brand };
  }

  async deleteBrand(brandId: string, userId: string) {
    await this.findOwnedBrand(brandId, userId);

    await this.prisma.brand.delete({ where: { id: brandId } });

    return { message: 'Marca excluída com sucesso' };
  }

  async addNote(brandId: string, userId: string, data: BrandNoteDto) {
    await this.findOwnedBrand(brandId, userId);

    const note = await this.prisma.brandNote.create({
      data: { content: this.normalizeNoteContent(data.content), brandId },
    });

    return { message: 'Observação adicionada com sucesso', data: note };
  }

  async updateNote(
    brandId: string,
    noteId: string,
    userId: string,
    data: BrandNoteDto,
  ) {
    await this.findOwnedNote(brandId, noteId, userId);

    const note = await this.prisma.brandNote.update({
      where: { id: noteId },
      data: { content: this.normalizeNoteContent(data.content) },
    });

    return { message: 'Observação atualizada com sucesso', data: note };
  }

  async deleteNote(brandId: string, noteId: string, userId: string) {
    await this.findOwnedNote(brandId, noteId, userId);

    await this.prisma.brandNote.delete({ where: { id: noteId } });

    return { message: 'Observação excluída com sucesso' };
  }
}
