"use client";

import { ChevronLeft, Pipette, Plus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilamentSwatch } from "@/components/filaments/filament-swatch";
import { FILAMENT_COLORS_MAX_COUNT, isValidHex } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  "#2f313c",
  "#f0efe9",
  "#5f6570",
  "#6e473b",
  "#4a86c4",
  "#3f8f6d",
  "#c9a24a",
  "#c4473f",
];

// Conta-gotas do navegador (Chrome e Edge): pega uma cor de qualquer lugar
// da tela, como a foto do rolo na loja.
type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

function getEyeDropper() {
  return (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

// Só existe no navegador; no servidor o botão não aparece.
function useEyeDropperSupport() {
  return useSyncExternalStore(
    () => () => {},
    () => !!getEyeDropper(),
    () => false,
  );
}

function slotLabel(index: number) {
  return index === 0 ? "Cor principal" : `Cor ${index + 1}`;
}

export type FilamentColorsInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  /** Mostra os hex inválidos (depois da primeira tentativa de salvar). */
  showErrors?: boolean;
};

export function FilamentColorsInput({
  value,
  onChange,
  showErrors,
}: FilamentColorsInputProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickError, setPickError] = useState<string | null>(null);
  const supportsEyeDropper = useEyeDropperSupport();
  const active = Math.min(activeIndex, value.length - 1);

  function setColor(index: number, color: string) {
    onChange(value.map((item, i) => (i === index ? color : item)));
  }

  function addColor() {
    if (value.length >= FILAMENT_COLORS_MAX_COUNT) return;
    // Começa igual à última; a ideia é trocar logo em seguida.
    onChange([...value, value[value.length - 1]]);
    setActiveIndex(value.length);
  }

  function removeColor(index: number) {
    onChange(value.filter((_, i) => i !== index));
    setActiveIndex((prev) => (prev >= index ? Math.max(prev - 1, 0) : prev));
  }

  // Troca com a anterior: a ordem é a ordem do degradê.
  function moveLeft(index: number) {
    const next = [...value];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
    setActiveIndex(index - 1);
  }

  async function pickFromScreen() {
    const EyeDropper = getEyeDropper();
    if (!EyeDropper) return;
    setPickError(null);
    try {
      const { sRGBHex } = await new EyeDropper().open();
      if (isValidHex(sRGBHex)) {
        setColor(active, sRGBHex.toLowerCase());
      } else {
        setPickError("Não deu para ler essa cor. Digite o hex.");
      }
    } catch {
      // Esc fecha o conta-gotas sem escolher: não é erro.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-4">
        <FilamentSwatch colors={value} className="mt-5.5 size-11.5" />

        {value.map((color, index) => {
          const invalid = showErrors && !isValidHex(color);
          return (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-2 rounded-md p-1.5 -m-1.5 transition-colors",
                value.length > 1 && index === active && "bg-brand/8",
              )}
              onFocusCapture={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
            >
              <span className="text-sm font-medium">{slotLabel(index)}</span>
              <div className="flex items-center gap-1.5">
                <label className="relative cursor-pointer">
                  <span
                    aria-hidden="true"
                    className="block size-9 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                    style={{
                      background: isValidHex(color) ? color : "transparent",
                    }}
                  />
                  <input
                    type="color"
                    aria-label={`Escolher ${slotLabel(index).toLowerCase()}`}
                    value={isValidHex(color) ? color : "#000000"}
                    onChange={(e) => setColor(index, e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
                <Input
                  value={color}
                  onChange={(e) => setColor(index, e.target.value.trim())}
                  aria-label={`Hex da ${slotLabel(index).toLowerCase()}`}
                  aria-invalid={invalid || undefined}
                  maxLength={7}
                  className="w-26 tabular-nums"
                />
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Mover ${slotLabel(index).toLowerCase()} para antes`}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLeft(index);
                    }}
                  >
                    <ChevronLeft />
                  </Button>
                )}
                {value.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Remover ${slotLabel(index).toLowerCase()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeColor(index);
                    }}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {invalid && (
                <p className="text-[12.5px] text-destructive">
                  Use o formato #rrggbb.
                </p>
              )}
            </div>
          );
        })}

        {value.length < FILAMENT_COLORS_MAX_COUNT && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-7"
            onClick={addColor}
          >
            <Plus />
            Cor
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12.5px] text-muted-foreground">
          {value.length > 1
            ? `Aplicar na ${slotLabel(active).toLowerCase()}:`
            : "Cores rápidas:"}
        </span>
        <div className="flex gap-1.5" role="group" aria-label="Cores rápidas">
          {COLOR_PRESETS.map((hex) => {
            const selected = value[active]?.toLowerCase() === hex;
            return (
              <button
                key={hex}
                type="button"
                aria-label={`Usar ${hex}`}
                aria-pressed={selected}
                onClick={() => setColor(active, hex)}
                className={cn(
                  "size-6 rounded-sm",
                  selected &&
                    "shadow-[0_0_0_2px_var(--background),0_0_0_3.5px_var(--brand)]",
                )}
                style={{ background: hex }}
              />
            );
          })}
        </div>
        {supportsEyeDropper && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1"
            onClick={pickFromScreen}
          >
            <Pipette />
            Pegar da tela
          </Button>
        )}
      </div>

      <p className="text-[12.5px] text-muted-foreground/80">
        {pickError ??
          "Rolos duo e tri color: adicione até 3 cores, na ordem em que aparecem no fio."}
      </p>
    </div>
  );
}
