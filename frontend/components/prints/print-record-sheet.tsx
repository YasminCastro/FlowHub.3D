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
import { PendingPhoto, pickPhotos } from "@/components/prints/pending-photos";
import {
  FilamentUsageDraft,
  FilamentUsageFields,
  usageDraftFrom,
  parseDecimal,
  toUsages,
} from "@/components/prints/filament-usage-fields";
import {
  ExtraItemUsageDraft,
  ExtraItemUsageFields,
  extraItemDraftFrom,
  toExtraItemUsages,
} from "@/components/prints/extra-item-usage-fields";
import {
  ChangedMark,
  DurationInput,
  EMPTY_DURATION,
  durationToMinutes,
  FAILURE_COLOR,
  minutesToDuration,
  OptionalHint,
  OutcomeToggle,
  SectionLabel,
  SuffixInput,
  changedFieldClass,
} from "@/components/prints/print-bits";
import { FramedPhoto } from "@/components/prints/framed-photo";
import { useLastPrinter } from "@/hooks/use-last-printer";
import {
  DEFAULT_SLICER_SETTINGS,
  FAILURE_REASONS,
  PrintExtraItem,
  PrintFilament,
  PrintItem,
  PrintOutcome,
  PrintRecord,
  PrintRecordInput,
  SlicerSettings,
  addPrintRecord,
  updatePrintRecord,
  CostContext,
  computeCost,
  computeCostPerUnit,
  describeChanges,
  describePrintFilament,
  formatDecimal,
  formatDecimalInput,
  formatDuration,
  formatGrams,
  getRecordGrams,
  isDeletedExtraItem,
  isDeletedFilament,
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
  isEditing,
  filaments,
  extraItems,
  costs,
  onChangeBase,
  onCancel,
  onSaved,
}: {
  item: PrintItem;
  /** Novo: o registro de onde começa. Edição: o próprio registro. */
  base: PrintRecord;
  isEditing: boolean;
  filaments: PrintFilament[];
  extraItems: PrintExtraItem[];
  costs: CostContext;
  onChangeBase: (recordId: string) => void;
  onCancel: () => void;
  onSaved: (item: PrintItem, photoError: string | null) => void;
}) {
  const isDefaultBase = base.id === item.defaultRecordId;
  const baseUnits = Math.max(1, base.units);

  const [date, setDate] = useState(
    isEditing ? base.printedAt.slice(0, 10) : today(),
  );
  // Edição: a do registro. Novo: a última usada (impressora excluída não
  // pode ir num registro novo).
  const lastPrinter = useLastPrinter();
  const [printerId, setPrinterId] = useState(
    isEditing && costs.printers.some((p) => p.id === base.printer.id)
      ? base.printer.id!
      : lastPrinter.pick(costs.printers),
  );
  const [units, setUnits] = useState(String(base.units));
  // Rolo do registro de base que já acabou continua escolhível aqui; o que
  // foi excluído não, e a linha dele começa vazia.
  const filamentOptions = [
    ...filaments,
    ...base.filaments
      .map((u) => u.filament)
      .filter(
        (f) =>
          (isEditing || !isDeletedFilament(f)) &&
          !filaments.some((option) => option.id === f.id),
      ),
  ];
  const [usages, setUsages] = useState<FilamentUsageDraft[]>(
    base.filaments.map((u) =>
      usageDraftFrom(u.filament, u.grams, { keepDeleted: isEditing }),
    ),
  );
  // Como nos filamentos: na edição, o item extra excluído continua.
  const extraItemOptions = [
    ...extraItems,
    ...base.extraItems
      .map((u) => u.extraItem)
      .filter(
        (i) =>
          isEditing &&
          isDeletedExtraItem(i) &&
          !extraItems.some((option) => option.id === i.id),
      ),
  ];
  const [extraItemDrafts, setExtraItemDrafts] = useState<ExtraItemUsageDraft[]>(
    base.extraItems.map((u) =>
      extraItemDraftFrom(u, { keepDeleted: isEditing }),
    ),
  );
  const [time, setTime] = useState(minutesToDuration(base.totalMinutes));
  const [gramsTouched, setGramsTouched] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);
  // Configuração do fatiador é opcional: aberta se o registro de base tinha.
  const [showSettings, setShowSettings] = useState(base.settings != null);
  const startSettings = base.settings ?? DEFAULT_SLICER_SETTINGS;
  const [settings, setSettings] = useState<SettingsDraft>({
    layerHeightMm: formatDecimal(startSettings.layerHeightMm),
    infillPercent: String(startSettings.infillPercent),
    walls: String(startSettings.walls),
    temperatureC:
      startSettings.temperatureC != null
        ? String(startSettings.temperatureC)
        : "",
  });
  // Na edição, resultado, motivo, observação e fotos vêm do registro.
  const editedFailure = isEditing && base.outcome === "FAILURE";
  const knownReason =
    editedFailure && FAILURE_REASONS.includes(base.failureReason ?? "");
  const [outcome, setOutcome] = useState<PrintOutcome>(
    isEditing ? base.outcome : "SUCCESS",
  );
  const [reason, setReason] = useState<string | null>(
    editedFailure ? (knownReason ? base.failureReason : OTHER_REASON) : null,
  );
  const [otherReason, setOtherReason] = useState(
    editedFailure && !knownReason ? (base.failureReason ?? "") : "",
  );
  const [failureGrams, setFailureGrams] = useState(
    editedFailure ? formatDecimalInput(getRecordGrams(base), 1) : "",
  );
  const [failureTime, setFailureTime] = useState(
    editedFailure ? minutesToDuration(base.totalMinutes) : EMPTY_DURATION,
  );
  const [createJournalEntry, setCreateJournalEntry] = useState(true);
  const [note, setNote] = useState(isEditing ? (base.note ?? "") : "");
  const [makeDefault, setMakeDefault] = useState(false);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [savedPhotos, setSavedPhotos] = useState(isEditing ? base.photos : []);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFailure = outcome === "FAILURE";
  const unitCount = Math.max(1, Math.round(parseDecimal(units)) || 1);
  const printerOptions = costs.printers.map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const selectedPrinter = printerOptions.find((p) => p.id === printerId);
  const printer = selectedPrinter ?? base.printer;
  const parsedUsages = toUsages(usages, filamentOptions);
  const parsedExtraItems = toExtraItemUsages(extraItemDrafts, extraItemOptions);
  const plannedMinutes = durationToMinutes(time) ?? 0;

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
                grams: formatDecimalInput((baseUsage.grams / baseUnits) * n, 1),
              }
            : row;
        }),
      );
    }
    if (!timeTouched) {
      setTime(minutesToDuration((base.totalMinutes / baseUnits) * n));
    }
  }

  const nextSettings: SlicerSettings | null = showSettings
    ? {
        ...startSettings,
        layerHeightMm: parseDecimal(settings.layerHeightMm),
        infillPercent: Math.round(parseDecimal(settings.infillPercent)),
        walls: Math.round(parseDecimal(settings.walls)),
        temperatureC: settings.temperatureC.trim()
          ? Math.round(parseDecimal(settings.temperatureC))
          : null,
      }
    : null;

  // "Mudou" só faz sentido com configuração dos dois lados.
  function settingDiffers(key: keyof SettingsDraft) {
    return (
      base.settings != null &&
      nextSettings != null &&
      nextSettings[key] !== base.settings[key]
    );
  }

  const changed = {
    printer: printerId !== base.printer.id,
    filament:
      usages.map((u) => u.filamentId).join() !==
      base.filaments.map((u) => u.filament.id).join(),
    units: unitCount !== base.units,
    extraItems:
      extraItemDrafts.map((u) => `${u.extraItemId}:${u.quantity}`).join() !==
      base.extraItems.map((u) => `${u.extraItem.id}:${u.quantity}`).join(),
    layerHeightMm: settingDiffers("layerHeightMm"),
    infillPercent: settingDiffers("infillPercent"),
    walls: settingDiffers("walls"),
    temperatureC: settingDiffers("temperatureC"),
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
    extraItems: parsedExtraItems,
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
    ? (durationToMinutes(failureTime) ?? 0)
    : plannedMinutes;
  const costInput = {
    filaments: recordUsages,
    extraItems: parsedExtraItems,
    totalMinutes: recordMinutes,
    units: unitCount,
    outcome,
    printer,
  };
  const cost = computeCost(costInput, costs);
  const costPerUnit = computeCostPerUnit(costInput, costs);
  const failureReason =
    reason === OTHER_REASON ? otherReason.trim() : (reason ?? "");

  function setSetting(key: keyof SettingsDraft, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const { accepted, error: photoError } = pickPhotos(
      files,
      savedPhotos.length + photos.length,
    );
    setError(photoError);
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function validate() {
    if (!date) return "Informe a data.";
    if (isEditing && isDefaultBase && isFailure)
      return "O registro padrão precisa ter dado certo. Marque outro como padrão antes.";
    if (!selectedPrinter) return "Escolha a impressora.";
    if (!parsedUsages.length) return "Escolha ao menos um filamento.";
    if (extraItemDrafts.some((row) => !row.extraItemId))
      return "Escolha o item extra ou remova a linha.";
    if (parsedExtraItems.some((u) => u.quantity < 1))
      return "Informe quantos de cada item extra vão por peça.";
    if (isFailure) {
      if (!failureReason) return "Conte o que aconteceu.";
      if (durationToMinutes(failureTime) == null)
        return "Informe o tempo até parar.";
      return null;
    }
    if (parsedUsages.some((u) => u.grams <= 0))
      return "Informe as gramas de cada filamento.";
    if (plannedMinutes <= 0) return "Informe o tempo total.";
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
      extraItems: parsedExtraItems,
      units: unitCount,
      totalMinutes: recordMinutes,
      settings: nextSettings,
      outcome,
      failureReason: isFailure ? failureReason : null,
      note: note.trim() || null,
      changeSummary: isFailure ? null : changeSummary,
    };
    setIsSaving(true);
    try {
      const options = { makeDefault: makeDefault && !isFailure };
      const files = photos.map((photo) => photo.file);
      const { item: updated, photoError } = isEditing
        ? await updatePrintRecord(item.id, base.id, input, options, {
            add: files,
            removeIds: base.photos
              .filter((photo) => !savedPhotos.some((p) => p.id === photo.id))
              .map((photo) => photo.id),
          })
        : await addPrintRecord(item.id, input, options, files);
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      if (selectedPrinter) lastPrinter.rememberPrinter(selectedPrinter.id);
      onSaved(updated, photoError);
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
        <SheetTitle className="text-lg">
          {isEditing ? "Editar registro" : "Novo registro"}
        </SheetTitle>
        <SheetDescription className="text-[12.5px]">
          {item.name} ·{" "}
          {isEditing
            ? `registro de ${formatDatePtBR(base.printedAt)}`
            : `${ordinal(item.records.length + 1)} registro`}
        </SheetDescription>
      </SheetHeader>

      {!isEditing && (
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
            {formatDatePtBR(base.printedAt, {
              day: "2-digit",
              month: "2-digit",
            })}
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
      )}

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
              value={printerId || null}
              onValueChange={(value) => value && setPrinterId(value)}
            >
              <SelectTrigger
                aria-label="Impressora"
                className={cn("w-full", changedFieldClass(changed.printer))}
              >
                <SelectValue>
                  {(value: string) =>
                    printerOptions.find((p) => p.id === value)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {printerOptions.map((p) => (
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
            filaments={filamentOptions}
            changed={changed.filament}
            showPrice={false}
            stacked
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            Itens extras
            {changed.extraItems && <ChangedMark />}
          </Label>
          <ExtraItemUsageFields
            value={extraItemDrafts}
            onChange={setExtraItemDrafts}
            items={extraItemOptions}
            changed={changed.extraItems}
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
            <DurationInput
              id="record-time"
              label="Tempo total"
              value={time}
              onChange={(next) => {
                setTimeTouched(true);
                setTime(next);
              }}
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
          <div className="flex items-center gap-2">
            <SectionLabel>Configuração do fatiador</SectionLabel>
            {showSettings && (
              <>
                <span className="ml-auto text-[11.5px] text-muted-foreground">
                  {!base.settings
                    ? "nova"
                    : settingsChanges === 0
                      ? isEditing
                        ? "sem alterações"
                        : "igual ao registro de base"
                      : `${settingsChanges} ${settingsChanges === 1 ? "alteração" : "alterações"}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => setShowSettings(false)}
                >
                  Remover
                </Button>
              </>
            )}
          </div>
          {showSettings ? (
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
                  <Label
                    htmlFor={`record-${key}`}
                    className="whitespace-nowrap"
                  >
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
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-brand-300"
              onClick={() => setShowSettings(true)}
            >
              <Plus />
              Adicionar configuração do fatiador
            </Button>
          )}
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
                <DurationInput
                  id="failure-time"
                  label="Tempo até parar"
                  value={failureTime}
                  onChange={setFailureTime}
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

            {!isEditing && (
              <label className="flex items-center gap-2.25 text-[12.5px]">
                <Checkbox
                  checked={createJournalEntry}
                  onCheckedChange={(checked) => setCreateJournalEntry(checked)}
                />
                Criar entrada no Diário com este problema
              </label>
            )}
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
              {photos.length
                ? `${isEditing ? "+" : ""}${photos.length} fotos`
                : "Fotos"}
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
        {(savedPhotos.length > 0 || photos.length > 0) && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {savedPhotos.map((photo, index) => (
              <div key={photo.id} className="group relative size-12">
                <FramedPhoto
                  photo={photo}
                  alt={`Foto salva ${index + 1}`}
                  className="size-full rounded-sm"
                />
                <button
                  type="button"
                  aria-label={`Remover foto salva ${index + 1}`}
                  onClick={() =>
                    setSavedPhotos((prev) =>
                      prev.filter((p) => p.id !== photo.id),
                    )
                  }
                  className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            {photos.map(({ preview: src }, index) => (
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
                    setPhotos((prev) => prev.filter((p) => p.preview !== src));
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
            {!(isEditing && isDefaultBase) && (
              <label className="flex items-center gap-2.25 text-[12.5px]">
                <Checkbox
                  checked={makeDefault}
                  onCheckedChange={(checked) => setMakeDefault(checked)}
                />
                {isEditing
                  ? "Marcar como registro padrão"
                  : "Marcar como novo registro padrão"}
              </label>
            )}
            {!isEditing && (
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
            )}
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
              {formatBRL(costPerUnit.total)} / un.
            </span>
            {firstUsage && (
              <span className="ml-auto inline-flex items-center gap-1.5 tabular-nums">
                <FilamentDot colors={firstUsage.filament.colors} />
                {describePrintFilament(firstUsage.filament)} ·{" "}
                {formatGrams(firstUsage.grams)}
                {recordUsages.length > 1 && ` +${recordUsages.length - 1}`}
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
            ) : isEditing ? (
              "Filamentos e itens extras que já estavam mantêm o preço do dia."
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
              : isEditing
                ? "Salvar alterações"
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
  editRecordId,
  filaments,
  extraItems,
  costs,
  onSaved,
}: {
  item: PrintItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Registro de onde o formulário começa; padrão do item quando omitido. */
  baseRecordId?: string | null;
  /** Com ele, o painel edita esse registro em vez de criar um novo. */
  editRecordId?: string | null;
  filaments: PrintFilament[];
  extraItems: PrintExtraItem[];
  costs: CostContext;
  /** photoError: o registro salvou, mas as fotos não foram enviadas. */
  onSaved: (item: PrintItem, photoError: string | null) => void;
}) {
  // Troca feita pelo "Usar outro"; some ao fechar.
  const [baseOverride, setBaseOverride] = useState<string | null>(null);
  const isEditing = !!editRecordId;
  const baseId = isEditing
    ? editRecordId
    : (baseOverride ?? baseRecordId ?? item.defaultRecordId);

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
            key={`${isEditing ? "editar" : "novo"}-${base.id}`}
            item={item}
            base={base}
            isEditing={isEditing}
            filaments={filaments}
            extraItems={extraItems}
            costs={costs}
            onChangeBase={setBaseOverride}
            onCancel={() => handleOpenChange(false)}
            onSaved={(updated, photoError) => {
              onSaved(updated, photoError);
              handleOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
