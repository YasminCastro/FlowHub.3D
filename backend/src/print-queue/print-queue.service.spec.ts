import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrintQueueService } from './print-queue.service.js';
import { PrintService } from '../print/print.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FinishQueueEntryDto, QueueEntryDto } from './dto/print-queue.js';
import { AddPrintRecordDto } from '../print/dto/print.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

// O argumento da chamada n do mock.
function argOf(mock: AsyncMock, call = 0) {
  return mock.mock.calls[call][0] as Record<string, any>;
}

// O "data" passado na chamada n do mock do Prisma.
function dataOf(mock: AsyncMock, call = 0) {
  return (mock.mock.calls[call][0] as { data: Record<string, any> }).data;
}

describe('PrintQueueService', () => {
  let service: PrintQueueService;
  let prisma: {
    printQueueEntry: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      updateMany: AsyncMock;
      delete: AsyncMock;
      aggregate: AsyncMock;
    };
    printItem: { findFirst: AsyncMock };
    printer: { findFirst: AsyncMock };
    filament: { findMany: AsyncMock };
    $transaction: AsyncMock;
  };
  let printService: { addRecord: AsyncMock; createItem: AsyncMock };

  const userId = 'user-1';
  const entryId = '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
  const otherEntryId = '4b3c2d1e-0f9a-4b8c-9d7e-6f5a4b3c2d1e';
  const printerId = '5f0c7c1e-8a52-4a8e-9a7d-0d1c2b3a4f5e';
  const filamentId = '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a';
  const printItemId = '7d1e2f3a-4b5c-4d6e-8f70-819a2b3c4d5e';

  const filament = {
    id: filamentId,
    colorName: 'Azul',
    type: 'PLA',
    colors: ['#3f7fd6'],
    minPricePaid: 80,
    maxPricePaid: 100,
    spoolWeightGrams: 1000,
    brand: { name: 'Voolt' },
  };

  // Como o Prisma devolve, com as relações do include.
  function entryRow(overrides: Record<string, unknown> = {}) {
    return {
      id: entryId,
      name: 'Chaveiro de porco',
      position: 0,
      units: 4,
      totalMinutes: 168,
      customer: 'Ana · pedido #112',
      modelUrl: 'makerworld.com/models/porquinho',
      printItemId,
      printItem: { id: printItemId, name: 'Chaveiro de porco' },
      printerId,
      printerName: 'Bambu A1',
      lastFailureAt: null,
      lastFailureReason: null,
      completedAt: null,
      createdItem: false,
      createdAt: new Date('2026-10-12T12:00:00.000Z'),
      updatedAt: new Date('2026-10-12T12:00:00.000Z'),
      filaments: [
        {
          id: 'use-1',
          position: 0,
          grams: 36,
          pricePerGram: 0.09,
          colorName: 'Azul',
          type: 'PLA',
          brandName: 'Voolt',
          colors: ['#3f7fd6'],
          filamentId,
          entryId,
          filament: { spoolLevel: 'FULL' },
        },
      ],
      ...overrides,
    };
  }

  function entryDto(overrides: Partial<QueueEntryDto> = {}): QueueEntryDto {
    return {
      name: 'Chaveiro de porco',
      printItemId,
      printerId,
      filaments: [{ filamentId, grams: 36 }],
      units: 4,
      totalMinutes: 168,
      customer: '  Ana · pedido #112  ',
      modelUrl: null,
      ...overrides,
    };
  }

  function recordDto(
    overrides: Partial<AddPrintRecordDto> = {},
  ): AddPrintRecordDto {
    return {
      printedAt: '2026-10-13T12:00:00.000Z',
      printerId,
      filaments: [{ filamentId, grams: 38 }],
      units: 4,
      totalMinutes: 170,
      outcome: 'SUCCESS',
      ...overrides,
    };
  }

  const savedItem = { id: printItemId, name: 'Chaveiro de porco' };

  beforeEach(async () => {
    prisma = {
      printQueueEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      printItem: { findFirst: jest.fn() },
      printer: { findFirst: jest.fn() },
      filament: { findMany: jest.fn() },
      $transaction: jest.fn((ops: unknown) => Promise.all(ops as unknown[])),
    };
    printService = { addRecord: jest.fn(), createItem: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrintQueueService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrintService, useValue: printService },
      ],
    }).compile();

    service = module.get<PrintQueueService>(PrintQueueService);
  });

  describe('createEntry', () => {
    beforeEach(() => {
      prisma.printItem.findFirst.mockResolvedValue(savedItem);
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        name: 'Bambu A1',
      });
      prisma.filament.findMany.mockResolvedValue([filament]);
      prisma.printQueueEntry.create.mockResolvedValue(entryRow());
    });

    it('adds at the end with the filament price of today', async () => {
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _max: { position: 2 },
      });

      const result = await service.createEntry(userId, entryDto());

      const data = dataOf(prisma.printQueueEntry.create);
      expect(data.position).toBe(3);
      expect(data.customer).toBe('Ana · pedido #112');
      expect(data.printerName).toBe('Bambu A1');
      expect(data).toMatchObject({
        filaments: {
          create: [
            { grams: 36, pricePerGram: 0.09, brandName: 'Voolt', filamentId },
          ],
        },
      });
      expect(result.data.printer).toEqual({ id: printerId, name: 'Bambu A1' });
      expect(result.data.lastFailure).toBeNull();
    });

    it('starts at zero when the queue is empty', async () => {
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _max: { position: null },
      });

      await service.createEntry(userId, entryDto());

      expect(dataOf(prisma.printQueueEntry.create).position).toBe(0);
    });

    it('pushes the pending entries when added first', async () => {
      await service.createEntry(userId, entryDto({ position: 'first' }));

      expect(argOf(prisma.printQueueEntry.updateMany)).toEqual({
        where: { userId, completedAt: null },
        data: { position: { increment: 1 } },
      });
      expect(dataOf(prisma.printQueueEntry.create).position).toBe(0);
      expect(prisma.printQueueEntry.aggregate).not.toHaveBeenCalled();
    });

    it("rejects someone else's printer", async () => {
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(service.createEntry(userId, entryDto())).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.printQueueEntry.create).not.toHaveBeenCalled();
    });

    it("rejects someone else's print item", async () => {
      prisma.printItem.findFirst.mockResolvedValue(null);

      await expect(service.createEntry(userId, entryDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a repeated filament', async () => {
      await expect(
        service.createEntry(
          userId,
          entryDto({
            filaments: [
              { filamentId, grams: 10 },
              { filamentId, grams: 20 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a blank name', async () => {
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _max: { position: 0 },
      });

      await expect(
        service.createEntry(userId, entryDto({ name: '   ' })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getQueue', () => {
    it('splits pending and done, with the result of the done ones', async () => {
      prisma.printQueueEntry.findMany
        .mockResolvedValueOnce([entryRow()])
        .mockResolvedValueOnce([
          entryRow({
            id: otherEntryId,
            completedAt: new Date('2026-10-13T15:00:00.000Z'),
            createdItem: true,
          }),
        ]);

      const result = await service.getQueue(userId);

      expect(result.pending).toHaveLength(1);
      expect(result.pending[0].result).toBeNull();
      expect(result.done[0].result).toEqual({
        item: { id: printItemId, name: 'Chaveiro de porco' },
        createdItem: true,
      });
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      prisma.printQueueEntry.findMany
        .mockResolvedValueOnce([{ id: entryId }, { id: otherEntryId }])
        .mockResolvedValueOnce([]);
    });

    it('saves the new positions', async () => {
      await service.reorder(userId, { ids: [otherEntryId, entryId] });

      expect(prisma.printQueueEntry.update).toHaveBeenCalledTimes(2);
      expect(argOf(prisma.printQueueEntry.update, 0)).toEqual({
        where: { id: otherEntryId },
        data: { position: 0 },
      });
      expect(argOf(prisma.printQueueEntry.update, 1)).toEqual({
        where: { id: entryId },
        data: { position: 1 },
      });
    });

    it('keeps the entries left out at the end', async () => {
      await service.reorder(userId, { ids: [otherEntryId] });

      expect(argOf(prisma.printQueueEntry.update, 1)).toEqual({
        where: { id: entryId },
        data: { position: 1 },
      });
    });

    it('rejects an id that is not pending', async () => {
      await expect(
        service.reorder(userId, {
          ids: ['9c8b7a6f-5e4d-4c3b-8a29-1f0e9d8c7b6a'],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('deleteEntry', () => {
    it("does not delete someone else's entry", async () => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(null);

      await expect(service.deleteEntry(entryId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.printQueueEntry.delete).not.toHaveBeenCalled();
    });
  });

  describe('finishEntry', () => {
    function finishDto(
      overrides: Partial<FinishQueueEntryDto> = {},
    ): FinishQueueEntryDto {
      return { printItemId, record: recordDto(), ...overrides };
    }

    beforeEach(() => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(entryRow());
      prisma.printQueueEntry.update.mockImplementation((args) =>
        Promise.resolve(
          entryRow((args as { data: Record<string, unknown> }).data),
        ),
      );
    });

    it('records in the existing item and leaves the queue', async () => {
      printService.addRecord.mockResolvedValue({
        data: savedItem,
        recordId: 'rec-9',
      });

      const result = await service.finishEntry(entryId, userId, finishDto());

      expect(printService.addRecord).toHaveBeenCalledWith(
        printItemId,
        userId,
        recordDto(),
      );
      const data = dataOf(prisma.printQueueEntry.update);
      expect(data.completedAt).toBeInstanceOf(Date);
      expect(data.createdItem).toBe(false);
      expect(data.printItemId).toBe(printItemId);
      expect(result.recordId).toBe('rec-9');
      expect(result.item).toBe(savedItem);
    });

    it('creates a new item with the model link from the queue', async () => {
      printService.createItem.mockResolvedValue({
        data: { id: 'item-new', name: 'Porta-escova', defaultRecordId: 'r1' },
      });

      const result = await service.finishEntry(
        entryId,
        userId,
        finishDto({
          printItemId: null,
          newItem: { name: 'Porta-escova', categoryId: null },
        }),
      );

      expect(argOf(printService.createItem, 0)).toBe(userId);
      expect(printService.createItem.mock.calls[0][1]).toMatchObject({
        name: 'Porta-escova',
        modelUrl: 'makerworld.com/models/porquinho',
        firstRecord: recordDto(),
      });
      const data = dataOf(prisma.printQueueEntry.update);
      expect(data.createdItem).toBe(true);
      expect(data.printItemId).toBe('item-new');
      expect(result.recordId).toBe('r1');
    });

    it('keeps a failure in the queue and records it in the item', async () => {
      printService.addRecord.mockResolvedValue({
        data: savedItem,
        recordId: 'rec-9',
      });
      const record = recordDto({
        outcome: 'FAILURE',
        failureReason: ' Descolou da mesa ',
        makeDefault: true,
      });

      const result = await service.finishEntry(
        entryId,
        userId,
        finishDto({ record }),
      );

      // Falha nunca vira o registro padrão.
      expect(printService.addRecord.mock.calls[0][2]).toMatchObject({
        makeDefault: false,
      });
      const data = dataOf(prisma.printQueueEntry.update);
      expect(data.completedAt).toBeUndefined();
      expect(data.lastFailureReason).toBe('Descolou da mesa');
      expect(data.lastFailureAt).toBe(record.printedAt);
      expect(result.data.lastFailure).toEqual({
        at: record.printedAt,
        reason: 'Descolou da mesa',
      });
    });

    it('marks a failed new piece only in the queue', async () => {
      await service.finishEntry(
        entryId,
        userId,
        finishDto({
          printItemId: null,
          newItem: { name: 'Porta-escova' },
          record: recordDto({ outcome: 'FAILURE', failureReason: 'Entupiu' }),
        }),
      );

      expect(printService.addRecord).not.toHaveBeenCalled();
      expect(printService.createItem).not.toHaveBeenCalled();
      expect(dataOf(prisma.printQueueEntry.update).lastFailureReason).toBe(
        'Entupiu',
      );
    });

    it('asks for the failure reason before saving anything', async () => {
      await expect(
        service.finishEntry(
          entryId,
          userId,
          finishDto({
            printItemId: null,
            record: recordDto({ outcome: 'FAILURE', failureReason: '  ' }),
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.printQueueEntry.update).not.toHaveBeenCalled();
    });

    it('needs a destination for a success', async () => {
      await expect(
        service.finishEntry(entryId, userId, finishDto({ printItemId: null })),
      ).rejects.toThrow(BadRequestException);
      expect(printService.addRecord).not.toHaveBeenCalled();
    });

    it('rejects two destinations at once', async () => {
      await expect(
        service.finishEntry(
          entryId,
          userId,
          finishDto({ newItem: { name: 'Outra' } }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not finish an entry that already left the queue', async () => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.finishEntry(entryId, userId, finishDto()),
      ).rejects.toThrow(NotFoundException);
      expect(argOf(prisma.printQueueEntry.findFirst).where).toMatchObject({
        completedAt: null,
      });
    });
  });
});
