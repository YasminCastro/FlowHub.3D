import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CalibrationService } from './calibration.service.js';
import { CalibrationDto, UpdateCalibrationDto } from './dto/calibration.js';

@Controller('calibrations')
export class CalibrationController {
  constructor(private readonly calibrationService: CalibrationService) {}

  // Cria, ou salva uma nova versão quando a combinação já existe.
  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: CalibrationDto,
  ) {
    return this.calibrationService.saveCalibration(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.calibrationService.getAllCalibrations(currentUserId);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') calibrationId: string,
  ) {
    return this.calibrationService.getCalibrationById(
      calibrationId,
      currentUserId,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') calibrationId: string,
    @Body() dto: UpdateCalibrationDto,
  ) {
    return this.calibrationService.updateCalibration(
      calibrationId,
      currentUserId,
      dto,
    );
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') calibrationId: string,
  ) {
    return this.calibrationService.deleteCalibration(
      calibrationId,
      currentUserId,
    );
  }
}
