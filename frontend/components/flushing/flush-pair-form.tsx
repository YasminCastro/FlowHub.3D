"use client";

import { Check, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FilamentBadge } from "@/components/flushing/filament-badge";
import { FlushPairSwatch } from "@/components/flushing/flush-pair-card";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { useLastPrinter } from "@/hooks/use-last-printer";
import {
  CalibrationFilament,
  CalibrationPrinter,
  SLICERS,
  SLICER_FULL_LABELS,
  Slicer,
  listCalibrationFilaments,
  listCalibrationPrinters,
  parseDecimal,
  sanitizeNumber,
} from "@/lib/api/calibration";
import {
  FLUSH_MULTIPLIER_MAX,
  FLUSH_VOLUME_MAX,
  FLUSH_VOLUME_SUGGESTED,
  FlushPair,
  FlushPairInput,
  formatFlushMultiplier,
} from "@/lib/api/flushing";
import { cn } from "@/lib/utils";

// Os valores da tabela como digitados ("1,05").
type Draft = {
  filamentAId: string;
  filamentBId: string;
  printerId: string;
  slicer: Slicer;
  volumeAToB: string;
  volumeBToA: string;
  colorMultiplierA: string;
  colorMultiplierB: string;
  multiplier: string;
};

type ValueField = Exclude<
  keyof Draft,
  "filamentAId" | "filamentBId" | "printerId" | "slicer"
>;

const multiplierText = (value: number | null) =>
  value == null ? "" : formatFlushMultiplier(value);

function toDraft(pair?: FlushPair | null): Draft {
  return {
    filamentAId: pair?.filamentAId ?? "",
    filamentBId: pair?.filamentBId ?? "",
    printerId: pair?.printerId ?? "",
    slicer: pair?.slicer ?? "ANYCUBIC",
    volumeAToB: pair?.volumeAToB == null ? "" : String(pair.volumeAToB),
    volumeBToA: pair?.volumeBToA == null ? "" : String(pair.volumeBToA),
    colorMultiplierA: multiplierText(pair?.colorMultiplierA ?? null),
    colorMultiplierB: multiplierText(pair?.colorMultiplierB ?? null),
    multiplier: multiplierText(pair?.multiplier ?? null),
  };
}

function volumeError(raw: string) {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= FLUSH_VOLUME_MAX
    ? null
    : `Entre 0 e ${FLUSH_VOLUME_MAX.toLocaleString("pt-BR")} mm³.`;
}

function multiplierError(raw: string) {
  if (!raw.trim()) return null;
  const n = parseDecimal(raw);
  return n !== null && n >= 0 && n <= FLUSH_MULTIPLIER_MAX
    ? null
    : `Entre 0 e ${FLUSH_MULTIPLIER_MAX}.`;
}

function toInput(draft: Draft): FlushPairInput {
  const volume = (raw: string) => (raw.trim() ? Number(raw) : null);
  const decimal = (raw: string) => (raw.trim() ? parseDecimal(raw) : null);
  return {
    filamentAId: draft.filamentAId,
    filamentBId: draft.filamentBId,
    printerId: draft.printerId,
    slicer: draft.slicer,
    volumeAToB: volume(draft.volumeAToB),
    volumeBToA: volume(draft.volumeBToA),
    colorMultiplierA: decimal(draft.colorMultiplierA),
    colorMultiplierB: decimal(draft.colorMultiplierB),
    multiplier: decimal(draft.multiplier),
  };
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
            "h-full rounded-[5px] px-3.5 text-[13px] whitespace-nowrap transition-colors",
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

/** Campo numérico de uma célula da tabela. */
function CellInput({
  value,
  onChange,
  error,
  decimals,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  decimals: number;
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <Input
      aria-label={label}
      aria-invalid={!!error || undefined}
      title={error ?? undefined}
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(sanitizeNumber(e.target.value, decimals))}
      className={cn("h-8 w-24 text-center tabular-nums", className)}
    />
  );
}

export function FlushPairForm({
  pair,
  onSubmit,
  onDelete,
}: {
  /** Na edição. */
  pair?: FlushPair | null;
  onSubmit: (input: FlushPairInput) => Promise<void>;
  /** Na edição: abre a confirmação de exclusão. */
  onDelete?: () => void;
}) {
  const [filaments, setFilaments] = useState<CalibrationFilament[]>([]);
  const [printers, setPrinters] = useState<CalibrationPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(() => toDraft(pair));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { pick: pickPrinter, rememberPrinter } = useLastPrinter();

  useEffect(() => {
    Promise.all([listCalibrationFilaments(), listCalibrationPrinters()])
      .then(([fils, prns]) => {
        setFilaments(fils);
        setPrinters(prns);
        if (!pair) {
          setDraft((prev) => ({ ...prev, printerId: pickPrinter(prns) }));
        }
      })
      .finally(() => setIsLoading(false));
    // Só na montagem: a impressora lembrada vale para o cadastro novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const a = filaments.find((f) => f.id === draft.filamentAId);
  const b = filaments.find((f) => f.id === draft.filamentBId);

  const errors: Record<ValueField, string | null> = {
    volumeAToB: volumeError(draft.volumeAToB),
    volumeBToA: volumeError(draft.volumeBToA),
    colorMultiplierA: multiplierError(draft.colorMultiplierA),
    colorMultiplierB: multiplierError(draft.colorMultiplierB),
    multiplier: multiplierError(draft.multiplier),
  };
  const hasValueErrors = Object.values(errors).some(Boolean);
  const pickError =
    !a || !b
      ? "Escolha os dois filamentos."
      : a.id === b.id
        ? "Escolha dois filamentos diferentes."
        : !draft.printerId
          ? "Escolha a impressora."
          : null;

  function update(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function submit() {
    if (pickError || hasValueErrors) return;
    setIsSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(toInput(draft));
      rememberPrinter(draft.printerId);
      setSaved(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  usePageHeaderAction(
    <>
      {onDelete && (
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 />
          Excluir
        </Button>
      )}
      <Button
        size="sm"
        disabled={isLoading || isSaving || !!pickError || hasValueErrors}
        title={
          pickError ??
          (hasValueErrors ? "Corrija os valores fora da faixa" : undefined)
        }
        onClick={submit}
      >
        <Check />
        {isSaving ? "Salvando…" : "Salvar"}
      </Button>
    </>,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Célula de volume, ou o 0 da troca de um filamento para ele mesmo.
  function volumeCell(field: "volumeAToB" | "volumeBToA", label: string) {
    return (
      <CellInput
        label={label}
        decimals={0}
        placeholder="0"
        value={draft[field]}
        error={errors[field]}
        onChange={(value) => update({ [field]: value })}
      />
    );
  }

  const diagonal = (
    <td className="w-24 text-center text-foreground/40 tabular-nums">0</td>
  );

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end">
        <div className="flex min-w-0 items-center gap-4 md:flex-1">
          {a && b ? (
            <FlushPairSwatch
              pair={{
                filamentA: { ...a, brand: { name: a.brandName } },
                filamentB: { ...b, brand: { name: b.brandName } },
              }}
              className="size-14"
            />
          ) : (
            <span className="block size-14 shrink-0 rounded-md bg-neutral-800" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[32px] leading-tight font-bold">
              {a && b ? `${a.colorName} + ${b.colorName}` : "Novo flushing"}
            </h1>
            <p className="text-sm text-muted-foreground">
              O volume purgado na troca entre os dois filamentos, nas duas
              direções.
            </p>
          </div>
        </div>
        <div className="shrink-0 overflow-x-auto">
          <SlicerSegment
            value={draft.slicer}
            onChange={(slicer) => update({ slicer })}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-md bg-[#1a1c29] px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
        {(
          [
            { n: 1, field: "filamentAId", filament: a },
            { n: 2, field: "filamentBId", filament: b },
          ] as const
        ).map(({ n, field, filament }) => (
          <div key={field} className="flex flex-wrap items-center gap-3">
            <FilamentBadge n={n} filament={filament} />
            <FilamentCascadeSelect
              filaments={filaments}
              value={draft[field]}
              onChange={(id) => update({ [field]: id })}
              className="min-w-0 flex-1"
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <CalLabel className="shrink-0">Impressora</CalLabel>
          <Select
            value={draft.printerId || null}
            onValueChange={(value) => {
              if (value) update({ printerId: value });
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
                    {printers.find((p) => p.id === value)?.name ?? "Impressora"}
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
      </section>

      <section className="flex flex-col gap-4">
        <CalLabel>Flushing volumes</CalLabel>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1.5 text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="px-1 text-left">
                  <CalLabel>Color multiplier</CalLabel>
                </th>
                <th scope="col" className="px-1">
                  <CalLabel>De / para</CalLabel>
                </th>
                <th scope="col" className="px-1">
                  <span className="flex justify-center">
                    <FilamentBadge n={1} filament={a} />
                  </span>
                </th>
                <th scope="col" className="px-1">
                  <span className="flex justify-center">
                    <FilamentBadge n={2} filament={b} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <CellInput
                    label="Color multiplier do filamento 1"
                    decimals={2}
                    placeholder="1,00"
                    value={draft.colorMultiplierA}
                    error={errors.colorMultiplierA}
                    onChange={(value) => update({ colorMultiplierA: value })}
                    className="text-brand"
                  />
                </td>
                <th scope="row" className="px-1">
                  <span className="flex justify-center">
                    <FilamentBadge n={1} filament={a} />
                  </span>
                </th>
                {diagonal}
                <td>
                  {volumeCell("volumeAToB", "Volume do filamento 1 para o 2")}
                </td>
              </tr>
              <tr>
                <td>
                  <CellInput
                    label="Color multiplier do filamento 2"
                    decimals={2}
                    placeholder="1,00"
                    value={draft.colorMultiplierB}
                    error={errors.colorMultiplierB}
                    onChange={(value) => update({ colorMultiplierB: value })}
                    className="text-brand"
                  />
                </td>
                <th scope="row" className="px-1">
                  <span className="flex justify-center">
                    <FilamentBadge n={2} filament={b} />
                  </span>
                </th>
                <td>
                  {volumeCell("volumeBToA", "Volume do filamento 2 para o 1")}
                </td>
                {diagonal}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-foreground/55">
          Volume em mm³ ao sair do filamento da linha e entrar no da coluna. O
          fatiador sugere entre{" "}
          {FLUSH_VOLUME_SUGGESTED.min.toLocaleString("pt-BR")} e{" "}
          {FLUSH_VOLUME_SUGGESTED.max.toLocaleString("pt-BR")} mm³.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-foreground/78">Multiplier</span>
          <CellInput
            label="Multiplier"
            decimals={2}
            placeholder="1,00"
            value={draft.multiplier}
            error={errors.multiplier}
            onChange={(value) => update({ multiplier: value })}
          />
          <span className="text-xs text-foreground/45">
            Entre 0 e {FLUSH_MULTIPLIER_MAX}.
          </span>
        </div>

        <div className="flex min-h-5 items-center text-[11.5px]">
          {hasValueErrors ? (
            <span role="alert" className="text-destructive">
              Há valores fora da faixa. Passe o mouse sobre a célula em vermelho
              para ver o limite.
            </span>
          ) : submitError ? (
            <span role="alert" className="text-destructive">
              {submitError}
            </span>
          ) : saved ? (
            <span className="text-foreground/45">Salvo</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
