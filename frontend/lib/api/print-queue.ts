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
  note: string | null;
  // Pedido feito por alguém pelo link público da fila.
  fromShareLink: boolean;
  // Como falar com quem pediu; só nos pedidos do link.
  requesterContact: string | null;
  // Cores que quem pediu quer (texto livre); só nos pedidos do link.
  requestedColors: string | null;
  createdAt: string;
  // A última falha; some quando o item é concluído com sucesso.
  lastFailure: QueueFailure | null;
  // Na impressora desde esta hora; null enquanto espera a vez. Um por
  // impressora.
  startedAt: string | null;
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
  | "note"
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

function toEntryPayload(input: QueueEntryInput) {
  if (!input.printer.id) throw new Error("Escolha a impressora.");
  return {
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
    note: input.note,
  };
}

export async function addToQueue(
  input: QueueEntryInput,
  position: QueuePosition,
) {
  const data = (await apiFetch("/print-queue", {
    method: "POST",
    body: JSON.stringify({ ...toEntryPayload(input), position }),
  })) as EntryResponse;
  return fromEntryResponse(data.data);
}

// ---------------------------------------------------------------------------
// Calibração: os testes de um filamento entram na fila de uma vez, nesta
// ordem, cada um com o tempo e as gramas de uma impressão do teste.

export const CALIBRATION_TESTS = [
  { id: "temperature", label: "Temperatura", minutes: 60, grams: 15 },
  { id: "maxFlow", label: "Max flow", minutes: 36, grams: 29 },
  { id: "pressureAdvance", label: "Pressure advance", minutes: 8, grams: 2 },
  { id: "flowRate", label: "Flow rate", minutes: 32, grams: 14 },
  { id: "retraction", label: "Retraction", minutes: 8, grams: 1 },
] as const;

export type CalibrationTestId = (typeof CALIBRATION_TESTS)[number]["id"];

/**
 * Adiciona os testes escolhidos para o filamento, na ordem de
 * CALIBRATION_TESTS (não na ordem em que foram marcados). Devolve os itens
 * criados, na ordem da fila.
 */
export async function addCalibrationToQueue(
  {
    filament,
    printerId,
    testIds,
  }: {
    filament: {
      id: string;
      brandName: string;
      type: string;
      colorName: string;
    };
    printerId: string;
    testIds: CalibrationTestId[];
  },
  position: QueuePosition,
) {
  const tests = CALIBRATION_TESTS.filter((t) => testIds.includes(t.id));
  const filamentName = `${filament.brandName} ${filament.type} ${filament.colorName}`;
  const data = (await apiFetch("/print-queue/batch", {
    method: "POST",
    body: JSON.stringify({
      position,
      entries: tests.map((test) => ({
        name: `Calibração ${test.label} · ${filamentName}`.slice(0, 120),
        printItemId: null,
        printerId,
        filaments: [{ filamentId: filament.id, grams: test.grams }],
        units: 1,
        totalMinutes: test.minutes,
        customer: null,
        modelUrl: null,
        note: null,
      })),
    }),
  })) as { message: string; data: QueueEntryResponse[] };
  return data.data.map(fromEntryResponse);
}

// Só pendentes. A posição não muda aqui, só arrastando na fila.
export async function updateQueueEntry(id: string, input: QueueEntryInput) {
  const data = (await apiFetch(`/print-queue/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toEntryPayload(input)),
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

/**
 * Marca que o item está na impressora agora. O que estava na mesma
 * impressora perde a marcação (no backend; recarregue a fila para ver).
 */
export async function startQueueEntry(id: string) {
  const data = (await apiFetch(`/print-queue/${id}/start`, {
    method: "POST",
  })) as EntryResponse;
  return fromEntryResponse(data.data);
}

/** Tira a marcação sem concluir. */
export async function stopQueueEntry(id: string) {
  const data = (await apiFetch(`/print-queue/${id}/start`, {
    method: "DELETE",
  })) as EntryResponse;
  return fromEntryResponse(data.data);
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
// Link público: outras pessoas pedem impressões sem login. O pedido entra no
// fim da fila, sem impressora, filamento nem tempo.

type ShareLinkResponse = { token: string | null };

/** Endereço da página pública de pedidos para o token. */
export function shareLinkUrl(token: string) {
  return `${window.location.origin}/pedido/${token}`;
}

export async function getShareLink() {
  return ((await apiFetch("/print-queue/share")) as ShareLinkResponse).token;
}

/** Cria o link ou troca por um novo; o antigo para de funcionar. */
export async function regenerateShareLink() {
  const data = (await apiFetch("/print-queue/share", {
    method: "POST",
  })) as ShareLinkResponse;
  return data.token!;
}

export async function disableShareLink() {
  await apiFetch("/print-queue/share", { method: "DELETE" });
}

export type ShareRequestInput = {
  name: string;
  requesterName: string;
  contact: string | null;
  colors: string;
  units: number;
  modelUrl: string;
  note: string | null;
};

// A fila como o link mostra: só o que é da peça, com gramas, custo e preço
// sugerido já calculados. Cliente, contato e observação não vêm do backend.
export type SharedQueueEntry = {
  id: string;
  name: string;
  units: number;
  // 0: ainda sem tempo estimado.
  totalMinutes: number;
  // "": impressora ainda não escolhida.
  printerName: string;
  fromShareLink: boolean;
  // Falhou e voltou para a fila.
  retrying: boolean;
  // Na impressora desde esta hora; null enquanto espera a vez.
  startedAt: string | null;
  // Gramas do lote inteiro; 0: filamento ainda não informado.
  grams: number;
  // Custo estimado do lote, calculado no backend (como o "Custo" da fila).
  // null: sem filamento ou sem tempo, ainda não dá para orçar.
  cost: number | null;
  // Só o filamento do lote; aparece mesmo sem tempo. null sem filamento.
  filamentCost: number | null;
  // Preço sugerido do lote (como o "Preço sug." da fila); null junto com o
  // custo.
  price: number | null;
};

// Concluído mostra a mesma estimativa que tinha na fila (o gasto real fica
// no registro em Impressões, que não é público).
export type SharedDoneEntry = SharedQueueEntry & { completedAt: string };

export type SharedQueue = {
  ownerName: string | null;
  pending: SharedQueueEntry[];
  // Os últimos concluídos (até 5), do mais recente para o mais antigo.
  done: SharedDoneEntry[];
};

/** Sem login. 404 quando o link não existe ou foi desativado. */
export async function getSharedQueue(token: string) {
  return (await apiFetch(
    `/public-queue/${encodeURIComponent(token)}`,
  )) as SharedQueue;
}

/** Devolve o id do pedido criado. */
export async function sendShareRequest(
  token: string,
  input: ShareRequestInput,
) {
  const data = (await apiFetch(`/public-queue/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; id: string };
  return data.id;
}

// ---------------------------------------------------------------------------
// Cálculos

export function getEntryGrams(entry: Pick<QueueEntry, "filaments">) {
  return entry.filaments.reduce((sum, usage) => sum + usage.grams, 0);
}

// Filamento e tempo são opcionais ao adicionar; sem eles não há orçamento.
export function hasEstimate(
  entry: Pick<QueueEntry, "filaments" | "totalMinutes">,
) {
  return entry.filaments.length > 0 && entry.totalMinutes > 0;
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
 *
 * Espelhada no backend (backend/src/print-queue/queue-cost.ts) para a fila do
 * link público: mudou a conta aqui, muda lá também.
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

export type QueueSort = "manual" | "shortest" | "longest";

export type QueueView = { sort: QueueSort; byFilament: boolean };

function filamentIds(entry: QueueEntry) {
  return entry.filaments.map((usage) => usage.filament.id);
}

/**
 * Quantas vezes é preciso pôr um rolo seguindo esta ordem: cada filamento
 * que o item usa e o anterior não usava conta uma troca.
 */
export function countFilamentSwaps(entries: QueueEntry[]) {
  return entries.reduce((swaps, entry, i) => {
    if (i === 0) return swaps;
    const previous = new Set(filamentIds(entries[i - 1]));
    return swaps + filamentIds(entry).filter((id) => !previous.has(id)).length;
  }, 0);
}

/**
 * Ordena os pendentes (recebidos na ordem manual) sem mexer na fila salva.
 * Empates ficam na ordem manual.
 *
 * Por filamento, segue uma sequência de rolos para trocar o mínimo possível.
 * Os filamentos entram na sequência na ordem em que aparecem (já ordenados
 * pelo tempo, se for o caso), e cada item vai para o trecho do primeiro e do
 * último rolo que usa: vermelho, depois vermelho + preto, depois preto.
 * Itens com os mesmos rolos ficam na ordem escolhida.
 */
export function sortQueue(entries: QueueEntry[], view: QueueView) {
  const direction = view.sort === "shortest" ? 1 : -1;
  // sort é estável: empates mantêm a ordem manual.
  const sorted =
    view.sort === "manual"
      ? entries
      : [...entries].sort(
          (a, b) =>
            // Sem tempo informado, vai para o fim nas duas direções.
            Number(!a.totalMinutes) - Number(!b.totalMinutes) ||
            (a.totalMinutes - b.totalMinutes) * direction,
        );
  if (!view.byFilament) return sorted;

  const sequence = new Map<string, number>();
  for (const id of sorted.flatMap(filamentIds)) {
    if (!sequence.has(id)) sequence.set(id, sequence.size);
  }
  // Sem filamento, vai para o fim.
  const span = (entry: QueueEntry) => {
    const ranks = filamentIds(entry).map((id) => sequence.get(id)!);
    return ranks.length
      ? [Math.min(...ranks), Math.max(...ranks)]
      : [sequence.size, sequence.size];
  };
  return [...sorted].sort((a, b) => {
    const [aFirst, aLast] = span(a);
    const [bFirst, bLast] = span(b);
    return aFirst - bFirst || aLast - bLast;
  });
}

/** Quando deve terminar: início + tempo estimado. null sem tempo. */
export function printingEndsAt(
  entry: Pick<QueueEntry, "startedAt" | "totalMinutes">,
) {
  if (!entry.startedAt || !entry.totalMinutes) return null;
  return new Date(
    new Date(entry.startedAt).getTime() + entry.totalMinutes * 60_000,
  );
}

function formatClock(date: Date, now: Date) {
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (date.toDateString() === now.toDateString()) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `amanhã ${time}`;
  }
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/**
 * "termina por volta das 15:40", "deveria ter terminado às 15:40" ou, sem
 * tempo estimado, "desde 13:20".
 */
export function describePrinting(
  entry: Pick<QueueEntry, "startedAt" | "totalMinutes">,
  now = new Date(),
) {
  if (!entry.startedAt) return null;
  const endsAt = printingEndsAt(entry);
  if (!endsAt) {
    return `desde ${formatClock(new Date(entry.startedAt), now)}`;
  }
  return endsAt < now
    ? `deveria ter terminado às ${formatClock(endsAt, now)}`
    : `termina por volta das ${formatClock(endsAt, now)}`;
}

export function isRecentlyDone(entry: QueueEntry, now = new Date()) {
  if (!entry.completedAt) return false;
  const days =
    (now.getTime() - new Date(entry.completedAt).getTime()) / 86_400_000;
  return days <= RECENT_DONE_DAYS;
}
