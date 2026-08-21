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
  @IsDate()
  purchaseDate!: Date;

  @IsOptional()
  @IsDate()
  lastMaintenanceDate!: Date;
}
