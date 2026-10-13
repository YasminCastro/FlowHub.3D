import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  JOURNAL_MAX_PHOTOS,
  JournalAttemptDto,
  JournalEntryDto,
  JournalOpenStatus,
  UpdateJournalEntryDto,
} from './dto/journal.js';
import {
  JournalPhotoStorage,
  detectImageExtension,
  journalPhotoUrl,
} from './journal-photo-storage.js';
import { JournalStatus, Prisma } from '../generated/prisma/client.js';

const entryInclude = {
  filament: {
    select: {
      id: true,
      colorName: true,
      type: true,
      colors: true,
      brand: { select: { name: true } },
    },
  },
  attempts: {
    select: {
      id: true,
      description: true,
      outcome: true,
      triedAt: true,
      note: true,
    },
    orderBy: { position: 'asc' },
  },
  photos: {
    select: { id: true, filename: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.JournalEntryInclude;

type EntryWithRelations = Prisma.JournalEntryGetPayload<{
  include: typeof entryInclude;
  omit: { userId: true };
}>;

export type UploadedPhoto = { buffer: Buffer };

// Uma tentativa que funcionou fecha o caso; sem ela, vale o status aberto
// escolhido.
export function deriveStatus(
  attempts: { outcome?: string | null }[],
  openStatus: JournalOpenStatus,
): JournalStatus {
  return attempts.some((attempt) => attempt.outcome === 'WORKED')
    ? 'RESOLVED'
    : openStatus;
}

@Injectable()
export class JournalService {
  constructor(
    private prisma: PrismaService,
    private photoStorage: JournalPhotoStorage,
  ) {}

  // A entrada precisa ser do usuário do token. De outro usuário responde 404,
  // sem revelar que existe.
  private async findOwnedEntry(entryId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, userId },
      omit: { userId: true },
      include: entryInclude,
    });

    if (!entry) {
      throw new NotFoundException('Entrada do diário não encontrada.');
    }

    return entry;
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

  // "   " passa no @IsNotEmpty, mas vira texto vazio depois do trim.
  private requireText(value: string, message: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(message);
    return trimmed;
  }

  private normalizeOptional(value: string | null | undefined) {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  // Só uma tentativa resolve o problema; as em branco são descartadas.
  private normalizeAttempts(attempts: JournalAttemptDto[]) {
    const filled = attempts
      .map((attempt) => ({
        ...attempt,
        description: attempt.description.trim(),
      }))
      .filter((attempt) => attempt.description);

    if (filled.filter((a) => a.outcome === 'WORKED').length > 1) {
      throw new BadRequestException(
        'Só uma tentativa pode ser a que resolveu o problema.',
      );
    }

    return filled.map((attempt, position) => ({
      position,
      description: attempt.description,
      outcome: attempt.outcome ?? null,
      triedAt: attempt.triedAt,
      note: this.normalizeOptional(attempt.note) ?? null,
    }));
  }

  private toResponse({ filament, photos, ...entry }: EntryWithRelations) {
    return {
      ...entry,
      filament: filament && {
        id: filament.id,
        colorName: filament.colorName,
        type: filament.type,
        colors: filament.colors,
        brandName: filament.brand.name,
      },
      photos: photos.map((photo) => ({
        id: photo.id,
        url: journalPhotoUrl(photo.filename),
      })),
    };
  }

  async createEntry(userId: string, data: JournalEntryDto) {
    if (data.filamentId)
      await this.ensureOwnedFilament(userId, data.filamentId);
    const attempts = this.normalizeAttempts(data.attempts ?? []);

    const entry = await this.prisma.journalEntry.create({
      data: {
        title: this.requireText(data.title, 'Dê um título para o problema.'),
        occurredAt: data.occurredAt,
        status: deriveStatus(attempts, data.openStatus ?? 'IN_PROGRESS'),
        symptom: this.requireText(data.symptom, 'Descreva o sintoma.'),
        possibleCauses: data.possibleCauses?.trim() ?? '',
        notes: this.normalizeOptional(data.notes) ?? null,
        filamentId: data.filamentId ?? null,
        userId,
        attempts: { create: attempts },
      },
      omit: { userId: true },
      include: entryInclude,
    });

    return {
      message: 'Entrada do diário criada com sucesso',
      data: this.toResponse(entry),
    };
  }

  async getAllEntries(userId: string) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { userId },
      omit: { userId: true },
      include: entryInclude,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return entries.map((entry) => this.toResponse(entry));
  }

  async getEntryById(entryId: string, userId: string) {
    return this.toResponse(await this.findOwnedEntry(entryId, userId));
  }

  async updateEntry(
    entryId: string,
    userId: string,
    data: UpdateJournalEntryDto,
  ) {
    const current = await this.findOwnedEntry(entryId, userId);
    if (data.filamentId)
      await this.ensureOwnedFilament(userId, data.filamentId);

    const attempts =
      data.attempts !== undefined
        ? this.normalizeAttempts(data.attempts)
        : undefined;

    // Sem status aberto no corpo, mantém o atual (RESOLVED volta para em
    // andamento se a tentativa que resolveu deixar de existir).
    const openStatus =
      data.openStatus ??
      (current.status === 'UNRESOLVED' ? 'UNRESOLVED' : 'IN_PROGRESS');

    const entry = await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        title:
          data.title !== undefined
            ? this.requireText(data.title, 'Dê um título para o problema.')
            : undefined,
        occurredAt: data.occurredAt,
        status: deriveStatus(attempts ?? current.attempts, openStatus),
        symptom:
          data.symptom !== undefined
            ? this.requireText(data.symptom, 'Descreva o sintoma.')
            : undefined,
        possibleCauses: data.possibleCauses?.trim(),
        notes: this.normalizeOptional(data.notes),
        filamentId: data.filamentId,
        ...(attempts && {
          attempts: { deleteMany: {}, create: attempts },
        }),
      },
      omit: { userId: true },
      include: entryInclude,
    });

    return {
      message: 'Entrada do diário atualizada com sucesso',
      data: this.toResponse(entry),
    };
  }

  async deleteEntry(entryId: string, userId: string) {
    const entry = await this.findOwnedEntry(entryId, userId);

    // Tentativas e fotos saem junto (onDelete: Cascade); os arquivos, depois
    // que o banco confirmou.
    await this.prisma.journalEntry.delete({ where: { id: entryId } });
    await this.removeFiles(entry.photos.map((photo) => photo.filename));

    return { message: 'Entrada do diário excluída com sucesso' };
  }

  async addPhotos(entryId: string, userId: string, files: UploadedPhoto[]) {
    const current = await this.findOwnedEntry(entryId, userId);

    if (!files.length) {
      throw new BadRequestException('Envie pelo menos uma foto.');
    }
    if (current.photos.length + files.length > JOURNAL_MAX_PHOTOS) {
      throw new BadRequestException(
        `Cada entrada aceita até ${JOURNAL_MAX_PHOTOS} fotos.`,
      );
    }

    const extensions = files.map((file) => detectImageExtension(file.buffer));
    if (extensions.some((ext) => !ext)) {
      throw new BadRequestException(
        'Só são aceitas imagens JPG, PNG, WEBP ou GIF.',
      );
    }

    const filenames: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        filenames.push(
          await this.photoStorage.save(file.buffer, extensions[i]!),
        );
      }
      const entry = await this.prisma.journalEntry.update({
        where: { id: entryId },
        data: {
          photos: { create: filenames.map((filename) => ({ filename })) },
        },
        omit: { userId: true },
        include: entryInclude,
      });

      return {
        message: 'Fotos adicionadas com sucesso',
        data: this.toResponse(entry),
      };
    } catch (error) {
      // Nada de arquivo órfão se o banco falhar no meio.
      await this.removeFiles(filenames);
      throw error;
    }
  }

  async deletePhoto(entryId: string, photoId: string, userId: string) {
    const current = await this.findOwnedEntry(entryId, userId);
    const photo = current.photos.find((p) => p.id === photoId);

    if (!photo) {
      throw new NotFoundException('Foto não encontrada.');
    }

    const entry = await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: { photos: { delete: { id: photoId } } },
      omit: { userId: true },
      include: entryInclude,
    });
    await this.removeFiles([photo.filename]);

    return {
      message: 'Foto excluída com sucesso',
      data: this.toResponse(entry),
    };
  }

  private async removeFiles(filenames: string[]) {
    await Promise.allSettled(
      filenames.map((filename) => this.photoStorage.remove(filename)),
    );
  }
}
