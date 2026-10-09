import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BrandService } from './brand.service.js';
import { BrandDto, BrandNoteDto, UpdateBrandDto } from './dto/brand.js';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  post(@CurrentUser('userId') currentUserId: string, @Body() dto: BrandDto) {
    return this.brandService.createBrand(currentUserId, dto);
  }

  @Get()
  getAll(
    @CurrentUser('userId') currentUserId: string,
    @Query('archived', new ParseBoolPipe({ optional: true }))
    archived?: boolean,
  ) {
    return this.brandService.getAllBrands(currentUserId, archived);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') brandId: string,
  ) {
    return this.brandService.getBrandById(brandId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') brandId: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.brandService.updateBrand(brandId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') brandId: string,
  ) {
    return this.brandService.deleteBrand(brandId, currentUserId);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') brandId: string,
    @Body() dto: BrandNoteDto,
  ) {
    return this.brandService.addNote(brandId, currentUserId, dto);
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') brandId: string,
    @Param('noteId') noteId: string,
    @Body() dto: BrandNoteDto,
  ) {
    return this.brandService.updateNote(brandId, noteId, currentUserId, dto);
  }

  @Delete(':id/notes/:noteId')
  deleteNote(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') brandId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.brandService.deleteNote(brandId, noteId, currentUserId);
  }
}
