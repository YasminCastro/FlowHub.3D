import { apiFetch } from "./client";

/** Uma compra de lote: é dela que sai o custo unitário. */
export type ExtraItemLot = {
  id: string;
  purchasedAt: string;
  price: number;
  quantity: number;
};

export type ExtraItem = {
  id: string;
  name: string;
  notes: string | null;
  // Lote mais recente: define o custo unitário atual.
  lotPrice: number;
  lotQuantity: number;
  // Resumo do histórico de lotes, calculado pelo servidor.
  lotCount: number;
  totalInvested: number;
  lastPurchasedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Lotes do mais recente para o mais antigo. */
export type ExtraItemWithHistory = ExtraItem & { lots: ExtraItemLot[] };

export type ExtraItemInput = {
  name: string;
  // Na criação viram o primeiro lote; na edição corrigem o mais recente.
  lotPrice: number;
  lotQuantity: number;
  /** Só na criação. Sem data, o servidor usa hoje. */
  purchasedAt?: string;
  notes?: string | null;
};

export type ExtraItemUpdateInput = Partial<Omit<ExtraItemInput, "purchasedAt">>;

export type ExtraItemLotInput = {
  purchasedAt: string;
  price: number;
  quantity: number;
};

export function getUnitCost(item: { lotPrice: number; lotQuantity: number }) {
  return item.lotQuantity > 0 ? item.lotPrice / item.lotQuantity : 0;
}

export function formatUnits(count: number) {
  return `${count.toLocaleString("pt-BR")} un`;
}

export async function listExtraItems() {
  return (await apiFetch("/extra-item")) as ExtraItem[];
}

export async function getExtraItem(id: string) {
  return (await apiFetch(`/extra-item/${id}`)) as ExtraItemWithHistory;
}

export async function createExtraItem(input: ExtraItemInput) {
  const data = (await apiFetch("/extra-item", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: ExtraItemWithHistory };
  return data.data;
}

export async function updateExtraItem(id: string, input: ExtraItemUpdateInput) {
  const data = (await apiFetch(`/extra-item/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { message: string; data: ExtraItemWithHistory };
  return data.data;
}

// Recompra: o lote entra no histórico e, se for o mais recente, passa a
// definir o custo unitário.
export async function registerExtraItemLot(
  id: string,
  input: ExtraItemLotInput,
) {
  const data = (await apiFetch(`/extra-item/${id}/lots`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: ExtraItemWithHistory };
  return data.data;
}

export async function deleteExtraItem(id: string) {
  return (await apiFetch(`/extra-item/${id}`, {
    method: "DELETE",
  })) as { message: string };
}

// Lote registrado por engano. O servidor recusa excluir o único lote do item.
export async function deleteExtraItemLot(id: string, lotId: string) {
  const data = (await apiFetch(`/extra-item/${id}/lots/${lotId}`, {
    method: "DELETE",
  })) as { message: string; data: ExtraItemWithHistory };
  return data.data;
}
