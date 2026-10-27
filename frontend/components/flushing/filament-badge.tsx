import { filamentSwatchBackground } from "@/lib/api/filament";
import { cn } from "@/lib/utils";

// Número da cor legível sobre a amostra: escuro nas cores claras.
function isLight(colors: string[]) {
  const hex = colors[0]?.replace("#", "");
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/** O número do filamento na tabela, na cor dele, como no fatiador. Sem
 * filamento escolhido, fica cinza. */
export function FilamentBadge({
  n,
  filament,
}: {
  n: number;
  filament?: {
    colors: string[];
    colorName: string;
    type: string;
    brandName: string;
  };
}) {
  return (
    <span
      title={
        filament
          ? `${filament.type} ${filament.colorName} · ${filament.brandName}`
          : undefined
      }
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-sm font-heading text-[11px] font-medium tabular-nums shadow-[inset_0_0_0_1px_rgba(233,233,237,0.16)]",
        filament && isLight(filament.colors) ? "text-[#161826]" : "text-white",
        !filament && "bg-neutral-700",
      )}
      style={
        filament
          ? { background: filamentSwatchBackground(filament.colors, true) }
          : undefined
      }
    >
      {n}
    </span>
  );
}
