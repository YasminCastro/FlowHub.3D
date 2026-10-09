"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Printer as PrinterIcon, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PrinterCard } from "@/components/printers/printer-card";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import { Printer, buildPrinterStats, listPrinters } from "@/lib/api/printer";

export default function PrintersPage() {
  const router = useRouter();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPrinters();
  }, []);

  async function loadPrinters() {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPrinters(await listPrinters());
      console.log(printers);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as impressoras.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const visiblePrinters = printers.filter((printer) =>
    `${printer.name} ${printer.brand}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/printers/new" />}
      nativeButton={false}
    >
      <Plus />
      Nova impressora
    </Button>,
  );

  function renderContent() {
    const status = isLoading
      ? "loading"
      : loadError
        ? "error"
        : printers.length === 0
          ? "empty"
          : visiblePrinters.length === 0
            ? "no-results"
            : "list";

    switch (status) {
      case "loading":
        return (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        );

      case "error":
        return (
          <p role="alert" className="text-[12.5px] text-destructive">
            {loadError}
          </p>
        );

      case "empty":
        return (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <PrinterIcon className="size-6" aria-hidden="true" />
            <p className="text-sm">Nenhuma impressora cadastrada ainda.</p>
            <Button
              size="sm"
              render={<Link href="/dashboard/printers/new" />}
              nativeButton={false}
            >
              <Plus />
              Nova impressora
            </Button>
          </div>
        );

      case "no-results":
        return (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Search className="size-6" aria-hidden="true" />
            <p className="text-sm">
              Nenhuma impressora encontrada para &ldquo;{search}&rdquo;.
            </p>
          </div>
        );

      case "list":
        return (
          <div className="flex flex-col gap-4">
            {visiblePrinters.map((printer) => (
              <PrinterCard
                key={printer.id}
                name={printer.name}
                href={`/dashboard/printers/${printer.id}`}
                details={[
                  printer.brand,
                  printer.nozzle ? `Bico ${printer.nozzle}` : null,
                  printer.extrusionType,
                  printer.filamentsTypes.length
                    ? printer.filamentsTypes.join(", ").toUpperCase()
                    : null,
                ]}
                stats={buildPrinterStats(printer)}
              />
            ))}
          </div>
        );
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Impressoras</h1>
          <p className="text-muted-foreground text-sm">
            Cada máquina, o que ela consome e quanto já rodou.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar impressora..."
              aria-label="Buscar impressora por nome ou marca"
              className="w-64 pl-8"
            />
          </div>
        </div>
      </div>

      <Separator />

      {renderContent()}
    </div>
  );
}
