"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
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
import { ExtraItemDeleteDialog } from "@/components/extra-items/extra-item-delete-dialog";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  ExtraItem,
  formatUnits,
  getUnitCost,
  listExtraItems,
} from "@/lib/api/extra-item";
import { formatBRL } from "@/lib/utils";

type SortOption = "name" | "unitCost";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "unitCost", label: "Custo unitário" },
];

function compareItems(a: ExtraItem, b: ExtraItem, sort: SortOption) {
  const byName = a.name.localeCompare(b.name, "pt-BR");
  switch (sort) {
    case "unitCost":
      return getUnitCost(b) - getUnitCost(a) || byName;
    default:
      return byName;
  }
}

export default function ExtraItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [itemToDelete, setItemToDelete] = useState<ExtraItem | null>(null);

  useEffect(() => {
    let ignore = false;
    listExtraItems()
      .then((result) => {
        if (!ignore) setItems(result);
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os itens extras.",
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
      render={<Link href="/dashboard/itens-extras/new" />}
      nativeButton={false}
    >
      <Plus />
      Novo item extra
    </Button>,
  );

  const query = search.trim().toLowerCase();
  const visibleItems = items
    .filter((item) => item.name.toLowerCase().includes(query))
    .sort((a, b) => compareItems(a, b, sort));

  const totalInvested = items.reduce(
    (sum, item) => sum + item.totalInvested,
    0,
  );

  const summaryStats: {
    label: string;
    value: string;
    caption?: string;
  }[] = [
    { label: "Itens", value: String(items.length) },
    { label: "Investido em lotes", value: formatBRL(totalInvested) },
    {
      label: "Lotes comprados",
      value: String(items.reduce((sum, item) => sum + item.lotCount, 0)),
    },
  ];

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
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
          <ShoppingBag className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhum item extra cadastrado ainda.</p>
          <Button
            size="sm"
            render={<Link href="/dashboard/itens-extras/new" />}
            nativeButton={false}
          >
            <Plus />
            Novo item extra
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
      <Table>
        <TableHeader className="text-xs uppercase">
          <TableRow>
            <TableHead className="text-muted-foreground">Item</TableHead>
            <TableHead className="text-muted-foreground">
              Lote comprado
            </TableHead>
            <TableHead className="text-right text-muted-foreground">
              Custo unitário
            </TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleItems.map((item) => {
            return (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/itens-extras/${item.id}`)}
              >
                <TableCell>
                  <Link
                    href={`/dashboard/itens-extras/${item.id}`}
                    className="text-sm hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-[12.5px] text-muted-foreground tabular-nums">
                  {item.lotCount
                    ? `${formatBRL(item.lotPrice)} · ${formatUnits(item.lotQuantity)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-heading text-sm font-medium tabular-nums">
                  {item.lotCount ? formatBRL(getUnitCost(item)) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Editar ${item.name}`}
                      render={
                        <Link
                          href={`/dashboard/itens-extras/${item.id}/edit`}
                        />
                      }
                      nativeButton={false}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Excluir ${item.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Itens extras</h1>
          <p className="text-sm text-muted-foreground">
            Argolas, ímãs, embalagens — o que entra na peça além do filamento.
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
              placeholder="Filtrar itens..."
              aria-label="Filtrar itens por nome"
              className="w-56 pl-8"
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

      <div className="flex flex-wrap items-center gap-4">
        {summaryStats.map((stat, index) => (
          <div key={stat.label} className="flex items-center gap-4">
            {index > 0 && <Separator orientation="vertical" className="h-10" />}
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase text-muted-foreground">
                {stat.label}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl">
                  {isLoading ? "–" : stat.value}
                </span>
                {stat.caption && !isLoading && (
                  <span className="text-xs text-muted-foreground">
                    {stat.caption}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {renderContent()}

      {itemToDelete && (
        <ExtraItemDeleteDialog
          itemId={itemToDelete.id}
          itemName={itemToDelete.name}
          open
          onOpenChange={(open) => {
            if (!open) setItemToDelete(null);
          }}
          onDeleted={() => {
            setItems((prev) =>
              prev.filter((item) => item.id !== itemToDelete.id),
            );
            setItemToDelete(null);
          }}
        />
      )}
    </div>
  );
}
