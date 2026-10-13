import { Suspense } from "react";

import { PrintItemForm } from "@/components/prints/print-item-form";

// O formulário lê ?derivadoDe= (e ?registro=) para começar de outro item.
export default function NewPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintItemForm />
    </Suspense>
  );
}
