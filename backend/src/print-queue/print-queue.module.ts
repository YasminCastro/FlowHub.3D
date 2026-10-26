import { Module } from '@nestjs/common';
import { PrintQueueController } from './print-queue.controller.js';
import { PublicQueueController } from './public-queue.controller.js';
import { PrintQueueService } from './print-queue.service.js';
import { PrintModule } from '../print/print.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  imports: [PrintModule],
  controllers: [PrintQueueController, PublicQueueController],
  providers: [PrintQueueService, PrismaService],
})
export class PrintQueueModule {}
