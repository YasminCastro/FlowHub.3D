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
import { deletePrinter } from "@/lib/api/printer";

export type PrinterDeleteDialogProps = {
  printerId: string;
  printerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function PrinterDeleteDialog({
  printerId,
  printerName,
  open,
  onOpenChange,
  onDeleted,
}: PrinterDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePrinter(printerId);
      onDeleted();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a impressora.",
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
            Excluir impressora
          </DialogTitle>
          <DialogDescription>
            Isso remove &ldquo;{printerName}&rdquo; e o histórico associado a
            ela. Esta ação não pode ser desfeita.
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
            {isDeleting ? "Excluindo..." : "Excluir impressora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
