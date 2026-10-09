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
import { deleteBrand } from "@/lib/api/brand";

export type BrandDeleteDialogProps = {
  brandId: string;
  brandName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onArchiveInstead?: () => void;
};

export function BrandDeleteDialog({
  brandId,
  brandName,
  open,
  onOpenChange,
  onDeleted,
  onArchiveInstead,
}: BrandDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteBrand(brandId);
      onDeleted();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a marca.",
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
            Excluir marca
          </DialogTitle>
          <DialogDescription>
            Isso remove &ldquo;{brandName}&rdquo; e as observações dela. Esta
            ação não pode ser desfeita.
            {onArchiveInstead &&
              " Se só quer tirá-la da lista, arquive: o histórico fica guardado."}
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
          {onArchiveInstead && (
            <Button type="button" variant="outline" onClick={onArchiveInstead}>
              Arquivar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-busy={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir marca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
