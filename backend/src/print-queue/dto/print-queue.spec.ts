import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicQueueRequestDto } from './print-queue.js';

async function invalidFields(body: Record<string, unknown>) {
  const dto = plainToInstance(PublicQueueRequestDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('PublicQueueRequestDto', () => {
  const valid = {
    name: 'Vaso espiral',
    requesterName: 'Bia',
    colors: 'Azul e branco',
    units: 2,
    modelUrl: 'makerworld.com/models/vaso',
  };

  it('accepts a request with model link and colors', async () => {
    expect(await invalidFields(valid)).toEqual([]);
  });

  it.each(['colors', 'modelUrl'])('requires %s', async (field) => {
    expect(await invalidFields({ ...valid, [field]: undefined })).toEqual([
      field,
    ]);
    expect(await invalidFields({ ...valid, [field]: null })).toEqual([field]);
    expect(await invalidFields({ ...valid, [field]: '' })).toEqual([field]);
  });

  it('rejects a model link that is not a URL', async () => {
    expect(await invalidFields({ ...valid, modelUrl: 'vaso azul' })).toEqual([
      'modelUrl',
    ]);
  });
});
