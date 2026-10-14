import { Module } from '@nestjs/common';
import { PrintController } from './print.controller.js';
import { PrintService } from './print.service.js';
import { PrintPhotoStorage } from './print-photo-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [PrintController],
  providers: [PrintService, PrintPhotoStorage, PrismaService],
  // A fila conclui itens gravando registros por aqui.
  exports: [PrintService],
})
export class PrintModule {}
