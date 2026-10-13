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
import { deleteExtraItem } from "@/lib/api/extra-item";

export type ExtraItemDeleteDialogProps = {
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function ExtraItemDeleteDialog({
  itemId,
  itemName,
  open,
  onOpenChange,
  onDeleted,
}: ExtraItemDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteExtraItem(itemId);
      onDeleted();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o item.",
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
            Excluir item extra
          </DialogTitle>
          <DialogDescription>
            Isso remove &ldquo;{itemName}&rdquo; e o histórico de lotes
            comprados. Esta ação não pode ser desfeita.
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
            {isDeleting ? "Excluindo..." : "Excluir item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
