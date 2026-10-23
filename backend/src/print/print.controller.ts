import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PrintService } from './print.service.js';
import {
  AddPrintRecordDto,
  PRINT_MAX_PHOTOS,
  PRINT_PHOTO_MAX_BYTES,
  PrintItemDto,
  PrintItemsPageQueryDto,
  PrintSummaryQueryDto,
  UpdatePrintPhotoDto,
  UpdatePrintRecordDto,
} from './dto/print.js';

// A query string chega como texto: este pipe converte números e booleanos
// (o global só valida).
const QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: PrintItemDto,
  ) {
    return this.printService.createItem(currentUserId, dto);
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.printService.getAllItems(currentUserId);
  }

  // Antes de ':id' para "page" e "summary" não serem lidos como id.
  @Get('page')
  getPage(
    @CurrentUser('userId') currentUserId: string,
    @Query(QUERY_PIPE) query: PrintItemsPageQueryDto,
  ) {
    return this.printService.getItemsPage(currentUserId, query);
  }

  @Get('summary')
  getSummary(
    @CurrentUser('userId') currentUserId: string,
    @Query(QUERY_PIPE) query: PrintSummaryQueryDto,
  ) {
    return this.printService.getSummary(currentUserId, query);
  }

  @Get(':id')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
  ) {
    return this.printService.getItemById(itemId, currentUserId);
  }

  @Delete(':id')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
  ) {
    return this.printService.deleteItem(itemId, currentUserId);
  }

  @Post(':id/records')
  addRecord(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Body() dto: AddPrintRecordDto,
  ) {
    return this.printService.addRecord(itemId, currentUserId, dto);
  }

  @Patch(':id/records/:recordId')
  updateRecord(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdatePrintRecordDto,
  ) {
    return this.printService.updateRecord(itemId, recordId, currentUserId, dto);
  }

  @Patch(':id/records/:recordId/default')
  setDefaultRecord(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.printService.setDefaultRecord(itemId, recordId, currentUserId);
  }

  @Delete(':id/records/:recordId')
  deleteRecord(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.printService.deleteRecord(itemId, recordId, currentUserId);
  }

  // Multipart com o campo "photos". Fica em memória até o serviço conferir
  // dono e formato; só então vai para o disco.
  @Post(':id/records/:recordId/photos')
  @UseInterceptors(
    FilesInterceptor('photos', PRINT_MAX_PHOTOS, {
      storage: memoryStorage(),
      limits: { fileSize: PRINT_PHOTO_MAX_BYTES },
    }),
  )
  addPhotos(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('recordId') recordId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.printService.addPhotos(
      itemId,
      recordId,
      currentUserId,
      files ?? [],
    );
  }

  @Patch(':id/records/:recordId/photos/:photoId')
  updatePhoto(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('recordId') recordId: string,
    @Param('photoId') photoId: string,
    @Body() dto: UpdatePrintPhotoDto,
  ) {
    return this.printService.updatePhoto(
      itemId,
      recordId,
      photoId,
      currentUserId,
      dto,
    );
  }

  @Delete(':id/records/:recordId/photos/:photoId')
  deletePhoto(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') itemId: string,
    @Param('recordId') recordId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.printService.deletePhoto(
      itemId,
      recordId,
      photoId,
      currentUserId,
    );
  }
}
