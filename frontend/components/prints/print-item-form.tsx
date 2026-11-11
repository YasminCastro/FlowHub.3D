"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Combobox } from "@base-ui/react/combobox";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
} from "@/components/prints/print-bits";
import {
  SlicerSettingsDraft,
  SlicerSettingsFields,
  slicerDraftFrom,
  slicerDraftProblem,
  toSlicerSettings,
} from "@/components/prints/slicer-settings-fields";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { useLastPrinter } from "@/hooks/use-last-printer";
import { Category, listCategories } from "@/lib/api/category";
import {
  PrintExtraItem,
  PrintFilament,
  PrintItem,
  PrintRecord,
  computeCostPerUnit,
  costRows,
  createPrintItem,
  describeExtraItemUsage,
  describePrintFilament,
  findCostPrinter,
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
export function CategoryCombobox({
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

// Peça de origem com busca: digita o nome para filtrar; o X volta a "nenhuma".
function ParentCombobox({
  items,
  value,
  onChange,
}: {
  items: PrintItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = items.find((item) => item.id === value) ?? null;
  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(item: PrintItem | null) =>
        onChange(item?.id ?? NO_PARENT)
      }
      itemToStringLabel={(item: PrintItem) => item.name}
      isItemEqualToValue={(a: PrintItem, b: PrintItem) => a.id === b.id}
      autoHighlight
    >
      <div className="relative">
        <Combobox.Input
          aria-label="Derivado de"
          placeholder="Digite o nome da peça de origem (escala, base diferente…)"
          className="h-9 w-full min-w-0 rounded-md border border-input bg-card py-1 pr-14 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/50 md:text-sm"
        />
        {selected && (
          <Combobox.Clear
            aria-label="Remover peça de origem"
            className="absolute top-0 right-7 flex h-9 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </Combobox.Clear>
        )}
        <Combobox.Trigger
          aria-label="Abrir peças"
          className="absolute top-0 right-0 flex h-9 w-8 items-center justify-center text-muted-foreground"
        >
          <ChevronDown className="size-4" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50">
          <Combobox.Popup className="max-h-[min(18rem,var(--available-height))] w-(--anchor-width) min-w-36 overflow-y-auto rounded-lg bg-popover p-1 scrollbar-nocturne text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
              Nenhuma peça com esse nome.
            </Combobox.Empty>
            <Combobox.List>
              {(item: PrintItem) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className="relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="truncate">{item.name}</span>
                  {item.category && (
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {item.category.name}
                    </span>
                  )}
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
  // Configuração do fatiador: só os ajustes que o usuário marcou.
  settings: SlicerSettingsDraft;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  categoryId: "",
  modelUrl: "",
  parentId: NO_PARENT,
  date: today(),
  // Vazio = a última impressora usada (ou a primeira cadastrada).
  printerId: "",
  time: EMPTY_DURATION,
  units: "1",
  usages: [EMPTY_USAGE],
  extraItems: [],
  settings: {},
  note: "",
};

// Derivado: começa com a categoria e a impressão do item de origem; a
// impressora fica a última usada.
function draftFromParent(parent: PrintItem, record: PrintRecord): Draft {
  return {
    ...EMPTY_DRAFT,
    categoryId: parent.category?.id ?? "",
    parentId: parent.id,
    time: minutesToDuration(record.totalMinutes),
    units: String(record.units),
    usages: record.filaments.map((u) => usageDraftFrom(u.filament, u.grams)),
    extraItems: record.extraItems.map((u) => extraItemDraftFrom(u)),
    settings: slicerDraftFrom(record.settings),
  };
}

// Duplicado: cópia do item, ligada à mesma origem dele (não a ele).
function draftFromCopy(source: PrintItem, record: PrintRecord): Draft {
  return {
    ...draftFromParent(source, record),
    name: `${source.name} (cópia)`,
    printerId: record.printer.id ?? "",
    modelUrl: source.modelUrl ?? "",
    parentId: source.derivedFrom?.id ?? NO_PARENT,
    note: record.note ?? "",
  };
}

// Rascunho do formulário: se a aba fechar ou o usuário sair antes de salvar,
// o que já foi preenchido volta quando ele abrir o formulário de novo. Cada
// ponto de partida (em branco, derivado de X, cópia de Y) tem o seu. As fotos
// não entram: arquivos não cabem no localStorage.
const DRAFT_KEY = "impressao:rascunho";

function draftKey(
  copyParam: string | null,
  parentParam: string | null,
  recordParam: string | null,
) {
  const source = copyParam
    ? `:copia:${copyParam}`
    : parentParam
      ? `:derivado:${parentParam}`
      : "";
  return `${DRAFT_KEY}${source}${source && recordParam ? `:${recordParam}` : ""}`;
}

function loadStoredDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Draft>;
    // Rascunho do formato antigo (campos soltos): a configuração recomeça.
    const settings =
      stored.settings && typeof stored.settings === "object"
        ? stored.settings
        : {};
    return { ...EMPTY_DRAFT, ...stored, settings };
  } catch {
    return null;
  }
}

function storeDraft(key: string, draft: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Sem localStorage (aba anônima bloqueada): segue sem rascunho.
  }
}

function clearStoredDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Idem.
  }
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

const subscribeNothing = () => () => {};

// O rascunho mora no localStorage, que só existe no navegador: o formulário
// monta depois da hidratação, já com ele no estado inicial.
export function PrintItemForm() {
  const searchParams = useSearchParams();
  const parentParam = searchParams.get("derivadoDe");
  const recordParam = searchParams.get("registro");
  const copyParam = searchParams.get("duplicarDe");
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!isClient) return null;
  const storageKey = draftKey(copyParam, parentParam, recordParam);
  return (
    <PrintItemFormContent
      key={storageKey}
      storageKey={storageKey}
      parentParam={parentParam}
      recordParam={recordParam}
      copyParam={copyParam}
    />
  );
}

function PrintItemFormContent({
  storageKey,
  parentParam,
  recordParam,
  copyParam,
}: {
  storageKey: string;
  parentParam: string | null;
  recordParam: string | null;
  copyParam: string | null;
}) {
  const router = useRouter();
  const [storedDraft] = useState(() => loadStoredDraft(storageKey));

  const [draft, setDraft] = useState<Draft>(storedDraft ?? EMPTY_DRAFT);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [filaments, setFilaments] = useState<PrintFilament[]>([]);
  const [extraItemOptions, setExtraItemOptions] = useState<PrintExtraItem[]>(
    [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const photosRef = useRef(photos);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { costs, loadError: costsError } = useCostContext();
  const printers = costs?.printers ?? [];
  const lastPrinter = useLastPrinter();

  // Só grava depois que o usuário mexe em algo: abrir e sair não cria rascunho.
  const isDirtyRef = useRef(storedDraft != null);
  const [restored, setRestored] = useState(storedDraft != null);
  // O ponto de partida sem rascunho, para "Descartar".
  const baseDraftRef = useRef<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (isDirtyRef.current) storeDraft(storageKey, draft);
  }, [draft, storageKey]);

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
      baseDraftRef.current = copyParam
        ? draftFromCopy(source, record)
        : draftFromParent(source, record);
      // Rascunho salvo vale mais que o ponto de partida.
      if (isDirtyRef.current) return;
      setDraft(baseDraftRef.current);
    });
  }, [copyParam, parentParam, recordParam]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    isDirtyRef.current = true;
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function discardDraft() {
    clearStoredDraft(storageKey);
    isDirtyRef.current = false;
    setRestored(false);
    setDraft(baseDraftRef.current);
  }

  const units = Math.max(1, Math.round(parseDecimal(draft.units)) || 1);
  const minutes = durationToMinutes(draft.time) ?? 0;
  const usages = toUsages(draft.usages, filaments);
  const grams = usages.reduce((sum, u) => sum + u.grams, 0);
  const extraItems = toExtraItemUsages(draft.extraItems, extraItemOptions);
  const printerId = draft.printerId || lastPrinter.pick(printers);
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
    return slicerDraftProblem(draft.settings);
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
            settings: toSlicerSettings(draft.settings),
            outcome: "SUCCESS",
            failureReason: null,
            note: draft.note.trim() || null,
            changeSummary: "Primeira impressão",
          },
        },
        photos.map((photo) => photo.file),
      );
      lastPrinter.rememberPrinter(printer!.id);
      isDirtyRef.current = false;
      clearStoredDraft(storageKey);
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
        onClick={() => {
          // Cancelar é desistir de propósito: o rascunho vai junto.
          isDirtyRef.current = false;
          clearStoredDraft(storageKey);
          router.push("/dashboard/impressoes");
        }}
      >
        Cancelar
      </Button>
      {restored && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={discardDraft}
        >
          Descartar rascunho
        </Button>
      )}
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
          {restored && (
            <div className="mt-3 rounded-md border border-brand/40 bg-brand/10 px-3 py-2 text-[12.5px]">
              Continuando de onde você parou. As fotos precisam ser adicionadas
              de novo.
            </div>
          )}
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
                <ParentCombobox
                  items={items}
                  value={draft.parentId}
                  onChange={(id) => set("parentId", id)}
                />
              </Field>
            </div>
          </div>
        </Step>

        <Separator />

        <Step n={2} title="Primeira impressão">
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

        <Step n={3} title="Configuração do fatiador" hint="opcional">
          <SlicerSettingsFields
            idPrefix="print"
            value={draft.settings}
            onChange={(next) => set("settings", next)}
          />
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
