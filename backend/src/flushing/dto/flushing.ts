import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import {
  CALIBRATION_SLICERS,
  type CalibrationSlicerInput,
} from '../../calibration/dto/calibration.js';

// Mesmas faixas da tabela do fatiador. O front usa as mesmas.
export const FLUSH_VOLUME_MAX = 20000;
export const FLUSH_MULTIPLIER_MAX = 3;

const volumeRange = `O volume deve ficar entre 0 e ${FLUSH_VOLUME_MAX} mm³.`;
const multiplierRange = `O multiplicador deve ficar entre 0 e ${FLUSH_MULTIPLIER_MAX}.`;

// Os valores da tabela do par. Todos opcionais: null deixa em branco.
class FlushPairValuesDto {
  @IsOptional()
  @IsInt({ message: 'O volume deve ser um número inteiro.' })
  @Min(0, { message: volumeRange })
  @Max(FLUSH_VOLUME_MAX, { message: volumeRange })
  volumeAToB?: number | null;

  @IsOptional()
  @IsInt({ message: 'O volume deve ser um número inteiro.' })
  @Min(0, { message: volumeRange })
  @Max(FLUSH_VOLUME_MAX, { message: volumeRange })
  volumeBToA?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'O Color Multiplier deve ser um número.' })
  @Min(0, { message: multiplierRange })
  @Max(FLUSH_MULTIPLIER_MAX, { message: multiplierRange })
  colorMultiplierA?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'O Color Multiplier deve ser um número.' })
  @Min(0, { message: multiplierRange })
  @Max(FLUSH_MULTIPLIER_MAX, { message: multiplierRange })
  colorMultiplierB?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'O Multiplier deve ser um número.' })
  @Min(0, { message: multiplierRange })
  @Max(FLUSH_MULTIPLIER_MAX, { message: multiplierRange })
  multiplier?: number | null;
}

export class FlushPairDto extends FlushPairValuesDto {
  @IsUUID('all', { message: 'Escolha o primeiro filamento.' })
  filamentAId!: string;

  @IsUUID('all', { message: 'Escolha o segundo filamento.' })
  filamentBId!: string;

  @IsUUID('all', { message: 'Escolha a impressora.' })
  printerId!: string;

  @IsIn(CALIBRATION_SLICERS)
  slicer!: CalibrationSlicerInput;
}

// Campos omitidos ficam como estão.
export class UpdateFlushPairDto extends FlushPairValuesDto {
  @IsOptional()
  @IsUUID()
  filamentAId?: string;

  @IsOptional()
  @IsUUID()
  filamentBId?: string;

  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsOptional()
  @IsIn(CALIBRATION_SLICERS)
  slicer?: CalibrationSlicerInput;
}
