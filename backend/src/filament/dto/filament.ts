import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FilamentAvailability,
  PurchaseChannel,
  SpoolLevel,
} from '../../generated/prisma/enums.js';

// Limites de tamanho: folgados para o uso real, mas impedem gravar textos
// enormes ou valores sem sentido.
export const FILAMENT_TYPE_MAX_LENGTH = 40;
export const FILAMENT_COLOR_NAME_MAX_LENGTH = 80;
export const FILAMENT_SPOOL_MAX_GRAMS = 10000;
export const FILAMENT_RATING_COMMENT_MAX_LENGTH = 200;
export const FILAMENT_NOTE_MAX_LENGTH = 2000;
// Rolos duo e tri color: até 3 cores.
export const FILAMENT_COLORS_MAX_COUNT = 3;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HEX_COLOR_MESSAGE = 'Use uma cor no formato #rrggbb.';

export class FilamentDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FILAMENT_TYPE_MAX_LENGTH)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FILAMENT_COLOR_NAME_MAX_LENGTH)
  colorName!: string;

  // Na ordem em que aparecem no degradê da amostra.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FILAMENT_COLORS_MAX_COUNT)
  @Matches(HEX_COLOR, { each: true, message: HEX_COLOR_MESSAGE })
  colors!: string[];

  @IsInt()
  @Min(1)
  @Max(FILAMENT_SPOOL_MAX_GRAMS)
  spoolWeightGrams!: number;

  // Preço pago pelo rolo inteiro.
  @IsNumber()
  @Min(0.01)
  minPricePaid!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxPricePaid?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  purchaseCount?: number;

  @IsOptional()
  @IsDateString()
  lastPurchasedAt?: string | null;

  @IsOptional()
  @IsEnum(PurchaseChannel)
  purchaseChannel?: PurchaseChannel | null;

  @IsOptional()
  @IsEnum(FilamentAvailability)
  availability?: FilamentAvailability;

  // Comprado no outlet da marca.
  @IsOptional()
  @IsBoolean()
  isOutlet?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(FILAMENT_RATING_COMMENT_MAX_LENGTH)
  ratingComment?: string | null;

  // Observação inicial: vira a primeira nota datada do filamento.
  @IsOptional()
  @IsString()
  @MaxLength(FILAMENT_NOTE_MAX_LENGTH)
  notes?: string;
}

export class UpdateFilamentDto extends PartialType(FilamentDto) {
  // Cheio, acabando ou acabou. Ao marcar FINISHED o servidor guarda a data.
  @IsOptional()
  @IsEnum(SpoolLevel)
  spoolLevel?: SpoolLevel;
}

// Mais uma compra do mesmo filamento.
export class FilamentPurchaseDto {
  @IsNumber()
  @Min(0.01)
  pricePaid!: number;

  @IsDateString()
  purchasedAt!: string;
}

export class FilamentNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(FILAMENT_NOTE_MAX_LENGTH)
  content!: string;
}
