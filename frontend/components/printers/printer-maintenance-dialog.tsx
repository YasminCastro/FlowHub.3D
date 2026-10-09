import {
  Brush,
  CircleDot,
  Droplet,
  Plus,
  RefreshCw,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/auth";
import {
  MAINTENANCE_TYPE_LABELS,
  MaintenanceType,
  PrinterMaintenance,
  registerPrinterMaintenance,
  updatePrinterMaintenance,
} from "@/lib/api/printer";
import { cn } from "@/lib/utils";

export const MAINTENANCE_TYPE_ICONS: Record<MaintenanceType, LucideIcon> = {
  LUBRICATION: Droplet,
  CLEANING: Brush,
  NOZZLE_CHANGE: CircleDot,
  OTHER: Plus,
};

export type PrinterMaintenanceDialogProps = {
  printerId: string;
  printerName: string;
  currentNozzle: string | null;
  lastPrinterHours: number | null;
  // Quando informada, o diálogo edita esta manutenção em vez de registrar uma nova.
  maintenance?: PrinterMaintenance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
};

function todayISODate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

type FormState = {
  type: MaintenanceType;
  date: string;
  printerHours: string;
  cost: string;
  description: string;
  nozzleInstalled: string;
  nozzleRemoved: string;
};

function initialState(
  lastPrinterHours: number | null,
  currentNozzle: string | null,
  maintenance?: PrinterMaintenance | null,
): FormState {
  if (maintenance) {
    return {
      type: maintenance.type,
      date: maintenance.date.slice(0, 10),
      printerHours: maintenance.printerHours?.toString() ?? "",
      cost: maintenance.cost?.toString() ?? "",
      description: maintenance.description ?? "",
      nozzleInstalled: maintenance.nozzleInstalled ?? "",
      nozzleRemoved: maintenance.nozzleRemoved ?? "",
    };
  }

  return {
    type: "LUBRICATION",
    date: todayISODate(),
    printerHours: lastPrinterHours?.toString() ?? "",
    cost: "",
    description: "",
    nozzleInstalled: "",
    nozzleRemoved: currentNozzle ?? "",
  };
}

export function PrinterMaintenanceDialog({
  printerId,
  printerName,
  currentNozzle,
  lastPrinterHours,
  maintenance,
  open,
  onOpenChange,
  onRegistered,
}: PrinterMaintenanceDialogProps) {
  const isEditing = maintenance != null;
  const [form, setForm] = useState(() =>
    initialState(lastPrinterHours, currentNozzle, maintenance),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // O diálogo é aberto pela página (prop `open`), então o formulário é
  // reiniciado aqui, a cada abertura, com a manutenção que será editada.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(initialState(lastPrinterHours, currentNozzle, maintenance));
      setSaveError(null);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const isNozzleChange = form.type === "NOZZLE_CHANGE";
  const hours = toNumber(form.printerHours);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.date) {
      setSaveError("Informe a data da manutenção.");
      return;
    }

    // Na edição, null limpa o campo; no registro, campo vazio não é enviado.
    const input = {
      type: form.type,
      date: form.date,
      printerHours: hours ?? null,
      cost: toNumber(form.cost) ?? null,
      description: form.description.trim() || null,
      nozzleInstalled: isNozzleChange
        ? form.nozzleInstalled.trim() || null
        : null,
      nozzleRemoved: isNozzleChange ? form.nozzleRemoved.trim() || null : null,
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      if (isEditing) {
        await updatePrinterMaintenance(printerId, maintenance.id, input);
      } else {
        await registerPrinterMaintenance(printerId, {
          type: input.type,
          date: input.date,
          printerHours: input.printerHours ?? undefined,
          cost: input.cost ?? undefined,
          description: input.description ?? undefined,
          nozzleInstalled: input.nozzleInstalled ?? undefined,
          nozzleRemoved: input.nozzleRemoved ?? undefined,
        });
      }
      onRegistered();
      onOpenChange(false);
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : isEditing
            ? "Não foi possível salvar a manutenção."
            : "Não foi possível registrar a manutenção.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-140">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-start gap-3 px-6 pt-5 pb-4">
            <Wrench
              className="mt-0.5 size-4.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle className="font-heading text-[17px] font-medium leading-tight">
                {isEditing ? "Editar manutenção" : "Registrar manutenção"}
              </DialogTitle>
              <DialogDescription className="text-[12.5px]">
                {printerName}
                {lastPrinterHours != null &&
                  ` · última leitura em ${lastPrinterHours} h`}
              </DialogDescription>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4 px-6 pt-4.5 pb-1">
            <div className="flex flex-col gap-2">
              <Label id="maintenance-type-label">Tipo</Label>
              <div
                role="radiogroup"
                aria-labelledby="maintenance-type-label"
                className="flex flex-wrap gap-1.5"
              >
                {(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map(
                  (type) => {
                    const Icon = MAINTENANCE_TYPE_ICONS[type];
                    const isSelected = form.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => update("type", type)}
                        className={cn(
                          "flex items-center gap-2 whitespace-nowrap rounded-md border px-2.75 py-1.5 text-[13px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary hover:bg-primary/5 hover:text-primary",
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {MAINTENANCE_TYPE_LABELS[type]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maintenance-date">Data</Label>
                  <Input
                    id="maintenance-date"
                    type="date"
                    value={form.date}
                    max={todayISODate()}
                    onChange={(event) => update("date", event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maintenance-hours">Horas da impressora</Label>
                  <Input
                    id="maintenance-hours"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={form.printerHours}
                    onChange={(event) =>
                      update("printerHours", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maintenance-cost">Custo (R$)</Label>
                  <Input
                    id="maintenance-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0,00"
                    className="tabular-nums"
                    value={form.cost}
                    onChange={(event) => update("cost", event.target.value)}
                  />
                </div>
              </div>
            </div>

            {isNozzleChange && (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="maintenance-nozzle-installed">
                      Bico instalado
                    </Label>
                    <Input
                      id="maintenance-nozzle-installed"
                      placeholder="Ex.: 0,4 mm · aço endurecido"
                      value={form.nozzleInstalled}
                      onChange={(event) =>
                        update("nozzleInstalled", event.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="maintenance-nozzle-removed">
                      Bico retirado
                    </Label>
                    <Input
                      id="maintenance-nozzle-removed"
                      placeholder="Ex.: 0,4 mm · latão"
                      value={form.nozzleRemoved}
                      onChange={(event) =>
                        update("nozzleRemoved", event.target.value)
                      }
                    />
                  </div>
                </div>
                <p className="flex items-center gap-1.75 text-[11.5px] text-muted-foreground">
                  <RefreshCw className="size-3.25 shrink-0" aria-hidden="true" />
                  A ficha técnica da impressora passa a mostrar o bico novo.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="maintenance-description">
                O que foi feito
                <span className="font-normal text-muted-foreground">
                  opcional
                </span>
              </Label>
              <Textarea
                id="maintenance-description"
                rows={3}
                placeholder="Ex.: graxa nos eixos X e Y, correias reapertadas"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>

            {saveError && (
              <p role="alert" className="text-[12.5px] text-destructive">
                {saveError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 px-6 pt-4.5 pb-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
              {isEditing
                ? isSaving
                  ? "Salvando..."
                  : "Salvar"
                : isSaving
                  ? "Registrando..."
                  : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
