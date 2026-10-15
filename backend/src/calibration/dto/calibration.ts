import { applyDecorators } from '@nestjs/common';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CALIBRATION_SLICERS = ['ORCA', 'CREALITY'] as const;
export type CalibrationSlicerInput = (typeof CALIBRATION_SLICERS)[number];

export const CALIBRATION_NOTES_MAX_LENGTH = 2000;

type Range = {
  label: string;
  min: number;
  max: number;
  unit?: string;
  integer?: boolean;
};

// Faixas folgadas para qualquer FDM doméstica; barram só valores sem
// sentido (fluxo 10, bico a 900 °C). O front usa as mesmas.
export const CALIBRATION_RANGES = {
  flow: { label: 'Fluxo', min: 0.5, max: 1.5 },
  nozzleTempInitial: {
    label: 'Temperatura bico inicial',
    min: 150,
    max: 350,
    unit: ' °C',
    integer: true,
  },
  nozzleTemp: {
    label: 'Temperatura bico final',
    min: 150,
    max: 350,
    unit: ' °C',
    integer: true,
  },
  bedTempFirstLayer: {
    label: 'Temperatura mesa 1ª camada',
    min: 0,
    max: 150,
    unit: ' °C',
    integer: true,
  },
  bedTemp: {
    label: 'Temperatura mesa demais camadas',
    min: 0,
    max: 150,
    unit: ' °C',
    integer: true,
  },
  pressureAdvance: { label: 'Pressure Advance', min: 0, max: 2 },
  maxVolumetricSpeed: {
    label: 'Max Volumetric Speed',
    min: 1,
    max: 100,
    unit: ' mm³/s',
  },
  retractionDistance: {
    label: 'Retração de distância',
    min: 0,
    max: 15,
    unit: ' mm',
  },
} satisfies Record<string, Range>;

// Tipo e faixa com mensagens em português, que o front mostra como vieram.
function InRange({ label, min, max, unit = '', integer }: Range) {
  const range = `${label} deve ficar entre ${min} e ${max}${unit}.`;
  return applyDecorators(
    integer
      ? IsInt({ message: `${label} deve ser um número inteiro.` })
      : IsNumber({}, { message: `${label} deve ser um número.` }),
    Min(min, { message: range }),
    Max(max, { message: range }),
  );
}

const R = CALIBRATION_RANGES;

export class CalibrationDto {
  @IsUUID()
  filamentId!: string;

  @IsUUID()
  printerId!: string;

  @IsIn(CALIBRATION_SLICERS)
  slicer!: CalibrationSlicerInput;

  @InRange(R.flow)
  flow!: number;

  @InRange(R.nozzleTempInitial)
  nozzleTempInitial!: number;

  @InRange(R.nozzleTemp)
  nozzleTemp!: number;

  @InRange(R.bedTempFirstLayer)
  bedTempFirstLayer!: number;

  @InRange(R.bedTemp)
  bedTemp!: number;

  @InRange(R.pressureAdvance)
  pressureAdvance!: number;

  @IsOptional()
  @InRange(R.maxVolumetricSpeed)
  maxVolumetricSpeed?: number | null;

  @IsOptional()
  @InRange(R.retractionDistance)
  retractionDistance?: number | null;

  @IsDateString()
  calibratedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CALIBRATION_NOTES_MAX_LENGTH)
  notes?: string | null;
}

// Corrige a versão atual no lugar. Campos omitidos ficam como estão.
export class UpdateCalibrationDto {
  @IsOptional()
  @IsUUID()
  filamentId?: string;

  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsOptional()
  @IsIn(CALIBRATION_SLICERS)
  slicer?: CalibrationSlicerInput;

  @IsOptional()
  @InRange(R.flow)
  flow?: number;

  @IsOptional()
  @InRange(R.nozzleTempInitial)
  nozzleTempInitial?: number;

  @IsOptional()
  @InRange(R.nozzleTemp)
  nozzleTemp?: number;

  @IsOptional()
  @InRange(R.bedTempFirstLayer)
  bedTempFirstLayer?: number;

  @IsOptional()
  @InRange(R.bedTemp)
  bedTemp?: number;

  @IsOptional()
  @InRange(R.pressureAdvance)
  pressureAdvance?: number;

  @IsOptional()
  @InRange(R.maxVolumetricSpeed)
  maxVolumetricSpeed?: number | null;

  @IsOptional()
  @InRange(R.retractionDistance)
  retractionDistance?: number | null;

  @IsOptional()
  @IsDateString()
  calibratedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CALIBRATION_NOTES_MAX_LENGTH)
  notes?: string | null;
}
