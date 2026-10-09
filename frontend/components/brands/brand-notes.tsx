"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/auth";
import {
  BrandNote,
  addBrandNote,
  deleteBrandNote,
  updateBrandNote,
} from "@/lib/api/brand";
import { formatDatePtBR } from "@/lib/utils";

function NoteEditor({
  initialValue = "",
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initialValue?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(content);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a observação.",
      );
      setIsSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="O que vale lembrar sobre essa marca..."
        maxLength={2000}
        aria-label="Observação"
        autoFocus
      />
      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving || !content.trim()}
          aria-busy={isSaving}
        >
          {isSaving ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export type BrandNotesProps = {
  brandId: string;
  notes: BrandNote[];
  onChange: (notes: BrandNote[]) => void;
};

export function BrandNotes({ brandId, notes, onChange }: BrandNotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    setDeleteError(null);
    try {
      await deleteBrandNote(brandId, noteId);
      onChange(notes.filter((note) => note.id !== noteId));
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a observação.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Observações
        </span>
        {!isAdding && (
          <Button
            variant="ghost"
            size="xs"
            className="text-brand"
            onClick={() => {
              setEditingId(null);
              setIsAdding(true);
            }}
          >
            <Plus />
            Nova
          </Button>
        )}
      </div>

      {isAdding && (
        <NoteEditor
          submitLabel="Adicionar"
          onCancel={() => setIsAdding(false)}
          onSubmit={async (content) => {
            const created = await addBrandNote(brandId, content);
            onChange([created, ...notes]);
            setIsAdding(false);
          }}
        />
      )}

      {notes.length === 0 && !isAdding ? (
        <p className="text-[12.5px] text-muted-foreground">
          Nenhuma observação ainda.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {notes.map((note) =>
            editingId === note.id ? (
              <li key={note.id} className="py-3">
                <NoteEditor
                  initialValue={note.content}
                  submitLabel="Salvar"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (content) => {
                    const updated = await updateBrandNote(
                      brandId,
                      note.id,
                      content,
                    );
                    onChange(
                      notes.map((item) =>
                        item.id === updated.id ? updated : item,
                      ),
                    );
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li key={note.id} className="group flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <time
                    dateTime={note.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {formatDatePtBR(note.createdAt)}
                  </time>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Editar observação"
                      onClick={() => {
                        setIsAdding(false);
                        setEditingId(note.id);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:bg-destructive/10"
                      aria-label="Excluir observação"
                      disabled={deletingId === note.id}
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {note.content}
                </p>
              </li>
            ),
          )}
        </ul>
      )}

      {deleteError && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {deleteError}
        </p>
      )}
    </section>
  );
}
