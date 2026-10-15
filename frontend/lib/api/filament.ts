import { apiFetch } from "./client";
import { PurchaseChannel } from "./brand";

export const FILAMENT_TYPES = [
  "PLA",
  "PLA Matte",
  "PLA Silk",
  "PETG",
  "ABS",
  "TPU",
];

/**
 * Material base do tipo: "PLA Matte" e "PLA Silk" são PLA. Só muda o
 * acabamento, então para cores e preço contam como o mesmo material.
 */
export function getMaterial(type: string) {
  return type.trim().split(/\s+/)[0] ?? type;
}

export const SPOOL_WEIGHT_OPTIONS = [250, 500, 750, 1000, 2000];

// Rolos duo e tri color: até 3 cores.
export const FILAMENT_COLORS_MAX_COUNT = 3;

export type FilamentAvailability = "AVAILABLE" | "SOLD_OUT";

export const FILAMENT_AVAILABILITY_LABELS: Record<
  FilamentAvailability,
  string
> = {
  AVAILABLE: "Disponível",
  SOLD_OUT: "Esgotado",
};

// Quanto tem no carretel. Provisório: o usuário marca à mão enquanto o
// consumo das impressões não é registrado.
export type SpoolLevel = "FULL" | "LOW" | "FINISHED";

export const SPOOL_LEVEL_LABELS: Record<SpoolLevel, string> = {
  FULL: "Cheio",
  LOW: "Acabando",
  FINISHED: "Acabou",
};

export type FilamentNote = {
  id: string;
  content: string;
  filamentId: string;
  createdAt: string;
  updatedAt: string;
};

// Um filamento é o produto (marca + tipo + cor), comprado uma ou mais vezes.
export type Filament = {
  id: string;
  brandId: string;
  brand: { id: string; name: string };
  type: string;
  colorName: string;
  // De 1 a 3 cores em hex, na ordem do degradê da amostra.
  colors: string[];
  spoolWeightGrams: number;
  // Preço pago pelo rolo inteiro (não por kg), menor e maior entre as compras.
  minPricePaid: number;
  maxPricePaid: number | null;
  purchaseCount: number;
  lastPurchasedAt: string | null;
  purchaseChannel: PurchaseChannel | null;
  availability: FilamentAvailability;
  // Comprado no outlet: em geral troca de cor, um rolo bem específico.
  isOutlet: boolean;
  spoolLevel: SpoolLevel;
  // Quando o carretel foi marcado como acabado; null nos outros níveis.
  finishedAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  // Configurações do fabricante (°C): faixa do bico e da mesa.
  nozzleTempMin: number | null;
  nozzleTempMax: number | null;
  bedTempMin: number | null;
  bedTempMax: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FilamentWithDetails = Filament & { notes: FilamentNote[] };

export type FilamentInput = {
  brandId: string;
  type: string;
  colorName: string;
  colors: string[];
  spoolWeightGrams: number;
  minPricePaid: number;
  maxPricePaid?: number | null;
  purchaseCount?: number;
  lastPurchasedAt?: string | null;
  purchaseChannel?: PurchaseChannel | null;
  availability?: FilamentAvailability;
  isOutlet?: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  nozzleTempMin?: number | null;
  nozzleTempMax?: number | null;
  bedTempMin?: number | null;
  bedTempMax?: number | null;
  // Só na criação: vira a primeira observação datada do filamento.
  notes?: string;
};

export type FilamentUpdateInput = Partial<Omit<FilamentInput, "notes">> & {
  // Ao marcar FINISHED o servidor guarda a data em que acabou.
  spoolLevel?: SpoolLevel;
};

export type FilamentPurchaseInput = {
  pricePaid: number;
  purchasedAt: string;
};

export async function listFilaments() {
  return (await apiFetch("/filament")) as Filament[];
}

export async function getFilament(id: string) {
  return (await apiFetch(`/filament/${id}`)) as FilamentWithDetails;
}

export async function createFilament(input: FilamentInput) {
  const data = (await apiFetch("/filament", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: FilamentWithDetails };
  return data.data;
}

export async function updateFilament(id: string, input: FilamentUpdateInput) {
  const data = (await apiFetch(`/filament/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { message: string; data: FilamentWithDetails };
  return data.data;
}

// Mais uma compra do mesmo filamento: o servidor soma a compra, ajusta a
// faixa de preço e volta o filamento para o estoque.
export async function addFilamentPurchase(
  id: string,
  input: FilamentPurchaseInput,
) {
  const data = (await apiFetch(`/filament/${id}/purchases`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: FilamentWithDetails };
  return data.data;
}

export async function deleteFilament(id: string) {
  return (await apiFetch(`/filament/${id}`, {
    method: "DELETE",
  })) as { message: string };
}

export async function addFilamentNote(filamentId: string, content: string) {
  const data = (await apiFetch(`/filament/${filamentId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })) as { message: string; data: FilamentNote };
  return data.data;
}

// ——— Cálculos ———

export function isInStock(filament: Pick<Filament, "spoolLevel">) {
  return filament.spoolLevel !== "FINISHED";
}

export type PricePerKg = {
  min: number;
  max: number;
  average: number;
};

// O preço é cadastrado por rolo; aqui vira por kg para comparar rolos de
// pesos diferentes.
export function getPricePerKg(
  filament: Pick<
    Filament,
    "minPricePaid" | "maxPricePaid" | "spoolWeightGrams"
  >,
): PricePerKg | null {
  const kg = filament.spoolWeightGrams / 1000;
  if (!kg || !(filament.minPricePaid > 0)) return null;
  const min = filament.minPricePaid / kg;
  const max = (filament.maxPricePaid ?? filament.minPricePaid) / kg;
  return { min, max, average: (min + max) / 2 };
}

const formatInteger = (value: number) =>
  Math.round(value).toLocaleString("pt-BR");

// "R$ 112 – 118 / kg"; preço único vira um número só.
export function formatPricePerKg(price: PricePerKg, suffix = " / kg") {
  const min = formatInteger(price.min);
  const max = formatInteger(price.max);
  return `R$ ${min === max ? min : `${min} – ${max}`}${suffix}`;
}

export function formatSpoolWeight(grams: number) {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString("pt-BR")} kg`
    : `${grams} g`;
}

export function formatRating(rating: number) {
  return rating.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function isValidHex(value: string) {
  return HEX_PATTERN.test(value);
}

function shade(hex: string, amount: number) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const target = amount < 0 ? 0 : 255;
  const factor = Math.abs(amount);
  return `#${channels
    .map((c) =>
      Math.round(c + (target - c) * factor)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const FALLBACK_COLOR = "#3f424d";

// A amostra da cor. Uma cor: leve degradê dela mesma, para dar volume. Duas
// ou três: cada cor ocupa uma faixa na diagonal, com transição suave entre
// elas. Em amostras pequenas (compact) a transição é curta, senão cores
// parecidas viram uma mancha só.
export function filamentSwatchBackground(colors: string[], compact = false) {
  const valid = colors.filter(isValidHex);
  if (valid.length <= 1) {
    const color = valid[0] ?? FALLBACK_COLOR;
    return `linear-gradient(145deg, ${shade(color, 0.12)}, ${shade(color, -0.22)})`;
  }

  const band = 100 / valid.length;
  // Metade da transição, proporcional à faixa: com 3 cores a do meio
  // continua com uma parte sólida.
  const blend = band * (compact ? 0.12 : 0.3);
  const stops = valid.flatMap((color, i) => {
    const start = i === 0 ? 0 : i * band + blend;
    const end = i === valid.length - 1 ? 100 : (i + 1) * band - blend;
    return [`${color} ${+start.toFixed(1)}%`, `${color} ${+end.toFixed(1)}%`];
  });
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}
