import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogItemDto } from './dto/catalog.js';
import { Prisma } from '../generated/prisma/client.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

// O "data" passado na chamada n do mock do Prisma.
function dataOf(mock: AsyncMock, call = 0) {
  return (mock.mock.calls[call][0] as { data: Record<string, any> }).data;
}

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: {
    catalogItem: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    category: { findFirst: AsyncMock };
    printItem: { count: AsyncMock };
    printPhoto: { count: AsyncMock };
  };

  const userId = 'user-1';
  const itemId = '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
  const categoryId = '5f0c7c1e-8a52-4a8e-9a7d-0d1c2b3a4f5e';
  const printP = '7d1e2f3a-4b5c-4d6e-8f70-819a2b3c4d5e';
  const printM = '8e2f3a4b-5c6d-4e7f-9a81-92ab3c4d5e6f';
  const photoId = '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a';

  // Como o Prisma devolve, com as relações do include.
  function itemRow(overrides: Record<string, unknown> = {}) {
    return {
      id: itemId,
      name: 'Vaso hexagonal',
      description: null,
      kind: 'SIZES',
      kitPrice: null,
      categoryId,
      category: { id: categoryId, name: 'Decoração', color: '#8bbf3d' },
      createdAt: new Date('2026-10-15T12:00:00.000Z'),
      updatedAt: new Date('2026-10-15T12:00:00.000Z'),
      variants: [
        {
          id: 'var-p',
          position: 0,
          label: 'P',
          priceOverride: 34,
          printItemId: printP,
          catalogItemId: itemId,
        },
        {
          id: 'var-m',
          position: 1,
          label: 'M',
          priceOverride: null,
          printItemId: null,
          catalogItemId: itemId,
        },
      ],
      photos: [{ photoId }],
      ...overrides,
    };
  }

  function itemDto(overrides: Partial<CatalogItemDto> = {}): CatalogItemDto {
    return {
      name: '  Vaso hexagonal  ',
      description: '   ',
      categoryId,
      kind: 'SIZES',
      variants: [
        { label: ' P ', printItemId: printP, priceOverride: 34.004 },
        { label: 'M', printItemId: printM, priceOverride: null },
      ],
      kitPrice: 99,
      photoIds: [photoId],
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      catalogItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      category: { findFirst: jest.fn() },
      printItem: { count: jest.fn() },
      printPhoto: { count: jest.fn() },
    };
    prisma.category.findFirst.mockResolvedValue({ id: categoryId });
    prisma.printItem.count.mockResolvedValue(2);
    prisma.printPhoto.count.mockResolvedValue(1);
    prisma.catalogItem.create.mockResolvedValue(itemRow());
    prisma.catalogItem.update.mockResolvedValue(itemRow());

    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('createItem', () => {
    it('saves the sizes in order, trimmed, with prices in cents', async () => {
      await service.createItem(userId, itemDto());

      const data = dataOf(prisma.catalogItem.create);
      expect(data).toMatchObject({
        name: 'Vaso hexagonal',
        description: null,
        categoryId,
        kind: 'SIZES',
        // Fora de KIT o preço do kit não vale.
        kitPrice: null,
        userId,
        variants: {
          create: [
            { position: 0, label: 'P', printItemId: printP, priceOverride: 34 },
            {
              position: 1,
              label: 'M',
              printItemId: printM,
              priceOverride: null,
            },
          ],
        },
        photos: { create: [{ photoId, position: 0 }] },
      });
    });

    it('answers with the flat shape the front expects', async () => {
      const result = await service.createItem(userId, itemDto());

      expect(result.data).toEqual({
        id: itemId,
        name: 'Vaso hexagonal',
        description: null,
        category: { id: categoryId, name: 'Decoração', color: '#8bbf3d' },
        kind: 'SIZES',
        variants: [
          { id: 'var-p', label: 'P', printItemId: printP, priceOverride: 34 },
          // A impressão foi excluída: a linha fica sem ela.
          { id: 'var-m', label: 'M', printItemId: null, priceOverride: null },
        ],
        kitPrice: null,
        photoIds: [photoId],
        createdAt: new Date('2026-10-15T12:00:00.000Z'),
      });
    });

    it('keeps the kit price and drops the per-piece prices in a kit', async () => {
      await service.createItem(
        userId,
        itemDto({ kind: 'KIT', kitPrice: 18.456 }),
      );

      const data = dataOf(prisma.catalogItem.create);
      expect(data.kitPrice).toBe(18.46);
      expect(data.variants).toEqual({
        create: [
          { position: 0, label: '', printItemId: printP, priceOverride: null },
          { position: 1, label: '', printItemId: printM, priceOverride: null },
        ],
      });
    });

    it('accepts a single piece without labels', async () => {
      prisma.printItem.count.mockResolvedValue(1);

      await service.createItem(
        userId,
        itemDto({
          kind: 'SINGLE',
          variants: [{ label: 'P', printItemId: printP, priceOverride: 8 }],
        }),
      );

      expect(dataOf(prisma.catalogItem.create).variants).toEqual({
        create: [
          { position: 0, label: '', printItemId: printP, priceOverride: 8 },
        ],
      });
    });

    it('rejects a single piece linked to two prints', async () => {
      await expect(
        service.createItem(userId, itemDto({ kind: 'SINGLE' })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.catalogItem.create).not.toHaveBeenCalled();
    });

    it('rejects a size without a name', async () => {
      await expect(
        service.createItem(
          userId,
          itemDto({
            variants: [
              { label: '  ', printItemId: printP },
              { label: 'M', printItemId: printM },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a repeated size, ignoring case', async () => {
      await expect(
        service.createItem(
          userId,
          itemDto({
            variants: [
              { label: 'G', printItemId: printP },
              { label: 'g', printItemId: printM },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a blank name', async () => {
      await expect(
        service.createItem(userId, itemDto({ name: '   ' })),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects someone else's print", async () => {
      prisma.printItem.count.mockResolvedValue(1);

      await expect(service.createItem(userId, itemDto())).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.printItem.count).toHaveBeenCalledWith({
        where: { id: { in: [printP, printM] }, userId },
      });
    });

    it('counts a print used twice (a kit of two equal pieces) once', async () => {
      prisma.printItem.count.mockResolvedValue(1);

      await service.createItem(
        userId,
        itemDto({
          kind: 'KIT',
          variants: [{ printItemId: printP }, { printItemId: printP }],
        }),
      );

      expect(prisma.catalogItem.create).toHaveBeenCalled();
    });

    it("rejects someone else's category", async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.createItem(userId, itemDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a photo that is not from the linked prints', async () => {
      prisma.printPhoto.count.mockResolvedValue(0);

      await expect(service.createItem(userId, itemDto())).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.printPhoto.count).toHaveBeenCalledWith({
        where: {
          id: { in: [photoId] },
          record: { item: { id: { in: [printP, printM] }, userId } },
        },
      });
    });

    it('skips the photo check without photos', async () => {
      await service.createItem(userId, itemDto({ photoIds: undefined }));

      expect(prisma.printPhoto.count).not.toHaveBeenCalled();
      expect(dataOf(prisma.catalogItem.create).photos).toEqual({ create: [] });
    });

    it('turns a repeated name into 409', async () => {
      prisma.catalogItem.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.createItem(userId, itemDto())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getAllItems', () => {
    it("lists only the user's items, by name", async () => {
      prisma.catalogItem.findMany.mockResolvedValue([itemRow()]);

      const result = await service.getAllItems(userId);

      const args = prisma.catalogItem.findMany.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(args.where).toEqual({ userId });
      expect(args.orderBy).toEqual({ name: 'asc' });
      expect(result[0].photoIds).toEqual([photoId]);
    });
  });

  describe('getItemById', () => {
    it("responds 404 for someone else's item", async () => {
      prisma.catalogItem.findFirst.mockResolvedValue(null);

      await expect(service.getItemById(itemId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.catalogItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: itemId, userId } }),
      );
    });
  });

  describe('updateItem', () => {
    it('replaces the variants and photos in one write', async () => {
      prisma.catalogItem.findFirst.mockResolvedValue(itemRow());

      await service.updateItem(itemId, userId, itemDto({ photoIds: [] }));

      expect(prisma.catalogItem.update.mock.calls[0][0]).toMatchObject({
        where: { id: itemId },
        data: {
          variants: {
            deleteMany: {},
            create: [{ label: 'P' }, { label: 'M' }],
          },
          photos: { deleteMany: {}, create: [] },
        },
      });
    });

    it("does not touch someone else's item", async () => {
      prisma.catalogItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem(itemId, userId, itemDto()),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.catalogItem.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('deletes an owned item', async () => {
      prisma.catalogItem.findFirst.mockResolvedValue(itemRow());

      await service.deleteItem(itemId, userId);

      expect(prisma.catalogItem.delete).toHaveBeenCalledWith({
        where: { id: itemId },
      });
    });

    it("does not delete someone else's item", async () => {
      prisma.catalogItem.findFirst.mockResolvedValue(null);

      await expect(service.deleteItem(itemId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.catalogItem.delete).not.toHaveBeenCalled();
    });
  });
});
