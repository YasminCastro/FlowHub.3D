import { apiFetch } from "./client";
import { SpoolLevel, isInStock, listFilaments } from "./filament";
import { listPrinters } from "./printer";

// Calibrações: os valores que funcionaram para cada filamento, amarrados a
// uma impressora e a um fatiador. Uma por combinação; salvar de novo a mesma
// combinação guarda os valores anteriores no histórico. A genérica vale para
// todas as cores de uma marca e material; a específica de um filamento vence
// a genérica dele.

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
  brandId: string;
  brandName: string;
  colors: string[];
  spoolLevel: SpoolLevel;
  /** Faixas do fabricante (°C), do cadastro do filamento. Só vêm da lista
   * de filamentos; a resposta das calibrações não traz. */
  nozzleTempMin?: number | null;
  nozzleTempMax?: number | null;
  bedTempMin?: number | null;
  bedTempMax?: number | null;
};

export type CalibrationPrinter = {
  id: string;
  name: string;
  /** "Direct drive" ou "Bowden"; só vem da lista de impressoras. */
  extrusionType?: string | null;
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

/** Filamento que uma genérica cobre. */
export type CalibrationGroupFilament = Pick<
  CalibrationFilament,
  "id" | "colorName" | "colors" | "spoolLevel"
>;

/** Marca + material de uma genérica. */
export type CalibrationGroup = {
  brandId: string;
  brandName: string;
  type: string;
  /** Filamentos da marca e material sem específica na mesma impressora e
   * fatiador, por nome da cor. */
  filaments: CalibrationGroupFilament[];
};

/** A quem a calibração vale: um filamento, ou uma marca + material. */
export type CalibrationTarget =
  | { filamentId: string }
  | { brandId: string; brandName: string; type: string };

export type Calibration = CalibrationValues & {
  id: string;
  filamentId: string | null;
  brandId: string | null;
  filamentType: string | null;
  printerId: string;
  /** Na específica. */
  filament: CalibrationFilament | null;
  /** Na genérica. */
  group: CalibrationGroup | null;
  printer: CalibrationPrinter;
  slicer: Slicer;
  calibratedAt: string;
  notes: string | null;
  /** Versões anteriores, da mais recente para a mais antiga. */
  history: CalibrationVersion[];
};

export type CalibrationDetail = Calibration & { prints: CalibrationPrint[] };

export type CalibrationInput = CalibrationValues & {
  /** Um filamento, ou marca + material (genérica). */
  filamentId: string | null;
  brandId: string | null;
  filamentType: string | null;
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
    brandId: f.brand.id,
    brandName: f.brand.name,
    colors: f.colors,
    spoolLevel: f.spoolLevel,
    nozzleTempMin: f.nozzleTempMin,
    nozzleTempMax: f.nozzleTempMax,
    bedTempMin: f.bedTempMin,
    bedTempMax: f.bedTempMax,
  }));
}

export async function listCalibrationPrinters(): Promise<CalibrationPrinter[]> {
  const printers = await listPrinters();
  return printers.map((p) => ({
    id: p.id,
    name: p.name,
    extrusionType: p.extrusionType,
  }));
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

/** O material é texto livre: "PLA" e "pla" são o mesmo. */
export function sameFilamentType(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function targetOf(calibration: Calibration): CalibrationTarget {
  return calibration.group
    ? {
        brandId: calibration.group.brandId,
        brandName: calibration.group.brandName,
        type: calibration.group.type,
      }
    : { filamentId: calibration.filament!.id };
}

/** A genérica que cobriria esse filamento (mesma marca e material). */
export function targetForGroupOf(filament: CalibrationFilament) {
  return {
    brandId: filament.brandId,
    brandName: filament.brandName,
    type: filament.type,
  } satisfies CalibrationTarget;
}

function matchesTarget(c: Calibration, target: CalibrationTarget) {
  if ("filamentId" in target) return c.filament?.id === target.filamentId;
  return (
    !!c.group &&
    c.group.brandId === target.brandId &&
    sameFilamentType(c.group.type, target.type)
  );
}

export function findCalibrationFor(
  list: Calibration[],
  target: CalibrationTarget,
  printerId: string,
  slicer: Slicer,
) {
  return list.find(
    (c) =>
      matchesTarget(c, target) &&
      c.printer.id === printerId &&
      c.slicer === slicer,
  );
}

/** Filamentos com rolo em estoque sem calibração, nem específica nem
 * genérica da marca e material. */
export function getUncalibratedFilaments(
  list: Calibration[],
  filaments: CalibrationFilament[],
) {
  const calibrated = new Set(
    list.flatMap((c) =>
      c.filament ? [c.filament.id] : (c.group?.filaments.map((f) => f.id) ?? []),
    ),
  );
  return filaments.filter((f) => isInStock(f) && !calibrated.has(f.id));
}

/** Como a calibração aparece: o filamento, ou a marca + material. */
export type CalibrationSubject = {
  /** Cor do filamento, ou "Todas as cores · Marca". */
  name: string;
  type: string;
  brandName: string;
  /** Na genérica, a primeira cor de até três filamentos cobertos. */
  colors: string[];
  isGeneric: boolean;
};

export function calibrationSubject(
  calibration: Pick<Calibration, "filament" | "group">,
): CalibrationSubject {
  const { filament, group } = calibration;
  if (group) {
    return {
      name: `Todas as cores · ${group.brandName}`,
      type: group.type,
      brandName: group.brandName,
      colors: group.filaments.slice(0, 3).flatMap((f) => f.colors.slice(0, 1)),
      isGeneric: true,
    };
  }
  return {
    name: filament!.colorName,
    type: filament!.type,
    brandName: filament!.brandName,
    colors: filament!.colors,
    isGeneric: false,
  };
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
  calibration: Pick<Calibration, "filament" | "group" | "slicer"> &
    CalibrationValues,
) {
  const subject = calibrationSubject(calibration);
  // Na mesma ordem em que se preenche o perfil no fatiador.
  const lines = [
    `${subject.name} (${subject.type}) · ${SLICER_LABELS[calibration.slicer]}`,
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

/**
 * Deixa só o que o campo aceita enquanto digita: inteiros só dígitos;
 * decimais com uma vírgula (o ponto vira vírgula) e no máximo `decimals`
 * casas depois dela.
 */
export function sanitizeNumber(value: string, decimals: number) {
  if (decimals === 0) return value.replace(/\D/g, "");
  const [intPart, ...rest] = value
    .replace(/\./g, ",")
    .replace(/[^\d,]/g, "")
    .split(",");
  if (!rest.length) return intPart;
  return `${intPart || "0"},${rest.join("").slice(0, decimals)}`;
}

// — Faixas —

export type ValueRange = {
  label: string;
  min: number;
  max: number;
  unit?: string;
};

/** Mesmas faixas da API (CALIBRATION_RANGES no backend). */
export const CALIBRATION_RANGES: Partial<
  Record<keyof CalibrationValues, ValueRange>
> = {
  bedTempFirstLayer: { label: "Mesa inicial", min: 0, max: 150, unit: " °C" },
  bedTemp: { label: "Mesa final", min: 0, max: 150, unit: " °C" },
  nozzleTempInitial: { label: "Bico inicial", min: 150, max: 350, unit: " °C" },
  nozzleTemp: { label: "Bico final", min: 150, max: 350, unit: " °C" },
  maxVolumetricSpeed: {
    label: "Vazão máxima",
    min: 1,
    max: 100,
    unit: " mm³/s",
  },
  pressureAdvance: { label: "Pressure Advance", min: 0, max: 2 },
  flow: { label: "Flow Ratio", min: 0.5, max: 1.5 },
  retractionDistance: { label: "Retração", min: 0, max: 15, unit: " mm" },
};

/** Mensagem de faixa ("Entre 150 e 350 °C."), ou null se o valor cabe. */
export function rangeError(key: keyof CalibrationValues, value: number) {
  const range = CALIBRATION_RANGES[key];
  if (!range || (value >= range.min && value <= range.max)) return null;
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  return `Entre ${fmt(range.min)} e ${fmt(range.max)}${range.unit ?? ""}.`;
}

// — Guia por fatiador —

export type GuideProgressKey = {
  filamentId: string;
  printerId: string;
  slicer: Slicer;
};

/** Valores de um teste do guia como a API guarda: números por campo. */
export type GuideStepProgress = {
  values: Record<string, number>;
  done: boolean;
};

export type GuideProgress = GuideProgressKey & {
  id: string;
  results: Record<string, GuideStepProgress>;
  activeStep: string;
  updatedAt: string;
};

/** Progresso salvo da combinação, ou null se ainda não começou. */
export async function getGuideProgress(key: GuideProgressKey) {
  return (await apiFetch(
    `/calibration-guide?${new URLSearchParams(key)}`,
  )) as GuideProgress | null;
}

export async function saveGuideProgress(
  key: GuideProgressKey,
  results: Record<string, GuideStepProgress>,
  activeStep: string,
) {
  const data = (await apiFetch("/calibration-guide", {
    method: "PUT",
    body: JSON.stringify({ ...key, results, activeStep }),
  })) as { message: string; data: GuideProgress };
  return data.data;
}

/** "Recomeçar": apaga o progresso da combinação. */
export async function resetGuideProgress(key: GuideProgressKey) {
  await apiFetch(`/calibration-guide?${new URLSearchParams(key)}`, {
    method: "DELETE",
  });
}
