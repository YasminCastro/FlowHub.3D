import { filamentSwatchBackground } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

export type FilamentSwatchProps = {
  colors: string[];
  /** Amostra pequena (lista): transição mais curta entre as cores. */
  compact?: boolean;
  className?: string;
};

// A cor é a identidade do filamento: aparece no lugar de ícone em card,
// detalhe e formulário.
export function FilamentSwatch({
  colors,
  compact,
  className,
}: FilamentSwatchProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block size-10.5 shrink-0 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
        className,
      )}
      style={{ background: filamentSwatchBackground(colors, compact) }}
    />
  );
}
