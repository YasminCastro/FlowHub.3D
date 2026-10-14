"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  GitBranch,
  ImageIcon,
  LinkIcon,
  ListOrdered,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  PhotoPlaceholder,
  SectionLabel,
  Stat,
  StatDivider,
} from "@/components/prints/print-bits";
import { PrintDeleteDialog } from "@/components/prints/print-delete-dialog";
import { PrintRecordDeleteDialog } from "@/components/prints/print-record-delete-dialog";
import { PrintRecordSheet } from "@/components/prints/print-record-sheet";
import { PrintRecordsTable } from "@/components/prints/print-records-table";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import { usePrintItem } from "@/hooks/use-print-item";
import {
  PrintFilament,
  PrintOutcome,
  PrintRecord,
  formatDuration,
  formatGrams,
  formatSettings,
  getDefaultRecord,
  getItemStats,
  getLostCost,
  getPerUnit,
  listPrintFilaments,
  setDefaultPrintRecord,
  modelHref,
  shortUrl,
} from "@/lib/api/print";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

const VISIBLE_RECORDS = 5;

type OutcomeFilter = "all" | PrintOutcome;

const OUTCOME_FILTERS: { value: OutcomeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "SUCCESS", label: "Sucesso" },
  { value: "FAILURE", label: "Falha" },
];

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

export default function PrintItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    item,
    setItem,
    isLoading: isLoadingItem,
    loadError: itemError,
  } = usePrintItem(params.id);
  const { costs, loadError: costsError } = useCostContext();
  const isLoading = isLoadingItem || (!costs && !costsError);
  const loadError = itemError ?? costsError;
  const [filaments, setFilaments] = useState<PrintFilament[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetBaseId, setSheetBaseId] = useState<string | null>(null);
  // Com um id, o painel edita esse registro em vez de criar um novo.
  const [sheetEditId, setSheetEditId] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [showAll, setShowAll] = useState(false);
  // Vindo da Nova impressão com ?fotos=erro: salvou, mas as fotos falharam.
  const [actionError, setActionError] = useState<string | null>(() =>
    searchParams.get("fotos") === "erro"
      ? "A impressão foi salva, mas as fotos não foram enviadas."
      : null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PrintRecord | null>(
    null,
  );
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    listPrintFilaments()
      .then(setFilaments)
      .catch(() => setFilaments([]));
  }, []);

  function openSheet(baseId: string | null) {
    setSheetBaseId(baseId);
    setSheetEditId(null);
    setIsSheetOpen(true);
  }

  function openEdit(recordId: string) {
    setSheetEditId(recordId);
    setIsSheetOpen(true);
  }

  usePageHeaderBreadcrumb(
    item ? (
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
        <span className="max-w-80 truncate font-medium">{item.name}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    item ? (
      <>
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href={`/dashboard/impressoes/new?derivadoDe=${item.id}`} />
          }
          nativeButton={false}
        >
          <GitBranch />
          Criar derivado
        </Button>
        <Button
          variant="secondary"
          size="sm"
          render={<Link href={`/dashboard/fila/new?impressao=${item.id}`} />}
          nativeButton={false}
        >
          <ListOrdered />
          Adicionar à fila
        </Button>
        <Button size="sm" onClick={() => openSheet(null)}>
          <Plus />
          Novo registro
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label="Excluir impressão"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
        </Button>
      </>
    ) : null,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="grid grid-cols-1 gap-7 md:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton className="h-55 w-full" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError || !item || !costs) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Impressão não encontrada."}
        </p>
      </div>
    );
  }

  const base = getDefaultRecord(item);
  const perUnit = getPerUnit(base, costs);
  const stats = getItemStats(item);
  const lostCost = getLostCost(item.records, costs);
  const photos = item.records.flatMap((r) => r.photos.map((p) => p.src));
  const mainPhoto = photos[activePhoto] ?? photos[0];

  const filteredRecords = item.records.filter(
    (r) => outcomeFilter === "all" || r.outcome === outcomeFilter,
  );
  const visibleRecords = showAll
    ? filteredRecords
    : filteredRecords.slice(0, VISIBLE_RECORDS);
  const hiddenCount = filteredRecords.length - visibleRecords.length;

  async function makeDefault(recordId: string) {
    setActionError(null);
    try {
      setItem(await setDefaultPrintRecord(item!.id, recordId));
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível trocar o registro padrão.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6.5 p-8">
      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainPhoto}
              alt={item.name}
              className="h-55 w-full rounded-md object-cover"
            />
          ) : (
            <PhotoPlaceholder className="h-55 flex-col gap-1.5 rounded-md">
              <ImageIcon className="size-7" aria-hidden="true" />
              <span className="text-[11.5px]">
                Sem fotos. Adicione no próximo registro.
              </span>
            </PhotoPlaceholder>
          )}
          {photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.slice(0, 4).map((src, index) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Ver foto ${index + 1}`}
                  onClick={() => setActivePhoto(index)}
                  className={cn(
                    "h-14 overflow-hidden rounded-sm",
                    index === activePhoto &&
                      "shadow-[inset_0_0_0_1px_var(--brand)]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            {item.category && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5 text-[11px] text-foreground/80">
                  {item.category.color && (
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ background: item.category.color }}
                    />
                  )}
                  {item.category.name}
                </span>
              </div>
            )}
            <h1 className="text-4xl leading-tight font-bold">{item.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground">
              {item.modelUrl && (
                <a
                  href={modelHref(item.modelUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-300 hover:underline"
                >
                  <LinkIcon className="size-3.25" aria-hidden="true" />
                  {shortUrl(item.modelUrl)}
                </a>
              )}
              {item.derivedFrom && (
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="size-3.25" aria-hidden="true" />
                  derivado de
                  <Link
                    href={`/dashboard/impressoes/${item.derivedFrom.id}`}
                    className="text-foreground/80 hover:text-brand"
                  >
                    {item.derivedFrom.name}
                  </Link>
                </span>
              )}
              {item.derivatives.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="size-3.25" aria-hidden="true" />
                  {item.derivatives.length}{" "}
                  {item.derivatives.length === 1 ? "derivado:" : "derivados:"}
                  {item.derivatives.map((d, index) => (
                    <span key={d.id}>
                      {index > 0 && ", "}
                      <Link
                        href={`/dashboard/impressoes/${d.id}`}
                        className="text-foreground/80 hover:text-brand"
                      >
                        {d.name}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>

          <section className="flex flex-col gap-3 rounded-md bg-card px-4.5 py-4 shadow-[inset_0_0_0_1px_var(--brand-800)]">
            <div className="flex flex-wrap items-center gap-2">
              <Star
                className="size-3.25 fill-current text-brand"
                aria-hidden="true"
              />
              <SectionLabel className="text-brand-300">
                Registro padrão
              </SectionLabel>
              <span className="text-[11.5px] text-muted-foreground">
                · {formatDatePtBR(base.printedAt)}
                {base.filaments[0] &&
                  ` · ${base.filaments[0].filament.colorName.toLowerCase()}`}
              </span>
            </div>
            <div className="flex flex-wrap items-stretch gap-6">
              <Stat label="Por unidade" value={formatGrams(perUnit.grams)} />
              <StatDivider />
              <Stat
                label="Tempo / un."
                value={formatDuration(perUnit.minutes)}
              />
              <StatDivider />
              <Stat label="Custo / un." value={formatBRL(perUnit.cost)} />
              <StatDivider />
              <div className="flex min-w-0 flex-col gap-1.75">
                <SectionLabel>Configuração</SectionLabel>
                <div className="text-[12.5px] leading-normal text-foreground/72">
                  {base.settings ? (
                    <>
                      {base.printer.name} · {base.settings.slicer} ·{" "}
                      {formatSettings(base.settings).split(" · ")[0]}
                      <br />
                      {formatSettings(base.settings)
                        .split(" · ")
                        .slice(1)
                        .join(" · ")}
                    </>
                  ) : (
                    <>
                      {base.printer.name}
                      <br />
                      <span className="text-muted-foreground">
                        Sem configuração do fatiador
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-stretch gap-6">
            <Stat label="Registros" value={stats.recordCount} size="sm" />
            <StatDivider />
            <Stat label="Unidades" value={stats.units} size="sm" />
            <StatDivider />
            <Stat label="Falhas" value={stats.failures} size="sm" />
            <StatDivider />
            <Stat
              label="Perdido"
              value={formatBRL(lostCost)}
              size="sm"
              danger={lostCost > 0}
            />
            <StatDivider />
            <div className="flex flex-col gap-1.75">
              <SectionLabel>Cores já impressas</SectionLabel>
              <div className="flex h-5.5 items-center gap-1.5">
                {stats.colors.map((colors, index) => (
                  <FilamentDot key={index} colors={colors} className="size-3" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-1.5">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-lg font-medium">Registros</h2>
          <div className="flex items-center gap-1.5">
            {OUTCOME_FILTERS.map((option) => (
              <FilterChip
                key={option.value}
                selected={outcomeFilter === option.value}
                onClick={() => setOutcomeFilter(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
          <span className="ml-auto text-[11.5px] text-muted-foreground/80">
            Clique em um registro para ver a configuração completa
          </span>
        </div>

        {actionError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {actionError}
          </p>
        )}

        {visibleRecords.length ? (
          <PrintRecordsTable
            costs={costs}
            records={visibleRecords}
            defaultRecordId={item.defaultRecordId}
            onMakeDefault={(record) => makeDefault(record.id)}
            onStartFrom={(record) => openSheet(record.id)}
            onEdit={(record) => openEdit(record.id)}
            onDerive={(record) =>
              router.push(
                `/dashboard/impressoes/new?derivadoDe=${item.id}&registro=${record.id}`,
              )
            }
            onDelete={setRecordToDelete}
          />
        ) : (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">
            Nenhum registro com esse resultado.
          </p>
        )}

        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setShowAll(true)}
          >
            + {hiddenCount}{" "}
            {hiddenCount === 1 ? "registro anterior" : "registros anteriores"}
          </Button>
        )}
      </section>

      <PrintDeleteDialog
        item={item}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/impressoes")}
      />

      <PrintRecordDeleteDialog
        item={item}
        record={recordToDelete}
        open={recordToDelete != null}
        onOpenChange={(open) => {
          if (!open) setRecordToDelete(null);
        }}
        onDeleted={(updated) => {
          setItem(updated);
          setRecordToDelete(null);
        }}
      />

      <PrintRecordSheet
        item={item}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        baseRecordId={sheetBaseId}
        editRecordId={sheetEditId}
        filaments={filaments}
        costs={costs}
        onSaved={(updated, photoError) => {
          setItem(updated);
          setActionError(
            photoError &&
              `O registro foi salvo, mas as fotos não foram enviadas: ${photoError}`,
          );
        }}
      />
    </div>
  );
}
