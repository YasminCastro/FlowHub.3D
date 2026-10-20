// Fila de impressão: o que vai imprimir, na ordem. Cada item tem um orçamento
// rápido (filamento e tempo) e, ao ser concluído, vira um registro em
// Impressões. Se falha, volta para a fila marcado.

import { apiFetch } from "./client";
import {
  CostBreakdown,
  CostContext,
  PrintFilamentUsage,
  PrintFilamentUsageResponse,
  PrintItemRef,
  PrintPrinter,
  PrintRecordInput,
  computeCost,
  fromUsageResponse,
  toRecordPayload,
  uploadRecordPhotos,
} from "./print";

export type QueueFailure = { at: string; reason: string };

// Para onde o item foi quando concluído.
export type QueueResult = { item: PrintItemRef; createdItem: boolean };

export type QueueEntry = {
  id: string;
  // Nome da peça. Ligado a uma impressão, é o nome dela no dia.
  name: string;
  // null: peça nova, que vira impressão quando for concluída.
  printItem: PrintItemRef | null;
  printer: PrintPrinter;
  // Gramas e tempo do lote inteiro (todas as unidades).
  filaments: PrintFilamentUsage[];
  units: number;
  totalMinutes: number;
  customer: string | null;
  modelUrl: string | null;
  createdAt: string;
  // A última falha; some quando o item é concluído com sucesso.
  lastFailure: QueueFailure | null;
  completedAt: string | null;
  result: QueueResult | null;
};

export type QueueEntryInput = Pick<
  QueueEntry,
  | "name"
  | "printItem"
  | "printer"
  | "filaments"
  | "units"
  | "totalMinutes"
  | "customer"
  | "modelUrl"
>;

export type QueuePosition = "first" | "last";

// Onde registrar ao concluir: numa impressão existente ou criando uma nova.
// Na falha de uma peça nova não há onde registrar (null): só a fila marca.
export type QueueTarget =
  | { printItemId: string }
  | { newItem: { name: string; categoryId: string | null } }
  | null;

// Quantos dias os concluídos aparecem embaixo da fila.
export const RECENT_DONE_DAYS = 7;

// ---------------------------------------------------------------------------
// API

type QueueEntryResponse = Omit<QueueEntry, "filaments"> & {
  filaments: PrintFilamentUsageResponse[];
};

type EntryResponse = { message: string; data: QueueEntryResponse };

function fromEntryResponse(entry: QueueEntryResponse): QueueEntry {
  return { ...entry, filaments: entry.filaments.map(fromUsageResponse) };
}

// Pendentes na ordem da fila; concluídos do mais recente para o mais antigo.
export async function listQueue() {
  const data = (await apiFetch("/print-queue")) as {
    pending: QueueEntryResponse[];
    done: QueueEntryResponse[];
  };
  return {
    pending: data.pending.map(fromEntryResponse),
    done: data.done.map(fromEntryResponse),
  };
}

export async function getQueueEntry(id: string) {
  return fromEntryResponse(
    (await apiFetch(`/print-queue/${id}`)) as QueueEntryResponse,
  );
}

export async function addToQueue(
  input: QueueEntryInput,
  position: QueuePosition,
) {
  if (!input.printer.id) throw new Error("Escolha a impressora.");
  const data = (await apiFetch("/print-queue", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      printItemId: input.printItem?.id ?? null,
      printerId: input.printer.id,
      filaments: input.filaments.map((usage) => ({
        filamentId: usage.filament.id,
        grams: Math.round(usage.grams * 100) / 100,
      })),
      units: input.units,
      totalMinutes: Math.round(input.totalMinutes),
      customer: input.customer,
      modelUrl: input.modelUrl,
      position,
    }),
  })) as EntryResponse;
  return fromEntryResponse(data.data);
}

/** Recebe os ids pendentes na nova ordem. */
export async function reorderQueue(ids: string[]) {
  const data = (await apiFetch("/print-queue/order", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  })) as { message: string; data: QueueEntryResponse[] };
  return data.data.map(fromEntryResponse);
}

export async function removeFromQueue(id: string) {
  await apiFetch(`/print-queue/${id}`, { method: "DELETE" });
}

export type FinishedQueueEntry = {
  entry: QueueEntry;
  // A impressão onde o registro foi gravado; null na falha de peça nova.
  item: PrintItemRef | null;
  photoError: string | null;
};

/**
 * Conclui (ou registra a falha de) um item: o backend grava o registro em
 * Impressões e atualiza a fila. As fotos vão depois, para o registro criado.
 */
export async function finishQueueEntry(
  id: string,
  target: QueueTarget,
  record: PrintRecordInput,
  options: { makeDefault: boolean },
  photos: File[],
): Promise<FinishedQueueEntry> {
  const data = (await apiFetch(`/print-queue/${id}/finish`, {
    method: "POST",
    body: JSON.stringify({
      ...target,
      record: { ...toRecordPayload(record), makeDefault: options.makeDefault },
    }),
  })) as EntryResponse & {
    item: PrintItemRef | null;
    recordId: string | null;
  };
  const item = data.item ? { id: data.item.id, name: data.item.name } : null;
  const photoError =
    item && data.recordId
      ? await uploadRecordPhotos(item.id, data.recordId, photos)
      : null;
  return { entry: fromEntryResponse(data.data), item, photoError };
}

// ---------------------------------------------------------------------------
// Cálculos

export function getEntryGrams(entry: Pick<QueueEntry, "filaments">) {
  return entry.filaments.reduce((sum, usage) => sum + usage.grams, 0);
}

export type QueueQuote = {
  breakdown: CostBreakdown;
  cost: number;
  labor: number;
  price: number;
};

/**
 * Orçamento rápido: custo do lote (como em Impressões), mais a mão de obra
 * de um preparo, com a margem padrão por cima. O preço final é definido no
 * Catálogo.
 *
 * Uma entrada é uma impressão: as unidades saem juntas da mesma mesa, então
 * o preparo conta uma vez, não uma por unidade.
 */
export function quoteEntry(
  entry: Pick<QueueEntry, "filaments" | "totalMinutes" | "units" | "printer">,
  ctx: CostContext,
): QueueQuote {
  const breakdown = computeCost({ ...entry, outcome: "SUCCESS" }, ctx);
  const cost = breakdown.total;
  const labor =
    (ctx.settings.prepMinutesPerPiece / 60) * ctx.settings.laborCostPerHour;
  const price = (cost + labor) * (1 + ctx.settings.defaultMarginPercent / 100);
  return { breakdown, cost, labor, price };
}

export function isRecentlyDone(entry: QueueEntry, now = new Date()) {
  if (!entry.completedAt) return false;
  const days =
    (now.getTime() - new Date(entry.completedAt).getTime()) / 86_400_000;
  return days <= RECENT_DONE_DAYS;
}
