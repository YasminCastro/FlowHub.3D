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
import { PrintQueueService } from './print-queue.service.js';
import {
  FinishQueueEntryDto,
  QueueEntryDto,
  ReorderQueueDto,
  UpdateQueueEntryDto,
} from './dto/print-queue.js';

@Controller('print-queue')
export class PrintQueueController {
  constructor(private readonly printQueueService: PrintQueueService) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: QueueEntryDto,
  ) {
    return this.printQueueService.createEntry(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.printQueueService.getQueue(currentUserId);
  }

  // Antes de ':id' para "order" não ser lido como id.
  @Patch('order')
  reorder(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: ReorderQueueDto,
  ) {
    return this.printQueueService.reorder(currentUserId, dto);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
  ) {
    return this.printQueueService.getEntryById(entryId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
    @Body() dto: UpdateQueueEntryDto,
  ) {
    return this.printQueueService.updateEntry(entryId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
  ) {
    return this.printQueueService.deleteEntry(entryId, currentUserId);
  }

  @Post(':id/finish')
  finish(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
    @Body() dto: FinishQueueEntryDto,
  ) {
    return this.printQueueService.finishEntry(entryId, currentUserId, dto);
  }
}
