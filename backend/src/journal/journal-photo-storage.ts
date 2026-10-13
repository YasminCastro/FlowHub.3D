import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Pasta raiz dos uploads, servida em /uploads pelo main.ts.
export const UPLOADS_ROOT = resolve(process.env.UPLOADS_DIR ?? 'uploads');
export const JOURNAL_PHOTOS_DIR = join(UPLOADS_ROOT, 'journal');
export const JOURNAL_PHOTOS_URL_PREFIX = '/uploads/journal';

// A extensão sai do conteúdo do arquivo, nunca do nome ou do mimetype que o
// cliente mandou: assim o static só serve imagem, mesmo com upload forjado.
const SIGNATURES: { ext: string; matches: (b: Buffer) => boolean }[] = [
  {
    ext: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'png',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    ext: 'gif',
    matches: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8',
  },
  {
    ext: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectImageExtension(buffer: Buffer) {
  return SIGNATURES.find((s) => s.matches(buffer))?.ext ?? null;
}

export function journalPhotoUrl(filename: string) {
  return `${JOURNAL_PHOTOS_URL_PREFIX}/${filename}`;
}

@Injectable()
export class JournalPhotoStorage {
  /** Grava a imagem com nome aleatório e devolve o nome do arquivo. */
  async save(buffer: Buffer, ext: string) {
    await mkdir(JOURNAL_PHOTOS_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(join(JOURNAL_PHOTOS_DIR, filename), buffer);
    return filename;
  }

  // Arquivo que já sumiu não é erro: o objetivo é ele não existir.
  async remove(filename: string) {
    try {
      await unlink(join(JOURNAL_PHOTOS_DIR, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
