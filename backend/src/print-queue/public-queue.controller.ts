import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator.js';
import { PrintQueueService } from './print-queue.service.js';
import { PublicQueueRequestDto } from './dto/print-queue.js';

// Sem login: quem tem o link de alguém pede impressões na fila dessa pessoa.
@Public()
@Controller('public-queue')
export class PublicQueueController {
  constructor(private readonly printQueueService: PrintQueueService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.printQueueService.getSharedQueue(token);
  }

  @Post(':token')
  post(@Param('token') token: string, @Body() dto: PublicQueueRequestDto) {
    return this.printQueueService.createShareRequest(token, dto);
  }
}
