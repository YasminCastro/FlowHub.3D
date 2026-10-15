import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalibrationDto } from './calibration.js';

const valid = {
  filamentId: '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a',
  printerId: '7f1d2c3b-4a5e-4f60-8b71-2c3d4e5f6a7b',
  slicer: 'ORCA',
  flow: 0.97,
  nozzleTempInitial: 215,
  nozzleTemp: 210,
  bedTempFirstLayer: 65,
  bedTemp: 60,
  pressureAdvance: 0.04,
  maxVolumetricSpeed: 12,
  retractionDistance: 0.4,
  calibratedAt: '2026-10-15T12:00:00.000Z',
};

async function messagesFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CalibrationDto, body));
  return Object.fromEntries(
    errors.map((e) => [e.property, Object.values(e.constraints ?? {})]),
  );
}

describe('CalibrationDto', () => {
  it('aceita valores dentro das faixas', async () => {
    expect(await messagesFor(valid)).toEqual({});
  });

  it('responde em português com o nome do campo e a faixa', async () => {
    const messages = await messagesFor({
      ...valid,
      bedTempFirstLayer: 210,
      nozzleTemp: 60,
    });

    expect(messages).toEqual({
      bedTempFirstLayer: [
        'Temperatura mesa 1ª camada deve ficar entre 0 e 150 °C.',
      ],
      nozzleTemp: ['Temperatura bico final deve ficar entre 150 e 350 °C.'],
    });
  });

  it('exige inteiro nas temperaturas, mas aceita vazão máxima com decimal', async () => {
    const messages = await messagesFor({
      ...valid,
      bedTemp: 60.5,
      maxVolumetricSpeed: 12.5,
    });

    expect(messages).toEqual({
      bedTemp: ['Temperatura mesa demais camadas deve ser um número inteiro.'],
    });
  });

  it('deixa vazão máxima e retração em branco', async () => {
    expect(
      await messagesFor({
        ...valid,
        maxVolumetricSpeed: null,
        retractionDistance: null,
      }),
    ).toEqual({});
  });
});
