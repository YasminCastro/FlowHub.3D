"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalSwatch } from "@/components/calibrations/calibration-bits";
import { CalibrationFilament } from "@/lib/api/calibration";
import { SPOOL_LEVEL_LABELS } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function matches(f: CalibrationFilament, type: string, brandName: string) {
  return (!type || f.type === type) && (!brandName || f.brandName === brandName);
}

type Filter = { type: string; brandName: string };

/**
 * Filamento em três passos, como em Impressões: o material filtra as marcas,
 * material e marca filtram as cores. Se o filtro deixa uma cor só, ela já
 * fica escolhida. As props de acessibilidade (id, aria-*) que o FormControl
 * injeta vão para o seletor de cor, que é o valor do campo.
 */
export function FilamentCascadeSelect({
  filaments,
  value,
  onChange,
  className,
  ...controlProps
}: {
  filaments: CalibrationFilament[];
  value: string;
  onChange: (filamentId: string) => void;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const selected = filaments.find((f) => f.id === value);
  // Sem filtro escolhido à mão, material e marca saem do filamento atual.
  const [picked, setPicked] = useState<Filter | null>(null);
  const type = picked?.type ?? selected?.type ?? "";
  const brandName = picked?.brandName ?? selected?.brandName ?? "";

  const types = unique(filaments.map((f) => f.type));
  const brands = unique(
    filaments.filter((f) => !type || f.type === type).map((f) => f.brandName),
  );
  const options = filaments
    .filter((f) => matches(f, type, brandName))
    .sort((a, b) => a.colorName.localeCompare(b.colorName, "pt-BR"));
  // Com material e marca escolhidos, o nome da cor basta.
  const narrowed = !!type && !!brandName;

  function applyFilter(next: Filter) {
    const brandsForType = unique(
      filaments
        .filter((f) => !next.type || f.type === next.type)
        .map((f) => f.brandName),
    );
    let brand = brandsForType.includes(next.brandName) ? next.brandName : "";
    if (next.type && !brand && brandsForType.length === 1) {
      brand = brandsForType[0];
    }
    setPicked({ type: next.type, brandName: brand });

    const nextOptions = filaments.filter((f) => matches(f, next.type, brand));
    if (selected && nextOptions.some((f) => f.id === selected.id)) return;
    onChange(next.type && brand && nextOptions.length === 1 ? nextOptions[0].id : "");
  }

  // Escolher a cor direto também acerta material e marca. Cor vazia (o Select
  // limpa quando a opção some do filtro) não mexe no filtro.
  function chooseColor(filamentId: string) {
    if (filamentId) setPicked(null);
    onChange(filamentId);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5 md:grid-cols-[130px_150px_minmax(0,1fr)]",
        className,
      )}
    >
      {/* Vazio vai como null: no Select do Base UI, "" não bate com nenhuma
          opção e a lista não abre direito. */}
      <Select
        value={type || null}
        onValueChange={(next) => applyFilter({ type: next ?? "", brandName })}
      >
        <SelectTrigger aria-label="Material do filamento" className="w-full">
          <SelectValue>
            {(v: string) =>
              v || <span className="text-muted-foreground">Material</span>
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={brandName || null}
        onValueChange={(next) => applyFilter({ type, brandName: next ?? "" })}
      >
        <SelectTrigger aria-label="Marca do filamento" className="w-full">
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

      <Select
        value={value || null}
        onValueChange={(next) => chooseColor(next ?? "")}
      >
        <SelectTrigger
          aria-label="Cor do filamento"
          className="col-span-2 w-full md:col-span-1"
          {...controlProps}
        >
          <SelectValue>
            {() =>
              selected ? (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <CalSwatch colors={selected.colors} className="size-3" />
                  <span className="truncate">
                    {narrowed
                      ? selected.colorName
                      : `${selected.type} ${selected.colorName} · ${selected.brandName}`}
                  </span>
                  <span className="ml-auto pl-2 text-[11px] text-muted-foreground">
                    {SPOOL_LEVEL_LABELS[selected.spoolLevel]}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {options.length ? "Cor" : "Nenhum com esse filtro"}
                </span>
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              <CalSwatch colors={f.colors} className="size-3" />
              {narrowed ? f.colorName : `${f.type} ${f.colorName} · ${f.brandName}`}
              <span className="ml-auto pl-3 text-[11px] text-muted-foreground">
                {SPOOL_LEVEL_LABELS[f.spoolLevel]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
