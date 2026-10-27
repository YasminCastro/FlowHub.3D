"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronRight,
  History,
  Layers,
  NotebookPen,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalLabel,
  CalSwatch,
  CalVRule,
  CopyValuesButton,
} from "@/components/calibrations/calibration-bits";
import { CalibrationDeleteDialog } from "@/components/calibrations/calibration-delete-dialog";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCalibration } from "@/hooks/use-calibration";
import {
  Calibration,
  CalibrationFilament,
  CalibrationValues,
  SLICERS,
  SLICER_LABELS,
  calibrationSubject,
  findCalibrationFor,
  formatCalibrationAge,
  formatFlow,
  formatPressureAdvance,
  formatRetraction,
  formatTemp,
  formatVolumetricSpeed,
  summarizeValues,
  targetForGroupOf,
  targetOf,
} from "@/lib/api/calibration";
import { SPOOL_LEVEL_LABELS } from "@/lib/api/filament";
import { cn, formatDatePtBR } from "@/lib/utils";

const actionClass =
  "flex items-center gap-2.25 rounded-md border border-border px-2.75 py-2.25 text-[13px] transition-colors hover:border-brand hover:bg-brand/8 hover:text-brand [&_svg]:size-4";

function BigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.25">
      <CalLabel>{label}</CalLabel>
      <span className="font-heading text-[38px] leading-none font-medium tracking-[-0.02em] tabular-nums">
        {value}
      </span>
    </div>
  );
}

// Na mesma ordem do formulário, que é a ordem de preencher o fatiador.
const MEASURED: {
  key: keyof CalibrationValues;
  label: string;
  format: (value: number) => string;
}[] = [
  { key: "bedTempFirstLayer", label: "Mesa 1ª camada", format: formatTemp },
  { key: "bedTemp", label: "Mesa demais camadas", format: formatTemp },
  { key: "nozzleTempInitial", label: "Bico inicial", format: formatTemp },
  { key: "nozzleTemp", label: "Bico final", format: formatTemp },
  { key: "maxVolumetricSpeed", label: "Vazão máxima", format: formatVolumetricSpeed },
  { key: "pressureAdvance", label: "Pressure advance", format: formatPressureAdvance },
  { key: "flow", label: "Fluxo", format: formatFlow },
  { key: "retractionDistance", label: "Retração", format: formatRetraction },
];

function MeasuredValues({ calibration }: { calibration: Calibration }) {
  return (
    <section className="flex flex-col gap-3.5">
      <CalLabel>Valores medidos</CalLabel>
      <div className="grid grid-cols-2 gap-x-5.5 gap-y-6">
        {MEASURED.map(({ key, label, format }) => {
          const value = calibration[key];
          return (
            <BigValue
              key={key}
              label={label}
              value={value != null ? format(value) : "—"}
            />
          );
        })}
      </div>
    </section>
  );
}

function VersionHistory({ calibration }: { calibration: Calibration }) {
  const versions = [
    { id: "current", calibratedAt: calibration.calibratedAt, values: calibration },
    ...calibration.history.map((v) => ({
      id: v.id,
      calibratedAt: v.calibratedAt,
      values: v as CalibrationValues,
    })),
  ];

  return (
    <section className="flex flex-col gap-3.5">
      <CalLabel>Histórico de versões</CalLabel>
      <div className="flex flex-col">
        {versions.map((version, index) => {
          const isCurrent = index === 0;
          const isLast = index === versions.length - 1;
          return (
            <div key={version.id} className="flex gap-3">
              <div className="flex w-4 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "mt-1.25 size-2.25 rounded-full",
                    isCurrent
                      ? "bg-brand"
                      : "shadow-[inset_0_0_0_1px_var(--neutral-600)]",
                  )}
                />
                {!isLast && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className={cn("min-w-0", !isLast && "pb-4")}>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-[13px] tabular-nums",
                      !isCurrent && "text-foreground/75",
                    )}
                  >
                    {formatDatePtBR(version.calibratedAt)}
                  </span>
                  {isCurrent && <Badge>Atual</Badge>}
                </div>
                <div className="mt-1 text-xs text-foreground/60 tabular-nums">
                  {summarizeValues(version.values)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FilamentCard({
  calibration,
  filament,
  overridden,
}: {
  calibration: Calibration;
  filament: CalibrationFilament;
  /** A genérica da marca e material, que esta específica substitui. */
  overridden?: Calibration;
}) {
  return (
    <section className="flex flex-col gap-3.25">
      <CalLabel>O filamento</CalLabel>
      <div className="flex flex-col gap-3 rounded-md bg-card p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5 text-sm">
          <CalSwatch colors={filament.colors} className="size-4" />
          {filament.colorName}
        </div>
        <div className="flex items-stretch gap-4">
          <div className="flex flex-col gap-1">
            <CalLabel>Carretel</CalLabel>
            <span className="font-heading text-lg leading-none font-medium">
              {SPOOL_LEVEL_LABELS[filament.spoolLevel]}
            </span>
          </div>
          <CalVRule />
          <div className="flex flex-col gap-1">
            <CalLabel>Marca</CalLabel>
            <span className="pt-0.75 text-[13px]">{filament.brandName}</span>
          </div>
        </div>
        <Link
          href={`/dashboard/filamentos/${filament.id}`}
          className={cn(actionClass, "text-[12.5px]")}>
          <ArrowUpRight />
          Abrir filamento
        </Link>
      </div>
      {overridden ? (
        <Link
          href={`/dashboard/calibracoes/${overridden.id}`}
          className={cn(actionClass, "justify-between")}
        >
          <span className="flex flex-col items-start gap-0.75">
            <span className="text-[13px]">
              Vale no lugar da genérica de {filament.type}
            </span>
            <span className="text-[11.5px] text-foreground/50 tabular-nums">
              {summarizeValues(overridden)}
            </span>
          </span>
          <ArrowUpRight className="size-3.25!" />
        </Link>
      ) : (
        <Link
          href={`/dashboard/calibracoes/new?from=${calibration.id}&generic=1`}
          className={actionClass}
        >
          <Layers />
          Usar para todas as cores de {filament.type} · {filament.brandName}
        </Link>
      )}
    </section>
  );
}

// Na genérica: as cores que ela cobre. As com calibração própria ficam de fora.
function GroupFilaments({ calibration }: { calibration: Calibration }) {
  const group = calibration.group!;
  return (
    <section className="flex flex-col gap-3.25">
      <div className="flex items-baseline gap-2.5">
        <CalLabel>Filamentos cobertos</CalLabel>
        <span className="text-[11.5px] text-foreground/40">
          {group.type} · {group.brandName}
        </span>
      </div>
      {group.filaments.length ? (
        <div className="flex flex-col">
          {group.filaments.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/filamentos/${f.id}`}
              className="flex items-center gap-2.5 border-b border-border/50 py-2 text-[13px] transition-colors hover:bg-foreground/4"
            >
              <CalSwatch colors={f.colors} className="size-3.5" />
              <span className="truncate">{f.colorName}</span>
              <span className="ml-auto text-[11.5px] text-foreground/50">
                {SPOOL_LEVEL_LABELS[f.spoolLevel]}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">
          Nenhum filamento desta marca e material sem calibração própria nesta
          impressora e fatiador.
        </p>
      )}
      <p className="text-xs leading-normal text-foreground/45">
        Uma cor com calibração própria usa a dela no lugar desta.
      </p>
    </section>
  );
}

export default function CalibrationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { calibration, all, isLoading, loadError, isNotFound } = useCalibration(params.id);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const subject = calibration ? calibrationSubject(calibration) : null;
  const title =
    calibration && subject
      ? `${subject.name} · ${SLICER_LABELS[calibration.slicer]}`
      : null;

  usePageHeaderBreadcrumb(
    calibration ? (
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
        <span className="max-w-80 truncate font-medium">{title}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    calibration ? (
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label="Excluir calibração"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
        </Button>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/calibracoes/${calibration.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <CopyValuesButton calibration={calibration} />
      </div>
    ) : null,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="calibracoes" />;

  if (loadError || !calibration || !subject) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Calibração não encontrada."}
        </p>
      </div>
    );
  }

  const versionNumber = calibration.history.length + 1;
  const otherSlicers = SLICERS.filter((s) => s !== calibration.slicer).map(
    (slicer) => ({
      slicer,
      sibling: findCalibrationFor(
        all,
        targetOf(calibration),
        calibration.printer.id,
        slicer,
      ),
    }),
  );
  // Específica de um filamento que também tem genérica: ela vence.
  const overridden = calibration.filament
    ? findCalibrationFor(
        all,
        targetForGroupOf(calibration.filament),
        calibration.printer.id,
        calibration.slicer,
      )
    : undefined;

  return (
    <div className="-m-4 grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_372px]">
      <div className="flex min-w-0 flex-col gap-6.5 px-7.5 py-6.5">
        <div className="flex items-start gap-4">
          <CalSwatch
            colors={subject.colors}
            className="size-11.5 rounded-[10px]"
          />
          <div className="min-w-0">
            <h1 className="mb-1.25 text-[32px] leading-tight font-bold">
              {subject.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.25">
              <Badge variant="outline">{subject.type}</Badge>
              {subject.isGeneric && <Badge variant="secondary">Genérica</Badge>}
              <Badge>{SLICER_LABELS[calibration.slicer]}</Badge>
              <span className="flex items-center gap-1.5 text-[12.5px] text-foreground/55">
                <Printer className="size-3.25" aria-hidden="true" />
                {calibration.printer.name}
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] text-foreground/55">
                <History className="size-3.25" aria-hidden="true" />
                calibrada {formatCalibrationAge(calibration.calibratedAt)} ·{" "}
                {versionNumber}ª versão
              </span>
            </div>
          </div>
        </div>

        <MeasuredValues calibration={calibration} />

        {calibration.notes && (
          <>
            <hr className="fade-rule" />
            <section className="flex flex-col gap-3">
              <CalLabel>Observações</CalLabel>
              <p className="m-0 max-w-[64ch] text-[13.5px] leading-relaxed text-pretty text-foreground/72">
                {calibration.notes}
              </p>
            </section>
          </>
        )}

        <hr className="fade-rule" />

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline gap-2.5">
            <CalLabel>Impressões com estes valores</CalLabel>
            <span className="text-[11.5px] text-foreground/40">
              {calibration.prints.length === 1
                ? "1 impressão desde a calibração"
                : `${calibration.prints.length} impressões desde a calibração`}
            </span>
          </div>
          {calibration.prints.length ? (
            <div className="flex flex-col">
              {calibration.prints.map((print) => (
                <Link
                  key={print.id}
                  href={`/dashboard/impressoes/${print.printItemId}`}
                  className="grid grid-cols-[minmax(0,1fr)_96px_90px_90px_26px] items-center gap-3.5 border-b border-border/50 py-2.25 transition-colors hover:bg-foreground/4"
                >
                  <span className="truncate text-[13.5px]">{print.name}</span>
                  <span className="text-[12.5px] text-foreground/60 tabular-nums">
                    {formatDatePtBR(print.printedAt, {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span className="text-right text-[12.5px] tabular-nums">
                    {Math.round(print.grams)} g
                  </span>
                  <Badge
                    variant={print.outcome === "SUCCESS" ? "default" : "outline"}
                    className="justify-self-end"
                  >
                    {print.outcome === "SUCCESS" ? "Boa" : "Com falha"}
                  </Badge>
                  <ArrowUpRight
                    className="size-3.25 justify-self-end text-foreground/35"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              {subject.isGeneric
                ? "Nenhuma impressão registrada com os filamentos desta genérica nesta impressora desde a calibração."
                : "Nenhuma impressão registrada com este filamento nesta impressora desde a calibração."}
            </p>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-5.5 border-t bg-[#1a1c29] p-6.5 lg:border-t-0 lg:border-l">
        <VersionHistory calibration={calibration} />

        <hr className="fade-rule" />

        {calibration.filament ? (
          <FilamentCard
            calibration={calibration}
            filament={calibration.filament}
            overridden={overridden}
          />
        ) : (
          <GroupFilaments calibration={calibration} />
        )}

        <hr className="fade-rule" />

        <section className="flex flex-col gap-3.25">
          <CalLabel>
            {subject.isGeneric
              ? "Mesma genérica nos outros fatiadores"
              : "Mesmo filamento nos outros fatiadores"}
          </CalLabel>
          {otherSlicers.map(({ slicer, sibling }) =>
            sibling ? (
              <Link
                key={slicer}
                href={`/dashboard/calibracoes/${sibling.id}`}
                className={cn(actionClass, "justify-between")}
              >
                <span className="flex flex-col items-start gap-0.75">
                  <span className="text-[13px]">{SLICER_LABELS[slicer]}</span>
                  <span className="text-[11.5px] text-foreground/50 tabular-nums">
                    {summarizeValues(sibling)}
                  </span>
                </span>
                <ArrowUpRight className="size-3.25!" />
              </Link>
            ) : (
              <Link
                key={slicer}
                href={`/dashboard/calibracoes/new?from=${calibration.id}&slicer=${slicer}`}
                className={actionClass}
              >
                <Plus />
                Calibrar no {SLICER_LABELS[slicer]}
              </Link>
            ),
          )}
        </section>

        <div className="mt-auto flex flex-col gap-2.25">
          <Link
            href={`/dashboard/calibracoes/new?from=${calibration.id}`}
            className={actionClass}
          >
            <Plus />
            Nova versão desta calibração
          </Link>
          <Link href="/dashboard/diario/new" className={actionClass}>
            <NotebookPen />
            Registrar problema no diário
          </Link>
        </div>
      </aside>

      <CalibrationDeleteDialog
        calibrationId={calibration.id}
        calibrationName={title ?? ""}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/calibracoes")}
      />
    </div>
  );
}
