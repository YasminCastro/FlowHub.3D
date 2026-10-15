import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CALIBRATION_RANGES } from '../calibration/dto/calibration.js';
import {
  GUIDE_STEP_FIELDS,
  GuideProgressKeyDto,
  GuideResults,
  GuideStepId,
  SaveGuideProgressDto,
} from './dto/calibration-guide.js';
import { Prisma } from '../generated/prisma/client.js';

const progressSelect = {
  id: true,
  filamentId: true,
  printerId: true,
  slicer: true,
  results: true,
  activeStep: true,
  updatedAt: true,
} satisfies Prisma.CalibrationGuideProgressSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Confere e limpa os resultados vindos da tela. Teste em aberto guarda o que
 * já foi digitado (só precisa ser número); teste concluído precisa de todos
 * os valores, dentro da mesma faixa da calibração.
 */
export function normalizeResults(raw: Record<string, unknown>): GuideResults {
  const results: GuideResults = {};

  for (const [stepId, entry] of Object.entries(raw)) {
    if (!(stepId in GUIDE_STEP_FIELDS)) {
      throw new BadRequestException(`Teste desconhecido: ${stepId}.`);
    }
    const fields: readonly string[] = GUIDE_STEP_FIELDS[stepId as GuideStepId];
    if (
      !isRecord(entry) ||
      !isRecord(entry.values) ||
      typeof entry.done !== 'boolean'
    ) {
      throw new BadRequestException(
        `Resultado inválido no teste ${stepId}: envie { values, done }.`,
      );
    }

    const values: Record<string, number> = {};
    for (const [field, value] of Object.entries(entry.values)) {
      if (!fields.includes(field)) {
        throw new BadRequestException(
          `O teste ${stepId} não tem o campo ${field}.`,
        );
      }
      if (value === null || value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException(`${field} deve ser um número.`);
      }
      values[field] = value;
    }

    if (entry.done) {
      for (const field of fields) {
        const range =
          CALIBRATION_RANGES[field as keyof typeof CALIBRATION_RANGES];
        const value = values[field];
        if (value === undefined) {
          throw new BadRequestException(
            `Preencha ${range.label} para concluir o teste.`,
          );
        }
        if (value < range.min || value > range.max) {
          const unit = 'unit' in range ? range.unit : '';
          throw new BadRequestException(
            `${range.label} deve ficar entre ${range.min} e ${range.max}${unit}.`,
          );
        }
        if ('integer' in range && range.integer && !Number.isInteger(value)) {
          throw new BadRequestException(
            `${range.label} deve ser um número inteiro.`,
          );
        }
      }
    }

    results[stepId as GuideStepId] = { values, done: entry.done };
  }

  return results;
}

@Injectable()
export class CalibrationGuideService {
  constructor(private prisma: PrismaService) {}

  // Filamento e impressora precisam ser do usuário. De outro usuário
  // responde 404, sem revelar que existem.
  private async ensureOwned(userId: string, key: GuideProgressKeyDto) {
    const [filament, printer] = await Promise.all([
      this.prisma.filament.findFirst({
        where: { id: key.filamentId, userId },
        select: { id: true },
      }),
      this.prisma.printer.findFirst({
        where: { id: key.printerId, userId },
        select: { id: true },
      }),
    ]);

    if (!filament) throw new NotFoundException('Filamento não encontrado.');
    if (!printer) throw new NotFoundException('Impressora não encontrada.');
  }

  private whereKey(userId: string, key: GuideProgressKeyDto) {
    return {
      userId_filamentId_printerId_slicer: {
        userId,
        filamentId: key.filamentId,
        printerId: key.printerId,
        slicer: key.slicer,
      },
    };
  }

  /** Progresso salvo da combinação, ou null se ainda não começou. */
  async getProgress(userId: string, key: GuideProgressKeyDto) {
    await this.ensureOwned(userId, key);
    return this.prisma.calibrationGuideProgress.findUnique({
      where: this.whereKey(userId, key),
      select: progressSelect,
    });
  }

  async saveProgress(userId: string, data: SaveGuideProgressDto) {
    await this.ensureOwned(userId, data);
    const results = normalizeResults(data.results) as Prisma.InputJsonObject;

    const progress = await this.prisma.calibrationGuideProgress.upsert({
      where: this.whereKey(userId, data),
      create: {
        filamentId: data.filamentId,
        printerId: data.printerId,
        slicer: data.slicer,
        userId,
        results,
        activeStep: data.activeStep,
      },
      update: { results, activeStep: data.activeStep },
      select: progressSelect,
    });

    return { message: 'Progresso salvo', data: progress };
  }

  // "Recomeçar": apaga o progresso da combinação. Sem progresso, não é erro.
  async resetProgress(userId: string, key: GuideProgressKeyDto) {
    await this.ensureOwned(userId, key);
    await this.prisma.calibrationGuideProgress.deleteMany({
      where: {
        userId,
        filamentId: key.filamentId,
        printerId: key.printerId,
        slicer: key.slicer,
      },
    });

    return { message: 'Progresso apagado' };
  }
}
