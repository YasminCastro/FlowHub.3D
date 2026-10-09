import { formatBRL } from "@/lib/utils";
import { Printer } from "@/lib/api/printer";

function SpecField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export function PrinterSpecCard({ printer }: { printer: Printer }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        Ficha técnica
      </span>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SpecField label="Bico atual" value={printer.nozzle ?? "-"} />
        <SpecField
          label="Consumo médio"
          value={
            printer.powerConsumptionW != null
              ? `${printer.powerConsumptionW} W`
              : "-"
          }
        />
        <SpecField
          label="Tarifa de energia"
          value={
            printer.energyCostPerKwh != null
              ? `${formatBRL(printer.energyCostPerKwh)} / kWh`
              : "-"
          }
        />
        <SpecField
          label="Manutenção"
          value={
            printer.maintenanceCostPerHour != null
              ? `${formatBRL(printer.maintenanceCostPerHour)} / h`
              : "-"
          }
        />
      </div>
    </section>
  );
}
