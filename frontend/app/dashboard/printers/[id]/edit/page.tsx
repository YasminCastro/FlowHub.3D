"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { PrinterForm } from "@/components/printers/printer-form";
import { ApiError } from "@/lib/api/auth";
import { Printer, PrinterInput, getPrinter, updatePrinter } from "@/lib/api/printer";

export default function EditPrinterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [printer, setPrinter] = useState<Printer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadPrinter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadPrinter() {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPrinter(await getPrinter(params.id));
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar a impressora.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(input: PrinterInput) {
    if (!printer) return;
    await updatePrinter(printer.id, input);
    router.push(`/dashboard/printers/${printer.id}`);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError || !printer) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Impressora não encontrada."}
        </p>
      </div>
    );
  }

  return (
    <PrinterForm
      printer={printer}
      cancelHref={`/dashboard/printers/${printer.id}`}
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
          <Link
            href={`/dashboard/printers/${printer.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {printer.name}
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
