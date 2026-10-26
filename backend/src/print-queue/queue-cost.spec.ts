import {
  computeQueueEntryCost,
  computeQueueEntryFilamentCost,
  quoteQueueEntry,
} from './queue-cost.js';

describe('computeQueueEntryCost', () => {
  const settings = {
    energyCostPerKwh: 1,
    otherFixedCost: 0,
    failureReservePercent: 0,
    laborCostPerHour: 0,
    prepMinutesPerPiece: 0,
    defaultMarginPercent: 0,
  };
  const printer = {
    powerConsumptionW: 100,
    energyCostPerKwh: null,
    maintenanceCostPerHour: null,
  };

  it('has no cost without filament or time', () => {
    const filaments = [{ grams: 10, pricePerGram: 0.1 }];
    expect(
      computeQueueEntryCost(
        { units: 1, totalMinutes: 0, filaments },
        printer,
        settings,
      ),
    ).toBeNull();
    expect(
      computeQueueEntryCost(
        { units: 1, totalMinutes: 60, filaments: [] },
        printer,
        settings,
      ),
    ).toBeNull();
  });

  it('prefers the printer tariff over the global one', () => {
    const entry = {
      units: 1,
      totalMinutes: 60,
      filaments: [{ grams: 10, pricePerGram: 0.1 }],
    };
    // 1,00 de filamento + 1 h × 0,1 kW × tarifa.
    expect(computeQueueEntryCost(entry, printer, settings)).toBe(1.1);
    expect(
      computeQueueEntryCost(
        entry,
        { ...printer, energyCostPerKwh: 2 },
        settings,
      ),
    ).toBe(1.2);
  });

  it('rounds each part up to the cent before adding', () => {
    // 3 × 0,333 = 0,999 → 1,00; reserva de 10% sobre 0,999 → 0,10.
    expect(
      computeQueueEntryCost(
        {
          units: 1,
          totalMinutes: 1,
          filaments: [{ grams: 3, pricePerGram: 0.333 }],
        },
        null,
        { ...settings, failureReservePercent: 10 },
      ),
    ).toBe(1.1);
  });

  it('charges the other fixed cost per unit', () => {
    expect(
      computeQueueEntryCost(
        {
          units: 3,
          totalMinutes: 60,
          filaments: [{ grams: 10, pricePerGram: 0.1 }],
        },
        null,
        { ...settings, otherFixedCost: 0.5 },
      ),
    ).toBe(2.5);
  });
});

describe('quoteQueueEntry', () => {
  const settings = {
    energyCostPerKwh: 1,
    otherFixedCost: 0,
    failureReservePercent: 0,
    laborCostPerHour: 36,
    prepMinutesPerPiece: 20,
    defaultMarginPercent: 50,
  };
  const filaments = [{ grams: 20, pricePerGram: 0.1 }];

  it('adds one prep of labor and the margin on top of the cost', () => {
    // Custo 2,00; preparo 20 min a R$ 36/h = 12,00; (2 + 12) × 1,5.
    expect(
      quoteQueueEntry(
        { units: 1, totalMinutes: 60, filaments },
        null,
        settings,
      ),
    ).toEqual({ cost: 2, price: 21 });
  });

  it('counts the prep once for the whole batch', () => {
    expect(
      quoteQueueEntry({ units: 5, totalMinutes: 60, filaments }, null, settings)
        ?.price,
    ).toBe(21);
  });

  it('has no quote without a cost', () => {
    expect(
      quoteQueueEntry({ units: 1, totalMinutes: 0, filaments }, null, settings),
    ).toBeNull();
  });
});

describe('computeQueueEntryFilamentCost', () => {
  it('sums every filament and rounds up to the cent', () => {
    // 36 × 0,09 + 10,04 × 0,1 = 4,244 → 4,25.
    expect(
      computeQueueEntryFilamentCost({
        units: 4,
        totalMinutes: 0,
        filaments: [
          { grams: 36, pricePerGram: 0.09 },
          { grams: 10.04, pricePerGram: 0.1 },
        ],
      }),
    ).toBe(4.25);
  });

  it('has no filament cost without filament', () => {
    expect(
      computeQueueEntryFilamentCost({
        units: 1,
        totalMinutes: 60,
        filaments: [],
      }),
    ).toBeNull();
  });
});
