"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Layers,
  PlusCircle,
  RotateCcw,
  ScrollText,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FilamentUsageDraft,
  FilamentUsageFields,
  parseDecimal,
  toUsages,
  usageDraftFrom,
} from "@/components/prints/filament-usage-fields";
import { PendingPhoto, pickPhotos } from "@/components/prints/pending-photos";
import {
  DurationDraft,
  DurationInput,
  EMPTY_DURATION,
  FAILURE_COLOR,
  OptionalHint,
  OutcomeToggle,
  SectionLabel,
  SuffixInput,
  durationToMinutes,
} from "@/components/prints/print-bits";
import {
  ChoiceCard,
  ChoiceGroup,
  Field,
  Step,
} from "@/components/queue/queue-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import { Category, listCategories } from "@/lib/api/category";
import {
  FAILURE_REASONS,
  PrintFilament,
  PrintItem,
  PrintOutcome,
  PrintRecordInput,
  computeCost,
  describeChanges,
  describePrintFilament,
  formatDuration,
  formatGrams,
  getDefaultRecord,
  listPrintFilaments,
  listPrintItems,
} from "@/lib/api/print";
import {
  QueueEntry,
  QueueTarget,
  finishQueueEntry,
  getEntryGrams,
  getQueueEntry,
} from "@/lib/api/print-queue";
import { cn, formatBRL } from "@/lib/utils";

type Target = "item" | "new";

const OTHER_REASON = "__other";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

export function QueueCompleteForm({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filaments, setFilaments] = useState<PrintFilament[]>([]);
  const { costs } = useCostContext();
  const printers = costs?.printers ?? [];

  // Onde registrar.
  const [target, setTarget] = useState<Target>("item");
  const [itemId, setItemId] = useState("");
  const [newName, setNewName] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // O que veio da fila; só muda se o usuário pedir para editar.
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [printerId, setPrinterId] = useState("");
  const [unitsText, setUnitsText] = useState("1");
  const [usageDrafts, setUsageDrafts] = useState<FilamentUsageDraft[]>([]);

  // O que a fila não sabia.
  const [date, setDate] = useState(today);
  const [realGrams, setRealGrams] = useState("");
  const [realTime, setRealTime] = useState<DurationDraft>(EMPTY_DURATION);
  const [outcome, setOutcome] = useState<PrintOutcome>("SUCCESS");
  const [reason, setReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [note, setNote] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const photosRef = useRef(photos);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([getQueueEntry(entryId), listPrintItems()])
      .then(([found, allItems]) => {
        if (ignore) return;
        const sorted = [...allItems].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR"),
        );
        setItems(sorted);
        setEntry(found);
        const linked = sorted.find((i) => i.id === found.printItem?.id);
        setTarget(linked ? "item" : "new");
        setItemId(linked?.id ?? "");
        setNewName(found.name);
        setPrinterId(found.printer.id ?? "");
        setUnitsText(String(found.units));
        setUsageDrafts(
          found.filaments.map((u) => usageDraftFrom(u.filament, u.grams)),
        );
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o item da fila.",
        );
      });
    listCategories()
      .then((result) => {
        if (!ignore) setCategories(result);
      })
      .catch(() => {});
    listPrintFilaments()
      .then((result) => {
        if (!ignore) setFilaments(result);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [entryId]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () =>
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)),
    [],
  );

  const isFailure = outcome === "FAILURE";
  const targetItem = items.find((i) => i.id === itemId);
  const baseRecord = targetItem ? getDefaultRecord(targetItem) : undefined;
  const units = Math.max(1, Math.round(parseDecimal(unitsText)) || 1);
  const printer = printers.find((p) => p.id === printerId);

  // Sem editar, vale o que veio da fila; editando, os filamentos escolhidos
  // (filamento fora de estoque some da lista e precisa ser trocado).
  const plannedUsages = isEditingPlan
    ? toUsages(usageDrafts, filaments)
    : (entry?.filaments ?? []);
  const plannedGrams = getEntryGrams({ filaments: plannedUsages });
  const plannedMinutes = entry?.totalMinutes ?? 0;

  // As gramas reais se dividem entre os filamentos na proporção do previsto.
  const typedGrams = parseDecimal(realGrams);
  const spentGrams = realGrams.trim() ? typedGrams : plannedGrams;
  const recordUsages = plannedUsages.map((u) => ({
    ...u,
    grams:
      plannedGrams > 0
        ? (u.grams / plannedGrams) * spentGrams
        : spentGrams / Math.max(1, plannedUsages.length),
  }));
  const recordMinutes = durationToMinutes(realTime) ?? plannedMinutes;

  const cost = costs
    ? computeCost(
        {
          filaments: recordUsages,
          totalMinutes: recordMinutes,
          units,
          outcome,
          printer: { id: printerId },
        },
        costs,
      )
    : null;

  const failureReason =
    reason === OTHER_REASON ? otherReason.trim() : (reason ?? "");

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const { accepted, error: photoError } = pickPhotos(files, photos.length);
    setError(photoError);
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function validate() {
    if (!date) return "Informe a data.";
    if (target === "item" && !targetItem) return "Escolha a impressão.";
    if (target === "new" && !isFailure) {
      if (!newName.trim()) return "Dê um nome para a peça.";
      if (!categories.some((c) => c.id === categoryId))
        return "Escolha a categoria.";
    }
    if (!printer) return "Escolha a impressora.";
    if (!recordUsages.length) return "Escolha ao menos um filamento.";
    if (isFailure) {
      if (!failureReason) return "Conte o que aconteceu.";
      if (durationToMinutes(realTime) == null)
        return "Informe o tempo até parar.";
      return null;
    }
    if (recordUsages.some((u) => u.grams <= 0))
      return "Informe as gramas reais.";
    if (recordMinutes <= 0) return "Informe o tempo real.";
    return null;
  }

  async function save() {
    if (!entry) return;
    const problem = validate();
    setError(problem);
    if (problem) return;

    const recordPrinter = { id: printer!.id, name: printer!.name };
    const settings = target === "item" ? (baseRecord?.settings ?? null) : null;
    const input: PrintRecordInput = {
      printedAt: toIso(date),
      printer: recordPrinter,
      filaments: recordUsages,
      units,
      totalMinutes: recordMinutes,
      settings,
      outcome,
      failureReason: isFailure ? failureReason : null,
      note: note.trim() || null,
      changeSummary: isFailure
        ? null
        : baseRecord && target === "item"
          ? describeChanges(baseRecord, {
              printer: recordPrinter,
              filaments: recordUsages,
              units,
              settings,
            })
          : "Primeira impressão",
    };
    const files = photos.map((photo) => photo.file);

    // Peça nova que falhou: ainda não há impressão onde registrar a falha,
    // então só a fila fica sabendo.
    const queueTarget: QueueTarget =
      target === "item" && targetItem
        ? { printItemId: targetItem.id }
        : isFailure
          ? null
          : { newItem: { name: newName.trim(), categoryId } };

    setIsSaving(true);
    try {
      const { item: saved, photoError } = await finishQueueEntry(
        entry.id,
        queueTarget,
        input,
        { makeDefault: makeDefault && !isFailure },
        files,
      );
      router.push(
        saved && photoError
          ? `/dashboard/impressoes/${saved.id}?fotos=erro`
          : "/dashboard/fila",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setIsSaving(false);
    }
  }

  usePageHeaderBreadcrumb(
    <>
      <Link
        href="/dashboard/fila"
        className="text-muted-foreground hover:text-foreground"
      >
        Fila de impressão
      </Link>
      <ChevronRight
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="truncate font-medium">
        Concluir{entry ? ` · ${entry.name} × ${entry.units}` : ""}
      </span>
    </>,
  );

  usePageHeaderAction(
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard/fila")}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={isSaving || !entry}
        aria-busy={isSaving}
        onClick={save}
      >
        <Check />
        {isSaving ? "Salvando..." : "Salvar registro"}
      </Button>
    </>,
  );

  if (loadError) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
        <Link
          href="/dashboard/fila"
          className="text-sm text-brand-300 hover:underline"
        >
          Voltar para a fila
        </Link>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="grid grid-cols-1 items-start gap-9 p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const targetName = target === "item" ? targetItem?.name : newName.trim();

  return (
    <div className="grid grid-cols-1 items-start gap-9 p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        className="flex min-w-0 flex-col gap-7.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <h1 className="text-4xl font-bold">Concluir impressão</h1>
          <p className="text-sm text-muted-foreground">
            {entry.name} × {entry.units}
            {entry.customer ? ` · ${entry.customer}` : ""}
          </p>
        </div>

        <Step n={1} title="Onde registrar">
          <ChoiceGroup label="Onde registrar">
            <ChoiceCard
              selected={target === "item"}
              onSelect={() => setTarget("item")}
              icon={Layers}
              title="Em uma impressão existente"
              description="Vira um novo registro dentro do item."
            >
              <div className="flex flex-col gap-1.5">
                <Select
                  value={itemId || null}
                  onValueChange={(value) => value && setItemId(value)}
                >
                  <SelectTrigger aria-label="Impressão" className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        const found = items.find((i) => i.id === value);
                        if (!found)
                          return (
                            <span className="text-muted-foreground">
                              Escolha a impressão
                            </span>
                          );
                        return (
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{found.name}</span>
                            {found.id === entry.printItem?.id && (
                              <span className="rounded-sm bg-brand/14 px-1.5 text-[10px] leading-4 text-brand">
                                sugerida
                              </span>
                            )}
                          </span>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {entry.printItem && itemId === entry.printItem.id && (
                  <span className="text-[11.5px] text-muted-foreground/80">
                    Sugerida porque este item da fila foi ligado a ela.
                  </span>
                )}
              </div>
            </ChoiceCard>
            <ChoiceCard
              selected={target === "new"}
              onSelect={() => setTarget("new")}
              icon={PlusCircle}
              title="Como uma nova impressão"
              description="Peça que ainda não está em Impressões, ou uma versão diferente."
            >
              <div className="flex flex-col gap-2">
                <Input
                  aria-label="Nome da peça"
                  placeholder="Nome da peça"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Select
                  value={categoryId || null}
                  onValueChange={(value) => value && setCategoryId(value)}
                >
                  <SelectTrigger aria-label="Categoria" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        categories.find((c) => c.id === value)?.name ?? (
                          <span className="text-muted-foreground">
                            Categoria
                          </span>
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </ChoiceCard>
          </ChoiceGroup>
        </Step>

        <Separator />

        <Step n={2} title="Veio da fila">
          {isEditingPlan ? (
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-[minmax(0,1fr)_110px]">
                <Field label="Impressora">
                  <Select
                    value={printerId || null}
                    onValueChange={(value) => value && setPrinterId(value)}
                  >
                    <SelectTrigger aria-label="Impressora" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          printers.find((p) => p.id === value)?.name ?? (
                            <span className="text-muted-foreground">
                              Escolha a impressora
                            </span>
                          )
                        }
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
                </Field>
                <Field label="Unidades" htmlFor="complete-units">
                  <Input
                    id="complete-units"
                    inputMode="numeric"
                    value={unitsText}
                    onChange={(e) =>
                      setUnitsText(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    className="tabular-nums"
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <SectionLabel>Filamento (previsto)</SectionLabel>
                <FilamentUsageFields
                  value={usageDrafts}
                  onChange={setUsageDrafts}
                  filaments={filaments}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3.5 rounded-md bg-foreground/4 px-3.75 py-3.25 sm:grid-cols-4">
                <div className="flex min-w-0 flex-col gap-0.75">
                  <SectionLabel>Impressora</SectionLabel>
                  <span className="truncate text-[13px] text-foreground/80">
                    {printer?.name ?? entry.printer.name}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.75">
                  <SectionLabel>Filamento</SectionLabel>
                  <span className="flex min-w-0 items-center gap-1.25 text-[13px] text-foreground/80">
                    {entry.filaments[0] && (
                      <FilamentDot
                        colors={entry.filaments[0].filament.colors}
                      />
                    )}
                    <span className="truncate">
                      {entry.filaments
                        .map((u) => describePrintFilament(u.filament))
                        .join(" + ") || "—"}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col gap-0.75">
                  <SectionLabel>Unidades</SectionLabel>
                  <span className="text-[13px] text-foreground/80 tabular-nums">
                    {entry.units}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.75">
                  <SectionLabel>Cliente</SectionLabel>
                  <span className="truncate text-[13px] text-foreground/80">
                    {entry.customer ?? "—"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPlan(true)}
                className="self-start text-[11.5px] text-brand-300 hover:underline"
              >
                Editar estes dados
              </button>
            </>
          )}
        </Step>

        <Separator />

        <Step
          n={3}
          title="Falta preencher"
          hint={
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-brand" />o que a fila
              não sabia
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Data" htmlFor="complete-date">
              <Input
                id="complete-date"
                type="date"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field
              label={isFailure ? "Gramas gastas até parar" : "Gramas reais"}
              htmlFor="complete-grams"
            >
              <SuffixInput
                id="complete-grams"
                suffix="g"
                placeholder={
                  plannedGrams ? `${formatGrams(plannedGrams)} estimado` : "0"
                }
                value={realGrams}
                onChange={(e) => setRealGrams(e.target.value)}
                className="shadow-[inset_0_0_0_1px_var(--brand-700)]"
              />
            </Field>
            <Field
              label={isFailure ? "Tempo até parar" : "Tempo real"}
              htmlFor="complete-time"
            >
              <DurationInput
                id="complete-time"
                label={isFailure ? "Tempo até parar" : "Tempo real"}
                value={realTime}
                onChange={setRealTime}
                className="[&_input]:shadow-[inset_0_0_0_1px_var(--brand-700)]"
              />
            </Field>
          </div>
          {!isFailure && (
            <p className="-mt-1.5 text-[11.5px] text-muted-foreground/80">
              Em branco, vale o estimado ({formatGrams(plannedGrams)} e{" "}
              {formatDuration(plannedMinutes)}).
            </p>
          )}

          <div className="flex flex-col gap-2">
            <SectionLabel>Resultado</SectionLabel>
            <OutcomeToggle value={outcome} onChange={setOutcome} />
            <span className="text-[11.5px] text-muted-foreground/80">
              Se falhar, o item volta para a fila marcado em vermelho.
            </span>
          </div>

          {isFailure && (
            <div className="flex flex-col gap-2">
              <Label>O que aconteceu</Label>
              <div className="flex flex-wrap gap-1.75">
                {[...FAILURE_REASONS, OTHER_REASON].map((option) => {
                  const selected = reason === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setReason(selected ? null : option)}
                      className={cn(
                        "inline-flex items-center rounded-md border px-2.75 py-1.5 text-[13px] whitespace-nowrap transition-colors",
                        selected
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border hover:border-brand hover:bg-brand/8 hover:text-brand",
                      )}
                    >
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
          )}

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
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
              className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-md bg-[repeating-linear-gradient(135deg,#20222f_0_8px,#252838_8px_16px)] text-foreground/40 shadow-[inset_0_0_0_1px_var(--neutral-700)] transition-colors hover:text-brand"
            >
              <Camera className="size-4.5" aria-hidden="true" />
              <span className="text-[11px]">
                {photos.length ? `${photos.length} fotos` : "Fotos"}
              </span>
            </button>
            <Field
              label={
                <>
                  Observação <OptionalHint />
                </>
              }
              htmlFor="complete-note"
            >
              <Input
                id="complete-note"
                placeholder="Algo diferente do padrão?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
          {photos.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
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
                      setPhotos((prev) =>
                        prev.filter((p) => p.preview !== src),
                      );
                    }}
                    className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!isFailure && target === "item" && (
            <label className="flex items-center gap-2.25 text-[12.5px]">
              <Checkbox
                checked={makeDefault}
                onCheckedChange={(checked) => setMakeDefault(checked)}
              />
              Marcar como novo registro padrão
            </label>
          )}
          {target === "item" && baseRecord && (
            <span className="text-[11.5px] text-muted-foreground/80">
              Configuração do fatiador: igual ao registro padrão.
            </span>
          )}
        </Step>

        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-4 rounded-lg bg-card px-4.5 py-4.5 shadow-[0_0_0_1px_var(--neutral-800)] lg:sticky lg:top-5">
        <SectionLabel>Ao salvar</SectionLabel>
        <div className="flex flex-col gap-2.5 text-[12.5px] text-foreground/70">
          {isFailure ? (
            <>
              {target === "item" && targetItem ? (
                <div className="flex gap-2.25">
                  <Layers
                    className="mt-0.5 size-3.75 shrink-0"
                    style={{ color: FAILURE_COLOR }}
                    aria-hidden="true"
                  />
                  <span>
                    Registro de falha em{" "}
                    <span className="text-foreground">{targetItem.name}</span>
                  </span>
                </div>
              ) : (
                <div className="flex gap-2.25">
                  <Layers
                    className="mt-0.5 size-3.75 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>
                    A peça ainda não está em Impressões: a falha fica só na
                    fila.
                  </span>
                </div>
              )}
              <div className="flex gap-2.25">
                <RotateCcw
                  className="mt-0.5 size-3.75 shrink-0"
                  style={{ color: FAILURE_COLOR }}
                  aria-hidden="true"
                />
                <span>O item volta para a fila, no mesmo lugar</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2.25">
                <Layers
                  className="mt-0.5 size-3.75 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>
                  {target === "item" ? "Novo registro em " : "Nova impressão "}
                  <span className="text-foreground">{targetName || "—"}</span>
                </span>
              </div>
              <div className="flex gap-2.25">
                <CheckCircle2
                  className="mt-0.5 size-3.75 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <span>O item sai da fila e vai para Concluídos</span>
              </div>
            </>
          )}
        </div>
        {recordUsages.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {recordUsages.map(({ filament, grams }) => (
                <div
                  key={filament.id}
                  className="flex items-center gap-1.75 text-xs text-muted-foreground tabular-nums"
                >
                  <FilamentDot colors={filament.colors} />
                  {describePrintFilament(filament)}
                  <span className="ml-auto">{formatGrams(grams)}</span>
                </div>
              ))}
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                <ScrollText className="size-3" aria-hidden="true" />
                {realGrams.trim()
                  ? "Gramas reais."
                  : "Estimado. Atualiza com as gramas reais."}
              </span>
            </div>
          </>
        )}
        <Separator />
        {cost ? (
          <div className="flex flex-col gap-2 text-[12.5px] text-muted-foreground tabular-nums">
            <div className="flex">
              <span>{isFailure ? "Custo perdido" : "Custo"}</span>
              <span
                className={cn("ml-auto", !isFailure && "text-foreground")}
                style={isFailure ? { color: FAILURE_COLOR } : undefined}
              >
                {formatBRL(cost.total)}
              </span>
            </div>
            {!isFailure && (
              <div className="flex">
                <span>Por unidade</span>
                <span className="ml-auto">{formatBRL(cost.total / units)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Carregando custos...
          </p>
        )}
      </aside>
    </div>
  );
}
