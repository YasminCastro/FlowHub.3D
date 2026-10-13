"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Hourglass,
  ImageIcon,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { JournalSimilarEntries } from "@/components/journal/journal-similar-entries";
import {
  AttemptNumber,
  FilamentDot,
} from "@/components/journal/journal-status-badge";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import { listFilaments } from "@/lib/api/filament";
import {
  AttemptOutcome,
  JOURNAL_MAX_PHOTOS,
  JOURNAL_PHOTO_MAX_BYTES,
  JOURNAL_STATUS_LABELS,
  JournalEntry,
  JournalEntryInput,
  JournalFilament,
  JournalPhoto,
  JournalPhotoChanges,
  JournalStatus,
  describeFilament,
  findSimilarEntries,
  journalPhotoSrc,
  listJournalEntries,
  toJournalFilament,
} from "@/lib/api/journal";
import { cn } from "@/lib/utils";

const FORM_ID = "journal-entry-form";
const NO_FILAMENT = "none";

const journalFormSchema = z.object({
  title: z.string().trim().min(1, "Dê um título para o problema."),
  occurredAt: z.string().min(1, "Informe a data."),
  filamentId: z.string(),
  symptom: z.string().trim().min(1, "Descreva o que foi observado."),
  possibleCauses: z.string(),
  // Só vale quando nenhuma tentativa resolveu.
  openStatus: z.enum(["IN_PROGRESS", "UNRESOLVED"]),
  attempts: z.array(
    z.object({
      description: z.string(),
      outcome: z.enum(["WORKED", "FAILED"]).nullable(),
      triedAt: z.string(),
      // Sem campo no formulário; só preserva o que já existia.
      note: z.string().nullable(),
    }),
  ),
  notes: z.string(),
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyAttempt(): JournalFormValues["attempts"][number] {
  return { description: "", outcome: null, triedAt: today(), note: null };
}

function toDefaultValues(entry?: JournalEntry | null): JournalFormValues {
  return {
    title: entry?.title ?? "",
    occurredAt: entry ? entry.occurredAt.slice(0, 10) : today(),
    filamentId: entry?.filament?.id ?? NO_FILAMENT,
    symptom: entry?.symptom ?? "",
    possibleCauses: entry?.possibleCauses ?? "",
    openStatus: entry?.status === "UNRESOLVED" ? "UNRESOLVED" : "IN_PROGRESS",
    attempts: entry?.attempts.length
      ? entry.attempts.map((attempt) => ({
          description: attempt.description,
          outcome: attempt.outcome,
          triedAt: attempt.triedAt.slice(0, 10),
          note: attempt.note,
        }))
      : [emptyAttempt()],
    notes: entry?.notes ?? "",
  };
}

function toIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

const STATUS_OPTIONS: {
  value: JournalStatus;
  icon: typeof CheckCircle2;
}[] = [
  { value: "RESOLVED", icon: CheckCircle2 },
  { value: "IN_PROGRESS", icon: Hourglass },
  { value: "UNRESOLVED", icon: XCircle },
];

export type JournalEntryFormProps = {
  /** Entrada sendo editada. Omitida/nula = formulário de criação. */
  entry?: JournalEntry | null;
  breadcrumb: ReactNode;
  cancelHref: string;
  onSubmit: SubmitHandler;
  /** Só na criação: salva e limpa o formulário para a próxima entrada. */
  onSubmitAndContinue?: SubmitHandler;
};

type SubmitHandler = (
  input: JournalEntryInput,
  photos: JournalPhotoChanges,
) => Promise<void>;

// Foto escolhida agora, ainda não enviada: o preview é um object URL.
type PendingPhoto = { file: File; preview: string };

export function JournalEntryForm({
  entry,
  breadcrumb,
  cancelHref,
  onSubmit,
  onSubmitAndContinue,
}: JournalEntryFormProps) {
  const router = useRouter();
  const isEditing = !!entry;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<JournalPhoto[]>(
    entry?.photos ?? [],
  );
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [filaments, setFilaments] = useState<JournalFilament[]>(
    entry?.filament ? [entry.filament] : [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pendingPhotos);
  pendingRef.current = pendingPhotos;

  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: toDefaultValues(entry),
  });
  const attempts = useFieldArray({ control: form.control, name: "attempts" });

  useEffect(() => {
    listJournalEntries()
      .then(setAllEntries)
      .catch(() => setAllEntries([]));
  }, [savedTitle]);

  useEffect(() => {
    listFilaments()
      .then((result) =>
        setFilaments(
          result
            .map(toJournalFilament)
            .sort((a, b) => a.colorName.localeCompare(b.colorName, "pt-BR")),
        ),
      )
      .catch(() => {});
  }, []);

  // Libera os previews que sobraram ao sair da página.
  useEffect(
    () => () =>
      pendingRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)),
    [],
  );

  function photoChanges(): JournalPhotoChanges {
    const keptIds = new Set(savedPhotos.map((photo) => photo.id));
    return {
      add: pendingPhotos.map((photo) => photo.file),
      removeIds: (entry?.photos ?? [])
        .filter((photo) => !keptIds.has(photo.id))
        .map((photo) => photo.id),
    };
  }

  function clearPendingPhotos() {
    pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setPendingPhotos([]);
  }

  function toInput(values: JournalFormValues): JournalEntryInput {
    const filledAttempts = values.attempts.filter((attempt) =>
      attempt.description.trim(),
    );
    return {
      title: values.title.trim(),
      occurredAt: toIso(values.occurredAt),
      openStatus: values.openStatus,
      filamentId:
        values.filamentId === NO_FILAMENT ? null : values.filamentId,
      symptom: values.symptom.trim(),
      possibleCauses: values.possibleCauses.trim(),
      attempts: filledAttempts.map((attempt) => ({
        description: attempt.description.trim(),
        outcome: attempt.outcome,
        triedAt: toIso(attempt.triedAt),
        note: attempt.note,
      })),
      notes: values.notes.trim() || null,
    };
  }

  async function submitWith(
    handler: SubmitHandler,
    values: JournalFormValues,
  ) {
    setSubmitError(null);
    setSavedTitle(null);
    try {
      await handler(toInput(values), photoChanges());
      return true;
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a entrada.",
      );
      return false;
    }
  }

  // Só uma tentativa resolve: marcar outra como "resolveu" faz a anterior
  // virar "não resolveu".
  function setOutcome(index: number, outcome: AttemptOutcome) {
    const current = form.getValues("attempts");
    const next = current[index].outcome === outcome ? null : outcome;
    current.forEach((attempt, i) => {
      if (i === index) {
        form.setValue(`attempts.${i}.outcome`, next, { shouldDirty: true });
      } else if (next === "WORKED" && attempt.outcome === "WORKED") {
        form.setValue(`attempts.${i}.outcome`, "FAILED", { shouldDirty: true });
      }
    });
  }

  // As fotos só sobem ao salvar; até lá ficam como preview local.
  function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    const tooBig = images.filter((file) => file.size > JOURNAL_PHOTO_MAX_BYTES);
    const room =
      JOURNAL_MAX_PHOTOS - savedPhotos.length - pendingPhotos.length;
    const accepted = images
      .filter((file) => file.size <= JOURNAL_PHOTO_MAX_BYTES)
      .slice(0, Math.max(0, room));

    if (tooBig.length) {
      setPhotoError("Cada foto pode ter até 10 MB.");
    } else if (accepted.length < images.length) {
      setPhotoError(`Cada entrada aceita até ${JOURNAL_MAX_PHOTOS} fotos.`);
    }

    setPendingPhotos((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  }

  const photoTiles = [
    ...savedPhotos.map((photo) => ({
      key: photo.id,
      src: journalPhotoSrc(photo),
      remove: () =>
        setSavedPhotos((prev) => prev.filter((p) => p.id !== photo.id)),
    })),
    ...pendingPhotos.map((photo) => ({
      key: photo.preview,
      src: photo.preview,
      remove: () => {
        URL.revokeObjectURL(photo.preview);
        setPendingPhotos((prev) =>
          prev.filter((p) => p.preview !== photo.preview),
        );
      },
    })),
  ];

  const isSubmitting = form.formState.isSubmitting;

  usePageHeaderBreadcrumb(breadcrumb);

  usePageHeaderAction(
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(cancelHref)}
      >
        Cancelar
      </Button>
      {onSubmitAndContinue && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isSubmitting}
          onClick={form.handleSubmit(async (values) => {
            const ok = await submitWith(onSubmitAndContinue, values);
            if (!ok) return;
            setSavedTitle(values.title.trim());
            clearPendingPhotos();
            form.reset(toDefaultValues());
            form.setFocus("title");
          })}
        >
          Salvar e criar outra
        </Button>
      )}
      <Button
        type="submit"
        form={FORM_ID}
        size="sm"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting
          ? "Salvando..."
          : isEditing
            ? "Salvar alterações"
            : "Salvar entrada"}
      </Button>
    </div>,
  );

  const watchedAttempts = form.watch("attempts");
  const openStatus = form.watch("openStatus");
  const filamentId = form.watch("filamentId");
  const winnerIndex = watchedAttempts.findIndex((a) => a.outcome === "WORKED");
  const effectiveStatus: JournalStatus =
    winnerIndex >= 0 ? "RESOLVED" : openStatus;

  const similar = findSimilarEntries(allEntries, {
    id: entry?.id,
    filamentId: filamentId === NO_FILAMENT ? null : filamentId,
  });

  return (
    <div className="flex flex-col gap-6 p-8 lg:flex-row lg:gap-10">
      <Form {...form}>
        <form
          id={FORM_ID}
          className="flex min-w-0 flex-1 flex-col gap-6"
          onSubmit={form.handleSubmit((values) => submitWith(onSubmit, values))}
        >
          <div>
            <h1 className="text-4xl font-bold">
              {isEditing ? "Editar entrada" : "Nova entrada"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Descreva o problema, o que você suspeita e cada coisa que testou.
            </p>
          </div>

          {savedTitle && (
            <p
              role="status"
              className="rounded-md border border-brand/40 bg-brand/8 px-3 py-2 text-[12.5px] text-brand-300"
            >
              &ldquo;{savedTitle}&rdquo; salva. Pode registrar a próxima.
            </p>
          )}

          <section className="flex flex-col gap-4">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              Problema
            </span>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Warping em extremidade de peça comprida (PLA)"
                      autoFocus
                      maxLength={150}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="occurredAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={today()}
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="filamentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Filamento{" "}
                      <span className="text-muted-foreground">opcional</span>
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) =>
                        field.onChange(value ?? NO_FILAMENT)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) => {
                              const f = filaments.find(
                                (option) => option.id === value,
                              );
                              return f ? (
                                <span className="flex items-center gap-2">
                                  <FilamentDot colors={f.colors} />
                                  {describeFilament(f)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Nenhum
                                </span>
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_FILAMENT}>Nenhum</SelectItem>
                        {filaments.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            <FilamentDot colors={f.colors} />
                            {describeFilament(f)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="symptom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sintoma</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-20"
                      placeholder="Descreva o que foi observado..."
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="possibleCauses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Possíveis causas</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-20"
                      placeholder="Ex: corrente de ar, fan de resfriamento muito forte..."
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs tracking-wide text-muted-foreground uppercase">
                O que foi testado
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground/70">
                marque a tentativa que resolveu
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {attempts.fields.map((field, index) => {
                const outcome = watchedAttempts[index]?.outcome ?? null;
                const worked = outcome === "WORKED";
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[19px_minmax(0,1fr)_auto] items-start gap-2.75"
                  >
                    <AttemptNumber
                      n={index + 1}
                      worked={worked}
                      className="mt-2.25"
                    />
                    <Textarea
                      aria-label={`Tentativa ${index + 1}`}
                      placeholder="O que você testou?"
                      className={cn(
                        "min-h-13",
                        worked && "border-brand-600",
                      )}
                      maxLength={500}
                      {...form.register(`attempts.${index}.description`)}
                    />
                    <div className="flex items-center gap-1.25 pt-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant={worked ? "default" : "outline"}
                        aria-label="Resolveu"
                        aria-pressed={worked}
                        onClick={() => setOutcome(index, "WORKED")}
                      >
                        <ThumbsUp className={cn(worked && "fill-current")} />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label="Não resolveu"
                        aria-pressed={outcome === "FAILED"}
                        className={cn(
                          outcome === "FAILED" &&
                            "border-[#e07a7a]/45 text-[#e07a7a] hover:text-[#e07a7a]",
                        )}
                        onClick={() => setOutcome(index, "FAILED")}
                      >
                        <ThumbsDown
                          className={cn(outcome === "FAILED" && "fill-current")}
                        />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remover tentativa ${index + 1}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => attempts.remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => attempts.append(emptyAttempt())}
            >
              <Plus />
              Adicionar tentativa
            </Button>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              Fechamento
            </span>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notas{" "}
                    <span className="text-muted-foreground">opcional</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-21"
                      placeholder="Observações adicionais, o que fazer diferente na próxima..."
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </section>

          {submitError && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {submitError}
            </p>
          )}
        </form>
      </Form>

      <aside className="flex w-full flex-col gap-4 lg:w-78 lg:flex-none lg:border-l lg:pl-6">
        <section className="flex flex-col gap-2.75 rounded-md border border-border p-3.5">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Status
          </span>
          <div className="flex flex-col gap-1.75">
            {STATUS_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = effectiveStatus === value;
              // Resolvido vem da tentativa; com ela marcada, não dá para
              // escolher outro.
              const disabled =
                value === "RESOLVED" ? !selected : winnerIndex >= 0;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() =>
                    form.setValue(
                      "openStatus",
                      value as JournalFormValues["openStatus"],
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.75 rounded-md border px-3 py-1.25 text-xs transition-colors disabled:cursor-not-allowed",
                    selected
                      ? "border-brand bg-brand/12 text-brand"
                      : "border-border text-muted-foreground enabled:hover:bg-foreground/5 enabled:hover:text-foreground disabled:opacity-50",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {JOURNAL_STATUS_LABELS[value]}
                </button>
              );
            })}
          </div>
          <p
            className={cn(
              "text-[11px] leading-relaxed",
              winnerIndex >= 0 ? "text-brand-300" : "text-muted-foreground",
            )}
          >
            {winnerIndex >= 0
              ? `Marcado sozinho: a tentativa ${winnerIndex + 1} resolveu o problema.`
              : "Marque 👍 na tentativa que resolveu para fechar o caso."}
          </p>
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            addPhotos(e.dataTransfer.files);
          }}
          className={cn(
            "flex h-33 flex-col items-center justify-center gap-1.75 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-brand hover:text-brand",
            isDragging ? "border-brand text-brand" : "border-neutral-700",
          )}
        >
          <ImageIcon className="size-5.5" aria-hidden="true" />
          <span className="text-xs">Arraste fotos do problema</span>
          <span className="text-[10.5px] opacity-60">
            ou clique para escolher
          </span>
        </button>
        {photoError && (
          <p role="alert" className="text-[12px] text-destructive">
            {photoError}
          </p>
        )}
        {photoTiles.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photoTiles.map((photo, index) => (
              <div key={photo.key} className="group relative h-18">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={`Foto ${index + 1}`}
                  className="size-full rounded-sm object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remover foto ${index + 1}`}
                  onClick={photo.remove}
                  className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <JournalSimilarEntries entries={similar} />
      </aside>
    </div>
  );
}
