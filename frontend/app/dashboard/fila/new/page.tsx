import { Suspense } from "react";

import { QueueEntryForm } from "@/components/queue/queue-entry-form";

// O formulário lê ?impressao= para já começar ligado a uma impressão.
export default function NewQueueEntryPage() {
  return (
    <Suspense fallback={null}>
      <QueueEntryForm />
    </Suspense>
  );
}
