import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="text-[11px] text-brand-300 tabular-nums">{n}</span>
        <h2 className="font-heading text-[17px] font-medium">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Cartão de escolha com rádio: o selecionado ganha o contorno da cor de
 * destaque e mostra o conteúdo extra (um seletor, por exemplo).
 */
export function ChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-md px-3.75 py-3.5 transition-colors",
        selected
          ? "bg-brand/8 shadow-[inset_0_0_0_1px_var(--brand-700)]"
          : "shadow-[inset_0_0_0_1px_var(--neutral-700)] hover:bg-foreground/3",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="flex min-w-0 items-start gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
            selected
              ? "shadow-[inset_0_0_0_1.5px_var(--brand)]"
              : "shadow-[inset_0_0_0_1.5px_var(--neutral-600)]",
          )}
        >
          {selected && <span className="size-2 rounded-full bg-brand" />}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-[13.5px]">
            <Icon
              className={cn(
                "size-3.75",
                selected ? "text-brand" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            {title}
          </span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </span>
      </button>
      {selected && children && <div className="pl-7">{children}</div>}
    </div>
  );
}

export function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2"
    >
      {children}
    </div>
  );
}

export function PositionToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex self-start rounded-md border border-border p-0.5"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[5px] px-3.25 py-1.25 text-[13px] transition-colors",
              selected
                ? "bg-brand/14 text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
