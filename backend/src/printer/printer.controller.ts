import { PrinterService } from './printer.service.js';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PrinterDto } from './dto/printer.js';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post()
  post(@CurrentUser('userId') currentUserId: string, @Body() dto: PrinterDto) {
    return this.printerService.createPrinter({
      ...dto,
      userId: currentUserId,
    });
  }

  @Get()
  getAll(@CurrentUser('userId') currentUserId: string) {
    return this.printerService.getAllPrinters(currentUserId);
  }

  @Get(':id')
  getById(@Param('id') printerId: string) {
    return this.printerService.getPrinterById(printerId);
  }

  @Patch(':id')
  async update(@Param('id') printerId: string, @Body() dto: PrinterDto) {
    return await this.printerService.updatePrinter(printerId, dto);
  }

  @Delete(':id')
  async delete(@Param('id') printerId: string) {
    return await this.printerService.deletePrinter(printerId);
  }
}
