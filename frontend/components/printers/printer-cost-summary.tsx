import { Wrench } from "lucide-react";

import { formatBRL } from "@/lib/utils";

export type PrinterCostSummaryProps = {
  energyCostPerHour: number;
  maintenanceCostPerHour: number;
  onMarkMaintenance?: () => void;
};

export function PrinterCostSummary({
  energyCostPerHour,
  maintenanceCostPerHour,
  onMarkMaintenance,
}: PrinterCostSummaryProps) {
  const totalCostPerHour = energyCostPerHour + maintenanceCostPerHour;
  const energyShare =
    totalCostPerHour > 0
      ? Math.round((energyCostPerHour / totalCostPerHour) * 100)
      : 0;

  return (
    <div className="flex w-full flex-col gap-6 lg:w-80 lg:flex-none lg:border-l lg:pl-6">
      <section className="flex flex-col gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Custo por hora
        </span>
        <span className="font-heading text-3xl font-medium">
          {formatBRL(totalCostPerHour)}
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${energyShare}%` }}
          />
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
            <span className="text-muted-foreground">Energia</span>
            <span className="ml-auto font-medium">
              {formatBRL(energyCostPerHour)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-brand/40"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">Manutenção</span>
            <span className="ml-auto font-medium">
              {formatBRL(maintenanceCostPerHour)}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={onMarkMaintenance}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:bg-accent hover:text-foreground"
        >
          <Wrench className="size-4" />
          Marcar em manutenção
        </button>
      </div>
    </div>
  );
}
