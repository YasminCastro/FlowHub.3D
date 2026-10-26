import {
  BadRequestException,
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
      brandId: true,
      brand: { select: { name: true } },
    },
  },
  brand: { select: { id: true, name: true } },
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
const GENERIC_CONFLICT_MESSAGE =
  'Já existe uma calibração genérica para essa marca e material nessa impressora e fatiador.';

// A quem a calibração vale: um filamento, ou todas as cores de uma marca e
// material (genérica).
type CalibrationTarget =
  | { filamentId: string; brandId: null; filamentType: null }
  | { filamentId: null; brandId: string; filamentType: string };

type TargetInput = {
  filamentId?: string | null;
  brandId?: string | null;
  filamentType?: string | null;
};

// Filamento coberto por uma genérica, como a resposta mostra.
const coveredFilamentSelect = {
  id: true,
  colorName: true,
  colors: true,
  spoolLevel: true,
} satisfies Prisma.FilamentSelect;

type CoveredFilament = Prisma.FilamentGetPayload<{
  select: typeof coveredFilamentSelect;
}>;

// O material é texto livre: "PLA" e "pla" são o mesmo.
function sameType(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

function targetOf(calibration: {
  filamentId: string | null;
  brandId: string | null;
  filamentType: string | null;
}): CalibrationTarget {
  return calibration.filamentId
    ? { filamentId: calibration.filamentId, brandId: null, filamentType: null }
    : {
        filamentId: null,
        brandId: calibration.brandId!,
        filamentType: calibration.filamentType!,
      };
}

// Onde procurar a mesma combinação (vínculo + impressora + fatiador).
function comboWhere(
  userId: string,
  target: CalibrationTarget,
  printerId: string,
  slicer: CalibrationSlicerInput,
): Prisma.CalibrationWhereInput {
  return {
    userId,
    printerId,
    slicer,
    ...(target.filamentId
      ? { filamentId: target.filamentId }
      : {
          filamentId: null,
          brandId: target.brandId,
          filamentType: { equals: target.filamentType, mode: 'insensitive' },
        }),
  };
}

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

  // Específica pelo filamento, ou genérica por marca + material. Na genérica
  // o material é gravado como está num filamento da marca, o que também
  // confirma que a marca é do usuário.
  private async resolveTarget(
    userId: string,
    { filamentId, brandId, filamentType }: TargetInput,
  ): Promise<CalibrationTarget> {
    const type = filamentType?.trim();

    if (filamentId) {
      if (brandId || type) {
        throw new BadRequestException(
          'Escolha um filamento ou uma marca e material, não os dois.',
        );
      }
      await this.ensureOwnedFilament(userId, filamentId);
      return { filamentId, brandId: null, filamentType: null };
    }

    if (!brandId || !type) {
      throw new BadRequestException(
        'Escolha o filamento, ou a marca e o material.',
      );
    }

    const filament = await this.prisma.filament.findFirst({
      where: { userId, brandId, type: { equals: type, mode: 'insensitive' } },
      select: { type: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!filament) {
      throw new NotFoundException(
        'Nenhum filamento dessa marca com esse material.',
      );
    }

    return { filamentId: null, brandId, filamentType: filament.type };
  }

  // Filamentos que cada genérica cobre: os da marca com o mesmo material,
  // menos os que têm calibração específica na mesma impressora e fatiador.
  private async findCoveredFilaments(
    userId: string,
    calibrations: CalibrationWithRelations[],
  ) {
    const covered = new Map<string, CoveredFilament[]>();
    const generics = calibrations.filter((c) => c.brandId);
    if (!generics.length) return covered;

    const brandIds = [...new Set(generics.map((c) => c.brandId!))];
    const [filaments, specifics] = await Promise.all([
      this.prisma.filament.findMany({
        where: { userId, brandId: { in: brandIds } },
        select: { ...coveredFilamentSelect, brandId: true, type: true },
        orderBy: { colorName: 'asc' },
      }),
      this.prisma.calibration.findMany({
        where: { userId, filament: { brandId: { in: brandIds } } },
        select: { filamentId: true, printerId: true, slicer: true },
      }),
    ]);

    const comboKey = (filamentId: string, printerId: string, slicer: string) =>
      `${filamentId}|${printerId}|${slicer}`;
    const overridden = new Set(
      specifics.map((s) => comboKey(s.filamentId!, s.printerId, s.slicer)),
    );

    for (const generic of generics) {
      covered.set(
        generic.id,
        filaments
          .filter(
            (f) =>
              f.brandId === generic.brandId &&
              sameType(f.type, generic.filamentType) &&
              !overridden.has(
                comboKey(f.id, generic.printerId, generic.slicer),
              ),
          )
          .map(({ id, colorName, colors, spoolLevel }) => ({
            id,
            colorName,
            colors,
            spoolLevel,
          })),
      );
    }

    return covered;
  }

  private async toResponses(
    userId: string,
    calibrations: CalibrationWithRelations[],
  ) {
    const covered = await this.findCoveredFilaments(userId, calibrations);
    return calibrations.map((calibration) =>
      this.toResponse(calibration, covered.get(calibration.id) ?? []),
    );
  }

  private normalizeNotes(value: string | null | undefined) {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  // Duas requisições com a mesma combinação ao mesmo tempo: o índice único
  // barra a segunda, e isso vira 409 em vez de 500.
  private async withComboConflict<T>(
    target: CalibrationTarget,
    operation: () => Promise<T>,
  ) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.conflict(target);
      }
      throw error;
    }
  }

  private conflict(target: CalibrationTarget) {
    return new ConflictException(
      target.filamentId ? CONFLICT_MESSAGE : GENERIC_CONFLICT_MESSAGE,
    );
  }

  // A específica vem com "filament"; a genérica, com "group": marca,
  // material e os filamentos que ela cobre.
  private toResponse(
    { filament, brand, versions, ...calibration }: CalibrationWithRelations,
    covered: CoveredFilament[],
  ) {
    return {
      ...calibration,
      filament: filament && {
        id: filament.id,
        colorName: filament.colorName,
        type: filament.type,
        colors: filament.colors,
        spoolLevel: filament.spoolLevel,
        brandId: filament.brandId,
        brandName: filament.brand.name,
      },
      group: brand && {
        brandId: brand.id,
        brandName: brand.name,
        type: calibration.filamentType!,
        filaments: covered,
      },
      history: versions,
    };
  }

  // Impressões feitas depois da calibração, na mesma impressora, com um dos
  // filamentos dela e o fatiador dela (ou sem fatiador informado).
  private async findPrints(
    calibration: CalibrationWithRelations,
    filamentIds: string[],
    userId: string,
  ) {
    if (!filamentIds.length) return [];

    const records = await this.prisma.printRecord.findMany({
      where: {
        printerId: calibration.printerId,
        printedAt: { gte: calibration.calibratedAt },
        item: { userId },
        filaments: { some: { filamentId: { in: filamentIds } } },
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
          where: { filamentId: { in: filamentIds } },
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

  // Salvar a mesma combinação vínculo + impressora + fatiador substitui os
  // valores atuais; os anteriores vão para o histórico.
  async saveCalibration(userId: string, data: CalibrationDto) {
    const target = await this.resolveTarget(userId, data);
    await this.ensureOwnedPrinter(userId, data.printerId);

    const values = pickValues({
      ...data,
      maxVolumetricSpeed: data.maxVolumetricSpeed ?? null,
      retractionDistance: data.retractionDistance ?? null,
      notes: this.normalizeNotes(data.notes) ?? null,
    });

    const existing = await this.prisma.calibration.findFirst({
      where: comboWhere(userId, target, data.printerId, data.slicer),
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

      const [response] = await this.toResponses(userId, [calibration]);
      return {
        message: 'Nova versão da calibração salva com sucesso',
        data: response,
      };
    }

    const calibration = await this.withComboConflict(target, () =>
      this.prisma.calibration.create({
        data: {
          ...values,
          ...target,
          slicer: data.slicer,
          printerId: data.printerId,
          userId,
        },
        omit: { userId: true },
        include: calibrationInclude,
      }),
    );

    const [response] = await this.toResponses(userId, [calibration]);
    return {
      message: 'Calibração criada com sucesso',
      data: response,
    };
  }

  async getAllCalibrations(userId: string) {
    const calibrations = await this.prisma.calibration.findMany({
      where: { userId },
      omit: { userId: true },
      include: calibrationInclude,
      orderBy: [{ calibratedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return this.toResponses(userId, calibrations);
  }

  async getCalibrationById(calibrationId: string, userId: string) {
    const calibration = await this.findOwnedCalibration(calibrationId, userId);
    const [response] = await this.toResponses(userId, [calibration]);
    const filamentIds = calibration.filamentId
      ? [calibration.filamentId]
      : (response.group?.filaments.map((f) => f.id) ?? []);
    return {
      ...response,
      prints: await this.findPrints(calibration, filamentIds, userId),
    };
  }

  // Corrige a versão atual no lugar, sem criar entrada no histórico.
  async updateCalibration(
    calibrationId: string,
    userId: string,
    data: UpdateCalibrationDto,
  ) {
    const current = await this.findOwnedCalibration(calibrationId, userId);
    const { filamentId, brandId, filamentType, ...fields } = data;

    // Mandar o mesmo vínculo de volta não revalida: a genérica continua
    // editável mesmo sem nenhum filamento da marca e material no estoque.
    const targetSent =
      filamentId !== undefined ||
      brandId !== undefined ||
      filamentType !== undefined;
    const targetChanged =
      targetSent &&
      ((filamentId ?? null) !== current.filamentId ||
        (brandId ?? null) !== current.brandId ||
        !sameType(filamentType, current.filamentType));
    const target = targetChanged
      ? await this.resolveTarget(userId, { filamentId, brandId, filamentType })
      : targetOf(current);
    if (data.printerId) await this.ensureOwnedPrinter(userId, data.printerId);

    const printerId = data.printerId ?? current.printerId;
    const slicer = data.slicer ?? current.slicer;
    const comboChanged =
      targetChanged ||
      printerId !== current.printerId ||
      slicer !== current.slicer;

    if (comboChanged) {
      const duplicate = await this.prisma.calibration.findFirst({
        where: {
          ...comboWhere(userId, target, printerId, slicer),
          id: { not: calibrationId },
        },
        select: { id: true },
      });
      if (duplicate) throw this.conflict(target);
    }

    const calibration = await this.withComboConflict(target, () =>
      this.prisma.calibration.update({
        where: { id: calibrationId },
        data: {
          ...fields,
          ...(targetChanged ? target : {}),
          notes: this.normalizeNotes(data.notes),
        },
        omit: { userId: true },
        include: calibrationInclude,
      }),
    );

    const [response] = await this.toResponses(userId, [calibration]);
    return {
      message: 'Calibração atualizada com sucesso',
      data: response,
    };
  }

  async deleteCalibration(calibrationId: string, userId: string) {
    await this.findOwnedCalibration(calibrationId, userId);

    // As versões saem junto (onDelete: Cascade).
    await this.prisma.calibration.delete({ where: { id: calibrationId } });

    return { message: 'Calibração excluída com sucesso' };
  }
}
