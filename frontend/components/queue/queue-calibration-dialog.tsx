"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FilamentCascadeSelect } from "@/components/calibrations/filament-cascade-select";
import { PositionToggle } from "@/components/queue/queue-bits";
import { useLastPrinter } from "@/hooks/use-last-printer";
import { ApiError } from "@/lib/api/auth";
import {
  CalibrationFilament,
  listCalibrationFilaments,
} from "@/lib/api/calibration";
import { formatDuration, formatGrams } from "@/lib/api/print";
import {
  CALIBRATION_TESTS,
  CalibrationTestId,
  QueueEntry,
  QueuePosition,
  addCalibrationToQueue,
} from "@/lib/api/print-queue";

const POSITION_OPTIONS: { value: QueuePosition; label: string }[] = [
  { value: "first", label: "Próximo na fila" },
  { value: "last", label: "Último" },
];

const ALL_TESTS = CALIBRATION_TESTS.map((t) => t.id);

/**
 * Coloca na fila os testes de calibração de um filamento, de uma vez: escolhe
 * o filamento, a impressora e quais testes, e eles entram na ordem certa.
 */
export function QueueCalibrationDialog({
  open,
  onOpenChange,
  printers,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printers: { id: string; name: string }[];
  onAdded: (entries: QueueEntry[], position: QueuePosition) => void;
}) {
  const [filaments, setFilaments] = useState<CalibrationFilament[] | null>(
    null,
  );
  const [filamentId, setFilamentId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [testIds, setTestIds] = useState<CalibrationTestId[]>(ALL_TESTS);
  const [position, setPosition] = useState<QueuePosition>("first");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPrinter = useLastPrinter();

  // Carrega na primeira vez que abre. Rolo que acabou não entra.
  useEffect(() => {
    if (!open || filaments) return;
    let ignore = false;
    listCalibrationFilaments()
      .then((all) => {
        if (!ignore)
          setFilaments(all.filter((f) => f.spoolLevel !== "FINISHED"));
      })
      .catch(() => {
        if (!ignore) setError("Não foi possível carregar os filamentos.");
      });
    return () => {
      ignore = true;
    };
  }, [open, filaments]);

  const chosenPrinterId = printerId || lastPrinter.pick(printers);
  const filament = filaments?.find((f) => f.id === filamentId);
  const chosen = CALIBRATION_TESTS.filter((t) => testIds.includes(t.id));
  const totalMinutes = chosen.reduce((sum, t) => sum + t.minutes, 0);
  const totalGrams = chosen.reduce((sum, t) => sum + t.grams, 0);

  function toggleTest(id: CalibrationTestId, checked: boolean) {
    setTestIds((prev) =>
      checked ? [...prev, id] : prev.filter((t) => t !== id),
    );
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Volta ao começo para a próxima calibração; a impressora fica.
      setFilamentId("");
      setTestIds(ALL_TESTS);
      setError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!filament) return setError("Escolha o filamento que vai calibrar.");
    if (!chosenPrinterId) return setError("Escolha a impressora.");
    if (!chosen.length) return setError("Marque pelo menos um teste.");

    setIsSaving(true);
    setError(null);
    try {
      const added = await addCalibrationToQueue(
        { filament, printerId: chosenPrinterId, testIds },
        position,
      );
      lastPrinter.rememberPrinter(chosenPrinterId);
      onAdded(added, position);
      close(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível adicionar à fila.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 p-0 sm:max-w-140">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-start gap-3 px-6 pt-5 pb-4">
            <FlaskConical
              className="mt-0.5 size-4.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle className="font-heading text-[17px] leading-tight font-medium">
                Calibrar filamento
              </DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Os testes entram na fila na ordem certa, cada um com o tempo e
                as gramas de uma impressão.
              </DialogDescription>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4.5 px-6 pt-4.5 pb-1">
            <div className="flex flex-col gap-2">
              <Label id="calibration-filament-label">
                Qual filamento vai calibrar
              </Label>
              {filaments ? (
                <FilamentCascadeSelect
                  filaments={filaments}
                  value={filamentId}
                  onChange={setFilamentId}
                  aria-describedby="calibration-filament-label"
                />
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  Carregando filamentos...
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Impressora</Label>
              <Select
                value={chosenPrinterId || null}
                onValueChange={(value) => value && setPrinterId(value)}
              >
                <SelectTrigger aria-label="Impressora" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      printers.find((p) => p.id === value)?.name ?? (
                        <span className="text-muted-foreground">
                          Nenhuma cadastrada
                        </span>
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                Testes que vai fazer
              </legend>
              <div className="flex flex-col rounded-md shadow-[inset_0_0_0_1px_var(--neutral-700)]">
                {CALIBRATION_TESTS.map((test, i) => (
                  <label
                    key={test.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-3.5 py-2.5 text-[13px] last:border-b-0 hover:bg-foreground/3"
                  >
                    <Checkbox
                      checked={testIds.includes(test.id)}
                      onCheckedChange={(checked) =>
                        toggleTest(test.id, checked)
                      }
                    />
                    <span className="w-4 text-[11px] text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1">{test.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(test.minutes)} · {formatGrams(test.grams)}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {chosen.length
                  ? `${chosen.length} ${chosen.length === 1 ? "teste" : "testes"} · ${formatDuration(totalMinutes)} · ${formatGrams(totalGrams)}`
                  : "Nenhum teste marcado"}
              </p>
            </fieldset>

            <div className="flex flex-col gap-2">
              <Label>Onde na fila</Label>
              <PositionToggle
                label="Onde na fila"
                value={position}
                onChange={setPosition}
                options={POSITION_OPTIONS}
              />
            </div>

            {error && (
              <p role="alert" className="text-[12.5px] text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 px-6 pt-4.5 pb-5">
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !chosen.length}
              aria-busy={isSaving}
            >
              {isSaving
                ? "Adicionando..."
                : chosen.length === 1
                  ? "Adicionar 1 teste"
                  : `Adicionar ${chosen.length} testes`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
