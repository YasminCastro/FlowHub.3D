"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Link as LinkIcon,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { FramedPhoto } from "@/components/prints/framed-photo";
import {
  FAILURE_COLOR,
  PhotoPlaceholder,
  SectionLabel,
  Stat,
  StatDivider,
} from "@/components/prints/print-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import {
  PrintPhoto,
  costRows,
  describePrintFilament,
  formatDecimal,
  formatDuration,
  formatGrams,
  getDefaultRecord,
  getPrintItem,
  modelHref,
  shortUrl,
} from "@/lib/api/print";
import {
  QueueEntry,
  getEntryGrams,
  getQueueEntry,
  quoteEntry,
  removeFromQueue,
} from "@/lib/api/print-queue";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      <span className="truncate text-[13.5px]">{children}</span>
    </div>
  );
}

export default function QueueEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [photo, setPhoto] = useState<PrintPhoto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { costs, loadError: costsError } = useCostContext();

  useEffect(() => {
    let ignore = false;
    getQueueEntry(id)
      .then((found) => {
        if (ignore) return;
        setEntry(found);
        // Só para a foto; o item da fila se mostra sem ela.
        if (!found.printItem) return;
        getPrintItem(found.printItem.id)
          .then((item) => {
            if (ignore) return;
            const record = getDefaultRecord(item);
            setPhoto(
              record?.photos[0] ??
                item.records.find((r) => r.photos.length)?.photos[0] ??
                null,
            );
          })
          .catch(() => {});
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
  }, [id]);

  const isDone = entry?.completedAt != null;

  async function remove() {
    if (!entry) return;
    setIsRemoving(true);
    setError(null);
    try {
      await removeFromQueue(entry.id);
      router.push("/dashboard/fila");
    } catch {
      setError("Não foi possível tirar o item da fila.");
      setIsRemoving(false);
    }
  }

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
        <span className="truncate font-medium">{entry?.name ?? ""}</span>
      </>
    ),
  );

  usePageHeaderAction(
    entry ? (
      <div className="flex items-center gap-2">
        {!isDone && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isRemoving}
            aria-busy={isRemoving}
            onClick={remove}
          >
            <Trash2 />
            {isRemoving ? "Tirando..." : "Tirar da fila"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/fila/new?duplicar=${entry.id}`} />}
          nativeButton={false}
        >
          <Copy />
          {isDone ? "Imprimir de novo" : "Duplicar"}
        </Button>
        {!isDone && (
          <>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/dashboard/fila/${entry.id}/edit`} />}
              nativeButton={false}
            >
              <Pencil />
              Editar
            </Button>
            <Button
              size="sm"
              render={<Link href={`/dashboard/fila/${entry.id}/concluir`} />}
              nativeButton={false}
            >
              <Check />
              Concluir
            </Button>
          </>
        )}
      </div>
    ) : null,
  );

  if (isNotFound) return <NotFoundState resource="fila" />;

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
          <Skeleton className="h-24 w-96" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const grams = getEntryGrams(entry);
  const quote = costs ? quoteEntry(entry, costs) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-9 p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-7">
        <div className="flex items-start gap-5">
          {photo ? (
            <FramedPhoto photo={photo} className="h-24 w-28 shrink-0 rounded-md" />
          ) : (
            <PhotoPlaceholder className="h-24 w-28 shrink-0 rounded-md" />
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-4xl leading-tight font-bold">{entry.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground">
              {entry.printItem ? (
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="size-3.25" aria-hidden="true" />
                  ligado a
                  <Link
                    href={`/dashboard/impressoes/${entry.printItem.id}`}
                    className="text-foreground/80 hover:text-brand"
                  >
                    {entry.printItem.name}
                  </Link>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-sm border border-border px-1.5 text-[10px] leading-4">
                    novo
                  </span>
                  vira impressão ao concluir
                </span>
              )}
              {entry.modelUrl && (
                <a
                  href={modelHref(entry.modelUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-300 hover:underline"
                >
                  <LinkIcon className="size-3.25" aria-hidden="true" />
                  {shortUrl(entry.modelUrl)}
                </a>
              )}
              <span>adicionado em {formatDatePtBR(entry.createdAt)}</span>
            </div>
          </div>
        </div>

        {entry.lastFailure && !isDone && (
          <div
            className="flex items-start gap-2.5 rounded-md px-3.75 py-3 text-[13px]"
            style={{
              backgroundColor: "rgba(217,122,122,.06)",
              boxShadow: "inset 0 0 0 1px rgba(217,122,122,.3)",
            }}
          >
            <RotateCcw
              className="mt-0.5 size-3.75 shrink-0"
              style={{ color: FAILURE_COLOR }}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <span style={{ color: FAILURE_COLOR }}>
                Voltou para a fila · falhou em{" "}
                {formatDatePtBR(entry.lastFailure.at)}
              </span>
              <span className="text-muted-foreground">
                {entry.lastFailure.reason}
              </span>
            </div>
          </div>
        )}

        {isDone && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md bg-brand/8 px-3.75 py-3 text-[13px] shadow-[inset_0_0_0_1px_var(--brand-700)]">
            <CheckCircle2 className="size-3.75 text-brand" aria-hidden="true" />
            Concluído em {formatDatePtBR(entry.completedAt!)}
            {entry.result && (
              <Link
                href={`/dashboard/impressoes/${entry.result.item.id}`}
                className="inline-flex items-center gap-1.25 text-brand-300 hover:underline"
              >
                {entry.result.createdItem ? (
                  <>
                    <Plus className="size-3" aria-hidden="true" />
                    nova impressão criada: {entry.result.item.name}
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-3" aria-hidden="true" />
                    registro em {entry.result.item.name}
                  </>
                )}
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-stretch gap-6.5">
          <Stat label="Unidades" value={String(entry.units)} size="lg" />
          <StatDivider />
          <Stat
            label="Tempo"
            value={entry.totalMinutes ? formatDuration(entry.totalMinutes) : "–"}
            size="lg"
          />
          <StatDivider />
          <Stat
            label="Filamento"
            value={grams ? formatGrams(grams) : "–"}
            size="lg"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Detail label="Cliente / pedido">{entry.customer ?? "—"}</Detail>
          <Detail label="Impressora">{entry.printer.name}</Detail>
        </div>

        {entry.note && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel>Observação</SectionLabel>
            <p className="text-[13.5px] whitespace-pre-line text-foreground/85">
              {entry.note}
            </p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionLabel>Filamentos</SectionLabel>
          {entry.filaments.length ? (
            <div className="flex flex-col">
              {entry.filaments.map((usage) => (
                <div
                  key={usage.usageId ?? usage.filament.id}
                  className="flex items-center gap-2.5 border-b border-border/50 py-2.5 text-[13px] last:border-b-0"
                >
                  <FilamentDot colors={usage.filament.colors} />
                  <span className="min-w-0 truncate">
                    {describePrintFilament(usage.filament)}
                  </span>
                  <span className="ml-auto text-foreground/70 tabular-nums">
                    {formatGrams(usage.grams)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">—</p>
          )}
        </section>

        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </div>

      <aside className="flex flex-col gap-4 rounded-lg bg-card px-4.5 py-4.5 shadow-[0_0_0_1px_var(--neutral-800)] lg:sticky lg:top-17">
        <SectionLabel>Orçamento</SectionLabel>
        {costs && quote ? (
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
            {costsError ?? "Carregando custos..."}
          </p>
        )}
      </aside>
    </div>
  );
}
