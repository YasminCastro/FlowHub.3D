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
  describePrintFilament,
  formatGrams,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

// No formulário o peso fica como texto para aceitar vírgula enquanto digita.
export type FilamentUsageDraft = { filamentId: string; grams: string };

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

export function FilamentUsageFields({
  value,
  onChange,
  filaments,
  changed,
  showPrice = true,
  gramsLabel,
}: {
  value: FilamentUsageDraft[];
  onChange: (next: FilamentUsageDraft[]) => void;
  filaments: PrintFilament[];
  /** Destaca o seletor quando o filamento difere do registro de base. */
  changed?: boolean;
  showPrice?: boolean;
  gramsLabel?: string;
}) {
  function update(index: number, patch: Partial<FilamentUsageDraft>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const used = new Set(value.map((row) => row.filamentId));

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, index) => {
        const selected = filaments.find((f) => f.id === row.filamentId);
        return (
          <div
            key={index}
            className={cn(
              "grid items-center gap-2.5",
              showPrice
                ? "grid-cols-[minmax(0,1fr)_96px_92px_28px]"
                : "grid-cols-[minmax(0,1fr)_96px_28px]",
            )}
          >
            <Select
              value={row.filamentId}
              onValueChange={(next) =>
                update(index, { filamentId: next ?? "" })
              }
            >
              <SelectTrigger
                aria-label={`Filamento ${index + 1}`}
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
                          {describePrintFilament(selected)} ·{" "}
                          {selected.brandName}
                        </span>
                        <span className="ml-auto pl-2 text-[11px] text-muted-foreground tabular-nums">
                          {formatGrams(selected.remainingGrams)} no rolo
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Escolha o filamento
                      </span>
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filaments.map((f) => (
                  <SelectItem
                    key={f.id}
                    value={f.id}
                    disabled={used.has(f.id) && f.id !== row.filamentId}
                  >
                    <FilamentDot colors={f.colors} />
                    {describePrintFilament(f)} · {f.brandName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                inputMode="decimal"
                aria-label={gramsLabel ?? `Gramas do filamento ${index + 1}`}
                value={row.grams}
                onChange={(e) => update(index, { grams: e.target.value })}
                className="pr-6 tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                g
              </span>
            </div>
            {showPrice && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {selected ? `${formatBRL(selected.pricePerGram)} / g` : "—"}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover filamento ${index + 1}`}
              disabled={value.length === 1}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <X />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-brand-300"
        disabled={value.length >= filaments.length}
        onClick={() => onChange([...value, { filamentId: "", grams: "" }])}
      >
        <Plus />
        Outro filamento (multicor)
      </Button>
    </div>
  );
}
