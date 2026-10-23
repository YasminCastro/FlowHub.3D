import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrintService, filamentPricePerGram } from './print.service.js';
import { PrintPhotoStorage } from './print-photo-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrintItemDto, PrintRecordDto } from './dto/print.js';
import { Prisma } from '../generated/prisma/client.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

// O "data" passado na chamada n do mock do Prisma.
function dataOf(mock: AsyncMock, call = 0) {
  return (mock.mock.calls[call][0] as { data: Record<string, any> }).data;
}

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

describe('PrintService', () => {
  let service: PrintService;
  let prisma: {
    printItem: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      delete: AsyncMock;
      count: AsyncMock;
    };
    printRecord: {
      updateMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
      count: AsyncMock;
      aggregate: AsyncMock;
      findMany: AsyncMock;
    };
    printPhoto: { createMany: AsyncMock; delete: AsyncMock };
    printer: { findFirst: AsyncMock };
    filament: { findMany: AsyncMock };
    extraItem: { findMany: AsyncMock };
    category: { findFirst: AsyncMock; findMany: AsyncMock };
    $transaction: AsyncMock;
    $queryRaw: AsyncMock;
  };
  let storage: { save: AsyncMock; remove: AsyncMock };

  const userId = 'user-1';
  const itemId = 'item-1';
  const printerId = '5f0c7c1e-8a52-4a8e-9a7d-0d1c2b3a4f5e';
  const filamentId = '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a';
  const categoryId = '7d1e2f3a-4b5c-4d6e-8f70-819a2b3c4d5e';
  const extraItemId = '3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a9f';

  const filament = {
    id: filamentId,
    colorName: 'Rosa',
    type: 'PLA',
    colors: ['#e89ab0'],
    minPricePaid: 80,
    maxPricePaid: 100,
    spoolWeightGrams: 1000,
    brand: { name: 'Voolt' },
  };

  function recordRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rec-1',
      printedAt: new Date('2026-09-12T12:00:00.000Z'),
      units: 3,
      totalMinutes: 126,
      printerId,
      printerName: 'Bambu A1',
      slicer: 'Orca',
      layerHeightMm: 0.2,
      infillPercent: 15,
      infillPattern: 'giroide',
      walls: 2,
      temperatureC: 215,
      extras: '',
      outcome: 'SUCCESS',
      failureReason: null,
      note: null,
      changeSummary: 'Primeira impressão',
      isDefault: true,
      itemId,
      createdAt: new Date('2026-09-12T12:00:00.000Z'),
      updatedAt: new Date('2026-09-12T12:00:00.000Z'),
      filaments: [
        {
          id: 'use-1',
          position: 0,
          grams: 27,
          pricePerGram: 0.09,
          colorName: 'Rosa',
          type: 'PLA',
          brandName: 'Voolt',
          colors: ['#e89ab0'],
          filamentId,
          recordId: 'rec-1',
          filament: { spoolLevel: 'FULL' },
        },
      ],
      extraItems: [
        {
          id: 'extra-use-1',
          position: 0,
          quantity: 1,
          unitCost: 0.25,
          name: 'Argola',
          extraItemId,
          recordId: 'rec-1',
        },
      ],
      photos: [],
      ...overrides,
    };
  }

  // Como o Prisma devolve, com as relações do include.
  function itemRow(records = [recordRow()]) {
    return {
      id: itemId,
      name: 'Chaveiro de porco',
      modelUrl: null,
      categoryId,
      derivedFromId: null,
      createdAt: new Date('2026-09-12T12:00:00.000Z'),
      updatedAt: new Date('2026-09-12T12:00:00.000Z'),
      category: { id: categoryId, name: 'Chaveiros', color: '#e08a2e' },
      derivedFrom: null,
      derivatives: [],
      records,
    };
  }

  const record: PrintRecordDto = {
    printedAt: '2026-10-13T12:00:00.000Z',
    printerId,
    filaments: [{ filamentId, grams: 27 }],
    units: 3,
    totalMinutes: 126,
    settings: {
      slicer: ' Orca ',
      layerHeightMm: 0.2,
      infillPercent: 15,
      infillPattern: 'giroide',
      walls: 2,
      temperatureC: 215,
      extras: '  ',
    },
    outcome: 'SUCCESS',
    note: '  Pedido da Ana ',
    changeSummary: 'mesma config.',
  };

  const input: PrintItemDto = {
    name: '  Chaveiro de porco ',
    categoryId,
    modelUrl: ' ',
    firstRecord: record,
  };

  // Impressora, filamento e categoria do usuário.
  function ownsEverything() {
    prisma.printer.findFirst.mockResolvedValue({
      id: printerId,
      name: 'Bambu A1',
    });
    prisma.filament.findMany.mockResolvedValue([filament]);
    prisma.category.findFirst.mockResolvedValue({ id: categoryId });
  }

  beforeEach(async () => {
    prisma = {
      printItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      printRecord: {
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      printPhoto: { createMany: jest.fn(), delete: jest.fn() },
      printer: { findFirst: jest.fn() },
      filament: { findMany: jest.fn() },
      extraItem: { findMany: jest.fn() },
      category: { findFirst: jest.fn(), findMany: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((operations: unknown) =>
        Promise.all(operations as Promise<unknown>[]),
      ),
    };
    storage = { save: jest.fn(), remove: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrintService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrintPhotoStorage, useValue: storage },
      ],
    }).compile();

    service = module.get<PrintService>(PrintService);
  });

  describe('filamentPricePerGram', () => {
    it('usa a média entre o menor e o maior preço pago, pelo peso do rolo', () => {
      expect(filamentPricePerGram(filament)).toBeCloseTo(0.09);
    });

    it('usa o único preço quando só houve uma compra', () => {
      expect(
        filamentPricePerGram({ ...filament, maxPricePaid: null }),
      ).toBeCloseTo(0.08);
    });
  });

  describe('createItem', () => {
    it('lança BadRequestException se a primeira impressão falhou', async () => {
      await expect(
        service.createItem(userId, {
          ...input,
          firstRecord: {
            ...record,
            outcome: 'FAILURE',
            failureReason: 'Entupiu',
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.printItem.create).not.toHaveBeenCalled();
    });

    it('lança NotFoundException se a impressora não é do usuário', async () => {
      ownsEverything();
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(service.createItem(userId, input)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.printer.findFirst).toHaveBeenCalledWith({
        where: { id: printerId, userId },
        select: { id: true, name: true },
      });
      expect(prisma.printItem.create).not.toHaveBeenCalled();
    });

    it('lança NotFoundException se algum filamento não é do usuário', async () => {
      ownsEverything();
      prisma.filament.findMany.mockResolvedValue([]);

      await expect(service.createItem(userId, input)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança BadRequestException com filamento repetido', async () => {
      ownsEverything();

      await expect(
        service.createItem(userId, {
          ...input,
          firstRecord: {
            ...record,
            filaments: [
              { filamentId, grams: 10 },
              { filamentId, grams: 5 },
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException se o sucesso não tem gramas', async () => {
      ownsEverything();

      await expect(
        service.createItem(userId, {
          ...input,
          firstRecord: { ...record, filaments: [{ filamentId, grams: 0 }] },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cria a peça com o primeiro registro como padrão e guarda o preço do dia', async () => {
      ownsEverything();
      prisma.printItem.create.mockResolvedValue(itemRow());

      const result = await service.createItem(userId, input);

      const data = dataOf(prisma.printItem.create);
      expect(data).toMatchObject({
        name: 'Chaveiro de porco',
        modelUrl: null,
        categoryId,
        derivedFromId: null,
        userId,
      });
      const firstRecord = (
        data.records as {
          create: { filaments: { create: { pricePerGram: number }[] } };
        }
      ).create;
      expect(firstRecord).toMatchObject({
        isDefault: true,
        printerId,
        printerName: 'Bambu A1',
        slicer: 'Orca',
        extras: '',
        note: 'Pedido da Ana',
        failureReason: null,
        filaments: {
          create: [
            {
              position: 0,
              grams: 27,
              colorName: 'Rosa',
              brandName: 'Voolt',
              filamentId,
            },
          ],
        },
      });
      expect(firstRecord.filaments.create[0].pricePerGram).toBeCloseTo(0.09);
      expect(result.data.defaultRecordId).toBe('rec-1');
      expect(result.data.records[0]).toMatchObject({
        printer: { id: printerId, name: 'Bambu A1' },
        settings: { slicer: 'Orca', walls: 2 },
        filaments: [
          {
            grams: 27,
            filament: {
              id: filamentId,
              pricePerGram: 0.09,
              spoolLevel: 'FULL',
            },
          },
        ],
      });
    });

    it('lança ConflictException se já existe uma peça com o mesmo nome', async () => {
      ownsEverything();
      prisma.printItem.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.createItem(userId, input)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('addRecord', () => {
    beforeEach(() => {
      prisma.printItem.findFirst.mockResolvedValue(itemRow());
      ownsEverything();
    });

    it('lança BadRequestException ao marcar uma falha como padrão', async () => {
      await expect(
        service.addRecord(itemId, userId, {
          ...record,
          outcome: 'FAILURE',
          failureReason: 'Entupiu',
          makeDefault: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.printRecord.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException em falha sem motivo', async () => {
      await expect(
        service.addRecord(itemId, userId, {
          ...record,
          outcome: 'FAILURE',
          failureReason: '  ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sem configuração do fatiador, grava as colunas vazias e devolve settings null', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({
            slicer: null,
            layerHeightMm: null,
            infillPercent: null,
            infillPattern: null,
            walls: null,
            temperatureC: null,
          }),
        ]),
      );

      const result = await service.addRecord(itemId, userId, {
        ...record,
        settings: null,
      });

      expect(dataOf(prisma.printRecord.create)).toMatchObject({
        slicer: null,
        layerHeightMm: null,
        infillPercent: null,
        infillPattern: null,
        walls: null,
        temperatureC: null,
        extras: '',
      });
      expect(result.data.records[0].settings).toBeNull();
    });

    it('aceita falha que parou antes de gastar filamento', async () => {
      await service.addRecord(itemId, userId, {
        ...record,
        outcome: 'FAILURE',
        failureReason: ' Descolou da mesa ',
        filaments: [{ filamentId, grams: 0 }],
        totalMinutes: 0,
      });

      expect(dataOf(prisma.printRecord.create)).toMatchObject({
        outcome: 'FAILURE',
        failureReason: 'Descolou da mesa',
        isDefault: false,
        itemId,
      });
    });

    it('sem marcar como padrão, não mexe no padrão atual', async () => {
      const result = await service.addRecord(itemId, userId, record);

      expect(prisma.printRecord.updateMany).not.toHaveBeenCalled();
      expect(dataOf(prisma.printRecord.create).id).toBe(result.recordId);
    });

    it('marcando como padrão, desmarca o atual na mesma transação', async () => {
      await service.addRecord(itemId, userId, { ...record, makeDefault: true });

      expect(prisma.printRecord.updateMany).toHaveBeenCalledWith({
        where: { itemId, isDefault: true },
        data: { isDefault: false },
      });
      expect(dataOf(prisma.printRecord.create).isDefault).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateRecord', () => {
    const otherFilamentId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

    beforeEach(() => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({ id: 'rec-2', isDefault: false, changeSummary: 'Infill' }),
          recordRow(),
        ]),
      );
      ownsEverything();
    });

    it('lança BadRequestException ao virar falha no registro padrão', async () => {
      await expect(
        service.updateRecord(itemId, 'rec-1', userId, {
          ...record,
          outcome: 'FAILURE',
          failureReason: 'Entupiu',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.printRecord.update).not.toHaveBeenCalled();
    });

    it('mantém o preço do dia do filamento que já estava no registro', async () => {
      await service.updateRecord(itemId, 'rec-2', userId, {
        ...record,
        changeSummary: undefined,
        filaments: [{ filamentId, grams: 40 }],
      });

      expect(prisma.filament.findMany).not.toHaveBeenCalled();
      const data = dataOf(prisma.printRecord.update);
      expect(data.filaments).toEqual({
        deleteMany: {},
        create: [
          expect.objectContaining({
            filamentId,
            grams: 40,
            pricePerGram: 0.09,
            colorName: 'Rosa',
          }),
        ],
      });
      // Sem texto novo, o "O que mudou" continua o mesmo.
      expect(data.changeSummary).toBe('Infill');
      expect(prisma.printRecord.updateMany).not.toHaveBeenCalled();
    });

    it('filamento novo entra com o preço de hoje', async () => {
      prisma.filament.findMany.mockResolvedValue([
        {
          ...filament,
          id: otherFilamentId,
          colorName: 'Azul',
          minPricePaid: 120,
          maxPricePaid: null,
        },
      ]);

      await service.updateRecord(itemId, 'rec-2', userId, {
        ...record,
        filaments: [{ filamentId: otherFilamentId, grams: 30 }],
      });

      const created = (
        dataOf(prisma.printRecord.update).filaments as {
          create: { pricePerGram: number; colorName: string }[];
        }
      ).create[0];
      expect(created.colorName).toBe('Azul');
      expect(created.pricePerGram).toBeCloseTo(0.12);
    });

    it('mantém pelo usageId um filamento que foi excluído', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({
            id: 'rec-2',
            isDefault: false,
            filaments: [
              { ...recordRow().filaments[0], id: 'use-9', filamentId: null },
            ],
          }),
          recordRow(),
        ]),
      );

      await service.updateRecord(itemId, 'rec-2', userId, {
        ...record,
        filaments: [{ usageId: 'use-9', grams: 12 }],
      });

      expect(dataOf(prisma.printRecord.update).filaments).toEqual({
        deleteMany: {},
        create: [
          expect.objectContaining({
            filamentId: null,
            grams: 12,
            pricePerGram: 0.09,
          }),
        ],
      });
    });

    it('marcando como padrão, desmarca o atual na mesma transação', async () => {
      await service.updateRecord(itemId, 'rec-2', userId, {
        ...record,
        makeDefault: true,
      });

      expect(prisma.printRecord.updateMany).toHaveBeenCalledWith({
        where: { itemId, isDefault: true },
        data: { isDefault: false },
      });
      expect(dataOf(prisma.printRecord.update).isDefault).toBe(true);
    });
  });

  describe('itens extras', () => {
    beforeEach(() => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({ id: 'rec-2', isDefault: false }),
          recordRow({ extraItems: [] }),
        ]),
      );
      ownsEverything();
    });

    it('item novo entra com o custo unitário do lote mais recente', async () => {
      prisma.extraItem.findMany.mockResolvedValue([
        { id: extraItemId, name: 'Ímã', lots: [{ price: 30, quantity: 100 }] },
      ]);

      await service.addRecord(itemId, userId, {
        ...record,
        extraItems: [{ extraItemId, quantity: 2 }],
      });

      expect(dataOf(prisma.printRecord.create).extraItems).toEqual({
        create: [
          {
            position: 0,
            quantity: 2,
            unitCost: 0.3,
            name: 'Ímã',
            extraItemId,
          },
        ],
      });
    });

    it('lança NotFoundException se o item extra não é do usuário', async () => {
      prisma.extraItem.findMany.mockResolvedValue([]);

      await expect(
        service.addRecord(itemId, userId, {
          ...record,
          extraItems: [{ extraItemId, quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printRecord.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException com item extra repetido', async () => {
      await expect(
        service.addRecord(itemId, userId, {
          ...record,
          extraItems: [
            { extraItemId, quantity: 1 },
            { extraItemId, quantity: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('na edição, mantém o custo do dia do item que já estava', async () => {
      await service.updateRecord(itemId, 'rec-2', userId, {
        ...record,
        extraItems: [{ extraItemId, quantity: 3 }],
      });

      expect(prisma.extraItem.findMany).not.toHaveBeenCalled();
      expect(dataOf(prisma.printRecord.update).extraItems).toEqual({
        deleteMany: {},
        create: [expect.objectContaining({ quantity: 3, unitCost: 0.25 })],
      });
    });

    it('na edição sem a lista, os itens extras ficam como estavam', async () => {
      await service.updateRecord(itemId, 'rec-2', userId, record);

      expect(dataOf(prisma.printRecord.update)).not.toHaveProperty(
        'extraItems',
      );
    });

    it('devolve os itens extras do registro', async () => {
      const result = await service.getItemById(itemId, userId);

      expect(result.records[0].extraItems).toEqual([
        {
          id: 'extra-use-1',
          quantity: 1,
          extraItem: { id: extraItemId, name: 'Argola', unitCost: 0.25 },
        },
      ]);
    });
  });

  describe('setDefaultRecord', () => {
    it('lança NotFoundException se a peça não é do usuário', async () => {
      prisma.printItem.findFirst.mockResolvedValue(null);

      await expect(
        service.setDefaultRecord(itemId, 'rec-1', userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException para um registro que falhou', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({ id: 'rec-2', outcome: 'FAILURE', isDefault: false }),
          recordRow(),
        ]),
      );

      await expect(
        service.setDefaultRecord(itemId, 'rec-2', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('troca o padrão', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([recordRow({ id: 'rec-2', isDefault: false }), recordRow()]),
      );

      await service.setDefaultRecord(itemId, 'rec-2', userId);

      expect(prisma.printRecord.updateMany).toHaveBeenCalledWith({
        where: { itemId, isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.printRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-2' },
        data: { isDefault: true },
      });
    });
  });

  describe('deleteRecord', () => {
    it('lança BadRequestException ao excluir o único registro', async () => {
      prisma.printItem.findFirst.mockResolvedValue(itemRow());

      await expect(
        service.deleteRecord(itemId, 'rec-1', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException se o padrão é o único sucesso', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({ id: 'rec-2', outcome: 'FAILURE', isDefault: false }),
          recordRow(),
        ]),
      );

      await expect(
        service.deleteRecord(itemId, 'rec-1', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('ao excluir o padrão, o sucesso mais recente assume e as fotos saem', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({ id: 'rec-3', outcome: 'FAILURE', isDefault: false }),
          recordRow({ id: 'rec-2', isDefault: false }),
          recordRow({ photos: [{ id: 'photo-1', filename: 'a.png' }] }),
        ]),
      );

      await service.deleteRecord(itemId, 'rec-1', userId);

      expect(prisma.printRecord.delete).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
      });
      expect(prisma.printRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-2' },
        data: { isDefault: true },
      });
      expect(storage.remove).toHaveBeenCalledWith('a.png');
    });
  });

  describe('getItemsPage', () => {
    const query = { page: 1, pageSize: 2, sort: 'recent' as const };
    // Texto e valores do SQL passado na chamada n do $queryRaw.
    function sqlOf(call: number) {
      const [strings, ...values] = prisma.$queryRaw.mock.calls[call] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      return Prisma.sql(strings, ...values);
    }

    it('devolve as peças na ordem do SQL, com o total', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: 3 }])
        .mockResolvedValueOnce([{ id: 'item-b' }, { id: 'item-a' }]);
      prisma.printItem.findMany.mockResolvedValue([
        { ...itemRow(), id: 'item-a' },
        { ...itemRow(), id: 'item-b' },
      ]);

      const result = await service.getItemsPage(userId, query);

      expect(result.items.map((item) => item.id)).toEqual(['item-b', 'item-a']);
      expect(result).toMatchObject({
        total: 3,
        page: 1,
        pageSize: 2,
        totalPages: 2,
      });
      expect(sqlOf(1).values).toEqual([userId, 2, 0]);
      expect(sqlOf(1).sql).toContain('"lastPrintedAt" DESC');
    });

    it('página além do fim vira a última', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: 3 }])
        .mockResolvedValueOnce([]);
      prisma.printItem.findMany.mockResolvedValue([]);

      const result = await service.getItemsPage(userId, { ...query, page: 9 });

      expect(result.page).toBe(2);
      // LIMIT 2 OFFSET 2.
      expect(sqlOf(1).values.slice(-2)).toEqual([2, 2]);
    });

    it('aplica busca (escapando curingas), categoria e falha recente', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);
      prisma.printItem.findMany.mockResolvedValue([]);

      await service.getItemsPage(userId, {
        ...query,
        search: ' 50%_off ',
        categoryId,
        recentFailure: true,
        sort: 'name-desc',
      });

      const count = sqlOf(0);
      expect(count.values.slice(0, 3)).toEqual([
        userId,
        '%50\\%\\_off%',
        categoryId,
      ]);
      expect(count.values[3]).toBeInstanceOf(Date);
      expect(count.sql).toContain("f.outcome = 'FAILURE'");
      expect(sqlOf(1).sql).toContain('lower(i.name) DESC');
    });
  });

  describe('getSummary', () => {
    it('conta o mês a partir do início informado e devolve as falhas', async () => {
      prisma.printItem.count.mockResolvedValue(5);
      prisma.printRecord.count.mockResolvedValue(4);
      prisma.printRecord.aggregate.mockResolvedValue({ _sum: { units: null } });
      prisma.printRecord.findMany.mockResolvedValue([
        recordRow({ id: 'rec-f', outcome: 'FAILURE', isDefault: false }),
      ]);
      prisma.category.findMany.mockResolvedValue([
        { id: categoryId, name: 'Chaveiros', color: '#e08a2e' },
      ]);

      const result = await service.getSummary(userId, {
        monthStart: '2026-10-01T03:00:00.000Z',
      });

      expect(result).toMatchObject({
        itemCount: 5,
        monthRecords: 4,
        monthUnits: 0,
        categories: [{ id: categoryId }],
      });
      expect(result.failures.map((r) => r.id)).toEqual(['rec-f']);
      expect(prisma.printRecord.count).toHaveBeenCalledWith({
        where: {
          item: { userId },
          printedAt: { gte: new Date('2026-10-01T03:00:00.000Z') },
        },
      });
    });
  });

  describe('deleteItem', () => {
    it('exclui a peça e os arquivos de todas as fotos', async () => {
      prisma.printItem.findFirst.mockResolvedValue(
        itemRow([
          recordRow({ photos: [{ id: 'p1', filename: 'a.png' }] }),
          recordRow({
            id: 'rec-2',
            isDefault: false,
            photos: [{ id: 'p2', filename: 'b.jpg' }],
          }),
        ]),
      );

      await service.deleteItem(itemId, userId);

      expect(prisma.printItem.delete).toHaveBeenCalledWith({
        where: { id: itemId },
      });
      expect(storage.remove).toHaveBeenCalledWith('a.png');
      expect(storage.remove).toHaveBeenCalledWith('b.jpg');
    });
  });

  describe('addPhotos', () => {
    beforeEach(() => {
      prisma.printItem.findFirst.mockResolvedValue(itemRow());
    });

    it('lança BadRequestException para arquivo que não é imagem', async () => {
      await expect(
        service.addPhotos(itemId, 'rec-1', userId, [
          { buffer: Buffer.from('<svg></svg>') },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('lança NotFoundException para registro de outra peça', async () => {
      await expect(
        service.addPhotos(itemId, 'rec-x', userId, [{ buffer: PNG }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('grava o arquivo e liga a foto ao registro', async () => {
      storage.save.mockResolvedValue('nova.png');

      await service.addPhotos(itemId, 'rec-1', userId, [{ buffer: PNG }]);

      expect(storage.save).toHaveBeenCalledWith(PNG, 'png');
      expect(prisma.printPhoto.createMany).toHaveBeenCalledWith({
        data: [{ filename: 'nova.png', recordId: 'rec-1' }],
      });
    });

    it('remove os arquivos já gravados se o banco falhar', async () => {
      storage.save.mockResolvedValue('nova.png');
      prisma.printPhoto.createMany.mockRejectedValue(new Error('db'));

      await expect(
        service.addPhotos(itemId, 'rec-1', userId, [{ buffer: PNG }]),
      ).rejects.toThrow('db');
      expect(storage.remove).toHaveBeenCalledWith('nova.png');
    });
  });
});
