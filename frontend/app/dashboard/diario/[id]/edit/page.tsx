"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { JournalEntryForm } from "@/components/journal/journal-entry-form";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { useJournalEntry } from "@/hooks/use-journal-entry";
import {
  JournalEntryInput,
  JournalPhotoChanges,
  saveJournalEntry,
} from "@/lib/api/journal";

export default function EditJournalEntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { entry, isLoading, loadError, isNotFound } = useJournalEntry(params.id);
  const detailHref = `/dashboard/diario/${params.id}`;

  async function handleSubmit(
    input: JournalEntryInput,
    photos: JournalPhotoChanges,
  ) {
    await saveJournalEntry(params.id, input, photos);
    router.push(detailHref);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="diario" />;

  if (loadError || !entry) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Entrada não encontrada."}
        </p>
      </div>
    );
  }

  return (
    <JournalEntryForm
      entry={entry}
      cancelHref={detailHref}
      onSubmit={handleSubmit}
      breadcrumb={
        <>
          <Link
            href="/dashboard/diario"
            className="text-muted-foreground hover:text-foreground"
          >
            Diário
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Link
            href={detailHref}
            className="max-w-60 truncate text-muted-foreground hover:text-foreground"
          >
            {entry.title}
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="font-medium">Editar</span>
        </>
      }
    />
  );
}
