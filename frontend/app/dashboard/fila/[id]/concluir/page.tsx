"use client";

import { useParams } from "next/navigation";

import { QueueCompleteForm } from "@/components/queue/queue-complete-form";

export default function CompleteQueueEntryPage() {
  const { id } = useParams<{ id: string }>();
  return <QueueCompleteForm key={id} entryId={id} />;
}
