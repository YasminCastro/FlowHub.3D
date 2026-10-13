import { apiFetch } from "./client";
import { Filament } from "./filament";

// Diário: registro de problemas de impressão, o que foi tentado e o que
// resolveu.

export type JournalStatus = "UNRESOLVED" | "IN_PROGRESS" | "RESOLVED";

// O que o usuário escolhe; RESOLVED vem de uma tentativa que resolveu.
export type JournalOpenStatus = Exclude<JournalStatus, "RESOLVED">;

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  UNRESOLVED: "Não resolvido",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
};

export const JOURNAL_STATUSES: JournalStatus[] = [
  "UNRESOLVED",
  "IN_PROGRESS",
  "RESOLVED",
];

// Mesmos limites do backend.
export const JOURNAL_MAX_PHOTOS = 12;
export const JOURNAL_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// null = ainda não sabe se funcionou.
export type AttemptOutcome = "WORKED" | "FAILED" | null;

export type JournalAttempt = {
  id: string;
  description: string;
  outcome: AttemptOutcome;
  triedAt: string;
  // Comentário sobre o resultado (ex: "virou a solução padrão").
  note: string | null;
};

export type JournalFilament = {
  id: string;
  colorName: string;
  type: string;
  brandName: string;
  colors: string[];
};

export type JournalPhoto = {
  id: string;
  // Caminho no backend (/uploads/...); use journalPhotoSrc para o <img>.
  url: string;
};

export type JournalEntry = {
  id: string;
  title: string;
  occurredAt: string;
  status: JournalStatus;
  filamentId: string | null;
  filament: JournalFilament | null;
  symptom: string;
  possibleCauses: string;
  attempts: JournalAttempt[];
  notes: string | null;
  photos: JournalPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type JournalAttemptInput = {
  description: string;
  outcome: AttemptOutcome;
  triedAt: string;
  note?: string | null;
};

export type JournalEntryInput = {
  title: string;
  occurredAt: string;
  // Ignorado pelo servidor quando alguma tentativa resolveu.
  openStatus: JournalOpenStatus;
  filamentId: string | null;
  symptom: string;
  possibleCauses: string;
  // Na edição, substitui a lista inteira; a ordem é a numeração.
  attempts: JournalAttemptInput[];
  notes: string | null;
};

export type JournalPhotoChanges = {
  add: File[];
  removeIds: string[];
};

export function journalPhotoSrc(photo: JournalPhoto) {
  return `${process.env.NEXT_PUBLIC_API_URL}${photo.url}`;
}

export function toJournalFilament(filament: Filament): JournalFilament {
  return {
    id: filament.id,
    colorName: filament.colorName,
    type: filament.type,
    brandName: filament.brand.name,
    colors: filament.colors,
  };
}

type EntryResponse = { message: string; data: JournalEntry };

export async function listJournalEntries() {
  return (await apiFetch("/journal")) as JournalEntry[];
}

export async function getJournalEntry(id: string) {
  return (await apiFetch(`/journal/${id}`)) as JournalEntry;
}

export async function createJournalEntry(input: JournalEntryInput) {
  const data = (await apiFetch("/journal", {
    method: "POST",
    body: JSON.stringify(input),
  })) as EntryResponse;
  return data.data;
}

export async function updateJournalEntry(id: string, input: JournalEntryInput) {
  const data = (await apiFetch(`/journal/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as EntryResponse;
  return data.data;
}

export async function deleteJournalEntry(id: string) {
  await apiFetch(`/journal/${id}`, { method: "DELETE" });
}

export async function addJournalPhotos(id: string, files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append("photos", file));
  const data = (await apiFetch(`/journal/${id}/photos`, {
    method: "POST",
    body,
  })) as EntryResponse;
  return data.data;
}

export async function deleteJournalPhoto(id: string, photoId: string) {
  const data = (await apiFetch(`/journal/${id}/photos/${photoId}`, {
    method: "DELETE",
  })) as EntryResponse;
  return data.data;
}

/**
 * Salva a entrada (cria se não houver id) e depois aplica as mudanças nas
 * fotos: as fotos vão em requisições à parte, porque são multipart.
 */
export async function saveJournalEntry(
  id: string | null,
  input: JournalEntryInput,
  photos: JournalPhotoChanges,
) {
  let entry = id
    ? await updateJournalEntry(id, input)
    : await createJournalEntry(input);
  for (const photoId of photos.removeIds) {
    entry = await deleteJournalPhoto(entry.id, photoId);
  }
  if (photos.add.length) {
    entry = await addJournalPhotos(entry.id, photos.add);
  }
  return entry;
}

export function getWinningAttemptIndex(entry: Pick<JournalEntry, "attempts">) {
  return entry.attempts.findIndex((attempt) => attempt.outcome === "WORKED");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias entre o problema e a tentativa que resolveu; null se não resolveu. */
export function getDaysToResolve(entry: JournalEntry) {
  const winner = entry.attempts[getWinningAttemptIndex(entry)];
  if (!winner) return null;
  const start = new Date(entry.occurredAt).setHours(0, 0, 0, 0);
  const end = new Date(winner.triedAt).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function formatDays(days: number) {
  if (days === 0) return "mesmo dia";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function formatOrdinal(n: number) {
  return `${n}ª`;
}

/** "resolveu na 3ª · 4 dias" ou o resumo de quem ainda não resolveu. */
export function describeOutcome(entry: JournalEntry) {
  const winnerIndex = getWinningAttemptIndex(entry);
  if (winnerIndex >= 0) {
    const days = getDaysToResolve(entry) ?? 0;
    return `resolveu na ${formatOrdinal(winnerIndex + 1)} · ${formatDays(days)}`;
  }
  const count = entry.attempts.length;
  if (count === 0) return "nenhuma tentativa ainda";
  if (entry.status === "UNRESOLVED") {
    return `${count} ${count === 1 ? "tentativa" : "tentativas"} · sem sucesso`;
  }
  return "nenhuma resolveu ainda";
}

export function describeFilament(f: JournalFilament) {
  return `${f.colorName} · ${f.type} · ${f.brandName}`;
}

/** Mesmo filamento primeiro, depois as mais recentes. */
export function findSimilarEntries(
  all: JournalEntry[],
  reference: { id?: string; filamentId: string | null },
  limit = 3,
) {
  return all
    .filter((entry) => entry.id !== reference.id)
    .sort((a, b) => {
      const aSame = a.filament?.id === reference.filamentId ? 1 : 0;
      const bSame = b.filament?.id === reference.filamentId ? 1 : 0;
      return bSame - aSame || b.occurredAt.localeCompare(a.occurredAt);
    })
    .slice(0, limit);
}
