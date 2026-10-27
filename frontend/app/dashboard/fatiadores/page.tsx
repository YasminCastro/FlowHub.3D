"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Droplet,
  Lightbulb,
  Minus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CalLabel } from "@/components/calibrations/calibration-bits";
import { FilamentCascadeSelect } from "@/components/calibrations/filament-cascade-select";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import {
  CalibrationFilament,
  CalibrationPrinter,
  SLICERS,
  SLICER_FULL_LABELS,
  Slicer,
  listCalibrationFilaments,
  listCalibrationPrinters,
  GuideProgress,
  GuideProgressKey,
  GuideStepProgress,
  getGuideProgress,
  parseDecimal,
  rangeError,
  resetGuideProgress,
  sanitizeNumber,
  saveGuideProgress,
} from "@/lib/api/calibration";
import {
  GUIDE_STEPS,
  GUIDE_VIDEOS,
  guideSteps,
  GuideContext,
  GuideStep,
  GuideStepId,
  filamentTemps,
  forSlicer,
  forSlicerFamily,
  formatTempRange,
  middleOf,
} from "@/lib/calibration-guide";
import { cn } from "@/lib/utils";

// Valores por campo do passo (ver GuideStep.fields), como digitados.
type StepResult = { values: Record<string, string>; done: boolean };

/** Renderiza o **negrito** dos textos do guia. */
function GuideText({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 ? (
          <b key={i} className="font-medium tabular-nums">
            {part}
          </b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function SlicerSegment({
  value,
  onChange,
}: {
  value: Slicer;
  onChange: (value: Slicer) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Fatiador"
      className="inline-flex h-9 items-center gap-0.5 rounded-md border border-border p-0.5"
    >
      {SLICERS.map((slicer) => (
        <button
          key={slicer}
          type="button"
          role="radio"
          aria-checked={value === slicer}
          onClick={() => onChange(slicer)}
          className={cn(
            "h-full rounded-[5px] px-3.5 text-[13px] transition-colors",
            value === slicer
              ? "bg-brand/14 text-brand"
              : "text-foreground/70 hover:bg-foreground/6 hover:text-foreground",
          )}
        >
          {SLICER_FULL_LABELS[slicer]}
        </button>
      ))}
    </div>
  );
}

type Results = Partial<Record<GuideStepId, StepResult>>;
type SaveState = "idle" | "saving" | "saved" | "error";

// A API guarda números; a tela trabalha com o texto digitado ("0,98").
function toServerResults(results: Results) {
  const out: Record<string, GuideStepProgress> = {};
  for (const step of GUIDE_STEPS) {
    const r = results[step.id];
    if (!r) continue;
    const values: Record<string, number> = {};
    for (const f of step.fields) {
      const n = parseDecimal(r.values[f.key] ?? "");
      if (n !== null) values[f.key] = n;
    }
    out[step.id] = { values, done: r.done };
  }
  return out;
}

function fromServerResults(progress: GuideProgress | null): Results {
  const out: Results = {};
  for (const step of GUIDE_STEPS) {
    const r = progress?.results[step.id];
    if (!r) continue;
    const values: Record<string, string> = {};
    for (const f of step.fields) {
      const n = r.values[f.key];
      if (typeof n !== "number") continue;
      values[f.key] = n.toLocaleString("pt-BR", {
        maximumFractionDigits: f.decimals,
        useGrouping: false,
      });
    }
    out[step.id] = { values, done: r.done };
  }
  return out;
}

function stepIndexOf(steps: GuideStep[], id: string | undefined) {
  return Math.max(
    0,
    steps.findIndex((s) => s.id === id),
  );
}

function summarizeStep(step: GuideStep, values: Record<string, string>) {
  if (step.summarize) return step.summarize(values);
  return step.fields
    .map((f) => `${values[f.key] ?? ""}${f.unit ? ` ${f.unit}` : ""}`)
    .join(" · ");
}

/** Estado do salvamento automático e o "Recomeçar", ao lado do progresso. */
function SaveStatus({
  state,
  hasProgress,
  confirmReset,
  onAskReset,
  onCancelReset,
  onReset,
}: {
  state: SaveState;
  hasProgress: boolean;
  confirmReset: boolean;
  onAskReset: () => void;
  onCancelReset: () => void;
  onReset: () => void;
}) {
  if (confirmReset) {
    return (
      <span className="flex items-center gap-2 text-[11.5px]">
        <span className="text-foreground/60">
          Apagar o progresso deste rolo?
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-destructive hover:underline"
        >
          Apagar
        </button>
        <button
          type="button"
          onClick={onCancelReset}
          className="text-foreground/60 hover:text-foreground"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 text-[11.5px]">
      {state === "saving" && (
        <span className="text-foreground/45">Salvando…</span>
      )}
      {state === "saved" && (
        <span className="text-foreground/45">Progresso salvo</span>
      )}
      {state === "error" && (
        <span role="alert" className="text-destructive">
          Não foi possível salvar o progresso
        </span>
      )}
      {hasProgress && (
        <button
          type="button"
          onClick={onAskReset}
          className="inline-flex items-center gap-1 text-brand-300 hover:underline"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Recomeçar
        </button>
      )}
    </span>
  );
}

function StepNumber({
  n,
  done,
  active,
}: {
  n: number;
  done: boolean;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "mt-px grid size-4.75 shrink-0 place-items-center rounded-full font-heading text-[10px] font-medium tabular-nums",
        done
          ? "bg-brand text-[#161826]"
          : active
            ? "text-brand shadow-[inset_0_0_0_1px_var(--brand)]"
            : "text-foreground/50 shadow-[inset_0_0_0_1px_var(--neutral-700)]",
      )}
    >
      {done ? <Check className="size-2.5" strokeWidth={3} /> : n}
    </span>
  );
}

export default function SlicerCalibrationPage() {
  const router = useRouter();
  const [filaments, setFilaments] = useState<CalibrationFilament[]>([]);
  const [printers, setPrinters] = useState<CalibrationPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slicer, setSlicer] = useState<Slicer>("ORCA");
  const [filamentId, setFilamentId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<Results>({});
  // Combinação cujo progresso já veio da API; até lá o guia não aparece.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [stepError, setStepError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // O que a API já tem, para não salvar de novo o que acabou de carregar.
  const lastSavedRef = useRef<string | null>(null);

  const progressKey: GuideProgressKey | null =
    filamentId && printerId ? { filamentId, printerId, slicer } : null;
  const keyId = progressKey ? `${filamentId}|${printerId}|${slicer}` : null;
  const isProgressReady = keyId !== null && loadedKey === keyId;
  // A ordem dos testes muda com o fatiador.
  const steps = guideSteps(slicer);

  useEffect(() => {
    Promise.all([listCalibrationFilaments(), listCalibrationPrinters()])
      .then(([fils, prns]) => {
        const sorted = fils.sort((a, b) =>
          a.colorName.localeCompare(b.colorName, "pt-BR"),
        );
        setFilaments(sorted);
        setPrinters(prns);
        setPrinterId(prns[0]?.id ?? "");
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Trocar filamento, impressora ou fatiador carrega o progresso salvo.
  useEffect(() => {
    if (!keyId) return;
    const [fId, pId, sl] = keyId.split("|");
    let ignore = false;
    getGuideProgress({ filamentId: fId, printerId: pId, slicer: sl as Slicer })
      .then((progress) => {
        if (ignore) return;
        const loaded = fromServerResults(progress);
        const order = guideSteps(sl as Slicer);
        const index = stepIndexOf(order, progress?.activeStep);
        lastSavedRef.current = JSON.stringify({
          results: toServerResults(loaded),
          activeStep: order[index].id,
        });
        setResults(loaded);
        setActiveIndex(index);
        setSaveState("idle");
      })
      .catch(() => {
        if (ignore) return;
        lastSavedRef.current = null;
        setResults({});
        setActiveIndex(0);
        setSaveState("error");
      })
      .finally(() => {
        if (!ignore) setLoadedKey(keyId);
      });
    return () => {
      ignore = true;
    };
  }, [keyId]);

  // Salva sozinho, um pouco depois da última mudança.
  useEffect(() => {
    if (!progressKey || !isProgressReady) return;
    const activeStep = steps[activeIndex].id;
    const payload = toServerResults(results);
    const serialized = JSON.stringify({ results: payload, activeStep });
    if (serialized === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      setSaveState("saving");
      saveGuideProgress(progressKey, payload, activeStep)
        .then(() => {
          lastSavedRef.current = serialized;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 600);
    return () => clearTimeout(timer);
    // progressKey muda junto com keyId; isProgressReady cobre a troca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, activeIndex, isProgressReady]);

  const filament = filaments.find((f) => f.id === filamentId);
  const step = steps[activeIndex];
  const result = results[step.id] ?? { values: {}, done: false };
  const doneCount = steps.filter((s) => results[s.id]?.done).length;

  // Valores anotados que entram na calibração.
  const foundValues = steps.flatMap((s) => {
    const r = results[s.id];
    if (!r?.done) return [];
    return s.fields.flatMap((f) => {
      const n = parseDecimal(r.values[f.key] ?? "");
      return f.target && n !== null ? [[f.target, n] as const] : [];
    });
  });

  function saveAsCalibration() {
    if (!filament) return;
    const query = new URLSearchParams({
      filament: filament.id,
      printer: printerId,
      slicer,
      // Se o teste de temperatura foi pulado, a mesa parte do meio da faixa
      // do rolo; os valores anotados abaixo substituem.
      bedTemp: String(middleOf(filamentTemps(filament).bed.range)),
      bedTempFirstLayer: String(middleOf(filamentTemps(filament).bed.range)),
    });
    foundValues.forEach(([key, value]) => query.set(key, String(value)));
    router.push(`/dashboard/calibracoes/new?${query}`);
  }

  usePageHeaderAction(
    <Button
      size="sm"
      disabled={!filament || foundValues.length === 0}
      title={
        foundValues.length === 0
          ? "Conclua pelo menos um teste para salvar"
          : undefined
      }
      onClick={saveAsCalibration}
    >
      <Check />
      Salvar como calibração
    </Button>,
  );

  // Os resultados valem para um rolo, numa máquina, num fatiador: ao trocar,
  // limpa a tela até o progresso da nova combinação chegar.
  function clearLocalProgress() {
    setResults({});
    setActiveIndex(0);
    setStepError(null);
    setConfirmReset(false);
  }

  async function restart() {
    if (!progressKey) return;
    setConfirmReset(false);
    try {
      await resetGuideProgress(progressKey);
      lastSavedRef.current = JSON.stringify({
        results: {},
        activeStep: steps[0].id,
      });
      clearLocalProgress();
      setSaveState("idle");
    } catch {
      setSaveState("error");
    }
  }

  function updateResult(patch: Partial<StepResult>) {
    setResults((prev) => ({
      ...prev,
      [step.id]: { ...result, ...patch },
    }));
  }

  function goTo(index: number) {
    setStepError(null);
    setActiveIndex(Math.max(0, Math.min(steps.length - 1, index)));
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (filaments.length === 0) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Cadastre um filamento para usar o guia de calibração.
      </div>
    );
  }

  // O guia só aparece com o rolo escolhido: o texto cita os valores dele.
  const ctx: GuideContext | null =
    filament && isProgressReady
      ? {
          filament,
          printer: printers.find((p) => p.id === printerId),
          slicer,
          results: Object.fromEntries(
            Object.entries(results)
              .filter(([, r]) => r?.done)
              .map(([id, r]) => [id, r!.values]),
          ),
        }
      : null;
  const next = steps[activeIndex + 1];
  const prev = steps[activeIndex - 1];
  const canComplete = step.fields.every(
    (f) => (result.values[f.key] ?? "").trim() !== "",
  );
  const temps = filament ? filamentTemps(filament) : null;
  const anyFromManufacturer =
    !!temps && (temps.nozzle.fromManufacturer || temps.bed.fromManufacturer);
  const allFromManufacturer =
    !!temps && temps.nozzle.fromManufacturer && temps.bed.fromManufacturer;

  return (
    // No desktop a página ocupa a altura da janela (menos o cabeçalho de
    // 3rem) e só o painel do passo rola; no celular, a página rola inteira.
    <div className="-m-4 flex flex-1 flex-col md:h-[calc(100svh-3rem)] md:flex-none md:overflow-hidden">
      <div className="flex flex-col gap-4 px-6.5 pt-5.5 pb-4">
        {/* Título e descrição em 3/4, o seletor de fatiador no 1/4 restante. */}
        <div className="grid grid-cols-1 items-end gap-5 md:grid-cols-4">
          <div className="min-w-0 md:col-span-3">
            <h1 className="text-[32px] leading-tight font-bold">
              Calibrar filamento no fatiador
            </h1>
            <p className="text-sm text-muted-foreground md:truncate">
              Cinco testes na ordem que importa, com os valores do rolo que você
              escolheu já preenchidos.
            </p>
          </div>
          <div className="md:justify-self-end">
            <SlicerSegment
              value={slicer}
              onChange={(value) => {
                setSlicer(value);
                clearLocalProgress();
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md bg-[#1a1c29] px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
          <div className="flex flex-wrap items-center gap-3">
            <CalLabel className="shrink-0">Calibrando</CalLabel>
            <FilamentCascadeSelect
              filaments={filaments}
              value={filamentId}
              onChange={(id) => {
                if (id === filamentId) return;
                setFilamentId(id);
                clearLocalProgress();
              }}
              className="min-w-0 flex-1"
            />
            <Select
              value={printerId}
              onValueChange={(value) => {
                if (!value) return;
                setPrinterId(value);
                clearLocalProgress();
              }}
            >
              <SelectTrigger
                className="w-full bg-transparent md:w-auto md:min-w-44"
                aria-label="Impressora"
              >
                <SelectValue>
                  {(value: string) => (
                    <span className="flex items-center gap-2">
                      <Printer aria-hidden="true" />
                      {printers.find((p) => p.id === value)?.name}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {printers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/55">
              {filament && temps ? (
                <>
                  {anyFromManufacturer
                    ? "Fabricante:"
                    : `Faixa típica de ${filament.type}:`}{" "}
                  bico{" "}
                  <span className="text-foreground tabular-nums">
                    {formatTempRange(temps.nozzle.range)}
                  </span>
                  {anyFromManufacturer && !temps.nozzle.fromManufacturer && (
                    <> (típica de {filament.type})</>
                  )}{" "}
                  · mesa{" "}
                  <span className="text-foreground tabular-nums">
                    {formatTempRange(temps.bed.range)}
                  </span>
                  {anyFromManufacturer && !temps.bed.fromManufacturer && (
                    <> (típica de {filament.type})</>
                  )}
                </>
              ) : (
                "Escolha material, marca e cor do rolo que vai calibrar."
              )}
            </span>
            {filament && !allFromManufacturer && (
              <Link
                href={`/dashboard/filamentos/${filament.id}/edit`}
                className="shrink-0 text-xs text-brand-300 hover:underline"
              >
                Cadastrar faixa do fabricante
              </Link>
            )}
            <div className="flex shrink-0 items-center gap-2.25">
              {isProgressReady && (
                <SaveStatus
                  state={saveState}
                  hasProgress={Object.keys(results).length > 0}
                  confirmReset={confirmReset}
                  onAskReset={() => setConfirmReset(true)}
                  onCancelReset={() => setConfirmReset(false)}
                  onReset={restart}
                />
              )}
              <span className="text-[11.5px] text-foreground/50 tabular-nums">
                {doneCount} de {steps.length} testes
              </span>
              <span className="flex gap-0.75" aria-hidden="true">
                {steps.map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "h-0.75 w-5.5 rounded-xs",
                      results[s.id]?.done ? "bg-brand" : "bg-neutral-700",
                    )}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {filament && !ctx ? (
        <div className="grid flex-1 grid-cols-1 gap-6 border-t p-6 md:grid-cols-[250px_minmax(0,1fr)]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !ctx ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t px-8 py-16 text-center text-muted-foreground">
          <SlidersHorizontal className="size-6" aria-hidden="true" />
          <p className="max-w-[48ch] text-sm">
            Escolha o filamento para ver os cinco testes com os valores do rolo
            já preenchidos.
          </p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 border-t md:min-h-0 md:grid-cols-[250px_minmax(0,1fr)]">
          <nav
            aria-label="Testes"
            className="flex min-w-0 flex-col gap-1.5 border-b bg-[#1a1c29] px-4 py-5 scrollbar-nocturne md:overflow-y-auto md:border-r md:border-b-0"
          >
            <CalLabel className="mb-1.5 px-2">Os testes</CalLabel>
            {steps.map((s, index) => {
              const r = results[s.id];
              const active = index === activeIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => goTo(index)}
                  className={cn(
                    "flex items-start gap-2.25 rounded-sm px-2.5 py-2.25 text-left transition-colors",
                    active
                      ? "bg-brand/12 text-brand"
                      : "text-foreground/78 hover:bg-foreground/7 hover:text-foreground",
                  )}
                >
                  <StepNumber n={index + 1} done={!!r?.done} active={active} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[13px]",
                        r?.done && !active && "text-foreground",
                      )}
                    >
                      {s.title}
                    </span>
                    {(r?.done || active) && (
                      <span className="mt-0.5 block text-[11.5px] text-foreground/50 tabular-nums">
                        {r?.done ? summarizeStep(s, r.values) : "em andamento"}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            <hr className="fade-rule my-3.5" />
            <div className="flex flex-col gap-2.25 px-2">
              <CalLabel>Antes de começar</CalLabel>
              <div className="flex gap-2.25 text-xs leading-normal text-foreground/60">
                <Droplet
                  className="mt-px size-3.5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium text-foreground/80">
                    Dica prévia:
                  </span>{" "}
                  certifique-se de que o filamento esteja bem seco antes de
                  começar.
                </span>
              </div>
              <div className="flex gap-2.25 text-xs leading-normal text-foreground/60">
                <Video
                  className="mt-px size-3.5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium text-foreground/80">
                    Referência:
                  </span>{" "}
                  <a
                    href={GUIDE_VIDEOS[slicer]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-300 hover:underline"
                  >
                    Vídeo com o passo a passo completo
                  </a>
                </span>
              </div>
            </div>
          </nav>

          <section className="flex min-w-0 flex-col gap-5.5 px-7.5 py-6 scrollbar-nocturne md:overflow-y-auto">
            <div className="flex items-start gap-3.25">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand font-heading text-[13px] font-medium text-[#161826]">
                {activeIndex + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 text-2xl">
                  {step.title}
                  {step.testName && (
                    <span className="text-foreground/55">
                      {" "}
                      ({forSlicer(step.testName, slicer)})
                    </span>
                  )}
                </h2>
                <p className="text-[13px] text-foreground/55">{forSlicer(step.summary, slicer)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <CalLabel>Como fazer</CalLabel>
              <ol className="flex flex-col gap-2.5">
                {step.howTo(ctx).map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-2.75 text-[13.5px] leading-relaxed"
                  >
                    <span className="shrink-0 text-brand-300 tabular-nums">
                      {i + 1}
                    </span>
                    <span>
                      <GuideText text={line} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <hr className="fade-rule" />

            <div className="flex flex-col gap-3">
              <CalLabel>Como analisar o resultado</CalLabel>
              <ul className="flex flex-col gap-2.25 text-[13.5px] leading-relaxed text-foreground/78">
                {(typeof step.analyze === "function"
                  ? step.analyze(ctx)
                  : step.analyze
                ).map((line, i) => (
                  <li key={i} className="flex gap-2.75">
                    <Minus
                      className="mt-1.25 size-3.25 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <form
              className="flex flex-col gap-3.5 rounded-md bg-[#1a1c29] px-4.5 py-4 shadow-[inset_0_0_0_1px_var(--border)]"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canComplete) return;
                for (const f of step.fields) {
                  const n = parseDecimal(result.values[f.key] ?? "");
                  const error =
                    f.target && n !== null ? rangeError(f.target, n) : null;
                  if (error) {
                    setStepError(`${f.label}: ${error}`);
                    return;
                  }
                }
                setStepError(null);
                updateResult({ done: true });
                if (next) goTo(activeIndex + 1);
              }}
            >
              <div className="flex items-baseline gap-2.5">
                <CalLabel>
                  {step.fields.length > 1
                    ? "Valores encontrados"
                    : "Valor encontrado"}
                </CalLabel>
              </div>
              <div className="flex flex-wrap items-end gap-3.5">
                {ctx &&
                  step.fields.map((f) => (
                    <div key={f.key} className="flex w-32.5 flex-col gap-1.5">
                      <Label htmlFor={`guide-${f.key}`}>{f.label}</Label>
                      <div className="relative">
                        <Input
                          id={`guide-${f.key}`}
                          inputMode={f.decimals ? "decimal" : "numeric"}
                          autoComplete="off"
                          value={result.values[f.key] ?? ""}
                          placeholder={
                            typeof f.placeholder === "function"
                              ? f.placeholder(ctx)
                              : f.placeholder
                          }
                          onChange={(e) =>
                            updateResult({
                              values: {
                                ...result.values,
                                [f.key]: sanitizeNumber(
                                  e.target.value,
                                  f.decimals,
                                ),
                              },
                              done: false,
                            })
                          }
                          className={cn(
                            "tabular-nums",
                            f.unit && (f.unit.length > 3 ? "pr-14" : "pr-9"),
                          )}
                        />
                        {f.unit && (
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-foreground/38">
                            {f.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                <Button type="submit" className="h-9" disabled={!canComplete}>
                  {result.done ? "Concluído" : "Concluir teste"}
                  {result.done ? <Check /> : <ArrowRight />}
                </Button>
              </div>
              {stepError && (
                <p role="alert" className="text-xs text-destructive">
                  {stepError}
                </p>
              )}
              {step.whatToDo ? (
                <p className="text-xs text-foreground/45">
                  O que fazer:{" "}
                  <span className="text-foreground/72">
                    {forSlicerFamily(step.whatToDo, slicer)}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-foreground/45">
                  Onde aplicar no fatiador:{" "}
                  <span className="text-foreground/72">
                    {forSlicerFamily(step.applyAt, slicer)}
                  </span>{" "}
                  — depois salve o perfil com o nome do rolo.
                </p>
              )}
            </form>

            {step.tip && forSlicerFamily(step.tip, slicer) && (
              <div className="flex gap-2.5 rounded-md bg-[#e8c547]/8 px-3.5 py-3 text-[13px] leading-relaxed shadow-[inset_0_0_0_1px_color-mix(in_srgb,#e8c547_30%,transparent)]">
                <Lightbulb
                  className="mt-0.5 size-4 shrink-0 text-[#e8c547]"
                  aria-hidden="true"
                />
                <span className="text-foreground/78">
                  <span className="font-medium text-[#e8c547]">
                    Dica de Ouro:
                  </span>{" "}
                  {forSlicerFamily(step.tip, slicer)}
                </span>
              </div>
            )}

            {step.video && (
              <p className="flex items-center gap-2 text-[12.5px] text-foreground/55">
                <Video
                  className="size-3.5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                Em dúvida?{" "}
                <a
                  href={forSlicer(step.video, slicer)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-300 hover:underline"
                >
                  Assista o vídeo do tutorial.
                </a>
              </p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2.5">
              {prev && (
                <Button variant="ghost" onClick={() => goTo(activeIndex - 1)}>
                  <ArrowLeft />
                  {prev.title}
                </Button>
              )}
              {next && (
                <>
                  <span className="ml-auto text-xs text-foreground/45">
                    Próximo: {next.title}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => goTo(activeIndex + 1)}
                  >
                    Pular este teste
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
