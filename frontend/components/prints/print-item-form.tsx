"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, ChevronRight, Plus, Upload, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import { PendingPhoto, pickPhotos } from "@/components/prints/pending-photos";
import {
  EMPTY_USAGE,
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
  DurationDraft,
  DurationInput,
  EMPTY_DURATION,
  durationToMinutes,
  minutesToDuration,
  OptionalHint,
  SectionLabel,
  StatDivider,
  SuffixInput,
} from "@/components/prints/print-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { Category, listCategories } from "@/lib/api/category";
import {
  INFILL_PATTERNS,
  PrintExtraItem,
  PrintFilament,
  PrintItem,
  PrintRecord,
  SLICERS,
  DEFAULT_SLICER_SETTINGS,
  SlicerSettings,
  computeCostPerUnit,
  costRows,
  createPrintItem,
  describeExtraItemUsage,
  describePrintFilament,
  findCostPrinter,
  formatDecimal,
  formatDuration,
  formatGrams,
  getDefaultRecord,
  getMissingPrinterCosts,
  listPrintExtraItems,
  listPrintFilaments,
  listPrintItems,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

const NO_PARENT = "none";

// Select de categoria com busca: digita para filtrar a lista.
function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = categories.find((c) => c.id === value) ?? null;
  return (
    <Combobox.Root
      items={categories}
      value={selected}
      onValueChange={(c: Category | null) => onChange(c?.id ?? "")}
      itemToStringLabel={(c: Category) => c.name}
      isItemEqualToValue={(a: Category, b: Category) => a.id === b.id}
    >
      <div className="relative">
        {selected && (
          <span
            className="pointer-events-none absolute top-1/2 left-2.5 size-2.5 -translate-y-1/2 rounded-[3px]"
            style={{ background: selected.color }}
          />
        )}
        <Combobox.Input
          aria-label="Categoria"
          placeholder="Escolha a categoria"
          className={cn(
            "h-9 w-full min-w-0 rounded-md border border-input bg-card py-1 pr-8 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/50 md:text-sm",
            selected && "pl-7",
          )}
        />
        <Combobox.Trigger
          aria-label="Abrir categorias"
          className="absolute top-0 right-0 flex h-9 w-8 items-center justify-center text-muted-foreground"
        >
          <ChevronDown className="size-4" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50">
          <Combobox.Popup className="max-h-[min(18rem,var(--available-height))] w-(--anchor-width) min-w-36 overflow-y-auto rounded-lg bg-popover p-1 scrollbar-nocturne text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
              Nenhuma categoria encontrada.
            </Combobox.Empty>
            <Combobox.List>
              {(c: Category) => (
                <Combobox.Item
                  key={c.id}
                  value={c}
                  className="relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: c.color }}
                  />
                  {c.name}
                  <Combobox.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

type Draft = {
  name: string;
  categoryId: string;
  modelUrl: string;
  parentId: string;
  date: string;
  printerId: string;
  time: DurationDraft;
  units: string;
  usages: FilamentUsageDraft[];
  // Ímãs, argolas...: opcional, com a quantidade por peça.
  extraItems: ExtraItemUsageDraft[];
  // A configuração do fatiador é opcional: só vai se o usuário abrir.
  hasSettings: boolean;
  slicer: string;
  layerHeightMm: string;
  infillPercent: string;
  infillPattern: string;
  walls: string;
  extras: string;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  categoryId: "",
  modelUrl: "",
  parentId: NO_PARENT,
  date: today(),
  // Vazio = primeira impressora cadastrada.
  printerId: "",
  time: EMPTY_DURATION,
  units: "1",
  usages: [EMPTY_USAGE],
  extraItems: [],
  ...settingsDraft(null),
  note: "",
};

function settingsDraft(settings: SlicerSettings | null) {
  const s = settings ?? DEFAULT_SLICER_SETTINGS;
  return {
    hasSettings: settings != null,
    slicer: s.slicer,
    layerHeightMm: formatDecimal(s.layerHeightMm),
    infillPercent: String(s.infillPercent),
    infillPattern: s.infillPattern,
    walls: String(s.walls),
    extras: s.extras,
  };
}

// Derivado: começa com a categoria e a impressão do item de origem.
function draftFromParent(parent: PrintItem, record: PrintRecord): Draft {
  return {
    ...EMPTY_DRAFT,
    categoryId: parent.category?.id ?? "",
    parentId: parent.id,
    printerId: record.printer.id ?? "",
    time: minutesToDuration(record.totalMinutes),
    units: String(record.units),
    usages: record.filaments.map((u) => usageDraftFrom(u.filament, u.grams)),
    extraItems: record.extraItems.map((u) => extraItemDraftFrom(u)),
    ...settingsDraft(record.settings),
  };
}

// Duplicado: cópia do item, ligada à mesma origem dele (não a ele).
function draftFromCopy(source: PrintItem, record: PrintRecord): Draft {
  return {
    ...draftFromParent(source, record),
    name: `${source.name} (cópia)`,
    modelUrl: source.modelUrl ?? "",
    parentId: source.derivedFrom?.id ?? NO_PARENT,
    note: record.note ?? "",
  };
}

function Step({
  n,
  title,
  hint,
  action,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[11px] text-brand-300 tabular-nums">{n}</span>
        <h2 className="font-heading text-[17px] font-medium">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function PrintItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentParam = searchParams.get("derivadoDe");
  const recordParam = searchParams.get("registro");
  const copyParam = searchParams.get("duplicarDe");

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [filaments, setFilaments] = useState<PrintFilament[]>([]);
  const [extraItemOptions, setExtraItemOptions] = useState<PrintExtraItem[]>(
    [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const photosRef = useRef(photos);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { costs, loadError: costsError } = useCostContext();
  const printers = costs?.printers ?? [];

  useEffect(() => {
    listPrintFilaments()
      .then(setFilaments)
      .catch(() => setFilaments([]));
    listPrintExtraItems()
      .then(setExtraItemOptions)
      .catch(() => setExtraItemOptions([]));
    listCategories()
      .then((list) =>
        setCategories(
          [...list].sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
          ),
        ),
      )
      .catch(() => setCategories([]));
    listPrintItems().then((result) => {
      setItems(result);
      const source = result.find(
        (item) => item.id === (copyParam ?? parentParam),
      );
      if (!source) return;
      const record =
        source.records.find((r) => r.id === recordParam) ??
        getDefaultRecord(source);
      setDraft(
        copyParam
          ? draftFromCopy(source, record)
          : draftFromParent(source, record),
      );
      if (record.settings?.extras) setShowExtras(true);
    });
  }, [copyParam, parentParam, recordParam]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const units = Math.max(1, Math.round(parseDecimal(draft.units)) || 1);
  const minutes = durationToMinutes(draft.time) ?? 0;
  const usages = toUsages(draft.usages, filaments);
  const grams = usages.reduce((sum, u) => sum + u.grams, 0);
  const extraItems = toExtraItemUsages(draft.extraItems, extraItemOptions);
  const printerId = draft.printerId || printers[0]?.id || "";
  const printer = costs ? findCostPrinter(costs, printerId) : null;
  const perUnitCost = costs
    ? computeCostPerUnit(
        {
          filaments: usages,
          extraItems,
          totalMinutes: minutes,
          units,
          outcome: "SUCCESS",
          printer: { id: printerId },
        },
        costs,
      )
    : null;
  const missingPrinterCosts = costs ? getMissingPrinterCosts(printer) : [];
  const parent = items.find((item) => item.id === draft.parentId);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Libera os previews que sobraram ao sair da página.
  useEffect(
    () => () =>
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)),
    [],
  );

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const { accepted, error: photoError } = pickPhotos(files, photos.length);
    setError(photoError);
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function validate() {
    if (!draft.name.trim()) return "Dê um nome para a peça.";
    if (!categories.some((c) => c.id === draft.categoryId))
      return "Escolha a categoria.";
    if (!printer) return "Escolha a impressora.";
    if (!usages.length) return "Escolha ao menos um filamento.";
    if (usages.some((u) => u.grams <= 0))
      return "Informe as gramas de cada filamento.";
    if (minutes <= 0) return "Informe o tempo total.";
    if (draft.extraItems.some((row) => !row.extraItemId))
      return "Escolha o item extra ou remova a linha.";
    if (extraItems.some((u) => u.quantity < 1))
      return "Informe quantos de cada item extra vão por peça.";
    return null;
  }

  async function save() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    setIsSaving(true);
    try {
      const { item: created, photoError } = await createPrintItem(
        {
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          modelUrl: draft.modelUrl.trim() || null,
          derivedFromId: draft.parentId === NO_PARENT ? null : draft.parentId,
          firstRecord: {
            printedAt: toIso(draft.date),
            printer: { id: printer!.id, name: printer!.name },
            filaments: usages,
            extraItems,
            units,
            totalMinutes: minutes,
            settings: draft.hasSettings
              ? {
                  slicer: draft.slicer,
                  layerHeightMm: parseDecimal(draft.layerHeightMm),
                  infillPercent: Math.round(parseDecimal(draft.infillPercent)),
                  infillPattern: draft.infillPattern,
                  walls: Math.round(parseDecimal(draft.walls)),
                  temperatureC: null,
                  extras: draft.extras.trim(),
                }
              : null,
            outcome: "SUCCESS",
            failureReason: null,
            note: draft.note.trim() || null,
            changeSummary: "Primeira impressão",
          },
        },
        photos.map((photo) => photo.file),
      );
      router.push(
        `/dashboard/impressoes/${created.id}${photoError ? "?fotos=erro" : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setIsSaving(false);
    }
  }

  usePageHeaderBreadcrumb(
    <>
      <Link
        href="/dashboard/impressoes"
        className="text-muted-foreground hover:text-foreground"
      >
        Impressões
      </Link>
      <ChevronRight
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="font-medium">Nova impressão</span>
    </>,
  );

  usePageHeaderAction(
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard/impressoes")}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={isSaving}
        aria-busy={isSaving}
        onClick={save}
      >
        <Check />
        {isSaving ? "Salvando..." : "Salvar impressão"}
      </Button>
    </>,
  );

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
          <h1 className="text-4xl font-bold">Nova impressão</h1>
          <p className="text-sm text-muted-foreground">
            A peça e a primeira vez que ela foi impressa. Das próximas vezes,
            use &ldquo;Novo registro&rdquo; dentro do item.
          </p>
        </div>

        <Step n={1} title="A peça">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
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
              {photos.length ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {photos.map(({ preview: src }, index) => (
                    <div
                      key={src}
                      className={cn(
                        "group relative h-19",
                        index === 0 && "col-span-2 h-30",
                      )}
                    >
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
                        className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid h-19 place-items-center rounded-sm border border-dashed border-neutral-700 text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                    aria-label="Adicionar mais fotos"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    addPhotos(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex h-40 flex-col items-center justify-center gap-1.75 rounded-md border border-dashed bg-[repeating-linear-gradient(135deg,#20222f_0_8px,#252838_8px_16px)] text-muted-foreground transition-colors hover:border-brand hover:text-brand",
                    isDragging
                      ? "border-brand text-brand"
                      : "border-neutral-700",
                  )}
                >
                  <Upload className="size-5.5" aria-hidden="true" />
                  <span className="text-[11.5px]">Fotos da peça</span>
                </button>
              )}
              <span className="text-[11px] text-muted-foreground/80">
                A primeira vira a capa.
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-3.5">
              <Field label="Nome" htmlFor="print-name">
                <Input
                  id="print-name"
                  autoFocus
                  placeholder={
                    parent ? `Ex.: ${parent.name} XL` : "Ex.: Chaveiro de porco"
                  }
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field label="Categoria">
                  <CategoryCombobox
                    categories={categories}
                    value={draft.categoryId}
                    onChange={(id) => set("categoryId", id)}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Link do modelo <OptionalHint />
                    </>
                  }
                  htmlFor="print-url"
                >
                  <Input
                    id="print-url"
                    type="url"
                    placeholder="makerworld.com/models/..."
                    value={draft.modelUrl}
                    onChange={(e) => set("modelUrl", e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={
                  <>
                    Derivado de <OptionalHint />
                  </>
                }
              >
                <Select
                  value={draft.parentId}
                  onValueChange={(value) => set("parentId", value ?? NO_PARENT)}
                >
                  <SelectTrigger aria-label="Derivado de" className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        const p = items.find((item) => item.id === value);
                        return p ? (
                          p.name
                        ) : (
                          <span className="text-muted-foreground">
                            Escolha se esta peça é uma versão de outra (escala,
                            base diferente…)
                          </span>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>Nenhum</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </Step>

        <Separator />

        <Step n={2} title="Primeira impressão" hint="vira o registro padrão">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-[1fr_1fr_minmax(150px,1fr)_110px]">
            <Field label="Data" htmlFor="print-date">
              <Input
                id="print-date"
                type="date"
                max={today()}
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="Impressora">
              <Select
                value={printerId || null}
                onValueChange={(value) => value && set("printerId", value)}
              >
                <SelectTrigger aria-label="Impressora" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      printers.find((p) => p.id === value)?.name ?? (
                        <span className="text-muted-foreground">
                          {costs ? "Nenhuma cadastrada" : "Carregando..."}
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
            <Field label="Tempo total" htmlFor="print-time">
              <DurationInput
                id="print-time"
                label="Tempo total"
                value={draft.time}
                onChange={(next) => set("time", next)}
              />
            </Field>
            <Field label="Unidades" htmlFor="print-units">
              <Input
                id="print-units"
                inputMode="numeric"
                value={draft.units}
                onChange={(e) => set("units", e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <SectionLabel>Filamento</SectionLabel>
            <FilamentUsageFields
              value={draft.usages}
              onChange={(next) => set("usages", next)}
              filaments={filaments}
            />
          </div>
          <div className="flex flex-col gap-2">
            <SectionLabel>Itens extras</SectionLabel>
            <ExtraItemUsageFields
              value={draft.extraItems}
              onChange={(next) => set("extraItems", next)}
              items={extraItemOptions}
            />
          </div>
        </Step>

        <Separator />

        <Step
          n={3}
          title="Configuração do fatiador"
          hint="opcional"
          action={
            draft.hasSettings && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => set("hasSettings", false)}
              >
                <X />
                Remover
              </Button>
            )
          }
        >
          {draft.hasSettings ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Fatiador">
                  <Select
                    value={draft.slicer}
                    onValueChange={(value) => value && set("slicer", value)}
                  >
                    <SelectTrigger aria-label="Fatiador" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLICERS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Camada" htmlFor="print-layer">
                  <SuffixInput
                    id="print-layer"
                    suffix="mm"
                    value={draft.layerHeightMm}
                    onChange={(e) => set("layerHeightMm", e.target.value)}
                  />
                </Field>
                <Field label="Preenchimento" htmlFor="print-infill">
                  <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-1.5">
                    <SuffixInput
                      id="print-infill"
                      suffix="%"
                      className="pr-6"
                      value={draft.infillPercent}
                      onChange={(e) => set("infillPercent", e.target.value)}
                    />
                    <Select
                      value={draft.infillPattern}
                      onValueChange={(value) =>
                        value && set("infillPattern", value)
                      }
                    >
                      <SelectTrigger
                        aria-label="Padrão de preenchimento"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INFILL_PATTERNS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Field>
                <Field label="Paredes" htmlFor="print-walls">
                  <Input
                    id="print-walls"
                    inputMode="numeric"
                    value={draft.walls}
                    onChange={(e) => set("walls", e.target.value)}
                    className="tabular-nums"
                  />
                </Field>
              </div>
              {showExtras ? (
                <Field label="Outros ajustes" htmlFor="print-extras">
                  <Textarea
                    id="print-extras"
                    className="min-h-16"
                    placeholder="Ex.: suporte em árvore, brim 5 mm, velocidade 80%"
                    maxLength={500}
                    value={draft.extras}
                    onChange={(e) => set("extras", e.target.value)}
                  />
                </Field>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-brand-300"
                  onClick={() => setShowExtras(true)}
                >
                  <Plus />
                  Suporte, brim, velocidade, outros
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-brand-300"
              onClick={() => set("hasSettings", true)}
            >
              <Plus />
              Adicionar configuração do fatiador
            </Button>
          )}
        </Step>

        <Separator />

        <Step n={4} title="Resultado">
          <Field
            label={
              <>
                Observação <OptionalHint />
              </>
            }
            htmlFor="print-note"
          >
            <Input
              id="print-note"
              placeholder="Ex.: acabamento bom, orelhas saíram com fio"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </Field>
        </Step>

        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-4 rounded-lg bg-card px-4.5 py-4.5 shadow-[0_0_0_1px_var(--neutral-800)] lg:sticky lg:top-17">
        <SectionLabel>Por unidade</SectionLabel>
        <div className="flex items-stretch gap-4.5">
          <div className="flex flex-col gap-1.25">
            <SectionLabel>Gramas</SectionLabel>
            <span className="font-heading text-2xl leading-none font-medium tabular-nums">
              {grams ? formatGrams(grams / units) : "–"}
            </span>
          </div>
          <StatDivider />
          <div className="flex flex-col gap-1.25">
            <SectionLabel>Tempo</SectionLabel>
            <span className="font-heading text-2xl leading-none font-medium tabular-nums">
              {minutes ? formatDuration(minutes / units) : "–"}
            </span>
          </div>
        </div>
        <Separator />
        {costs && perUnitCost ? (
          <>
            <div className="flex flex-col gap-2 text-[12.5px] text-muted-foreground tabular-nums">
              {costRows(perUnitCost, costs).map(([label, value]) => (
                <div key={label} className="flex">
                  <span>{label}</span>
                  <span className="ml-auto">{formatBRL(value)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-baseline">
              <span className="text-[13px]">Custo / un.</span>
              <span className="ml-auto font-heading text-[26px] leading-none font-medium tabular-nums">
                {formatBRL(perUnitCost.total)}
              </span>
            </div>
            {missingPrinterCosts.length > 0 && (
              <p className="text-[11.5px] leading-relaxed text-brand-300">
                {printer ? (
                  <>
                    {printer.name} está sem {missingPrinterCosts.join(" e ")}{" "}
                    cadastrado: essa parte ficou de fora.{" "}
                    <Link
                      href={`/dashboard/printers/${printer.id}/edit`}
                      className="underline"
                    >
                      Completar impressora
                    </Link>
                  </>
                ) : (
                  <>
                    Sem impressora, energia e manutenção ficam de fora.{" "}
                    <Link href="/dashboard/printers/new" className="underline">
                      Cadastrar impressora
                    </Link>
                  </>
                )}
              </p>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              Taxas de{" "}
              <Link
                href="/dashboard/custos-energia"
                className="text-brand-300 hover:underline"
              >
                Custos e energia
              </Link>
              . Mão de obra e margem entram no preço, não no custo.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            {costsError ?? "Carregando custos..."}
          </p>
        )}
        {usages.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {usages.map(({ filament, grams: used }) => (
                <div
                  key={filament.id}
                  className="flex items-center gap-1.75 text-xs text-muted-foreground tabular-nums"
                >
                  <FilamentDot colors={filament.colors} />
                  {describePrintFilament(filament)}
                  <span className="ml-auto">{formatGrams(used)}</span>
                </div>
              ))}
              <span className="text-[11px] text-muted-foreground/80">
                Gasto na impressão. O nível do rolo continua marcado à mão em
                Filamentos.
              </span>
            </div>
          </>
        )}
        {extraItems.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {extraItems.map((usage) => (
                <div
                  key={usage.extraItem.id}
                  className="flex items-center text-xs text-muted-foreground tabular-nums"
                >
                  {describeExtraItemUsage(usage)} / peça
                  <span className="ml-auto">
                    {formatBRL(usage.quantity * usage.extraItem.unitCost)}
                  </span>
                </div>
              ))}
              <span className="text-[11px] text-muted-foreground/80">
                Custo do lote mais recente em Itens extras.
              </span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
