import { Module } from '@nestjs/common';
import { CostSettingsController } from './cost-settings.controller.js';
import { CostSettingsService } from './cost-settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [CostSettingsController],
  providers: [CostSettingsService, PrismaService],
})
export class CostSettingsModule {}
