import { Body, Controller, Get, Put } from '@nestjs/common';
import { CostSettingsService } from './cost-settings.service.js';
import { CostSettingsDto } from './dto/cost-settings.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('cost-settings')
export class CostSettingsController {
  constructor(private readonly costSettingsService: CostSettingsService) {}

  @Get()
  get(@CurrentUser('userId') currentUserId: string) {
    return this.costSettingsService.findCostSettings(currentUserId);
  }

  @Put()
  put(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: CostSettingsDto,
  ) {
    return this.costSettingsService.updateCostSettings(currentUserId, dto);
  }
}
