import { Module } from '@nestjs/common';
import { CalibrationGuideController } from './calibration-guide.controller.js';
import { CalibrationGuideService } from './calibration-guide.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [CalibrationGuideController],
  providers: [CalibrationGuideService, PrismaService],
})
export class CalibrationGuideModule {}
