"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  GripVertical,
  Layers,
  Link2,
  ListOrdered,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { KeyboardEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FAILURE_COLOR,
  PhotoPlaceholder,
  Stat,
  StatDivider,
} from "@/components/prints/print-bits";
import { FramedPhoto } from "@/components/prints/framed-photo";
import { PositionToggle } from "@/components/queue/queue-bits";
import { QueueShareLink } from "@/components/queue/queue-share-link";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import {
  PrintItem,
  describePrintFilament,
  formatDecimal,
  formatDuration,
  getDefaultRecord,
  listPrintItems,
} from "@/lib/api/print";
import {
  QueueEntry,
  QueueSort,
  RECENT_DONE_DAYS,
  hasEstimate,
  isRecentlyDone,
  listQueue,
  countFilamentSwaps,
  describePrinting,
  quoteEntry,
  removeFromQueue,
  reorderQueue,
  sortQueue,
  startQueueEntry,
  stopQueueEntry,
} from "@/lib/api/print-queue";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

const ALL_PRINTERS = "all";

const QUEUE_COLUMNS =
  "grid-cols-[18px_22px_44px_minmax(160px,1.6fr)_minmax(110px,1fr)_92px_110px_50px_64px_76px_84px_200px]";

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "shortest", label: "Menor tempo" },
  { value: "longest", label: "Maior tempo" },
];

const DONE_COLUMNS =
  "grid-cols-[22px_90px_minmax(140px,1.6fr)_minmax(100px,1fr)_70px_minmax(180px,1.2fr)]";

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs whitespace-nowrap transition-colors",
        selected
          ? "border-brand bg-brand/10 text-brand"
          : "border-border text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ColumnLabel({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Linha com o fio de baixo esmaecendo nas pontas, como nas outras listas.
const ROW_RULE =
  "bg-[linear-gradient(to_right,transparent,rgba(233,233,237,.08)_48px,rgba(233,233,237,.08)_calc(100%-48px),transparent)] bg-[length:100%_1px] bg-bottom bg-no-repeat";

function firstPhoto(item: PrintItem | undefined) {
  if (!item) return null;
  const record = getDefaultRecord(item);
  return (
    record?.photos[0] ??
    item.records.find((r) => r.photos.length)?.photos[0] ??
    null
  );
}

function EntryOrigin({ entry }: { entry: QueueEntry }) {
  if (entry.startedAt) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1 text-brand">
        <Printer className="size-2.75 shrink-0" aria-hidden="true" />
        <span className="truncate">imprimindo · {describePrinting(entry)}</span>
      </span>
    );
  }
  if (entry.lastFailure) {
    return (
      <span
        className="inline-flex items-center gap-1"
        style={{ color: FAILURE_COLOR }}
        title={entry.lastFailure.reason}
      >
        <RotateCcw className="size-2.75" aria-hidden="true" />
        voltou · falhou em{" "}
        {formatDatePtBR(entry.lastFailure.at, {
          day: "2-digit",
          month: "2-digit",
        })}
      </span>
    );
  }
  if (entry.fromShareLink && !entry.printer.id) {
    return (
      <>
        <span className="rounded-sm border border-brand/40 px-1.5 text-[10px] leading-4 text-brand">
          via link
        </span>
        falta impressora e orçamento
      </>
    );
  }
  if (entry.printItem) {
    return (
      <>
        <Link2 className="size-2.75 shrink-0" aria-hidden="true" />
        <span className="truncate">{entry.printItem.name} · padrão</span>
      </>
    );
  }
  return (
    <>
      <span className="rounded-sm border border-border px-1.5 text-[10px] leading-4">
        novo
      </span>
      sem impressão ligada
    </>
  );
}

export default function PrintQueuePage() {
  const [pending, setPending] = useState<QueueEntry[]>([]);
  const [done, setDone] = useState<QueueEntry[]>([]);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printerFilter, setPrinterFilter] = useState(ALL_PRINTERS);
  const [sort, setSort] = useState<QueueSort>("manual");
  const [byFilament, setByFilament] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const { costs } = useCostContext();

  useEffect(() => {
    let ignore = false;
    listQueue()
      .then((state) => {
        if (ignore) return;
        setPending(state.pending);
        setDone(state.done);
      })
      .catch((err) => {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar a fila.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    // Só para as fotos; a fila funciona sem elas.
    listPrintItems()
      .then((result) => {
        if (!ignore) setItems(result);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/fila/new" />}
      nativeButton={false}
    >
      <Plus />
      Adicionar à fila
    </Button>,
  );

  const printers = [
    ...new Map(
      pending.flatMap((e) =>
        e.printer.id ? [[e.printer.id, e.printer.name] as const] : [],
      ),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  const isFiltered = printerFilter !== ALL_PRINTERS;
  const isSorted = sort !== "manual" || byFilament;
  // Arrastar só faz sentido vendo a fila inteira, na ordem dela.
  const canDrag = !isFiltered && !isSorted;
  const visible = sortQueue(
    isFiltered
      ? pending.filter((e) => e.printer.id === printerFilter)
      : pending,
    { sort, byFilament },
  );

  const filamentSwaps = countFilamentSwaps(visible);

  const units = visible.reduce((sum, e) => sum + e.units, 0);
  const minutes = visible.reduce((sum, e) => sum + e.totalMinutes, 0);

  const recentDone = done.filter((e) => isRecentlyDone(e));
  const shownDone = showAllDone ? done : recentDone;

  function persistOrder(next: QueueEntry[]) {
    setPending(next);
    reorderQueue(next.map((e) => e.id)).catch(() =>
      setError("Não foi possível salvar a nova ordem."),
    );
  }

  // Grava a ordem que está na tela. Filtrado por impressora, os itens dela
  // trocam de lugar entre si e o resto da fila fica onde estava.
  function saveShownOrder() {
    const shownIds = new Set(visible.map((e) => e.id));
    const shown = [...visible];
    persistOrder(pending.map((e) => (shownIds.has(e.id) ? shown.shift()! : e)));
    setSort("manual");
    setByFilament(false);
  }

  function moveBefore(id: string, targetId: string) {
    if (id === targetId) return;
    setPending((prev) => {
      const from = prev.findIndex((e) => e.id === id);
      const to = prev.findIndex((e) => e.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function moveBy(id: string, delta: number) {
    const from = pending.findIndex((e) => e.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= pending.length) return;
    const next = [...pending];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  }

  function onHandleKey(e: KeyboardEvent, id: string) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      moveBy(id, e.key === "ArrowUp" ? -1 : 1);
    }
  }

  // Iniciar marca o item na impressora e desmarca o que estava nela (como o
  // backend faz); parar só desmarca.
  async function togglePrinting(entry: QueueEntry) {
    setError(null);
    try {
      if (entry.startedAt) {
        const stopped = await stopQueueEntry(entry.id);
        setPending((prev) =>
          prev.map((e) => (e.id === stopped.id ? stopped : e)),
        );
      } else {
        const started = await startQueueEntry(entry.id);
        setPending((prev) =>
          prev.map((e) =>
            e.id === started.id
              ? started
              : e.startedAt && e.printer.id === started.printer.id
                ? { ...e, startedAt: null }
                : e,
          ),
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar o item.",
      );
    }
  }

  async function remove(entry: QueueEntry) {
    setPending((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      await removeFromQueue(entry.id);
    } catch {
      setError("Não foi possível tirar o item da fila.");
    }
  }

  function renderQueue() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      );
    }

    if (pending.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ListOrdered className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nada na fila. Adicione o que vai imprimir a seguir.
          </p>
          <Button
            size="sm"
            render={<Link href="/dashboard/fila/new" />}
            nativeButton={false}
          >
            <Plus />
            Adicionar à fila
          </Button>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="flex min-w-[1146px] flex-col" role="list">
          <div
            className={cn(
              "grid items-center gap-3 py-2",
              QUEUE_COLUMNS,
              ROW_RULE,
            )}
          >
            <span />
            <ColumnLabel>#</ColumnLabel>
            <span />
            <ColumnLabel>Peça</ColumnLabel>
            <ColumnLabel>Cliente / pedido</ColumnLabel>
            <ColumnLabel>Impressora</ColumnLabel>
            <ColumnLabel>Filamento</ColumnLabel>
            <ColumnLabel>Qtd.</ColumnLabel>
            <ColumnLabel>Tempo</ColumnLabel>
            <ColumnLabel className="text-right">Custo</ColumnLabel>
            <ColumnLabel className="text-right">Preço sug.</ColumnLabel>
            <span />
          </div>

          {visible.map((entry) => {
            const position = pending.indexOf(entry) + 1;
            const quote =
              costs && hasEstimate(entry) ? quoteEntry(entry, costs) : null;
            const photo = firstPhoto(
              items.find((item) => item.id === entry.printItem?.id),
            );
            const [mainFilament, ...otherFilaments] = entry.filaments;
            return (
              <div
                key={entry.id}
                role="listitem"
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  moveBefore(draggingId, entry.id);
                }}
                onDrop={(e) => e.preventDefault()}
                className={cn(
                  "grid items-center gap-3 py-2.5 transition-colors hover:bg-foreground/4",
                  QUEUE_COLUMNS,
                  ROW_RULE,
                  entry.startedAt && "bg-brand/6",
                  draggingId === entry.id && "opacity-40",
                )}
                style={
                  entry.startedAt
                    ? undefined
                    : entry.lastFailure
                      ? { backgroundColor: "rgba(217,122,122,.04)" }
                      : undefined
                }
              >
                <button
                  type="button"
                  draggable={canDrag}
                  disabled={!canDrag}
                  aria-label={`Mover ${entry.name} (setas para cima e para baixo)`}
                  title={
                    isSorted
                      ? "Volte para a ordem manual para arrastar"
                      : isFiltered
                        ? "Mostre todas as impressoras para reordenar"
                        : "Arraste para mudar a prioridade"
                  }
                  onKeyDown={(e) => onHandleKey(e, entry.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(entry.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    persistOrder(pending);
                  }}
                  className="grid cursor-grab place-items-center text-foreground/30 hover:text-foreground/60 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                >
                  <GripVertical className="size-3.75" aria-hidden="true" />
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {position}
                </span>
                {photo ? (
                  <FramedPhoto photo={photo} className="h-9 w-11 rounded-sm" />
                ) : (
                  <PhotoPlaceholder className="h-9 w-11 rounded-sm [&_svg]:size-3.75" />
                )}
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/fila/${entry.id}`}
                    className="block truncate text-[13.5px] hover:text-brand"
                  >
                    {entry.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.25 text-[11px] whitespace-nowrap text-muted-foreground">
                    <EntryOrigin entry={entry} />
                  </div>
                </div>
                <span className="truncate text-[12.5px] text-foreground/70">
                  {entry.customer ?? "—"}
                </span>
                <span className="truncate text-[12.5px] text-foreground/70">
                  {entry.printer.name || "—"}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] whitespace-nowrap">
                  {mainFilament ? (
                    <>
                      <FilamentDot colors={mainFilament.filament.colors} />
                      <span className="truncate">
                        {describePrintFilament(mainFilament.filament)}
                      </span>
                      {otherFilaments.length > 0 && (
                        <span className="text-muted-foreground">
                          +{otherFilaments.length}
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-[13px] tabular-nums">
                  {entry.units} un.
                </span>
                <span className="text-[12.5px] text-foreground/70 tabular-nums">
                  {entry.totalMinutes
                    ? formatDuration(entry.totalMinutes)
                    : "–"}
                </span>
                <span className="text-right text-[12.5px] text-foreground/70 tabular-nums">
                  {quote ? formatBRL(quote.cost) : "–"}
                </span>
                <span className="text-right font-heading text-[13px] font-medium tabular-nums">
                  {quote ? formatBRL(quote.price) : "–"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!entry.startedAt && !entry.printer.id}
                    aria-label={
                      entry.startedAt
                        ? `Parar ${entry.name} (voltar a esperar)`
                        : `Iniciar ${entry.name} na impressora`
                    }
                    title={
                      entry.startedAt
                        ? "Não está mais na impressora"
                        : entry.printer.id
                          ? "Está na impressora agora"
                          : "Escolha a impressora antes de iniciar"
                    }
                    className={
                      entry.startedAt ? "text-brand" : "text-muted-foreground"
                    }
                    onClick={() => togglePrinting(entry)}
                  >
                    {entry.startedAt ? <Square /> : <Play />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Tirar ${entry.name} da fila`}
                    title="Tirar da fila"
                    className="text-muted-foreground"
                    onClick={() => remove(entry)}
                  >
                    <Trash2 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplicar ${entry.name}`}
                    title="Duplicar"
                    className="text-muted-foreground"
                    render={
                      <Link href={`/dashboard/fila/new?duplicar=${entry.id}`} />
                    }
                    nativeButton={false}
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    render={
                      <Link href={`/dashboard/fila/${entry.id}/concluir`} />
                    }
                    nativeButton={false}
                  >
                    <Check />
                    Concluir
                  </Button>
                </div>
              </div>
            );
          })}

          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nada na fila para esta impressora.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-8">
      <div>
        <h1 className="text-4xl font-bold">Fila de impressão</h1>
        <p className="text-sm text-muted-foreground">
          O que vai imprimir, na ordem. Arraste para mudar a prioridade.
        </p>
      </div>

      <QueueShareLink />

      <div className="flex flex-wrap items-stretch gap-6.5">
        <Stat
          label="Na fila"
          value={isLoading ? "–" : String(visible.length)}
          size="lg"
        />
        <StatDivider />
        <Stat
          label="Unidades"
          value={isLoading ? "–" : String(units)}
          size="lg"
        />
        <StatDivider />
        <Stat
          label="Tempo de impressão"
          value={isLoading || !minutes ? "–" : formatDuration(minutes)}
          size="lg"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {printers.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.75">
            <FilterChip
              selected={!isFiltered}
              onClick={() => setPrinterFilter(ALL_PRINTERS)}
            >
              Todas as impressoras
            </FilterChip>
            {printers.map(([id, name]) => (
              <FilterChip
                key={id}
                selected={printerFilter === id}
                onClick={() =>
                  setPrinterFilter((prev) => (prev === id ? ALL_PRINTERS : id))
                }
              >
                {name}
              </FilterChip>
            ))}
          </div>
        )}
        {pending.length > 1 && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {filamentSwaps === 1
                ? "1 troca de filamento"
                : `${filamentSwaps} trocas de filamento`}
            </span>
            <FilterChip
              selected={byFilament}
              onClick={() => setByFilament((prev) => !prev)}
            >
              <Layers className="size-3.25" aria-hidden="true" />
              Por filamento
            </FilterChip>
            <PositionToggle
              label="Ordenar a fila"
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
            />
          </div>
        )}
      </div>

      {isSorted && pending.length > 1 && (
        <div className="-mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Só a visualização mudou; a ordem da fila continua a manual.
          </span>
          <button
            type="button"
            onClick={saveShownOrder}
            className="text-brand-300 hover:underline"
          >
            Salvar como ordem da fila
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col">{renderQueue()}</div>

      {done.length > 0 && (
        <section className="mt-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-2.25 py-1.5">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone((prev) => !prev)}
              className="flex items-center gap-2.25"
            >
              <ChevronDown
                className={cn(
                  "size-3.25 text-muted-foreground transition-transform",
                  !showDone && "-rotate-90",
                )}
                aria-hidden="true"
              />
              <h2 className="font-heading text-base font-medium">Concluídos</h2>
            </button>
            <span className="text-xs text-muted-foreground">
              {showAllDone
                ? `todos · ${done.length}`
                : `últimos ${RECENT_DONE_DAYS} dias · ${recentDone.length}`}
            </span>
            {done.length > recentDone.length && (
              <button
                type="button"
                onClick={() => {
                  setShowDone(true);
                  setShowAllDone((prev) => !prev);
                }}
                className="ml-auto text-xs text-brand-300 hover:underline"
              >
                {showAllDone ? "Só os recentes" : "Ver todos"}
              </button>
            )}
          </div>

          {showDone && (
            <div className="overflow-x-auto">
              <div className="flex min-w-[720px] flex-col">
                {shownDone.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "grid items-center gap-3 py-2.25 text-foreground/60",
                      DONE_COLUMNS,
                      ROW_RULE,
                    )}
                  >
                    <CheckCircle2
                      className="size-3.75 text-brand"
                      aria-label="Concluído"
                    />
                    <span className="text-xs tabular-nums">
                      {entry.completedAt && formatDatePtBR(entry.completedAt)}
                    </span>
                    <Link
                      href={`/dashboard/fila/${entry.id}`}
                      className="truncate text-[13px] text-foreground/80 hover:text-brand"
                    >
                      {entry.name}
                    </Link>
                    <span className="truncate text-[12.5px]">
                      {entry.customer ?? "—"}
                    </span>
                    <span className="text-[12.5px] tabular-nums">
                      {entry.units} un.
                    </span>
                    {entry.result ? (
                      <Link
                        href={`/dashboard/impressoes/${entry.result.item.id}`}
                        className="flex min-w-0 items-center gap-1.25 text-xs hover:text-brand"
                      >
                        {entry.result.createdItem ? (
                          <>
                            <Plus className="size-2.75" aria-hidden="true" />
                            nova impressão criada
                          </>
                        ) : (
                          <>
                            <ArrowRight
                              className="size-2.75"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              registro em {entry.result.item.name}
                            </span>
                          </>
                        )}
                      </Link>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                {shownDone.length === 0 && (
                  <p className="py-3 text-xs text-muted-foreground">
                    Nada concluído nos últimos {RECENT_DONE_DAYS} dias.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
