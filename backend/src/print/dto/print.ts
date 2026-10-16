import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Limites folgados para o uso real, mas impedem gravar valores sem sentido.
export const PRINT_NAME_MAX_LENGTH = 120;
export const PRINT_URL_MAX_LENGTH = 500;
export const PRINT_TEXT_MAX_LENGTH = 500;
export const PRINT_SHORT_TEXT_MAX_LENGTH = 60;
export const PRINT_MAX_FILAMENTS = 16;
export const PRINT_MAX_UNITS = 10_000;
// Uma semana de impressão contínua.
export const PRINT_MAX_MINUTES = 7 * 24 * 60;
export const PRINT_MAX_GRAMS = 100_000;
export const PRINT_MAX_PHOTOS = 12;
export const PRINT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const PRINT_OUTCOMES = ['SUCCESS', 'FAILURE'] as const;
export type PrintOutcomeInput = (typeof PRINT_OUTCOMES)[number];

// Um dos dois: o filamento escolhido, ou (na edição) o uso que o registro já
// tem, para manter um filamento que foi excluído depois.
export class PrintFilamentUsageDto {
  @IsOptional()
  @IsUUID()
  filamentId?: string;

  @IsOptional()
  @IsUUID()
  usageId?: string;

  // Na falha, o que foi gasto até parar (pode ser zero).
  @IsNumber()
  @Min(0)
  @Max(PRINT_MAX_GRAMS)
  grams!: number;
}

export class SlicerSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_SHORT_TEXT_MAX_LENGTH)
  slicer!: string;

  @IsNumber()
  @Min(0.01)
  @Max(5)
  layerHeightMm!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  infillPercent!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_SHORT_TEXT_MAX_LENGTH)
  infillPattern!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  walls!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  temperatureC?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  extras?: string;
}

export class PrintRecordDto {
  @IsDateString()
  printedAt!: string;

  @IsUUID()
  printerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PRINT_MAX_FILAMENTS)
  @ValidateNested({ each: true })
  @Type(() => PrintFilamentUsageDto)
  filaments!: PrintFilamentUsageDto[];

  @IsInt()
  @Min(1)
  @Max(PRINT_MAX_UNITS)
  units!: number;

  @IsInt()
  @Min(0)
  @Max(PRINT_MAX_MINUTES)
  totalMinutes!: number;

  // Opcional: sem ela o registro fica sem configuração do fatiador.
  @IsOptional()
  @ValidateNested()
  @Type(() => SlicerSettingsDto)
  settings?: SlicerSettingsDto | null;

  @IsIn(PRINT_OUTCOMES)
  outcome!: PrintOutcomeInput;

  // Obrigatório na falha; ignorado no sucesso.
  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  failureReason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  changeSummary?: string | null;
}

// Novo registro dentro de uma peça que já existe.
export class AddPrintRecordDto extends PrintRecordDto {
  // Só vale para registro com sucesso.
  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean;
}

// Na edição o registro inteiro é reenviado; os filamentos enviados substituem
// a lista. changeSummary omitido mantém o texto atual.
export class UpdatePrintRecordDto extends AddPrintRecordDto {}

// Enquadramento da foto: o ponto (em %) que fica no centro do recorte, ou a
// foto inteira.
export class UpdatePrintPhotoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  focusX: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  focusY: number;

  @IsBoolean()
  contain: boolean;
}

// A peça nasce com a primeira impressão, que vira o registro padrão.
export class PrintItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(PRINT_URL_MAX_LENGTH)
  modelUrl?: string | null;

  @IsOptional()
  @IsUUID()
  derivedFromId?: string | null;

  @ValidateNested()
  @Type(() => PrintRecordDto)
  firstRecord!: PrintRecordDto;
}
