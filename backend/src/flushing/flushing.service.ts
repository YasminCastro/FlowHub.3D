import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FlushPairDto, UpdateFlushPairDto } from './dto/flushing.js';
import { CalibrationSlicerInput } from '../calibration/dto/calibration.js';
import { Prisma } from '../generated/prisma/client.js';

const filamentSelect = {
  id: true,
  colorName: true,
  type: true,
  colors: true,
  brand: { select: { name: true } },
} satisfies Prisma.FilamentSelect;

const pairInclude = {
  filamentA: { select: filamentSelect },
  filamentB: { select: filamentSelect },
  printer: { select: { id: true, name: true } },
} satisfies Prisma.FlushPairInclude;

const CONFLICT_MESSAGE =
  'Já existe um registro de flushing para esses dois filamentos nessa impressora e fatiador.';

type PairKey = {
  filamentAId: string;
  filamentBId: string;
  printerId: string;
  slicer: CalibrationSlicerInput;
};

@Injectable()
export class FlushingService {
  constructor(private prisma: PrismaService) {}

  // Filamentos e impressora precisam ser do usuário. De outro usuário
  // responde 404, sem revelar que existem.
  private async ensureOwned(userId: string, key: PairKey) {
    if (key.filamentAId === key.filamentBId) {
      throw new BadRequestException('Escolha dois filamentos diferentes.');
    }
    const [filamentCount, printer] = await Promise.all([
      this.prisma.filament.count({
        where: { id: { in: [key.filamentAId, key.filamentBId] }, userId },
      }),
      this.prisma.printer.findFirst({
        where: { id: key.printerId, userId },
        select: { id: true },
      }),
    ]);

    if (filamentCount !== 2) {
      throw new NotFoundException('Filamento não encontrado.');
    }
    if (!printer) throw new NotFoundException('Impressora não encontrada.');
  }

  // A + B e B + A são o mesmo par; a chave única só pega uma das ordens.
  private async ensureUnique(userId: string, key: PairKey, exceptId?: string) {
    const existing = await this.prisma.flushPair.findFirst({
      where: {
        userId,
        printerId: key.printerId,
        slicer: key.slicer,
        id: exceptId ? { not: exceptId } : undefined,
        OR: [
          { filamentAId: key.filamentAId, filamentBId: key.filamentBId },
          { filamentAId: key.filamentBId, filamentBId: key.filamentAId },
        ],
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException(CONFLICT_MESSAGE);
  }

  private async findOwned(pairId: string, userId: string) {
    const pair = await this.prisma.flushPair.findFirst({
      where: { id: pairId, userId },
      include: pairInclude,
      omit: { userId: true },
    });
    if (!pair)
      throw new NotFoundException('Registro de flushing não encontrado.');
    return pair;
  }

  async getAllPairs(userId: string) {
    return this.prisma.flushPair.findMany({
      where: { userId },
      include: pairInclude,
      omit: { userId: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPairById(pairId: string, userId: string) {
    return this.findOwned(pairId, userId);
  }

  async createPair(userId: string, data: FlushPairDto) {
    await this.ensureOwned(userId, data);
    await this.ensureUnique(userId, data);

    try {
      const pair = await this.prisma.flushPair.create({
        data: { ...data, userId },
        include: pairInclude,
        omit: { userId: true },
      });
      return { message: 'Flushing salvo', data: pair };
    } catch (error) {
      throw this.mapConflict(error);
    }
  }

  async updatePair(pairId: string, userId: string, data: UpdateFlushPairDto) {
    const current = await this.findOwned(pairId, userId);
    const key: PairKey = {
      filamentAId: data.filamentAId ?? current.filamentAId,
      filamentBId: data.filamentBId ?? current.filamentBId,
      printerId: data.printerId ?? current.printerId,
      slicer: data.slicer ?? current.slicer,
    };
    await this.ensureOwned(userId, key);
    await this.ensureUnique(userId, key, pairId);

    try {
      const pair = await this.prisma.flushPair.update({
        where: { id: pairId },
        data,
        include: pairInclude,
        omit: { userId: true },
      });
      return { message: 'Flushing atualizado', data: pair };
    } catch (error) {
      throw this.mapConflict(error);
    }
  }

  async deletePair(pairId: string, userId: string) {
    await this.findOwned(pairId, userId);
    await this.prisma.flushPair.delete({ where: { id: pairId } });
    return { message: 'Flushing excluído' };
  }

  // Dois salvamentos ao mesmo tempo passam pelo ensureUnique; a chave única
  // barra o segundo.
  private mapConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(CONFLICT_MESSAGE);
    }
    return error;
  }
}
