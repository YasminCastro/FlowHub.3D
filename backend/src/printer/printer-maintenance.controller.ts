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
import {
  PrinterMaintenanceDto,
  UpdatePrinterMaintenanceDto,
} from './dto/printer-maintenance.js';
import { PrinterMaintenanceService } from './printer-maintenance.service.js';

@Controller('printer/:printerId/maintenance')
export class PrinterMaintenanceController {
  constructor(
    private readonly printerMaintenanceService: PrinterMaintenanceService,
  ) {}

  @Post()
  post(
    @CurrentUser('userId') currentUserId: string,
    @Param('printerId') printerId: string,
    @Body() dto: PrinterMaintenanceDto,
  ) {
    return this.printerMaintenanceService.registerMaintenance(
      printerId,
      currentUserId,
      dto,
    );
  }

  @Get()
  getAll(
    @CurrentUser('userId') currentUserId: string,
    @Param('printerId') printerId: string,
  ) {
    return this.printerMaintenanceService.getMaintenances(
      printerId,
      currentUserId,
    );
  }

  @Get(':maintenanceId')
  getById(
    @CurrentUser('userId') currentUserId: string,
    @Param('printerId') printerId: string,
    @Param('maintenanceId') maintenanceId: string,
  ) {
    return this.printerMaintenanceService.getMaintenanceById(
      printerId,
      maintenanceId,
      currentUserId,
    );
  }

  @Patch(':maintenanceId')
  update(
    @CurrentUser('userId') currentUserId: string,
    @Param('printerId') printerId: string,
    @Param('maintenanceId') maintenanceId: string,
    @Body() dto: UpdatePrinterMaintenanceDto,
  ) {
    return this.printerMaintenanceService.updateMaintenance(
      printerId,
      maintenanceId,
      currentUserId,
      dto,
    );
  }

  @Delete(':maintenanceId')
  delete(
    @CurrentUser('userId') currentUserId: string,
    @Param('printerId') printerId: string,
    @Param('maintenanceId') maintenanceId: string,
  ) {
    return this.printerMaintenanceService.deleteMaintenance(
      printerId,
      maintenanceId,
      currentUserId,
    );
  }
}
