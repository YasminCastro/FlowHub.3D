import { apiFetch } from "./client";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

export type Printer = {
  id: string;
  name: string;
  brand: string;
  nozzle: string | null;
  extrusionType: string | null;
  filamentsTypes: string[];
  powerConsumptionW: number | null;
  energyCostPerKwh: number | null;
  maintenanceCostPerHour: number | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  lastMaintenanceDate: string | null;
  notes: string | null;
};

export type PrinterInput = {
  name: string;
  brand: string;
  nozzle?: string;
  extrusionType?: string;
  filamentsTypes?: string[];
  powerConsumptionW?: number;
  energyCostPerKwh?: number;
  maintenanceCostPerHour?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  lastMaintenanceDate?: string;
  notes?: string;
};

export async function listPrinters() {
  return (await apiFetch("/printer")) as Printer[];
}

export async function getPrinter(id: string) {
  return (await apiFetch(`/printer/${id}`)) as Printer;
}

export async function createPrinter(input: PrinterInput) {
  const data = (await apiFetch("/printer", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: Printer };
  return data.data;
}

export async function updatePrinter(id: string, input: Partial<PrinterInput>) {
  const data = (await apiFetch(`/printer/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { message: string; printer: Printer };
  return data.printer;
}

export async function deletePrinter(id: string) {
  return (await apiFetch(`/printer/${id}`, {
    method: "DELETE",
  })) as { message: string };
}

export type PrinterStat = {
  label: string;
  value: string;
  caption?: string;
};

export function buildPrinterStats(printer: Printer): PrinterStat[] {
  const hasEnergyCost =
    printer.powerConsumptionW != null && printer.energyCostPerKwh != null;
  const energyCostPerHour = hasEnergyCost
    ? (printer.powerConsumptionW! / 1000) * printer.energyCostPerKwh!
    : null;

  return [
    {
      label: "Consumo",
      value:
        printer.powerConsumptionW != null
          ? `${printer.powerConsumptionW} W`
          : "-",
      caption: "médio em impressão",
    },
    {
      label: "Custo de energia",
      value: energyCostPerHour != null ? `${formatBRL(energyCostPerHour)} / h` : "-",
      caption:
        printer.energyCostPerKwh != null
          ? `tarifa ${formatBRL(printer.energyCostPerKwh)} / kWh`
          : undefined,
    },
    {
      label: "Custo de manutenção",
      value:
        printer.maintenanceCostPerHour != null
          ? `${formatBRL(printer.maintenanceCostPerHour)} / h`
          : "-",
    },
    {
      label: "Última manutenção",
      value: printer.lastMaintenanceDate
        ? formatDatePtBR(printer.lastMaintenanceDate)
        : "-",
    },
  ];
}
