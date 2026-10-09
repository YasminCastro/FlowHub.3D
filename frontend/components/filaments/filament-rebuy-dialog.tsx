import { RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/auth";
import {
  FilamentWithDetails,
  formatPricePerKg,
  getPricePerKg,
  addFilamentPurchase,
} from "@/lib/api/filament";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export type FilamentRebuyDialogProps = {
  filament: FilamentWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRebought: (filament: FilamentWithDetails) => void;
};

export function FilamentRebuyDialog({
  filament,
  open,
  onOpenChange,
  onRebought,
}: FilamentRebuyDialogProps) {
  const lastPrice = filament.maxPricePaid ?? filament.minPricePaid;
  const [price, setPrice] = useState(String(lastPrice));
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricePaid = Number(price);
  const isValid = price.trim() !== "" && pricePaid > 0 && !!purchasedAt;
  // Prévia da faixa depois desta compra.
  const nextRange = isValid
    ? getPricePerKg({
        minPricePaid: Math.min(filament.minPricePaid, pricePaid),
        maxPricePaid: Math.max(lastPrice, pricePaid),
        spoolWeightGrams: filament.spoolWeightGrams,
      })
    : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await addFilamentPurchase(filament.id, {
        pricePaid,
        purchasedAt: new Date(`${purchasedAt}T12:00:00`).toISOString(),
      });
      onRebought(updated);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível registrar a compra.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="size-4" aria-hidden="true" />
              Recomprar {filament.colorName}
            </DialogTitle>
            <DialogDescription>
              Registra mais uma compra deste filamento
              {filament.spoolLevel !== "FULL"
                ? " e marca o carretel como cheio"
                : ""}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rebuy-price">Preço pago no rolo</Label>
              <Input
                id="rebuy-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tabular-nums"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rebuy-date">Data da compra</Label>
              <Input
                id="rebuy-date"
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          {nextRange && (
            <p className="text-[12.5px] text-muted-foreground">
              Fica com {filament.purchaseCount + 1} compras, a{" "}
              {formatPricePerKg(nextRange)}.
            </p>
          )}

          {error && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? "Salvando..." : "Registrar compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
