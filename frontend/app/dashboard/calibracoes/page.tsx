"use client";

import Link from "next/link";
import { Gauge, Plus, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalLabel,
  CalSwatch,
  CalVRule,
  CalibrationAge,
  CopyValuesIconButton,
} from "@/components/calibrations/calibration-bits";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  Calibration,
  CalibrationFilament,
  SLICERS,
  SLICER_LABELS,
  Slicer,
  formatFlow,
  formatPressureAdvance,
  formatRetraction,
  formatTemp,
  getCalibrationAgeDays,
  getUncalibratedFilaments,
  listCalibrationFilaments,
  listCalibrations,
} from "@/lib/api/calibration";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "oldest" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  name: "Filamento A–Z",
};

const ROW_GRID =
  "grid grid-cols-[minmax(160px,1.6fr)_88px_84px_66px_62px_72px_74px_110px_34px] items-center gap-3";

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs whitespace-nowrap transition-colors",
        selected
          ? "border-brand bg-brand/10 text-brand"
          : "border-border text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.75">
      <CalLabel>{label}</CalLabel>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-heading text-[32px] leading-none font-medium tracking-[-0.02em] tabular-nums",
            accent && "text-brand-300",
          )}
        >
          {value}
        </span>
        {detail && (
          <span className="text-[12.5px] text-foreground/55">{detail}</span>
        )}
      </div>
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-right text-[13px] tabular-nums">{children}</span>
  );
}

function CalibrationRow({ calibration }: { calibration: Calibration }) {
  return (
    <div
      className={cn(
        ROW_GRID,
        "relative border-b border-border/50 py-2.75 transition-colors hover:bg-foreground/4",
      )}
    >
      <Link
        href={`/dashboard/calibracoes/${calibration.id}`}
        className="flex min-w-0 items-center gap-2.25 text-sm after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:outline-brand"
      >
        <CalSwatch colors={calibration.filament.colors} />
        <span className="truncate">{calibration.filament.colorName}</span>
      </Link>
      <Badge variant="outline" className="justify-self-start">
        {calibration.filament.type}
      </Badge>
      <span className="text-[12.5px] text-foreground/60">
        {SLICER_LABELS[calibration.slicer]}
      </span>
      <Num>{formatFlow(calibration.flow)}</Num>
      <Num>{formatTemp(calibration.nozzleTemp)}</Num>
      <Num>{formatPressureAdvance(calibration.pressureAdvance)}</Num>
      <Num>
        {calibration.retractionDistance != null
          ? formatRetraction(calibration.retractionDistance)
          : "—"}
      </Num>
      <CalibrationAge calibratedAt={calibration.calibratedAt} />
      <CopyValuesIconButton
        calibration={calibration}
        className="relative z-10 justify-self-end"
      />
    </div>
  );
}

function UncalibratedNotice({
  filaments,
}: {
  filaments: CalibrationFilament[];
}) {
  const [open, setOpen] = useState(false);
  if (filaments.length === 0) return null;

  const count = filaments.length;
  const highlight = filaments[0];

  return (
    <div className="flex flex-col gap-3 rounded-md px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
      <div className="flex items-center gap-2.5">
        <Gauge className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="text-[12.5px] text-foreground/62">
          {count === 1
            ? "Um filamento em estoque ainda sem calibração"
            : `${count} filamentos em estoque ainda sem calibração`}
          .
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Esconder" : "Ver quais"}
        </Button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.75">
          {filaments.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/calibracoes/new?filament=${f.id}`}
              className="inline-flex items-center gap-1.75 rounded-md border border-border px-2.5 py-1 text-xs text-foreground/78 transition-colors hover:border-brand hover:bg-brand/8 hover:text-brand"
            >
              <CalSwatch colors={f.colors} className="size-2.5" />
              {f.colorName}
              <span className="text-muted-foreground">{f.type}</span>
              <Plus className="size-3" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalibrationsPage() {
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [filaments, setFilaments] = useState<CalibrationFilament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [slicerFilter, setSlicerFilter] = useState<Slicer | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [printerFilter, setPrinterFilter] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([listCalibrations(), listCalibrationFilaments()])
      .then(([cals, fils]) => {
        if (ignore) return;
        setCalibrations(cals);
        setFilaments(fils);
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar as calibrações.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/calibracoes/new" />}
      nativeButton={false}
    >
      <Plus />
      Nova calibração
    </Button>,
  );

  const types = [...new Set(calibrations.map((c) => c.filament.type))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const printers = [
    ...new Map(calibrations.map((c) => [c.printer.id, c.printer])).values(),
  ];
  const usedSlicers = SLICERS.filter((s) =>
    calibrations.some((c) => c.slicer === s),
  );
  const uncalibrated = getUncalibratedFilaments(calibrations, filaments);
  const oldest = calibrations.reduce<Calibration | null>(
    (acc, c) => (!acc || c.calibratedAt < acc.calibratedAt ? c : acc),
    null,
  );

  const query = search.trim().toLowerCase();
  const visible = calibrations
    .filter((c) => !query || c.filament.colorName.toLowerCase().includes(query))
    .filter((c) => !slicerFilter || c.slicer === slicerFilter)
    .filter((c) => !typeFilter || c.filament.type === typeFilter)
    .filter((c) => !printerFilter || c.printer.id === printerFilter)
    .sort((a, b) => {
      if (sort === "name")
        return a.filament.colorName.localeCompare(
          b.filament.colorName,
          "pt-BR",
        );
      const diff = a.calibratedAt.localeCompare(b.calibratedAt);
      return sort === "recent" ? -diff : diff;
    });

  const selectedPrinter = printers.find((p) => p.id === printerFilter);

  function renderTable() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    }

    if (loadError) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      );
    }

    if (calibrations.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Gauge className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nenhuma calibração ainda. Anote os valores que funcionaram no último
            rolo que você calibrou.
          </p>
          <Button
            size="sm"
            render={<Link href="/dashboard/calibracoes/new" />}
            nativeButton={false}
          >
            <Plus />
            Nova calibração
          </Button>
        </div>
      );
    }

    if (visible.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma calibração com esses filtros.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="flex min-w-220 flex-col">
          <div className={cn(ROW_GRID, "py-1.75")}>
            <CalLabel>Filamento</CalLabel>
            <CalLabel>Tipo</CalLabel>
            <CalLabel>Fatiador</CalLabel>
            <CalLabel className="text-right">Fluxo</CalLabel>
            <CalLabel className="text-right">Bico</CalLabel>
            <CalLabel className="text-right">PA</CalLabel>
            <CalLabel className="text-right">Retração</CalLabel>
            <CalLabel>Calibrada</CalLabel>
            <span />
          </div>
          {visible.map((calibration) => (
            <CalibrationRow key={calibration.id} calibration={calibration} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4.5 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Calibrações</h1>
          <p className="text-sm text-muted-foreground">
            Os valores que funcionaram para cada filamento, por impressora e
            fatiador.
          </p>
        </div>

        <div className="flex items-center gap-2.25">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por filamento…"
              aria-label="Filtrar calibrações pelo nome do filamento"
              className="w-52.5 pl-8"
            />
          </div>
          <Select
            value={sort}
            onValueChange={(value) => value && setSort(value as SortKey)}
          >
            <SelectTrigger className="w-auto min-w-40" aria-label="Ordenar">
              <SelectValue>
                {(value: SortKey) => SORT_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isLoading && calibrations.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-6.5">
          <Stat label="Calibrações" value={calibrations.length} />
          <CalVRule />
          <Stat
            label="Filamentos sem calibração"
            value={uncalibrated.length}
            accent={uncalibrated.length > 0}
          />
          {oldest && (
            <>
              <CalVRule />
              <Stat
                label="Mais antiga"
                value={getCalibrationAgeDays(oldest.calibratedAt)}
                detail={`dias · ${oldest.filament.colorName} ${oldest.filament.type}`}
              />
            </>
          )}
          <CalVRule />
          <Stat
            label="Fatiadores"
            value={usedSlicers.length}
            detail={usedSlicers.map((s) => SLICER_LABELS[s]).join(" e ")}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.75">
        <FilterChip
          selected={slicerFilter === null}
          onClick={() => setSlicerFilter(null)}
        >
          Todas
        </FilterChip>
        {SLICERS.map((slicer) => (
          <FilterChip
            key={slicer}
            selected={slicerFilter === slicer}
            onClick={() =>
              setSlicerFilter((prev) => (prev === slicer ? null : slicer))
            }
          >
            {SLICER_LABELS[slicer]}
          </FilterChip>
        ))}
        {types.length > 0 && (
          <span className="mx-1 h-5.5 w-px bg-border" aria-hidden="true" />
        )}
        {types.map((type) => (
          <FilterChip
            key={type}
            selected={typeFilter === type}
            onClick={() =>
              setTypeFilter((prev) => (prev === type ? null : type))
            }
          >
            {type}
          </FilterChip>
        ))}
        {printers.length > 0 && (
          <span className="mx-1 h-5.5 w-px bg-border" aria-hidden="true" />
        )}
        {printers.map((printer) => (
          <FilterChip
            key={printer.id}
            selected={printerFilter === printer.id}
            onClick={() =>
              setPrinterFilter((prev) =>
                prev === printer.id ? null : printer.id,
              )
            }
          >
            <Printer className="size-3.25" aria-hidden="true" />
            {printer.name}
          </FilterChip>
        ))}
        {!isLoading && (
          <span className="ml-auto text-[11.5px] text-foreground/40">
            {visible.length}{" "}
            {visible.length === 1 ? "calibração" : "calibrações"}
            {selectedPrinter && ` · ${selectedPrinter.name}`}
          </span>
        )}
      </div>

      {renderTable()}

      {!isLoading && <UncalibratedNotice filaments={uncalibrated} />}
    </div>
  );
}
