import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  CostSettingsService,
  DEFAULT_COST_SETTINGS,
} from './cost-settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('CostSettingsService', () => {
  let service: CostSettingsService;
  let prisma: {
    costSettings: { findUnique: jest.Mock; upsert: jest.Mock };
    printer: { count: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  const userId = 'user-1';
  const dto = { ...DEFAULT_COST_SETTINGS, energyCostPerKwh: 0.95 };

  beforeEach(async () => {
    prisma = {
      costSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn((args: unknown) => ({ op: 'upsert', args })),
      },
      printer: {
        count: jest.fn(),
        updateMany: jest.fn((args: unknown) => ({ op: 'updateMany', args })),
        update: jest.fn((args: unknown) => ({ op: 'update', args })),
      },
      $transaction: jest.fn((ops: unknown[]) =>
        Promise.resolve([{ ...dto }, ...ops.slice(1)]),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CostSettingsService>(CostSettingsService);
  });

  describe('findCostSettings', () => {
    it('returns the defaults when the user has not saved settings yet', async () => {
      prisma.costSettings.findUnique.mockResolvedValue(null as never);

      await expect(service.findCostSettings(userId)).resolves.toEqual(
        DEFAULT_COST_SETTINGS,
      );
    });

    it('returns the saved settings', async () => {
      prisma.costSettings.findUnique.mockResolvedValue(dto as never);

      await expect(service.findCostSettings(userId)).resolves.toEqual(dto);
    });
  });

  describe('updateCostSettings', () => {
    it('upserts the settings and makes every printer inherit the global tariff', async () => {
      const result = await service.updateCostSettings(userId, dto);

      expect(prisma.costSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          create: { ...dto, userId },
          update: dto,
        }),
      );
      expect(prisma.printer.updateMany).toHaveBeenCalledWith({
        where: { userId, id: { notIn: [] } },
        data: { energyCostPerKwh: 0.95 },
      });
      expect(prisma.printer.update).not.toHaveBeenCalled();
      expect(prisma.printer.count).not.toHaveBeenCalled();
      expect(result.settings).toEqual(dto);
    });

    it('keeps the own tariff of the listed printers', async () => {
      prisma.printer.count.mockResolvedValue(1 as never);

      await service.updateCostSettings(userId, {
        ...dto,
        printerTariffs: [{ printerId: 'printer-1', energyCostPerKwh: 1.05 }],
      });

      expect(prisma.printer.count).toHaveBeenCalledWith({
        where: { id: { in: ['printer-1'] }, userId },
      });
      expect(prisma.printer.updateMany).toHaveBeenCalledWith({
        where: { userId, id: { notIn: ['printer-1'] } },
        data: { energyCostPerKwh: 0.95 },
      });
      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: 'printer-1' },
        data: { energyCostPerKwh: 1.05 },
      });
    });

    it('rejects printers that belong to another user', async () => {
      prisma.printer.count.mockResolvedValue(0 as never);

      await expect(
        service.updateCostSettings(userId, {
          ...dto,
          printerTariffs: [{ printerId: 'other', energyCostPerKwh: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a printer listed twice', async () => {
      await expect(
        service.updateCostSettings(userId, {
          ...dto,
          printerTariffs: [
            { printerId: 'printer-1', energyCostPerKwh: 1 },
            { printerId: 'printer-1', energyCostPerKwh: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
