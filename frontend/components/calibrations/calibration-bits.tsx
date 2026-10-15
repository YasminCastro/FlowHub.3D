"use client";

import { Check, Copy, History } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CALIBRATION_AGING_DAYS,
  CALIBRATION_STALE_DAYS,
  Calibration,
  CalibrationValues,
  calibrationClipboardText,
  formatCalibrationAge,
  getCalibrationAgeDays,
} from "@/lib/api/calibration";
import { filamentSwatchBackground } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

/** Rótulo pequeno em caixa alta usado nas seções e cabeçalhos de coluna. */
export function CalLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-heading text-[10px] leading-none font-medium tracking-[0.12em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CalSwatch({
  colors,
  className,
}: {
  colors: string[];
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block size-3.5 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(233,233,237,0.16)]",
        className,
      )}
      style={{ background: filamentSwatchBackground(colors, true) }}
    />
  );
}

/** "há 26 dias" — esmaece com a idade e ganha ícone quando já pede recalibrar. */
export function CalibrationAge({
  calibratedAt,
  className,
}: {
  calibratedAt: string;
  className?: string;
}) {
  const days = getCalibrationAgeDays(calibratedAt);
  const stale = days >= CALIBRATION_STALE_DAYS;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] tabular-nums",
        stale
          ? "text-brand-300"
          : days >= CALIBRATION_AGING_DAYS
            ? "text-foreground/50"
            : "text-foreground/60",
        className,
      )}
      title={stale ? "Calibração antiga — vale refazer" : undefined}
    >
      {stale && <History className="size-3.25" aria-hidden="true" />}
      {formatCalibrationAge(calibratedAt)}
    </span>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return { copied, copy };
}

type CopySource = Pick<Calibration, "filament" | "slicer"> & CalibrationValues;

/** Ícone da linha da lista: copia sem abrir a calibração. */
export function CopyValuesIconButton({
  calibration,
  className,
}: {
  calibration: CopySource;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? "Valores copiados" : "Copiar valores"}
      title={copied ? "Copiado" : "Copiar valores"}
      className={cn(
        copied ? "text-brand" : "text-foreground/40 hover:text-brand",
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        copy(calibrationClipboardText(calibration));
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

export function CopyValuesButton({
  calibration,
  size = "sm",
}: {
  calibration: CopySource;
  size?: "sm" | "default";
}) {
  const { copied, copy } = useCopy();
  return (
    <Button
      type="button"
      size={size}
      onClick={() => copy(calibrationClipboardText(calibration))}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copiado" : "Copiar valores"}
    </Button>
  );
}

/** Divisor vertical que esmaece nas pontas, entre números lado a lado. */
export function CalVRule() {
  return (
    <span
      aria-hidden="true"
      className="w-px self-stretch bg-[linear-gradient(to_bottom,transparent,var(--border)_14px,var(--border)_calc(100%-14px),transparent)]"
    />
  );
}
