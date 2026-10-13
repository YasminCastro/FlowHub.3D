"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  ImageIcon,
  Lightbulb,
  NotebookText,
  Pencil,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { JournalDeleteDialog } from "@/components/journal/journal-delete-dialog";
import { JournalSimilarEntries } from "@/components/journal/journal-similar-entries";
import {
  AttemptNumber,
  FilamentDot,
  JournalStatusBadge,
} from "@/components/journal/journal-status-badge";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useJournalEntry } from "@/hooks/use-journal-entry";
import {
  JournalAttempt,
  JournalEntry,
  findSimilarEntries,
  formatDays,
  formatOrdinal,
  getDaysToResolve,
  getWinningAttemptIndex,
  journalPhotoSrc,
  listJournalEntries,
} from "@/lib/api/journal";
import { cn, formatDatePtBR } from "@/lib/utils";

function SectionLabel({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.75 text-muted-foreground">
      {icon}
      <span className="text-[10px] tracking-[0.12em] uppercase">
        {children}
      </span>
    </div>
  );
}

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-[12.5px] last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function OutcomeLabel({ attempt }: { attempt: JournalAttempt }) {
  if (attempt.outcome === "WORKED") {
    return (
      <span className="inline-flex items-center gap-1.25 text-[11px] text-brand">
        <ThumbsUp className="size-3 fill-current" aria-hidden="true" />
        resolveu
      </span>
    );
  }
  if (attempt.outcome === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1.25 text-[11px] text-[#e07a7a]">
        <ThumbsDown className="size-3" aria-hidden="true" />
        não resolveu
      </span>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground">aguardando resultado</span>
  );
}

function AttemptTrail({ attempts }: { attempts: JournalAttempt[] }) {
  return (
    <div className="flex flex-col">
      {attempts.map((attempt, index) => {
        const worked = attempt.outcome === "WORKED";
        const isLast = index === attempts.length - 1;
        const date = formatDatePtBR(attempt.triedAt, {
          day: "2-digit",
          month: "2-digit",
        });
        return (
          <div
            key={attempt.id}
            className="grid grid-cols-[19px_minmax(0,1fr)] gap-3.5"
          >
            <div className="flex flex-col items-center gap-1">
              <AttemptNumber n={index + 1} worked={worked} />
              {!isLast && <span className="w-px flex-1 bg-neutral-800" />}
            </div>
            <div
              className={cn(
                worked
                  ? "mb-4 rounded-md bg-brand/10 px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--brand-700)]"
                  : "pb-4",
              )}
            >
              <div className="mb-1.25 flex flex-wrap items-center gap-2.25">
                <span
                  className={cn("text-sm", worked && "text-brand-200")}
                >
                  {attempt.description}
                </span>
                <OutcomeLabel attempt={attempt} />
              </div>
              <div className="text-[11.5px] text-muted-foreground/80">
                {date}
                {attempt.note && ` · ${attempt.note}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function describeResolution(entry: JournalEntry) {
  const winnerIndex = getWinningAttemptIndex(entry);
  const date = formatDatePtBR(entry.occurredAt);
  if (winnerIndex < 0) return date;
  const days = getDaysToResolve(entry) ?? 0;
  const when = days === 0 ? "no mesmo dia" : `em ${formatDays(days)}`;
  return `${date} · resolvido ${when}, na ${formatOrdinal(winnerIndex + 1)} tentativa`;
}

export default function JournalEntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { entry, isLoading, loadError } = useJournalEntry(params.id);
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    listJournalEntries()
      .then(setAllEntries)
      .catch(() => setAllEntries([]));
  }, []);

  usePageHeaderBreadcrumb(
    entry ? (
      <>
        <Link
          href="/dashboard/diario"
          className="text-muted-foreground hover:text-foreground"
        >
          Diário
        </Link>
        <ChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="max-w-80 truncate font-medium">{entry.title}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    entry ? (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/diario/${entry.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label="Excluir entrada"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>
    ) : null,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError || !entry) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Entrada não encontrada."}
        </p>
      </div>
    );
  }

  const winnerIndex = getWinningAttemptIndex(entry);
  const daysToResolve = getDaysToResolve(entry);
  const similar = findSimilarEntries(allEntries, {
    id: entry.id,
    filamentId: entry.filament?.id ?? null,
  });
  const iconClass = "size-3.5";

  return (
    <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <div className="mb-2.75 flex flex-wrap items-center gap-2.5">
            <JournalStatusBadge status={entry.status} />
            <span className="text-[11.5px] text-muted-foreground">
              {describeResolution(entry)}
            </span>
          </div>
          <h1 className="max-w-160 text-4xl leading-tight font-bold text-pretty">
            {entry.title}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6.5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <SectionLabel icon={<Stethoscope className={iconClass} />}>
              Sintoma
            </SectionLabel>
            <p className="text-[13.5px] leading-relaxed text-pretty text-foreground/78">
              {entry.symptom}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <SectionLabel icon={<Lightbulb className={iconClass} />}>
              Possíveis causas
            </SectionLabel>
            <p className="text-[13.5px] leading-relaxed text-pretty text-foreground/78">
              {entry.possibleCauses || "—"}
            </p>
          </div>
        </div>

        <Separator />

        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline gap-2.25">
            <SectionLabel>O que foi testado</SectionLabel>
            <span className="text-[10.5px] text-muted-foreground/70">
              {entry.attempts.length}{" "}
              {entry.attempts.length === 1 ? "tentativa" : "tentativas"}
            </span>
          </div>
          {entry.attempts.length ? (
            <AttemptTrail attempts={entry.attempts} />
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Nenhuma tentativa registrada ainda.
            </p>
          )}
        </section>

        {entry.notes && (
          <>
            <Separator />
            <section className="flex flex-col gap-2">
              <SectionLabel icon={<NotebookText className={iconClass} />}>
                Notas
              </SectionLabel>
              <p className="max-w-170 text-[13.5px] leading-relaxed text-pretty text-foreground/72">
                {entry.notes}
              </p>
            </section>
          </>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4.5 lg:border-l lg:pl-6">
        <section>
          <div className="mb-2.75">
            <SectionLabel>Ficha</SectionLabel>
          </div>
          <FactRow label="Data">{formatDatePtBR(entry.occurredAt)}</FactRow>
          <FactRow label="Filamento">
            {entry.filament ? (
              <span className="inline-flex items-center gap-1.75">
                <FilamentDot colors={entry.filament.colors} />
                {entry.filament.colorName}
              </span>
            ) : (
              "—"
            )}
          </FactRow>
          {entry.filament && (
            <FactRow label="Material">
              {entry.filament.type} · {entry.filament.brandName}
            </FactRow>
          )}
          <FactRow label="Tentativas">
            {entry.attempts.length}
            {winnerIndex >= 0 &&
              ` · resolveu na ${formatOrdinal(winnerIndex + 1)}`}
          </FactRow>
          <FactRow label="Tempo até resolver">
            {daysToResolve != null ? formatDays(daysToResolve) : "—"}
          </FactRow>
        </section>

        <section>
          <div className="mb-2.5">
            <SectionLabel>Fotos</SectionLabel>
          </div>
          {entry.photos.length ? (
            <div className="grid grid-cols-2 gap-2">
              {entry.photos.map((photo, index) => (
                <a
                  key={photo.id}
                  href={journalPhotoSrc(photo)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir foto ${index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={journalPhotoSrc(photo)}
                    alt=""
                    className="h-24 w-full rounded-sm object-cover transition-opacity hover:opacity-80"
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed border-border text-muted-foreground">
              <ImageIcon className="size-4.5" aria-hidden="true" />
              <span className="text-[11.5px]">Sem fotos</span>
            </div>
          )}
        </section>

        <Separator />

        <JournalSimilarEntries entries={similar} />
      </aside>

      <JournalDeleteDialog
        entryId={entry.id}
        entryTitle={entry.title}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/diario")}
      />
    </div>
  );
}
