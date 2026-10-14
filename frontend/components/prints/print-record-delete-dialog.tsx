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
  PrintItem,
  PrintRecord,
  deletePrintRecord,
  describePrintFilament,
} from "@/lib/api/print";
import { formatDatePtBR } from "@/lib/utils";

// Mesmas regras do backend, para explicar antes de tentar: a peça precisa de
// um registro, e o padrão só sai se houver outro sucesso para assumir.
function blockedReason(item: PrintItem, record: PrintRecord) {
  if (item.records.length === 1) {
    return "É o único registro desta impressão. Para tirá-lo, exclua a impressão inteira.";
  }
  const isDefault = record.id === item.defaultRecordId;
  const otherSuccess = item.records.some(
    (r) => r.id !== record.id && r.outcome === "SUCCESS",
  );
  if (isDefault && !otherSuccess) {
    return "Este é o registro padrão e o único que deu certo, então não pode sair.";
  }
  return null;
}

export type PrintRecordDeleteDialogProps = {
  item: PrintItem;
  record: PrintRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (item: PrintItem) => void;
};

export function PrintRecordDeleteDialog({
  item,
  record,
  open,
  onOpenChange,
  onDeleted,
}: PrintRecordDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const blocked = record ? blockedReason(item, record) : null;
  const isDefault = record?.id === item.defaultRecordId;
  const first = record?.filaments[0];

  async function handleDelete() {
    if (!record) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      onDeleted(await deletePrintRecord(item.id, record.id));
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o registro.",
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
            Excluir registro
          </DialogTitle>
          {record && (
            <DialogDescription>
              Isso remove o registro de {formatDatePtBR(record.printedAt)}
              {first && ` (${describePrintFilament(first.filament)})`}, com as
              fotos dele. Esta ação não pode ser desfeita.
              {isDefault &&
                !blocked &&
                " Ele é o registro padrão: o sucesso mais recente passa a ser o padrão."}
            </DialogDescription>
          )}
        </DialogHeader>
        {(blocked ?? deleteError) && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {blocked ?? deleteError}
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
            disabled={isDeleting || !!blocked}
            aria-busy={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
