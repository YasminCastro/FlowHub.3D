"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Pencil,
  Printer as PrinterIcon,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PrinterCostSummary } from "@/components/printers/printer-cost-summary";
import { PrinterDeleteDialog } from "@/components/printers/printer-delete-dialog";
import { PrinterSpecCard } from "@/components/printers/printer-spec-card";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { usePrinter } from "@/hooks/use-printer";
import { buildPrinterStats } from "@/lib/api/printer";
import { formatDatePtBR } from "@/lib/utils";

export default function PrinterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { printer, isLoading, loadError } = usePrinter(params.id);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  usePageHeaderBreadcrumb(
    printer ? (
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
        <span className="font-medium">{printer.name}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    printer ? (
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm">
          <Wrench />
          Registrar manutenção
        </Button>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/printers/${printer.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
          Excluir
        </Button>
      </div>
    ) : null,
  );

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

  const stats = buildPrinterStats(printer);
  const hasEnergyCost =
    printer.powerConsumptionW != null && printer.energyCostPerKwh != null;
  const energyCostPerHour = hasEnergyCost
    ? (printer.powerConsumptionW! / 1000) * printer.energyCostPerKwh!
    : 0;
  const maintenanceCostPerHour = printer.maintenanceCostPerHour ?? 0;
  const joinedSince = printer.purchaseDate
    ? formatDatePtBR(printer.purchaseDate, {
        month: "2-digit",
        year: "numeric",
      })
    : "-";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <PrinterIcon className="size-7" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="font-heading text-2xl font-medium leading-none">
              {printer.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              comprada em {joinedSince}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-2xl font-medium">{stat.value}</span>
              {stat.caption && (
                <span className="text-xs text-muted-foreground">
                  {stat.caption}
                </span>
              )}
            </div>
          ))}
        </div>

        <Separator />

        <PrinterSpecCard printer={printer} />
      </div>

      <PrinterCostSummary
        energyCostPerHour={energyCostPerHour}
        maintenanceCostPerHour={maintenanceCostPerHour}
      />

      <PrinterDeleteDialog
        printerId={printer.id}
        printerName={printer.name}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/printers")}
      />
    </div>
  );
}
