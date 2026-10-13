// Custos e energia: os parâmetros globais que toda peça usa para virar preço.
// Cada impressora herda a tarifa daqui, a menos que tenha tarifa própria.

import { apiFetch } from "./client";
import type { Printer } from "./printer";

export type Currency = "BRL";

export type CostSettings = {
  // Energia
  energyCostPerKwh: number;
  currency: Currency;
  // Trabalho e margem: entram no preço sugerido, não no custo.
  laborCostPerHour: number;
  prepMinutesPerPiece: number;
  defaultMarginPercent: number;
  // Custo fixo somado a toda impressão.
  packagingCost: number;
  failureReservePercent: number;
  otherFixedCost: number;
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: "Real (R$)",
};

export const DEFAULT_COST_SETTINGS: CostSettings = {
  energyCostPerKwh: 0.92,
  currency: "BRL",
  laborCostPerHour: 35,
  prepMinutesPerPiece: 15,
  defaultMarginPercent: 60,
  packagingCost: 1.2,
  failureReservePercent: 7,
  otherFixedCost: 0,
};

export type PrinterTariff = { printerId: string; energyCostPerKwh: number };

export type CostSettingsInput = CostSettings & {
  // Impressoras com tarifa própria; as demais passam a herdar a global.
  printerTariffs: PrinterTariff[];
};

export async function getCostSettings() {
  return (await apiFetch("/cost-settings")) as CostSettings;
}

export async function updateCostSettings(input: CostSettingsInput) {
  const data = (await apiFetch("/cost-settings", {
    method: "PUT",
    body: JSON.stringify(input),
  })) as { message: string; settings: CostSettings };
  return data.settings;
}

// ---------------------------------------------------------------------------
// Cálculos

/** Tarifa própria = gravada na impressora e diferente da global. */
export function hasOwnTariff(
  printer: Pick<Printer, "energyCostPerKwh">,
  settings: Pick<CostSettings, "energyCostPerKwh">,
) {
  return (
    printer.energyCostPerKwh != null &&
    printer.energyCostPerKwh !== settings.energyCostPerKwh
  );
}

export function getPrinterCostPerHour(
  printer: Pick<Printer, "powerConsumptionW" | "maintenanceCostPerHour">,
  tariffPerKwh: number,
) {
  const energy = ((printer.powerConsumptionW ?? 0) / 1000) * tariffPerKwh;
  return energy + (printer.maintenanceCostPerHour ?? 0);
}
