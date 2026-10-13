import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ExtraItemService } from './extra-item.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ExtraItemDto } from './dto/extra-item.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('ExtraItemService', () => {
  let service: ExtraItemService;
  let prisma: {
    extraItem: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
  };

  const userId = 'user-1';
  const itemId = 'item-1';
  const latestLot = {
    id: 'lot-2',
    price: 23,
    quantity: 100,
    purchasedAt: new Date('2026-05-18T12:00:00.000Z'),
  };
  const olderLot = {
    id: 'lot-1',
    price: 22.5,
    quantity: 100,
    purchasedAt: new Date('2025-11-03T12:00:00.000Z'),
  };
  // Como o Prisma devolve: lotes do mais recente para o mais antigo.
  const item = {
    id: itemId,
    name: 'Argola Chaveiro',
    notes: null,
    lots: [latestLot, olderLot],
  };
  const input: ExtraItemDto = {
    name: '  Argola Chaveiro ',
    lotPrice: 23,
    lotQuantity: 100,
  };

  beforeEach(async () => {
    prisma = {
      extraItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtraItemService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExtraItemService>(ExtraItemService);
  });

  describe('createItem', () => {
    it('lança ConflictException se já existe item com o mesmo nome (sem diferenciar maiúsculas)', async () => {
      prisma.extraItem.findFirst.mockResolvedValue({ id: 'other' });

      await expect(service.createItem(userId, input)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.extraItem.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          name: { equals: 'Argola Chaveiro', mode: 'insensitive' },
        },
        select: { id: true },
      });
      expect(prisma.extraItem.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se o nome é só espaço', async () => {
      await expect(
        service.createItem(userId, { ...input, name: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.extraItem.create).not.toHaveBeenCalled();
    });

    it('cria o item com o primeiro lote e devolve o resumo', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(null);
      prisma.extraItem.create.mockResolvedValue({ ...item, lots: [latestLot] });

      const result = await service.createItem(userId, {
        ...input,
        purchasedAt: '2026-05-18T12:00:00.000Z',
        notes: '  Aço inox. ',
      });

      expect(prisma.extraItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Argola Chaveiro',
            notes: 'Aço inox.',
            userId,
            lots: {
              create: {
                price: 23,
                quantity: 100,
                purchasedAt: '2026-05-18T12:00:00.000Z',
              },
            },
          },
        }),
      );
      expect(result.data).toMatchObject({
        lotPrice: 23,
        lotQuantity: 100,
        lotCount: 1,
        totalInvested: 23,
        lastPurchasedAt: latestLot.purchasedAt,
        lots: [latestLot],
      });
    });

    it('converte a violação do índice único em ConflictException', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(null);
      prisma.extraItem.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.createItem(userId, input)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getAllItems', () => {
    it('resume cada item pelo lote mais recente e soma o investido', async () => {
      prisma.extraItem.findMany.mockResolvedValue([item]);

      const [summary] = await service.getAllItems(userId);

      expect(prisma.extraItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } }),
      );
      expect(summary).toEqual({
        id: itemId,
        name: 'Argola Chaveiro',
        notes: null,
        lotPrice: 23,
        lotQuantity: 100,
        lotCount: 2,
        totalInvested: 45.5,
        lastPurchasedAt: latestLot.purchasedAt,
      });
    });
  });

  describe('getItemById', () => {
    it('lança NotFoundException se o item não é do usuário', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(null);

      await expect(service.getItemById(itemId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.extraItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: itemId, userId } }),
      );
    });
  });

  describe('updateItem', () => {
    it('corrige preço e quantidade no lote mais recente, sem criar outro', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(item);
      prisma.extraItem.update.mockResolvedValue(item);

      await service.updateItem(itemId, userId, { lotPrice: 25 });

      expect(prisma.extraItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: itemId },
          data: {
            name: 'Argola Chaveiro',
            notes: undefined,
            lots: {
              update: {
                where: { id: 'lot-2' },
                data: { price: 25, quantity: undefined },
              },
            },
          },
        }),
      );
    });

    it('não checa duplicado quando o nome só muda maiúsculas', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(item);
      prisma.extraItem.update.mockResolvedValue(item);

      await service.updateItem(itemId, userId, { name: 'argola chaveiro' });

      // Só a busca do próprio item, nenhuma de duplicado.
      expect(prisma.extraItem.findFirst).toHaveBeenCalledTimes(1);
    });

    it('lança ConflictException ao renomear para o nome de outro item', async () => {
      prisma.extraItem.findFirst
        .mockResolvedValueOnce(item)
        .mockResolvedValueOnce({ id: 'other' });

      await expect(
        service.updateItem(itemId, userId, { name: 'Imã 5x1' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.extraItem.update).not.toHaveBeenCalled();
    });
  });

  describe('addLot', () => {
    it('lança NotFoundException se o item não é do usuário', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(null);

      await expect(
        service.addLot(itemId, userId, {
          price: 26,
          quantity: 100,
          purchasedAt: '2026-10-09T12:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.extraItem.update).not.toHaveBeenCalled();
    });

    it('acrescenta o lote ao histórico', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(item);
      prisma.extraItem.update.mockResolvedValue(item);

      await service.addLot(itemId, userId, {
        price: 26,
        quantity: 100,
        purchasedAt: '2026-10-09T12:00:00.000Z',
      });

      expect(prisma.extraItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: itemId },
          data: {
            lots: {
              create: {
                price: 26,
                quantity: 100,
                purchasedAt: '2026-10-09T12:00:00.000Z',
              },
            },
          },
        }),
      );
    });
  });

  describe('deleteLot', () => {
    it('lança NotFoundException se o lote não é deste item', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(item);

      await expect(
        service.deleteLot(itemId, 'lot-de-outro-item', userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.extraItem.update).not.toHaveBeenCalled();
    });

    it('lança BadRequestException ao tentar excluir o único lote', async () => {
      prisma.extraItem.findFirst.mockResolvedValue({
        ...item,
        lots: [latestLot],
      });

      await expect(service.deleteLot(itemId, 'lot-2', userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.extraItem.update).not.toHaveBeenCalled();
    });

    it('exclui o lote e devolve o resumo recalculado', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(item);
      prisma.extraItem.update.mockResolvedValue({ ...item, lots: [olderLot] });

      const result = await service.deleteLot(itemId, 'lot-2', userId);

      expect(prisma.extraItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: itemId },
          data: { lots: { delete: { id: 'lot-2' } } },
        }),
      );
      // Sem o lote mais novo, o unitário volta a ser o do anterior.
      expect(result.data).toMatchObject({
        lotPrice: 22.5,
        lotCount: 1,
        totalInvested: 22.5,
      });
    });
  });

  describe('deleteItem', () => {
    it('lança NotFoundException se o item não é do usuário', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(null);

      await expect(service.deleteItem(itemId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.extraItem.delete).not.toHaveBeenCalled();
    });

    it('exclui o item', async () => {
      prisma.extraItem.findFirst.mockResolvedValue(item);

      await service.deleteItem(itemId, userId);

      expect(prisma.extraItem.delete).toHaveBeenCalledWith({
        where: { id: itemId },
      });
    });
  });
});
