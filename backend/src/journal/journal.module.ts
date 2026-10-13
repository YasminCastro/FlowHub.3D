import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller.js';
import { JournalService } from './journal.service.js';
import { JournalPhotoStorage } from './journal-photo-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [JournalController],
  providers: [JournalService, JournalPhotoStorage, PrismaService],
})
export class JournalModule {}
