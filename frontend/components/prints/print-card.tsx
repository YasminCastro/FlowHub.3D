import Link from "next/link";
import { GitBranch, Layers, TriangleAlert } from "lucide-react";

import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FAILURE_COLOR,
  PhotoPlaceholder,
} from "@/components/prints/print-bits";
import {
  PrintItem,
  formatDuration,
  formatGrams,
  formatRelativeDays,
  getDefaultRecord,
  getItemStats,
  getPerUnit,
} from "@/lib/api/print";
import { formatBRL } from "@/lib/utils";

// O card mostra o registro padrão: gramas, tempo e custo por unidade.
export function PrintCard({ item }: { item: PrintItem }) {
  const base = getDefaultRecord(item);
  const perUnit = getPerUnit(base);
  const stats = getItemStats(item);
  const types = [...new Set(base.filaments.map((u) => u.filament.type))];
  const cover = item.records.find((r) => r.photos.length)?.photos[0];

  return (
    <Link
      href={`/dashboard/impressoes/${item.id}`}
      className="flex flex-col overflow-hidden rounded-md bg-card shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.75 hover:shadow-[0_0_0_1px_var(--color-brand-700),0_10px_26px_rgba(0,0,0,0.5)] focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="relative h-33">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover" />
        ) : (
          <PhotoPlaceholder className="size-full" />
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-3.5 py-3.25">
        <div className="min-w-0">
          <div className="truncate font-heading text-[14.5px] leading-tight font-medium">
            {item.name}
          </div>
          {item.derivedFrom ? (
            <div className="mt-0.75 flex items-center gap-1.25 truncate text-[11.5px] text-muted-foreground">
              <GitBranch className="size-3 shrink-0" aria-hidden="true" />
              derivado de {item.derivedFrom.name}
            </div>
          ) : (
            <div className="mt-0.75 truncate text-[11.5px] text-muted-foreground tabular-nums">
              {formatGrams(perUnit.grams)} · {formatDuration(perUnit.minutes)} ·{" "}
              {base.printer.name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.25">
          {stats.colors.slice(0, 6).map((colors, index) => (
            <FilamentDot key={index} colors={colors} />
          ))}
          <span className="ml-0.75 text-[11px] text-muted-foreground">
            {stats.colors.length} {stats.colors.length === 1 ? "cor" : "cores"}
            {types.some((t) => t !== "PLA") && ` · ${types.join(" + ")}`}
          </span>
          <span className="ml-auto font-heading text-sm font-medium tabular-nums">
            {formatBRL(perUnit.cost)}
          </span>
        </div>

        <span className="h-px bg-linear-to-r from-transparent via-border to-transparent" />

        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1.25">
            <Layers className="size-3 opacity-70" aria-hidden="true" />
            {stats.recordCount}{" "}
            {stats.recordCount === 1 ? "registro" : "registros"} · {stats.units}{" "}
            un.
          </span>
          {stats.failures > 0 && (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: FAILURE_COLOR }}
              title={`${stats.failures} ${stats.failures === 1 ? "falha" : "falhas"}`}
            >
              <TriangleAlert className="size-3" aria-hidden="true" />
              {stats.failures}
            </span>
          )}
          {stats.lastPrintedAt && (
            <span className="ml-auto text-muted-foreground/80">
              {formatRelativeDays(stats.lastPrintedAt)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
