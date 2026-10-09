import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller.js';
import { BrandService } from './brand.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [BrandController],
  providers: [BrandService, PrismaService],
})
export class BrandModule {}
