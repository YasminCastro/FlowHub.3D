import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrintQueueService } from './print-queue.service.js';
import { PrintService } from '../print/print.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FinishQueueEntryDto,
  PublicQueueRequestDto,
  QUEUE_MAX_PENDING_SHARE_REQUESTS,
  QueueEntryDto,
} from './dto/print-queue.js';
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
      count: AsyncMock;
    };
    user: {
      findUnique: AsyncMock;
      findUniqueOrThrow: AsyncMock;
      update: AsyncMock;
    };
    printItem: { findFirst: AsyncMock };
    printer: { findFirst: AsyncMock; findMany: AsyncMock };
    costSettings: { findUnique: AsyncMock };
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
      note: null,
      printItemId,
      printItem: { id: printItemId, name: 'Chaveiro de porco' },
      printerId,
      printerName: 'Bambu A1',
      lastFailureAt: null,
      lastFailureReason: null,
      startedAt: null,
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
      note: '  Lixar a base  ',
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
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      printItem: { findFirst: jest.fn() },
      printer: { findFirst: jest.fn(), findMany: jest.fn() },
      costSettings: { findUnique: jest.fn() },
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
      expect(data.note).toBe('Lixar a base');
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

    it('accepts an entry without filament and time yet', async () => {
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _max: { position: 0 },
      });
      prisma.filament.findMany.mockResolvedValue([]);

      await service.createEntry(
        userId,
        entryDto({ filaments: [], totalMinutes: 0 }),
      );

      const data = dataOf(prisma.printQueueEntry.create);
      expect(data.totalMinutes).toBe(0);
      expect(data).toMatchObject({ filaments: { create: [] } });
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

  describe('createEntries', () => {
    // Sem printItemId: os testes de calibração são peças novas.
    function testEntry(name: string, totalMinutes: number, grams: number) {
      return entryDto({
        name,
        printItemId: null,
        customer: null,
        note: null,
        units: 1,
        totalMinutes,
        filaments: [{ filamentId, grams }],
      });
    }

    const batch = [
      testEntry('Calibração temperatura', 60, 15),
      testEntry('Calibração max flow', 36, 29),
      testEntry('Calibração pressure advance', 8, 2),
    ];

    beforeEach(() => {
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        name: 'Bambu A1',
      });
      prisma.filament.findMany.mockResolvedValue([filament]);
      // Devolve o item gravado com os campos do create; os filamentos, que
      // no create vêm como { create: [...] }, ficam os do item de exemplo.
      prisma.printQueueEntry.create.mockImplementation((args) =>
        Promise.resolve(
          entryRow({
            ...(args as { data: Record<string, unknown> }).data,
            filaments: entryRow().filaments,
          }),
        ),
      );
      prisma.printQueueEntry.updateMany.mockResolvedValue({ count: 2 });
    });

    it('adds them at the end, in the order received', async () => {
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _max: { position: 4 },
      });

      const result = await service.createEntries(userId, { entries: batch });

      const created = [0, 1, 2].map((call) =>
        dataOf(prisma.printQueueEntry.create, call),
      );
      expect(
        created.map((d) => [d.name as string, d.position as number]),
      ).toEqual([
        ['Calibração temperatura', 5],
        ['Calibração max flow', 6],
        ['Calibração pressure advance', 7],
      ]);
      expect(created[1]).toMatchObject({
        totalMinutes: 36,
        units: 1,
        printerId,
        userId,
      });
      const filaments = created[1].filaments as { create: unknown[] };
      expect(filaments.create[0]).toMatchObject({
        filamentId,
        grams: 29,
      });
      expect(prisma.printQueueEntry.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(3);
      expect(result.message).toBe('3 itens adicionados à fila');
    });

    it('puts them next in the queue, keeping their order', async () => {
      const result = await service.createEntries(userId, {
        entries: batch,
        position: 'first',
      });

      // Abre espaço para os três de uma vez.
      expect(argOf(prisma.printQueueEntry.updateMany)).toEqual({
        where: { userId, completedAt: null },
        data: { position: { increment: 3 } },
      });
      expect(
        [0, 1, 2].map(
          (call) =>
            dataOf(prisma.printQueueEntry.create, call).position as number,
        ),
      ).toEqual([0, 1, 2]);
      expect(prisma.printQueueEntry.aggregate).not.toHaveBeenCalled();
      // O resultado do updateMany não entra na resposta.
      expect(result.data.map((e) => e.name)).toEqual([
        'Calibração temperatura',
        'Calibração max flow',
        'Calibração pressure advance',
      ]);
    });

    it('saves nothing when one entry is invalid', async () => {
      prisma.filament.findMany
        .mockResolvedValueOnce([filament])
        .mockResolvedValueOnce([]);

      await expect(
        service.createEntries(userId, { entries: batch.slice(0, 2) }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printQueueEntry.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('updateEntry', () => {
    beforeEach(() => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(entryRow());
      prisma.printItem.findFirst.mockResolvedValue(savedItem);
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        name: 'Bambu A1',
      });
      prisma.filament.findMany.mockResolvedValue([filament]);
      prisma.printQueueEntry.update.mockResolvedValue(entryRow());
    });

    it('replaces the fields and the filaments, keeping the position', async () => {
      const result = await service.updateEntry(
        entryId,
        userId,
        entryDto({
          units: 6,
          printItemId: null,
          name: '  Porquinho  ',
          note: '   ',
        }),
      );

      expect(argOf(prisma.printQueueEntry.findFirst).where).toEqual({
        id: entryId,
        userId,
        completedAt: null,
      });
      const data = dataOf(prisma.printQueueEntry.update);
      expect(data).toMatchObject({
        name: 'Porquinho',
        units: 6,
        printItemId: null,
        customer: 'Ana · pedido #112',
        note: null,
        filaments: {
          deleteMany: {},
          create: [{ grams: 36, pricePerGram: 0.09, filamentId }],
        },
      });
      expect(data).not.toHaveProperty('position');
      expect(result.message).toBe('Item da fila atualizado');
    });

    it('does not edit an entry that already left the queue', async () => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEntry(entryId, userId, entryDto()),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printQueueEntry.update).not.toHaveBeenCalled();
    });

    it("rejects someone else's printer", async () => {
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEntry(entryId, userId, entryDto()),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printQueueEntry.update).not.toHaveBeenCalled();
    });
  });

  describe('updateEntry while printing', () => {
    const otherPrinterId = '6a1d8d2f-9b63-4b9f-8b8e-1e2d3c4b5a6f';

    beforeEach(() => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(
        entryRow({ startedAt: new Date('2026-10-26T12:00:00Z') }),
      );
      prisma.printItem.findFirst.mockResolvedValue(savedItem);
      prisma.filament.findMany.mockResolvedValue([filament]);
      prisma.printQueueEntry.update.mockResolvedValue(entryRow());
    });

    it('stops printing when the printer changes', async () => {
      prisma.printer.findFirst.mockResolvedValue({
        id: otherPrinterId,
        name: 'Ender 3',
      });

      await service.updateEntry(
        entryId,
        userId,
        entryDto({ printerId: otherPrinterId }),
      );

      expect(dataOf(prisma.printQueueEntry.update).startedAt).toBeNull();
    });

    it('keeps printing when the printer stays the same', async () => {
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        name: 'Bambu A1',
      });

      await service.updateEntry(entryId, userId, entryDto());

      expect(dataOf(prisma.printQueueEntry.update)).not.toHaveProperty(
        'startedAt',
      );
    });
  });

  describe('startEntry', () => {
    beforeEach(() => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(entryRow());
      prisma.printQueueEntry.updateMany.mockResolvedValue({ count: 1 });
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _min: { position: 0 },
      });
      prisma.printQueueEntry.update.mockImplementation((args) =>
        Promise.resolve(
          entryRow((args as { data: Record<string, unknown> }).data),
        ),
      );
    });

    it('marks the entry, moves it to the top and frees the printer from the previous one', async () => {
      const result = await service.startEntry(entryId, userId);

      // Só os pendentes desta impressora, menos o próprio item.
      expect(argOf(prisma.printQueueEntry.updateMany)).toEqual({
        where: {
          userId,
          printerId,
          completedAt: null,
          startedAt: { not: null },
          id: { not: entryId },
        },
        data: { startedAt: null },
      });
      expect(dataOf(prisma.printQueueEntry.update).startedAt).toBeInstanceOf(
        Date,
      );
      // Antes do primeiro pendente.
      expect(dataOf(prisma.printQueueEntry.update).position).toBe(-1);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.data.startedAt).toBeInstanceOf(Date);
    });

    it('needs a printer', async () => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(
        entryRow({ printerId: null, printerName: '' }),
      );

      await expect(service.startEntry(entryId, userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.printQueueEntry.update).not.toHaveBeenCalled();
    });

    it('only starts pending entries of the user', async () => {
      prisma.printQueueEntry.findFirst.mockResolvedValue(null);

      await expect(service.startEntry(entryId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(argOf(prisma.printQueueEntry.findFirst).where).toEqual({
        id: entryId,
        userId,
        completedAt: null,
      });
    });

    it('stops printing without finishing', async () => {
      await service.stopEntry(entryId, userId);

      expect(dataOf(prisma.printQueueEntry.update)).toEqual({
        startedAt: null,
      });
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
      // Saiu da impressora.
      expect(data.startedAt).toBeNull();
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
      // Volta para a fila esperando a vez, fora da impressora.
      expect(data.startedAt).toBeNull();
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

  describe('share link', () => {
    const token = 'k3J9xQ2mT7vB1nR8wZ4yLa';

    function requestDto(
      overrides: Partial<PublicQueueRequestDto> = {},
    ): PublicQueueRequestDto {
      return {
        name: '  Vaso espiral  ',
        requesterName: '  Bia  ',
        contact: '  ',
        colors: '  Azul e branco  ',
        units: 2,
        modelUrl: '  makerworld.com/models/vaso  ',
        note: '  Em branco, se der  ',
        ...overrides,
      };
    }

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, name: 'Yasmin' });
      prisma.printQueueEntry.count.mockResolvedValue(0);
      prisma.printQueueEntry.aggregate.mockResolvedValue({
        _max: { position: 4 },
      });
      prisma.printQueueEntry.create.mockResolvedValue({ id: entryId });
    });

    it('creates a new random token each time', async () => {
      const first = await service.regenerateShareLink(userId);
      const second = await service.regenerateShareLink(userId);

      expect(first.token).toMatch(/^[\w-]{22}$/);
      expect(second.token).not.toBe(first.token);
      expect(argOf(prisma.user.update, 1)).toMatchObject({
        where: { id: userId },
        data: { queueShareToken: second.token },
      });
    });

    it('disables the link', async () => {
      await service.disableShareLink(userId);
      expect(dataOf(prisma.user.update)).toEqual({ queueShareToken: null });
    });

    it('shows the queue without private fields', async () => {
      const quoted = {
        id: entryId,
        name: 'Chaveiro de porco',
        units: 4,
        totalMinutes: 120,
        printerName: 'Bambu A1',
        fromShareLink: false,
      };
      const request = {
        id: 'b5c4d3e2-1f0a-4b9c-8d7e-6f5a4b3c2d1e',
        name: 'Vaso espiral',
        units: 2,
        totalMinutes: 0,
        printerName: '',
        fromShareLink: true,
      };
      prisma.printQueueEntry.findMany
        .mockResolvedValueOnce([
          {
            ...quoted,
            printerId,
            lastFailureAt: new Date('2026-10-20T12:00:00Z'),
            filaments: [
              { grams: 36, pricePerGram: 0.09 },
              { grams: 10.04, pricePerGram: 0.1 },
            ],
          },
          { ...request, printerId: null, lastFailureAt: null, filaments: [] },
        ])
        .mockResolvedValueOnce([
          {
            id: otherEntryId,
            name: 'Vaso espiral',
            units: 2,
            totalMinutes: 120,
            printerName: 'Bambu A1',
            fromShareLink: true,
            printerId,
            lastFailureAt: null,
            filaments: [{ grams: 21, pricePerGram: 0.1 }],
            completedAt: new Date('2026-10-25T12:00:00Z'),
          },
        ]);
      prisma.costSettings.findUnique.mockResolvedValue({
        energyCostPerKwh: 1,
        otherFixedCost: 0.5,
        failureReservePercent: 10,
        laborCostPerHour: 30,
        prepMinutesPerPiece: 10,
        defaultMarginPercent: 50,
      });
      prisma.printer.findMany.mockResolvedValue([
        {
          id: printerId,
          powerConsumptionW: 120,
          energyCostPerKwh: null,
          maintenanceCostPerHour: 0.5,
        },
      ]);

      const result = await service.getSharedQueue(token);

      expect(result).toEqual({
        ownerName: 'Yasmin',
        pending: [
          // Filamento 4,25 + energia 0,24 + manutenção 1,00 + outros 2,00
          // + reserva 0,55 (cada parte sobe para o centavo).
          // Preço: (8,04 + 5,00 de preparo) × 1,5.
          {
            ...quoted,
            retrying: true,
            grams: 46,
            filamentCost: 4.25,
            cost: 8.04,
            price: 19.56,
          },
          // Pedido do link ainda sem filamento nem tempo: sem orçamento.
          {
            ...request,
            retrying: false,
            grams: 0,
            filamentCost: null,
            cost: null,
            price: null,
          },
        ],
        done: [
          // A mesma estimativa da fila: filamento 2,10 + energia 0,24
          // + manutenção 1,00 + outros 1,00 + reserva 0,34 = 4,68;
          // preço (4,68 + 5,00) × 1,5.
          {
            id: otherEntryId,
            name: 'Vaso espiral',
            units: 2,
            totalMinutes: 120,
            printerName: 'Bambu A1',
            fromShareLink: true,
            retrying: false,
            grams: 21,
            filamentCost: 2.1,
            cost: 4.68,
            price: 14.52,
            completedAt: new Date('2026-10-25T12:00:00Z'),
          },
        ],
      });
      // Concluídos: só os 5 mais recentes, de qualquer data.
      expect(argOf(prisma.printQueueEntry.findMany, 1)).toMatchObject({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });
      // Só impressoras da dona da fila entram na conta.
      expect(argOf(prisma.printer.findMany).where).toEqual({
        id: { in: [printerId] },
        userId,
      });
      // O select é o que garante que cliente, contato, observação e link do
      // modelo não saem do banco para o link.
      for (const call of [0, 1]) {
        const { select, where } = argOf(prisma.printQueueEntry.findMany, call);
        expect(where).toMatchObject({ userId });
        for (const field of [
          'customer',
          'requesterContact',
          'requestedColors',
          'note',
          'modelUrl',
          'lastFailureReason',
          'userId',
        ]) {
          expect(select).not.toHaveProperty(field);
        }
      }
      // Dos filamentos, só o que entra na conta (sem cor, marca, tipo).
      expect(argOf(prisma.printQueueEntry.findMany).select).toMatchObject({
        filaments: { select: { grams: true, pricePerGram: true } },
      });
    });

    it('uses the default cost settings when none were saved', async () => {
      prisma.printQueueEntry.findMany
        .mockResolvedValueOnce([
          {
            id: entryId,
            name: 'Chaveiro de porco',
            units: 1,
            totalMinutes: 60,
            printerName: '',
            fromShareLink: false,
            printerId: null,
            lastFailureAt: null,
            filaments: [{ grams: 10, pricePerGram: 0.1 }],
          },
        ])
        .mockResolvedValueOnce([]);
      prisma.costSettings.findUnique.mockResolvedValue(null);

      const result = await service.getSharedQueue(token);

      // Filamento 1,00 + reserva padrão de 7% (0,07); sem impressora, sem
      // energia nem manutenção.
      expect(result.pending[0].cost).toBe(1.07);
      // Preparo padrão: 15 min a R$ 35/h (8,75), margem de 60%.
      expect(result.pending[0].price).toBe(15.71);
      expect(prisma.printer.findMany).not.toHaveBeenCalled();
    });

    it('rejects an unknown or disabled token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createShareRequest(token, requestDto()),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printQueueEntry.create).not.toHaveBeenCalled();
    });

    it('adds the request to the end of the owner queue', async () => {
      const result = await service.createShareRequest(token, requestDto());

      expect(argOf(prisma.user.findUnique).where).toEqual({
        queueShareToken: token,
      });
      expect(dataOf(prisma.printQueueEntry.create)).toEqual({
        name: 'Vaso espiral',
        customer: 'Bia',
        requesterContact: null,
        requestedColors: 'Azul e branco',
        units: 2,
        totalMinutes: 0,
        modelUrl: 'makerworld.com/models/vaso',
        note: 'Em branco, se der',
        printerId: null,
        printerName: '',
        fromShareLink: true,
        position: 5,
        userId,
      });
      // Só o id, para quem pediu achar o pedido na fila.
      expect(result).toEqual({ message: 'Pedido enviado', id: entryId });
    });

    it.each(['requesterName', 'colors', 'modelUrl'] as const)(
      'requires %s after trimming',
      async (field) => {
        await expect(
          service.createShareRequest(token, requestDto({ [field]: '  ' })),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.printQueueEntry.create).not.toHaveBeenCalled();
      },
    );

    it('stops accepting when too many requests are pending', async () => {
      prisma.printQueueEntry.count.mockResolvedValue(
        QUEUE_MAX_PENDING_SHARE_REQUESTS,
      );

      await expect(
        service.createShareRequest(token, requestDto()),
      ).rejects.toThrow(BadRequestException);
      expect(argOf(prisma.printQueueEntry.count).where).toEqual({
        userId,
        completedAt: null,
        fromShareLink: true,
      });
      expect(prisma.printQueueEntry.create).not.toHaveBeenCalled();
    });
  });
});
