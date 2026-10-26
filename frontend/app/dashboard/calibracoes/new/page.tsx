"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  CalibrationForm,
  CalibrationFormDefaults,
} from "@/components/calibrations/calibration-form";
import { useCalibration } from "@/hooks/use-calibration";
import {
  CalibrationInput,
  CalibrationValues,
  SLICERS,
  Slicer,
  parseDecimal,
  pickValues,
  saveCalibration,
  targetForGroupOf,
  targetOf,
} from "@/lib/api/calibration";

// Valores que o guia por fatiador manda pela URL.
const VALUE_PARAMS: (keyof CalibrationValues)[] = [
  "flow",
  "nozzleTempInitial",
  "nozzleTemp",
  "bedTempFirstLayer",
  "bedTemp",
  "pressureAdvance",
  "maxVolumetricSpeed",
  "retractionDistance",
];

function NewCalibration() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("from");
  const { calibration: source, isLoading } = useCalibration(fromId);

  if (fromId && isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const slicerParam = params.get("slicer") as Slicer | null;
  const fromUrl: Partial<CalibrationValues> = {};
  for (const key of VALUE_PARAMS) {
    const value = parseDecimal(params.get(key) ?? "");
    if (value !== null) fromUrl[key] = value;
  }

  // "Nova versão": parte dos valores atuais, data de hoje e sem observação.
  // Com ?generic=1, a específica de origem vira a genérica da marca e
  // material dela.
  const sourceTarget = source ? targetOf(source) : null;
  const group =
    sourceTarget && "brandId" in sourceTarget
      ? sourceTarget
      : source?.filament && params.get("generic") === "1"
        ? targetForGroupOf(source.filament)
        : null;
  const defaults: CalibrationFormDefaults = {
    group,
    filamentId: group
      ? undefined
      : (source?.filament?.id ?? params.get("filament") ?? undefined),
    printerId: source?.printer.id ?? params.get("printer") ?? undefined,
    slicer:
      slicerParam && SLICERS.includes(slicerParam)
        ? slicerParam
        : source?.slicer,
    values: { ...(source ? pickValues(source) : {}), ...fromUrl },
  };

  async function handleSubmit(input: CalibrationInput) {
    const saved = await saveCalibration(input);
    router.push(`/dashboard/calibracoes/${saved.id}`);
  }

  return (
    <CalibrationForm
      defaults={defaults}
      cancelHref={
        source ? `/dashboard/calibracoes/${source.id}` : "/dashboard/calibracoes"
      }
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
          <span className="font-medium">
            {source && group && !source.group
              ? "Nova genérica"
              : source
                ? "Nova versão"
                : "Nova"}
          </span>
        </>
      }
    />
  );
}

export default function NewCalibrationPage() {
  return (
    <Suspense>
      <NewCalibration />
    </Suspense>
  );
}
