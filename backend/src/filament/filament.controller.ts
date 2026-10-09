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
import { FilamentService } from './filament.service.js';
import {
  FilamentDto,
  FilamentNoteDto,
  FilamentPurchaseDto,
  UpdateFilamentDto,
} from './dto/filament.js';

@Controller('filament')
export class FilamentController {
  constructor(private readonly filamentService: FilamentService) {}

  @Post()
  post(@CurrentUser('userId') currentUserId: string, @Body() dto: FilamentDto) {
    return this.filamentService.createFilament(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.filamentService.getAllFilaments(currentUserId);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
  ) {
    return this.filamentService.getFilamentById(filamentId, currentUserId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
    @Body() dto: UpdateFilamentDto,
  ) {
    return this.filamentService.updateFilament(filamentId, currentUserId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
  ) {
    return this.filamentService.deleteFilament(filamentId, currentUserId);
  }

  @Post(':id/purchases')
  addPurchase(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
    @Body() dto: FilamentPurchaseDto,
  ) {
    return this.filamentService.addPurchase(filamentId, currentUserId, dto);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
    @Body() dto: FilamentNoteDto,
  ) {
    return this.filamentService.addNote(filamentId, currentUserId, dto);
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
    @Param('noteId') noteId: string,
    @Body() dto: FilamentNoteDto,
  ) {
    return this.filamentService.updateNote(
      filamentId,
      noteId,
      currentUserId,
      dto,
    );
  }

  @Delete(':id/notes/:noteId')
  deleteNote(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') filamentId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.filamentService.deleteNote(filamentId, noteId, currentUserId);
  }
}
