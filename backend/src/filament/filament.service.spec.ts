import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FilamentService } from './filament.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { FilamentDto } from './dto/filament.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('FilamentService', () => {
  let service: FilamentService;
  let prisma: {
    filament: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    filamentNote: {
      findFirst: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    brand: { findFirst: AsyncMock };
  };

  const userId = 'user-1';
  const brandId = 'brand-1';
  const filamentId = 'filament-1';
  const noteId = 'note-1';
  const filament = {
    id: filamentId,
    brandId,
    type: 'PLA',
    colorName: 'Marrom',
    colors: ['#6e473b'],
    minPricePaid: 110,
    maxPricePaid: 120,
    purchaseCount: 3,
    lastPurchasedAt: new Date('2026-06-11T12:00:00.000Z'),
    finishedAt: null,
    notes: [],
  };
  const input: FilamentDto = {
    brandId,
    type: 'PLA',
    colorName: '  Marrom ',
    colors: ['#6E473B'],
    spoolWeightGrams: 1000,
    minPricePaid: 110,
  };

  beforeEach(async () => {
    prisma = {
      filament: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      filamentNote: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      brand: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilamentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FilamentService>(FilamentService);
  });

  describe('createFilament', () => {
    it('lança NotFoundException se a marca não for do usuário', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);

      await expect(service.createFilament(userId, input)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.brand.findFirst).toHaveBeenCalledWith({
        where: { id: brandId, userId },
        select: { id: true },
      });
      expect(prisma.filament.create).not.toHaveBeenCalled();
    });

    it('lança ConflictException se a mesma cor já existe na marca e tipo (sem diferenciar maiúsculas)', async () => {
      prisma.brand.findFirst.mockResolvedValue({ id: brandId });
      prisma.filament.findFirst.mockResolvedValue({ id: 'other' });

      await expect(service.createFilament(userId, input)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.filament.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          brandId,
          type: { equals: 'PLA', mode: 'insensitive' },
          colorName: { equals: 'Marrom', mode: 'insensitive' },
        },
        select: { id: true },
      });
      expect(prisma.filament.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se o preço mínimo é maior que o máximo', async () => {
      await expect(
        service.createFilament(userId, { ...input, maxPricePaid: 100 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.filament.create).not.toHaveBeenCalled();
    });

    it('cria o filamento normalizando texto e cor, e transforma a observação em nota', async () => {
      prisma.brand.findFirst.mockResolvedValue({ id: brandId });
      prisma.filament.findFirst.mockResolvedValue(null);
      prisma.filament.create.mockResolvedValue(filament);

      const result = await service.createFilament(userId, {
        ...input,
        // Silk duo color: duas cores, na ordem do degradê.
        colors: ['#1F9070', '#1E2D2B'],
        lastPurchasedAt: '2026-06-11T12:00:00.000Z',
        notes: '  Fecha bem em 0,2. ',
      });

      const call = prisma.filament.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).toMatchObject({
        brandId,
        type: 'PLA',
        colorName: 'Marrom',
        colors: ['#1f9070', '#1e2d2b'],
        lastPurchasedAt: '2026-06-11T12:00:00.000Z',
        userId,
        notes: { create: { content: 'Fecha bem em 0,2.' } },
      });
      expect(result).toEqual({
        message: 'Filamento criado com sucesso',
        data: filament,
      });
    });

    it('transforma a violação do índice único em ConflictException', async () => {
      prisma.brand.findFirst.mockResolvedValue({ id: brandId });
      prisma.filament.findFirst.mockResolvedValue(null);
      prisma.filament.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.createFilament(userId, input)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getAllFilaments', () => {
    it('lista só os filamentos do usuário, com a marca', async () => {
      prisma.filament.findMany.mockResolvedValue([filament]);

      await service.getAllFilaments(userId);

      expect(prisma.filament.findMany).toHaveBeenCalledWith({
        where: { userId },
        omit: { userId: true },
        include: { brand: { select: { id: true, name: true } } },
        orderBy: { colorName: 'asc' },
      });
    });
  });

  describe('updateFilament', () => {
    it('lança NotFoundException se o filamento não for do usuário', async () => {
      prisma.filament.findFirst.mockResolvedValue(null);

      await expect(
        service.updateFilament(filamentId, userId, { rating: 4 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.filament.update).not.toHaveBeenCalled();
    });

    it('valida a faixa de preço contra o valor salvo num PATCH parcial', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);

      await expect(
        service.updateFilament(filamentId, userId, { minPricePaid: 130 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marca como acabou com a data de agora, sem checar duplicado', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);
      prisma.filament.update.mockResolvedValue(filament);

      await service.updateFilament(filamentId, userId, {
        spoolLevel: 'FINISHED',
      });

      expect(prisma.filament.findFirst).toHaveBeenCalledTimes(1);
      const call = prisma.filament.update.mock.calls[0][0] as {
        data: { finishedAt: Date };
      };
      expect(call.data.finishedAt).toBeInstanceOf(Date);
    });

    it('marcar de novo não muda a data em que acabou', async () => {
      prisma.filament.findFirst.mockResolvedValue({
        ...filament,
        finishedAt: new Date('2026-07-01'),
      });
      prisma.filament.update.mockResolvedValue(filament);

      await service.updateFilament(filamentId, userId, {
        spoolLevel: 'FINISHED',
      });

      const call = prisma.filament.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).not.toHaveProperty('finishedAt');
    });

    it('sair de "acabou" limpa a data em que acabou', async () => {
      prisma.filament.findFirst.mockResolvedValue({
        ...filament,
        spoolLevel: 'FINISHED',
        finishedAt: new Date('2026-07-01'),
      });
      prisma.filament.update.mockResolvedValue(filament);

      await service.updateFilament(filamentId, userId, { spoolLevel: 'LOW' });

      const call = prisma.filament.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).toMatchObject({ spoolLevel: 'LOW', finishedAt: null });
    });

    it('editar outros campos não mexe no nível nem na data', async () => {
      prisma.filament.findFirst.mockResolvedValue({
        ...filament,
        spoolLevel: 'FINISHED',
        finishedAt: new Date('2026-07-01'),
      });
      prisma.filament.update.mockResolvedValue(filament);

      await service.updateFilament(filamentId, userId, { rating: 5 });

      const call = prisma.filament.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).not.toHaveProperty('spoolLevel');
      expect(call.data).not.toHaveProperty('finishedAt');
    });

    it('limpar a nota limpa o comentário dela', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);
      prisma.filament.update.mockResolvedValue(filament);

      await service.updateFilament(filamentId, userId, { rating: null });

      const call = prisma.filament.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).toMatchObject({ rating: null, ratingComment: null });
    });

    it('checa duplicado e a marca ao trocar de marca', async () => {
      prisma.filament.findFirst
        .mockResolvedValueOnce(filament)
        .mockResolvedValueOnce({ id: 'other' });
      prisma.brand.findFirst.mockResolvedValue({ id: 'brand-2' });

      await expect(
        service.updateFilament(filamentId, userId, { brandId: 'brand-2' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.brand.findFirst).toHaveBeenCalledWith({
        where: { id: 'brand-2', userId },
        select: { id: true },
      });
      expect(prisma.filament.update).not.toHaveBeenCalled();
    });
  });

  describe('addPurchase', () => {
    it('soma a compra, abre a faixa de preço e volta para o estoque', async () => {
      prisma.filament.findFirst.mockResolvedValue({
        ...filament,
        finishedAt: new Date('2026-07-01'),
      });
      prisma.filament.update.mockResolvedValue(filament);

      const result = await service.addPurchase(filamentId, userId, {
        pricePaid: 125,
        purchasedAt: '2026-10-01T12:00:00.000Z',
      });

      expect(prisma.filament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: filamentId },
          data: {
            purchaseCount: { increment: 1 },
            minPricePaid: 110,
            maxPricePaid: 125,
            lastPurchasedAt: '2026-10-01T12:00:00.000Z',
            availability: 'AVAILABLE',
            spoolLevel: 'FULL',
            finishedAt: null,
          },
        }),
      );
      expect(result.message).toBe('Compra registrada com sucesso');
    });

    it('uma compra mais antiga não volta a data da última compra', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);
      prisma.filament.update.mockResolvedValue(filament);

      await service.addPurchase(filamentId, userId, {
        pricePaid: 115,
        purchasedAt: '2026-01-01T12:00:00.000Z',
      });

      const call = prisma.filament.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.lastPurchasedAt).toEqual(filament.lastPurchasedAt);
      expect(call.data).toMatchObject({ minPricePaid: 110, maxPricePaid: 120 });
    });

    it('preço igual ao único já pago mantém o máximo vazio', async () => {
      prisma.filament.findFirst.mockResolvedValue({
        ...filament,
        minPricePaid: 100,
        maxPricePaid: null,
      });
      prisma.filament.update.mockResolvedValue(filament);

      await service.addPurchase(filamentId, userId, {
        pricePaid: 100,
        purchasedAt: '2026-10-01T12:00:00.000Z',
      });

      const call = prisma.filament.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).toMatchObject({
        minPricePaid: 100,
        maxPricePaid: null,
      });
    });
  });

  describe('deleteFilament', () => {
    it('lança NotFoundException se o filamento não for do usuário', async () => {
      prisma.filament.findFirst.mockResolvedValue(null);

      await expect(service.deleteFilament(filamentId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.filament.delete).not.toHaveBeenCalled();
    });

    it('exclui o filamento', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);

      const result = await service.deleteFilament(filamentId, userId);

      expect(prisma.filament.delete).toHaveBeenCalledWith({
        where: { id: filamentId },
      });
      expect(result).toEqual({ message: 'Filamento excluído com sucesso' });
    });
  });

  describe('notas', () => {
    it('adiciona nota ao filamento do usuário', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);
      prisma.filamentNote.create.mockResolvedValue({ id: noteId });

      await service.addNote(filamentId, userId, { content: '  Velvet some. ' });

      expect(prisma.filamentNote.create).toHaveBeenCalledWith({
        data: { content: 'Velvet some.', filamentId },
      });
    });

    it('recusa nota só com espaços', async () => {
      prisma.filament.findFirst.mockResolvedValue(filament);

      await expect(
        service.addNote(filamentId, userId, { content: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('não edita nota de filamento de outro usuário', async () => {
      prisma.filamentNote.findFirst.mockResolvedValue(null);

      await expect(
        service.updateNote(filamentId, noteId, userId, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.filamentNote.findFirst).toHaveBeenCalledWith({
        where: { id: noteId, filamentId, filament: { userId } },
      });
    });

    it('exclui a nota', async () => {
      prisma.filamentNote.findFirst.mockResolvedValue({ id: noteId });

      await service.deleteNote(filamentId, noteId, userId);

      expect(prisma.filamentNote.delete).toHaveBeenCalledWith({
        where: { id: noteId },
      });
    });
  });
});
