"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  Layers,
  NotebookPen,
  Plus,
  Search,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AttemptNumber,
  FilamentDot,
  JournalStatusBadge,
} from "@/components/journal/journal-status-badge";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  JOURNAL_STATUSES,
  JOURNAL_STATUS_LABELS,
  JournalEntry,
  JournalFilament,
  JournalStatus,
  describeFilament,
  describeOutcome,
  listJournalEntries,
} from "@/lib/api/journal";
import { cn } from "@/lib/utils";

type SortOption = "newest" | "oldest" | "attempts";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigas" },
  { value: "attempts", label: "Mais tentativas" },
];

const ALL_FILAMENTS = "all";

function compareEntries(a: JournalEntry, b: JournalEntry, sort: SortOption) {
  const byDate = b.occurredAt.localeCompare(a.occurredAt);
  switch (sort) {
    case "oldest":
      return -byDate;
    case "attempts":
      return b.attempts.length - a.attempts.length || byDate;
    default:
      return byDate;
  }
}

function stripDot(value: string) {
  return value.replace(".", "");
}

function monthLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return (label.charAt(0).toUpperCase() + label.slice(1)).replace(" de ", " ");
}

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

function toggle<T>(list: T[], value: T) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function mostProblematicFilament(entries: JournalEntry[]) {
  const counts = new Map<string, { filament: JournalFilament; count: number }>();
  for (const entry of entries) {
    if (!entry.filament) continue;
    const current = counts.get(entry.filament.id);
    counts.set(entry.filament.id, {
      filament: entry.filament,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
}

function JournalRow({ entry }: { entry: JournalEntry }) {
  const date = new Date(entry.occurredAt);
  const isResolved = entry.status === "RESOLVED";

  return (
    <Link
      href={`/dashboard/diario/${entry.id}`}
      className="group grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-border/60 py-4.5 pr-4.5 transition-colors last:border-b-0 hover:bg-foreground/[0.035] md:grid-cols-[96px_minmax(0,1fr)_210px] md:gap-x-5.5"
    >
      <div className="pt-0.5 text-right">
        <div className="font-heading text-[22px] leading-none font-medium tabular-nums">
          {String(date.getDate()).padStart(2, "0")}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {stripDot(date.toLocaleDateString("pt-BR", { month: "short" }))}
          <span className="hidden md:inline">
            {" · "}
            {stripDot(date.toLocaleDateString("pt-BR", { weekday: "short" }))}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2.25">
        <div className="flex flex-wrap items-center gap-2.25">
          <JournalStatusBadge status={entry.status} />
          <h2 className="font-heading text-base leading-tight font-medium">
            {entry.title}
          </h2>
          <span className="ml-auto -translate-x-1 text-[11px] tracking-[0.08em] text-brand uppercase opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
            abrir
          </span>
        </div>
        {entry.filament && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FilamentDot colors={entry.filament.colors} />
            {describeFilament(entry.filament)}
          </div>
        )}
        <p className="m-0 max-w-155 text-[13px] leading-relaxed text-pretty text-foreground/72">
          <span className="text-muted-foreground/80">Sintoma · </span>
          {entry.symptom}{" "}
          {entry.possibleCauses && (
            <>
              <span className="text-muted-foreground/80">Causas · </span>
              {entry.possibleCauses.charAt(0).toLowerCase() +
                entry.possibleCauses.slice(1)}
            </>
          )}
        </p>
      </div>

      <div className="col-start-2 flex flex-col gap-2 md:col-start-auto">
        <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          Tentativas
        </span>
        {entry.attempts.map((attempt, index) => {
          const worked = attempt.outcome === "WORKED";
          return (
            <div
              key={attempt.id}
              className={cn(
                "flex items-center gap-2 text-[12.5px] text-foreground/72",
                worked && "text-brand-200",
              )}
            >
              <AttemptNumber n={index + 1} worked={worked} />
              <span className="min-w-0 truncate">{attempt.description}</span>
            </div>
          );
        })}
        <span
          className={cn(
            "mt-0.5 text-[11px]",
            isResolved ? "text-brand-300" : "text-muted-foreground/70",
          )}
        >
          {describeOutcome(entry)}
        </span>
      </div>
    </Link>
  );
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JournalStatus[]>([]);
  const [filamentFilter, setFilamentFilter] = useState(ALL_FILAMENTS);
  const [sort, setSort] = useState<SortOption>("newest");

  useEffect(() => {
    let ignore = false;
    listJournalEntries()
      .then((result) => {
        if (!ignore) setEntries(result);
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o diário.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/diario/new" />}
      nativeButton={false}
    >
      <Plus />
      Nova entrada
    </Button>,
  );

  const filaments = [
    ...new Map(
      entries
        .filter((entry) => entry.filament)
        .map((entry) => [entry.filament!.id, entry.filament!]),
    ).values(),
  ].sort((a, b) => a.colorName.localeCompare(b.colorName, "pt-BR"));

  const query = search.trim().toLowerCase();
  const visibleEntries = entries
    .filter(
      (entry) =>
        !query ||
        entry.title.toLowerCase().includes(query) ||
        (entry.filament &&
          describeFilament(entry.filament).toLowerCase().includes(query)),
    )
    .filter(
      (entry) =>
        statusFilter.length === 0 || statusFilter.includes(entry.status),
    )
    .filter(
      (entry) =>
        filamentFilter === ALL_FILAMENTS ||
        entry.filament?.id === filamentFilter,
    )
    .sort((a, b) => compareEntries(a, b, sort));

  const resolvedCount = entries.filter((e) => e.status === "RESOLVED").length;
  const inProgressCount = entries.filter(
    (e) => e.status === "IN_PROGRESS",
  ).length;
  const avgAttempts = entries.length
    ? entries.reduce((sum, e) => sum + e.attempts.length, 0) / entries.length
    : 0;
  const worstFilament = mostProblematicFilament(entries);

  const summaryStats = [
    { label: "Entradas", value: String(entries.length) },
    { label: "Resolvidas", value: String(resolvedCount), accent: true },
    { label: "Em andamento", value: String(inProgressCount) },
    {
      label: "Tentativas por problema",
      value: avgAttempts.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
    },
  ];

  const selectedFilament = filaments.find((f) => f.id === filamentFilter);

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      );
    }

    if (loadError) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <NotebookPen className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nenhum problema registrado. Quando algo der errado, anote aqui.
          </p>
          <Button
            size="sm"
            render={<Link href="/dashboard/diario/new" />}
            nativeButton={false}
          >
            <Plus />
            Nova entrada
          </Button>
        </div>
      );
    }

    if (visibleEntries.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma entrada encontrada com esses filtros.</p>
        </div>
      );
    }

    // Agrupa por mês só na ordem por data; por tentativas a lista é corrida.
    const groupByMonth = sort !== "attempts";

    return (
      <div className="flex min-w-0 flex-col">
        {visibleEntries.map((entry, index) => {
          const month = monthLabel(entry.occurredAt);
          const showMonth =
            groupByMonth &&
            (index === 0 ||
              monthLabel(visibleEntries[index - 1].occurredAt) !== month);
          return (
            <Fragment key={entry.id}>
              {showMonth && (
                <div
                  className={cn(
                    "flex items-center gap-2.5 pb-2",
                    index > 0 && "pt-4.5",
                  )}
                >
                  <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    {month}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </div>
              )}
              <JournalRow entry={entry} />
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Diário</h1>
          <p className="text-sm text-muted-foreground">
            O que deu errado, o que você tentou e o que resolveu.
          </p>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por título ou filamento..."
            aria-label="Pesquisar entradas por título ou filamento"
            className="w-72 pl-8"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        {summaryStats.map((stat, index) => (
          <div key={stat.label} className="flex items-center gap-4">
            {index > 0 && <Separator orientation="vertical" className="h-10" />}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground uppercase">
                {stat.label}
              </span>
              <span className={cn("text-3xl", stat.accent && "text-brand")}>
                {isLoading ? "–" : stat.value}
              </span>
            </div>
          </div>
        ))}
        {worstFilament && !isLoading && (
          <div className="flex items-center gap-4">
            <Separator orientation="vertical" className="h-10" />
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground uppercase">
                Filamento mais problemático
              </span>
              <div className="flex items-center gap-2 pt-1.5">
                <FilamentDot colors={worstFilament.filament.colors} />
                <span className="text-[15px]">
                  {worstFilament.filament.colorName}
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  {worstFilament.count}{" "}
                  {worstFilament.count === 1 ? "entrada" : "entradas"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          Status
        </span>
        {JOURNAL_STATUSES.map((status) => (
          <FilterChip
            key={status}
            selected={statusFilter.includes(status)}
            onClick={() => setStatusFilter((prev) => toggle(prev, status))}
          >
            {JOURNAL_STATUS_LABELS[status]}
          </FilterChip>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  {selectedFilament ? (
                    <FilamentDot colors={selectedFilament.colors} />
                  ) : (
                    <Layers />
                  )}
                  {selectedFilament?.colorName ?? "Filamento"}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filtrar por filamento</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filamentFilter}
                  onValueChange={(value) => setFilamentFilter(value as string)}
                >
                  <DropdownMenuRadioItem
                    value={ALL_FILAMENTS}
                    className="data-checked:bg-brand/12 data-checked:text-brand"
                  >
                    Todos
                  </DropdownMenuRadioItem>
                  {filaments.map((f) => (
                    <DropdownMenuRadioItem
                      key={f.id}
                      value={f.id}
                      className="data-checked:bg-brand/12 data-checked:text-brand"
                    >
                      <FilamentDot colors={f.colors} />
                      {f.colorName}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <ArrowUpDown />
                  {SORT_OPTIONS.find((option) => option.value === sort)?.label}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => setSort(value as SortOption)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      className="data-checked:bg-brand/12 data-checked:text-brand"
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
