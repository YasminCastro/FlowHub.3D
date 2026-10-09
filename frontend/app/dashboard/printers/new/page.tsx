"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { PrinterForm } from "@/components/printers/printer-form";
import { PrinterInput, createPrinter } from "@/lib/api/printer";

export default function NewPrinterPage() {
  const router = useRouter();

  async function handleSubmit(input: PrinterInput) {
    const created = await createPrinter(input);
    router.push(`/dashboard/printers/${created.id}`);
  }

  return (
    <PrinterForm
      cancelHref="/dashboard/printers"
      onSubmit={handleSubmit}
      breadcrumb={
        <>
          <Link
            href="/dashboard/printers"
            className="text-muted-foreground hover:text-foreground"
          >
            Impressoras
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="font-medium">Nova impressora</span>
        </>
      }
    />
  );
}
