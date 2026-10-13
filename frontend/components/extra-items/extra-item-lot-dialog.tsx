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
  ExtraItemWithHistory,
  getUnitCost,
  registerExtraItemLot,
} from "@/lib/api/extra-item";
import { formatBRL } from "@/lib/utils";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export type ExtraItemLotDialogProps = {
  item: ExtraItemWithHistory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (item: ExtraItemWithHistory) => void;
};

export function ExtraItemLotDialog({
  item,
  open,
  onOpenChange,
  onRegistered,
}: ExtraItemLotDialogProps) {
  // Começa com o último lote: na recompra quase sempre é o mesmo pacote.
  const [price, setPrice] = useState(String(item.lotPrice || ""));
  const [quantity, setQuantity] = useState(String(item.lotQuantity || ""));
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lotPrice = Number(price);
  const lotQuantity = Number(quantity);
  const isValid =
    price.trim() !== "" &&
    lotPrice > 0 &&
    Number.isInteger(lotQuantity) &&
    lotQuantity > 0 &&
    !!purchasedAt;
  const nextUnitCost = isValid ? lotPrice / lotQuantity : null;
  const currentUnitCost = getUnitCost(item);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await registerExtraItemLot(item.id, {
        price: lotPrice,
        quantity: lotQuantity,
        purchasedAt: new Date(`${purchasedAt}T12:00:00`).toISOString(),
      });
      onRegistered(updated);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível registrar o lote.",
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
              Novo lote de {item.name}
            </DialogTitle>
            <DialogDescription>
              O unitário passa a ser o deste lote. Os lotes anteriores ficam no
              histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lot-price">Preço do lote (R$)</Label>
              <Input
                id="lot-price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tabular-nums"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lot-quantity">Unidades no lote</Label>
              <Input
                id="lot-quantity"
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lot-date">Data da compra</Label>
              <Input
                id="lot-date"
                type="date"
                value={purchasedAt}
                max={today()}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          {nextUnitCost != null && (
            <p className="text-[12.5px] text-muted-foreground">
              Unitário {formatBRL(nextUnitCost)}
              {item.lotCount > 0 &&
                Math.round(nextUnitCost * 100) !==
                  Math.round(currentUnitCost * 100) &&
                ` (era ${formatBRL(currentUnitCost)})`}
              .
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
              {isSaving ? "Salvando..." : "Registrar lote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
