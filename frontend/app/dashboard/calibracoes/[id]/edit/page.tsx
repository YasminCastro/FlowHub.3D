"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { CalibrationForm } from "@/components/calibrations/calibration-form";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { useCalibration } from "@/hooks/use-calibration";
import {
  CalibrationInput,
  SLICER_LABELS,
  updateCalibration,
} from "@/lib/api/calibration";

export default function EditCalibrationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { calibration, isLoading, loadError, isNotFound } = useCalibration(params.id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="calibracoes" />;

  if (loadError || !calibration) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Calibração não encontrada."}
        </p>
      </div>
    );
  }

  const detailHref = `/dashboard/calibracoes/${calibration.id}`;

  async function handleSubmit(input: CalibrationInput) {
    await updateCalibration(params.id, input);
    router.push(detailHref);
  }

  return (
    <CalibrationForm
      calibration={calibration}
      cancelHref={detailHref}
      onSubmit={handleSubmit}
      breadcrumb={
        <>
          <Link
            href="/dashboard/calibracoes"
            className="text-muted-foreground hover:text-foreground"
          >
            Calibrações
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Link
            href={detailHref}
            className="max-w-60 truncate text-muted-foreground hover:text-foreground"
          >
            {calibration.filament.colorName} ·{" "}
            {SLICER_LABELS[calibration.slicer]}
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
