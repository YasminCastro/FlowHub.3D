import { Pencil, Trash2 } from "lucide-react";

import { MAINTENANCE_TYPE_ICONS } from "@/components/printers/printer-maintenance-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  MAINTENANCE_TYPE_LABELS,
  PrinterMaintenance,
} from "@/lib/api/printer";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

export type PrinterMaintenanceDetailDialogProps = {
  printerName: string;
  maintenance: PrinterMaintenance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function PrinterMaintenanceDetailDialog({
  printerName,
  maintenance,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: PrinterMaintenanceDetailDialogProps) {
  if (!maintenance) return null;

  const Icon = MAINTENANCE_TYPE_ICONS[maintenance.type];
  const date = formatDatePtBR(maintenance.date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-120">
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <Icon
            className="mt-0.5 size-4.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle className="font-heading text-[17px] font-medium leading-tight">
              {MAINTENANCE_TYPE_LABELS[maintenance.type]}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {printerName} · {date}
            </DialogDescription>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-3 gap-4">
            <DetailField label="Data" value={date} />
            <DetailField
              label="Horas da impressora"
              value={
                maintenance.printerHours != null
                  ? `${maintenance.printerHours} h`
                  : "-"
              }
            />
            <DetailField
              label="Custo"
              value={
                maintenance.cost != null ? formatBRL(maintenance.cost) : "-"
              }
            />
          </div>

          {maintenance.type === "NOZZLE_CHANGE" && (
            <div className="grid grid-cols-2 gap-4">
              <DetailField
                label="Bico instalado"
                value={maintenance.nozzleInstalled ?? "-"}
              />
              <DetailField
                label="Bico retirado"
                value={maintenance.nozzleRemoved ?? "-"}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              O que foi feito
            </span>
            {maintenance.description ? (
              <p className="whitespace-pre-wrap text-sm">
                {maintenance.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma descrição.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-6 pb-5">
          <Button type="button" variant="destructive" onClick={onDelete}>
            <Trash2 />
            Excluir
          </Button>
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            onClick={onEdit}
          >
            <Pencil />
            Editar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
