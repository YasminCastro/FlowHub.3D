import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class PrinterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  brand!: string;

  @IsOptional()
  @IsString()
  nozzle!: string;

  @IsOptional()
  @IsString()
  extrusionType!: string;

  @IsOptional()
  @IsArray()
  filamentsTypes!: string[];

  @IsOptional()
  @IsNumber()
  powerConsumptionW!: number;

  @IsOptional()
  @IsNumber()
  energyCostPerKwh!: number;

  @IsOptional()
  @IsNumber()
  maintenanceCostPerHour!: number;

  @IsOptional()
  @IsNumber()
  purchasePrice!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  purchaseDate!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastMaintenanceDate!: Date;
}
