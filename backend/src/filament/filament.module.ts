import { Module } from '@nestjs/common';
import { FilamentController } from './filament.controller.js';
import { FilamentService } from './filament.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [FilamentController],
  providers: [FilamentService, PrismaService],
})
export class FilamentModule {}
