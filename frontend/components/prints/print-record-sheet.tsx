"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  Ban,
  CameraIcon,
  Droplets,
  GitBranch,
  Layers2,
  ListOrdered,
  Plus,
  ScrollText,
  Star,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FilamentUsageDraft,
  FilamentUsageFields,
  parseDecimal,
  toUsages,
} from "@/components/prints/filament-usage-fields";
import {
  ChangedMark,
  FAILURE_COLOR,
  OptionalHint,
  OutcomeToggle,
  SectionLabel,
  SuffixInput,
  changedFieldClass,
} from "@/components/prints/print-bits";
import {
  FAILURE_REASONS,
  MOCK_PRINTERS,
  PrintFilament,
  PrintItem,
  PrintOutcome,
  PrintRecord,
  PrintRecordInput,
  addPrintRecord,
  computeCost,
  describeChanges,
  describePrintFilament,
  formatDecimal,
  formatDuration,
  formatGrams,
  getRecordGrams,
  parseDuration,
} from "@/lib/api/print";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

const REASON_ICONS: Record<string, typeof Ban> = {
  "Descolou da mesa": ArrowDownToLine,
  Entupiu: Droplets,
  "Camada deslocada": Layers2,
  "Acabou filamento": ScrollText,
};

const OTHER_REASON = "__other";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function ordinal(n: number) {
  return `${n}º`;
}

type SettingsDraft = {
  layerHeightMm: string;
  infillPercent: string;
  walls: string;
  temperatureC: string;
};

// O formulário em si: montado a cada abertura (e a cada troca de base),
// então o estado inicial sempre vem do registro de base.
function RecordForm({
  item,
  base,
  filaments,
  onChangeBase,
  onCancel,
  onSaved,
}: {
  item: PrintItem;
  base: PrintRecord;
  filaments: PrintFilament[];
  onChangeBase: (recordId: string) => void;
  onCancel: () => void;
  onSaved: (item: PrintItem) => void;
}) {
  const isDefaultBase = base.id === item.defaultRecordId;
  const baseUnits = Math.max(1, base.units);

  const [date, setDate] = useState(today());
  const [printerId, setPrinterId] = useState(base.printer.id);
  const [units, setUnits] = useState(String(base.units));
  const [usages, setUsages] = useState<FilamentUsageDraft[]>(
    base.filaments.map((u) => ({
      filamentId: u.filament.id,
      grams: formatDecimal(u.grams, 1),
    })),
  );
  const [time, setTime] = useState(formatDuration(base.totalMinutes));
  const [gramsTouched, setGramsTouched] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);
  const [settings, setSettings] = useState<SettingsDraft>({
    layerHeightMm: formatDecimal(base.settings.layerHeightMm),
    infillPercent: String(base.settings.infillPercent),
    walls: String(base.settings.walls),
    temperatureC: String(base.settings.temperatureC),
  });
  const [outcome, setOutcome] = useState<PrintOutcome>("SUCCESS");
  const [reason, setReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [failureGrams, setFailureGrams] = useState("");
  const [failureTime, setFailureTime] = useState("");
  const [createJournalEntry, setCreateJournalEntry] = useState(true);
  const [note, setNote] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFailure = outcome === "FAILURE";
  const unitCount = Math.max(1, Math.round(parseDecimal(units)) || 1);
  const printer = MOCK_PRINTERS.find((p) => p.id === printerId) ?? base.printer;
  const parsedUsages = toUsages(usages, filaments);
  const plannedMinutes = parseDuration(time) ?? 0;

  // Gramas e tempo acompanham as unidades, a partir do padrão por unidade,
  // até o usuário mexer neles.
  function changeUnits(text: string) {
    setUnits(text);
    const n = Math.max(1, Math.round(parseDecimal(text)) || 1);
    if (!gramsTouched) {
      setUsages((prev) =>
        prev.map((row, index) => {
          const baseUsage = base.filaments[index];
          return baseUsage
            ? {
                ...row,
                grams: formatDecimal((baseUsage.grams / baseUnits) * n, 1),
              }
            : row;
        }),
      );
    }
    if (!timeTouched) {
      setTime(formatDuration((base.totalMinutes / baseUnits) * n));
    }
  }

  const nextSettings = {
    ...base.settings,
    layerHeightMm: parseDecimal(settings.layerHeightMm),
    infillPercent: Math.round(parseDecimal(settings.infillPercent)),
    walls: Math.round(parseDecimal(settings.walls)),
    temperatureC: Math.round(parseDecimal(settings.temperatureC)),
  };

  const changed = {
    printer: printerId !== base.printer.id,
    filament:
      usages.map((u) => u.filamentId).join() !==
      base.filaments.map((u) => u.filament.id).join(),
    units: unitCount !== base.units,
    layerHeightMm: nextSettings.layerHeightMm !== base.settings.layerHeightMm,
    infillPercent: nextSettings.infillPercent !== base.settings.infillPercent,
    walls: nextSettings.walls !== base.settings.walls,
    temperatureC: nextSettings.temperatureC !== base.settings.temperatureC,
  };
  const settingsChanges = [
    changed.layerHeightMm,
    changed.infillPercent,
    changed.walls,
    changed.temperatureC,
  ].filter(Boolean).length;

  const changeSummary = describeChanges(base, {
    printer,
    filaments: parsedUsages,
    units: unitCount,
    settings: nextSettings,
  });

  // Na falha, o que foi gasto até parar se divide entre os filamentos na
  // proporção do planejado.
  const plannedGrams = getRecordGrams({ filaments: parsedUsages });
  const spentGrams = parseDecimal(failureGrams);
  const recordUsages = isFailure
    ? parsedUsages.map((u) => ({
        ...u,
        grams:
          plannedGrams > 0
            ? (u.grams / plannedGrams) * spentGrams
            : spentGrams / Math.max(1, parsedUsages.length),
      }))
    : parsedUsages;
  const recordMinutes = isFailure
    ? (parseDuration(failureTime) ?? 0)
    : plannedMinutes;
  const cost = computeCost({
    filaments: recordUsages,
    totalMinutes: recordMinutes,
  });
  const failureReason =
    reason === OTHER_REASON ? otherReason.trim() : (reason ?? "");

  function setSetting(key: keyof SettingsDraft, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => [
      ...prev,
      ...images.map((file) => URL.createObjectURL(file)),
    ]);
  }

  function validate() {
    if (!date) return "Informe a data.";
    if (!parsedUsages.length) return "Escolha ao menos um filamento.";
    if (isFailure) {
      if (!failureReason) return "Conte o que aconteceu.";
      if (parseDuration(failureTime) == null)
        return "Informe o tempo até parar (ex.: 0 h 09).";
      return null;
    }
    if (parsedUsages.some((u) => u.grams <= 0))
      return "Informe as gramas de cada filamento.";
    if (plannedMinutes <= 0) return "Informe o tempo (ex.: 2 h 06).";
    return null;
  }

  async function save() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    const input: PrintRecordInput = {
      printedAt: toIso(date),
      printer,
      filaments: recordUsages,
      units: unitCount,
      totalMinutes: recordMinutes,
      settings: nextSettings,
      outcome,
      failureReason: isFailure ? failureReason : null,
      note: note.trim() || null,
      changeSummary: isFailure ? null : changeSummary,
      photos,
    };
    setIsSaving(true);
    try {
      const updated = await addPrintRecord(item.id, input, { makeDefault });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setIsSaving(false);
    }
  }

  const successRecords = item.records.filter((r) => r.outcome === "SUCCESS");
  const firstUsage = recordUsages[0];
  const changedSummaryText = [note.trim(), changeSummary]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <SheetHeader className="px-6 pt-5 pb-0">
        <SheetTitle className="text-lg">Novo registro</SheetTitle>
        <SheetDescription className="text-[12.5px]">
          {item.name} · {ordinal(item.records.length + 1)} registro
        </SheetDescription>
      </SheetHeader>

      <div className="mx-6 flex items-center gap-2.25 rounded-md bg-brand/8 px-3.25 py-2 shadow-[inset_0_0_0_1px_var(--brand-800)]">
        <Star
          className={cn(
            "size-3.25 shrink-0 text-brand",
            isDefaultBase && "fill-current",
          )}
          aria-hidden="true"
        />
        <span className="text-[12.5px] text-foreground/75">
          Começou do registro {isDefaultBase ? "padrão " : ""}de{" "}
          {formatDatePtBR(base.printedAt, { day: "2-digit", month: "2-digit" })}
        </span>
        <Select
          value={base.id}
          onValueChange={(value) => value && onChangeBase(value)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Começar de outro registro"
            className="ml-auto w-auto border-transparent bg-transparent px-1.5 text-xs text-brand-300 hover:bg-brand/10"
          >
            Usar outro
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            {successRecords.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.filaments[0] && (
                  <FilamentDot colors={r.filaments[0].filament.colors} />
                )}
                {formatDatePtBR(r.printedAt)} · {r.units} un.
                {r.id === item.defaultRecordId && " · padrão"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto px-6 py-1">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="record-date">Data</Label>
            <Input
              id="record-date"
              type="date"
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              Impressora
              {changed.printer && <ChangedMark />}
            </Label>
            <Select
              value={printerId}
              onValueChange={(value) => value && setPrinterId(value)}
            >
              <SelectTrigger
                aria-label="Impressora"
                className={cn("w-full", changedFieldClass(changed.printer))}
              >
                <SelectValue>
                  {(value: string) =>
                    MOCK_PRINTERS.find((p) => p.id === value)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MOCK_PRINTERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            Filamento
            {changed.filament && <ChangedMark />}
          </Label>
          <FilamentUsageFields
            value={usages}
            onChange={(next) => {
              if (next.some((row, i) => row.grams !== usages[i]?.grams)) {
                setGramsTouched(true);
              }
              setUsages(next);
            }}
            filaments={filaments}
            changed={changed.filament}
            showPrice={false}
          />
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="record-units">
              Unidades
              {changed.units && <ChangedMark />}
            </Label>
            <Input
              id="record-units"
              inputMode="numeric"
              value={units}
              onChange={(e) => changeUnits(e.target.value)}
              className={cn("tabular-nums", changedFieldClass(changed.units))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="record-time">Tempo total</Label>
            <Input
              id="record-time"
              value={time}
              placeholder="2 h 06"
              onChange={(e) => {
                setTimeTouched(true);
                setTime(e.target.value);
              }}
              className="tabular-nums"
            />
          </div>
        </div>
        {changed.units && (!gramsTouched || !timeTouched) && (
          <p className="-mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Gramas e tempo ajustados para {unitCount}{" "}
            {unitCount === 1 ? "unidade" : "unidades"} a partir do registro de
            base ({formatGrams(getRecordGrams(base) / baseUnits)} e{" "}
            {formatDuration(base.totalMinutes / baseUnits)} cada). Corrija se o
            fatiador disse outra coisa.
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center">
            <SectionLabel>Configuração</SectionLabel>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              {settingsChanges === 0
                ? "igual ao registro de base"
                : `${settingsChanges} ${settingsChanges === 1 ? "alteração" : "alterações"}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {(
              [
                ["layerHeightMm", "Camada", "mm"],
                ["infillPercent", "Preench.", "%"],
                ["walls", "Paredes", ""],
                ["temperatureC", "Temp.", "°C"],
              ] as const
            ).map(([key, label, suffix]) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`record-${key}`} className="whitespace-nowrap">
                  {label}
                  {changed[key] && <ChangedMark />}
                </Label>
                <SuffixInput
                  id={`record-${key}`}
                  suffix={suffix}
                  value={settings[key]}
                  onChange={(e) => setSetting(key, e.target.value)}
                  className={changedFieldClass(changed[key])}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <SectionLabel>Resultado</SectionLabel>
          <OutcomeToggle value={outcome} onChange={setOutcome} />
        </div>

        {isFailure && (
          <>
            <div className="flex flex-col gap-2">
              <Label>O que aconteceu</Label>
              <div className="flex flex-wrap gap-1.75">
                {[...FAILURE_REASONS, OTHER_REASON].map((option) => {
                  const Icon = REASON_ICONS[option] ?? Plus;
                  const selected = reason === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setReason(selected ? null : option)}
                      className={cn(
                        "inline-flex items-center gap-1.75 rounded-md border px-2.75 py-1.5 text-[13px] whitespace-nowrap transition-colors",
                        selected
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border hover:border-brand hover:bg-brand/8 hover:text-brand",
                      )}
                    >
                      <Icon className="size-3.75" aria-hidden="true" />
                      {option === OTHER_REASON ? "Outro" : option}
                    </button>
                  );
                })}
              </div>
              {reason === OTHER_REASON && (
                <Input
                  autoFocus
                  aria-label="Descreva o que aconteceu"
                  placeholder="Ex.: warping na borda, fio puxou a peça..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="failure-grams">Gramas gastas até parar</Label>
                <SuffixInput
                  id="failure-grams"
                  suffix="g"
                  placeholder="0"
                  value={failureGrams}
                  onChange={(e) => setFailureGrams(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="failure-time">Tempo até parar</Label>
                <Input
                  id="failure-time"
                  placeholder="0 h 09"
                  value={failureTime}
                  onChange={(e) => setFailureTime(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.25 rounded-md bg-[#d97a7a]/7 px-3.75 py-3.25 shadow-[inset_0_0_0_1px_rgba(217,122,122,0.3)]">
              <div className="flex items-baseline text-[12.5px] text-foreground/70">
                <span>Custo perdido</span>
                <span
                  className="ml-auto font-heading text-[15px] font-medium tabular-nums"
                  style={{ color: FAILURE_COLOR }}
                >
                  {formatBRL(cost.total)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ScrollText className="size-3.25" aria-hidden="true" />
                {spentGrams > 0
                  ? `Os ${formatGrams(spentGrams)} saem do rolo mesmo assim.`
                  : "O que foi gasto sai do rolo mesmo assim."}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListOrdered className="size-3.25" aria-hidden="true" />
                Se veio da fila, o item volta para lá para reimprimir.
              </div>
            </div>

            <label className="flex items-center gap-2.25 text-[12.5px]">
              <Checkbox
                checked={createJournalEntry}
                onCheckedChange={(checked) => setCreateJournalEntry(checked)}
              />
              Criar entrada no Diário com este problema
            </label>
          </>
        )}

        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-18 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-neutral-700 text-muted-foreground transition-colors hover:border-brand hover:text-brand"
          >
            <CameraIcon className="size-4.25" aria-hidden="true" />
            <span className="text-[10.5px]">
              {photos.length ? `${photos.length} fotos` : "Fotos"}
            </span>
          </button>
          <div className="flex flex-col gap-2">
            <Label htmlFor="record-note">
              Observação <OptionalHint />
            </Label>
            <Input
              id="record-note"
              placeholder="Ex.: pedido da Ana"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        {photos.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {photos.map((src, index) => (
              <div key={src} className="group relative size-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Foto ${index + 1}`}
                  className="size-full rounded-sm object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remover foto ${index + 1}`}
                  onClick={() => {
                    URL.revokeObjectURL(src);
                    setPhotos((prev) => prev.filter((p) => p !== src));
                  }}
                  className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!isFailure && (
          <div className="flex flex-col gap-2.25 pb-2">
            <label className="flex items-center gap-2.25 text-[12.5px]">
              <Checkbox
                checked={makeDefault}
                onCheckedChange={(checked) => setMakeDefault(checked)}
              />
              Marcar como novo registro padrão
            </label>
            <div className="flex items-center gap-1.75 text-xs text-muted-foreground">
              <GitBranch className="size-3.25" aria-hidden="true" />
              Mudou a peça em si (escala, modelo)?
              <Link
                href={`/dashboard/impressoes/new?derivadoDe=${item.id}`}
                className="text-brand-300 hover:underline"
              >
                Criar derivado
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6 py-3.5 shadow-[0_-1px_0_var(--border)]">
        {!isFailure && (
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground">
            <span>Custo</span>
            <span className="font-heading text-[15px] font-medium text-foreground tabular-nums">
              {formatBRL(cost.total)}
            </span>
            <span className="tabular-nums">
              {formatBRL(cost.total / unitCount)} / un.
            </span>
            {firstUsage && (
              <span className="ml-auto inline-flex items-center gap-1.5 tabular-nums">
                <FilamentDot colors={firstUsage.filament.colors} />
                {describePrintFilament(firstUsage.filament)}{" "}
                {formatGrams(firstUsage.filament.remainingGrams)} →{" "}
                {formatGrams(
                  Math.max(
                    0,
                    firstUsage.filament.remainingGrams - firstUsage.grams,
                  ),
                )}
              </span>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
            {isFailure ? (
              "Falhas não entram nas médias do item."
            ) : (
              <>
                O que mudou:{" "}
                <span className="text-foreground/70">{changedSummaryText}</span>
              </>
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={save}
          >
            {isSaving
              ? "Salvando..."
              : isFailure
                ? "Salvar falha"
                : "Salvar registro"}
          </Button>
        </div>
      </div>
    </>
  );
}

export function PrintRecordSheet({
  item,
  open,
  onOpenChange,
  baseRecordId,
  filaments,
  onSaved,
}: {
  item: PrintItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Registro de onde o formulário começa; padrão do item quando omitido. */
  baseRecordId?: string | null;
  filaments: PrintFilament[];
  onSaved: (item: PrintItem) => void;
}) {
  // Troca feita pelo "Usar outro"; some ao fechar.
  const [baseOverride, setBaseOverride] = useState<string | null>(null);
  const baseId = baseOverride ?? baseRecordId ?? item.defaultRecordId;

  function handleOpenChange(next: boolean) {
    if (!next) setBaseOverride(null);
    onOpenChange(next);
  }

  const base =
    item.records.find((r) => r.id === baseId) ??
    item.records.find((r) => r.id === item.defaultRecordId) ??
    item.records[0];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="gap-4 data-[side=right]:w-full data-[side=right]:sm:max-w-145"
      >
        {open && base && (
          <RecordForm
            key={base.id}
            item={item}
            base={base}
            filaments={filaments}
            onChangeBase={setBaseOverride}
            onCancel={() => handleOpenChange(false)}
            onSaved={(updated) => {
              onSaved(updated);
              handleOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
