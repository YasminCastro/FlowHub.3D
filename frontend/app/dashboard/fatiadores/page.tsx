"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Droplet,
  Minus,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { CalLabel, CalSwatch } from "@/components/calibrations/calibration-bits";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import {
  CalibrationFilament,
  CalibrationPrinter,
  SLICERS,
  SLICER_FULL_LABELS,
  Slicer,
  describeCalibrationFilament,
  listCalibrationFilaments,
  listCalibrationPrinters,
  parseDecimal,
} from "@/lib/api/calibration";
import {
  GUIDE_STEPS,
  GuideContext,
  GuideStepId,
  materialDefaults,
} from "@/lib/calibration-guide";
import { cn } from "@/lib/utils";

type StepResult = { value: string; note: string; done: boolean };

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

const pickerClass =
  "h-8 w-auto gap-2 bg-transparent px-2.5 text-[12.5px] hover:border-brand";

export default function SlicerCalibrationPage() {
  const router = useRouter();
  const [filaments, setFilaments] = useState<CalibrationFilament[]>([]);
  const [printers, setPrinters] = useState<CalibrationPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slicer, setSlicer] = useState<Slicer>("ORCA");
  const [filamentId, setFilamentId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<
    Partial<Record<GuideStepId, StepResult>>
  >({});

  useEffect(() => {
    Promise.all([listCalibrationFilaments(), listCalibrationPrinters()])
      .then(([fils, prns]) => {
        const sorted = fils.sort((a, b) =>
          a.colorName.localeCompare(b.colorName, "pt-BR"),
        );
        setFilaments(sorted);
        setPrinters(prns);
        setFilamentId(sorted[0]?.id ?? "");
        setPrinterId(prns[0]?.id ?? "");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filament = filaments.find((f) => f.id === filamentId);
  const step = GUIDE_STEPS[activeIndex];
  const result = results[step.id] ?? { value: "", note: "", done: false };
  const doneCount = GUIDE_STEPS.filter((s) => results[s.id]?.done).length;

  // Valores anotados que entram na calibração.
  const foundValues = GUIDE_STEPS.flatMap((s) => {
    const r = results[s.id];
    const n = r?.done ? parseDecimal(r.value) : null;
    return s.field && n !== null ? [[s.field, n] as const] : [];
  });

  function saveAsCalibration() {
    if (!filament) return;
    const query = new URLSearchParams({
      filament: filament.id,
      printer: printerId,
      slicer,
      bedTemp: String(materialDefaults(filament.type).bedTemp),
      bedTempFirstLayer: String(materialDefaults(filament.type).bedTemp),
    });
    foundValues.forEach(([key, value]) => query.set(key, String(value)));
    // O teste de temperatura acha um valor só; vale para as duas camadas.
    const nozzle = query.get("nozzleTemp");
    if (nozzle) query.set("nozzleTempInitial", nozzle);
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

  // Os resultados valem para um rolo, numa máquina, num fatiador.
  function resetProgress() {
    setResults({});
    setActiveIndex(0);
  }

  function updateResult(patch: Partial<StepResult>) {
    setResults((prev) => ({
      ...prev,
      [step.id]: { ...result, ...patch },
    }));
  }

  function goTo(index: number) {
    setActiveIndex(Math.max(0, Math.min(GUIDE_STEPS.length - 1, index)));
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

  if (!filament) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Cadastre um filamento para usar o guia de calibração.
      </div>
    );
  }

  const ctx: GuideContext = {
    filament,
    slicer,
    results: Object.fromEntries(
      Object.entries(results)
        .filter(([, r]) => r?.done)
        .map(([id, r]) => [id, r!.value]),
    ),
  };
  const next = GUIDE_STEPS[activeIndex + 1];
  const prev = GUIDE_STEPS[activeIndex - 1];
  const canComplete = result.value.trim() !== "";
  const defaults = materialDefaults(filament.type);
  const [minTemp, maxTemp] = defaults.nozzleRange;

  return (
    <div className="-m-4 flex flex-1 flex-col">
      <div className="flex flex-col gap-4 px-6.5 pt-5.5 pb-4">
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <h1 className="text-[32px] leading-tight font-bold">
              Calibrar filamento no fatiador
            </h1>
            <p className="max-w-[64ch] text-sm text-muted-foreground">
              Seis testes na ordem que importa, com os valores do rolo que você
              escolheu já preenchidos.
            </p>
          </div>
          <div className="ml-auto">
            <SlicerSegment
              value={slicer}
              onChange={(value) => {
                setSlicer(value);
                resetProgress();
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md bg-[#1a1c29] px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
          <CalLabel className="shrink-0">Calibrando</CalLabel>
          <Select
            value={filamentId}
            onValueChange={(value) => {
              if (!value) return;
              setFilamentId(value);
              resetProgress();
            }}
          >
            <SelectTrigger className={pickerClass} aria-label="Filamento">
              <SelectValue>
                {(value: string) => {
                  const f = filaments.find((o) => o.id === value);
                  return f ? (
                    <span className="flex items-center gap-2">
                      <CalSwatch colors={f.colors} className="size-3" />
                      {f.colorName}
                      <Badge variant="outline">{f.type}</Badge>
                    </span>
                  ) : null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filaments.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <CalSwatch colors={f.colors} className="size-3" />
                  {describeCalibrationFilament(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={printerId}
            onValueChange={(value) => {
              if (!value) return;
              setPrinterId(value);
              resetProgress();
            }}
          >
            <SelectTrigger className={pickerClass} aria-label="Impressora">
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
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground/55">
            Faixa típica de {filament.type}:{" "}
            <span className="text-foreground tabular-nums">
              {minTemp}–{maxTemp} °C
            </span>{" "}
            · mesa{" "}
            <span className="text-foreground tabular-nums">
              {defaults.bedTemp} °C
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2.25">
            <span className="text-[11.5px] text-foreground/50 tabular-nums">
              {doneCount} de {GUIDE_STEPS.length} testes
            </span>
            <span className="flex gap-0.75" aria-hidden="true">
              {GUIDE_STEPS.map((s) => (
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

      <div className="grid flex-1 grid-cols-1 border-t md:grid-cols-[250px_minmax(0,1fr)]">
        <nav
          aria-label="Testes"
          className="flex min-w-0 flex-col gap-1.5 border-b bg-[#1a1c29] px-4 py-5 md:border-r md:border-b-0"
        >
          <CalLabel className="mb-1.5 px-2">Os testes</CalLabel>
          {GUIDE_STEPS.map((s, index) => {
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
                      {r?.done
                        ? `${r.value}${s.unit ? ` ${s.unit}` : ""}`
                        : "em andamento"}
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
              <Droplet className="mt-px size-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span>
                O rolo precisa estar seco. Filamento úmido invalida qualquer
                valor daqui.
              </span>
            </div>
            <div className="flex gap-2.25 text-xs leading-normal text-foreground/60">
              <SlidersHorizontal
                className="mt-px size-3.5 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>
                Comece de um perfil genérico do mesmo material, não do perfil
                de outro rolo.
              </span>
            </div>
          </div>
        </nav>

        <section className="flex min-w-0 flex-col gap-5.5 px-7.5 py-6">
          <div className="flex items-start gap-3.25">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand font-heading text-[13px] font-medium text-[#161826]">
              {activeIndex + 1}
            </span>
            <div className="min-w-0">
              <h2 className="mb-1 text-2xl">{step.title}</h2>
              <p className="max-w-[66ch] text-[13px] text-foreground/55">
                {step.summary}
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {SLICER_FULL_LABELS[slicer]}
            </Badge>
          </div>

          <div className="flex flex-col gap-3">
            <CalLabel>Como fazer</CalLabel>
            <ol className="flex max-w-[74ch] flex-col gap-2.5">
              {step.howTo(ctx).map((line, i) => (
                <li key={i} className="flex gap-2.75 text-[13.5px] leading-relaxed">
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
            <ul className="flex max-w-[74ch] flex-col gap-2.25 text-[13.5px] leading-relaxed text-foreground/78">
              {step.analyze.map((line, i) => (
                <li key={i} className="flex gap-2.75">
                  <Minus className="mt-1.25 size-3.25 shrink-0 text-brand" aria-hidden="true" />
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
              updateResult({ done: true });
              if (next) goTo(activeIndex + 1);
            }}
          >
            <div className="flex items-baseline gap-2.5">
              <CalLabel>Valor encontrado</CalLabel>
              <span className="text-[11.5px] text-foreground/42">
                {step.field
                  ? "entra direto na calibração deste rolo"
                  : "fica anotado no guia, não vai para a calibração"}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3.5">
              <div className="flex w-32.5 flex-col gap-1.5">
                <Label htmlFor="guide-value">{step.valueLabel}</Label>
                <div className="relative">
                  <Input
                    id="guide-value"
                    inputMode="decimal"
                    autoComplete="off"
                    value={result.value}
                    placeholder={step.placeholder}
                    onChange={(e) =>
                      updateResult({ value: e.target.value, done: false })
                    }
                    className={cn("tabular-nums", step.unit && "pr-12")}
                  />
                  {step.unit && (
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-foreground/38">
                      {step.unit}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex min-w-55 flex-1 flex-col gap-1.5">
                <Label htmlFor="guide-note">O que você viu</Label>
                <Input
                  id="guide-note"
                  value={result.note}
                  placeholder="Ex: um ponto abaixo a superfície ainda mostrava vão fino…"
                  onChange={(e) => updateResult({ note: e.target.value })}
                />
              </div>
              <Button type="submit" className="h-9" disabled={!canComplete}>
                {result.done ? "Concluído" : "Concluir teste"}
                {result.done ? <Check /> : <ArrowRight />}
              </Button>
            </div>
            <p className="text-xs text-foreground/45">
              Onde aplicar no fatiador:{" "}
              <span className="text-foreground/72">{step.applyAt[slicer]}</span>{" "}
              — depois salve o perfil com o nome do rolo.
            </p>
          </form>

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
                <Button variant="secondary" onClick={() => goTo(activeIndex + 1)}>
                  Pular este teste
                </Button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
