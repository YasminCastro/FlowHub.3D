import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PRINT_NAME_MAX_LENGTH,
  PRINT_SHORT_TEXT_MAX_LENGTH,
  PRINT_TEXT_MAX_LENGTH,
} from '../../print/dto/print.js';

// Limites folgados para o uso real, mas impedem gravar valores sem sentido.
export const CATALOG_MAX_VARIANTS = 20;
export const CATALOG_MAX_PHOTOS = 24;
export const CATALOG_MAX_PRICE = 1_000_000;

export const CATALOG_KINDS = ['SINGLE', 'SIZES', 'KIT'] as const;
export type CatalogKindInput = (typeof CATALOG_KINDS)[number];

export class CatalogVariantDto {
  // "P", "M", "G"... Só conta em SIZES.
  @IsOptional()
  @IsString()
  @MaxLength(PRINT_SHORT_TEXT_MAX_LENGTH)
  label?: string;

  @IsUUID()
  printItemId!: string;

  // null: usa o calculado. Ignorado em KIT (o preço é do kit).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(CATALOG_MAX_PRICE)
  priceOverride?: number | null;
}

// Criar e editar mandam o item inteiro; as variações e as fotos são
// substituídas pelas que vierem.
export class CatalogItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsIn(CATALOG_KINDS)
  kind!: CatalogKindInput;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CATALOG_MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => CatalogVariantDto)
  variants!: CatalogVariantDto[];

  // Só em KIT; null usa a soma do calculado das peças.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(CATALOG_MAX_PRICE)
  kitPrice?: number | null;

  // Fotos dos registros das impressões ligadas, na ordem em que aparecem.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CATALOG_MAX_PHOTOS)
  @IsUUID('all', { each: true })
  photoIds?: string[];
}
