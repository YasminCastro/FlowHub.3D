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
import { FlushingService } from './flushing.service.js';
import { FlushPairDto, UpdateFlushPairDto } from './dto/flushing.js';

// Flushing volumes por par de filamentos, numa impressora e num fatiador.
@Controller('flush-pairs')
export class FlushingController {
  constructor(private readonly flushingService: FlushingService) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: FlushPairDto,
  ) {
    return this.flushingService.createPair(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.flushingService.getAllPairs(currentUserId);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') pairId: string,
  ) {
    return this.flushingService.getPairById(pairId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') pairId: string,
    @Body() dto: UpdateFlushPairDto,
  ) {
    return this.flushingService.updatePair(pairId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') pairId: string,
  ) {
    return this.flushingService.deletePair(pairId, currentUserId);
  }
}
