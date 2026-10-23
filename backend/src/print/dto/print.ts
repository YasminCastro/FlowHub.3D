import { Transform, Type } from 'class-transformer';
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
export const PRINT_MAX_EXTRA_ITEMS = 16;
// Por peça: ímãs, argolas... nunca passa de algumas dezenas.
export const PRINT_MAX_EXTRA_QUANTITY = 1_000;
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

// Um dos dois, como no filamento: o item extra escolhido, ou (na edição) o uso
// que o registro já tem, para manter um item que foi excluído depois.
export class PrintExtraItemUsageDto {
  @IsOptional()
  @IsUUID()
  extraItemId?: string;

  @IsOptional()
  @IsUUID()
  usageId?: string;

  // Quantos vão em cada peça; o total multiplica pelas unidades.
  @IsInt()
  @Min(1)
  @Max(PRINT_MAX_EXTRA_QUANTITY)
  quantity!: number;
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

  // Opcional: omitido na criação, o registro fica sem itens extras; na
  // edição, mantém os que ele já tinha.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PRINT_MAX_EXTRA_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PrintExtraItemUsageDto)
  extraItems?: PrintExtraItemUsageDto[];

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

// Na edição o registro inteiro é reenviado; os filamentos (e os itens extras,
// se vierem) substituem a lista. changeSummary omitido mantém o texto atual.
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

export const PRINT_PAGE_SORTS = [
  'recent',
  'oldest',
  'units',
  'name',
  'name-desc',
] as const;
export type PrintPageSort = (typeof PRINT_PAGE_SORTS)[number];
export const PRINT_PAGE_MAX_SIZE = 100;
// "Com falha recente": alguma falha nos últimos 30 dias.
export const PRINT_RECENT_FAILURE_DAYS = 30;

// Query string da lista paginada: chega tudo como texto, por isso os @Type e o
// @Transform (o controller usa um ValidationPipe com transform).
export class PrintItemsPageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRINT_PAGE_MAX_SIZE)
  pageSize: number = 24;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_NAME_MAX_LENGTH)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  recentFailure?: boolean;

  @IsOptional()
  @IsIn(PRINT_PAGE_SORTS)
  sort: PrintPageSort = 'recent';
}

// Início do mês no fuso de quem pede: o servidor não sabe qual é.
export class PrintSummaryQueryDto {
  @IsDateString()
  monthStart!: string;
}
