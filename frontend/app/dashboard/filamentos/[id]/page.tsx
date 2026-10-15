"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ReactNode, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FilamentDeleteDialog } from "@/components/filaments/filament-delete-dialog";
import { FilamentRatingInput } from "@/components/filaments/filament-rating";
import { FilamentRebuyDialog } from "@/components/filaments/filament-rebuy-dialog";
import { FilamentSwatch } from "@/components/filaments/filament-swatch";
import { SpoolLevelPicker } from "@/components/filaments/spool-level";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useFilament } from "@/hooks/use-filament";
import { ApiError } from "@/lib/api/auth";
import { PURCHASE_CHANNEL_LABELS } from "@/lib/api/brand";
import {
  FILAMENT_AVAILABILITY_LABELS,
  SPOOL_LEVEL_LABELS,
  FilamentUpdateInput,
  addFilamentNote,
  formatRating,
  formatSpoolWeight,
  getPricePerKg,
  updateFilament,
} from "@/lib/api/filament";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// "200 – 230 °C"; com só um lado informado, mostra só ele.
function formatTempRange(min: number | null, max: number | null) {
  if (min == null && max == null) return "—";
  if (min == null || max == null || min === max) return `${min ?? max} °C`;
  return `${min} – ${max} °C`;
}

export default function FilamentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // ?recomprar=1: veio do botão Recomprar do card, abre direto a compra.
  const recomprar = useSearchParams().get("recomprar");
  const { filament, setFilament, isLoading, loadError } = useFilament(
    params.id,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRebuyDialogOpen, setIsRebuyDialogOpen] = useState(recomprar === "1");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function applyUpdate(input: FilamentUpdateInput) {
    if (!filament) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await updateFilament(filament.id, input);
      setFilament(updated);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar o filamento.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveNote() {
    if (!filament || !noteDraft.trim()) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const note = await addFilamentNote(filament.id, noteDraft);
      setFilament({ ...filament, notes: [note, ...filament.notes] });
      setNoteDraft("");
      setIsAddingNote(false);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a observação.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  usePageHeaderBreadcrumb(
    filament ? (
      <>
        <Link
          href="/dashboard/filamentos"
          className="text-muted-foreground hover:text-foreground"
        >
          Filamentos
        </Link>
        <ChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="font-medium">{filament.colorName}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    filament ? (
      <>
        <Button
          size="sm"
          render={<Link href={`/dashboard/filamentos/${filament.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
          Excluir
        </Button>
      </>
    ) : null,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-19 rounded-lg" />
          <Skeleton className="h-10 w-56" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError || !filament) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Filamento não encontrado."}
        </p>
      </div>
    );
  }

  const isFinished = filament.spoolLevel === "FINISHED";
  const price = getPricePerKg(filament);
  const purchases = plural(filament.purchaseCount, "compra", "compras");

  const subtitle = [
    filament.brand.name,
    purchases,
    filament.lastPurchasedAt &&
      `última em ${formatDatePtBR(filament.lastPurchasedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasPriceRange =
    filament.maxPricePaid != null &&
    filament.maxPricePaid !== filament.minPricePaid;

  const purchaseRows: { label: string; value: string; caption: string }[] = [
    {
      label: "Custo por kg",
      value: price ? formatBRL(price.average) : "—",
      caption: price
        ? Math.round(price.min) === Math.round(price.max)
          ? purchases
          : `${Math.round(price.min)} – ${Math.round(price.max)} em ${purchases}`
        : "sem preço",
    },
    {
      label: "Preço pago no rolo",
      value: hasPriceRange
        ? `${formatBRL(filament.minPricePaid)} – ${formatBRL(filament.maxPricePaid!)}`
        : formatBRL(filament.minPricePaid),
      caption: `rolo de ${formatSpoolWeight(filament.spoolWeightGrams)}`,
    },
    {
      label: "Custo por 100 g",
      value: price ? formatBRL(price.average / 10) : "—",
      caption: "pela média",
    },
    {
      label: "Última compra",
      value: filament.lastPurchasedAt
        ? formatDatePtBR(filament.lastPurchasedAt)
        : "—",
      caption: filament.purchaseChannel
        ? PURCHASE_CHANNEL_LABELS[filament.purchaseChannel]
        : "canal não informado",
    },
  ];

  const hasManufacturerTemps = [
    filament.nozzleTempMin,
    filament.nozzleTempMax,
    filament.bedTempMin,
    filament.bedTempMax,
  ].some((value) => value != null);

  const manufacturerRows = [
    {
      label: "Temperatura do bico",
      value: formatTempRange(filament.nozzleTempMin, filament.nozzleTempMax),
    },
    {
      label: "Temperatura da mesa",
      value: formatTempRange(filament.bedTempMin, filament.bedTempMax),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center gap-5">
        <FilamentSwatch
          colors={filament.colors}
          className={cn(
            "size-19 rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),var(--shadow-sm)]",
            isFinished && "opacity-60",
          )}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filament.type}</Badge>
            {filament.isOutlet && <Badge variant="outline">Outlet</Badge>}
            <Badge
              variant={isFinished ? "secondary" : "default"}
              className={cn(filament.spoolLevel === "LOW" && "text-brand-300")}
            >
              {isFinished && filament.finishedAt
                ? `Acabou em ${formatDatePtBR(filament.finishedAt)}`
                : SPOOL_LEVEL_LABELS[filament.spoolLevel]}
            </Badge>
            <Badge
              variant={
                filament.availability === "SOLD_OUT"
                  ? "destructive"
                  : "secondary"
              }
            >
              {FILAMENT_AVAILABILITY_LABELS[filament.availability]} na marca
            </Badge>
            <span className="text-[11.5px] tabular-nums text-muted-foreground/70">
              {filament.colors.join(" · ")}
            </span>
          </div>
          <h1 className="font-heading text-4xl font-medium tracking-tight">
            {filament.colorName}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {filament.availability === "AVAILABLE" && (
            <Button onClick={() => setIsRebuyDialogOpen(true)}>
              <RefreshCw />
              Recomprar
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {actionError}
        </p>
      )}

      <Separator />

      <div className="flex flex-col gap-9 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <section className="flex flex-col gap-2">
            <SectionLabel>Compras</SectionLabel>
            <div className="flex flex-col">
              {purchaseRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_auto_minmax(0,13rem)] items-center gap-4 border-b border-border/50 py-2.5"
                >
                  <span className="text-[13.5px] text-foreground/75">
                    {row.label}
                  </span>
                  <span className="text-right font-heading text-[15px] font-medium tabular-nums whitespace-nowrap">
                    {row.value}
                  </span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {row.caption}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <SectionLabel>Configurações do fabricante</SectionLabel>
              <span className="text-xs text-muted-foreground/70">
                inicial – final
              </span>
            </div>
            {hasManufacturerTemps ? (
              <div className="flex flex-col">
                {manufacturerRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border/50 py-2.5"
                  >
                    <span className="text-[13.5px] text-foreground/75">
                      {row.label}
                    </span>
                    <span className="text-right font-heading text-[15px] font-medium tabular-nums whitespace-nowrap">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                Nenhuma temperatura informada.{" "}
                <Link
                  href={`/dashboard/filamentos/${filament.id}/edit`}
                  className="text-brand-300 hover:underline"
                >
                  Adicionar
                </Link>
              </p>
            )}
          </section>

          <Separator />

          {/* O consumo ainda vai ser definido; o espaço fica reservado. */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <SectionLabel>Consumo</SectionLabel>
              <span className="text-xs text-muted-foreground/70">
                marcado à mão por enquanto — como está o carretel agora
              </span>
            </div>
            <SpoolLevelPicker
              value={filament.spoolLevel}
              disabled={isSaving}
              onChange={(spoolLevel) => {
                if (spoolLevel !== filament.spoolLevel) {
                  applyUpdate({ spoolLevel });
                }
              }}
            />
            {isFinished && filament.finishedAt && (
              <p className="text-[12.5px] text-muted-foreground">
                Acabou em {formatDatePtBR(filament.finishedAt)}.
                {filament.availability === "AVAILABLE" &&
                  " Recomprar marca o carretel como cheio de novo."}
              </p>
            )}
          </section>
        </div>

        <aside className="flex w-full flex-col gap-6 lg:w-80 lg:flex-none">
          <section className="flex flex-col gap-3">
            <div className="flex items-center">
              <SectionLabel>Observações</SectionLabel>
              {!isAddingNote && (
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-auto"
                  onClick={() => setIsAddingNote(true)}
                >
                  <Plus />
                  Nova
                </Button>
              )}
            </div>
            {isAddingNote && (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Como a cor se comportou, defeitos, o que evitar..."
                  aria-label="Nova observação"
                  maxLength={2000}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingNote(false);
                      setNoteDraft("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!noteDraft.trim() || isSaving}
                    onClick={saveNote}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            )}
            {filament.notes.length
              ? filament.notes.map((note) => (
                  <div key={note.id} className="flex flex-col gap-1">
                    <span className="text-[11px] tabular-nums text-muted-foreground/70">
                      {formatDatePtBR(note.createdAt)}
                    </span>
                    <p className="text-[13px] leading-relaxed text-foreground/80">
                      {note.content}
                    </p>
                  </div>
                ))
              : !isAddingNote && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Nenhuma observação ainda.
                  </p>
                )}
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <SectionLabel>Sua nota</SectionLabel>
            <div className="flex items-center gap-2">
              <FilamentRatingInput
                value={filament.rating}
                size="sm"
                disabled={isSaving}
                onChange={(rating) => applyUpdate({ rating })}
              />
              <span className="font-heading text-[13px] font-medium tabular-nums">
                {filament.rating ? formatRating(filament.rating) : "sem nota"}
              </span>
            </div>
            {filament.ratingComment && (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {filament.ratingComment}
              </p>
            )}
          </section>
        </aside>
      </div>

      <FilamentRebuyDialog
        // Recria a cada compra para o preço sugerido acompanhar a faixa nova.
        key={filament.updatedAt}
        filament={filament}
        open={isRebuyDialogOpen}
        onOpenChange={setIsRebuyDialogOpen}
        onRebought={(updated) => {
          setFilament(updated);
          setIsRebuyDialogOpen(false);
        }}
      />

      <FilamentDeleteDialog
        filamentId={filament.id}
        filamentName={filament.colorName}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/filamentos")}
      />
    </div>
  );
}
