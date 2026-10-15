"use client";

import Link from "next/link";
import { Plus, Search, Store, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogCard } from "@/components/catalog/catalog-card";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { useCatalogData } from "@/hooks/use-catalog-data";
import { ApiError } from "@/lib/api/auth";
import {
  CatalogItem,
  CatalogKind,
  listCatalogItems,
  resolveCatalogItem,
} from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "all";

const KIND_FILTERS: { value: CatalogKind; label: string }[] = [
  { value: "KIT", label: "Kits" },
  { value: "SIZES", label: "Com tamanhos" },
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

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const {
    data,
    isLoading: isLoadingData,
    loadError: dataError,
  } = useCatalogData();
  const loadError = itemsError ?? dataError;
  const isLoading = isLoadingItems || isLoadingData;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [kindFilter, setKindFilter] = useState<CatalogKind | null>(null);
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  useEffect(() => {
    let ignore = false;
    listCatalogItems()
      .then((result) => {
        if (!ignore) setItems(result);
      })
      .catch((err) => {
        if (ignore) return;
        setItemsError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o catálogo.",
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
    <Button
      size="sm"
      render={<Link href="/dashboard/catalogo/new" />}
      nativeButton={false}
    >
      <Plus />
      Novo item
    </Button>,
  );

  const resolved = data
    ? items.map((item) =>
        resolveCatalogItem(item, data.prints, data.filaments, data.costs),
      )
    : [];

  const categories = [
    ...new Map(
      items.flatMap((item) =>
        item.category ? [[item.category.id, item.category] as const] : [],
      ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const query = search.trim().toLowerCase();
  const visibleItems = resolved
    .filter((item) => !query || item.name.toLowerCase().includes(query))
    .filter(
      (item) =>
        categoryFilter === ALL_CATEGORIES ||
        item.category?.id === categoryFilter,
    )
    .filter((item) => !kindFilter || item.kind === kindFilter)
    .filter((item) => !onlyLowStock || item.colors.some((c) => c.low))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

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

    if (loadError) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Store className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nada no catálogo ainda. Escolha uma impressão e dê um preço.
          </p>
          <Button
            size="sm"
            render={<Link href="/dashboard/catalogo/new" />}
            nativeButton={false}
          >
            <Plus />
            Novo item
          </Button>
        </div>
      );
    }

    if (visibleItems.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhum item encontrado com esses filtros.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <CatalogCard key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            O que você vende: foto, preço e as cores que tem em estoque agora.
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
            placeholder="Buscar no catálogo..."
            aria-label="Buscar no catálogo pelo nome"
            className="w-60 pl-8"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.75">
        <FilterChip
          selected={categoryFilter === ALL_CATEGORIES}
          onClick={() => setCategoryFilter(ALL_CATEGORIES)}
        >
          Todos
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
        {KIND_FILTERS.map((option) => (
          <FilterChip
            key={option.value}
            selected={kindFilter === option.value}
            onClick={() =>
              setKindFilter((prev) =>
                prev === option.value ? null : option.value,
              )
            }
          >
            {option.label}
          </FilterChip>
        ))}
        <FilterChip
          selected={onlyLowStock}
          onClick={() => setOnlyLowStock((prev) => !prev)}
        >
          <TriangleAlert className="size-3.25" aria-hidden="true" />
          Pouco filamento
        </FilterChip>
      </div>

      {renderContent()}

      {!isLoading && visibleItems.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground/80">
          Uma cor some do card quando o rolo acaba. Só contam rolos do mesmo
          material do registro padrão.
        </p>
      )}
    </div>
  );
}
