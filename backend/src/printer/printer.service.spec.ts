import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrinterService } from './printer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PrinterService', () => {
  let service: PrinterService;
  let prisma: {
    printer: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const userId = 'user-1';
  const printerId = 'printer-1';
  const printerData = { name: 'Ender 3', userId };

  beforeEach(async () => {
    prisma = {
      printer: {
        findUnique: jest.fn(),
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
    it('returns the printer without the userId field', async () => {
      const printer = { id: printerId, name: 'Ender 3' };
      prisma.printer.findUnique.mockResolvedValue(printer);

      const result = await service.getPrinterById(printerId);

      expect(prisma.printer.findUnique).toHaveBeenCalledWith({
        where: { id: printerId },
        omit: { userId: true },
      });
      expect(result).toBe(printer);
    });
  });

  describe('updatePrinter', () => {
    it('throws ConflictException when the printer does not exist', async () => {
      prisma.printer.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePrinter(printerId, { name: 'New name' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.printer.update).not.toHaveBeenCalled();
    });

    it('updates the printer when it exists', async () => {
      prisma.printer.findUnique.mockResolvedValue({ id: printerId });
      const updated = { id: printerId, name: 'New name' };
      prisma.printer.update.mockResolvedValue(updated);

      const result = await service.updatePrinter(printerId, {
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
    it('throws ConflictException when the printer does not exist', async () => {
      prisma.printer.findUnique.mockResolvedValue(null);

      await expect(service.deletePrinter(printerId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.printer.delete).not.toHaveBeenCalled();
    });

    it('deletes the printer when it exists', async () => {
      prisma.printer.findUnique.mockResolvedValue({ id: printerId });
      prisma.printer.delete.mockResolvedValue({ id: printerId });

      const result = await service.deletePrinter(printerId);

      expect(prisma.printer.delete).toHaveBeenCalledWith({
        where: { id: printerId },
      });
      expect(result).toEqual({ message: 'Impressora deletada com sucesso' });
    });
  });
});
