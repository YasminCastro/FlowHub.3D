"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { JournalEntryForm } from "@/components/journal/journal-entry-form";
import {
  JournalEntryInput,
  JournalPhotoChanges,
  saveJournalEntry,
} from "@/lib/api/journal";

export default function NewJournalEntryPage() {
  const router = useRouter();

  async function handleSubmit(
    input: JournalEntryInput,
    photos: JournalPhotoChanges,
  ) {
    const created = await saveJournalEntry(null, input, photos);
    router.push(`/dashboard/diario/${created.id}`);
  }

  return (
    <JournalEntryForm
      cancelHref="/dashboard/diario"
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
          <span className="font-medium">Nova entrada</span>
        </>
      }
    />
  );
}
