import { Module } from '@nestjs/common';
import { FlushingController } from './flushing.controller.js';
import { FlushingService } from './flushing.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [FlushingController],
  providers: [FlushingService, PrismaService],
})
export class FlushingModule {}
