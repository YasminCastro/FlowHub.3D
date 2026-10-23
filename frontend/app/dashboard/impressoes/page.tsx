"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ImagesIcon,
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
import { useStoredState } from "@/hooks/use-stored-state";
import { ApiError } from "@/lib/api/auth";
import {
  PrintItemsPage,
  PrintPageSort,
  PrintSummary,
  getLostCost,
  getPrintSummary,
  listPrintItemsPage,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

const SORT_OPTIONS: { value: PrintPageSort; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigas" },
  { value: "units", label: "Mais impressas" },
  { value: "name", label: "Nome (A–Z)" },
  { value: "name-desc", label: "Nome (Z–A)" },
];

const ALL_CATEGORIES = "all";
// Múltiplo de 2, 3 e 4: fecha as linhas da grade em qualquer largura.
const PAGE_SIZE = 24;
// Espera parar de digitar antes de buscar no servidor.
const SEARCH_DELAY_MS = 300;

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

// Primeira, última e as vizinhas da atual; o resto vira "…".
function pageNumbers(page: number, totalPages: number) {
  const pages: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - page) <= 1) {
      pages.push(n);
    } else if (pages.at(-1) !== "gap") {
      pages.push("gap");
    }
  }
  return pages;
}

function Pagination({
  result,
  onPageChange,
}: {
  result: PrintItemsPage;
  onPageChange: (page: number) => void;
}) {
  const { page, pageSize, total, totalPages } = result;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Paginação das impressões"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted-foreground">
        {first}–{last} de {total}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          {pageNumbers(page, totalPages).map((n, index) =>
            n === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={n}
                variant={n === page ? "default" : "ghost"}
                size="icon-sm"
                aria-current={n === page ? "page" : undefined}
                aria-label={`Página ${n}`}
                onClick={() => onPageChange(n)}
              >
                {n}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  );
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export default function PrintsPage() {
  const { costs, loadError: costsError } = useCostContext();
  // Os filtros ficam salvos no navegador: voltam iguais ao atualizar a página.
  const [search, setSearch] = useStoredState("impressoes:search", "");
  const [storedCategory, setCategoryFilter] = useStoredState(
    "impressoes:category",
    ALL_CATEGORIES,
  );
  const [onlyRecentFailure, setOnlyRecentFailure] = useStoredState(
    "impressoes:recentFailure",
    false,
  );
  const [storedSort, setSort] = useStoredState<PrintPageSort>(
    "impressoes:sort",
    "recent",
  );
  const [page, setPage] = useStoredState("impressoes:page", 1);
  // Valor salvo que deixou de valer (opção removida) volta ao padrão.
  const sort = SORT_OPTIONS.some((option) => option.value === storedSort)
    ? storedSort
    : "recent";

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const [summary, setSummary] = useState<PrintSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    getPrintSummary()
      .then((result) => {
        if (!ignore) setSummary(result);
      })
      .catch((err) => {
        if (!ignore) {
          setSummaryError(
            errorMessage(err, "Não foi possível carregar as impressões."),
          );
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Categoria salva que não tem mais peças (ou foi excluída) mostra todas.
  const categories = summary?.categories ?? [];
  const categoryFilter =
    !summary || categories.some((c) => c.id === storedCategory)
      ? storedCategory
      : ALL_CATEGORIES;

  // A resposta guarda a consulta que a gerou: enquanto não bate com os filtros
  // atuais, a grade mostra a anterior esmaecida.
  const queryKey = JSON.stringify([
    page,
    sort,
    debouncedSearch.trim(),
    categoryFilter,
    onlyRecentFailure,
  ]);
  const [loaded, setLoaded] = useState<{
    key: string;
    result?: PrintItemsPage;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let ignore = false;
    listPrintItemsPage({
      page,
      pageSize: PAGE_SIZE,
      sort,
      search: debouncedSearch,
      categoryId:
        categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter,
      recentFailure: onlyRecentFailure,
    })
      .then((result) => {
        if (ignore) return;
        setLoaded({ key: queryKey, result });
        // A página pedida deixou de existir: o servidor mandou a última.
        if (result.page !== page) setPage(result.page);
      })
      .catch((err) => {
        if (ignore) return;
        setLoaded({
          key: queryKey,
          error: errorMessage(err, "Não foi possível carregar as impressões."),
        });
      });
    return () => {
      ignore = true;
    };
    // queryKey resume todas as entradas da consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/impressoes/new" />}
      nativeButton={false}
    >
      <Plus />
      Nova impressão
    </Button>,
  );

  const result = loaded?.result;
  const isFetching =
    loaded?.key !== queryKey || search.trim() !== debouncedSearch.trim();
  const loadError = summaryError ?? costsError ?? loaded?.error ?? null;
  const isLoading = (!result || !summary || !costs) && !loadError;

  // Mudar qualquer filtro volta para a primeira página.
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function goToPage(next: number) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const lost = summary && costs ? getLostCost(summary.failures, costs) : 0;
  const summaryStats = [
    { label: "Itens", value: String(summary?.itemCount ?? 0) },
    {
      label: "Registros no último mês",
      value: String(summary?.monthRecords ?? 0),
    },
    {
      label: "Unidades no último mês",
      value: String(summary?.monthUnits ?? 0),
    },
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

    if (loadError || !costs || !summary || !result) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      );
    }

    if (summary.itemCount === 0) {
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

    if (result.items.length === 0) {
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
      <div
        aria-busy={isFetching}
        className={cn(
          "flex flex-col gap-4 transition-opacity",
          isFetching && "opacity-60",
        )}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((item) => (
            <PrintCard key={item.id} item={item} costs={costs} />
          ))}
        </div>
        <Pagination result={result} onPageChange={goToPage} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Impressões</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => changeFilter(() => setSearch(e.target.value))}
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
                  onValueChange={(value) =>
                    changeFilter(() => setSort(value as PrintPageSort))
                  }
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
              value={!summary || !costs ? "–" : stat.value}
              size="lg"
              danger={stat.danger}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.75">
        <FilterChip
          selected={categoryFilter === ALL_CATEGORIES}
          onClick={() => changeFilter(() => setCategoryFilter(ALL_CATEGORIES))}
        >
          Todas
        </FilterChip>
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            selected={categoryFilter === category.id}
            onClick={() =>
              changeFilter(() =>
                setCategoryFilter((prev) =>
                  prev === category.id ? ALL_CATEGORIES : category.id,
                ),
              )
            }
          >
            {category.name}
          </FilterChip>
        ))}
        <span className="mx-1 h-4.5 w-px bg-border" aria-hidden="true" />
        <FilterChip
          selected={onlyRecentFailure}
          onClick={() =>
            changeFilter(() => setOnlyRecentFailure((prev) => !prev))
          }
        >
          <TriangleAlert className="size-3.25" aria-hidden="true" />
          Com falha recente
        </FilterChip>
      </div>

      {renderContent()}
    </div>
  );
}
