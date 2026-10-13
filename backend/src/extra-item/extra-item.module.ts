import { Module } from '@nestjs/common';
import { ExtraItemController } from './extra-item.controller.js';
import { ExtraItemService } from './extra-item.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [ExtraItemController],
  providers: [ExtraItemService, PrismaService],
})
export class ExtraItemModule {}
