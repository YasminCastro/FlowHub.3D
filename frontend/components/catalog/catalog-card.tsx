import Link from "next/link";
import { LinkIcon, TriangleAlert } from "lucide-react";

import { FilamentDot } from "@/components/journal/journal-status-badge";
import { PhotoPlaceholder } from "@/components/prints/print-bits";
import {
  ResolvedCatalogItem,
  describeKind,
  formatPriceRange,
  lowColorWarning,
} from "@/lib/api/catalog";

// Âmbar dos avisos de pouco filamento.
export const LOW_STOCK_COLOR = "#d9a95c";

const MAX_DOTS = 6;

export function CatalogCard({ item }: { item: ResolvedCatalogItem }) {
  const cover = item.photos[0]?.src;
  const kindTag = describeKind(item);
  const lowColor = item.colors.find((c) => c.low);
  const warning = lowColor ? lowColorWarning(item, lowColor) : null;
  const linked = item.variants.length;

  return (
    <Link
      href={`/dashboard/catalogo/${item.id}`}
      className="flex flex-col overflow-hidden rounded-md bg-card shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.75 hover:shadow-[0_0_0_1px_var(--color-brand-700),0_10px_26px_rgba(0,0,0,0.5)] focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="relative h-37.5">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover" />
        ) : (
          <PhotoPlaceholder className="size-full" />
        )}
        {kindTag && (
          <span className="absolute top-2.25 left-2.25 rounded-sm bg-background/80 px-2 py-0.5 text-[11px] text-foreground/85 backdrop-blur-sm">
            {kindTag}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-3.5 py-3.25">
        <div className="flex items-baseline gap-2.5">
          <div className="min-w-0 font-heading text-[14.5px] leading-tight font-medium">
            {item.name}
          </div>
          <div className="ml-auto shrink-0 text-right">
            <div className="font-heading text-base font-medium tabular-nums">
              {formatPriceRange(item.priceMin, item.priceMax)}
            </div>
            {item.isManualPrice && (
              <div className="text-[10.5px] text-muted-foreground/80">
                preço manual
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.25">
          {item.colors.slice(0, MAX_DOTS).map(({ filament }) => (
            <FilamentDot
              key={filament.id}
              colors={filament.colors}
              className="size-2.5"
            />
          ))}
          <span className="ml-1 text-[11px] text-muted-foreground">
            {item.colors.length
              ? `${item.colors.length} ${item.colors.length === 1 ? "cor" : "cores"}`
              : "Sem cor em estoque"}
          </span>
        </div>

        <span className="h-px bg-linear-to-r from-transparent via-border to-transparent" />

        {warning ? (
          <div
            className="flex items-center gap-2 text-[11.5px]"
            style={{ color: LOW_STOCK_COLOR }}
          >
            <TriangleAlert className="size-3.25 shrink-0" aria-hidden="true" />
            <span className="truncate">{warning}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
            {linked} {linked === 1 ? "impressão" : "impressões"}
            {item.materials.length > 0 && ` · ${item.materials.join(" + ")}`}
          </div>
        )}
      </div>
    </Link>
  );
}
