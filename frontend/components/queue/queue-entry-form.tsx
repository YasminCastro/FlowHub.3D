"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Layers, PlusCircle } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PrintPicker } from "@/components/catalog/print-picker";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import {
  EMPTY_USAGE,
  FilamentUsageDraft,
  FilamentUsageFields,
  parseDecimal,
  toUsages,
  usageDraftFrom,
} from "@/components/prints/filament-usage-fields";
import {
  DurationDraft,
  DurationInput,
  EMPTY_DURATION,
  OptionalHint,
  SectionLabel,
  StatDivider,
  durationToMinutes,
  minutesToDuration,
} from "@/components/prints/print-bits";
import {
  ChoiceCard,
  ChoiceGroup,
  Field,
  PositionToggle,
  Step,
} from "@/components/queue/queue-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import {
  PrintFilament,
  PrintItem,
  costRows,
  formatDecimal,
  formatDecimalInput,
  formatDuration,
  formatGrams,
  getDefaultRecord,
  listPrintFilaments,
  listPrintItems,
} from "@/lib/api/print";
import {
  QueueEntry,
  QueuePosition,
  addToQueue,
  getQueueEntry,
  quoteEntry,
  updateQueueEntry,
} from "@/lib/api/print-queue";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

type Source = "item" | "new";

type Draft = {
  source: Source;
  itemId: string;
  name: string;
  usages: FilamentUsageDraft[];
  units: string;
  time: DurationDraft;
  printerId: string;
  customer: string;
  modelUrl: string;
  note: string;
  position: QueuePosition;
};

const EMPTY_DRAFT: Draft = {
  source: "item",
  itemId: "",
  name: "",
  usages: [EMPTY_USAGE],
  units: "1",
  time: EMPTY_DURATION,
  printerId: "",
  customer: "",
  modelUrl: "",
  note: "",
  position: "last",
};

const POSITION_OPTIONS: { value: QueuePosition; label: string }[] = [
  { value: "first", label: "Primeiro" },
  { value: "last", label: "No fim" },
];

function parseUnits(text: string) {
  return Math.max(1, Math.round(parseDecimal(text)) || 1);
}

// Filamento, tempo e impressora do registro padrão, para tantas unidades.
function draftFromItem(item: PrintItem, units: number, prev: Draft): Draft {
  const record = getDefaultRecord(item);
  if (!record) return { ...prev, itemId: item.id };
  const scale = units / Math.max(1, record.units);
  return {
    ...prev,
    itemId: item.id,
    usages: record.filaments.length
      ? record.filaments.map((u) => usageDraftFrom(u.filament, u.grams * scale))
      : [EMPTY_USAGE],
    time: minutesToDuration(record.totalMinutes * scale),
    printerId: record.printer.id ?? prev.printerId,
    modelUrl: item.modelUrl ?? "",
  };
}

// Na edição, o rascunho começa com o que foi salvo na fila.
function draftFromEntry(entry: QueueEntry): Draft {
  return {
    ...EMPTY_DRAFT,
    source: entry.printItem ? "item" : "new",
    itemId: entry.printItem?.id ?? "",
    name: entry.name,
    usages: entry.filaments.length
      ? entry.filaments.map((u) => usageDraftFrom(u.filament, u.grams))
      : [EMPTY_USAGE],
    units: String(entry.units),
    time: minutesToDuration(entry.totalMinutes),
    printerId: entry.printer.id ?? "",
    customer: entry.customer ?? "",
    modelUrl: entry.modelUrl ?? "",
    note: entry.note ?? "",
  };
}

// Mudar a quantidade recalcula gramas e tempo na mesma proporção.
function rescale(draft: Draft, nextUnitsText: string): Draft {
  const from = parseUnits(draft.units);
  const to = parseUnits(nextUnitsText);
  if (from === to) return { ...draft, units: nextUnitsText };
  const scale = to / from;
  const minutes = durationToMinutes(draft.time);
  return {
    ...draft,
    units: nextUnitsText,
    usages: draft.usages.map((u) =>
      u.grams
        ? { ...u, grams: formatDecimalInput(parseDecimal(u.grams) * scale, 1) }
        : u,
    ),
    time: minutes == null ? draft.time : minutesToDuration(minutes * scale),
  };
}

/**
 * Sem `entryId`, adiciona à fila; com ele, edita o item pendente. Com
 * ?duplicar=, adiciona um item novo começando com os dados de outro.
 */
export function QueueEntryForm({ entryId }: { entryId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemParam = searchParams.get("impressao");
  const isEditing = entryId != null;
  const duplicateParam = isEditing ? null : searchParams.get("duplicar");
  // O item de onde o rascunho começa: o editado ou o duplicado.
  const sourceId = entryId ?? duplicateParam;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [filaments, setFilaments] = useState<PrintFilament[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { costs, loadError: costsError } = useCostContext();
  const printers = costs?.printers ?? [];

  useEffect(() => {
    if (!sourceId) return;
    let ignore = false;
    getQueueEntry(sourceId)
      .then((found) => {
        if (ignore) return;
        // Duplicar um concluído vale: é imprimir de novo.
        if (isEditing && found.completedAt) {
          setLoadError("Este item já foi concluído e não pode ser editado.");
          return;
        }
        setEntry(found);
        setDraft(draftFromEntry(found));
      })
      .catch((err) => {
        if (ignore) return;
        setIsNotFound(isNotFoundError(err));
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o item da fila.",
        );
      });
    return () => {
      ignore = true;
    };
  }, [sourceId, isEditing]);

  useEffect(() => {
    listPrintFilaments()
      .then(setFilaments)
      .catch(() => setFilaments([]));
    listPrintItems()
      .then((result) => {
        const sorted = [...result].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR"),
        );
        setItems(sorted);
        // Editando ou duplicando, o rascunho vem do item salvo.
        if (sourceId) return;
        const preset = sorted.find((item) => item.id === itemParam);
        if (preset) {
          setDraft((prev) =>
            draftFromItem(preset, parseUnits(prev.units), prev),
          );
        } else if (!sorted.length) {
          setDraft((prev) => ({ ...prev, source: "new" }));
        }
      })
      .catch(() => setItems([]));
  }, [itemParam, sourceId]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function chooseItem(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setDraft((prev) => draftFromItem(item, parseUnits(prev.units), prev));
  }

  const item = items.find((i) => i.id === draft.itemId);
  const baseRecord = item ? getDefaultRecord(item) : undefined;
  const units = parseUnits(draft.units);
  const minutes = durationToMinutes(draft.time) ?? 0;
  const usages = toUsages(draft.usages, filaments);
  const grams = usages.reduce((sum, u) => sum + u.grams, 0);
  const printerId = draft.printerId || printers[0]?.id || "";
  const printer = printers.find((p) => p.id === printerId);
  const name = draft.source === "item" ? (item?.name ?? "") : draft.name.trim();

  const quoteInput = {
    filaments: usages,
    totalMinutes: minutes,
    units,
    printer: { id: printerId, name: printer?.name ?? "" },
  };
  const quote = costs ? quoteEntry(quoteInput, costs) : null;

  function validate() {
    if (draft.source === "item" && !item) return "Escolha a impressão.";
    if (draft.source === "new" && !name) return "Dê um nome para a peça.";
    if (!printer) return "Escolha a impressora.";
    if (!usages.length) return "Escolha ao menos um filamento.";
    if (usages.some((u) => u.grams <= 0))
      return "Informe as gramas de cada filamento.";
    if (minutes <= 0) return "Informe o tempo total.";
    return null;
  }

  async function save() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    const input = {
      name,
      printItem:
        draft.source === "item" && item
          ? { id: item.id, name: item.name }
          : null,
      printer: { id: printer!.id, name: printer!.name },
      filaments: usages,
      units,
      totalMinutes: minutes,
      customer: draft.customer.trim() || null,
      modelUrl: draft.modelUrl.trim() || null,
      note: draft.note.trim() || null,
    };
    setIsSaving(true);
    try {
      if (entryId) {
        await updateQueueEntry(entryId, input);
        router.push(`/dashboard/fila/${entryId}`);
      } else {
        await addToQueue(input, draft.position);
        router.push("/dashboard/fila");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setIsSaving(false);
    }
  }

  const backHref = sourceId ? `/dashboard/fila/${sourceId}` : "/dashboard/fila";

  usePageHeaderBreadcrumb(
    isNotFound ? null : (
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
        {sourceId ? (
          <>
            {entry && (
              <>
                <Link
                  href={backHref}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {entry.name}
                </Link>
                <ChevronRight
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </>
            )}
            <span className="font-medium">
              {isEditing ? "Editar" : "Duplicar"}
            </span>
          </>
        ) : (
          <span className="font-medium">Adicionar</span>
        )}
      </>
    ),
  );

  usePageHeaderAction(
    isNotFound || loadError ? null : (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push(backHref)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSaving || (sourceId != null && !entry)}
          aria-busy={isSaving}
          onClick={save}
        >
          <Check />
          {isSaving
            ? "Salvando..."
            : isEditing
              ? "Salvar alterações"
              : "Adicionar à fila"}
        </Button>
      </>
    ),
  );

  if (isNotFound) return <NotFoundState resource="fila" />;

  if (loadError) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
        <Link
          href={backHref}
          className="text-sm text-brand-300 hover:underline"
        >
          Voltar
        </Link>
      </div>
    );
  }

  if (sourceId && !entry) {
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

  const perUnitGrams = grams / units;
  const perUnitMinutes = minutes / units;

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
          <h1 className="text-4xl font-bold">
            {isEditing ? "Editar item da fila" : "Adicionar à fila"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? "Ao salvar, o orçamento usa o preço de hoje dos filamentos."
              : entry
                ? `Cópia de ${entry.name}. Ajuste o que mudar e adicione.`
                : "Um orçamento rápido: filamento e tempo bastam."}
          </p>
        </div>

        <Step n={1} title="O que imprimir">
          <ChoiceGroup label="O que imprimir">
            <ChoiceCard
              selected={draft.source === "item"}
              onSelect={() => set("source", "item")}
              icon={Layers}
              title="Uma impressão que já existe"
              description="Filamento, tempo e impressora vêm do registro padrão."
            >
              <PrintPicker
                prints={items}
                value={draft.itemId}
                onChange={chooseItem}
                minQueryLength={3}
              />
            </ChoiceCard>
            <ChoiceCard
              selected={draft.source === "new"}
              onSelect={() => set("source", "new")}
              icon={PlusCircle}
              title="Uma peça nova"
              description="Só nome, filamento e tempo. Vira impressão quando for concluída."
            >
              <Input
                aria-label="Nome da peça"
                placeholder="Ex.: Porta-escova dente de leão"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </ChoiceCard>
          </ChoiceGroup>
        </Step>

        <Separator />

        <Step
          n={2}
          title="Orçamento rápido"
          hint={
            draft.source === "item" && baseRecord
              ? `do registro padrão de ${formatDatePtBR(baseRecord.printedAt, {
                  day: "2-digit",
                  month: "2-digit",
                })}`
              : undefined
          }
        >
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-[110px_minmax(150px,200px)]">
            <Field label="Quantidade" htmlFor="queue-units">
              <Input
                id="queue-units"
                inputMode="numeric"
                value={draft.units}
                onChange={(e) =>
                  setDraft((prev) =>
                    rescale(
                      prev,
                      e.target.value.replace(/\D/g, "").slice(0, 4),
                    ),
                  )
                }
                className="tabular-nums"
              />
            </Field>
            <Field label="Tempo total" htmlFor="queue-time">
              <DurationInput
                id="queue-time"
                label="Tempo total"
                value={draft.time}
                onChange={(next) => set("time", next)}
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
          {grams > 0 && minutes > 0 && (
            <p className="-mt-1.5 text-[11.5px] text-muted-foreground/80">
              Gramas e tempo para {units} {units === 1 ? "unidade" : "unidades"}{" "}
              ({formatGrams(perUnitGrams)} e {formatDuration(perUnitMinutes)}{" "}
              cada). Mudar a quantidade recalcula os dois.
            </p>
          )}
        </Step>

        <Separator />

        <Step n={3} title="Para quem e onde">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
            <Field
              label={
                <>
                  Cliente / pedido <OptionalHint />
                </>
              }
              htmlFor="queue-customer"
            >
              <Input
                id="queue-customer"
                placeholder="Ex.: Ana · pedido #112"
                value={draft.customer}
                onChange={(e) => set("customer", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label={
              <>
                Link do modelo <OptionalHint />
              </>
            }
            htmlFor="queue-model-url"
          >
            <Input
              id="queue-model-url"
              placeholder="makerworld.com/models/..."
              value={draft.modelUrl}
              onChange={(e) => set("modelUrl", e.target.value)}
            />
          </Field>
          <Field
            label={
              <>
                Observação <OptionalHint />
              </>
            }
            htmlFor="queue-note"
          >
            <Textarea
              id="queue-note"
              className="min-h-16"
              placeholder="Ex.: imprimir em pé, lixar a base antes de entregar"
              maxLength={500}
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </Field>
          {!isEditing && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Posição na fila</SectionLabel>
              <PositionToggle
                label="Posição na fila"
                value={draft.position}
                onChange={(value) => set("position", value)}
                options={POSITION_OPTIONS}
              />
            </div>
          )}
        </Step>

        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-4 rounded-lg bg-card px-4.5 py-4.5 shadow-[0_0_0_1px_var(--neutral-800)] lg:sticky lg:top-17">
        <SectionLabel>Orçamento</SectionLabel>
        <div className="flex items-stretch gap-4.5">
          <div className="flex flex-col gap-1.25">
            <SectionLabel>Gramas</SectionLabel>
            <span className="font-heading text-2xl leading-none font-medium tabular-nums">
              {grams ? formatGrams(grams) : "–"}
            </span>
          </div>
          <StatDivider />
          <div className="flex flex-col gap-1.25">
            <SectionLabel>Tempo</SectionLabel>
            <span className="font-heading text-2xl leading-none font-medium tabular-nums">
              {minutes ? formatDuration(minutes) : "–"}
            </span>
          </div>
        </div>
        <Separator />
        {costs && quote && grams > 0 && minutes > 0 ? (
          <>
            <div className="flex flex-col gap-2 text-[12.5px] text-muted-foreground tabular-nums">
              {costRows(quote.breakdown, costs).map(([label, value]) => (
                <div key={label} className="flex">
                  <span>{label}</span>
                  <span className="ml-auto">{formatBRL(value)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-baseline">
              <span className="text-[13px]">Custo</span>
              <span className="ml-auto font-heading text-[22px] leading-none font-medium tabular-nums">
                {formatBRL(quote.cost)}
              </span>
            </div>
            <Separator />
            <div className="flex text-[12.5px] text-muted-foreground tabular-nums">
              <span>Mão de obra</span>
              <span className="ml-auto">{formatBRL(quote.labor)}</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-[13px]">Preço sugerido</span>
              <span className="ml-auto font-heading text-[26px] leading-none font-medium text-brand tabular-nums">
                {formatBRL(quote.price)}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              Margem padrão de{" "}
              {formatDecimal(costs.settings.defaultMarginPercent)}%, de{" "}
              <Link
                href="/dashboard/custos-energia"
                className="text-brand-300 hover:underline"
              >
                Custos e energia
              </Link>
              . O preço final é definido no Catálogo.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            {costsError ??
              (costs
                ? "Escolha o filamento e o tempo para ver o orçamento."
                : "Carregando custos...")}
          </p>
        )}
      </aside>
    </div>
  );
}
