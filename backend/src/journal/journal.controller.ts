import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JournalService } from './journal.service.js';
import {
  JOURNAL_MAX_PHOTOS,
  JOURNAL_PHOTO_MAX_BYTES,
  JournalEntryDto,
  UpdateJournalEntryDto,
} from './dto/journal.js';

@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: JournalEntryDto,
  ) {
    return this.journalService.createEntry(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.journalService.getAllEntries(currentUserId);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
  ) {
    return this.journalService.getEntryById(entryId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalService.updateEntry(entryId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
  ) {
    return this.journalService.deleteEntry(entryId, currentUserId);
  }

  // Multipart com o campo "photos". Fica em memória até o serviço conferir
  // dono e formato; só então vai para o disco.
  @Post(':id/photos')
  @UseInterceptors(
    FilesInterceptor('photos', JOURNAL_MAX_PHOTOS, {
      storage: memoryStorage(),
      limits: { fileSize: JOURNAL_PHOTO_MAX_BYTES },
    }),
  )
  addPhotos(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.journalService.addPhotos(entryId, currentUserId, files ?? []);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') entryId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.journalService.deletePhoto(entryId, photoId, currentUserId);
  }
}
