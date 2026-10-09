import { Star } from "lucide-react";

import { formatRating } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

// Nota pequena do card: "★ 4,0".
export function FilamentRatingBadge({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
      <Star className="size-3 fill-brand text-brand" aria-hidden="true" />
      {formatRating(rating)}
    </span>
  );
}

export type FilamentRatingInputProps = {
  value: number | null;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

// Cinco estrelas; sem onChange vira só leitura.
export function FilamentRatingInput({
  value,
  onChange,
  size = "md",
  disabled,
}: FilamentRatingInputProps) {
  const iconSize = size === "sm" ? "size-4" : "size-5.5";

  return (
    <div
      role={onChange ? "radiogroup" : "img"}
      aria-label={
        onChange
          ? "Sua nota"
          : value
            ? `Nota ${formatRating(value)} de 5`
            : "Sem nota"
      }
      className="flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value != null && star <= value;
        const icon = (
          <Star
            className={cn(
              iconSize,
              filled ? "fill-brand text-brand" : "text-foreground/30",
            )}
            aria-hidden="true"
          />
        );
        if (!onChange) return <span key={star}>{icon}</span>;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
            disabled={disabled}
            onClick={() => onChange(star)}
            className="rounded-sm transition-transform hover:scale-110 disabled:opacity-50"
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
