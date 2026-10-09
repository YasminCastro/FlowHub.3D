"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Package,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  BrandPricePerKg,
  CostBenefitBadge,
  BrandStatusBadge,
  FilamentTypeTags,
  describeBrandPriceSource,
} from "@/components/brands/brand-row-preview";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  Brand,
  BrandPrice,
  CostBenefit,
  FILAMENT_TYPE_OPTIONS,
  PURCHASE_CHANNEL_LABELS,
  getAveragePricePerKg,
  getBrandPrice,
  getCostBenefit,
  listBrands,
  updateBrand,
} from "@/lib/api/brand";
import { Filament, listFilaments } from "@/lib/api/filament";
import { cn, formatBRL } from "@/lib/utils";

type ViewFilter = "all" | "favorites" | "purchased" | "researched";

const VIEW_FILTERS: { value: ViewFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "favorites", label: "Favoritas" },
  { value: "purchased", label: "Já comprei" },
  { value: "researched", label: "Só pesquisei" },
];

const TYPE_FILTERS = FILAMENT_TYPE_OPTIONS.filter((type) => type !== "Resina");

type SortKey = "name" | "price" | "cost" | "rating";
type SortDirection = "asc" | "desc";

const COST_BENEFIT_ORDER: Record<CostBenefit, number> = {
  GOOD: 0,
  MODERATE: 1,
  HIGH: 2,
};

type BrandRow = {
  brand: Brand;
  price: BrandPrice | null;
  costBenefit: CostBenefit | null;
};

// Valor usado na ordenação; null = sem dado, sempre vai para o fim da lista.
function sortValue(row: BrandRow, key: SortKey): number | null {
  switch (key) {
    case "price":
      return row.price?.average ?? null;
    case "cost":
      return row.costBenefit ? COST_BENEFIT_ORDER[row.costBenefit] : null;
    case "rating":
      // A avaliação sai dos rolos, que ainda não existem no app.
      return null;
    default:
      return null;
  }
}

function compareRows(
  a: BrandRow,
  b: BrandRow,
  key: SortKey,
  direction: SortDirection,
) {
  const byName = a.brand.name.localeCompare(b.brand.name, "pt-BR");
  if (key === "name") return direction === "asc" ? byName : -byName;

  const valueA = sortValue(a, key);
  const valueB = sortValue(b, key);
  if (valueA == null && valueB == null) return byName;
  if (valueA == null) return 1;
  if (valueB == null) return -1;
  if (valueA !== valueB) {
    return direction === "asc" ? valueA - valueB : valueB - valueA;
  }
  // Mesmo custo: desempata pelo preço, depois pelo nome.
  const priceA = a.price?.average ?? 0;
  const priceB = b.price?.average ?? 0;
  return priceA !== priceB ? priceA - priceB : byName;
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  const Icon = !isActive
    ? ArrowUpDown
    : direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead
      className={cn("text-muted-foreground", align === "right" && "text-right")}
      aria-sort={
        isActive ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground",
          isActive && "text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn("size-3.5", !isActive && "opacity-40")}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

function matchesView(brand: Brand, view: ViewFilter) {
  switch (view) {
    case "favorites":
      return brand.isFavorite;
    case "purchased":
      return brand.status === "PURCHASED";
    case "researched":
      return brand.status === "RESEARCHED";
    default:
      return true;
  }
}

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Clicar na coluna ativa inverte a direção; numa nova, começa crescente.
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadBrands() {
      try {
        // O preço por kg de cada marca sai dos filamentos cadastrados dela.
        const [active, allFilaments] = await Promise.all([
          listBrands(),
          listFilaments(),
        ]);
        if (ignore) return;
        setBrands(active);
        setFilaments(allFilaments);
      } catch (err) {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar as marcas.",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadBrands();
    return () => {
      ignore = true;
    };
  }, []);

  async function toggleFavorite(brand: Brand) {
    setActionError(null);
    try {
      const updated = await updateBrand(brand.id, {
        isFavorite: !brand.isFavorite,
      });
      setBrands((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar a marca.",
      );
    }
  }

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/marcas/new" />}
      nativeButton={false}
    >
      <Plus />
      Nova marca
    </Button>,
  );

  // A média usa todas as marcas ativas, não só as que passam nos filtros.
  const priceByBrand = new Map(
    brands.map((brand) => [brand.id, getBrandPrice(brand, filaments)]),
  );
  const averagePricePerKg = getAveragePricePerKg(
    [...priceByBrand.values()].map((price) => price?.average),
  );
  const query = search.trim().toLowerCase();
  const visibleBrands: BrandRow[] = brands
    .filter(
      (brand) =>
        matchesView(brand, view) &&
        brand.name.toLowerCase().includes(query) &&
        typeFilter.every((type) => brand.filamentTypes.includes(type)),
    )
    .map((brand) => {
      const price = priceByBrand.get(brand.id) ?? null;
      return {
        brand,
        price,
        costBenefit: getCostBenefit(price?.average, averagePricePerKg),
      };
    })
    .sort((a, b) => compareRows(a, b, sortKey, sortDirection));

  // "Só pesquisei" é a marca da qual nunca se comprou um rolo.
  const withoutPurchaseCount = brands.filter(
    (brand) => brand.status === "RESEARCHED",
  ).length;

  const pricedBrands = brands
    .map((brand) => ({ brand, price: priceByBrand.get(brand.id) ?? null }))
    .filter(
      (item): item is { brand: Brand; price: BrandPrice } =>
        item.price !== null,
    )
    .sort((a, b) => a.price.average - b.price.average);
  const cheapest = pricedBrands[0];
  const mostExpensive =
    pricedBrands.length > 1 ? pricedBrands[pricedBrands.length - 1] : undefined;

  function priceStat(
    label: string,
    item: { brand: Brand; price: BrandPrice } | undefined,
  ) {
    return item
      ? {
          label,
          value: formatBRL(item.price.average),
          caption: `${item.brand.name} · ${describeBrandPriceSource(item.price)}`,
        }
      : { label, value: "—", caption: "sem preço cadastrado" };
  }

  const summaryStats: { label: string; value: string; caption?: string }[] = [
    { label: "Marcas", value: String(brands.length) },
    priceStat("Mais barata por kg", cheapest),
    priceStat("Mais cara por kg", mostExpensive),
    { label: "Sem nenhuma compra", value: String(withoutPurchaseCount) },
  ];

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
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

    if (brands.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <Package className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma marca cadastrada ainda.</p>
          <Button
            size="sm"
            render={<Link href="/dashboard/marcas/new" />}
            nativeButton={false}
          >
            <Plus />
            Nova marca
          </Button>
        </div>
      );
    }

    if (visibleBrands.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma marca encontrada com esses filtros.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader className="text-xs uppercase">
          <TableRow>
            <SortableHead
              label="Marca"
              sortKey="name"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <TableHead className="text-muted-foreground">Tipos</TableHead>
            <TableHead className="text-muted-foreground">Onde compra</TableHead>
            <SortableHead
              label="Preço por kg"
              sortKey="price"
              activeKey={sortKey}
              direction={sortDirection}
              align="right"
              onSort={handleSort}
            />
            <SortableHead
              label="Custo"
              sortKey="cost"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHead
              label="Avaliação"
              sortKey="rating"
              activeKey={sortKey}
              direction={sortDirection}
              align="right"
              onSort={handleSort}
            />
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleBrands.map(({ brand, price, costBenefit }) => (
            <TableRow
              key={brand.id}
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/marcas/${brand.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/marcas/${brand.id}`}
                    className="font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {brand.name}
                  </Link>
                  <BrandStatusBadge status={brand.status} />
                </div>
              </TableCell>
              <TableCell>
                <FilamentTypeTags types={brand.filamentTypes} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {brand.purchaseChannels.length
                  ? brand.purchaseChannels
                      .map((channel) => PURCHASE_CHANNEL_LABELS[channel])
                      .join(", ")
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <BrandPricePerKg price={price} align="right" />
              </TableCell>
              <TableCell>
                <CostBenefitBadge costBenefit={costBenefit} />
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                sem uso
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    brand.isFavorite
                      ? `Remover ${brand.name} das favoritas`
                      : `Marcar ${brand.name} como favorita`
                  }
                  aria-pressed={brand.isFavorite}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(brand);
                  }}
                >
                  <Star
                    className={cn(
                      brand.isFavorite
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground",
                    )}
                  />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Marcas</h1>
          <p className="text-sm text-muted-foreground">
            Onde você compra filamento, o que cada marca cobra e como ela se
            comportou na impressora.
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
            placeholder="Buscar marca..."
            aria-label="Buscar marca por nome"
            className="w-64 pl-8"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {summaryStats.map((stat, index) => (
          <div key={stat.label} className="flex items-center gap-4">
            {index > 0 && <Separator orientation="vertical" className="h-10" />}
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-3xl">{isLoading ? "–" : stat.value}</span>
              {stat.caption && !isLoading && (
                <span className="text-xs text-muted-foreground">
                  {stat.caption}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        {VIEW_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={view === filter.value}
            onClick={() => setView(filter.value)}
            className={cn(
              "rounded-md border px-3 py-1 text-xs transition-colors",
              view === filter.value
                ? "border-brand bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        ))}
        <Separator orientation="vertical" className="mx-1 h-5" />
        {TYPE_FILTERS.map((type) => {
          const selected = typeFilter.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setTypeFilter((prev) =>
                  selected
                    ? prev.filter((item) => item !== type)
                    : [...prev, type],
                )
              }
              className={cn(
                "rounded-md border px-3 py-1 text-xs transition-colors",
                selected
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {type}
            </button>
          );
        })}
      </div>

      {actionError && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {actionError}
        </p>
      )}

      {renderContent()}
    </div>
  );
}
