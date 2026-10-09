"use client";

import { Plus, X } from "lucide-react";
import { KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COLOR_SUGGESTIONS = [
  "Preto",
  "Branco",
  "Cinza",
  "Pastéis",
  "Transparente",
  "Silk",
  "Neon",
  "Madeira",
];

export type BrandColorInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

export function BrandColorInput({ value, onChange }: BrandColorInputProps) {
  const [draft, setDraft] = useState("");

  const has = (color: string) =>
    value.some((item) => item.toLowerCase() === color.toLowerCase());

  function add(color: string) {
    const trimmed = color.trim();
    if (!trimmed || has(trimmed)) return;
    onChange([...value, trimmed]);
  }

  function addDraft() {
    add(draft);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter adiciona a cor em vez de enviar o formulário inteiro.
    if (e.key === "Enter") {
      e.preventDefault();
      addDraft();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const suggestions = COLOR_SUGGESTIONS.filter((color) => !has(color));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Cores adicionadas">
          {value.map((color) => (
            <li
              key={color}
              className="flex items-center gap-1 rounded-md border border-brand bg-brand/10 py-1 pr-1 pl-2.5 text-sm text-brand"
            >
              {color}
              <button
                type="button"
                aria-label={`Remover ${color}`}
                onClick={() => onChange(value.filter((item) => item !== color))}
                className="rounded-sm p-0.5 hover:bg-brand/20"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Pastéis, Branco, Preto..."
          maxLength={40}
          disabled={value.length >= 30}
          aria-label="Nova cor preferida"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={addDraft}
          disabled={!draft.trim() || has(draft.trim())}
        >
          <Plus />
          Adicionar
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] text-muted-foreground">
            Sugestões:
          </span>
          {suggestions.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => add(color)}
              className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              + {color}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
