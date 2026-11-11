import { useEffect, useState } from "react";

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
import { CategoryCombobox } from "@/components/prints/print-item-form";
import { OptionalHint } from "@/components/prints/print-bits";
import { ApiError } from "@/lib/api/auth";
import { Category, listCategories } from "@/lib/api/category";
import { PrintItem, updatePrintItem } from "@/lib/api/print";

export type PrintEditDialogProps = {
  item: PrintItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: PrintItem) => void;
};

export function PrintEditDialog({
  item,
  open,
  onOpenChange,
  onSaved,
}: PrintEditDialogProps) {
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(item.category?.id ?? "");
  const [modelUrl, setModelUrl] = useState(item.modelUrl ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que abre, volta para os dados atuais da peça.
  useEffect(() => {
    if (!open) return;
    setName(item.name);
    setCategoryId(item.category?.id ?? "");
    setModelUrl(item.modelUrl ?? "");
    setError(null);
    listCategories()
      .then((list) =>
        setCategories(
          [...list].sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
          ),
        ),
      )
      .catch(() => setCategories([]));
  }, [open, item]);

  async function handleSave() {
    if (!name.trim()) return setError("Dê um nome para a peça.");
    if (!categories.some((c) => c.id === categoryId)) {
      return setError("Escolha a categoria.");
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updatePrintItem(item.id, {
        name: name.trim(),
        categoryId,
        modelUrl: modelUrl.trim() || null,
      });
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a impressão.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar impressão</DialogTitle>
          <DialogDescription>
            Nome, categoria e link do modelo. Os registros não mudam.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-print-name">Nome</Label>
            <Input
              id="edit-print-name"
              autoFocus
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <CategoryCombobox
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-print-url">
              Link do modelo <OptionalHint />
            </Label>
            <Input
              id="edit-print-url"
              type="url"
              placeholder="makerworld.com/models/..."
              value={modelUrl}
              onChange={(e) => setModelUrl(e.target.value)}
            />
          </div>
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
            <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
