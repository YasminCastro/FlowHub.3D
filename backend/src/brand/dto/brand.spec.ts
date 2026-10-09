import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BRAND_NAME_MAX_LENGTH,
  BRAND_NOTE_MAX_LENGTH,
  BRAND_TAG_MAX_LENGTH,
  BRAND_TAGS_MAX_COUNT,
  BrandDto,
  BrandNoteDto,
} from './brand.js';

function invalidFields(dtoClass: new () => object, plain: object) {
  return validateSync(plainToInstance(dtoClass, plain)).map(
    (error) => error.property,
  );
}

describe('BrandDto', () => {
  it('aceita uma marca com dados normais', () => {
    expect(
      invalidFields(BrandDto, {
        name: 'Voolt3D',
        website: 'voolt3d.com.br',
        purchaseChannels: ['OWN_SITE', 'SHOPEE'],
        filamentTypes: ['PLA', 'PETG'],
        preferredColors: ['Pastéis', 'Preto'],
        notes: 'Frete caro.',
      }),
    ).toEqual([]);
  });

  it('recusa nome acima do limite', () => {
    expect(
      invalidFields(BrandDto, { name: 'a'.repeat(BRAND_NAME_MAX_LENGTH + 1) }),
    ).toContain('name');
  });

  it('recusa site que não é http(s), como javascript:', () => {
    expect(
      invalidFields(BrandDto, {
        name: 'Voolt3D',
        website: 'javascript:alert(1)',
      }),
    ).toContain('website');
  });

  it('recusa canal de compra repetido', () => {
    expect(
      invalidFields(BrandDto, {
        name: 'Voolt3D',
        purchaseChannels: ['AMAZON', 'AMAZON'],
      }),
    ).toContain('purchaseChannels');
  });

  it('recusa listas grandes demais e itens longos demais', () => {
    expect(
      invalidFields(BrandDto, {
        name: 'Voolt3D',
        filamentTypes: Array.from(
          { length: BRAND_TAGS_MAX_COUNT + 1 },
          (_, i) => `Tipo ${i}`,
        ),
        preferredColors: ['a'.repeat(BRAND_TAG_MAX_LENGTH + 1)],
      }),
    ).toEqual(expect.arrayContaining(['filamentTypes', 'preferredColors']));
  });

  it('recusa observação inicial acima do limite', () => {
    expect(
      invalidFields(BrandDto, {
        name: 'Voolt3D',
        notes: 'a'.repeat(BRAND_NOTE_MAX_LENGTH + 1),
      }),
    ).toContain('notes');
  });
});

describe('BrandNoteDto', () => {
  it('recusa observação acima do limite', () => {
    expect(
      invalidFields(BrandNoteDto, {
        content: 'a'.repeat(BRAND_NOTE_MAX_LENGTH + 1),
      }),
    ).toContain('content');
  });
});
