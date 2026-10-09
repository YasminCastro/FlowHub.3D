import { useRouter } from "next/navigation";
import { Printer as PrinterIcon } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type PrinterStat = {
  label: string;
  value: string;
  caption?: string;
};

export type PrinterCardProps = {
  name: string;
  brand?: string | null;
  details?: (string | null | undefined)[];
  stats: PrinterStat[];
  href?: string;
  className?: string;
};

export function PrinterCard({
  name,
  details = [],
  stats,
  href,
  className,
}: PrinterCardProps) {
  const router = useRouter();
  const subtitle = details.filter(Boolean).join(" · ");

  return (
    <div
      role={href ? "link" : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={href ? () => router.push(href) : undefined}
      onKeyDown={
        href
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(href);
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col gap-4 rounded-md border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brand)_50%,transparent),0_0_18px_-8px_var(--color-brand)]",
        href && "cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <PrinterIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-lg font-medium leading-none">
                {name}
              </span>
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-32 flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </span>
            <span className="text-2xl font-medium">{stat.value}</span>
            {stat.caption && (
              <span className="text-xs text-muted-foreground">
                {stat.caption}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
