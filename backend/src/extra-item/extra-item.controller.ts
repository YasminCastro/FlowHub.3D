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
import { ExtraItemService } from './extra-item.service.js';
import {
  ExtraItemDto,
  ExtraItemLotDto,
  UpdateExtraItemDto,
} from './dto/extra-item.js';

@Controller('extra-item')
export class ExtraItemController {
  constructor(private readonly extraItemService: ExtraItemService) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: ExtraItemDto,
  ) {
    return this.extraItemService.createItem(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.extraItemService.getAllItems(currentUserId);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
  ) {
    return this.extraItemService.getItemById(itemId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Body() dto: UpdateExtraItemDto,
  ) {
    return this.extraItemService.updateItem(itemId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
  ) {
    return this.extraItemService.deleteItem(itemId, currentUserId);
  }

  @Post(':id/lots')
  addLot(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Body() dto: ExtraItemLotDto,
  ) {
    return this.extraItemService.addLot(itemId, currentUserId, dto);
  }

  @Delete(':id/lots/:lotId')
  deleteLot(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('lotId') lotId: string,
  ) {
    return this.extraItemService.deleteLot(itemId, lotId, currentUserId);
  }
}
