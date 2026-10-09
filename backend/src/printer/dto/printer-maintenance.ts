import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MaintenanceType } from '../../generated/prisma/enums.js';

export class PrinterMaintenanceDto {
  @IsEnum(MaintenanceType)
  type!: MaintenanceType;

  @Type(() => Date)
  @IsDate()
  date!: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  printerHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  remindAfterHours?: number;

  @IsOptional()
  @IsString()
  nozzleInstalled?: string;

  @IsOptional()
  @IsString()
  nozzleRemoved?: string;
}

export class UpdatePrinterMaintenanceDto extends PartialType(
  PrinterMaintenanceDto,
) {}
