import { CircleX } from "lucide-react";

import { SPOOL_LEVEL_LABELS, SpoolLevel } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

const FILLED_SEGMENTS: Record<SpoolLevel, number> = {
  FULL: 3,
  LOW: 1,
  FINISHED: 0,
};

// Medidor de 3 traços: o nível é marcado à mão, então ele mostra uma
// faixa (cheio / acabando / acabou), não uma quantidade exata.
export function SpoolLevelMeter({
  level,
  className,
}: {
  level: SpoolLevel;
  className?: string;
}) {
  if (level === "FINISHED") {
    return <CircleX className={cn("size-3.5", className)} aria-hidden="true" />;
  }
  const filled = FILLED_SEGMENTS[level];
  return (
    <span
      aria-hidden="true"
      className={cn("flex items-end gap-0.5", className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-[1px]",
            ["h-1.5", "h-2.5", "h-3.5"][i],
            i < filled
              ? level === "LOW"
                ? "bg-brand-300"
                : "bg-brand"
              : "bg-foreground/15",
          )}
        />
      ))}
    </span>
  );
}

const LEVEL_HINTS: Record<SpoolLevel, string> = {
  FULL: "dá para qualquer peça",
  LOW: "só peças pequenas",
  FINISHED: "carretel vazio",
};

export type SpoolLevelPickerProps = {
  value: SpoolLevel;
  onChange: (level: SpoolLevel) => void;
  disabled?: boolean;
};

export function SpoolLevelPicker({
  value,
  onChange,
  disabled,
}: SpoolLevelPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Nível do carretel"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      {(["FULL", "LOW", "FINISHED"] as SpoolLevel[]).map((level) => {
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors disabled:opacity-50",
              selected
                ? "border-brand bg-brand/10"
                : "border-border hover:bg-foreground/5",
            )}
          >
            <SpoolLevelMeter
              level={level}
              className={cn(
                level === "FINISHED" &&
                  (selected ? "text-brand" : "text-muted-foreground"),
              )}
            />
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  selected ? "text-brand" : "text-foreground",
                )}
              >
                {SPOOL_LEVEL_LABELS[level]}
              </span>
              <span className="text-xs text-muted-foreground">
                {LEVEL_HINTS[level]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
