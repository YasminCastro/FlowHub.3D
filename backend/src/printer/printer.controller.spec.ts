import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PrinterController } from './printer.controller.js';
import { PrinterService } from './printer.service.js';
import { PrinterDto } from './dto/printer.js';

describe('PrinterController', () => {
  let controller: PrinterController;
  let service: jest.Mocked<PrinterService>;

  const userId = 'user-1';
  const printerId = 'printer-1';
  const dto: PrinterDto = {
    name: 'Ender 3',
    brand: 'Creality',
    nozzle: '0.4mm',
    extrusionType: 'Bowden',
    filamentsTypes: ['PLA', 'PETG'],
    powerConsumptionW: 220,
    energyCostPerKwh: 0.9,
    maintenanceCostPerHour: 0.5,
    purchasePrice: 1500,
    purchaseDate: new Date('2024-01-01'),
    lastMaintenanceDate: new Date('2024-06-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrinterController],
      providers: [
        {
          provide: PrinterService,
          useValue: {
            createPrinter: jest.fn(),
            getAllPrinters: jest.fn(),
            getPrinterById: jest.fn(),
            updatePrinter: jest.fn(),
            deletePrinter: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PrinterController>(PrinterController);
    service = module.get(PrinterService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /printer', () => {
    it('creates a printer for the current user', async () => {
      const result = { message: 'Impressora criada com sucesso', data: {} };
      service.createPrinter.mockResolvedValue(result as any);

      const response = await controller.post(userId, dto);

      expect(service.createPrinter).toHaveBeenCalledWith({
        ...dto,
        userId,
      });
      expect(response).toBe(result);
    });
  });

  describe('GET /printer', () => {
    it('returns all printers for the current user', async () => {
      const printers = [{ id: printerId, name: dto.name }];
      service.getAllPrinters.mockResolvedValue(printers as any);

      const response = await controller.getAll(userId);

      expect(service.getAllPrinters).toHaveBeenCalledWith(userId);
      expect(response).toBe(printers);
    });
  });

  describe('GET /printer/:id', () => {
    it('returns a printer by id', async () => {
      const printer = { id: printerId, name: dto.name };
      service.getPrinterById.mockResolvedValue(printer as any);

      const response = await controller.getById(printerId);

      expect(service.getPrinterById).toHaveBeenCalledWith(printerId);
      expect(response).toBe(printer);
    });
  });

  describe('PATCH /printer/:id', () => {
    it('updates a printer', async () => {
      const result = {
        message: 'Impressora atualizada com sucesso',
        printer: { id: printerId, ...dto },
      };
      service.updatePrinter.mockResolvedValue(result as any);

      const response = await controller.update(printerId, dto);

      expect(service.updatePrinter).toHaveBeenCalledWith(printerId, dto);
      expect(response).toBe(result);
    });
  });

  describe('DELETE /printer/:id', () => {
    it('deletes a printer', async () => {
      const result = { message: 'Impressora deletada com sucesso' };
      service.deletePrinter.mockResolvedValue(result as any);

      const response = await controller.delete(printerId);

      expect(service.deletePrinter).toHaveBeenCalledWith(printerId);
      expect(response).toBe(result);
    });
  });
});
