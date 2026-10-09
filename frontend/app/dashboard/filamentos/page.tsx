"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  Layers,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FilamentCard,
  OutletTag,
  formatMonthYear,
} from "@/components/filaments/filament-card";
import { FilamentRatingBadge } from "@/components/filaments/filament-rating";
import { FilamentSwatch } from "@/components/filaments/filament-swatch";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  FILAMENT_AVAILABILITY_LABELS,
  SPOOL_LEVEL_LABELS,
  FILAMENT_TYPES,
  Filament,
  SpoolLevel,
  formatPricePerKg,
  formatSpoolWeight,
  isInStock,
  getPricePerKg,
  listFilaments,
} from "@/lib/api/filament";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "inStock" | "low" | "finished";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "inStock", label: "Em estoque" },
  { value: "low", label: "Acabando" },
  { value: "finished", label: "Acabaram" },
];

type SortKey = "name" | "price" | "rating" | "recent";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Nome da cor",
  price: "Menor preço por kg",
  rating: "Melhor nota",
  recent: "Compra mais recente",
};

const SORT_CAPTIONS: Record<SortKey, string> = {
  name: "ordenado por nome",
  price: "ordenado por preço",
  rating: "ordenado por nota",
  recent: "ordenado pela última compra",
};

type ViewMode = "grid" | "list";

type FilamentRow = {
  filament: Filament;
  status: SpoolLevel;
};

function matchesStatus(status: SpoolLevel, filter: StatusFilter) {
  switch (filter) {
    case "inStock":
      return status !== "FINISHED";
    case "low":
      return status === "LOW";
    case "finished":
      return status === "FINISHED";
    default:
      return true;
  }
}

// Filamentos que acabaram vão sempre para o fim: a lista é sobre o que dá
// para usar hoje.
function compareRows(a: FilamentRow, b: FilamentRow, key: SortKey) {
  const finishedA = a.status === "FINISHED";
  const finishedB = b.status === "FINISHED";
  if (finishedA !== finishedB) return finishedA ? 1 : -1;

  const byName = a.filament.colorName.localeCompare(
    b.filament.colorName,
    "pt-BR",
  );
  switch (key) {
    case "price": {
      const priceA = getPricePerKg(a.filament)?.average ?? Infinity;
      const priceB = getPricePerKg(b.filament)?.average ?? Infinity;
      return priceA - priceB || byName;
    }
    case "rating":
      return (b.filament.rating ?? 0) - (a.filament.rating ?? 0) || byName;
    case "recent":
      return (
        (b.filament.lastPurchasedAt ?? "").localeCompare(
          a.filament.lastPurchasedAt ?? "",
        ) || byName
      );
    default:
      return byName;
  }
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

function toggle(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export default function FilamentsPage() {
  const router = useRouter();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [onlyOutlet, setOnlyOutlet] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    let ignore = false;

    async function loadFilaments() {
      try {
        const result = await listFilaments();
        if (!ignore) setFilaments(result);
      } catch (err) {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os filamentos.",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadFilaments();
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/filamentos/new" />}
      nativeButton={false}
    >
      <Plus />
      Novo filamento
    </Button>,
  );

  const rows: FilamentRow[] = filaments.map((filament) => ({
    filament,
    status: filament.spoolLevel,
  }));

  // Só aparecem os chips de tipo e marca que têm algum rolo.
  const availableTypes = FILAMENT_TYPES.filter((type) =>
    filaments.some((filament) => filament.type === type),
  );
  const availableBrands = [
    ...new Set(filaments.map((filament) => filament.brand.name)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const query = search.trim().toLowerCase();
  const visibleRows = rows
    .filter(
      ({ filament, status }) =>
        matchesStatus(status, statusFilter) &&
        filament.colorName.toLowerCase().includes(query) &&
        (typeFilter.length === 0 || typeFilter.includes(filament.type)) &&
        (brandFilter.length === 0 ||
          brandFilter.includes(filament.brand.name)) &&
        (!onlyOutlet || filament.isOutlet),
    )
    .sort((a, b) => compareRows(a, b, sortKey));

  const inStockCount = rows.filter((row) => isInStock(row.filament)).length;
  const lowCount = rows.filter((row) => row.status === "LOW").length;
  const finishedCount = rows.length - inStockCount;
  // Média do preço por kg dos filamentos que ainda estão em estoque.
  const stockPrices = rows
    .filter((row) => isInStock(row.filament))
    .map((row) => getPricePerKg(row.filament)?.average)
    .filter((price): price is number => price != null);
  const averagePricePerKg = stockPrices.length
    ? stockPrices.reduce((sum, price) => sum + price, 0) / stockPrices.length
    : null;

  const summaryStats: {
    label: string;
    value: string;
    unit?: string;
    className?: string;
  }[] = [
    { label: "Filamentos", value: String(rows.length) },
    { label: "Em estoque", value: String(inStockCount) },
    {
      label: "Acabando",
      value: String(lowCount),
      className: lowCount ? "text-brand-300" : undefined,
    },
    {
      label: "Acabaram",
      value: String(finishedCount),
      className: "text-muted-foreground",
    },
    {
      label: "Média por kg",
      value:
        averagePricePerKg != null
          ? `R$ ${Math.round(averagePricePerKg).toLocaleString("pt-BR")}`
          : "—",
    },
  ];

  function renderContent() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
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

    if (filaments.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <Layers className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhum filamento cadastrado ainda.</p>
          <Button
            size="sm"
            render={<Link href="/dashboard/filamentos/new" />}
            nativeButton={false}
          >
            <Plus />
            Novo filamento
          </Button>
        </div>
      );
    }

    if (visibleRows.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nenhum filamento encontrado com esses filtros.
          </p>
        </div>
      );
    }

    if (view === "grid") {
      return (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleRows.map(({ filament }) => (
            <FilamentCard
              key={filament.id}
              filament={filament}
              href={`/dashboard/filamentos/${filament.id}`}
            />
          ))}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader className="text-xs uppercase">
          <TableRow>
            <TableHead className="text-muted-foreground">Cor</TableHead>
            <TableHead className="text-muted-foreground">Marca</TableHead>
            <TableHead className="text-muted-foreground">Situação</TableHead>
            <TableHead className="text-right text-muted-foreground">
              Preço por kg
            </TableHead>
            <TableHead className="text-right text-muted-foreground">
              Nota
            </TableHead>
            <TableHead className="text-muted-foreground">Na marca</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map(({ filament, status }) => {
            const price = getPricePerKg(filament);
            return (
              <TableRow
                key={filament.id}
                className={cn(
                  "cursor-pointer",
                  status === "FINISHED" && "opacity-60",
                )}
                onClick={() =>
                  router.push(`/dashboard/filamentos/${filament.id}`)
                }
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <FilamentSwatch
                      colors={filament.colors}
                      compact
                      className="size-6 rounded-sm"
                    />
                    <Link
                      href={`/dashboard/filamentos/${filament.id}`}
                      className="font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {filament.colorName}
                    </Link>
                    {filament.isOutlet && <OutletTag />}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {filament.brand.name} · {filament.type}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {status === "FINISHED" && filament.finishedAt
                    ? `Acabou em ${formatMonthYear(filament.finishedAt)}`
                    : `${SPOOL_LEVEL_LABELS[status]} · ${formatSpoolWeight(filament.spoolWeightGrams)}`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {price ? formatPricePerKg(price, "") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {filament.rating ? (
                    <FilamentRatingBadge rating={filament.rating} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {FILAMENT_AVAILABILITY_LABELS[filament.availability]}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold">Filamentos</h1>
          <p className="text-sm text-muted-foreground">
            Cada cor que você já comprou, com o preço por kg e se ainda tem em
            estoque.
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por cor…"
              aria-label="Filtrar filamentos pelo nome da cor"
              className="w-56 pl-8"
            />
          </div>

          <Select
            value={sortKey}
            onValueChange={(value) => setSortKey(value as SortKey)}
          >
            <SelectTrigger
              className="w-auto gap-2"
              aria-label="Ordenar filamentos"
            >
              <ArrowDownWideNarrow
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <SelectValue>
                {(value: SortKey) => SORT_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            role="group"
            aria-label="Visualização"
            className="inline-flex rounded-md border border-border p-0.5"
          >
            {(
              [
                { value: "grid", label: "Grade", icon: LayoutGrid },
                { value: "list", label: "Lista", icon: List },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                aria-label={option.label}
                onClick={() => setView(option.value)}
                className={cn(
                  "rounded-[6px] px-2 py-1.5 transition-colors",
                  view === option.value
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-6">
        {summaryStats.map((stat, index) => (
          <div key={stat.label} className="flex items-stretch gap-6">
            {index > 0 && <Separator orientation="vertical" />}
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <span className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-heading text-3xl font-medium tabular-nums",
                    stat.className,
                  )}
                >
                  {isLoading ? "–" : stat.value}
                </span>
                {stat.unit && !isLoading && (
                  <span className="text-sm text-muted-foreground">
                    {stat.unit}
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <FilterChip
            key={filter.value}
            selected={statusFilter === filter.value}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </FilterChip>
        ))}
        {availableTypes.length > 0 && (
          <Separator orientation="vertical" className="mx-1 h-5" />
        )}
        {availableTypes.map((type) => (
          <FilterChip
            key={type}
            selected={typeFilter.includes(type)}
            onClick={() => setTypeFilter((prev) => toggle(prev, type))}
          >
            {type}
          </FilterChip>
        ))}
        {filaments.some((filament) => filament.isOutlet) && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <FilterChip
              selected={onlyOutlet}
              onClick={() => setOnlyOutlet((prev) => !prev)}
            >
              Outlet
            </FilterChip>
          </>
        )}
        {availableBrands.length > 1 && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            {availableBrands.map((brand) => (
              <FilterChip
                key={brand}
                selected={brandFilter.includes(brand)}
                onClick={() => setBrandFilter((prev) => toggle(prev, brand))}
              >
                <Package className="size-3.5" aria-hidden="true" />
                {brand}
              </FilterChip>
            ))}
          </>
        )}
        {!isLoading && filaments.length > 0 && (
          <span className="ml-auto text-[11.5px] text-muted-foreground/70">
            {visibleRows.length}{" "}
            {visibleRows.length === 1 ? "filamento" : "filamentos"} ·{" "}
            {SORT_CAPTIONS[sortKey]}
          </span>
        )}
      </div>

      {renderContent()}
    </div>
  );
}
