import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async createCategory(categoryData: {
    name: string;
    color: string;
    userId: string;
  }) {
    const category = await this.prisma.category.findUnique({
      where: {
        userId_name: {
          userId: categoryData.userId,
          name: categoryData.name,
        },
      },
    });

    if (category) {
      throw new ConflictException('Essa categoria já existe.');
    }

    const categoryCreated = await this.prisma.category.create({
      data: {
        name: categoryData.name,
        color: categoryData.color,
        userId: categoryData.userId,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    return {
      message: 'Categoria criada com sucesso',
      category: categoryCreated,
    };
  }

  async findAllCategories(userId: string) {
    const categories = await this.prisma.category.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    return categories;
  }

  async findCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    return category;
  }

  async updateCategory(
    categoryId: string,
    categoryData: Prisma.CategoryUpdateInput,
  ) {
    const category = await this.prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      throw new ConflictException('Categoria não encontrada.');
    }
    const updatedCategory = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        name: categoryData.name,
        color: categoryData.color,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    return {
      message: 'Categoria atualizada com sucesso',
      category: updatedCategory,
    };
  }

  async deleteCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      throw new ConflictException('Categoria não encontrada.');
    }
    await this.prisma.category.delete({
      where: {
        id: categoryId,
      },
    });

    return { message: 'Categoria deletada com sucesso' };
  }
}
