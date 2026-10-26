import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto.js';

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateUserDto, body);
  // Como o ValidationPipe global: campo fora do DTO é erro.
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, properties: errors.map((e) => e.property) };
}

describe('UpdateUserDto', () => {
  it('accepts a name and trims it', async () => {
    const { dto, properties } = await errorsFor({ name: '  Yasmin  ' });
    expect(properties).toEqual([]);
    expect(dto.name).toBe('Yasmin');
  });

  it('rejects a blank name', async () => {
    const { properties } = await errorsFor({ name: '   ' });
    expect(properties).toEqual(['name']);
  });

  it.each([
    ['password', 'nova-senha'],
    ['email', 'outra@example.com'],
    ['isEmailVerified', true],
    ['queueShareToken', 'abc'],
    ['hashedRefreshToken', 'x'],
  ])('rejects %s', async (field, value) => {
    const { properties } = await errorsFor({ name: 'Yasmin', [field]: value });
    expect(properties).toEqual([field]);
  });
});
