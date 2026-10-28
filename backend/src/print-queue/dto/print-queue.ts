import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import {
  AddPrintRecordDto,
  PRINT_MAX_FILAMENTS,
  PRINT_MAX_GRAMS,
  PRINT_MAX_MINUTES,
  PRINT_MAX_UNITS,
  PRINT_NAME_MAX_LENGTH,
  PRINT_TEXT_MAX_LENGTH,
  PRINT_URL_MAX_LENGTH,
} from '../../print/dto/print.js';

// Bem acima de qualquer fila real; só impede um reorder absurdo.
export const QUEUE_MAX_ENTRIES = 1000;

// Pedidos do link público ainda pendentes. Passou disso, o link para de
// aceitar até o dono da fila dar conta (ou tirar) dos que já chegaram:
// segura quem resolver encher a fila pelo link.
export const QUEUE_MAX_PENDING_SHARE_REQUESTS = 30;

export const QUEUE_POSITIONS = ['first', 'last'] as const;
export type QueuePosition = (typeof QUEUE_POSITIONS)[number];

export class QueueFilamentDto {
  @IsUUID()
  filamentId!: string;

  // 0: filamento escolhido, gramas ainda não informadas.
  @IsNumber()
  @Min(0)
  @Max(PRINT_MAX_GRAMS)
  grams!: number;
}

export class QueueEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_NAME_MAX_LENGTH)
  name!: string;

  // Ligado a uma impressão que já existe; sem ela, é uma peça nova.
  @IsOptional()
  @IsUUID()
  printItemId?: string | null;

  @IsUUID()
  printerId!: string;

  // Gramas do lote inteiro (todas as unidades). Pode ficar vazio e ser
  // preenchido depois; o orçamento só aparece com filamento e tempo.
  @IsArray()
  @ArrayMaxSize(PRINT_MAX_FILAMENTS)
  @ValidateNested({ each: true })
  @Type(() => QueueFilamentDto)
  filaments!: QueueFilamentDto[];

  @IsInt()
  @Min(1)
  @Max(PRINT_MAX_UNITS)
  units!: number;

  // 0: ainda não informado.
  @IsInt()
  @Min(0)
  @Max(PRINT_MAX_MINUTES)
  totalMinutes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  customer?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(PRINT_URL_MAX_LENGTH)
  modelUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  note?: string | null;

  // Padrão: no fim.
  @IsOptional()
  @IsIn(QUEUE_POSITIONS)
  position?: QueuePosition;
}

// Editar troca tudo de uma vez; a posição muda pelo reorder.
export class UpdateQueueEntryDto extends OmitType(QueueEntryDto, [
  'position',
] as const) {}

// Vários itens de uma vez, na ordem em que vieram (os testes de uma
// calibração, por exemplo). Entram todos juntos no começo ou no fim.
export const QUEUE_MAX_BATCH = 20;

export class QueueBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(QUEUE_MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => UpdateQueueEntryDto)
  entries!: UpdateQueueEntryDto[];

  // Padrão: no fim.
  @IsOptional()
  @IsIn(QUEUE_POSITIONS)
  position?: QueuePosition;
}

export class ReorderQueueDto {
  // Ids dos pendentes na nova ordem.
  @IsArray()
  @ArrayMaxSize(QUEUE_MAX_ENTRIES)
  @IsUUID('all', { each: true })
  ids!: string[];
}

// Pedido pelo link público: só o que quem pede sabe. Impressora, filamento e
// tempo ficam para o dono da fila completar.
export class PublicQueueRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_NAME_MAX_LENGTH)
  name!: string;

  // Nome de quem pede; vira o "cliente" do item.
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  requesterName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  contact?: string | null;

  // Texto livre: "azul e branco", "a cor que tiver"...
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  colors!: string;

  @IsInt()
  @Min(1)
  @Max(PRINT_MAX_UNITS)
  units!: number;

  // Obrigatório no pedido: sem o modelo não há o que imprimir.
  @IsUrl({}, { message: 'O link do modelo não parece um endereço válido.' })
  @MaxLength(PRINT_URL_MAX_LENGTH)
  modelUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRINT_TEXT_MAX_LENGTH)
  note?: string | null;
}

export class NewQueueItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRINT_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

// Concluir (ou falhar) um item: onde registrar e o registro em si. Um dos
// dois destinos: printItemId (registro numa impressão existente) ou newItem
// (cria a impressão). Na falha de uma peça nova não há onde registrar, então
// só a fila fica sabendo.
export class FinishQueueEntryDto {
  @IsOptional()
  @IsUUID()
  printItemId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => NewQueueItemDto)
  newItem?: NewQueueItemDto | null;

  @ValidateNested()
  @Type(() => AddPrintRecordDto)
  record!: AddPrintRecordDto;
}
