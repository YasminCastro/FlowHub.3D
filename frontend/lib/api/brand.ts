import { apiFetch } from "./client";

export type PurchaseChannel =
  | "OWN_SITE"
  | "MERCADO_LIVRE"
  | "AMAZON"
  | "SHOPEE"
  | "ALIEXPRESS"
  | "PHYSICAL_STORE"
  | "OTHER";

export const PURCHASE_CHANNEL_LABELS: Record<PurchaseChannel, string> = {
  OWN_SITE: "Site próprio",
  MERCADO_LIVRE: "Mercado Livre",
  AMAZON: "Amazon",
  SHOPEE: "Shopee",
  ALIEXPRESS: "AliExpress",
  PHYSICAL_STORE: "Loja física",
  OTHER: "Outro canal",
};

export const PURCHASE_CHANNELS = Object.keys(
  PURCHASE_CHANNEL_LABELS,
) as PurchaseChannel[];

export type BrandStatus = "PURCHASED" | "RESEARCHED";

export const BRAND_STATUS_LABELS: Record<BrandStatus, string> = {
  PURCHASED: "Já comprei",
  RESEARCHED: "Só pesquisei",
};

export const FILAMENT_TYPE_OPTIONS = [
  "PLA",
  "PLA Matte",
  "PETG",
  "ABS",
  "TPU",
  "PLA Silk",
  "Resina",
];

export type BrandNote = {
  id: string;
  content: string;
  brandId: string;
  createdAt: string;
  updatedAt: string;
};

export type Brand = {
  id: string;
  name: string;
  website: string | null;
  purchaseChannels: PurchaseChannel[];
  filamentTypes: string[];
  preferredColors: string[];
  status: BrandStatus;
  researchedMinPricePerKg: number | null;
  researchedMaxPricePerKg: number | null;
  isFavorite: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrandWithNotes = Brand & { notes: BrandNote[] };

export type BrandInput = {
  name: string;
  website?: string | null;
  purchaseChannels?: PurchaseChannel[];
  filamentTypes?: string[];
  preferredColors?: string[];
  status?: BrandStatus;
  // Na edição, null limpa a faixa (ex: a marca passou para "Já comprei").
  researchedMinPricePerKg?: number | null;
  researchedMaxPricePerKg?: number | null;
  isFavorite?: boolean;
  // Só na criação: vira a primeira observação datada da marca.
  notes?: string;
};

export type BrandUpdateInput = Partial<Omit<BrandInput, "notes">> & {
  archived?: boolean;
};

export async function listBrands(options: { archived?: boolean } = {}) {
  const query = options.archived ? "?archived=true" : "";
  return (await apiFetch(`/brand${query}`)) as Brand[];
}

export async function getBrand(id: string) {
  return (await apiFetch(`/brand/${id}`)) as BrandWithNotes;
}

export async function createBrand(input: BrandInput) {
  const data = (await apiFetch("/brand", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: BrandWithNotes };
  return data.data;
}

export async function updateBrand(id: string, input: BrandUpdateInput) {
  const data = (await apiFetch(`/brand/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { message: string; data: BrandWithNotes };
  return data.data;
}

export async function deleteBrand(id: string) {
  return (await apiFetch(`/brand/${id}`, {
    method: "DELETE",
  })) as { message: string };
}

export async function addBrandNote(brandId: string, content: string) {
  const data = (await apiFetch(`/brand/${brandId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })) as { message: string; data: BrandNote };
  return data.data;
}

export async function updateBrandNote(
  brandId: string,
  noteId: string,
  content: string,
) {
  const data = (await apiFetch(`/brand/${brandId}/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  })) as { message: string; data: BrandNote };
  return data.data;
}

export async function deleteBrandNote(brandId: string, noteId: string) {
  return (await apiFetch(`/brand/${brandId}/notes/${noteId}`, {
    method: "DELETE",
  })) as { message: string };
}

export type ResearchedPrice = {
  min: number | null;
  max: number | null;
  average: number;
};

// Preço por kg de uma marca "Só pesquisei": a média entre o mínimo e o
// máximo pesquisados, ou o único lado informado. Sem pesquisa, null.
export function getResearchedPrice(
  brand: Pick<
    Brand,
    "status" | "researchedMinPricePerKg" | "researchedMaxPricePerKg"
  >,
): ResearchedPrice | null {
  if (brand.status !== "RESEARCHED") return null;
  const min = brand.researchedMinPricePerKg;
  const max = brand.researchedMaxPricePerKg;
  const values = [min, max].filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return {
    min,
    max,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

export function formatResearchedRange({ min, max }: ResearchedPrice) {
  const format = (value: number) =>
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  return format((min ?? max)!);
}

export type CostBenefit = "GOOD" | "MODERATE" | "HIGH";

export const COST_BENEFIT_LABELS: Record<CostBenefit, string> = {
  GOOD: "Bom",
  MODERATE: "Moderado",
  HIGH: "Alto",
};

// Até 10% para cima ou para baixo da média ainda é "Moderado".
const COST_BENEFIT_TOLERANCE = 0.1;

// Média do preço por kg das marcas que têm preço. Com menos de duas não há
// com o que comparar, então não existe média.
export function getAveragePricePerKg(
  brands: Pick<
    Brand,
    "status" | "researchedMinPricePerKg" | "researchedMaxPricePerKg"
  >[],
) {
  const prices = brands
    .map((brand) => getResearchedPrice(brand)?.average)
    .filter((price): price is number => price != null);
  if (prices.length < 2) return null;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

export function getCostBenefit(
  pricePerKg: number | null | undefined,
  averagePricePerKg: number | null,
): CostBenefit | null {
  if (pricePerKg == null || averagePricePerKg == null) return null;
  if (pricePerKg < averagePricePerKg * (1 - COST_BENEFIT_TOLERANCE)) {
    return "GOOD";
  }
  if (pricePerKg > averagePricePerKg * (1 + COST_BENEFIT_TOLERANCE)) {
    return "HIGH";
  }
  return "MODERATE";
}

// O site pode ter sido salvo sem protocolo ("voolt3d.com.br").
export function brandWebsiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}
