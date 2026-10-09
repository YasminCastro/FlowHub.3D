import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleX, Store } from "lucide-react";

import { FilamentRatingBadge } from "@/components/filaments/filament-rating";
import { FilamentSwatch } from "@/components/filaments/filament-swatch";
import { SpoolLevelMeter } from "@/components/filaments/spool-level";
import {
  Filament,
  formatPricePerKg,
  formatSpoolWeight,
  SPOOL_LEVEL_LABELS,
  getPricePerKg,
} from "@/lib/api/filament";
import { cn } from "@/lib/utils";

export type FilamentCardData = Pick<
  Filament,
  | "colorName"
  | "colors"
  | "brand"
  | "type"
  | "spoolWeightGrams"
  | "spoolLevel"
  | "finishedAt"
  | "minPricePaid"
  | "maxPricePaid"
  | "rating"
  | "availability"
  | "isOutlet"
  | "purchaseCount"
> & { id?: string };

export function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "2-digit",
  });
}

export function OutletTag() {
  return (
    <span className="shrink-0 rounded-sm border border-brand/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
      Outlet
    </span>
  );
}

export type FilamentCardProps = {
  filament: FilamentCardData;
  href?: string;
  className?: string;
};

export function FilamentCard({ filament, href, className }: FilamentCardProps) {
  const router = useRouter();
  const isFinished = filament.spoolLevel === "FINISHED";
  const isSoldOut = filament.availability === "SOLD_OUT";
  const price = getPricePerKg(filament);
  const purchases = `${filament.purchaseCount} ${filament.purchaseCount === 1 ? "compra" : "compras"}`;

  return (
    <div
      role={href ? "link" : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={href ? () => router.push(href) : undefined}
      onKeyDown={
        href
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(href);
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col gap-3 rounded-md bg-card p-3.5 shadow-sm transition-[box-shadow,transform,opacity] duration-200",
        href &&
          "cursor-pointer hover:-translate-y-0.75 hover:shadow-[0_0_0_1px_var(--color-brand-700),0_10px_26px_rgba(0,0,0,0.5)] focus-visible:outline-2 focus-visible:outline-brand",
        isFinished && "opacity-60 hover:opacity-90",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <FilamentSwatch colors={filament.colors} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-[14.5px] font-medium leading-tight">
            {filament.colorName || "Nome da cor"}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {filament.brand.name || "Marca"} · {filament.type}
          </div>
        </div>
        {filament.isOutlet && <OutletTag />}
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 text-[11.5px]",
          filament.spoolLevel === "LOW"
            ? "text-brand-300"
            : "text-muted-foreground",
        )}
      >
        <SpoolLevelMeter level={filament.spoolLevel} />
        {isFinished
          ? filament.finishedAt
            ? `Acabou em ${formatMonthYear(filament.finishedAt)}`
            : "Acabou"
          : `${SPOOL_LEVEL_LABELS[filament.spoolLevel]} · rolo de ${formatSpoolWeight(filament.spoolWeightGrams)}`}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] tabular-nums text-muted-foreground">
          {price ? formatPricePerKg(price) : "sem preço"}
        </span>
        {isFinished && isSoldOut ? (
          <span className="text-[11.5px] text-muted-foreground/70">
            sem estoque na marca
          </span>
        ) : isFinished && filament.id ? (
          <Link
            href={`/dashboard/filamentos/${filament.id}?recomprar=1`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border border-border px-2 py-0.5 text-[11.5px] transition-colors hover:border-brand hover:bg-brand/10 hover:text-brand"
          >
            Recomprar
          </Link>
        ) : filament.rating ? (
          <FilamentRatingBadge rating={filament.rating} />
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        {isSoldOut ? (
          <CircleX className="size-3" aria-hidden="true" />
        ) : (
          <Store className="size-3" aria-hidden="true" />
        )}
        {isSoldOut ? "Esgotado na marca" : "Disponível"} · {purchases}
      </div>
    </div>
  );
}
