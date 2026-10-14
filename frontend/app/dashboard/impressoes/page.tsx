"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  ImagesIcon,
  ListOrdered,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { PrintCard } from "@/components/prints/print-card";
import { Stat, StatDivider } from "@/components/prints/print-bits";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import {
  PrintItem,
  getItemStats,
  getLostCost,
  listPrintItems,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

type SortOption = "recent" | "units" | "name";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "units", label: "Mais impressas" },
  { value: "name", label: "Nome (A–Z)" },
];

const ALL_CATEGORIES = "all";
const RECENT_FAILURE_DAYS = 30;

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

function compareItems(a: PrintItem, b: PrintItem, sort: SortOption) {
  const sa = getItemStats(a);
  const sb = getItemStats(b);
  const byDate = (sb.lastPrintedAt ?? "").localeCompare(sa.lastPrintedAt ?? "");
  switch (sort) {
    case "units":
      return sb.units - sa.units || byDate;
    case "name":
      return a.name.localeCompare(b.name, "pt-BR");
    default:
      return byDate;
  }
}

function isThisMonth(iso: string, now: Date) {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function hasRecentFailure(item: PrintItem, now: Date) {
  const last = getItemStats(item).lastFailureAt;
  if (!last) return false;
  const days = (now.getTime() - new Date(last).getTime()) / 86_400_000;
  return days <= RECENT_FAILURE_DAYS;
}

export default function PrintsPage() {
  const [items, setItems] = useState<PrintItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const { costs, loadError: costsError } = useCostContext();
  const loadError = itemsError ?? costsError;
  const isLoading = isLoadingItems || (!costs && !loadError);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [onlyRecentFailure, setOnlyRecentFailure] = useState(false);
  const [sort, setSort] = useState<SortOption>("recent");

  useEffect(() => {
    let ignore = false;
    listPrintItems()
      .then((result) => {
        if (!ignore) setItems(result);
      })
      .catch((err) => {
        if (ignore) return;
        setItemsError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar as impressões.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoadingItems(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled
        title="A fila de impressão ainda não existe"
      >
        <ListOrdered />
        Adicionar à fila
      </Button>
      <Button
        size="sm"
        render={<Link href="/dashboard/impressoes/new" />}
        nativeButton={false}
      >
        <Plus />
        Nova impressão
      </Button>
    </>,
  );

  const now = new Date();
  const categories = [
    ...new Map(
      items.flatMap((item) =>
        item.category ? [[item.category.id, item.category] as const] : [],
      ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const query = search.trim().toLowerCase();
  const visibleItems = items
    .filter((item) => !query || item.name.toLowerCase().includes(query))
    .filter(
      (item) =>
        categoryFilter === ALL_CATEGORIES ||
        item.category?.id === categoryFilter,
    )
    .filter((item) => !onlyRecentFailure || hasRecentFailure(item, now))
    .sort((a, b) => compareItems(a, b, sort));

  const records = items.flatMap((item) => item.records);
  const monthRecords = records.filter((r) => isThisMonth(r.printedAt, now));
  const monthUnits = monthRecords
    .filter((r) => r.outcome === "SUCCESS")
    .reduce((sum, r) => sum + r.units, 0);
  const lost = costs ? getLostCost(records, costs) : 0;

  const summaryStats = [
    { label: "Itens", value: String(items.length) },
    { label: "Registros no mês", value: String(monthRecords.length) },
    { label: "Unidades no mês", value: String(monthUnits) },
    { label: "Perdido em falhas", value: formatBRL(lost), danger: lost > 0 },
  ];

  function renderContent() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      );
    }

    if (loadError || !costs) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ImagesIcon className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nenhuma impressão ainda. Cadastre a primeira peça que saiu da
            impressora.
          </p>
          <Button
            size="sm"
            render={<Link href="/dashboard/impressoes/new" />}
            nativeButton={false}
          >
            <Plus />
            Nova impressão
          </Button>
        </div>
      );
    }

    if (visibleItems.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nenhuma impressão encontrada com esses filtros.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <PrintCard key={item.id} item={item} costs={costs} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Impressões</h1>
          <p className="text-sm text-muted-foreground">
            Um item por peça. Imprimir de novo adiciona um registro dentro dele.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar impressão..."
              aria-label="Buscar impressão pelo nome"
              className="w-60 pl-8"
            />
          </div>
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

      <div className="flex flex-wrap items-stretch gap-6.5">
        {summaryStats.map((stat, index) => (
          <div key={stat.label} className="flex items-stretch gap-6.5">
            {index > 0 && <StatDivider />}
            <Stat
              label={stat.label}
              value={isLoading ? "–" : stat.value}
              size="lg"
              danger={stat.danger}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.75">
        <FilterChip
          selected={categoryFilter === ALL_CATEGORIES}
          onClick={() => setCategoryFilter(ALL_CATEGORIES)}
        >
          Todas
        </FilterChip>
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            selected={categoryFilter === category.id}
            onClick={() =>
              setCategoryFilter((prev) =>
                prev === category.id ? ALL_CATEGORIES : category.id,
              )
            }
          >
            {category.name}
          </FilterChip>
        ))}
        <span className="mx-1 h-4.5 w-px bg-border" aria-hidden="true" />
        <FilterChip
          selected={onlyRecentFailure}
          onClick={() => setOnlyRecentFailure((prev) => !prev)}
        >
          <TriangleAlert className="size-3.25" aria-hidden="true" />
          Com falha recente
        </FilterChip>
      </div>

      {renderContent()}

      {!isLoading && visibleItems.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground/80">
          O valor no card é o custo por unidade do registro padrão. O preço de
          venda fica no Catálogo.
        </p>
      )}
    </div>
  );
}
