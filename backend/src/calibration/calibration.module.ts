import { Module } from '@nestjs/common';
import { CalibrationController } from './calibration.controller.js';
import { CalibrationService } from './calibration.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [CalibrationController],
  providers: [CalibrationService, PrismaService],
})
export class CalibrationModule {}
