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
import { CatalogService } from './catalog.service.js';
import { CatalogItemDto } from './dto/catalog.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: CatalogItemDto,
  ) {
    return this.catalogService.createItem(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.catalogService.getAllItems(currentUserId);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
  ) {
    return this.catalogService.getItemById(itemId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Body() dto: CatalogItemDto,
  ) {
    return this.catalogService.updateItem(itemId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
  ) {
    return this.catalogService.deleteItem(itemId, currentUserId);
  }
}
