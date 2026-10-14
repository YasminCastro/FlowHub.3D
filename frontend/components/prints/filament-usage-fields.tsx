"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  PrintFilament,
  PrintFilamentUsage,
  describeSpoolLevel,
  formatDecimal,
  isDeletedFilament,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

// Uma linha de filamento: material e marca filtram a lista de filamentos.
// O peso fica como texto para aceitar vírgula enquanto digita.
export type FilamentUsageDraft = {
  type: string;
  brandName: string;
  filamentId: string;
  grams: string;
};

export const EMPTY_USAGE: FilamentUsageDraft = {
  type: "",
  brandName: "",
  filamentId: "",
  grams: "",
};

/**
 * Linha preenchida a partir de um filamento já usado. Se ele foi excluído,
 * material e marca ficam e só a cor precisa ser escolhida de novo — a não ser
 * na edição do próprio registro (keepDeleted), onde ele pode continuar.
 */
export function usageDraftFrom(
  filament: PrintFilament,
  grams: number,
  { keepDeleted = false } = {},
): FilamentUsageDraft {
  return {
    type: filament.type,
    brandName: filament.brandName,
    filamentId: isDeletedFilament(filament) && !keepDeleted ? "" : filament.id,
    grams: formatDecimal(grams, 1),
  };
}

export function parseDecimal(text: string) {
  const value = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

export function toUsages(
  drafts: FilamentUsageDraft[],
  filaments: PrintFilament[],
): PrintFilamentUsage[] {
  return drafts.flatMap((draft) => {
    const filament = filaments.find((f) => f.id === draft.filamentId);
    return filament ? [{ filament, grams: parseDecimal(draft.grams) }] : [];
  });
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function matches(f: PrintFilament, type: string, brandName: string) {
  return (
    (!type || f.type === type) && (!brandName || f.brandName === brandName)
  );
}

// Mantém a linha coerente: filamento que não bate com o filtro sai, e se o
// filtro deixa só uma opção livre, ela já fica escolhida.
function resolveRow(
  row: FilamentUsageDraft,
  filaments: PrintFilament[],
  takenIds: Set<string>,
): FilamentUsageDraft {
  const options = filaments.filter((f) => matches(f, row.type, row.brandName));
  const current = options.find((f) => f.id === row.filamentId);
  if (current) return row;
  const free = options.filter((f) => !takenIds.has(f.id));
  const auto = row.type && row.brandName && free.length === 1 ? free[0] : null;
  return { ...row, filamentId: auto?.id ?? "" };
}

export function FilamentUsageFields({
  value,
  onChange,
  filaments,
  changed,
  showPrice = true,
  stacked = false,
}: {
  value: FilamentUsageDraft[];
  onChange: (next: FilamentUsageDraft[]) => void;
  filaments: PrintFilament[];
  /** Destaca o seletor quando o filamento difere do registro de base. */
  changed?: boolean;
  showPrice?: boolean;
  /** Espaço estreito (painel): material e marca numa linha, o resto embaixo. */
  stacked?: boolean;
}) {
  function update(index: number, patch: Partial<FilamentUsageDraft>) {
    const takenIds = new Set(
      value.filter((_, i) => i !== index).map((row) => row.filamentId),
    );
    onChange(
      value.map((row, i) =>
        i === index
          ? resolveRow({ ...row, ...patch }, filaments, takenIds)
          : row,
      ),
    );
  }

  // Escolher o filamento direto também acerta material e marca.
  function chooseFilament(index: number, filamentId: string) {
    const filament = filaments.find((f) => f.id === filamentId);
    update(
      index,
      filament
        ? { filamentId, type: filament.type, brandName: filament.brandName }
        : { filamentId: "" },
    );
  }

  const used = new Set(value.map((row) => row.filamentId));
  const types = unique(filaments.map((f) => f.type));

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, index) => {
        const n = index + 1;
        const brands = unique(
          filaments
            .filter((f) => !row.type || f.type === row.type)
            .map((f) => f.brandName),
        );
        const options = filaments.filter((f) =>
          matches(f, row.type, row.brandName),
        );
        const selected = filaments.find((f) => f.id === row.filamentId);
        // Com material e marca escolhidos, o nome da cor basta.
        const narrowed = !!row.type && !!row.brandName;

        // Vazio vai como null: no Select do Base UI, "" não bate com nenhuma
        // opção e a lista não abre direito.
        const typeSelect = (
          <Select
            value={row.type || null}
            onValueChange={(next) => update(index, { type: next ?? "" })}
          >
            <SelectTrigger aria-label={`Material ${n}`} className="w-full">
              <SelectValue>
                {(v: string) =>
                  v || <span className="text-muted-foreground">Material</span>
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

        const brandSelect = (
          <Select
            value={row.brandName || null}
            onValueChange={(next) => update(index, { brandName: next ?? "" })}
          >
            <SelectTrigger aria-label={`Marca ${n}`} className="w-full">
              <SelectValue>
                {(v: string) =>
                  v || <span className="text-muted-foreground">Marca</span>
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

        const filamentSelect = (
          <Select
            value={row.filamentId || null}
            onValueChange={(next) => chooseFilament(index, next ?? "")}
          >
            <SelectTrigger
              aria-label={`Filamento ${n}`}
              className={cn(
                "w-full",
                changed && "shadow-[inset_0_0_0_1px_var(--brand-700)]",
              )}
            >
              <SelectValue>
                {() =>
                  selected ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <FilamentDot colors={selected.colors} />
                      <span className="truncate">
                        {narrowed
                          ? selected.colorName
                          : `${selected.type} ${selected.colorName} · ${selected.brandName}`}
                      </span>
                      <span className="ml-auto pl-2 text-[11px] text-muted-foreground">
                        {describeSpoolLevel(selected)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {options.length ? "Filamento" : "Nenhum com esse filtro"}
                    </span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((f) => (
                <SelectItem
                  key={f.id}
                  value={f.id}
                  disabled={used.has(f.id) && f.id !== row.filamentId}
                >
                  <FilamentDot colors={f.colors} />
                  {narrowed
                    ? f.colorName
                    : `${f.type} ${f.colorName} · ${f.brandName}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

        const gramsInput = (
          <div className="relative">
            <Input
              inputMode="decimal"
              aria-label={`Gramas do filamento ${n}`}
              value={row.grams}
              onChange={(e) => update(index, { grams: e.target.value })}
              className="pr-6 tabular-nums"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
              g
            </span>
          </div>
        );

        const removeButton = (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover filamento ${n}`}
            disabled={value.length === 1}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        );

        if (stacked) {
          return (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-2",
                index > 0 && "border-t border-border/60 pt-2",
              )}
            >
              <div className="grid grid-cols-2 gap-2.5">
                {typeSelect}
                {brandSelect}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_96px_28px] items-center gap-2.5">
                {filamentSelect}
                {gramsInput}
                {removeButton}
              </div>
            </div>
          );
        }

        return (
          <div
            key={index}
            className={cn(
              "grid items-center gap-2.5",
              showPrice
                ? "grid-cols-2 md:grid-cols-[130px_150px_minmax(0,1fr)_96px_92px_28px]"
                : "grid-cols-2 md:grid-cols-[130px_150px_minmax(0,1fr)_96px_28px]",
            )}
          >
            {typeSelect}
            {brandSelect}
            {filamentSelect}
            {gramsInput}
            {showPrice && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {selected ? `${formatBRL(selected.pricePerGram)} / g` : "—"}
              </span>
            )}
            {removeButton}
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-brand-300"
        disabled={value.length >= filaments.length}
        onClick={() => onChange([...value, EMPTY_USAGE])}
      >
        <Plus />
        Outro filamento (multicor)
      </Button>
    </div>
  );
}
