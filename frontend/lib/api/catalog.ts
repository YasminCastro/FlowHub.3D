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
  CostContext,
  PrintItem,
  PrintPhoto,
  PrintRecord,
  getDefaultRecord,
  getPerUnit,
  getWorstCasePerUnit,
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

/**
 * O registro guarda o preço do filamento do dia em que foi impresso. Para
 * vender, vale o preço atual do rolo; filamento excluído fica com o guardado.
 */
function withCurrentFilamentPrices(
  record: PrintRecord,
  filaments: Filament[],
): PrintRecord {
  return {
    ...record,
    filaments: record.filaments.map((usage) => {
      const current = filaments.find((f) => f.id === usage.filament.id);
      if (!current) return usage;
      return {
        ...usage,
        filament: {
          ...usage.filament,
          pricePerGram: toPrintFilament(current).pricePerGram,
        },
      };
    }),
  };
}

/**
 * Preço sugerido de uma unidade: custo do registro padrão no pior cenário
 * (cada filamento trocado pelo rolo mais caro em estoque do material, já que
 * o cliente pode escolher qualquer cor) mais a mão de obra do preparo, com a
 * margem padrão por cima.
 */
export function suggestPrice(
  print: PrintItem,
  filaments: Filament[],
  ctx: CostContext,
) {
  const record = getDefaultRecord(print);
  if (!record) return null;
  const current = withCurrentFilamentPrices(record, filaments);
  const inStock = filaments.filter(isInStock).map(toPrintFilament);
  const cost = getWorstCasePerUnit(current, inStock, ctx);
  const labor =
    (ctx.settings.prepMinutesPerPiece / 60) * ctx.settings.laborCostPerHour;
  return {
    grams: getPerUnit(current, ctx).grams,
    cost,
    price: (cost + labor) * (1 + ctx.settings.defaultMarginPercent / 100),
  };
}

export type ResolvedVariant = CatalogVariant & {
  // null: a impressão foi excluída.
  print: PrintItem | null;
  grams: number | null;
  cost: number | null;
  calculated: number | null;
  // O que vale: o manual ou, sem ele, o calculado.
  price: number | null;
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
  return {
    ...variant,
    print,
    grams: suggestion?.grams ?? null,
    cost: suggestion?.cost ?? null,
    calculated: suggestion?.price ?? null,
    price: variant.priceOverride ?? suggestion?.price ?? null,
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

/** Kit: o preço calculado é a soma das peças. */
export function getKitCalculated(variants: ResolvedVariant[]) {
  if (variants.some((v) => v.calculated == null)) return null;
  return variants.reduce((sum, v) => sum + (v.calculated ?? 0), 0);
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
