// Impressões: cada peça é um item, e imprimir de novo acrescenta um registro
// dentro dele. Um dos registros é o padrão, que dá base ao custo, ao tempo e
// ao preço do catálogo.
//
// Provisório: ainda sem backend. Os dados vivem em memória (mock) e somem ao
// recarregar a página; as funções já são assíncronas para trocar por
// apiFetch depois sem mexer nas telas.

export type PrintOutcome = "SUCCESS" | "FAILURE";

export type PrintCategory = { id: string; name: string; color: string };

export type PrintPrinter = { id: string; name: string };

export type PrintFilament = {
  id: string;
  colorName: string;
  type: string;
  brandName: string;
  colors: string[];
  pricePerGram: number;
  // Quanto sobra no rolo agora; o registro desconta daqui ao salvar.
  remainingGrams: number;
};

export type PrintFilamentUsage = { filament: PrintFilament; grams: number };

export type SlicerSettings = {
  slicer: string;
  layerHeightMm: number;
  infillPercent: number;
  infillPattern: string;
  walls: number;
  temperatureC: number;
  // Suporte, brim, velocidade e o resto, em texto livre.
  extras: string;
};

export type PrintRecord = {
  id: string;
  printedAt: string;
  printer: PrintPrinter;
  filaments: PrintFilamentUsage[];
  units: number;
  // Tempo da impressão inteira (todas as unidades). Na falha, até parar.
  totalMinutes: number;
  settings: SlicerSettings;
  outcome: PrintOutcome;
  failureReason: string | null;
  note: string | null;
  // Texto da coluna "O que mudou", montado a partir do registro de base.
  changeSummary: string | null;
  photos: string[];
};

export type PrintItemRef = { id: string; name: string };

export type PrintItem = {
  id: string;
  name: string;
  category: PrintCategory;
  modelUrl: string | null;
  derivedFrom: PrintItemRef | null;
  derivatives: PrintItemRef[];
  // Nome do kit/anúncio no catálogo; null quando não está à venda.
  catalogName: string | null;
  defaultRecordId: string;
  // Do mais recente para o mais antigo.
  records: PrintRecord[];
};

export type PrintRecordInput = Omit<PrintRecord, "id">;

export type PrintItemInput = {
  name: string;
  categoryId: string;
  modelUrl: string | null;
  derivedFromId: string | null;
  firstRecord: PrintRecordInput;
};

// Taxas por hora de impressão. Virão de "Custos e energia".
export const COST_RATES = {
  energyPerHour: 0.1,
  printerPerHour: 0.34,
  laborPerHour: 1.06,
};

export const FAILURE_REASONS = [
  "Descolou da mesa",
  "Entupiu",
  "Camada deslocada",
  "Acabou filamento",
];

export const SLICERS = ["Orca", "Bambu Studio", "Cura", "PrusaSlicer"];

export const INFILL_PATTERNS = ["giroide", "grade", "cúbico", "linhas"];

// ---------------------------------------------------------------------------
// Mock

export const MOCK_CATEGORIES: PrintCategory[] = [
  { id: "cat-chaveiros", name: "Chaveiros", color: "#e08a2e" },
  { id: "cat-decoracao", name: "Decoração", color: "#5cc7b8" },
  { id: "cat-home-office", name: "Home Office", color: "#9184d9" },
  { id: "cat-cozinha", name: "Cozinha", color: "#d98a78" },
];

export const MOCK_PRINTERS: PrintPrinter[] = [
  { id: "prn-a1", name: "Bambu A1" },
  { id: "prn-ender", name: "Ender 3 V3" },
];

export const MOCK_FILAMENTS: PrintFilament[] = [
  {
    id: "fil-rosa",
    colorName: "Rosa",
    type: "PLA",
    brandName: "Voolt",
    colors: ["#e89ab0"],
    pricePerGram: 0.09,
    remainingGrams: 585,
  },
  {
    id: "fil-azul",
    colorName: "Azul",
    type: "PLA",
    brandName: "Voolt",
    colors: ["#3f7fd6"],
    pricePerGram: 0.09,
    remainingGrams: 480,
  },
  {
    id: "fil-branco",
    colorName: "Branco",
    type: "PLA",
    brandName: "Voolt",
    colors: ["#e9e9ed"],
    pricePerGram: 0.085,
    remainingGrams: 720,
  },
  {
    id: "fil-preto",
    colorName: "Preto",
    type: "PLA",
    brandName: "3D Fila",
    colors: ["#2b2b33"],
    pricePerGram: 0.08,
    remainingGrams: 310,
  },
  {
    id: "fil-dourado",
    colorName: "Dourado",
    type: "PLA Silk",
    brandName: "Voolt",
    colors: ["#c9a24a", "#e6c48f"],
    pricePerGram: 0.12,
    remainingGrams: 640,
  },
  {
    id: "fil-preto-petg",
    colorName: "Preto",
    type: "PETG",
    brandName: "3D Fila",
    colors: ["#2b2b33"],
    pricePerGram: 0.11,
    remainingGrams: 890,
  },
];

function filament(id: string) {
  return MOCK_FILAMENTS.find((f) => f.id === id)!;
}

function printer(id: string) {
  return MOCK_PRINTERS.find((p) => p.id === id)!;
}

function category(id: string) {
  return MOCK_CATEGORIES.find((c) => c.id === id)!;
}

const BASE_SETTINGS: SlicerSettings = {
  slicer: "Orca",
  layerHeightMm: 0.2,
  infillPercent: 15,
  infillPattern: "giroide",
  walls: 2,
  temperatureC: 215,
  extras: "",
};

function record(
  id: string,
  fields: Partial<PrintRecord> &
    Pick<PrintRecord, "printedAt" | "filaments" | "units" | "totalMinutes">,
): PrintRecord {
  return {
    id,
    printer: printer("prn-a1"),
    settings: BASE_SETTINGS,
    outcome: "SUCCESS",
    failureReason: null,
    note: null,
    changeSummary: null,
    photos: [],
    ...fields,
  };
}

function iso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

let mockItems: PrintItem[] = [
  {
    id: "chaveiro-porco",
    name: "Chaveiro de porco",
    category: category("cat-chaveiros"),
    modelUrl: "https://makerworld.com/models/porquinho",
    derivedFrom: null,
    derivatives: [],
    catalogName: "Kit bichinhos",
    defaultRecordId: "porco-4",
    records: [
      record("porco-1", {
        printedAt: iso("2026-10-11"),
        filaments: [{ filament: filament("fil-azul"), grams: 37 }],
        units: 4,
        totalMinutes: 168,
        note: "Pedido da Ana",
        changeSummary: "mesma config.",
      }),
      record("porco-2", {
        printedAt: iso("2026-10-03"),
        printer: printer("prn-ender"),
        filaments: [{ filament: filament("fil-preto"), grams: 6 }],
        units: 2,
        totalMinutes: 9,
        outcome: "FAILURE",
        failureReason: "Descolou da mesa na 3ª camada",
      }),
      record("porco-3", {
        printedAt: iso("2026-09-28"),
        filaments: [{ filament: filament("fil-branco"), grams: 52 }],
        units: 6,
        totalMinutes: 228,
        settings: { ...BASE_SETTINGS, infillPercent: 10 },
        changeSummary: "Infill 15% → 10%",
      }),
      record("porco-4", {
        printedAt: iso("2026-09-12"),
        filaments: [{ filament: filament("fil-rosa"), grams: 27 }],
        units: 3,
        totalMinutes: 126,
        changeSummary: "2 paredes",
      }),
      record("porco-5", {
        printedAt: iso("2026-08-30"),
        filaments: [{ filament: filament("fil-rosa"), grams: 10 }],
        units: 1,
        totalMinutes: 44,
        settings: { ...BASE_SETTINGS, walls: 3 },
        changeSummary: "Primeira impressão",
      }),
      ...[
        ["2026-08-22", "fil-branco", 2],
        ["2026-08-15", "fil-rosa", 3],
        ["2026-08-09", "fil-preto", 1],
        ["2026-08-02", "fil-azul", 2],
      ].map(([date, filamentId, units], index) =>
        record(`porco-old-${index}`, {
          printedAt: iso(date as string),
          filaments: [
            {
              filament: filament(filamentId as string),
              grams: 9 * (units as number),
            },
          ],
          units: units as number,
          totalMinutes: 42 * (units as number),
          changeSummary: "mesma config.",
        }),
      ),
    ],
  },
  {
    id: "vaso-hexagonal",
    name: "Vaso hexagonal",
    category: category("cat-decoracao"),
    modelUrl: "https://printables.com/model/vaso-hex",
    derivedFrom: null,
    derivatives: [{ id: "vaso-hexagonal-g", name: "Vaso hexagonal G" }],
    catalogName: "Vasos geométricos",
    defaultRecordId: "vaso-3",
    records: [
      record("vaso-1", {
        printedAt: iso("2026-10-07"),
        printer: printer("prn-ender"),
        filaments: [{ filament: filament("fil-dourado"), grams: 131 }],
        units: 1,
        totalMinutes: 318,
        changeSummary: "PLA Silk Dourado",
      }),
      record("vaso-2", {
        printedAt: iso("2026-09-20"),
        printer: printer("prn-ender"),
        filaments: [{ filament: filament("fil-branco"), grams: 40 }],
        units: 1,
        totalMinutes: 95,
        outcome: "FAILURE",
        failureReason: "Entupiu no meio",
      }),
      record("vaso-3", {
        printedAt: iso("2026-09-02"),
        printer: printer("prn-ender"),
        filaments: [{ filament: filament("fil-branco"), grams: 128 }],
        units: 1,
        totalMinutes: 312,
        settings: { ...BASE_SETTINGS, infillPercent: 0, walls: 3 },
        changeSummary: "Modo vaso",
      }),
    ],
  },
  {
    id: "vaso-hexagonal-g",
    name: "Vaso hexagonal G",
    category: category("cat-decoracao"),
    modelUrl: null,
    derivedFrom: { id: "vaso-hexagonal", name: "Vaso hexagonal" },
    derivatives: [],
    catalogName: null,
    defaultRecordId: "vaso-g-2",
    records: [
      record("vaso-g-1", {
        printedAt: iso("2026-10-04"),
        printer: printer("prn-ender"),
        filaments: [{ filament: filament("fil-azul"), grams: 178 }],
        units: 1,
        totalMinutes: 430,
        changeSummary: "mesma config.",
      }),
      record("vaso-g-2", {
        printedAt: iso("2026-09-25"),
        printer: printer("prn-ender"),
        filaments: [{ filament: filament("fil-azul"), grams: 176 }],
        units: 1,
        totalMinutes: 426,
        settings: { ...BASE_SETTINGS, infillPercent: 0, walls: 3 },
        changeSummary: "Escala 140%",
      }),
    ],
  },
  {
    id: "suporte-fone",
    name: "Suporte de fone",
    category: category("cat-home-office"),
    modelUrl: "https://makerworld.com/models/headphone-stand",
    derivedFrom: null,
    derivatives: [],
    catalogName: null,
    defaultRecordId: "fone-3",
    records: [
      record("fone-1", {
        printedAt: iso("2026-10-01"),
        filaments: [{ filament: filament("fil-preto-petg"), grams: 22 }],
        units: 1,
        totalMinutes: 51,
        settings: { ...BASE_SETTINGS, temperatureC: 240 },
        outcome: "FAILURE",
        failureReason: "Camada deslocada",
      }),
      record("fone-2", {
        printedAt: iso("2026-09-24"),
        filaments: [{ filament: filament("fil-preto-petg"), grams: 15 }],
        units: 1,
        totalMinutes: 30,
        settings: { ...BASE_SETTINGS, temperatureC: 240 },
        outcome: "FAILURE",
        failureReason: "Descolou da mesa",
      }),
      ...[0, 1, 2, 3, 4, 5].map((index) =>
        record(`fone-${index + 3}`, {
          printedAt: iso(`2026-09-${String(20 - index * 3).padStart(2, "0")}`),
          filaments: [{ filament: filament("fil-preto-petg"), grams: 64 }],
          units: 1,
          totalMinutes: 150,
          settings: { ...BASE_SETTINGS, temperatureC: 240, walls: 3 },
          changeSummary: index === 5 ? "Primeira impressão" : "mesma config.",
        }),
      ),
    ],
  },
  {
    id: "porta-temperos",
    name: "Porta-temperos",
    category: category("cat-cozinha"),
    modelUrl: null,
    derivedFrom: null,
    derivatives: [],
    catalogName: "Organização de cozinha",
    defaultRecordId: "temperos-1",
    records: [
      record("temperos-1", {
        printedAt: iso("2026-09-15"),
        filaments: [
          { filament: filament("fil-branco"), grams: 84 },
          { filament: filament("fil-dourado"), grams: 12 },
        ],
        units: 2,
        totalMinutes: 236,
        changeSummary: "Primeira impressão",
      }),
    ],
  },
];

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(structuredClone(value)), ms),
  );
}

let nextId = 1;
function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${nextId++}`;
}

// Desconta o filamento gasto dos rolos (inclusive na falha).
function consumeFilament(input: PrintRecordInput) {
  for (const usage of input.filaments) {
    const spool = MOCK_FILAMENTS.find((f) => f.id === usage.filament.id);
    if (spool) {
      spool.remainingGrams = Math.max(0, spool.remainingGrams - usage.grams);
    }
  }
}

export async function listPrintItems() {
  return delay(mockItems);
}

export async function getPrintItem(id: string) {
  const item = mockItems.find((i) => i.id === id);
  if (!item) throw new Error("Impressão não encontrada.");
  return delay(item);
}

export async function listPrintFilaments() {
  return delay(MOCK_FILAMENTS, 0);
}

export async function createPrintItem(input: PrintItemInput) {
  const derivedFrom = input.derivedFromId
    ? (mockItems.find((i) => i.id === input.derivedFromId) ?? null)
    : null;
  const firstRecord: PrintRecord = {
    ...input.firstRecord,
    id: newId("rec"),
  };
  const item: PrintItem = {
    id: newId("item"),
    name: input.name,
    category: category(input.categoryId),
    modelUrl: input.modelUrl,
    derivedFrom: derivedFrom
      ? { id: derivedFrom.id, name: derivedFrom.name }
      : null,
    derivatives: [],
    catalogName: null,
    defaultRecordId: firstRecord.id,
    records: [firstRecord],
  };
  consumeFilament(input.firstRecord);
  mockItems = [
    item,
    ...mockItems.map((i) =>
      i.id === derivedFrom?.id
        ? {
            ...i,
            derivatives: [...i.derivatives, { id: item.id, name: item.name }],
          }
        : i,
    ),
  ];
  return delay(item);
}

export async function addPrintRecord(
  itemId: string,
  input: PrintRecordInput,
  options: { makeDefault: boolean },
) {
  const created: PrintRecord = { ...input, id: newId("rec") };
  consumeFilament(input);
  let updated: PrintItem | undefined;
  mockItems = mockItems.map((item) => {
    if (item.id !== itemId) return item;
    updated = {
      ...item,
      records: [created, ...item.records].sort((a, b) =>
        b.printedAt.localeCompare(a.printedAt),
      ),
      defaultRecordId:
        options.makeDefault && created.outcome === "SUCCESS"
          ? created.id
          : item.defaultRecordId,
    };
    return updated;
  });
  if (!updated) throw new Error("Impressão não encontrada.");
  return delay(updated);
}

export async function setDefaultPrintRecord(itemId: string, recordId: string) {
  let updated: PrintItem | undefined;
  mockItems = mockItems.map((item) => {
    if (item.id !== itemId) return item;
    updated = { ...item, defaultRecordId: recordId };
    return updated;
  });
  if (!updated) throw new Error("Impressão não encontrada.");
  return delay(updated, 100);
}

// ---------------------------------------------------------------------------
// Cálculos

export type CostBreakdown = {
  filament: number;
  energy: number;
  printer: number;
  labor: number;
  total: number;
};

export function getRecordGrams(record: Pick<PrintRecord, "filaments">) {
  return record.filaments.reduce((sum, usage) => sum + usage.grams, 0);
}

export function computeCost(
  record: Pick<PrintRecord, "filaments" | "totalMinutes">,
): CostBreakdown {
  const hours = record.totalMinutes / 60;
  const filamentCost = record.filaments.reduce(
    (sum, usage) => sum + usage.grams * usage.filament.pricePerGram,
    0,
  );
  const energy = hours * COST_RATES.energyPerHour;
  const printerCost = hours * COST_RATES.printerPerHour;
  const labor = hours * COST_RATES.laborPerHour;
  return {
    filament: filamentCost,
    energy,
    printer: printerCost,
    labor,
    total: filamentCost + energy + printerCost + labor,
  };
}

export function divideCost(cost: CostBreakdown, units: number): CostBreakdown {
  const n = Math.max(1, units);
  return {
    filament: cost.filament / n,
    energy: cost.energy / n,
    printer: cost.printer / n,
    labor: cost.labor / n,
    total: cost.total / n,
  };
}

export function getDefaultRecord(item: PrintItem) {
  return (
    item.records.find((r) => r.id === item.defaultRecordId) ?? item.records[0]
  );
}

export function getPerUnit(record: PrintRecord) {
  const units = Math.max(1, record.units);
  return {
    grams: getRecordGrams(record) / units,
    minutes: record.totalMinutes / units,
    cost: computeCost(record).total / units,
  };
}

export type PrintItemStats = {
  recordCount: number;
  units: number;
  failures: number;
  lostCost: number;
  // Primeira cor de cada filamento já usado com sucesso, sem repetir.
  colors: string[][];
  lastPrintedAt: string | null;
  lastFailureAt: string | null;
};

export function getItemStats(item: PrintItem): PrintItemStats {
  const successes = item.records.filter((r) => r.outcome === "SUCCESS");
  const failures = item.records.filter((r) => r.outcome === "FAILURE");
  const colors = new Map<string, string[]>();
  for (const r of successes) {
    for (const usage of r.filaments) {
      colors.set(usage.filament.id, usage.filament.colors);
    }
  }
  return {
    recordCount: item.records.length,
    units: successes.reduce((sum, r) => sum + r.units, 0),
    failures: failures.length,
    lostCost: failures.reduce((sum, r) => sum + computeCost(r).total, 0),
    colors: [...colors.values()],
    lastPrintedAt: item.records[0]?.printedAt ?? null,
    lastFailureAt: failures[0]?.printedAt ?? null,
  };
}

// O que mudou em relação ao registro de base, em texto curto.
export function describeChanges(
  base: PrintRecord,
  next: Pick<PrintRecord, "printer" | "filaments" | "units" | "settings">,
) {
  const parts: string[] = [];
  const baseIds = base.filaments.map((u) => u.filament.id).join();
  const nextIds = next.filaments.map((u) => u.filament.id).join();
  if (baseIds !== nextIds) {
    parts.push(
      next.filaments.map((u) => describePrintFilament(u.filament)).join(" + "),
    );
  }
  if (base.printer.id !== next.printer.id) parts.push(next.printer.name);
  if (base.units !== next.units) parts.push(`${next.units} un.`);
  const a = base.settings;
  const b = next.settings;
  if (a.slicer !== b.slicer) parts.push(b.slicer);
  if (a.layerHeightMm !== b.layerHeightMm) {
    parts.push(
      `Camada ${formatDecimal(a.layerHeightMm)} → ${formatDecimal(b.layerHeightMm)} mm`,
    );
  }
  if (a.infillPercent !== b.infillPercent) {
    parts.push(`Infill ${a.infillPercent}% → ${b.infillPercent}%`);
  }
  if (a.infillPattern !== b.infillPattern) parts.push(b.infillPattern);
  if (a.walls !== b.walls) parts.push(`Paredes ${a.walls} → ${b.walls}`);
  if (a.temperatureC !== b.temperatureC) {
    parts.push(`${a.temperatureC} → ${b.temperatureC} °C`);
  }
  if (a.extras.trim() !== b.extras.trim() && b.extras.trim()) {
    parts.push(b.extras.trim());
  }
  return parts.length ? parts.join(" · ") : "mesma config.";
}

// ---------------------------------------------------------------------------
// Formatação

export function describePrintFilament(f: PrintFilament) {
  return `${f.type} ${f.colorName}`;
}

export function formatDecimal(value: number, maxDigits = 2) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: maxDigits });
}

export function formatGrams(grams: number) {
  return `${formatDecimal(Math.round(grams * 10) / 10, 1)} g`;
}

// 42 → "42 min"; 126 → "2 h 06".
export function formatDuration(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

// Aceita "2 h 06", "2h06", "2:06", "0 h 09", "42 min" ou só minutos ("126").
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  const hm = value.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})?\s*(?:min)?$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = value.match(/^(\d+)\s*(?:min)?$/);
  if (m) return Number(m[1]);
  return null;
}

export function formatSettings(s: SlicerSettings) {
  return [
    `${formatDecimal(s.layerHeightMm)} mm`,
    `${s.infillPercent}% ${s.infillPattern}`,
    `${s.walls} ${s.walls === 1 ? "parede" : "paredes"}`,
    `${s.temperatureC} °C`,
  ].join(" · ");
}

export function formatRelativeDays(iso: string, now = new Date()) {
  const start = new Date(iso);
  const days = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

export function shortUrl(url: string) {
  const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const parts = clean.split("/");
  return parts.length > 2 ? `${parts[0]}/…/${parts[parts.length - 1]}` : clean;
}
