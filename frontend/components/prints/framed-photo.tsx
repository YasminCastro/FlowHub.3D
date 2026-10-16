"use client";

import { Crop, Maximize, Move } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PhotoFraming, PrintPhoto } from "@/lib/api/print";
import { cn } from "@/lib/utils";

function framingClass(framing: PhotoFraming) {
  return framing.contain ? "object-contain bg-black/35" : "object-cover";
}

function framingStyle(framing: PhotoFraming) {
  return { objectPosition: `${framing.focusX}% ${framing.focusY}%` };
}

// Foto de impressão com o enquadramento salvo: recorta em volta do ponto de
// foco, ou mostra a foto inteira.
export function FramedPhoto({
  photo,
  alt = "",
  className,
}: {
  photo: PrintPhoto;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={alt}
      className={cn(className, framingClass(photo))}
      style={framingStyle(photo)}
    />
  );
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

// Foto com o botão "Ajustar": arrastando, escolhe a parte que aparece no
// recorte; "Mostrar inteira" tira o recorte.
export function PhotoFramer({
  photo,
  alt,
  className,
  onSave,
}: {
  photo: PrintPhoto;
  alt?: string;
  className?: string;
  onSave: (framing: PhotoFraming) => Promise<void>;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    focusX: number;
    focusY: number;
  } | null>(null);
  const [draft, setDraft] = useState<PhotoFraming | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const framing = draft ?? photo;

  function startEditing() {
    setDraft({
      focusX: photo.focusX,
      focusY: photo.focusY,
      contain: photo.contain,
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (!draft || draft.contain) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      focusX: draft.focusX,
      focusY: draft.focusY,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!drag.current || !img?.naturalWidth) return;
    // Quanto da foto sobra fora do quadro em cada eixo; arrastar a sobra
    // inteira leva o foco de uma ponta à outra.
    const { width, height } = img.getBoundingClientRect();
    const scale = Math.max(
      width / img.naturalWidth,
      height / img.naturalHeight,
    );
    const overflowX = img.naturalWidth * scale - width;
    const overflowY = img.naturalHeight * scale - height;
    const start = drag.current;
    setDraft((prev) =>
      prev && {
        ...prev,
        focusX:
          overflowX > 0
            ? clamp(start.focusX - ((e.clientX - start.x) / overflowX) * 100)
            : prev.focusX,
        focusY:
          overflowY > 0
            ? clamp(start.focusY - ((e.clientY - start.y) / overflowY) * 100)
            : prev.focusY,
      },
    );
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function save() {
    if (!draft) return;
    setIsSaving(true);
    try {
      await onSave({
        focusX: Math.round(draft.focusX * 10) / 10,
        focusY: Math.round(draft.focusY * 10) / 10,
        contain: draft.contain,
      });
      setDraft(null);
    } catch {
      // Quem chamou mostra o erro; o ajuste fica aberto para tentar de novo.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn("group relative overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={photo.src}
        alt={alt ?? ""}
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "size-full touch-none select-none",
          framingClass(framing),
          draft && !draft.contain && "cursor-move",
        )}
        style={framingStyle(framing)}
      />

      {draft ? (
        <>
          {!draft.contain && (
            <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1.25 rounded-sm bg-background/80 px-2 py-0.5 text-[11px] text-foreground/85 backdrop-blur-sm">
              <Move className="size-3" aria-hidden="true" />
              Arraste para enquadrar
            </span>
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-pressed={draft.contain}
              onClick={() =>
                setDraft((prev) => prev && { ...prev, contain: !prev.contain })
              }
            >
              {draft.contain ? (
                <Crop aria-hidden="true" />
              ) : (
                <Maximize aria-hidden="true" />
              )}
              {draft.contain ? "Recortar" : "Mostrar inteira"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto bg-background/70 backdrop-blur-sm"
              disabled={isSaving}
              onClick={() => setDraft(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={save}
            >
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={startEditing}
        >
          <Crop aria-hidden="true" />
          Ajustar
        </Button>
      )}
    </div>
  );
}
