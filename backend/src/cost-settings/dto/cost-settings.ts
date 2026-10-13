import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const COST_SETTINGS_CURRENCIES = ['BRL'] as const;

// Limites folgados para o uso real, mas impedem gravar valores sem sentido.
const MAX_MONEY = 1_000_000;
const MAX_PERCENT = 1000;
const MAX_PREP_MINUTES = 24 * 60;
const MAX_PRINTER_TARIFFS = 500;

export class PrinterTariffDto {
  @IsString()
  printerId!: string;

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  energyCostPerKwh!: number;
}

// Substitui a configuração inteira. As impressoras fora de printerTariffs
// passam a herdar a tarifa global.
export class CostSettingsDto {
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  energyCostPerKwh!: number;

  @IsIn(COST_SETTINGS_CURRENCIES)
  currency!: string;

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  laborCostPerHour!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_PREP_MINUTES)
  prepMinutesPerPiece!: number;

  @IsNumber()
  @Min(0)
  @Max(MAX_PERCENT)
  defaultMarginPercent!: number;

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  packagingCost!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  failureReservePercent!: number;

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  otherFixedCost!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRINTER_TARIFFS)
  @ValidateNested({ each: true })
  @Type(() => PrinterTariffDto)
  printerTariffs?: PrinterTariffDto[];
}
