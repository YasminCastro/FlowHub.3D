import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Grava de verdade, numa pasta temporária: UPLOADS_DIR é lido na importação.
const root = await mkdtemp(join(tmpdir(), 'flowhub-uploads-'));
process.env.UPLOADS_DIR = root;
const { PrintPhotoStorage, PRINT_PHOTOS_DIR, printPhotoUrl } =
  await import('./print-photo-storage.js');

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

describe('PrintPhotoStorage', () => {
  const storage = new PrintPhotoStorage();

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('grava a imagem em uploads/prints com nome aleatório e a extensão dada', async () => {
    const filename = await storage.save(PNG, 'png');

    expect(PRINT_PHOTOS_DIR).toBe(join(root, 'prints'));
    expect(filename).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await readFile(join(PRINT_PHOTOS_DIR, filename))).toEqual(PNG);
    expect(printPhotoUrl(filename)).toBe(`/uploads/prints/${filename}`);
  });

  it('remove o arquivo, e remover de novo não é erro', async () => {
    const filename = await storage.save(PNG, 'png');

    await storage.remove(filename);
    await expect(readFile(join(PRINT_PHOTOS_DIR, filename))).rejects.toThrow();
    await expect(storage.remove(filename)).resolves.toBeUndefined();
  });
});
