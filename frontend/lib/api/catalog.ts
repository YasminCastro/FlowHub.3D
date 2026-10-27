// Catálogo: o que é vendido. Cada item se liga a uma ou mais impressões —
// peça única, em tamanhos (uma impressão por tamanho) ou kit. O preço sai do
// registro padrão de cada impressão no pior cenário (o rolo mais caro do
// material) mais a margem, e pode ser sobrescrito.
// As cores vêm dos rolos em estoque do mesmo material.

import { formatBRL } from "../utils";
import { ApiError, apiFetch } from "./client";
import type { Category } from "./category";
import { Filament, getMaterial, isInStock } from "./filament";
import {
  CostBreakdown,
  CostContext,
  PrintItem,
  PrintPhoto,
  getDefaultRecord,
  ceilCents,
  costRows,
  formatDecimal,
  getPerUnit,
  getWorstCaseBreakdownPerUnit,
  toPrintFilament,
} from "./print";

export type CatalogKind = "SINGLE" | "SIZES" | "KIT";

export const CATALOG_KIND_LABELS: Record<CatalogKind, string> = {
  SINGLE: "Peça única",
  SIZES: "Em tamanhos",
  KIT: "Kit",
};

export type CatalogCategory = Pick<Category, "id" | "name"> & {
  color: string | null;
};

// Um tamanho (SIZES), a peça (SINGLE) ou uma das peças do kit (KIT).
export type CatalogVariant = {
  id: string;
  // "P", "M", "G"... Só conta em SIZES.
  label: string;
  // null: a impressão foi excluída depois.
  printItemId: string | null;
  // null: usa o calculado. Em KIT o preço é do kit inteiro (kitPrice).
  priceOverride: number | null;
};

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  category: CatalogCategory | null;
  kind: CatalogKind;
  variants: CatalogVariant[];
  // Só em KIT; null usa a soma do calculado das peças.
  kitPrice: number | null;
  // Fotos escolhidas entre as dos registros das impressões ligadas.
  photoIds: string[];
  createdAt: string;
};

export type CatalogVariantInput = {
  label: string;
  printItemId: string;
  priceOverride: number | null;
};

// Criar e editar mandam o item inteiro; o backend troca as variações e as
// fotos pelas que vierem.
export type CatalogItemInput = {
  name: string;
  description: string | null;
  categoryId: string | null;
  kind: CatalogKind;
  variants: CatalogVariantInput[];
  kitPrice: number | null;
  photoIds: string[];
};

// ---------------------------------------------------------------------------
// API

type ItemResponse = { message: string; data: CatalogItem };

// O que o backend responderia com o nome do campo ("variants.0.printItemId
// must be a UUID"); aqui sai uma frase para a tela.
function checkInput(input: CatalogItemInput) {
  if (!input.name.trim()) throw new ApiError("Dê um nome para o item.");
  if (input.variants.some((v) => !v.printItemId)) {
    throw new ApiError("Escolha a impressão de cada linha.");
  }
}

export async function listCatalogItems() {
  return (await apiFetch("/catalog")) as CatalogItem[];
}

export async function getCatalogItem(id: string) {
  return (await apiFetch(`/catalog/${id}`)) as CatalogItem;
}

export async function createCatalogItem(input: CatalogItemInput) {
  checkInput(input);
  const data = (await apiFetch("/catalog", {
    method: "POST",
    body: JSON.stringify(input),
  })) as ItemResponse;
  return data.data;
}

export async function updateCatalogItem(id: string, input: CatalogItemInput) {
  checkInput(input);
  const data = (await apiFetch(`/catalog/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as ItemResponse;
  return data.data;
}

export async function deleteCatalogItem(id: string) {
  await apiFetch(`/catalog/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Cálculos

function withMargin(value: number, ctx: CostContext) {
  return value * (1 + ctx.settings.defaultMarginPercent / 100);
}

/**
 * Preço sugerido de uma unidade vendida: custo do registro padrão no pior
 * cenário (cada filamento trocado pelo rolo mais caro em estoque do material,
 * já que o cliente pode escolher qualquer cor) mais a mão de obra do preparo,
 * com a margem padrão por cima, mais a embalagem pelo custo (sem margem).
 * Fica custo + lucro + embalagem = calculado. A embalagem só entra aqui: é da
 * venda, não da impressão.
 */
export function suggestPrice(
  print: PrintItem,
  filaments: Filament[],
  ctx: CostContext,
) {
  const record = getDefaultRecord(print);
  if (!record) return null;
  // A mesma conta da página da impressão, para o custo bater nas duas telas.
  const inStock = filaments.filter(isInStock).map(toPrintFilament);
  const printCost = getWorstCaseBreakdownPerUnit(record, inStock, ctx);
  const packaging = ceilCents(ctx.settings.packagingCost);
  const cost = ceilCents(printCost.total + packaging);
  const labor = ceilCents(
    (ctx.settings.prepMinutesPerPiece / 60) * ctx.settings.laborCostPerHour,
  );
  const calculated =
    Math.round(
      (ceilCents(withMargin(printCost.total + labor, ctx)) + packaging) * 100,
    ) / 100;
  const pricing: VariantPricing = {
    print: printCost,
    packaging,
    cost,
    labor,
    // O que sobra até o calculado: as linhas do detalhamento somam certinho.
    margin: ceilCents(calculated - cost - labor),
    calculated,
  };
  return {
    grams: getPerUnit(record, ctx).grams,
    cost: printCost.total,
    price: calculated,
    packagingPrice: packaging,
    pricing,
  };
}

// Do custo da impressão ao calculado, parte por parte (por unidade).
export type VariantPricing = {
  // Pior cenário de filamento, como em getWorstCasePerUnit.
  print: CostBreakdown;
  packaging: number;
  // Impressão + embalagem.
  cost: number;
  labor: number;
  margin: number;
  calculated: number;
};

/** Linhas do detalhamento do preço calculado, na ordem em que somam. */
export function pricingRows(pricing: VariantPricing, ctx: CostContext) {
  return {
    print: costRows(pricing.print, ctx),
    sale: [
      ["Embalagem", pricing.packaging],
      ["Mão de obra", pricing.labor],
      [
        `Margem (${formatDecimal(ctx.settings.defaultMarginPercent)}%)`,
        pricing.margin,
      ],
    ] as [string, number][],
  };
}

export type ResolvedVariant = CatalogVariant & {
  // null: a impressão foi excluída.
  print: PrintItem | null;
  grams: number | null;
  // Custo da impressão por unidade, igual ao da página da impressão. A
  // embalagem entra só no calculado.
  cost: number | null;
  calculated: number | null;
  // Parte do calculado que é da embalagem (sem margem); o kit desconta das
  // peças e cobra uma vez só.
  packagingPrice: number | null;
  pricing: VariantPricing | null;
  // O que vale: o manual ou, sem ele, o calculado.
  price: number | null;
  // Calculado menos o custo da impressão, a mão de obra e a embalagem: a
  // margem. Custo + mão de obra + lucro + embalagem = calculado.
  profit: number | null;
  // O mesmo com o preço manual; null sem ele.
  manualProfit: number | null;
};

export type CatalogColor = {
  filament: Filament;
  // Rolo marcado como "Acabando": pode não dar para uma unidade.
  low: boolean;
};

export type ResolvedCatalogItem = Omit<CatalogItem, "variants"> & {
  variants: ResolvedVariant[];
  // Preço único (SINGLE e KIT) ou faixa (SIZES).
  priceMin: number | null;
  priceMax: number | null;
  isManualPrice: boolean;
  // Materiais dos registros padrão das impressões ligadas.
  materials: string[];
  colors: CatalogColor[];
  // Rolos do mesmo material que acabaram e saíram da lista.
  finished: Filament[];
  photos: PrintPhoto[];
  // Todas as fotos das impressões ligadas, para escolher no formulário.
  availablePhotos: PrintPhoto[];
};

export function resolveVariant(
  variant: CatalogVariant,
  prints: PrintItem[],
  filaments: Filament[],
  ctx: CostContext,
): ResolvedVariant {
  const print = prints.find((p) => p.id === variant.printItemId) ?? null;
  const suggestion = print ? suggestPrice(print, filaments, ctx) : null;
  const price = variant.priceOverride ?? suggestion?.price ?? null;
  const pricing = suggestion?.pricing ?? null;
  const profitAt = (value: number | null) =>
    value != null && pricing
      ? Math.round(
          (value - pricing.print.total - pricing.labor - pricing.packaging) *
            100,
        ) / 100
      : null;
  return {
    ...variant,
    print,
    grams: suggestion?.grams ?? null,
    cost: suggestion?.cost ?? null,
    calculated: suggestion?.price ?? null,
    packagingPrice: suggestion?.packagingPrice ?? null,
    pricing,
    price,
    profit: profitAt(suggestion?.price ?? null),
    manualProfit: profitAt(variant.priceOverride),
  };
}

export function getMaterials(prints: (PrintItem | null)[]) {
  const types = new Set<string>();
  for (const print of prints) {
    const record = print && getDefaultRecord(print);
    record?.filaments.forEach((u) => types.add(getMaterial(u.filament.type)));
  }
  return [...types].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getCatalogColors(materials: string[], filaments: Filament[]) {
  const sameMaterial = filaments
    .filter((f) => materials.includes(getMaterial(f.type)))
    .sort((a, b) => a.colorName.localeCompare(b.colorName, "pt-BR"));
  return {
    colors: sameMaterial
      .filter(isInStock)
      .map((filament) => ({ filament, low: filament.spoolLevel === "LOW" })),
    finished: sameMaterial.filter((f) => !isInStock(f)),
  };
}

export function getPrintPhotos(prints: (PrintItem | null)[]) {
  return prints.flatMap((p) => p?.records.flatMap((r) => r.photos) ?? []);
}

export function resolveCatalogItem(
  item: CatalogItem,
  prints: PrintItem[],
  filaments: Filament[],
  ctx: CostContext,
): ResolvedCatalogItem {
  const variants = item.variants.map((v) =>
    resolveVariant(v, prints, filaments, ctx),
  );
  const linked = variants.map((v) => v.print);
  const materials = getMaterials(linked);
  const { colors, finished } = getCatalogColors(materials, filaments);
  const availablePhotos = getPrintPhotos(linked);
  const chosen = availablePhotos.filter((p) => item.photoIds.includes(p.id));

  let priceMin: number | null = null;
  let priceMax: number | null = null;
  let isManualPrice = false;
  if (item.kind === "KIT") {
    priceMin = priceMax = item.kitPrice ?? getKitCalculated(variants);
    isManualPrice = item.kitPrice != null;
  } else {
    const prices = variants.flatMap((v) => (v.price == null ? [] : [v.price]));
    if (prices.length) {
      priceMin = Math.min(...prices);
      priceMax = Math.max(...prices);
    }
    isManualPrice =
      variants.length > 0 && variants.every((v) => v.priceOverride != null);
  }

  return {
    ...item,
    variants,
    priceMin,
    priceMax,
    isManualPrice,
    materials,
    colors,
    finished,
    // Sem escolha, a primeira foto das impressões ligadas.
    photos: chosen.length ? chosen : availablePhotos.slice(0, 1),
    availablePhotos,
  };
}

/**
 * Kit: o preço calculado é a soma das peças, com uma embalagem só (o kit sai
 * numa embalagem, não uma por peça).
 */
export function getKitCalculated(variants: ResolvedVariant[]) {
  if (variants.some((v) => v.calculated == null)) return null;
  const pieces = variants.reduce(
    (sum, v) => sum + (v.calculated ?? 0) - (v.packagingPrice ?? 0),
    0,
  );
  return pieces + (variants[0]?.packagingPrice ?? 0);
}

/** Linha de total do kit: as peças somadas, com uma embalagem só. */
export function getKitTotals(variants: ResolvedVariant[]) {
  const priced = variants.map((v) => v.pricing);
  const calculated = getKitCalculated(variants);
  if (calculated == null || priced.some((p) => p == null)) return null;
  const sum = (pick: (p: VariantPricing) => number) =>
    Math.round(priced.reduce((s, p) => s + pick(p!), 0) * 100) / 100;
  const cost = sum((p) => p.print.total);
  const labor = sum((p) => p.labor);
  const packaging = priced[0]?.packaging ?? 0;
  return {
    cost,
    labor,
    packaging,
    profit: Math.round((calculated - cost - labor - packaging) * 100) / 100,
    calculated,
  };
}

// ---------------------------------------------------------------------------
// Formatação

function formatWhole(value: number) {
  return Math.round(value).toLocaleString("pt-BR");
}

// Faixa curta no card: "R$ 34 – 89".
export function formatPriceRange(min: number | null, max: number | null) {
  if (min == null || max == null) return "–";
  if (Math.abs(max - min) < 0.005) return formatBRL(min);
  return `R$ ${formatWhole(min)} – ${formatWhole(max)}`;
}

export function describeKind(item: Pick<CatalogItem, "kind" | "variants">) {
  if (item.kind === "SIZES")
    return item.variants.map((v) => v.label).join(" · ");
  if (item.kind === "KIT") {
    const n = item.variants.length;
    return `Kit · ${n} ${n === 1 ? "peça" : "peças"}`;
  }
  return null;
}

/** Maior tamanho que um rolo "Acabando" pode não comportar. */
export function lowColorWarning(
  item: Pick<ResolvedCatalogItem, "kind" | "variants">,
  color: CatalogColor,
) {
  if (!color.low) return null;
  const name = color.filament.colorName;
  if (item.kind === "SIZES" && item.variants.length > 1) {
    const largest = [...item.variants].sort(
      (a, b) => (b.grams ?? 0) - (a.grams ?? 0),
    )[0];
    return `${name} acabando · confira antes do ${largest.label}`;
  }
  return `${name} acabando · pode não dar para uma unidade`;
}
