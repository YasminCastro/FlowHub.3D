"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ExtraItemDeleteDialog } from "@/components/extra-items/extra-item-delete-dialog";
import { ExtraItemLotDialog } from "@/components/extra-items/extra-item-lot-dialog";
import { ExtraItemLotDeleteDialog } from "@/components/extra-items/extra-item-lot-delete-dialog";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useExtraItem } from "@/hooks/use-extra-item";
import {
  ExtraItem,
  ExtraItemLot,
  formatUnits,
  getUnitCost,
  listExtraItems,
} from "@/lib/api/extra-item";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

// Compara o unitário do lote mais novo com o do mais antigo.
function describeLotTrend(lots: ExtraItemLot[]) {
  if (lots.length < 2) return null;
  const newest = lots[0];
  const oldest = lots[lots.length - 1];
  const since = new Date(oldest.purchasedAt).getFullYear();
  const newestUnit = newest.price / newest.quantity;
  const oldestUnit = oldest.price / oldest.quantity;
  const percent = Math.round(((newestUnit - oldestUnit) / oldestUnit) * 100);
  if (percent === 0) return `preço estável desde ${since}`;
  return `unitário ${percent > 0 ? "subiu" : "caiu"} ${Math.abs(percent)}% desde ${since}`;
}

function SummaryRow({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b border-border/60 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_14rem]">
      <span className="text-[13.5px] text-muted-foreground">{label}</span>
      <div className="flex justify-end font-heading text-[15px] font-medium tabular-nums">
        {value}
      </div>
      <span className="col-span-2 text-xs text-muted-foreground tabular-nums sm:col-span-1">
        {caption}
      </span>
    </div>
  );
}

export default function ExtraItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { item, setItem, isLoading, loadError, isNotFound } = useExtraItem(params.id);
  const [siblings, setSiblings] = useState<ExtraItem[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLotDialogOpen, setIsLotDialogOpen] = useState(false);
  const [lotToDelete, setLotToDelete] = useState<ExtraItemLot | null>(null);

  // Anterior/próximo seguem a ordem alfabética da lista.
  useEffect(() => {
    listExtraItems()
      .then((items) =>
        setSiblings(
          [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        ),
      )
      .catch(() => setSiblings([]));
  }, []);

  const index = siblings.findIndex((sibling) => sibling.id === params.id);
  const previousItem = index > 0 ? siblings[index - 1] : undefined;
  const nextItem =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;

  usePageHeaderBreadcrumb(
    item ? (
      <>
        <Link
          href="/dashboard/itens-extras"
          className="text-muted-foreground hover:text-foreground"
        >
          Itens extras
        </Link>
        <ChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="font-medium">{item.name}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    item ? (
      <div className="flex items-center gap-2">
        {previousItem && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/dashboard/itens-extras/${previousItem.id}`} />}
            nativeButton={false}
          >
            <ChevronLeft />
            <span className="max-w-32 truncate">{previousItem.name}</span>
          </Button>
        )}
        {nextItem && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/dashboard/itens-extras/${nextItem.id}`} />}
            nativeButton={false}
          >
            <span className="max-w-32 truncate">{nextItem.name}</span>
            <ChevronRight />
          </Button>
        )}
        {(previousItem || nextItem) && (
          <Separator orientation="vertical" className="mx-1 h-5" />
        )}
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/itens-extras/${item.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label="Excluir item"
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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="itens-extras" />;

  if (loadError || !item) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Item não encontrado."}
        </p>
      </div>
    );
  }

  const unitCost = getUnitCost(item);
  const totalBought = item.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const latestLot = item.lots[0];
  const lotTrend = describeLotTrend(item.lots);
  const subtitle = [
    `${item.lotCount} ${item.lotCount === 1 ? "lote comprado" : "lotes comprados"}`,
    item.lastPurchasedAt && `último em ${formatDatePtBR(item.lastPurchasedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Item extra
          </span>
          <h1 className="text-4xl font-bold">{item.name}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="secondary"
          className="ml-auto"
          onClick={() => setIsLotDialogOpen(true)}
        >
          <RefreshCw />
          Registrar novo lote
        </Button>
      </div>

      <Separator />

      <section className="flex flex-col">
        <SummaryRow
          label="Custo unitário"
          value={latestLot ? formatBRL(unitCost) : "—"}
          caption={
            latestLot
              ? `${formatBRL(latestLot.price)} ÷ ${formatUnits(latestLot.quantity)}`
              : "nenhum lote registrado"
          }
        />
        <SummaryRow
          label="Total comprado"
          value={formatUnits(totalBought)}
          caption={`em ${item.lotCount} ${item.lotCount === 1 ? "lote" : "lotes"} · ${formatBRL(item.totalInvested)}`}
        />
      </section>

      {item.notes && (
        <p className="rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          {item.notes}
        </p>
      )}

      <div className="grid grid-cols-1 gap-9 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Lotes comprados
            </span>
            {lotTrend && (
              <span className="ml-auto text-[11.5px] text-muted-foreground/70">
                {lotTrend}
              </span>
            )}
          </div>
          {item.lots.length ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 font-normal">Data</th>
                  <th className="py-2 font-normal">Quantidade</th>
                  <th className="py-2 text-right font-normal">Lote</th>
                  <th className="py-2 text-right font-normal">Unitário</th>
                  <th className="w-9 py-2" />
                </tr>
              </thead>
              <tbody>
                {item.lots.map((lot) => (
                  <tr key={lot.id} className="border-b border-border/60">
                    <td className="py-2.5 tabular-nums">
                      {formatDatePtBR(lot.purchasedAt)}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {formatUnits(lot.quantity)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatBRL(lot.price)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatBRL(lot.price / lot.quantity)}
                    </td>
                    <td className="py-1 text-right">
                      {/* O único lote não sai: sem ele não há unitário. */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Excluir lote de ${formatDatePtBR(lot.purchasedAt)}`}
                        title={
                          item.lots.length === 1
                            ? "É o único lote do item. Para removê-lo, exclua o item."
                            : undefined
                        }
                        disabled={item.lots.length === 1}
                        onClick={() => setLotToDelete(lot)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-[12.5px] text-muted-foreground">
              Nenhum lote registrado.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setIsLotDialogOpen(true)}
          >
            <Plus />
            Registrar novo lote
          </Button>
        </section>

        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Peças que usaram
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-muted-foreground">
            <Images className="size-5" aria-hidden="true" />
            <p className="max-w-xs text-[12.5px]">
              Quando as peças forem cadastradas, as que usam este item
              aparecem aqui.
            </p>
          </div>
        </section>
      </div>

      <ExtraItemDeleteDialog
        itemId={item.id}
        itemName={item.name}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/itens-extras")}
      />

      {lotToDelete && (
        <ExtraItemLotDeleteDialog
          itemId={item.id}
          lot={lotToDelete}
          isLatest={lotToDelete.id === item.lots[0]?.id}
          open
          onOpenChange={(open) => {
            if (!open) setLotToDelete(null);
          }}
          onDeleted={(updated) => {
            setItem(updated);
            setLotToDelete(null);
          }}
        />
      )}

      {isLotDialogOpen && (
        <ExtraItemLotDialog
          item={item}
          open
          onOpenChange={setIsLotDialogOpen}
          onRegistered={(updated) => {
            setItem(updated);
            setIsLotDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
