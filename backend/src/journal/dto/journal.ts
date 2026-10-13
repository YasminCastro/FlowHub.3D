import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Limites folgados para o uso real, mas impedem gravar valores sem sentido.
export const JOURNAL_TITLE_MAX_LENGTH = 150;
export const JOURNAL_TEXT_MAX_LENGTH = 2000;
export const JOURNAL_ATTEMPT_MAX_LENGTH = 500;
export const JOURNAL_MAX_ATTEMPTS = 50;
export const JOURNAL_MAX_PHOTOS = 12;
export const JOURNAL_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// Só os status que o usuário escolhe; RESOLVED vem de uma tentativa WORKED.
export const JOURNAL_OPEN_STATUSES = ['IN_PROGRESS', 'UNRESOLVED'] as const;
export type JournalOpenStatus = (typeof JOURNAL_OPEN_STATUSES)[number];

export const ATTEMPT_OUTCOMES = ['WORKED', 'FAILED'] as const;
export type AttemptOutcomeInput = (typeof ATTEMPT_OUTCOMES)[number];

export class JournalAttemptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(JOURNAL_ATTEMPT_MAX_LENGTH)
  description!: string;

  // null/omitido = ainda não sabe se funcionou.
  @IsOptional()
  @IsIn(ATTEMPT_OUTCOMES)
  outcome?: AttemptOutcomeInput | null;

  @IsDateString()
  triedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(JOURNAL_ATTEMPT_MAX_LENGTH)
  note?: string | null;
}

export class JournalEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(JOURNAL_TITLE_MAX_LENGTH)
  title!: string;

  @IsDateString()
  occurredAt!: string;

  // Vale só quando nenhuma tentativa resolveu. Sem ele, em andamento.
  @IsOptional()
  @IsIn(JOURNAL_OPEN_STATUSES)
  openStatus?: JournalOpenStatus;

  @IsOptional()
  @IsUUID()
  filamentId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(JOURNAL_TEXT_MAX_LENGTH)
  symptom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(JOURNAL_TEXT_MAX_LENGTH)
  possibleCauses?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(JOURNAL_MAX_ATTEMPTS)
  @ValidateNested({ each: true })
  @Type(() => JournalAttemptDto)
  attempts?: JournalAttemptDto[];

  @IsOptional()
  @IsString()
  @MaxLength(JOURNAL_TEXT_MAX_LENGTH)
  notes?: string | null;
}

// Na edição, as tentativas enviadas substituem a lista inteira (a ordem é a
// numeração). Campos omitidos ficam como estão.
export class UpdateJournalEntryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(JOURNAL_TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsIn(JOURNAL_OPEN_STATUSES)
  openStatus?: JournalOpenStatus;

  @IsOptional()
  @IsUUID()
  filamentId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(JOURNAL_TEXT_MAX_LENGTH)
  symptom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(JOURNAL_TEXT_MAX_LENGTH)
  possibleCauses?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(JOURNAL_MAX_ATTEMPTS)
  @ValidateNested({ each: true })
  @Type(() => JournalAttemptDto)
  attempts?: JournalAttemptDto[];

  @IsOptional()
  @IsString()
  @MaxLength(JOURNAL_TEXT_MAX_LENGTH)
  notes?: string | null;
}
