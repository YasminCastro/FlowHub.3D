import Link from "next/link";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useState } from "react";

import { CalLabel } from "@/components/calibrations/calibration-bits";
import { FilamentBadge } from "@/components/flushing/filament-badge";
import {
  FlushPair,
  FlushPairFilament,
  formatFlushMultiplier,
} from "@/lib/api/flushing";
import { cn } from "@/lib/utils";

/** Quantas cores a tabela da tela inicial junta. */
export const FLUSH_MATRIX_MAX_COLORS = 4;

/** As cores dos pares, na ordem em que aparecem (1, 2, 3, 4). */
export function matrixFilaments(pairs: FlushPair[]) {
  const seen = new Map<string, FlushPairFilament>();
  for (const pair of pairs) {
    for (const f of [pair.filamentA, pair.filamentB]) {
      if (!seen.has(f.id)) seen.set(f.id, f);
    }
  }
  return [...seen.values()];
}

const badgeFilament = (f: FlushPairFilament) => ({
  ...f,
  brandName: f.brand.name,
});

/** Volume de "from" para "to" e o par que guarda o valor. */
function findVolume(pairs: FlushPair[], fromId: string, toId: string) {
  for (const pair of pairs) {
    if (pair.filamentAId === fromId && pair.filamentBId === toId) {
      return { pair, volume: pair.volumeAToB };
    }
    if (pair.filamentBId === fromId && pair.filamentAId === toId) {
      return { pair, volume: pair.volumeBToA };
    }
  }
  return null;
}

// O Color Multiplier e o Multiplier ficam em cada par: a tabela mostra o
// valor quando os pares concordam e avisa quando não.
function summarize(values: (number | null)[]) {
  const distinct = [
    ...new Set(values.filter((v): v is number => v != null)),
  ].sort((x, y) => x - y);
  if (distinct.length === 0) return { text: "—", title: undefined };
  if (distinct.length === 1) {
    return { text: formatFlushMultiplier(distinct[0]), title: undefined };
  }
  return {
    text: "varia",
    title: `Valores diferentes entre os pares: ${distinct.map(formatFlushMultiplier).join(", ")}`,
  };
}

function colorMultiplierOf(pairs: FlushPair[], filamentId: string) {
  return summarize(
    pairs.flatMap((pair) =>
      pair.filamentAId === filamentId
        ? [pair.colorMultiplierA]
        : pair.filamentBId === filamentId
          ? [pair.colorMultiplierB]
          : [],
    ),
  );
}

/** As cores na ordem escolhida; as que ainda não têm lugar vão para o fim. */
function sortByOrder(filaments: FlushPairFilament[], order: string[]) {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  // sort é estável: as novas ficam na ordem em que apareceram.
  return [...filaments].sort((x, y) => rank(x.id) - rank(y.id));
}

/**
 * A ordem das cores, para bater com os slots do fatiador: arrastar a cor ou
 * usar as setas.
 */
function ColorOrder({
  filaments,
  onReorder,
}: {
  filaments: FlushPairFilament[];
  onReorder: (ids: string[]) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const ids = filaments.map((f) => f.id);

  function move(id: string, to: number) {
    const next = ids.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
    onReorder(next);
  }

  return (
    <ol aria-label="Ordem das cores" className="flex flex-wrap gap-2">
      {filaments.map((f, i) => (
        <li
          key={f.id}
          draggable
          onDragStart={(e) => {
            setDragging(f.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => {
            if (!dragging || dragging === f.id) return;
            e.preventDefault();
            move(dragging, i);
          }}
          className={cn(
            "flex cursor-grab items-center gap-1.5 rounded-md bg-card py-1 pr-1 pl-1 text-[12.5px] shadow-sm active:cursor-grabbing",
            dragging === f.id && "opacity-50",
          )}
        >
          <GripVertical
            className="size-3.5 text-foreground/35"
            aria-hidden="true"
          />
          <FilamentBadge n={i + 1} filament={badgeFilament(f)} />
          <span className="max-w-36 truncate">{f.colorName}</span>
          <span className="flex">
            <button
              type="button"
              aria-label={`Mover ${f.colorName} para a esquerda`}
              disabled={i === 0}
              onClick={() => move(f.id, i - 1)}
              className="grid size-6 place-items-center rounded-sm text-foreground/50 hover:bg-foreground/7 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Mover ${f.colorName} para a direita`}
              disabled={i === filaments.length - 1}
              onClick={() => move(f.id, i + 1)}
              className="grid size-6 place-items-center rounded-sm text-foreground/50 hover:bg-foreground/7 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A tabela do fatiador com as cores dos pares escolhidos. Os volumes vêm de
 * todos os pares cadastrados entre essas cores na mesma impressora e
 * fatiador, não só dos marcados.
 */
export function FlushMatrix({
  selected,
  pairs,
  order,
  onOrderChange,
}: {
  /** Os pares marcados: definem as cores. */
  selected: FlushPair[];
  /** Todos os pares da mesma impressora e fatiador. */
  pairs: FlushPair[];
  /** Ids das cores na ordem das linhas e colunas. */
  order: string[];
  onOrderChange: (ids: string[]) => void;
}) {
  const filaments = sortByOrder(matrixFilaments(selected), order);
  const ids = new Set(filaments.map((f) => f.id));
  const inTable = pairs.filter(
    (p) => ids.has(p.filamentAId) && ids.has(p.filamentBId),
  );
  const multiplier = summarize(inTable.map((p) => p.multiplier));
  const missing = filaments.reduce(
    (count, from) =>
      count +
      filaments.filter(
        (to) =>
          to.id !== from.id && findVolume(inTable, from.id, to.id) == null,
      ).length,
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      {filaments.length > 1 && (
        <ColorOrder filaments={filaments} onReorder={onOrderChange} />
      )}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1.5 text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="px-1 text-left">
                <CalLabel>Color multiplier</CalLabel>
              </th>
              <th scope="col" className="px-1">
                <CalLabel>De / para</CalLabel>
              </th>
              {filaments.map((f, i) => (
                <th key={f.id} scope="col" className="px-1">
                  <span className="flex justify-center">
                    <FilamentBadge n={i + 1} filament={badgeFilament(f)} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filaments.map((from, i) => {
              const color = colorMultiplierOf(inTable, from.id);
              return (
                <tr key={from.id}>
                  <td
                    title={color.title}
                    className="h-8 w-20 rounded-md text-center text-brand tabular-nums shadow-[inset_0_0_0_1px_var(--border)]"
                  >
                    {color.text}
                  </td>
                  <th scope="row" className="px-1">
                    <span className="flex justify-center">
                      <FilamentBadge n={i + 1} filament={badgeFilament(from)} />
                    </span>
                  </th>
                  {filaments.map((to) => {
                    if (to.id === from.id) {
                      return (
                        <td
                          key={to.id}
                          className="w-20 text-center text-foreground/40 tabular-nums"
                        >
                          0
                        </td>
                      );
                    }
                    const found = findVolume(inTable, from.id, to.id);
                    return (
                      <td key={to.id} className="w-20">
                        {found ? (
                          <Link
                            href={`/dashboard/flushing/${found.pair.id}`}
                            title={`${from.colorName} → ${to.colorName}`}
                            className="flex h-8 items-center justify-center rounded-md tabular-nums shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-brand/10 hover:text-brand"
                          >
                            {found.volume ?? "—"}
                          </Link>
                        ) : (
                          <span
                            title={`Sem registro de ${from.colorName} com ${to.colorName}`}
                            className="flex h-8 items-center justify-center rounded-md border border-dashed border-border text-foreground/35"
                          >
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
        <span title={multiplier.title}>
          <span className="text-foreground/55">Multiplier</span>{" "}
          <span className="tabular-nums">{multiplier.text}</span>
        </span>
        <span className="text-xs text-foreground/45">
          Volumes em mm³, da linha para a coluna. Clique num valor para abrir o
          par.
        </span>
        {missing > 0 && (
          <span className="text-xs text-brand-300">
            {missing === 1
              ? "1 troca sem registro"
              : `${missing} trocas sem registro`}
            : cadastre o par para completar a tabela.
          </span>
        )}
      </div>
    </div>
  );
}
