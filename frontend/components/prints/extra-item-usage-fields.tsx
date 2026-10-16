"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuffixInput } from "@/components/prints/print-bits";
import { parseDecimal } from "@/components/prints/filament-usage-fields";
import {
  PrintExtraItem,
  PrintExtraItemUsage,
  isDeletedExtraItem,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

// Uma linha de item extra. A quantidade (por peça) fica como texto enquanto
// digita.
export type ExtraItemUsageDraft = { extraItemId: string; quantity: string };

export const EMPTY_EXTRA_ITEM: ExtraItemUsageDraft = {
  extraItemId: "",
  quantity: "1",
};

/**
 * Linha preenchida a partir de um item já usado. Se ele foi excluído, a linha
 * começa vazia — a não ser na edição do próprio registro (keepDeleted).
 */
export function extraItemDraftFrom(
  usage: PrintExtraItemUsage,
  { keepDeleted = false } = {},
): ExtraItemUsageDraft {
  return {
    extraItemId:
      isDeletedExtraItem(usage.extraItem) && !keepDeleted
        ? ""
        : usage.extraItem.id,
    quantity: String(usage.quantity),
  };
}

export function toExtraItemUsages(
  drafts: ExtraItemUsageDraft[],
  items: PrintExtraItem[],
): PrintExtraItemUsage[] {
  return drafts.flatMap((draft) => {
    const extraItem = items.find((i) => i.id === draft.extraItemId);
    const quantity = Math.round(parseDecimal(draft.quantity));
    return extraItem ? [{ extraItem, quantity }] : [];
  });
}

export function ExtraItemUsageFields({
  value,
  onChange,
  items,
  changed,
}: {
  value: ExtraItemUsageDraft[];
  onChange: (next: ExtraItemUsageDraft[]) => void;
  items: PrintExtraItem[];
  /** Destaca as linhas quando diferem do registro de base. */
  changed?: boolean;
}) {
  function update(index: number, patch: Partial<ExtraItemUsageDraft>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const used = new Set(value.map((row) => row.extraItemId));

  if (!items.length && !value.length) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Ímãs, argolas e o que mais vai na peça.{" "}
        <Link
          href="/dashboard/itens-extras/new"
          className="text-brand-300 hover:underline"
        >
          Cadastrar item extra
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, index) => {
        const n = index + 1;
        const selected = items.find((i) => i.id === row.extraItemId);
        const quantity = Math.round(parseDecimal(row.quantity));
        return (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_104px_28px] items-center gap-2.5 sm:grid-cols-[minmax(0,1fr)_104px_92px_28px]"
          >
            <Select
              value={row.extraItemId || null}
              onValueChange={(next) =>
                update(index, { extraItemId: next ?? "" })
              }
            >
              <SelectTrigger
                aria-label={`Item extra ${n}`}
                className={cn(
                  "w-full",
                  changed && "shadow-[inset_0_0_0_1px_var(--brand-700)]",
                )}
              >
                <SelectValue>
                  {() =>
                    selected ? (
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate">{selected.name}</span>
                        <span className="ml-auto pl-2 text-[11px] text-muted-foreground tabular-nums">
                          {formatBRL(selected.unitCost)} / un.
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Item extra</span>
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    disabled={used.has(item.id) && item.id !== row.extraItemId}
                  >
                    {item.name}
                    <span className="ml-auto pl-3 text-[11px] text-muted-foreground tabular-nums">
                      {formatBRL(item.unitCost)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SuffixInput
              inputMode="numeric"
              aria-label={`Quantidade por peça do item extra ${n}`}
              suffix="/ peça"
              className="pr-14"
              value={row.quantity}
              onChange={(e) => update(index, { quantity: e.target.value })}
            />
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
              {selected ? formatBRL(selected.unitCost * quantity) : "—"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover item extra ${n}`}
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
        disabled={value.length >= items.length}
        onClick={() => onChange([...value, EMPTY_EXTRA_ITEM])}
      >
        <Plus />
        {value.length ? "Outro item extra" : "Adicionar item extra"}
      </Button>
    </div>
  );
}
