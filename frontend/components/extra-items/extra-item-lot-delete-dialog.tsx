import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/auth";
import {
  ExtraItemLot,
  ExtraItemWithHistory,
  deleteExtraItemLot,
  formatUnits,
} from "@/lib/api/extra-item";
import { formatBRL, formatDatePtBR } from "@/lib/utils";

export type ExtraItemLotDeleteDialogProps = {
  itemId: string;
  lot: ExtraItemLot;
  /** O lote mais recente define o unitário: excluí-lo muda o custo. */
  isLatest: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (item: ExtraItemWithHistory) => void;
};

export function ExtraItemLotDeleteDialog({
  itemId,
  lot,
  isLatest,
  open,
  onOpenChange,
  onDeleted,
}: ExtraItemLotDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      onDeleted(await deleteExtraItemLot(itemId, lot.id));
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o lote.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setDeleteError(null);
      }}
    >
      <DialogContent className="ring-destructive/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-4.5" aria-hidden="true" />
            Excluir lote
          </DialogTitle>
          <DialogDescription>
            Remove o lote de {formatDatePtBR(lot.purchasedAt)} (
            {formatBRL(lot.price)} · {formatUnits(lot.quantity)}) do histórico.
            {isLatest &&
              " Como é o lote mais recente, o custo unitário passa a ser o do lote anterior."}{" "}
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        {deleteError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {deleteError}
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
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-busy={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
