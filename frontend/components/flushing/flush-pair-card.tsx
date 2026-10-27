import { useRouter } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
import { SLICER_LABELS } from "@/lib/api/calibration";
import {
  FlushPair,
  flushPairGradient,
  formatFlushVolume,
} from "@/lib/api/flushing";
import { cn } from "@/lib/utils";

/** O degradê da cor de um filamento para a do outro. */
export function FlushPairSwatch({
  pair,
  className,
}: {
  pair: Pick<FlushPair, "filamentA" | "filamentB">;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block size-10.5 shrink-0 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
        className,
      )}
      style={{ background: flushPairGradient(pair.filamentA, pair.filamentB) }}
    />
  );
}

export function flushPairName(
  pair: Pick<FlushPair, "filamentA" | "filamentB">,
) {
  return `${pair.filamentA.colorName} + ${pair.filamentB.colorName}`;
}

function volumeOrDash(value: number | null) {
  return value == null ? "—" : formatFlushVolume(value);
}

export function FlushPairCard({
  pair,
  selected = false,
  onSelectedChange,
  selectDisabledReason,
}: {
  pair: FlushPair;
  /** Marcado para a tabela de cores da tela inicial. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Por que não dá para marcar agora (null quando dá). */
  selectDisabledReason?: string | null;
}) {
  const router = useRouter();
  const href = `/dashboard/flushing/${pair.id}`;
  const { filamentA: a, filamentB: b } = pair;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-md bg-card p-3.5 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.75 hover:shadow-[0_0_0_1px_var(--color-brand-700),0_10px_26px_rgba(0,0,0,0.5)] focus-visible:outline-2 focus-visible:outline-brand",
        selected && "shadow-[0_0_0_1px_var(--brand)]",
      )}
    >
      <div className="flex items-start gap-3">
        <FlushPairSwatch pair={pair} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-[14.5px] leading-tight font-medium">
            {flushPairName(pair)}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {a.type === b.type && a.brand.name === b.brand.name
              ? `${a.brand.name} · ${a.type}`
              : `${a.brand.name} ${a.type} · ${b.brand.name} ${b.type}`}
          </div>
        </div>
        {onSelectedChange && (
          // O clique na caixa marca o par; não abre o card.
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            title={
              !selected && selectDisabledReason
                ? selectDisabledReason
                : "Usar na tabela de cores"
            }
            className="-m-1 flex shrink-0 p-1"
          >
            <Checkbox
              className="size-4.5"
              aria-label={`Usar ${flushPairName(pair)} na tabela de cores`}
              checked={selected}
              disabled={!selected && !!selectDisabledReason}
              onCheckedChange={(checked) => onSelectedChange(checked)}
            />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-[12.5px] tabular-nums">
        <span className="flex justify-between gap-2">
          <span className="truncate text-muted-foreground">
            {a.colorName} → {b.colorName}
          </span>
          {volumeOrDash(pair.volumeAToB)}
        </span>
        <span className="flex justify-between gap-2">
          <span className="truncate text-muted-foreground">
            {b.colorName} → {a.colorName}
          </span>
          {volumeOrDash(pair.volumeBToA)}
        </span>
      </div>

      <div className="text-[11px] text-muted-foreground/70">
        {SLICER_LABELS[pair.slicer]} · {pair.printer.name}
      </div>
    </div>
  );
}
