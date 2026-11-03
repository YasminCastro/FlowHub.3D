"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseDecimal } from "@/components/prints/filament-usage-fields";
import {
  ChangedMark,
  SuffixInput,
  changedFieldClass,
} from "@/components/prints/print-bits";
import {
  EMPTY_SLICER_SETTINGS,
  INFILL_PATTERNS,
  SLICERS,
  SLICER_SETTING_KEYS,
  SLICER_SETTING_LABELS,
  SlicerSettingKey,
  SlicerSettings,
  formatDecimalInput,
  hasSlicerSetting,
} from "@/lib/api/print";
import { cn } from "@/lib/utils";

/**
 * Só os ajustes que o usuário marcou, como texto dos campos. A ordem das
 * chaves é a ordem em que foram adicionados.
 */
export type SlicerSettingsDraft = Partial<Record<SlicerSettingKey, string>>;

const SELECT_OPTIONS: Partial<Record<SlicerSettingKey, string[]>> = {
  slicer: SLICERS,
  infillPattern: INFILL_PATTERNS,
};

const SUFFIXES: Partial<Record<SlicerSettingKey, string>> = {
  scalePercent: "%",
  layerHeightMm: "mm",
  infillPercent: "%",
  walls: "",
  temperatureC: "°C",
};

const PLACEHOLDERS: Partial<Record<SlicerSettingKey, string>> = {
  scalePercent: "100",
  layerHeightMm: "0,2",
  infillPercent: "15",
  walls: "2",
  temperatureC: "210",
};

// Inteiros no backend; os outros números aceitam casas decimais.
const INTEGER_KEYS: SlicerSettingKey[] = [
  "infillPercent",
  "walls",
  "temperatureC",
];

export function slicerDraftFrom(
  settings: SlicerSettings | null | undefined,
): SlicerSettingsDraft {
  const draft: SlicerSettingsDraft = {};
  for (const key of SLICER_SETTING_KEYS) {
    if (!hasSlicerSetting(settings, key)) continue;
    const value = settings![key];
    draft[key] = typeof value === "number" ? formatDecimalInput(value) : value!;
  }
  return draft;
}

export function toSlicerSettings(
  draft: SlicerSettingsDraft,
): SlicerSettings | null {
  const keys = Object.keys(draft) as SlicerSettingKey[];
  if (!keys.length) return null;
  const settings: SlicerSettings = { ...EMPTY_SLICER_SETTINGS };
  for (const key of keys) {
    const text = draft[key]?.trim() ?? "";
    if (!text) continue;
    if (key === "slicer" || key === "infillPattern") settings[key] = text;
    else if (key === "extras") settings.extras = text;
    else {
      const value = parseDecimal(text);
      settings[key] = INTEGER_KEYS.includes(key) ? Math.round(value) : value;
    }
  }
  return settings;
}

/** Ajuste marcado e deixado em branco: pede para preencher ou tirar. */
export function slicerDraftProblem(draft: SlicerSettingsDraft) {
  for (const key of Object.keys(draft) as SlicerSettingKey[]) {
    const text = draft[key]?.trim() ?? "";
    const label = SLICER_SETTING_LABELS[key].toLowerCase();
    if (!text) return `Preencha ${label} ou remova o ajuste.`;
    if (key === "scalePercent" && parseDecimal(text) <= 0)
      return "A escala precisa ser maior que zero.";
  }
  return null;
}

export function SlicerSettingsFields({
  value,
  onChange,
  idPrefix,
  changed,
}: {
  value: SlicerSettingsDraft;
  onChange: (next: SlicerSettingsDraft) => void;
  idPrefix: string;
  /** Marca o ajuste que difere do registro de base. */
  changed?: (key: SlicerSettingKey) => boolean;
}) {
  // O que acabou de ser adicionado ganha o foco.
  const [justAdded, setJustAdded] = useState<SlicerSettingKey | null>(null);
  const chosen = Object.keys(value) as SlicerSettingKey[];
  const available = SLICER_SETTING_KEYS.filter((key) => !chosen.includes(key));
  const fields = chosen.filter((key) => key !== "extras");

  function add(key: SlicerSettingKey) {
    const options = SELECT_OPTIONS[key];
    onChange({ ...value, [key]: options ? options[0] : "" });
    setJustAdded(key);
  }

  function remove(key: SlicerSettingKey) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  function setField(key: SlicerSettingKey, text: string) {
    onChange({ ...value, [key]: text });
  }

  function fieldLabel(key: SlicerSettingKey) {
    const id = `${idPrefix}-${key}`;
    return (
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="whitespace-nowrap">
          {SLICER_SETTING_LABELS[key]}
          {changed?.(key) && <ChangedMark />}
        </Label>
        <button
          type="button"
          aria-label={`Remover ${SLICER_SETTING_LABELS[key].toLowerCase()}`}
          onClick={() => remove(key)}
          className="ml-auto grid size-4.5 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  function input(key: SlicerSettingKey) {
    const id = `${idPrefix}-${key}`;
    const isChanged = changed?.(key) ?? false;
    const options = SELECT_OPTIONS[key];
    if (options) {
      return (
        <Select
          value={value[key] || null}
          onValueChange={(next) => next && setField(key, next)}
        >
          <SelectTrigger
            id={id}
            aria-label={SLICER_SETTING_LABELS[key]}
            className={cn("w-full", changedFieldClass(isChanged))}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              ...options,
              ...(value[key] && !options.includes(value[key]!)
                ? [value[key]!]
                : []),
            ].map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <SuffixInput
        id={id}
        autoFocus={justAdded === key}
        suffix={SUFFIXES[key] ?? ""}
        placeholder={PLACEHOLDERS[key]}
        value={value[key] ?? ""}
        onChange={(e) => setField(key, e.target.value)}
        className={changedFieldClass(isChanged)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {fields.map((key) => (
            <div key={key} className="flex min-w-0 flex-col gap-2">
              {fieldLabel(key)}
              {input(key)}
            </div>
          ))}
        </div>
      )}
      {"extras" in value && (
        <div className="flex flex-col gap-2">
          {fieldLabel("extras")}
          <Textarea
            id={`${idPrefix}-extras`}
            autoFocus={justAdded === "extras"}
            className={cn(
              "min-h-16",
              changedFieldClass(changed?.("extras") ?? false),
            )}
            placeholder="Ex.: suporte em árvore, brim 5 mm, velocidade 80%"
            maxLength={500}
            value={value.extras ?? ""}
            onChange={(e) => setField("extras", e.target.value)}
          />
        </div>
      )}
      {!chosen.length && (
        <p className="text-[11.5px] text-muted-foreground">
          Marque só o que você mexeu no fatiador (ex.: escala, camada).
        </p>
      )}
      {available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start text-brand-300"
              />
            }
          >
            <Plus />
            Adicionar ajuste
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-44">
            {available.map((key) => (
              <DropdownMenuItem key={key} onClick={() => add(key)}>
                {SLICER_SETTING_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
