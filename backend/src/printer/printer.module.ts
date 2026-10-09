import { Module } from '@nestjs/common';
import { PrinterController } from './printer.controller.js';
import { PrinterService } from './printer.service.js';
import { PrinterMaintenanceController } from './printer-maintenance.controller.js';
import { PrinterMaintenanceService } from './printer-maintenance.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [PrinterController, PrinterMaintenanceController],
  providers: [PrinterService, PrinterMaintenanceService, PrismaService],
})
export class PrinterModule {}
