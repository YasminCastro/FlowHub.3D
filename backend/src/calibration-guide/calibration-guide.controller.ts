import { Body, Controller, Delete, Get, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CalibrationGuideService } from './calibration-guide.service.js';
import {
  GuideProgressKeyDto,
  SaveGuideProgressDto,
} from './dto/calibration-guide.js';

// Progresso do guia "Por fatiador", identificado por filamento + impressora +
// fatiador (na query para ler e apagar, no corpo para salvar).
@Controller('calibration-guide')
export class CalibrationGuideController {
  constructor(private readonly guideService: CalibrationGuideService) {}

  @Get()
  get(
    @CurrentUser('userId') currentUserId: string,
    @Query() key: GuideProgressKeyDto,
  ) {
    return this.guideService.getProgress(currentUserId, key);
  }

  @Put()
  save(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: SaveGuideProgressDto,
  ) {
    return this.guideService.saveProgress(currentUserId, dto);
  }

  @Delete()
  reset(
    @CurrentUser('userId') currentUserId: string,
    @Query() key: GuideProgressKeyDto,
  ) {
    return this.guideService.resetProgress(currentUserId, key);
  }
}
