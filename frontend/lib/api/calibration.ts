import { apiFetch } from "./client";
import { SpoolLevel, isInStock, listFilaments } from "./filament";
import { listPrinters } from "./printer";

// Calibrações: os valores que funcionaram para cada filamento, amarrados a
// uma impressora e a um fatiador. Uma por combinação; salvar de novo a mesma
// combinação guarda os valores anteriores no histórico.

export type Slicer = "ORCA" | "CREALITY";

export const SLICERS: Slicer[] = ["ORCA", "CREALITY"];

export const SLICER_LABELS: Record<Slicer, string> = {
  ORCA: "Orca",
  CREALITY: "Creality",
};

export const SLICER_FULL_LABELS: Record<Slicer, string> = {
  ORCA: "Orca Slicer",
  CREALITY: "Creality Print",
};

// A partir daqui a idade da calibração começa a pesar na lista.
export const CALIBRATION_AGING_DAYS = 45;
export const CALIBRATION_STALE_DAYS = 50;

export type CalibrationFilament = {
  id: string;
  colorName: string;
  /** Material/acabamento exibido na tag (PLA, PETG, PLA Matte...). */
  type: string;
  brandName: string;
  colors: string[];
  spoolLevel: SpoolLevel;
};

export type CalibrationPrinter = {
  id: string;
  name: string;
};

/** Os valores medidos — o que a lista mostra e o que se copia. */
export type CalibrationValues = {
  flow: number;
  /** Bico na camada inicial. */
  nozzleTempInitial: number;
  /** Bico nas demais camadas ("final"). */
  nozzleTemp: number;
  bedTempFirstLayer: number;
  /** Mesa nas demais camadas. */
  bedTemp: number;
  pressureAdvance: number;
  /** Vazão máxima, em mm³/s. */
  maxVolumetricSpeed: number | null;
  retractionDistance: number | null;
};

export type CalibrationVersion = CalibrationValues & {
  id: string;
  calibratedAt: string;
  notes: string | null;
};

/** Impressão feita depois da calibração, com o filamento e a impressora dela. */
export type CalibrationPrint = {
  id: string;
  printItemId: string;
  name: string;
  printedAt: string;
  /** Gramas deste filamento no registro. */
  grams: number;
  outcome: "SUCCESS" | "FAILURE";
};

export type Calibration = CalibrationValues & {
  id: string;
  filamentId: string;
  printerId: string;
  filament: CalibrationFilament;
  printer: CalibrationPrinter;
  slicer: Slicer;
  calibratedAt: string;
  notes: string | null;
  /** Versões anteriores, da mais recente para a mais antiga. */
  history: CalibrationVersion[];
};

export type CalibrationDetail = Calibration & { prints: CalibrationPrint[] };

export type CalibrationInput = CalibrationValues & {
  filamentId: string;
  printerId: string;
  slicer: Slicer;
  calibratedAt: string;
  notes: string | null;
};

type CalibrationResponse = { message: string; data: Calibration };

export async function listCalibrations() {
  return (await apiFetch("/calibrations")) as Calibration[];
}

export async function getCalibration(id: string) {
  return (await apiFetch(`/calibrations/${id}`)) as CalibrationDetail;
}

/**
 * Salvar a mesma combinação filamento + impressora + fatiador substitui os
 * valores atuais; a versão anterior vai para o histórico.
 */
export async function saveCalibration(input: CalibrationInput) {
  const data = (await apiFetch("/calibrations", {
    method: "POST",
    body: JSON.stringify(input),
  })) as CalibrationResponse;
  return data.data;
}

/** Corrige a versão atual no lugar, sem criar entrada no histórico. */
export async function updateCalibration(id: string, input: CalibrationInput) {
  const data = (await apiFetch(`/calibrations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as CalibrationResponse;
  return data.data;
}

export async function deleteCalibration(id: string) {
  await apiFetch(`/calibrations/${id}`, { method: "DELETE" });
}

export async function listCalibrationFilaments(): Promise<
  CalibrationFilament[]
> {
  const filaments = await listFilaments();
  return filaments.map((f) => ({
    id: f.id,
    colorName: f.colorName,
    type: f.type,
    brandName: f.brand.name,
    colors: f.colors,
    spoolLevel: f.spoolLevel,
  }));
}

export async function listCalibrationPrinters(): Promise<CalibrationPrinter[]> {
  const printers = await listPrinters();
  return printers.map((p) => ({ id: p.id, name: p.name }));
}

// — Helpers —

export function pickValues(source: CalibrationValues): CalibrationValues {
  return {
    flow: source.flow,
    nozzleTempInitial: source.nozzleTempInitial,
    nozzleTemp: source.nozzleTemp,
    bedTempFirstLayer: source.bedTempFirstLayer,
    bedTemp: source.bedTemp,
    pressureAdvance: source.pressureAdvance,
    maxVolumetricSpeed: source.maxVolumetricSpeed,
    retractionDistance: source.retractionDistance,
  };
}

export function findCalibrationFor(
  list: Calibration[],
  filamentId: string,
  printerId: string,
  slicer: Slicer,
) {
  return list.find(
    (c) =>
      c.filament.id === filamentId &&
      c.printer.id === printerId &&
      c.slicer === slicer,
  );
}

/** Filamentos com rolo em estoque que não têm nenhuma calibração. */
export function getUncalibratedFilaments(
  list: Calibration[],
  filaments: CalibrationFilament[],
) {
  const calibrated = new Set(list.map((c) => c.filament.id));
  return filaments.filter(
    (f) => isInStock(f) && !calibrated.has(f.id),
  );
}

export function getCalibrationAgeDays(calibratedAt: string) {
  const ms = Date.now() - new Date(calibratedAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function formatCalibrationAge(calibratedAt: string) {
  const days = getCalibrationAgeDays(calibratedAt);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function formatDecimal(value: number, digits: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Sempre com 2 casas (1,00); a 3ª só aparece quando existe (1,035).
export const formatFlow = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
export const formatPressureAdvance = (value: number) => formatDecimal(value, 3);
export const formatRetraction = (value: number) =>
  `${formatDecimal(value, 1)} mm`;
export const formatTemp = (value: number) => `${value}°`;
export const formatVolumetricSpeed = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mm³/s`;

export function describeCalibrationFilament(f: CalibrationFilament) {
  return `${f.colorName} · ${f.type}`;
}

/** Resumo curto para histórico e cartões: "Fluxo 1,00 · 210° · PA 0,020". */
export function summarizeValues(values: CalibrationValues) {
  return `Fluxo ${formatFlow(values.flow)} · ${formatTemp(values.nozzleTemp)} · PA ${formatPressureAdvance(values.pressureAdvance)}`;
}

/** Texto colado na área de transferência pelo botão de copiar. */
export function calibrationClipboardText(
  calibration: Pick<Calibration, "filament" | "slicer"> & CalibrationValues,
) {
  // Na mesma ordem em que se preenche o perfil no fatiador.
  const lines = [
    `${calibration.filament.colorName} (${calibration.filament.type}) · ${SLICER_LABELS[calibration.slicer]}`,
    `Mesa 1ª camada: ${calibration.bedTempFirstLayer} °C`,
    `Mesa demais camadas: ${calibration.bedTemp} °C`,
    `Bico inicial: ${calibration.nozzleTempInitial} °C`,
    `Bico final: ${calibration.nozzleTemp} °C`,
  ];
  if (calibration.maxVolumetricSpeed != null)
    lines.push(
      `Vazão máxima: ${formatVolumetricSpeed(calibration.maxVolumetricSpeed)}`,
    );
  lines.push(
    `Pressure advance: ${formatPressureAdvance(calibration.pressureAdvance)}`,
    `Fluxo: ${formatFlow(calibration.flow)}`,
  );
  if (calibration.retractionDistance != null)
    lines.push(`Retração: ${formatRetraction(calibration.retractionDistance)}`);
  return lines.join("\n");
}

/** Aceita "0,98" ou "0.98". */
export function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
