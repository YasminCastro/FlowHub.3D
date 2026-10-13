import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Limites folgados para o uso real, mas impedem gravar valores sem sentido.
export const EXTRA_ITEM_NAME_MAX_LENGTH = 100;
export const EXTRA_ITEM_NOTES_MAX_LENGTH = 2000;
export const EXTRA_ITEM_LOT_MAX_QUANTITY = 1_000_000;

export class ExtraItemLotDto {
  // Preço pago pelo lote inteiro.
  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsInt()
  @Min(1)
  @Max(EXTRA_ITEM_LOT_MAX_QUANTITY)
  quantity!: number;

  @IsDateString()
  purchasedAt!: string;
}

// O item nasce com o primeiro lote: sem ele não há custo unitário.
export class ExtraItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXTRA_ITEM_NAME_MAX_LENGTH)
  name!: string;

  @IsNumber()
  @Min(0.01)
  lotPrice!: number;

  @IsInt()
  @Min(1)
  @Max(EXTRA_ITEM_LOT_MAX_QUANTITY)
  lotQuantity!: number;

  // Sem data, a compra é de hoje.
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EXTRA_ITEM_NOTES_MAX_LENGTH)
  notes?: string | null;
}

// Preço e quantidade aqui corrigem o lote mais recente; uma recompra de
// verdade entra por POST /extra-item/:id/lots, que guarda o histórico.
export class UpdateExtraItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXTRA_ITEM_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  lotPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(EXTRA_ITEM_LOT_MAX_QUANTITY)
  lotQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(EXTRA_ITEM_NOTES_MAX_LENGTH)
  notes?: string | null;
}
