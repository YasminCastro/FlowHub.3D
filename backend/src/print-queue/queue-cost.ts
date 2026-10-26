// Custo e preço sugerido de um item da fila, para a página pública (que não
// tem as configurações de custo para fazer a conta). Espelha o computeCost
// (frontend/lib/api/print.ts) para um item que dá certo e sem itens extras, e
// o quoteEntry (frontend/lib/api/print-queue.ts): mudou a conta lá, muda aqui
// também.

export type QueueCostSettings = {
  energyCostPerKwh: number;
  otherFixedCost: number;
  failureReservePercent: number;
  laborCostPerHour: number;
  prepMinutesPerPiece: number;
  defaultMarginPercent: number;
};

export type QueueCostPrinter = {
  powerConsumptionW: number | null;
  energyCostPerKwh: number | null;
  maintenanceCostPerHour: number | null;
} | null;

export type QueueCostInput = {
  units: number;
  totalMinutes: number;
  filaments: { grams: number; pricePerGram: number }[];
};

/**
 * Valores de custo sempre sobem para o centavo seguinte; a folga desconta o
 * ruído do ponto flutuante. Igual ao ceilCents do front.
 */
function ceilCents(value: number) {
  return Math.ceil(value * 100 - 1e-6) / 100 + 0;
}

function filamentCost(entry: QueueCostInput) {
  return entry.filaments.reduce(
    (sum, usage) => sum + usage.grams * usage.pricePerGram,
    0,
  );
}

/**
 * Só o filamento do lote (a linha "Filamento" do detalhamento do custo).
 * Não depende do tempo: basta ter filamento. null sem filamento.
 */
export function computeQueueEntryFilamentCost(entry: QueueCostInput) {
  return entry.filaments.length ? ceilCents(filamentCost(entry)) : null;
}

/** null sem filamento ou sem tempo: aí não há orçamento. */
export function computeQueueEntryCost(
  entry: QueueCostInput,
  printer: QueueCostPrinter,
  settings: QueueCostSettings,
) {
  if (!entry.filaments.length || !entry.totalMinutes) return null;

  const hours = entry.totalMinutes / 60;
  // Tarifa própria da impressora; sem ela, a global.
  const tariff = printer?.energyCostPerKwh ?? settings.energyCostPerKwh;

  const filament = filamentCost(entry);
  const energy = hours * ((printer?.powerConsumptionW ?? 0) / 1000) * tariff;
  const maintenance = hours * (printer?.maintenanceCostPerHour ?? 0);
  const production = filament + energy + maintenance;
  const other = settings.otherFixedCost * Math.max(1, entry.units);
  const failureReserve = (production * settings.failureReservePercent) / 100;

  // Cada parte sobe para o centavo e o total é a soma delas, como no front.
  const total = [filament, energy, maintenance, other, failureReserve]
    .map(ceilCents)
    .reduce((sum, value) => sum + value, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Orçamento rápido, como na fila do usuário: o custo do lote mais a mão de
 * obra de um preparo (as unidades saem juntas da mesma mesa), com a margem
 * padrão por cima. null quando ainda não há custo.
 */
export function quoteQueueEntry(
  entry: QueueCostInput,
  printer: QueueCostPrinter,
  settings: QueueCostSettings,
) {
  const cost = computeQueueEntryCost(entry, printer, settings);
  if (cost === null) return null;

  const labor = (settings.prepMinutesPerPiece / 60) * settings.laborCostPerHour;
  const price = (cost + labor) * (1 + settings.defaultMarginPercent / 100);
  return { cost, price: Math.round(price * 100) / 100 };
}
