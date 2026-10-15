import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CalibrationService } from './calibration.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalibrationDto } from './dto/calibration.js';
import { Prisma } from '../generated/prisma/client.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

// O argumento da chamada n do mock do Prisma.
function argOf(mock: AsyncMock, call = 0) {
  return mock.mock.calls[call][0] as Record<string, any>;
}

describe('CalibrationService', () => {
  let service: CalibrationService;
  let prisma: {
    calibration: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    calibrationVersion: { create: AsyncMock };
    filament: { findFirst: AsyncMock };
    printer: { findFirst: AsyncMock };
    printRecord: { findMany: AsyncMock };
    $transaction: AsyncMock;
  };

  const userId = 'user-1';
  const calibrationId = 'cal-1';
  const filamentId = '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a';
  const printerId = '7f1d2c3b-4a5e-4f60-8b71-2c3d4e5f6a7b';
  const calibratedAt = new Date('2026-09-19T12:00:00.000Z');

  // Como o Prisma devolve, com as relações do include.
  const calibration = {
    id: calibrationId,
    slicer: 'ORCA',
    flow: 1,
    nozzleTempInitial: 215,
    nozzleTemp: 210,
    bedTempFirstLayer: 65,
    bedTemp: 60,
    pressureAdvance: 0.02,
    maxVolumetricSpeed: 18,
    retractionDistance: 0.8,
    notes: 'Canto parou de descolar',
    calibratedAt,
    filamentId,
    printerId,
    createdAt: calibratedAt,
    updatedAt: calibratedAt,
    filament: {
      id: filamentId,
      colorName: 'Verde Água',
      type: 'PLA',
      colors: ['#7fd4c1'],
      spoolLevel: 'FULL',
      brand: { name: 'Voolt3D' },
    },
    printer: { id: printerId, name: 'Ender 3 V3 KE' },
    versions: [
      {
        id: 'ver-1',
        flow: 0.97,
        nozzleTempInitial: 210,
        nozzleTemp: 205,
        bedTempFirstLayer: 65,
        bedTemp: 60,
        pressureAdvance: 0.024,
        maxVolumetricSpeed: null,
        retractionDistance: 0.8,
        notes: null,
        calibratedAt: new Date('2026-08-31T12:00:00.000Z'),
      },
    ],
  };

  const input: CalibrationDto = {
    filamentId,
    printerId,
    slicer: 'ORCA',
    flow: 0.98,
    nozzleTempInitial: 220,
    nozzleTemp: 215,
    bedTempFirstLayer: 65,
    bedTemp: 60,
    pressureAdvance: 0.022,
    calibratedAt: '2026-10-15T12:00:00.000Z',
    notes: '   ',
  };

  beforeEach(async () => {
    prisma = {
      calibration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      calibrationVersion: { create: jest.fn() },
      filament: { findFirst: jest.fn() },
      printer: { findFirst: jest.fn() },
      printRecord: { findMany: jest.fn() },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ) as AsyncMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CalibrationService>(CalibrationService);
  });

  function ownsFilamentAndPrinter() {
    prisma.filament.findFirst.mockResolvedValue({ id: filamentId });
    prisma.printer.findFirst.mockResolvedValue({ id: printerId });
  }

  describe('saveCalibration', () => {
    it('cria quando a combinação ainda não existe, com opcionais nulos', async () => {
      ownsFilamentAndPrinter();
      prisma.calibration.findFirst.mockResolvedValue(null);
      prisma.calibration.create.mockResolvedValue(calibration);

      const result = await service.saveCalibration(userId, input);

      const { data } = argOf(prisma.calibration.create);
      expect(data).toMatchObject({
        flow: 0.98,
        nozzleTemp: 215,
        slicer: 'ORCA',
        filamentId,
        printerId,
        userId,
        maxVolumetricSpeed: null,
        retractionDistance: null,
        notes: null,
      });
      expect(prisma.calibrationVersion.create).not.toHaveBeenCalled();
      expect(result.message).toBe('Calibração criada com sucesso');
      expect(result.data.filament.brandName).toBe('Voolt3D');
      expect(result.data.history).toHaveLength(1);
    });

    it('guarda os valores atuais no histórico quando a combinação já existe', async () => {
      ownsFilamentAndPrinter();
      prisma.calibration.findFirst.mockResolvedValue(calibration);
      prisma.calibrationVersion.create.mockResolvedValue({});
      prisma.calibration.update.mockResolvedValue(calibration);

      const result = await service.saveCalibration(userId, input);

      expect(argOf(prisma.calibrationVersion.create).data).toEqual({
        calibrationId,
        flow: 1,
        nozzleTempInitial: 215,
        nozzleTemp: 210,
        bedTempFirstLayer: 65,
        bedTemp: 60,
        pressureAdvance: 0.02,
        maxVolumetricSpeed: 18,
        retractionDistance: 0.8,
        notes: 'Canto parou de descolar',
        calibratedAt,
      });
      const update = argOf(prisma.calibration.update);
      expect(update.where).toEqual({ id: calibrationId });
      expect(update.data).toMatchObject({ flow: 0.98, nozzleTemp: 215 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.calibration.create).not.toHaveBeenCalled();
      expect(result.message).toBe(
        'Nova versão da calibração salva com sucesso',
      );
    });

    it('responde 404 para filamento de outro usuário', async () => {
      prisma.filament.findFirst.mockResolvedValue(null);

      await expect(service.saveCalibration(userId, input)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.calibration.create).not.toHaveBeenCalled();
    });

    it('responde 404 para impressora de outro usuário', async () => {
      prisma.filament.findFirst.mockResolvedValue({ id: filamentId });
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(service.saveCalibration(userId, input)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('transforma a corrida no índice único em 409', async () => {
      ownsFilamentAndPrinter();
      prisma.calibration.findFirst.mockResolvedValue(null);
      prisma.calibration.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicada', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.saveCalibration(userId, input)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getCalibrationById', () => {
    it('inclui histórico e as impressões com os gramas do filamento', async () => {
      prisma.calibration.findFirst.mockResolvedValue(calibration);
      prisma.printRecord.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          printedAt: new Date('2026-10-02T12:00:00.000Z'),
          outcome: 'SUCCESS',
          item: { id: 'item-1', name: 'Vaso hexagonal' },
          filaments: [{ grams: 100 }, { grams: 28 }],
        },
      ]);

      const result = await service.getCalibrationById(calibrationId, userId);

      const { where } = argOf(prisma.printRecord.findMany);
      expect(where).toMatchObject({
        printerId,
        printedAt: { gte: calibratedAt },
        item: { userId },
        filaments: { some: { filamentId } },
        OR: [
          { slicer: null },
          { slicer: { contains: 'orca', mode: 'insensitive' } },
        ],
      });
      expect(result.prints).toEqual([
        {
          id: 'rec-1',
          printItemId: 'item-1',
          name: 'Vaso hexagonal',
          printedAt: new Date('2026-10-02T12:00:00.000Z'),
          grams: 128,
          outcome: 'SUCCESS',
        },
      ]);
      expect(result.history[0].id).toBe('ver-1');
    });

    it('responde 404 para calibração de outro usuário', async () => {
      prisma.calibration.findFirst.mockResolvedValue(null);

      await expect(
        service.getCalibrationById(calibrationId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCalibration', () => {
    it('corrige no lugar, sem criar versão', async () => {
      prisma.calibration.findFirst.mockResolvedValue(calibration);
      prisma.calibration.update.mockResolvedValue(calibration);

      await service.updateCalibration(calibrationId, userId, {
        flow: 0.99,
        notes: '  ajustado  ',
      });

      expect(argOf(prisma.calibration.update).data).toEqual({
        flow: 0.99,
        notes: 'ajustado',
      });
      expect(prisma.calibrationVersion.create).not.toHaveBeenCalled();
    });

    it('responde 409 ao mudar para uma combinação que já existe', async () => {
      prisma.calibration.findFirst
        .mockResolvedValueOnce(calibration)
        .mockResolvedValueOnce({ id: 'cal-2' });

      await expect(
        service.updateCalibration(calibrationId, userId, {
          slicer: 'CREALITY',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.calibration.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteCalibration', () => {
    it('exclui a calibração do usuário', async () => {
      prisma.calibration.findFirst.mockResolvedValue(calibration);
      prisma.calibration.delete.mockResolvedValue(calibration);

      await service.deleteCalibration(calibrationId, userId);

      expect(argOf(prisma.calibration.delete)).toEqual({
        where: { id: calibrationId },
      });
    });

    it('responde 404 sem excluir quando não é do usuário', async () => {
      prisma.calibration.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCalibration(calibrationId, userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.calibration.delete).not.toHaveBeenCalled();
    });
  });
});
