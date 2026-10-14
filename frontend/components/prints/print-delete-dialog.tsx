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
import { PrintItem, deletePrintItem } from "@/lib/api/print";

export type PrintDeleteDialogProps = {
  item: PrintItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function PrintDeleteDialog({
  item,
  open,
  onOpenChange,
  onDeleted,
}: PrintDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const records = item.records.length;
  const derivatives = item.derivatives.length;

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePrintItem(item.id);
      onDeleted();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a impressão.",
      );
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
            Excluir impressão
          </DialogTitle>
          <DialogDescription>
            Isso remove &ldquo;{item.name}&rdquo; com {records}{" "}
            {records === 1 ? "registro" : "registros"} e todas as fotos. Esta
            ação não pode ser desfeita.
            {derivatives > 0 &&
              ` ${derivatives === 1 ? "A peça derivada continua" : `As ${derivatives} peças derivadas continuam`}, só deixa${derivatives === 1 ? "" : "m"} de apontar para esta.`}
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
            {isDeleting ? "Excluindo..." : "Excluir impressão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
