import { CheckCircle2, ListOrdered, Printer, RotateCcw } from "lucide-react";

import { FAILURE_COLOR } from "@/components/prints/print-bits";
import { formatDuration, formatGrams } from "@/lib/api/print";
import {
  SharedQueue,
  SharedQueueEntry,
  describePrinting,
  printingEndsAt,
} from "@/lib/api/print-queue";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

// Número (ou ✓), peça, filamento, custo e preço sugerido, como as colunas da
// fila do usuário. Pendentes e concluídos usam as mesmas.
const COLUMNS =
  "grid-cols-[22px_minmax(140px,1fr)_68px_68px_76px] gap-x-2.5 sm:gap-x-3";

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

function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="font-heading text-base font-medium">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

// No celular as três colunas de valor não cabem: a tabela rola de lado.
function EntryTable({
  first,
  children,
}: {
  first: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[440px] flex-col">
        <div
          aria-hidden="true"
          className={cn(
            "grid items-center border-b border-border/50 px-2 py-2",
            COLUMNS,
          )}
        >
          <ColumnLabel>{first}</ColumnLabel>
          <ColumnLabel>Peça</ColumnLabel>
          <ColumnLabel className="text-right">Filamento</ColumnLabel>
          <ColumnLabel className="text-right">Custo</ColumnLabel>
          <ColumnLabel className="text-right">Preço sug.</ColumnLabel>
        </div>
        {children}
      </div>
    </div>
  );
}

function rowClassName(isMine: boolean, isPrinting = false) {
  return cn(
    "grid items-center border-b border-border/50 px-2 py-2.5 last:border-b-0",
    COLUMNS,
    (isMine || isPrinting) && "rounded-md bg-brand/8",
    isPrinting && "shadow-[inset_0_0_0_1px_var(--brand-700)]",
  );
}

// Para quem pediu, passou do previsto é só "terminando": o aviso de atraso
// fica na fila de quem imprime.
function describeSharedPrinting(entry: SharedQueueEntry) {
  const endsAt = printingEndsAt(entry);
  return endsAt && endsAt < new Date() ? "terminando" : describePrinting(entry);
}

function EntryName({
  entry,
  isMine,
}: {
  entry: SharedQueueEntry;
  isMine: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="truncate text-[13.5px]">{entry.name}</span>
      {isMine && (
        <span className="shrink-0 rounded-sm border border-brand/40 px-1.5 text-[10px] leading-4 text-brand">
          seu pedido
        </span>
      )}
    </div>
  );
}

// Quantidade · impressora · tempo · gramas.
function describeEntry(entry: SharedQueueEntry) {
  return [
    `${entry.units} un.`,
    entry.printerName || null,
    entry.totalMinutes ? formatDuration(entry.totalMinutes) : "tempo a definir",
    entry.grams ? formatGrams(entry.grams) : "filamento a definir",
  ]
    .filter(Boolean)
    .join(" · ");
}

function EntryValues({ entry }: { entry: SharedQueueEntry }) {
  return (
    <>
      <span
        className="text-right text-[12.5px] text-foreground/70 tabular-nums"
        title="Custo do filamento do lote"
      >
        {entry.filamentCost != null ? formatBRL(entry.filamentCost) : "–"}
      </span>
      <span
        className="text-right text-[12.5px] text-foreground/70 tabular-nums"
        title="Custo estimado do lote"
      >
        {entry.cost != null ? formatBRL(entry.cost) : "–"}
      </span>
      <span
        className="text-right font-heading text-[13px] font-medium tabular-nums"
        title="Preço sugerido do lote"
      >
        {entry.price != null ? formatBRL(entry.price) : "–"}
      </span>
    </>
  );
}

/**
 * A fila vista pelo link público: ordem, peça, tempo, gramas, custos e preço
 * sugerido. Os pedidos feitos deste navegador aparecem marcados como "seu
 * pedido".
 */
export function SharedQueueList({
  queue,
  myIds,
}: {
  queue: SharedQueue;
  myIds: string[];
}) {
  const mine = new Set(myIds);
  const knownMinutes = queue.pending.reduce(
    (sum, e) => sum + e.totalMinutes,
    0,
  );
  const missingTime = queue.pending.some((e) => !e.totalMinutes);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionTitle
          hint={
            queue.pending.length
              ? [
                  queue.pending.length === 1
                    ? "1 item"
                    : `${queue.pending.length} itens`,
                  knownMinutes
                    ? `${missingTime ? "pelo menos " : ""}${formatDuration(knownMinutes)} de impressão`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
        >
          Na fila
        </SectionTitle>

        {queue.pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <ListOrdered className="size-5" aria-hidden="true" />
            <p className="text-sm">A fila está vazia agora.</p>
          </div>
        ) : (
          <EntryTable first="#">
            <ol className="flex flex-col">
              {queue.pending.map((entry, i) => {
                const isMine = mine.has(entry.id);
                return (
                  <li
                    key={entry.id}
                    className={rowClassName(isMine, entry.startedAt !== null)}
                  >
                    {entry.startedAt ? (
                      <Printer
                        className="size-3.5 text-brand"
                        aria-label="Imprimindo agora"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <EntryName entry={entry} isMine={isMine} />
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.25 text-[11px] text-muted-foreground">
                        {entry.startedAt && (
                          <span className="shrink-0 text-brand">
                            imprimindo agora · {describeSharedPrinting(entry)} ·
                          </span>
                        )}
                        {!entry.startedAt && entry.retrying && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1"
                            style={{ color: FAILURE_COLOR }}
                            title="Falhou e vai ser impresso de novo"
                          >
                            <RotateCcw
                              className="size-2.75"
                              aria-hidden="true"
                            />
                            de novo ·
                          </span>
                        )}
                        <span className="truncate tabular-nums">
                          {describeEntry(entry)}
                        </span>
                      </div>
                    </div>
                    <EntryValues entry={entry} />
                  </li>
                );
              })}
            </ol>
          </EntryTable>
        )}
      </section>

      {queue.done.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle hint="os mais recentes">Concluídos</SectionTitle>
          <EntryTable first={null}>
            <ul className="flex flex-col">
              {queue.done.map((entry) => {
                const isMine = mine.has(entry.id);
                return (
                  <li key={entry.id} className={rowClassName(isMine)}>
                    <CheckCircle2
                      className="size-3.75 text-brand"
                      aria-label="Concluído"
                    />
                    <div className="min-w-0 text-foreground/70">
                      <EntryName entry={entry} isMine={isMine} />
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground tabular-nums">
                        {formatDatePtBR(entry.completedAt, {
                          day: "2-digit",
                          month: "2-digit",
                        })}{" "}
                        · {describeEntry(entry)}
                      </div>
                    </div>
                    <EntryValues entry={entry} />
                  </li>
                );
              })}
            </ul>
          </EntryTable>
        </section>
      )}
    </div>
  );
}
