import { Box, CheckCircle2, XCircle } from "lucide-react";
import { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { PrintOutcome } from "@/lib/api/print";
import { cn } from "@/lib/utils";

// Vermelho das falhas e do custo perdido.
export const FAILURE_COLOR = "#d97a7a";

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function OptionalHint() {
  return <span className="font-normal text-muted-foreground/70">opcional</span>;
}

/** Número grande com rótulo em caixa alta, como nos resumos do topo. */
export function Stat({
  label,
  value,
  size = "md",
  danger,
  hint,
}: {
  label: string;
  value: ReactNode;
  size?: "sm" | "md" | "lg";
  danger?: boolean;
  // Aparece no hover.
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5" title={hint}>
      <SectionLabel>{label}</SectionLabel>
      <span
        className={cn(
          "font-heading leading-none font-medium tracking-[-0.02em] tabular-nums",
          size === "sm" && "text-[22px]",
          size === "md" && "text-[28px]",
          size === "lg" && "text-3xl",
        )}
        style={danger ? { color: FAILURE_COLOR } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function StatDivider() {
  return (
    <span
      aria-hidden="true"
      className="w-px self-stretch bg-linear-to-b from-transparent via-border to-transparent"
    />
  );
}

/** Fundo listrado no lugar da foto, enquanto a peça não tem uma. */
export function PhotoPlaceholder({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center bg-[repeating-linear-gradient(135deg,#20222f_0_8px,#252838_8px_16px)] text-foreground/25",
        className,
      )}
    >
      {children ?? <Box className="size-6" aria-hidden="true" />}
    </div>
  );
}

export function OutcomeIcon({
  outcome,
  className,
}: {
  outcome: PrintOutcome;
  className?: string;
}) {
  return outcome === "SUCCESS" ? (
    <CheckCircle2
      className={cn("size-4 text-brand", className)}
      aria-label="Sucesso"
    />
  ) : (
    <XCircle
      className={cn("size-4", className)}
      style={{ color: FAILURE_COLOR }}
      aria-label="Falha"
    />
  );
}

/** Marca "mudou" ao lado do rótulo de um campo diferente do registro de base. */
export function ChangedMark() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 text-[10.5px] font-normal text-brand-300">
      <span className="size-1.25 rounded-full bg-brand" />
      mudou
    </span>
  );
}

export function changedFieldClass(changed: boolean) {
  return changed ? "shadow-[inset_0_0_0_1px_var(--brand-700)]" : undefined;
}

/** Campo numérico com a unidade escrita dentro, à direita (g, mm, °C...). */
export function SuffixInput({
  suffix,
  className,
  ...props
}: ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        className={cn("pr-9 tabular-nums", className)}
        {...props}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

export function OutcomeToggle({
  value,
  onChange,
}: {
  value: PrintOutcome;
  onChange: (value: PrintOutcome) => void;
}) {
  const options = [
    { value: "SUCCESS" as const, label: "Sucesso", icon: CheckCircle2 },
    { value: "FAILURE" as const, label: "Falha", icon: XCircle },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Resultado"
      className="inline-flex self-start rounded-md border border-border p-0.5"
    >
      {options.map(({ value: option, label, icon: Icon }) => {
        const selected = value === option;
        const isFailure = option === "FAILURE";
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-4 py-1.5 text-[13px] transition-colors",
              selected
                ? isFailure
                  ? "bg-[#d97a7a]/14 text-[#d97a7a]"
                  : "bg-brand/14 text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Tempo digitado em dois campos; vazio nos dois = não informado.
export type DurationDraft = { hours: string; minutes: string };

export const EMPTY_DURATION: DurationDraft = { hours: "", minutes: "" };

export function minutesToDuration(total: number): DurationDraft {
  const rounded = Math.max(0, Math.round(total));
  return {
    hours: String(Math.floor(rounded / 60)),
    minutes: String(rounded % 60),
  };
}

export function durationToMinutes(duration: DurationDraft) {
  if (!duration.hours && !duration.minutes) return null;
  return Number(duration.hours || 0) * 60 + Number(duration.minutes || 0);
}

/** Horas e minutos lado a lado; aceita só dígitos. */
export function DurationInput({
  id,
  value,
  onChange,
  label,
  className,
}: {
  id: string;
  value: DurationDraft;
  onChange: (next: DurationDraft) => void;
  /** Nome do campo, para o leitor de tela dos dois inputs. */
  label: string;
  className?: string;
}) {
  const digits = (text: string) => text.replace(/\D/g, "").slice(0, 3);
  return (
    <div className={cn("grid grid-cols-2 gap-1.5", className)}>
      <SuffixInput
        id={id}
        suffix="h"
        inputMode="numeric"
        placeholder="0"
        aria-label={`${label}: horas`}
        className="pr-6"
        value={value.hours}
        onChange={(e) => onChange({ ...value, hours: digits(e.target.value) })}
      />
      <SuffixInput
        suffix="min"
        inputMode="numeric"
        placeholder="0"
        aria-label={`${label}: minutos`}
        className="pr-9"
        value={value.minutes}
        onChange={(e) =>
          onChange({ ...value, minutes: digits(e.target.value).slice(0, 2) })
        }
      />
    </div>
  );
}
