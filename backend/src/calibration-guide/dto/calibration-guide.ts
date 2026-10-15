import { IsIn, IsObject, IsUUID } from 'class-validator';

import {
  CALIBRATION_RANGES,
  CALIBRATION_SLICERS,
  type CalibrationSlicerInput,
} from '../../calibration/dto/calibration.js';

// Os testes do guia, na ordem da tela, e os valores que cada um anota. Cada
// campo é um valor da calibração e usa a mesma faixa dela.
export const GUIDE_STEP_FIELDS = {
  temperature: [
    'bedTempFirstLayer',
    'bedTemp',
    'nozzleTempInitial',
    'nozzleTemp',
  ],
  maxFlow: ['maxVolumetricSpeed'],
  pressureAdvance: ['pressureAdvance'],
  flow: ['flow'],
  retraction: ['retractionDistance'],
} as const satisfies Record<string, (keyof typeof CALIBRATION_RANGES)[]>;

export type GuideStepId = keyof typeof GUIDE_STEP_FIELDS;
export const GUIDE_STEPS = Object.keys(GUIDE_STEP_FIELDS) as GuideStepId[];

export type GuideStepResult = {
  values: Record<string, number>;
  done: boolean;
};
export type GuideResults = Partial<Record<GuideStepId, GuideStepResult>>;

// Identifica o progresso: um por filamento + impressora + fatiador.
export class GuideProgressKeyDto {
  @IsUUID()
  filamentId!: string;

  @IsUUID()
  printerId!: string;

  @IsIn(CALIBRATION_SLICERS)
  slicer!: CalibrationSlicerInput;
}

export class SaveGuideProgressDto extends GuideProgressKeyDto {
  // A forma interna ({ passo: { values, done } }) é conferida no serviço,
  // contra GUIDE_STEP_FIELDS.
  @IsObject()
  results!: Record<string, unknown>;

  @IsIn(GUIDE_STEPS)
  activeStep!: GuideStepId;
}
