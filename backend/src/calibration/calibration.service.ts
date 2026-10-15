import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CalibrationDto,
  CalibrationSlicerInput,
  UpdateCalibrationDto,
} from './dto/calibration.js';
import { Prisma } from '../generated/prisma/client.js';

const calibrationInclude = {
  filament: {
    select: {
      id: true,
      colorName: true,
      type: true,
      colors: true,
      spoolLevel: true,
      brand: { select: { name: true } },
    },
  },
  printer: { select: { id: true, name: true } },
  versions: {
    omit: { calibrationId: true, createdAt: true },
    orderBy: [{ calibratedAt: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.CalibrationInclude;

type CalibrationWithRelations = Prisma.CalibrationGetPayload<{
  include: typeof calibrationInclude;
  omit: { userId: true };
}>;

// Quantas impressões o detalhe lista.
export const CALIBRATION_PRINTS_LIMIT = 20;

// O fatiador da impressão é texto livre ("Orca", "Creality Print"); a
// calibração casa por este trecho do nome.
const SLICER_KEYWORDS: Record<CalibrationSlicerInput, string> = {
  ORCA: 'orca',
  CREALITY: 'creality',
};

const CONFLICT_MESSAGE =
  'Já existe uma calibração para esse filamento, impressora e fatiador.';

// Os valores que uma versão guarda (tudo menos o vínculo).
type CalibrationValues = Pick<
  Prisma.CalibrationVersionUncheckedCreateInput,
  | 'flow'
  | 'nozzleTempInitial'
  | 'nozzleTemp'
  | 'bedTempFirstLayer'
  | 'bedTemp'
  | 'pressureAdvance'
  | 'maxVolumetricSpeed'
  | 'retractionDistance'
  | 'notes'
  | 'calibratedAt'
>;

function pickValues(source: CalibrationValues): CalibrationValues {
  return {
    flow: source.flow,
    nozzleTempInitial: source.nozzleTempInitial,
    nozzleTemp: source.nozzleTemp,
    bedTempFirstLayer: source.bedTempFirstLayer,
    bedTemp: source.bedTemp,
    pressureAdvance: source.pressureAdvance,
    maxVolumetricSpeed: source.maxVolumetricSpeed,
    retractionDistance: source.retractionDistance,
    notes: source.notes,
    calibratedAt: source.calibratedAt,
  };
}

@Injectable()
export class CalibrationService {
  constructor(private prisma: PrismaService) {}

  // A calibração precisa ser do usuário do token. De outro usuário responde
  // 404, sem revelar que existe.
  private async findOwnedCalibration(calibrationId: string, userId: string) {
    const calibration = await this.prisma.calibration.findFirst({
      where: { id: calibrationId, userId },
      omit: { userId: true },
      include: calibrationInclude,
    });

    if (!calibration) {
      throw new NotFoundException('Calibração não encontrada.');
    }

    return calibration;
  }

  private async ensureOwnedFilament(userId: string, filamentId: string) {
    const filament = await this.prisma.filament.findFirst({
      where: { id: filamentId, userId },
      select: { id: true },
    });

    if (!filament) {
      throw new NotFoundException('Filamento não encontrado.');
    }
  }

  private async ensureOwnedPrinter(userId: string, printerId: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: printerId, userId },
      select: { id: true },
    });

    if (!printer) {
      throw new NotFoundException('Impressora não encontrada.');
    }
  }

  private normalizeNotes(value: string | null | undefined) {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  // Duas requisições com a mesma combinação ao mesmo tempo: o índice único
  // barra a segunda, e isso vira 409 em vez de 500.
  private async withComboConflict<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  private toResponse({
    filament,
    versions,
    ...calibration
  }: CalibrationWithRelations) {
    return {
      ...calibration,
      filament: {
        id: filament.id,
        colorName: filament.colorName,
        type: filament.type,
        colors: filament.colors,
        spoolLevel: filament.spoolLevel,
        brandName: filament.brand.name,
      },
      history: versions,
    };
  }

  // Impressões feitas depois da calibração, na mesma impressora, com o
  // filamento e o fatiador dela (ou sem fatiador informado).
  private async findPrints(
    calibration: CalibrationWithRelations,
    userId: string,
  ) {
    const records = await this.prisma.printRecord.findMany({
      where: {
        printerId: calibration.printerId,
        printedAt: { gte: calibration.calibratedAt },
        item: { userId },
        filaments: { some: { filamentId: calibration.filamentId } },
        OR: [
          { slicer: null },
          {
            slicer: {
              contains: SLICER_KEYWORDS[calibration.slicer],
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        printedAt: true,
        outcome: true,
        item: { select: { id: true, name: true } },
        filaments: {
          where: { filamentId: calibration.filamentId },
          select: { grams: true },
        },
      },
      orderBy: [{ printedAt: 'desc' }, { createdAt: 'desc' }],
      take: CALIBRATION_PRINTS_LIMIT,
    });

    return records.map((record) => ({
      id: record.id,
      printItemId: record.item.id,
      name: record.item.name,
      printedAt: record.printedAt,
      grams: record.filaments.reduce((sum, f) => sum + f.grams, 0),
      outcome: record.outcome,
    }));
  }

  // Salvar a mesma combinação filamento + impressora + fatiador substitui os
  // valores atuais; os anteriores vão para o histórico.
  async saveCalibration(userId: string, data: CalibrationDto) {
    await this.ensureOwnedFilament(userId, data.filamentId);
    await this.ensureOwnedPrinter(userId, data.printerId);

    const values = pickValues({
      ...data,
      maxVolumetricSpeed: data.maxVolumetricSpeed ?? null,
      retractionDistance: data.retractionDistance ?? null,
      notes: this.normalizeNotes(data.notes) ?? null,
    });

    const existing = await this.prisma.calibration.findFirst({
      where: {
        userId,
        filamentId: data.filamentId,
        printerId: data.printerId,
        slicer: data.slicer,
      },
    });

    if (existing) {
      const [, calibration] = await this.prisma.$transaction([
        this.prisma.calibrationVersion.create({
          data: { calibrationId: existing.id, ...pickValues(existing) },
        }),
        this.prisma.calibration.update({
          where: { id: existing.id },
          data: values,
          omit: { userId: true },
          include: calibrationInclude,
        }),
      ]);

      return {
        message: 'Nova versão da calibração salva com sucesso',
        data: this.toResponse(calibration),
      };
    }

    const calibration = await this.withComboConflict(() =>
      this.prisma.calibration.create({
        data: {
          ...values,
          slicer: data.slicer,
          filamentId: data.filamentId,
          printerId: data.printerId,
          userId,
        },
        omit: { userId: true },
        include: calibrationInclude,
      }),
    );

    return {
      message: 'Calibração criada com sucesso',
      data: this.toResponse(calibration),
    };
  }

  async getAllCalibrations(userId: string) {
    const calibrations = await this.prisma.calibration.findMany({
      where: { userId },
      omit: { userId: true },
      include: calibrationInclude,
      orderBy: [{ calibratedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return calibrations.map((calibration) => this.toResponse(calibration));
  }

  async getCalibrationById(calibrationId: string, userId: string) {
    const calibration = await this.findOwnedCalibration(calibrationId, userId);
    return {
      ...this.toResponse(calibration),
      prints: await this.findPrints(calibration, userId),
    };
  }

  // Corrige a versão atual no lugar, sem criar entrada no histórico.
  async updateCalibration(
    calibrationId: string,
    userId: string,
    data: UpdateCalibrationDto,
  ) {
    const current = await this.findOwnedCalibration(calibrationId, userId);
    if (data.filamentId)
      await this.ensureOwnedFilament(userId, data.filamentId);
    if (data.printerId) await this.ensureOwnedPrinter(userId, data.printerId);

    const filamentId = data.filamentId ?? current.filamentId;
    const printerId = data.printerId ?? current.printerId;
    const slicer = data.slicer ?? current.slicer;
    const comboChanged =
      filamentId !== current.filamentId ||
      printerId !== current.printerId ||
      slicer !== current.slicer;

    if (comboChanged) {
      const duplicate = await this.prisma.calibration.findFirst({
        where: {
          userId,
          filamentId,
          printerId,
          slicer,
          id: { not: calibrationId },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException(CONFLICT_MESSAGE);
    }

    const calibration = await this.withComboConflict(() =>
      this.prisma.calibration.update({
        where: { id: calibrationId },
        data: {
          ...data,
          notes: this.normalizeNotes(data.notes),
        },
        omit: { userId: true },
        include: calibrationInclude,
      }),
    );

    return {
      message: 'Calibração atualizada com sucesso',
      data: this.toResponse(calibration),
    };
  }

  async deleteCalibration(calibrationId: string, userId: string) {
    await this.findOwnedCalibration(calibrationId, userId);

    // As versões saem junto (onDelete: Cascade).
    await this.prisma.calibration.delete({ where: { id: calibrationId } });

    return { message: 'Calibração excluída com sucesso' };
  }
}
