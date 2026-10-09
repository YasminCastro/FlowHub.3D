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
import { PrinterMaintenanceDeleteDialog } from "@/components/printers/printer-maintenance-delete-dialog";
import { PrinterMaintenanceDetailDialog } from "@/components/printers/printer-maintenance-detail-dialog";
import { PrinterMaintenanceDialog } from "@/components/printers/printer-maintenance-dialog";
import { PrinterMaintenanceHistory } from "@/components/printers/printer-maintenance-history";
import { PrinterSpecCard } from "@/components/printers/printer-spec-card";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { usePrinter } from "@/hooks/use-printer";
import { usePrinterMaintenances } from "@/hooks/use-printer-maintenances";
import { PrinterMaintenance, buildPrinterStats } from "@/lib/api/printer";
import { formatDatePtBR } from "@/lib/utils";

export default function PrinterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { printer, isLoading, loadError, reload } = usePrinter(params.id);
  const maintenanceHistory = usePrinterMaintenances(params.id);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] =
    useState(false);
  // Manutenção aberta no histórico. Fica guardada depois de fechar os
  // diálogos para que eles animem a saída com o conteúdo ainda visível.
  const [selectedMaintenance, setSelectedMaintenance] =
    useState<PrinterMaintenance | null>(null);
  const [isEditingMaintenance, setIsEditingMaintenance] = useState(false);
  const [isMaintenanceDetailOpen, setIsMaintenanceDetailOpen] =
    useState(false);
  const [isMaintenanceDeleteOpen, setIsMaintenanceDeleteOpen] =
    useState(false);

  function reloadAfterMaintenanceChange() {
    reload();
    maintenanceHistory.reload();
  }

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
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setIsEditingMaintenance(false);
            setIsMaintenanceDialogOpen(true);
          }}
        >
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

        <Separator />

        <PrinterMaintenanceHistory
          maintenances={maintenanceHistory.maintenances}
          totalCost={maintenanceHistory.totalCost}
          isLoading={maintenanceHistory.isLoading}
          loadError={maintenanceHistory.loadError}
          onSelect={(maintenance) => {
            setSelectedMaintenance(maintenance);
            setIsMaintenanceDetailOpen(true);
          }}
        />
      </div>

      <PrinterCostSummary
        energyCostPerHour={energyCostPerHour}
        maintenanceCostPerHour={maintenanceCostPerHour}
      />

      <PrinterMaintenanceDialog
        printerId={printer.id}
        printerName={printer.name}
        currentNozzle={printer.nozzle}
        lastPrinterHours={
          maintenanceHistory.maintenances.find(
            (maintenance) => maintenance.printerHours != null,
          )?.printerHours ?? null
        }
        maintenance={isEditingMaintenance ? selectedMaintenance : null}
        open={isMaintenanceDialogOpen}
        onOpenChange={setIsMaintenanceDialogOpen}
        onRegistered={reloadAfterMaintenanceChange}
      />

      <PrinterMaintenanceDetailDialog
        printerName={printer.name}
        maintenance={selectedMaintenance}
        open={isMaintenanceDetailOpen}
        onOpenChange={setIsMaintenanceDetailOpen}
        onEdit={() => {
          setIsMaintenanceDetailOpen(false);
          setIsEditingMaintenance(true);
          setIsMaintenanceDialogOpen(true);
        }}
        onDelete={() => {
          setIsMaintenanceDetailOpen(false);
          setIsMaintenanceDeleteOpen(true);
        }}
      />

      <PrinterMaintenanceDeleteDialog
        printerId={printer.id}
        maintenance={selectedMaintenance}
        open={isMaintenanceDeleteOpen}
        onOpenChange={setIsMaintenanceDeleteOpen}
        onDeleted={reloadAfterMaintenanceChange}
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
