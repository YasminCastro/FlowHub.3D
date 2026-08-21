import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { CategoryDto } from './dto/category.js';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: jest.Mocked<CategoryService>;

  const userId = 'user-1';
  const categoryId = 'category-1';
  const dto: CategoryDto = {
    name: 'Filamentos',
    color: '#ff0000',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: {
            createCategory: jest.fn(),
            findAllCategories: jest.fn(),
            findCategoryById: jest.fn(),
            updateCategory: jest.fn(),
            deleteCategory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get(CategoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /category', () => {
    it('creates a category for the current user', async () => {
      const result = { message: 'Categoria criada com sucesso', category: {} };
      service.createCategory.mockResolvedValue(result as any);

      const response = await controller.post(userId, dto);

      expect(service.createCategory).toHaveBeenCalledWith({
        ...dto,
        userId,
      });
      expect(response).toBe(result);
    });
  });

  describe('GET /category', () => {
    it('returns all categories for the current user', async () => {
      const categories = [{ id: categoryId, name: dto.name, color: dto.color }];
      service.findAllCategories.mockResolvedValue(categories as any);

      const response = await controller.get(userId);

      expect(service.findAllCategories).toHaveBeenCalledWith(userId);
      expect(response).toBe(categories);
    });
  });

  describe('GET /category/:id', () => {
    it('returns a category by id', async () => {
      const category = { id: categoryId, name: dto.name, color: dto.color };
      service.findCategoryById.mockResolvedValue(category as any);

      const response = await controller.getOne(categoryId);

      expect(service.findCategoryById).toHaveBeenCalledWith(categoryId);
      expect(response).toBe(category);
    });
  });

  describe('PATCH /category/:id', () => {
    it('updates a category', async () => {
      const result = {
        message: 'Categoria atualizada com sucesso',
        category: { id: categoryId, ...dto },
      };
      service.updateCategory.mockResolvedValue(result as any);

      const response = await controller.patch(categoryId, dto);

      expect(service.updateCategory).toHaveBeenCalledWith(categoryId, dto);
      expect(response).toBe(result);
    });
  });

  describe('DELETE /category/:id', () => {
    it('deletes a category', async () => {
      const result = { message: 'Categoria deletada com sucesso' };
      service.deleteCategory.mockResolvedValue(result as any);

      const response = await controller.delete(categoryId);

      expect(service.deleteCategory).toHaveBeenCalledWith(categoryId);
      expect(response).toBe(result);
    });
  });
});
