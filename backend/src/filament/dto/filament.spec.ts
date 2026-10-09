import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  FILAMENT_COLOR_NAME_MAX_LENGTH,
  FILAMENT_COLORS_MAX_COUNT,
  FILAMENT_SPOOL_MAX_GRAMS,
  FilamentDto,
  FilamentPurchaseDto,
  UpdateFilamentDto,
} from './filament.js';

function invalidFields(dtoClass: new () => object, plain: object) {
  return validateSync(plainToInstance(dtoClass, plain)).map(
    (error) => error.property,
  );
}

const valid = {
  brandId: '4f9a2b1c-3d4e-4f5a-8b6c-7d8e9f0a1b2c',
  type: 'PLA',
  colorName: 'Marrom',
  colors: ['#6e473b'],
  spoolWeightGrams: 1000,
  minPricePaid: 110,
};

describe('FilamentDto', () => {
  it('aceita um filamento com dados normais', () => {
    expect(
      invalidFields(FilamentDto, {
        ...valid,
        maxPricePaid: 120,
        purchaseCount: 3,
        lastPurchasedAt: '2026-06-11T12:00:00.000Z',
        purchaseChannel: 'OWN_SITE',
        availability: 'AVAILABLE',
        isOutlet: true,
        rating: 4,
        ratingComment: 'Imprime limpo.',
        notes: 'Velvet some em 0,28.',
      }),
    ).toEqual([]);
  });

  it('aceita campos opcionais nulos (limpar na edição)', () => {
    expect(
      invalidFields(FilamentDto, {
        ...valid,
        maxPricePaid: null,
        purchaseChannel: null,
        rating: null,
        ratingComment: null,
      }),
    ).toEqual([]);
  });

  it('aceita duo e tri color', () => {
    expect(
      invalidFields(FilamentDto, {
        ...valid,
        colors: ['#1f9070', '#1e2d2b', '#8f5fb0'],
      }),
    ).toEqual([]);
  });

  it('recusa cor fora do formato #rrggbb', () => {
    expect(
      invalidFields(FilamentDto, { ...valid, colors: ['marrom'] }),
    ).toContain('colors');
    expect(
      invalidFields(FilamentDto, { ...valid, colors: ['#6e473b', '#fff'] }),
    ).toContain('colors');
  });

  it('exige de 1 a 3 cores', () => {
    expect(invalidFields(FilamentDto, { ...valid, colors: [] })).toContain(
      'colors',
    );
    expect(
      invalidFields(FilamentDto, {
        ...valid,
        colors: Array(FILAMENT_COLORS_MAX_COUNT + 1).fill('#6e473b'),
      }),
    ).toContain('colors');
  });

  it('recusa nota fora de 1 a 5 e não inteira', () => {
    expect(invalidFields(FilamentDto, { ...valid, rating: 6 })).toContain(
      'rating',
    );
    expect(invalidFields(FilamentDto, { ...valid, rating: 3.5 })).toContain(
      'rating',
    );
  });

  it('recusa preço zero e peso fora do limite', () => {
    expect(invalidFields(FilamentDto, { ...valid, minPricePaid: 0 })).toContain(
      'minPricePaid',
    );
    expect(
      invalidFields(FilamentDto, {
        ...valid,
        spoolWeightGrams: FILAMENT_SPOOL_MAX_GRAMS + 1,
      }),
    ).toContain('spoolWeightGrams');
  });

  it('recusa nome de cor acima do limite e marca que não é uuid', () => {
    const fields = invalidFields(FilamentDto, {
      ...valid,
      brandId: 'voolt3d',
      colorName: 'a'.repeat(FILAMENT_COLOR_NAME_MAX_LENGTH + 1),
    });
    expect(fields).toEqual(expect.arrayContaining(['brandId', 'colorName']));
  });
});

describe('UpdateFilamentDto', () => {
  it('recusa outlet que não é booleano', () => {
    expect(invalidFields(UpdateFilamentDto, { isOutlet: 'sim' })).toContain(
      'isOutlet',
    );
  });

  it('aceita só mudar o nível do carretel', () => {
    expect(invalidFields(UpdateFilamentDto, { spoolLevel: 'LOW' })).toEqual([]);
    expect(invalidFields(UpdateFilamentDto, { spoolLevel: 'HALF' })).toContain(
      'spoolLevel',
    );
  });
});

describe('FilamentPurchaseDto', () => {
  it('exige preço e data válidos', () => {
    expect(
      invalidFields(FilamentPurchaseDto, {
        pricePaid: 120,
        purchasedAt: '2026-10-01T12:00:00.000Z',
      }),
    ).toEqual([]);
    expect(
      invalidFields(FilamentPurchaseDto, {
        pricePaid: 0,
        purchasedAt: 'ontem',
      }),
    ).toEqual(expect.arrayContaining(['pricePaid', 'purchasedAt']));
  });
});
