// Impressões: cada peça é um item, e imprimir de novo acrescenta um registro
// dentro dele. Um dos registros é o padrão, que dá base ao custo, ao tempo e
// ao preço do catálogo.

import { ApiError, apiFetch } from "./client";
import type { CostSettings } from "./cost-settings";
import { getUnitCost, listExtraItems } from "./extra-item";
import {
  Filament,
  SPOOL_LEVEL_LABELS,
  SpoolLevel,
  getMaterial,
  isInStock,
  listFilaments,
} from "./filament";
import type { Printer } from "./printer";

export type PrintOutcome = "SUCCESS" | "FAILURE";

export type PrintCategory = { id: string; name: string; color: string | null };

// id null: a impressora foi excluída; o nome é o do dia do registro.
export type PrintPrinter = { id: string | null; name: string };

export type PrintFilament = {
  id: string;
  colorName: string;
  type: string;
  brandName: string;
  colors: string[];
  pricePerGram: number;
  // Marcado à mão no filamento; o consumo ainda não desconta do rolo.
  spoolLevel: SpoolLevel;
};

// Num registro, o filamento guarda o preço e o nome do dia. Se ele foi
// excluído depois, o id vira este marcador e o nível, "Acabou".
const DELETED_FILAMENT_PREFIX = "excluido:";

export function isDeletedFilament(filament: Pick<PrintFilament, "id">) {
  return filament.id.startsWith(DELETED_FILAMENT_PREFIX);
}

export type PrintFilamentUsage = {
  filament: PrintFilament;
  grams: number;
  // Id do uso no registro salvo; na edição, mantém um filamento excluído.
  usageId?: string;
};

// Ímã, argola, embalagem... com o custo unitário e o nome do dia do registro.
export type PrintExtraItem = { id: string; name: string; unitCost: number };

// Item extra excluído depois do registro: o id vira este marcador.
const DELETED_EXTRA_ITEM_PREFIX = "excluido:";

export function isDeletedExtraItem(item: Pick<PrintExtraItem, "id">) {
  return item.id.startsWith(DELETED_EXTRA_ITEM_PREFIX);
}

export type PrintExtraItemUsage = {
  extraItem: PrintExtraItem;
  // Quantos vão em cada peça; o total multiplica pelas unidades.
  quantity: number;
  // Id do uso no registro salvo; na edição, mantém um item excluído.
  usageId?: string;
};

// Ponto de foco (0 a 100%) que fica no centro do recorte, ou a foto inteira.
export type PhotoFraming = { focusX: number; focusY: number; contain: boolean };

export type PrintPhoto = { id: string; src: string } & PhotoFraming;

export type SlicerSettings = {
  slicer: string;
  layerHeightMm: number;
  infillPercent: number;
  infillPattern: string;
  walls: number;
  // Opcional: a Nova impressão não pede.
  temperatureC: number | null;
  // Suporte, brim, velocidade e o resto, em texto livre.
  extras: string;
};

export type PrintRecord = {
  id: string;
  printedAt: string;
  printer: PrintPrinter;
  filaments: PrintFilamentUsage[];
  extraItems: PrintExtraItemUsage[];
  units: number;
  // Tempo da impressão inteira (todas as unidades). Na falha, até parar.
  totalMinutes: number;
  // null: registro sem configuração do fatiador (é opcional).
  settings: SlicerSettings | null;
  outcome: PrintOutcome;
  failureReason: string | null;
  note: string | null;
  // Texto da coluna "O que mudou", montado a partir do registro de base.
  changeSummary: string | null;
  // src pronto para o <img>.
  photos: PrintPhoto[];
};

export type PrintItemRef = { id: string; name: string };

export type PrintItem = {
  id: string;
  name: string;
  // null: sem categoria (ou a categoria foi excluída).
  category: PrintCategory | null;
  modelUrl: string | null;
  derivedFrom: PrintItemRef | null;
  derivatives: PrintItemRef[];
  defaultRecordId: string;
  // Do mais recente para o mais antigo.
  records: PrintRecord[];
};

// O que as telas montam; vira o corpo da requisição em toRecordPayload. Sem
// extraItems (a fila), o registro novo fica sem e o editado mantém os dele.
export type PrintRecordInput = Omit<
  PrintRecord,
  "id" | "photos" | "extraItems"
> & { extraItems?: PrintExtraItemUsage[] };

export type PrintItemInput = {
  name: string;
  categoryId: string | null;
  modelUrl: string | null;
  derivedFromId: string | null;
  firstRecord: PrintRecordInput;
};

// Mesmos limites do backend.
export const PRINT_MAX_PHOTOS = 12;
export const PRINT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const FAILURE_REASONS = [
  "Descolou da mesa",
  "Entupiu",
  "Camada deslocada",
  "Acabou filamento",
];

export const SLICERS = ["Orca", "Bambu Studio", "Cura", "PrusaSlicer"];

// Ponto de partida quando o usuário abre a configuração do fatiador.
export const DEFAULT_SLICER_SETTINGS: SlicerSettings = {
  slicer: "Orca",
  layerHeightMm: 0.2,
  infillPercent: 15,
  infillPattern: "giroide",
  walls: 2,
  temperatureC: null,
  extras: "",
};

export const INFILL_PATTERNS = ["giroide", "grade", "cúbico", "linhas"];

// ---------------------------------------------------------------------------
// API

// Filamento gasto, como vem do backend (registros e fila).
export type PrintFilamentUsageResponse = {
  id: string;
  grams: number;
  filament: Omit<PrintFilament, "id" | "spoolLevel"> & {
    id: string | null;
    spoolLevel: SpoolLevel | null;
  };
};

type PrintExtraItemUsageResponse = {
  id: string;
  quantity: number;
  extraItem: Omit<PrintExtraItem, "id"> & { id: string | null };
};

type PrintRecordResponse = Omit<
  PrintRecord,
  "filaments" | "extraItems" | "photos"
> & {
  filaments: PrintFilamentUsageResponse[];
  extraItems: PrintExtraItemUsageResponse[];
  photos: ({ id: string; url: string } & PhotoFraming)[];
};

type PrintItemResponse = Omit<PrintItem, "records" | "defaultRecordId"> & {
  defaultRecordId: string | null;
  records: PrintRecordResponse[];
};

type ItemResponse = { message: string; data: PrintItemResponse };

export function printPhotoSrc(url: string) {
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}

export function fromUsageResponse(
  usage: PrintFilamentUsageResponse,
): PrintFilamentUsage {
  return {
    usageId: usage.id,
    grams: usage.grams,
    filament: {
      ...usage.filament,
      id: usage.filament.id ?? `${DELETED_FILAMENT_PREFIX}${usage.id}`,
      spoolLevel: usage.filament.spoolLevel ?? "FINISHED",
    },
  };
}

function fromRecordResponse(record: PrintRecordResponse): PrintRecord {
  return {
    ...record,
    filaments: record.filaments.map(fromUsageResponse),
    extraItems: record.extraItems.map((usage) => ({
      usageId: usage.id,
      quantity: usage.quantity,
      extraItem: {
        ...usage.extraItem,
        id: usage.extraItem.id ?? `${DELETED_EXTRA_ITEM_PREFIX}${usage.id}`,
      },
    })),
    photos: record.photos.map(({ url, ...photo }) => ({
      ...photo,
      src: printPhotoSrc(url),
    })),
  };
}

function fromItemResponse(item: PrintItemResponse): PrintItem {
  const records = item.records.map(fromRecordResponse);
  return {
    ...item,
    records,
    defaultRecordId: item.defaultRecordId ?? records[0]?.id ?? "",
  };
}

export function toRecordPayload(input: PrintRecordInput) {
  if (!input.printer.id) throw new Error("Escolha a impressora.");
  return {
    printedAt: input.printedAt,
    printerId: input.printer.id,
    // Filamento excluído só fica pelo uso que o registro já tinha.
    filaments: input.filaments.map((usage) => ({
      ...(isDeletedFilament(usage.filament)
        ? {
            usageId:
              usage.usageId ??
              usage.filament.id.slice(DELETED_FILAMENT_PREFIX.length),
          }
        : { filamentId: usage.filament.id }),
      grams: Math.round(usage.grams * 100) / 100,
    })),
    // Item extra excluído também só fica pelo uso que o registro já tinha.
    extraItems: input.extraItems?.map((usage) => ({
      ...(isDeletedExtraItem(usage.extraItem)
        ? {
            usageId:
              usage.usageId ??
              usage.extraItem.id.slice(DELETED_EXTRA_ITEM_PREFIX.length),
          }
        : { extraItemId: usage.extraItem.id }),
      quantity: usage.quantity,
    })),
    units: input.units,
    totalMinutes: Math.round(input.totalMinutes),
    settings: input.settings,
    outcome: input.outcome,
    failureReason: input.failureReason,
    note: input.note,
    changeSummary: input.changeSummary,
  };
}

export async function listPrintItems() {
  const items = (await apiFetch("/print")) as PrintItemResponse[];
  return items.map(fromItemResponse);
}

export type PrintPageSort =
  "recent" | "oldest" | "units" | "name" | "name-desc";

export type PrintItemsPageQuery = {
  page: number;
  pageSize: number;
  sort: PrintPageSort;
  search?: string;
  categoryId?: string;
  recentFailure?: boolean;
};

export type PrintItemsPage = {
  items: PrintItem[];
  total: number;
  // A pedida, ou a última se ela não existe mais.
  page: number;
  pageSize: number;
  totalPages: number;
};

// Lista da tela de Impressões: filtro, ordem e paginação feitos no servidor.
export async function listPrintItemsPage(query: PrintItemsPageQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.recentFailure) params.set("recentFailure", "true");
  const data = (await apiFetch(`/print/page?${params}`)) as Omit<
    PrintItemsPage,
    "items"
  > & { items: PrintItemResponse[] };
  return { ...data, items: data.items.map(fromItemResponse) };
}

export type PrintSummary = {
  itemCount: number;
  monthRecords: number;
  monthUnits: number;
  // Só os registros com falha, para o custo perdido.
  failures: PrintRecord[];
  // Categorias que têm alguma peça.
  categories: PrintCategory[];
};

// Números do topo da tela, sobre todas as peças. O mês é o do navegador.
export async function getPrintSummary(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const data = (await apiFetch(
    `/print/summary?monthStart=${encodeURIComponent(monthStart.toISOString())}`,
  )) as Omit<PrintSummary, "failures"> & { failures: PrintRecordResponse[] };
  return { ...data, failures: data.failures.map(fromRecordResponse) };
}

export async function getPrintItem(id: string) {
  return fromItemResponse(
    (await apiFetch(`/print/${id}`)) as PrintItemResponse,
  );
}

// As fotos vão numa requisição à parte (multipart), depois do registro.
async function addRecordPhotos(
  itemId: string,
  recordId: string,
  files: File[],
) {
  const body = new FormData();
  files.forEach((file) => body.append("photos", file));
  const data = (await apiFetch(`/print/${itemId}/records/${recordId}/photos`, {
    method: "POST",
    body,
  })) as ItemResponse;
  return fromItemResponse(data.data);
}

// Resultado de salvar com fotos. As fotos vão depois do registro; se só elas
// falharem, o registro já está salvo e o erro vem à parte em vez de lançar
// (salvar de novo duplicaria o registro).
export type SavedPrint = { item: PrintItem; photoError: string | null };

async function withPhotos(
  item: PrintItem,
  recordId: string,
  photos: File[],
): Promise<SavedPrint> {
  if (!photos.length) return { item, photoError: null };
  try {
    return {
      item: await addRecordPhotos(item.id, recordId, photos),
      photoError: null,
    };
  } catch (err) {
    return {
      item,
      photoError:
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar as fotos.",
    };
  }
}

/**
 * Fotos de um registro que acabou de ser salvo por outro caminho (a fila).
 * Devolve o erro em vez de lançar: o registro já está salvo.
 */
export async function uploadRecordPhotos(
  itemId: string,
  recordId: string,
  photos: File[],
) {
  if (!photos.length) return null;
  try {
    await addRecordPhotos(itemId, recordId, photos);
    return null;
  } catch (err) {
    return err instanceof ApiError
      ? err.message
      : "Não foi possível enviar as fotos.";
  }
}

export async function createPrintItem(input: PrintItemInput, photos: File[]) {
  const data = (await apiFetch("/print", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      firstRecord: toRecordPayload(input.firstRecord),
    }),
  })) as ItemResponse;
  const item = fromItemResponse(data.data);
  return withPhotos(item, item.defaultRecordId, photos);
}

export async function addPrintRecord(
  itemId: string,
  input: PrintRecordInput,
  options: { makeDefault: boolean },
  photos: File[],
) {
  const data = (await apiFetch(`/print/${itemId}/records`, {
    method: "POST",
    body: JSON.stringify({
      ...toRecordPayload(input),
      makeDefault: options.makeDefault,
    }),
  })) as ItemResponse & { recordId: string };
  return withPhotos(fromItemResponse(data.data), data.recordId, photos);
}

// Reenvia o registro inteiro; o "O que mudou" fica como estava. Depois tira
// as fotos removidas e manda as novas.
export async function updatePrintRecord(
  itemId: string,
  recordId: string,
  input: PrintRecordInput,
  options: { makeDefault: boolean },
  photos: { add: File[]; removeIds: string[] },
): Promise<SavedPrint> {
  const data = (await apiFetch(`/print/${itemId}/records/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...toRecordPayload(input),
      changeSummary: undefined,
      makeDefault: options.makeDefault,
    }),
  })) as ItemResponse;
  let item = fromItemResponse(data.data);
  try {
    for (const photoId of photos.removeIds) {
      const removed = (await apiFetch(
        `/print/${itemId}/records/${recordId}/photos/${photoId}`,
        { method: "DELETE" },
      )) as ItemResponse;
      item = fromItemResponse(removed.data);
    }
  } catch (err) {
    return {
      item,
      photoError:
        err instanceof ApiError
          ? err.message
          : "Não foi possível remover as fotos.",
    };
  }
  return withPhotos(item, recordId, photos.add);
}

export async function updatePrintPhoto(
  itemId: string,
  recordId: string,
  photoId: string,
  framing: PhotoFraming,
) {
  const data = (await apiFetch(
    `/print/${itemId}/records/${recordId}/photos/${photoId}`,
    { method: "PATCH", body: JSON.stringify(framing) },
  )) as ItemResponse;
  return fromItemResponse(data.data);
}

export async function setDefaultPrintRecord(itemId: string, recordId: string) {
  const data = (await apiFetch(`/print/${itemId}/records/${recordId}/default`, {
    method: "PATCH",
  })) as ItemResponse;
  return fromItemResponse(data.data);
}

export async function deletePrintRecord(itemId: string, recordId: string) {
  const data = (await apiFetch(`/print/${itemId}/records/${recordId}`, {
    method: "DELETE",
  })) as ItemResponse;
  return fromItemResponse(data.data);
}

export async function deletePrintItem(id: string) {
  await apiFetch(`/print/${id}`, { method: "DELETE" });
}

// Preço por grama: média do que já foi pago pelo rolo, dividida pelo peso.
export function toPrintFilament(filament: Filament): PrintFilament {
  const paid =
    (filament.minPricePaid + (filament.maxPricePaid ?? filament.minPricePaid)) /
    2;
  return {
    id: filament.id,
    colorName: filament.colorName,
    type: filament.type,
    brandName: filament.brand.name,
    colors: filament.colors,
    pricePerGram:
      filament.spoolWeightGrams > 0 ? paid / filament.spoolWeightGrams : 0,
    spoolLevel: filament.spoolLevel,
  };
}

// Só os rolos que ainda têm filamento; os acabados não aparecem para escolher.
export async function listPrintFilaments() {
  const filaments = await listFilaments();
  return filaments
    .filter(isInStock)
    .map(toPrintFilament)
    .sort((a, b) =>
      describePrintFilament(a).localeCompare(describePrintFilament(b), "pt-BR"),
    );
}

// Custo unitário de hoje: o do lote mais recente.
export async function listPrintExtraItems(): Promise<PrintExtraItem[]> {
  const items = await listExtraItems();
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    unitCost: getUnitCost(item),
  }));
}

export function describeSpoolLevel(filament: PrintFilament) {
  return SPOOL_LEVEL_LABELS[filament.spoolLevel];
}

// ---------------------------------------------------------------------------
// Cálculos

// O que o custo precisa além do registro: os parâmetros de "Custos e
// energia" e as impressoras (consumo, tarifa própria e manutenção).
export type CostContext = { settings: CostSettings; printers: Printer[] };

// Mão de obra, embalagem e margem não entram: são da venda e vão para o
// preço sugerido, no Catálogo.
export type CostBreakdown = {
  filament: number;
  energy: number;
  maintenance: number;
  extraItems: number;
  other: number;
  failureReserve: number;
  total: number;
};

type CostInput = Pick<
  PrintRecord,
  "filaments" | "totalMinutes" | "units" | "outcome"
> & {
  printer: Pick<PrintPrinter, "id">;
  // A fila ainda não tem itens extras.
  extraItems?: PrintExtraItemUsage[];
};

export function getRecordGrams(record: Pick<PrintRecord, "filaments">) {
  return record.filaments.reduce((sum, usage) => sum + usage.grams, 0);
}

export function findCostPrinter(ctx: CostContext, printerId: string | null) {
  return ctx.printers.find((p) => p.id === printerId) ?? null;
}

/** Sem consumo ou sem manutenção, a parte da impressora fica de fora. */
export function getMissingPrinterCosts(printer: Printer | null) {
  if (!printer) return ["impressora"];
  const missing: string[] = [];
  if (printer.powerConsumptionW == null) missing.push("consumo");
  if (printer.maintenanceCostPerHour == null) missing.push("manutenção");
  return missing;
}

/**
 * Valores de custo sempre sobem para o centavo seguinte. A folga desconta o
 * ruído do ponto flutuante (12,34 × 100 = 1233,9999…), que senão viraria um
 * centavo a mais.
 */
export function ceilCents(value: number) {
  // "+ 0" troca o -0 (de zero menos a folga) por 0, senão aparece "-R$ 0,00".
  return Math.ceil(value * 100 - 1e-6) / 100 + 0;
}

// Cada parte sobe para o centavo e o total é a soma das partes já
// arredondadas, para bater com o detalhamento na tela.
function ceilBreakdown(cost: CostBreakdown): CostBreakdown {
  const rounded = Object.fromEntries(
    Object.entries(cost)
      .filter(([key]) => key !== "total")
      .map(([key, value]) => [key, ceilCents(value)]),
  ) as Omit<CostBreakdown, "total">;
  const total = Object.values(rounded).reduce((sum, value) => sum + value, 0);
  return { ...rounded, total: Math.round(total * 100) / 100 };
}

function divideBreakdown(cost: CostBreakdown, units: number): CostBreakdown {
  const n = Math.max(1, units);
  return Object.fromEntries(
    Object.entries(cost).map(([key, value]) => [key, value / n]),
  ) as CostBreakdown;
}

export function computeCost(
  record: CostInput,
  ctx: CostContext,
): CostBreakdown {
  return ceilBreakdown(computeExactCost(record, ctx));
}

// Divide antes de arredondar: o custo por unidade sobe uma vez só.
export function computeCostPerUnit(
  record: CostInput,
  ctx: CostContext,
): CostBreakdown {
  return ceilBreakdown(
    divideBreakdown(computeExactCost(record, ctx), record.units),
  );
}

function computeExactCost(record: CostInput, ctx: CostContext): CostBreakdown {
  const hours = record.totalMinutes / 60;
  const printer = findCostPrinter(ctx, record.printer.id);
  // Tarifa própria da impressora; sem ela, a global.
  const tariff = printer?.energyCostPerKwh ?? ctx.settings.energyCostPerKwh;

  const filament = record.filaments.reduce(
    (sum, usage) => sum + usage.grams * usage.filament.pricePerGram,
    0,
  );
  const energy = hours * ((printer?.powerConsumptionW ?? 0) / 1000) * tariff;
  const maintenance = hours * (printer?.maintenanceCostPerHour ?? 0);
  const production = filament + energy + maintenance;

  // Na falha conta só o que foi gasto até parar: itens extras e custos fixos
  // são das peças que saem, e a reserva existe justamente para cobrir isso.
  if (record.outcome === "FAILURE") {
    return {
      filament,
      energy,
      maintenance,
      extraItems: 0,
      other: 0,
      failureReserve: 0,
      total: production,
    };
  }

  const units = Math.max(1, record.units);
  const extraItems = getExtraItemsCostPerUnit(record.extraItems ?? []) * units;
  const other = ctx.settings.otherFixedCost * units;
  const failureReserve =
    (production * ctx.settings.failureReservePercent) / 100;
  return {
    filament,
    energy,
    maintenance,
    extraItems,
    other,
    failureReserve,
    total: production + extraItems + other + failureReserve,
  };
}

export function getExtraItemsCostPerUnit(usages: PrintExtraItemUsage[]) {
  return usages.reduce(
    (sum, usage) => sum + usage.quantity * usage.extraItem.unitCost,
    0,
  );
}

/** Linhas do detalhamento do custo, sem as que deram zero por não se aplicarem. */
export function costRows(cost: CostBreakdown, ctx: CostContext) {
  const rows: [string, number][] = [
    ["Filamento", cost.filament],
    ["Energia", cost.energy],
    ["Manutenção", cost.maintenance],
    ["Itens extras", cost.extraItems],
    ["Outros", cost.other],
    [
      `Reserva p/ falhas (${formatDecimal(ctx.settings.failureReservePercent)}%)`,
      cost.failureReserve,
    ],
  ];
  // Filamento, energia e manutenção sempre aparecem, mesmo zerados.
  return rows.filter(([, value], index) => index < 3 || value > 0);
}

export function getLostCost(records: PrintRecord[], ctx: CostContext) {
  return records
    .filter((r) => r.outcome === "FAILURE")
    .reduce((sum, r) => sum + computeCost(r, ctx).total, 0);
}

export function getDefaultRecord(item: PrintItem) {
  return (
    item.records.find((r) => r.id === item.defaultRecordId) ?? item.records[0]
  );
}

export function getPerUnit(record: PrintRecord, ctx: CostContext) {
  const units = Math.max(1, record.units);
  const cost = computeCostPerUnit(record, ctx);
  return {
    grams: getRecordGrams(record) / units,
    minutes: record.totalMinutes / units,
    // Filamento à parte; "outros" é todo o resto (energia, manutenção,
    // itens extras, fixos e reserva).
    filamentCost: cost.filament,
    otherCost: Math.round((cost.total - cost.filament) * 100) / 100,
    cost: cost.total,
  };
}

/**
 * Custo por unidade se cada filamento do registro fosse trocado pelo rolo mais
 * caro em estoque do mesmo material, qualquer acabamento (as cores que o
 * catálogo oferece). Nunca
 * fica abaixo do preço guardado no registro.
 */
export function getWorstCasePerUnit(
  record: PrintRecord,
  inStock: PrintFilament[],
  ctx: CostContext,
) {
  return getWorstCaseBreakdownPerUnit(record, inStock, ctx).total;
}

/** O mesmo pior cenário, parte por parte (o Catálogo mostra o detalhamento). */
export function getWorstCaseBreakdownPerUnit(
  record: PrintRecord,
  inStock: PrintFilament[],
  ctx: CostContext,
) {
  const worst: PrintRecord = {
    ...record,
    filaments: record.filaments.map((usage) => {
      const pricePerGram = inStock
        .filter((f) => getMaterial(f.type) === getMaterial(usage.filament.type))
        .reduce(
          (max, f) => Math.max(max, f.pricePerGram),
          usage.filament.pricePerGram,
        );
      return { ...usage, filament: { ...usage.filament, pricePerGram } };
    }),
  };
  return computeCostPerUnit(worst, ctx);
}

export type PrintItemStats = {
  recordCount: number;
  units: number;
  failures: number;
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
    colors: [...colors.values()],
    lastPrintedAt: item.records[0]?.printedAt ?? null,
    lastFailureAt: failures[0]?.printedAt ?? null,
  };
}

// O que mudou em relação ao registro de base, em texto curto.
export function describeChanges(
  base: PrintRecord,
  next: Pick<PrintRecord, "printer" | "filaments" | "units" | "settings"> &
    Partial<Pick<PrintRecord, "extraItems">>,
) {
  const parts: string[] = [];
  const baseIds = base.filaments.map((u) => u.filament.id).join();
  const nextIds = next.filaments.map((u) => u.filament.id).join();
  if (baseIds !== nextIds) {
    parts.push(
      next.filaments.map((u) => describePrintFilament(u.filament)).join(" + "),
    );
  }
  if (next.extraItems) {
    const key = (usages: PrintExtraItemUsage[]) =>
      usages.map((u) => `${u.extraItem.id}:${u.quantity}`).join();
    if (key(base.extraItems) !== key(next.extraItems)) {
      parts.push(
        next.extraItems.length
          ? next.extraItems.map(describeExtraItemUsage).join(" + ")
          : "sem itens extras",
      );
    }
  }
  if (base.printer.id !== next.printer.id) parts.push(next.printer.name);
  if (base.units !== next.units) parts.push(`${next.units} un.`);
  const a = base.settings;
  const b = next.settings;
  if (!a || !b) {
    if (a) parts.push("sem config. do fatiador");
    if (b) parts.push("com config. do fatiador");
    return parts.length ? parts.join(" · ") : "mesma config.";
  }
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
    parts.push(
      b.temperatureC == null
        ? "sem temperatura"
        : a.temperatureC == null
          ? `${b.temperatureC} °C`
          : `${a.temperatureC} → ${b.temperatureC} °C`,
    );
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

export function describeExtraItemUsage(usage: PrintExtraItemUsage) {
  return `${usage.quantity}× ${usage.extraItem.name}`;
}

export function formatDecimal(value: number, maxDigits = 2) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: maxDigits });
}

// Para preencher um campo: sem ponto de milhar, que o parseDecimal leria
// errado ("1.234,5" vira zero).
export function formatDecimalInput(value: number, maxDigits = 2) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: maxDigits,
    useGrouping: false,
  });
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

export function formatSettings(s: SlicerSettings) {
  return [
    `${formatDecimal(s.layerHeightMm)} mm`,
    `${s.infillPercent}% ${s.infillPattern}`,
    `${s.walls} ${s.walls === 1 ? "parede" : "paredes"}`,
    s.temperatureC != null ? `${s.temperatureC} °C` : null,
  ]
    .filter(Boolean)
    .join(" · ");
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

// O link pode ter sido salvo sem protocolo ("makerworld.com/...").
export function modelHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function shortUrl(url: string) {
  const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const parts = clean.split("/");
  return parts.length > 2 ? `${parts[0]}/…/${parts[parts.length - 1]}` : clean;
}
