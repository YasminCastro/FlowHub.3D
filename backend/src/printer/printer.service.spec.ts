import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrinterService } from './printer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrinterDto } from './dto/printer.js';

type AsyncMock = jest.Mock<() => Promise<any>>;

describe('PrinterService', () => {
  let service: PrinterService;
  let prisma: {
    printer: {
      findUnique: AsyncMock;
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
  };

  const userId = 'user-1';
  const printerId = 'printer-1';
  const printerData: PrinterDto & { userId: string } = {
    userId,
    name: 'Ender 3',
    brand: 'Creality',
    nozzle: '0.4mm',
    extrusionType: 'Direct Drive',
    filamentsTypes: ['PLA'],
    powerConsumptionW: 220,
    energyCostPerKwh: 0.9,
    maintenanceCostPerHour: 1,
    purchasePrice: 1500,
    purchaseDate: new Date(),
    lastMaintenanceDate: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      printer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PrinterService>(PrinterService);
  });

  describe('createPrinter', () => {
    it('throws ConflictException when a printer with the same name already exists for the user', async () => {
      prisma.printer.findUnique.mockResolvedValue({ id: printerId });

      await expect(service.createPrinter(printerData)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.printer.create).not.toHaveBeenCalled();
    });

    it('creates the printer when no duplicate exists', async () => {
      prisma.printer.findUnique.mockResolvedValue(null);
      const created = { id: printerId, ...printerData };
      prisma.printer.create.mockResolvedValue(created);

      const result = await service.createPrinter(printerData);

      expect(prisma.printer.create).toHaveBeenCalledWith({
        data: printerData,
      });
      expect(result).toEqual({
        message: 'Impressora criada com sucesso',
        data: created,
      });
    });
  });

  describe('getAllPrinters', () => {
    it('returns printers scoped to the user without the userId field', async () => {
      const printers = [{ id: printerId, name: 'Ender 3' }];
      prisma.printer.findMany.mockResolvedValue(printers);

      const result = await service.getAllPrinters(userId);

      expect(prisma.printer.findMany).toHaveBeenCalledWith({
        where: { userId },
        omit: { userId: true },
      });
      expect(result).toBe(printers);
    });
  });

  describe('getPrinterById', () => {
    it('busca a impressora filtrando pelo usuário, sem o userId', async () => {
      const printer = { id: printerId, name: 'Ender 3' };
      prisma.printer.findFirst.mockResolvedValue(printer);

      const result = await service.getPrinterById(printerId, userId);

      expect(prisma.printer.findFirst).toHaveBeenCalledWith({
        where: { id: printerId, userId },
        omit: { userId: true },
      });
      expect(result).toBe(printer);
    });

    it('lança NotFoundException para impressora de outro usuário', async () => {
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(
        service.getPrinterById(printerId, 'outro-usuario'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printer.findFirst).toHaveBeenCalledWith({
        where: { id: printerId, userId: 'outro-usuario' },
        omit: { userId: true },
      });
    });
  });

  describe('updatePrinter', () => {
    it('lança NotFoundException e não altera impressora de outro usuário', async () => {
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePrinter(printerId, 'outro-usuario', { name: 'New name' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printer.findFirst).toHaveBeenCalledWith({
        where: { id: printerId, userId: 'outro-usuario' },
        omit: { userId: true },
      });
      expect(prisma.printer.update).not.toHaveBeenCalled();
    });

    it('atualiza a impressora do próprio usuário', async () => {
      prisma.printer.findFirst.mockResolvedValue({ id: printerId });
      const updated = { id: printerId, name: 'New name' };
      prisma.printer.update.mockResolvedValue(updated);

      const result = await service.updatePrinter(printerId, userId, {
        name: 'New name',
      });

      expect(prisma.printer.update).toHaveBeenCalledWith({
        where: { id: printerId },
        data: { name: 'New name' },
        omit: { userId: true },
      });
      expect(result).toEqual({
        message: 'Impressora atualizada com sucesso',
        printer: updated,
      });
    });
  });

  describe('deletePrinter', () => {
    it('lança NotFoundException e não exclui impressora de outro usuário', async () => {
      prisma.printer.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePrinter(printerId, 'outro-usuario'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.printer.delete).not.toHaveBeenCalled();
    });

    it('exclui a impressora do próprio usuário', async () => {
      prisma.printer.findFirst.mockResolvedValue({ id: printerId });
      prisma.printer.delete.mockResolvedValue({ id: printerId });

      const result = await service.deletePrinter(printerId, userId);

      expect(prisma.printer.findFirst).toHaveBeenCalledWith({
        where: { id: printerId, userId },
        omit: { userId: true },
      });
      expect(prisma.printer.delete).toHaveBeenCalledWith({
        where: { id: printerId },
      });
      expect(result).toEqual({ message: 'Impressora deletada com sucesso' });
    });
  });
});
