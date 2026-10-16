"use client";

import { Combobox } from "@base-ui/react/combobox";
import { LinkIcon } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { PrintItem } from "@/lib/api/print";
import { cn } from "@/lib/utils";

// Busca da impressão ligada ao item do catálogo. Com muitas peças a lista
// inteira atrapalha, então ela só abre depois que o nome começa a ser digitado.
export function PrintPicker({
  prints,
  value,
  onChange,
  className,
}: {
  prints: PrintItem[];
  value: string;
  onChange: (printItemId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = prints.find((p) => p.id === value) ?? null;

  return (
    <Combobox.Root
      items={prints}
      value={selected}
      onValueChange={(print) => print && onChange(print.id)}
      itemToStringLabel={(print: PrintItem) => print.name}
      isItemEqualToValue={(a: PrintItem, b: PrintItem) => a.id === b.id}
      onInputValueChange={setQuery}
      open={open && query.trim() !== ""}
      onOpenChange={setOpen}
      openOnInputClick={false}
      autoHighlight
    >
      <div className={cn("relative", className)}>
        {selected && (
          <LinkIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.25 -translate-y-1/2 opacity-60"
            aria-hidden="true"
          />
        )}
        <Combobox.Input
          aria-label="Impressão"
          placeholder={
            value ? "Impressão excluída" : "Digite o nome da impressão"
          }
          render={<Input className={cn(selected && "pl-7")} />}
        />
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50">
          <Combobox.Popup className="max-h-[min(var(--available-height),18rem)] w-(--anchor-width) min-w-48 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-1.5 text-[12.5px] text-muted-foreground empty:hidden">
              Nenhuma impressão com esse nome.
            </Combobox.Empty>
            <Combobox.List>
              {(print: PrintItem) => (
                <Combobox.Item
                  key={print.id}
                  value={print}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-selected:text-brand"
                >
                  <span className="truncate">{print.name}</span>
                  {print.category && (
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {print.category.name}
                    </span>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
