import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { UPLOADS_ROOT } from '../journal/journal-photo-storage.js';

// Servida em /uploads pelo main.ts, junto com as fotos do diário.
export const PRINT_PHOTOS_DIR = join(UPLOADS_ROOT, 'prints');
export const PRINT_PHOTOS_URL_PREFIX = '/uploads/prints';

export function printPhotoUrl(filename: string) {
  return `${PRINT_PHOTOS_URL_PREFIX}/${filename}`;
}

@Injectable()
export class PrintPhotoStorage {
  /** Grava a imagem com nome aleatório e devolve o nome do arquivo. */
  async save(buffer: Buffer, ext: string) {
    await mkdir(PRINT_PHOTOS_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(join(PRINT_PHOTOS_DIR, filename), buffer);
    return filename;
  }

  // Arquivo que já sumiu não é erro: o objetivo é ele não existir.
  async remove(filename: string) {
    try {
      await unlink(join(PRINT_PHOTOS_DIR, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
