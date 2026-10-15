import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CalibrationGuideService,
  normalizeResults,
} from './calibration-guide.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SaveGuideProgressDto } from './dto/calibration-guide.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

function argOf(mock: AsyncMock, call = 0) {
  return mock.mock.calls[call][0] as Record<string, any>;
}

const temperatureDone = {
  values: {
    bedTempFirstLayer: 65,
    bedTemp: 60,
    nozzleTempInitial: 215,
    nozzleTemp: 210,
  },
  done: true,
};

describe('normalizeResults', () => {
  it('aceita teste concluído completo e teste em aberto com rascunho', () => {
    expect(
      normalizeResults({
        temperature: temperatureDone,
        flow: { values: { flow: 0.98 }, done: false },
        maxFlow: { values: {}, done: false },
      }),
    ).toEqual({
      temperature: temperatureDone,
      flow: { values: { flow: 0.98 }, done: false },
      maxFlow: { values: {}, done: false },
    });
  });

  it('em aberto aceita valor fora da faixa (ainda está digitando)', () => {
    expect(
      normalizeResults({
        temperature: { values: { nozzleTemp: 21 }, done: false },
      }),
    ).toEqual({ temperature: { values: { nozzleTemp: 21 }, done: false } });
  });

  it('ignora valores nulos', () => {
    expect(
      normalizeResults({ flow: { values: { flow: null }, done: false } }),
    ).toEqual({ flow: { values: {}, done: false } });
  });

  it.each([
    [{ tolerance: { values: {}, done: false } }, 'Teste desconhecido'],
    [{ flow: { values: { bedTemp: 60 }, done: false } }, 'não tem o campo'],
    [{ flow: { values: { flow: '0,98' }, done: false } }, 'deve ser um número'],
    [{ flow: { done: true } }, 'envie { values, done }'],
    [
      {
        temperature: {
          values: { ...temperatureDone.values, nozzleTemp: undefined },
          done: true,
        },
      },
      'Preencha Temperatura bico final',
    ],
    [
      {
        temperature: {
          values: { ...temperatureDone.values, bedTemp: 210 },
          done: true,
        },
      },
      'Temperatura mesa demais camadas deve ficar entre 0 e 150 °C.',
    ],
    [
      {
        temperature: {
          values: { ...temperatureDone.values, bedTemp: 60.5 },
          done: true,
        },
      },
      'deve ser um número inteiro',
    ],
  ])('recusa %j', (raw, message) => {
    expect(() => normalizeResults(raw)).toThrow(BadRequestException);
    expect(() => normalizeResults(raw)).toThrow(message);
  });
});

describe('CalibrationGuideService', () => {
  let service: CalibrationGuideService;
  let prisma: {
    calibrationGuideProgress: {
      findUnique: AsyncMock;
      upsert: AsyncMock;
      deleteMany: AsyncMock;
    };
    filament: { findFirst: AsyncMock };
    printer: { findFirst: AsyncMock };
  };

  const userId = 'user-1';
  const key = {
    filamentId: '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a',
    printerId: '7f1d2c3b-4a5e-4f60-8b71-2c3d4e5f6a7b',
    slicer: 'ORCA' as const,
  };
  const whereKey = {
    userId_filamentId_printerId_slicer: { userId, ...key },
  };

  beforeEach(async () => {
    prisma = {
      calibrationGuideProgress: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      filament: { findFirst: jest.fn() },
      printer: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalibrationGuideService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CalibrationGuideService>(CalibrationGuideService);
  });

  function ownsBoth() {
    prisma.filament.findFirst.mockResolvedValue({ id: key.filamentId });
    prisma.printer.findFirst.mockResolvedValue({ id: key.printerId });
  }

  it('busca o progresso da combinação (null quando não começou)', async () => {
    ownsBoth();
    prisma.calibrationGuideProgress.findUnique.mockResolvedValue(null);

    expect(await service.getProgress(userId, key)).toBeNull();
    expect(argOf(prisma.calibrationGuideProgress.findUnique).where).toEqual(
      whereKey,
    );
  });

  it('salva com upsert pela combinação', async () => {
    ownsBoth();
    prisma.calibrationGuideProgress.upsert.mockResolvedValue({ id: 'g-1' });
    const dto: SaveGuideProgressDto = {
      ...key,
      results: { temperature: temperatureDone },
      activeStep: 'maxFlow',
    };

    const result = await service.saveProgress(userId, dto);

    const call = argOf(prisma.calibrationGuideProgress.upsert);
    expect(call.where).toEqual(whereKey);
    expect(call.update).toEqual({
      results: { temperature: temperatureDone },
      activeStep: 'maxFlow',
    });
    expect(call.create).toMatchObject({ ...key, userId });
    expect(result.data).toEqual({ id: 'g-1' });
  });

  it('não salva resultado inválido', async () => {
    ownsBoth();

    await expect(
      service.saveProgress(userId, {
        ...key,
        results: { flow: { values: { flow: 9 }, done: true } },
        activeStep: 'flow',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.calibrationGuideProgress.upsert).not.toHaveBeenCalled();
  });

  it('responde 404 para filamento de outro usuário', async () => {
    prisma.filament.findFirst.mockResolvedValue(null);
    prisma.printer.findFirst.mockResolvedValue({ id: key.printerId });

    await expect(service.getProgress(userId, key)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('responde 404 para impressora de outro usuário', async () => {
    prisma.filament.findFirst.mockResolvedValue({ id: key.filamentId });
    prisma.printer.findFirst.mockResolvedValue(null);

    await expect(service.resetProgress(userId, key)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.calibrationGuideProgress.deleteMany).not.toHaveBeenCalled();
  });

  it('recomeçar apaga só a combinação do usuário', async () => {
    ownsBoth();
    prisma.calibrationGuideProgress.deleteMany.mockResolvedValue({ count: 1 });

    await service.resetProgress(userId, key);

    expect(argOf(prisma.calibrationGuideProgress.deleteMany)).toEqual({
      where: { userId, ...key },
    });
  });
});
