import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { MAINTENANCE_TYPE_LABELS, PrinterMaintenance } from "@/lib/api/printer";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

function describe(maintenance: PrinterMaintenance) {
  const label = MAINTENANCE_TYPE_LABELS[maintenance.type];
  const detail =
    maintenance.type === "NOZZLE_CHANGE"
      ? (maintenance.nozzleInstalled ?? maintenance.description)
      : maintenance.description;
  return detail ? `${label} · ${detail}` : label;
}

// A lista vem da mais recente para a mais antiga: o intervalo de cada linha é
// quantas horas ela aconteceu antes da manutenção seguinte.
function describeInterval(maintenances: PrinterMaintenance[], index: number) {
  const hours = maintenances[index].printerHours;
  if (hours == null) return "-";
  if (index === 0) return `em ${hours} h`;

  const newerHours = maintenances[index - 1].printerHours;
  if (newerHours == null) return `em ${hours} h`;
  return `${newerHours - hours} h antes`;
}

export type PrinterMaintenanceHistoryProps = {
  maintenances: PrinterMaintenance[];
  totalCost: number;
  isLoading: boolean;
  loadError: string | null;
  onSelect: (maintenance: PrinterMaintenance) => void;
};

export function PrinterMaintenanceHistory({
  maintenances,
  totalCost,
  isLoading,
  loadError,
  onSelect,
}: PrinterMaintenanceHistoryProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Histórico de manutenção
        </span>
        {maintenances.length > 0 && (
          <span className="text-[11.5px] text-muted-foreground">
            {formatBRL(totalCost)} no total
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : loadError ? (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      ) : maintenances.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma manutenção registrada ainda.
        </p>
      ) : (
        <ul className="flex flex-col">
          {maintenances.map((maintenance, index) => (
            <li key={maintenance.id}>
              <button
                type="button"
                onClick={() => onSelect(maintenance)}
                className="group grid w-full grid-cols-[96px_1fr_auto_16px] items-center gap-3.5 border-b border-border/60 py-2.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[96px_1fr_110px_92px_16px]"
              >
                <span className="text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDatePtBR(maintenance.date, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="min-w-0 truncate text-[13.5px]">
                  {describe(maintenance)}
                </span>
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                  {describeInterval(maintenances, index)}
                </span>
                <span className="text-right text-[13px] tabular-nums">
                  {maintenance.cost != null ? formatBRL(maintenance.cost) : "-"}
                </span>
                <ArrowUpRight
                  className="size-3.25 justify-self-end text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
