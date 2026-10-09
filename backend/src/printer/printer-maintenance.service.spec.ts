import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrinterMaintenanceService } from './printer-maintenance.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrinterMaintenanceDto } from './dto/printer-maintenance.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('PrinterMaintenanceService', () => {
  let service: PrinterMaintenanceService;
  let prisma: {
    printer: { findFirst: AsyncMock; update: AsyncMock };
    printerMaintenance: {
      create: AsyncMock;
      findMany: AsyncMock;
      findFirst: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    $transaction: AsyncMock;
  };

  const userId = 'user-1';
  const printerId = 'printer-1';
  const lubrication: PrinterMaintenanceDto = {
    type: 'LUBRICATION',
    date: new Date('2026-08-25'),
    printerHours: 613,
    cost: 19,
    remindAfterHours: 200,
  };

  beforeEach(async () => {
    prisma = {
      printer: { findFirst: jest.fn(), update: jest.fn() },
      printerMaintenance: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((operations: unknown) =>
        Promise.all(operations as Promise<unknown>[]),
      ) as AsyncMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterMaintenanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PrinterMaintenanceService>(PrinterMaintenanceService);
  });

  describe('registerMaintenance', () => {
    it('lança NotFoundException se a impressora não for do usuário', async () => {
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(
        service.registerMaintenance(printerId, userId, lubrication),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.printerMaintenance.create).not.toHaveBeenCalled();
    });

    it('cria a manutenção e avança a última manutenção da impressora', async () => {
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        lastMaintenanceDate: new Date('2026-07-02'),
      });
      prisma.printerMaintenance.create.mockResolvedValue({ id: 'm-1' });
      prisma.printer.update.mockResolvedValue({});

      const result = await service.registerMaintenance(
        printerId,
        userId,
        lubrication,
      );

      expect(prisma.printerMaintenance.create).toHaveBeenCalledWith({
        data: { ...lubrication, printerId },
      });
      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: printerId },
        data: { lastMaintenanceDate: lubrication.date },
      });
      expect(result.data).toEqual({ id: 'm-1' });
    });

    it('não volta a data quando registra uma manutenção antiga', async () => {
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        lastMaintenanceDate: new Date('2026-09-01'),
      });

      await service.registerMaintenance(printerId, userId, lubrication);

      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: printerId },
        data: {},
      });
    });

    it('troca de bico atualiza o bico da impressora', async () => {
      prisma.printer.findFirst.mockResolvedValue({
        id: printerId,
        lastMaintenanceDate: null,
      });
      const nozzleChange: PrinterMaintenanceDto = {
        type: 'NOZZLE_CHANGE',
        date: new Date('2026-08-25'),
        nozzleInstalled: '0,4 mm · aço endurecido',
        nozzleRemoved: '0,4 mm · latão',
      };

      await service.registerMaintenance(printerId, userId, nozzleChange);

      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: printerId },
        data: {
          lastMaintenanceDate: nozzleChange.date,
          nozzle: '0,4 mm · aço endurecido',
        },
      });
    });
  });

  describe('getMaintenances', () => {
    it('lista as manutenções com o custo total', async () => {
      prisma.printer.findFirst.mockResolvedValue({ id: printerId });
      prisma.printerMaintenance.findMany.mockResolvedValue([
        { id: 'm-2', cost: 48 },
        { id: 'm-1', cost: 19 },
        { id: 'm-0', cost: null },
      ]);

      const result = await service.getMaintenances(printerId, userId);

      expect(prisma.printerMaintenance.findMany).toHaveBeenCalledWith({
        where: { printerId },
        orderBy: { date: 'desc' },
      });
      expect(result.totalCost).toBe(67);
      expect(result.maintenances).toHaveLength(3);
    });
  });

  describe('updateMaintenance', () => {
    const maintenanceId = 'm-1';

    it('lança NotFoundException se a manutenção não for do usuário', async () => {
      prisma.printerMaintenance.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMaintenance(printerId, maintenanceId, userId, {
          cost: 25,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.printerMaintenance.update).not.toHaveBeenCalled();
    });

    it('atualiza e sincroniza a última manutenção com o histórico', async () => {
      prisma.printerMaintenance.findFirst
        .mockResolvedValueOnce({
          id: maintenanceId,
          date: new Date('2026-08-25'),
          printer: { lastMaintenanceDate: new Date('2026-08-25') },
        })
        .mockResolvedValueOnce({ date: new Date('2026-08-20') });
      prisma.printerMaintenance.update.mockResolvedValue({
        id: maintenanceId,
        type: 'LUBRICATION',
        date: new Date('2026-08-20'),
      });

      const result = await service.updateMaintenance(
        printerId,
        maintenanceId,
        userId,
        { date: new Date('2026-08-20') },
      );

      expect(prisma.printerMaintenance.update).toHaveBeenCalledWith({
        where: { id: maintenanceId },
        data: { date: new Date('2026-08-20') },
      });
      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: printerId },
        data: { lastMaintenanceDate: new Date('2026-08-20') },
      });
      expect(result.data.id).toBe(maintenanceId);
    });

    it('corrige o bico da ficha se for a troca de bico mais recente', async () => {
      prisma.printerMaintenance.findFirst
        .mockResolvedValueOnce({
          id: maintenanceId,
          date: new Date('2026-08-25'),
          printer: { lastMaintenanceDate: new Date('2026-08-25') },
        })
        .mockResolvedValueOnce({ date: new Date('2026-08-25') })
        .mockResolvedValueOnce({ id: maintenanceId });
      prisma.printerMaintenance.update.mockResolvedValue({
        id: maintenanceId,
        type: 'NOZZLE_CHANGE',
        nozzleInstalled: '0,6 mm',
      });

      await service.updateMaintenance(printerId, maintenanceId, userId, {
        nozzleInstalled: '0,6 mm',
      });

      expect(prisma.printer.update).toHaveBeenLastCalledWith({
        where: { id: printerId },
        data: { nozzle: '0,6 mm' },
      });
    });
  });

  describe('deleteMaintenance', () => {
    const maintenanceId = 'm-1';

    it('exclui e limpa a data se era a única manutenção', async () => {
      const date = new Date('2026-08-25');
      prisma.printerMaintenance.findFirst
        .mockResolvedValueOnce({
          id: maintenanceId,
          date,
          printer: { lastMaintenanceDate: new Date(date) },
        })
        .mockResolvedValueOnce(null);

      const result = await service.deleteMaintenance(
        printerId,
        maintenanceId,
        userId,
      );

      expect(prisma.printerMaintenance.delete).toHaveBeenCalledWith({
        where: { id: maintenanceId },
      });
      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: printerId },
        data: { lastMaintenanceDate: null },
      });
      expect(result.message).toBe('Manutenção excluída com sucesso');
    });

    it('mantém uma data informada à mão quando não sobra histórico', async () => {
      prisma.printerMaintenance.findFirst
        .mockResolvedValueOnce({
          id: maintenanceId,
          date: new Date('2026-08-25'),
          printer: { lastMaintenanceDate: new Date('2026-09-01') },
        })
        .mockResolvedValueOnce(null);

      await service.deleteMaintenance(printerId, maintenanceId, userId);

      expect(prisma.printer.update).not.toHaveBeenCalled();
    });
  });
});
