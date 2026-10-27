import { apiFetch } from "./client";
import { Slicer } from "./calibration";

// Flushing volumes de um par de filamentos, numa impressora e num fatiador:
// a tabela do fatiador só para os dois. A direção conta (escuro → claro pede
// mais purga que claro → escuro), então cada lado tem o seu volume e o seu
// Color Multiplier. A + B e B + A são o mesmo registro.

/** Mesmas faixas da API (dto/flushing.ts no backend). */
export const FLUSH_VOLUME_MAX = 20000;
export const FLUSH_MULTIPLIER_MAX = 3;
/** Faixa que o fatiador sugere para o volume, em mm³. */
export const FLUSH_VOLUME_SUGGESTED = { min: 79, max: 20000 };

export type FlushPairFilament = {
  id: string;
  colorName: string;
  type: string;
  colors: string[];
  brand: { name: string };
};

export type FlushPairValues = {
  /** mm³ ao sair do A e entrar no B. */
  volumeAToB: number | null;
  volumeBToA: number | null;
  colorMultiplierA: number | null;
  colorMultiplierB: number | null;
  multiplier: number | null;
};

export type FlushPair = FlushPairValues & {
  id: string;
  slicer: Slicer;
  filamentAId: string;
  filamentBId: string;
  printerId: string;
  filamentA: FlushPairFilament;
  filamentB: FlushPairFilament;
  printer: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type FlushPairInput = FlushPairValues & {
  filamentAId: string;
  filamentBId: string;
  printerId: string;
  slicer: Slicer;
};

type FlushPairResponse = { message: string; data: FlushPair };

export async function listFlushPairs() {
  return (await apiFetch("/flush-pairs")) as FlushPair[];
}

export async function getFlushPair(id: string) {
  return (await apiFetch(`/flush-pairs/${id}`)) as FlushPair;
}

export async function createFlushPair(input: FlushPairInput) {
  const data = (await apiFetch("/flush-pairs", {
    method: "POST",
    body: JSON.stringify(input),
  })) as FlushPairResponse;
  return data.data;
}

export async function updateFlushPair(id: string, input: FlushPairInput) {
  const data = (await apiFetch(`/flush-pairs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as FlushPairResponse;
  return data.data;
}

export async function deleteFlushPair(id: string) {
  await apiFetch(`/flush-pairs/${id}`, { method: "DELETE" });
}

/** Degradê da primeira cor de um filamento para a do outro. */
export function flushPairGradient(
  a: { colors: string[] },
  b: { colors: string[] },
) {
  const from = a.colors[0] ?? "#6b6f80";
  const to = b.colors[0] ?? "#6b6f80";
  return `linear-gradient(135deg, ${from} 15%, ${to} 85%)`;
}

export const formatFlushMultiplier = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatFlushVolume = (value: number) =>
  `${value.toLocaleString("pt-BR")} mm³`;
