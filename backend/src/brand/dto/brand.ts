import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { BrandStatus, PurchaseChannel } from '../../generated/prisma/enums.js';

// Limites de tamanho: folgados para o uso real, mas impedem gravar textos
// ou listas enormes.
export const BRAND_NAME_MAX_LENGTH = 100;
export const BRAND_WEBSITE_MAX_LENGTH = 255;
export const BRAND_TAG_MAX_LENGTH = 40;
export const BRAND_TAGS_MAX_COUNT = 30;
export const BRAND_NOTE_MAX_LENGTH = 2000;

export class BrandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(BRAND_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(BRAND_WEBSITE_MAX_LENGTH)
  website?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(PurchaseChannel, { each: true })
  purchaseChannels?: PurchaseChannel[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(BRAND_TAG_MAX_LENGTH, { each: true })
  filamentTypes?: string[];

  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;

  // Faixa de preço por kg da pesquisa, para marcas com status RESEARCHED.
  @IsOptional()
  @IsNumber()
  @Min(0)
  researchedMinPricePerKg?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  researchedMaxPricePerKg?: number | null;

  // Texto livre: "Pastéis", "Branco", "Preto"...
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(BRAND_TAG_MAX_LENGTH, { each: true })
  preferredColors?: string[];

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  // Observação inicial: vira a primeira nota datada da marca.
  @IsOptional()
  @IsString()
  @MaxLength(BRAND_NOTE_MAX_LENGTH)
  notes?: string;
}

export class UpdateBrandDto extends PartialType(BrandDto) {
  // Arquivar tira a marca da lista sem perder o histórico.
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class BrandNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(BRAND_NOTE_MAX_LENGTH)
  content!: string;
}
