import { Badge } from "@/components/ui/badge";
import { JOURNAL_STATUS_LABELS, JournalStatus } from "@/lib/api/journal";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<JournalStatus, string> = {
  RESOLVED: "",
  IN_PROGRESS: "border-[#d9b45e]/50 bg-transparent text-[#d9b45e]",
  UNRESOLVED: "border-[#e07a7a]/50 bg-transparent text-[#e07a7a]",
};

export function JournalStatusBadge({
  status,
  className,
}: {
  status: JournalStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={status === "RESOLVED" ? "default" : "outline"}
      className={cn(
        "h-auto px-2 py-0.5 text-[9.5px] uppercase tracking-wider",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {JOURNAL_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Número da tentativa; no acento quando foi a que resolveu. */
export function AttemptNumber({
  n,
  worked,
  className,
}: {
  n: number;
  worked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-4.75 shrink-0 place-items-center rounded-full font-heading text-[10px] font-medium tabular-nums",
        worked
          ? "bg-brand text-[#161826]"
          : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--neutral-700)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

export function FilamentDot({
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
        "inline-block size-2 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(233,233,237,0.3)]",
        className,
      )}
      style={{ background: colors[0] ?? "#888" }}
    />
  );
}
