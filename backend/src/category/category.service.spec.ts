import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: {
    category: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const userId = 'user-1';
  const categoryId = 'category-1';
  const categoryData = { name: 'Filamentos', color: '#ff0000', userId };

  beforeEach(async () => {
    prisma = {
      category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('createCategory', () => {
    it('throws ConflictException when a category with the same name already exists for the user', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });

      await expect(service.createCategory(categoryData)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('creates the category when no duplicate exists', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      const created = { id: categoryId, name: categoryData.name, color: categoryData.color };
      prisma.category.create.mockResolvedValue(created);

      const result = await service.createCategory(categoryData);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: categoryData,
        select: { id: true, name: true, color: true },
      });
      expect(result).toEqual({
        message: 'Categoria criada com sucesso',
        category: created,
      });
    });
  });

  describe('findAllCategories', () => {
    it('returns categories scoped to the user', async () => {
      const categories = [{ id: categoryId, name: 'Filamentos', color: '#ff0000' }];
      prisma.category.findMany.mockResolvedValue(categories);

      const result = await service.findAllCategories(userId);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { id: true, name: true, color: true },
      });
      expect(result).toBe(categories);
    });
  });

  describe('findCategoryById', () => {
    it('returns the category by id', async () => {
      const category = { id: categoryId, name: 'Filamentos', color: '#ff0000' };
      prisma.category.findUnique.mockResolvedValue(category);

      const result = await service.findCategoryById(categoryId);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: categoryId },
        select: { id: true, name: true, color: true },
      });
      expect(result).toBe(category);
    });
  });

  describe('updateCategory', () => {
    it('throws ConflictException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCategory(categoryId, { name: 'New name' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('updates the category when it exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });
      const updated = { id: categoryId, name: 'New name', color: '#00ff00' };
      prisma.category.update.mockResolvedValue(updated);

      const result = await service.updateCategory(categoryId, {
        name: 'New name',
        color: '#00ff00',
      });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: { name: 'New name', color: '#00ff00' },
        select: { id: true, name: true, color: true },
      });
      expect(result).toEqual({
        message: 'Categoria atualizada com sucesso',
        category: updated,
      });
    });
  });

  describe('deleteCategory', () => {
    it('throws ConflictException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.deleteCategory(categoryId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('deletes the category when it exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });
      prisma.category.delete.mockResolvedValue({ id: categoryId });

      const result = await service.deleteCategory(categoryId);

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
      expect(result).toEqual({ message: 'Categoria deletada com sucesso' });
    });
  });
});
