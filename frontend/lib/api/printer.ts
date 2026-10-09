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
        ? formatDatePtBR(printer.lastMaintenanceDate, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          })
        : "-",
    },
  ];
}

export type MaintenanceType =
  | "LUBRICATION"
  | "CLEANING"
  | "NOZZLE_CHANGE"
  | "OTHER";

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  LUBRICATION: "Lubrificação",
  CLEANING: "Limpeza",
  NOZZLE_CHANGE: "Troca de bico",
  OTHER: "Outro",
};

export type PrinterMaintenance = {
  id: string;
  type: MaintenanceType;
  date: string;
  printerHours: number | null;
  cost: number | null;
  description: string | null;
  remindAfterHours: number | null;
  nozzleInstalled: string | null;
  nozzleRemoved: string | null;
  printerId: string;
  createdAt: string;
};

export type PrinterMaintenanceInput = {
  type: MaintenanceType;
  date: string;
  printerHours?: number;
  cost?: number;
  description?: string;
  nozzleInstalled?: string;
  nozzleRemoved?: string;
};

export async function listPrinterMaintenances(printerId: string) {
  return (await apiFetch(`/printer/${printerId}/maintenance`)) as {
    maintenances: PrinterMaintenance[];
    totalCost: number;
  };
}

export async function registerPrinterMaintenance(
  printerId: string,
  input: PrinterMaintenanceInput,
) {
  const data = (await apiFetch(`/printer/${printerId}/maintenance`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as { message: string; data: PrinterMaintenance };
  return data.data;
}

// Na edição, null limpa um campo opcional que já estava preenchido.
export type PrinterMaintenanceUpdateInput = {
  type?: MaintenanceType;
  date?: string;
  printerHours?: number | null;
  cost?: number | null;
  description?: string | null;
  nozzleInstalled?: string | null;
  nozzleRemoved?: string | null;
};

export async function updatePrinterMaintenance(
  printerId: string,
  maintenanceId: string,
  input: PrinterMaintenanceUpdateInput,
) {
  const data = (await apiFetch(
    `/printer/${printerId}/maintenance/${maintenanceId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  )) as { message: string; data: PrinterMaintenance };
  return data.data;
}

export async function deletePrinterMaintenance(
  printerId: string,
  maintenanceId: string,
) {
  return (await apiFetch(`/printer/${printerId}/maintenance/${maintenanceId}`, {
    method: "DELETE",
  })) as { message: string };
}
