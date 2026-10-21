"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";

import { QueueEntryForm } from "@/components/queue/queue-entry-form";

export default function EditQueueEntryPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <QueueEntryForm key={id} entryId={id} />
    </Suspense>
  );
}
