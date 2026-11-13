"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Search, Tag, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { PrintCategory } from "@/lib/api/print";
import { cn } from "@/lib/utils";

function CategoryDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

// Filtro de categorias: busca pelo nome e permite marcar várias.
export function CategoryFilter({
  categories,
  selected,
  onChange,
}: {
  categories: PrintCategory[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const visible = term
    ? categories.filter((c) => c.name.toLowerCase().includes(term))
    : categories;

  const selectedCategories = categories.filter((c) => selected.includes(c.id));
  const label =
    selectedCategories.length === 0
      ? "Todas as categorias"
      : selectedCategories.length === 1
        ? selectedCategories[0].name
        : `${selectedCategories.length} categorias`;

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  return (
    <PopoverPrimitive.Root onOpenChange={(open) => !open && setQuery("")}>
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="outline"
            className={cn(
              selected.length > 0 && "border-brand bg-brand/10 text-brand",
            )}
          >
            {selectedCategories.length === 1 ? (
              <CategoryDot color={selectedCategories[0].color} />
            ) : (
              <Tag />
            )}
            {label}
          </Button>
        }
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="end"
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <PopoverPrimitive.Popup className="flex w-64 origin-(--transform-origin) flex-col gap-1 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="relative p-0.5">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria..."
                aria-label="Buscar categoria"
                className="h-8 pl-8"
              />
            </div>

            <ul className="flex max-h-60 flex-col overflow-y-auto">
              {visible.map((category) => {
                const checked = selected.includes(category.id);
                return (
                  <li key={category.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm select-none hover:bg-accent hover:text-accent-foreground">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(category.id)}
                      />
                      <CategoryDot color={category.color} />
                      <span className="truncate">{category.name}</span>
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="px-1.5 py-2 text-center text-xs text-muted-foreground">
                  Nenhuma categoria encontrada.
                </li>
              )}
            </ul>

            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={() => onChange([])}
              >
                <X />
                Limpar seleção
              </Button>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
