import { Module } from '@nestjs/common';
import { PrinterController } from './printer.controller.js';
import { PrinterService } from './printer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [PrinterController],
  providers: [PrinterService, PrismaService],
})
export class PrinterModule {}
