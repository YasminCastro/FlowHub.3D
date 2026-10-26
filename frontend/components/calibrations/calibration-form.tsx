"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  Copy,
  Droplet,
  LucideIcon,
  MoveHorizontal,
  NotebookPen,
  NotebookText,
  Printer,
  Thermometer,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CalLabel,
  CalSwatch,
} from "@/components/calibrations/calibration-bits";
import {
  FilamentCascadeSelect,
  FilamentGroupValue,
} from "@/components/calibrations/filament-cascade-select";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import {
  Calibration,
  CalibrationFilament,
  CalibrationInput,
  CalibrationPrinter,
  CalibrationTarget,
  CalibrationValues,
  SLICERS,
  SLICER_LABELS,
  Slicer,
  calibrationSubject,
  findCalibrationFor,
  formatCalibrationAge,
  formatFlow,
  formatPressureAdvance,
  formatRetraction,
  formatTemp,
  listCalibrationFilaments,
  listCalibrationPrinters,
  listCalibrations,
  parseDecimal,
  sameFilamentType,
  sanitizeNumber,
  targetForGroupOf,
  targetOf,
} from "@/lib/api/calibration";
import { cn } from "@/lib/utils";

const FORM_ID = "calibration-form";

type NumberRule = {
  min: number;
  max: number;
  unit?: string;
  integer?: boolean;
  required?: string;
};

// Mesmas faixas da API (CALIBRATION_RANGES no backend).
function numberField({ min, max, unit = "", integer, required }: NumberRule) {
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  return z.string().superRefine((raw, ctx) => {
    const value = raw.trim();
    if (!value) {
      if (required) ctx.addIssue({ code: "custom", message: required });
      return;
    }
    if (integer && !/^\d+$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "Use um número inteiro." });
      return;
    }
    const n = parseDecimal(value);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Número inválido." });
    } else if (n < min || n > max) {
      ctx.addIssue({
        code: "custom",
        message: `Entre ${fmt(min)} e ${fmt(max)}${unit}.`,
      });
    }
  });
}

const nozzleRule = {
  min: 150,
  max: 350,
  unit: " °C",
  integer: true,
  required: "Informe a temperatura.",
};
const bedRule = {
  min: 0,
  max: 150,
  unit: " °C",
  integer: true,
  required: "Informe a temperatura.",
};

const calibrationFormSchema = z
  .object({
    // Um filamento, ou a genérica (marca + material) em "group".
    filamentId: z.string(),
    group: z
      .object({ brandId: z.string(), brandName: z.string(), type: z.string() })
      .nullable(),
    printerId: z.string().min(1, "Escolha a impressora."),
    slicer: z.enum(["ORCA", "CREALITY"]),
    flow: numberField({ min: 0.5, max: 1.5, required: "Informe o fluxo." }),
    nozzleTempInitial: numberField(nozzleRule),
    nozzleTemp: numberField(nozzleRule),
    bedTempFirstLayer: numberField(bedRule),
    bedTemp: numberField(bedRule),
    pressureAdvance: numberField({ min: 0, max: 2, required: "Informe o PA." }),
    calibratedAt: z.string().min(1, "Informe a data."),
    maxVolumetricSpeed: numberField({ min: 1, max: 100, unit: " mm³/s" }),
    retractionDistance: numberField({ min: 0, max: 15, unit: " mm" }),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.filamentId && !values.group) {
      ctx.addIssue({
        code: "custom",
        path: ["filamentId"],
        message: "Escolha o filamento.",
      });
    }
  });

type CalibrationFormValues = z.infer<typeof calibrationFormSchema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

const num = (value: number | null | undefined, digits?: number) =>
  value == null
    ? ""
    : digits != null
      ? value.toLocaleString("pt-BR", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })
      : String(value);

function valuesToForm(values: Partial<CalibrationValues>) {
  return {
    flow: values.flow == null ? "" : formatFlow(values.flow),
    nozzleTempInitial: num(values.nozzleTempInitial),
    nozzleTemp: num(values.nozzleTemp),
    bedTempFirstLayer: num(values.bedTempFirstLayer),
    bedTemp: num(values.bedTemp),
    pressureAdvance: num(values.pressureAdvance, 3),
    maxVolumetricSpeed:
      values.maxVolumetricSpeed == null
        ? ""
        : values.maxVolumetricSpeed.toLocaleString("pt-BR", {
            maximumFractionDigits: 2,
          }),
    retractionDistance:
      values.retractionDistance == null
        ? ""
        : values.retractionDistance.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
          }),
  };
}

export type CalibrationFormDefaults = Partial<
  Pick<CalibrationInput, "printerId" | "slicer">
> & {
  filamentId?: string;
  /** Genérica: marca + material em vez do filamento. */
  group?: FilamentGroupValue | null;
  /** Valores de partida (nova versão, ou vindos do guia por fatiador). */
  values?: Partial<CalibrationValues>;
  notes?: string | null;
};

function toDefaultValues(
  calibration?: Calibration | null,
  defaults?: CalibrationFormDefaults,
): CalibrationFormValues {
  const target = calibration ? targetOf(calibration) : null;
  return {
    filamentId: target
      ? "filamentId" in target
        ? target.filamentId
        : ""
      : (defaults?.filamentId ?? ""),
    group: target
      ? "brandId" in target
        ? target
        : null
      : (defaults?.group ?? null),
    printerId: calibration?.printer.id ?? defaults?.printerId ?? "",
    slicer: calibration?.slicer ?? defaults?.slicer ?? "ORCA",
    calibratedAt: calibration ? calibration.calibratedAt.slice(0, 10) : today(),
    notes: calibration?.notes ?? defaults?.notes ?? "",
    ...valuesToForm(calibration ?? defaults?.values ?? {}),
  };
}

function toInput(values: CalibrationFormValues): CalibrationInput {
  const optional = (value: string) =>
    value.trim() ? parseDecimal(value) : null;
  return {
    filamentId: values.group ? null : values.filamentId,
    brandId: values.group?.brandId ?? null,
    filamentType: values.group?.type ?? null,
    printerId: values.printerId,
    slicer: values.slicer,
    calibratedAt: toIso(values.calibratedAt),
    flow: parseDecimal(values.flow)!,
    nozzleTempInitial: parseDecimal(values.nozzleTempInitial)!,
    nozzleTemp: parseDecimal(values.nozzleTemp)!,
    bedTempFirstLayer: parseDecimal(values.bedTempFirstLayer)!,
    bedTemp: parseDecimal(values.bedTemp)!,
    pressureAdvance: parseDecimal(values.pressureAdvance)!,
    maxVolumetricSpeed: optional(values.maxVolumetricSpeed),
    retractionDistance: optional(values.retractionDistance),
    notes: values.notes.trim() || null,
  };
}

type FieldTone = "bed" | "nozzle" | "speed" | "flow" | "retraction" | "notes";

const TONE_CLASSES: Record<FieldTone, string> = {
  bed: "bg-[#9fb3c8]/15 text-[#9fb3c8]",
  nozzle: "bg-[#e8a23a]/15 text-[#e8a23a]",
  speed: "bg-[#e07a5f]/15 text-[#e07a5f]",
  flow: "bg-[#e8c547]/15 text-[#e8c547]",
  retraction: "bg-[#4fb8a5]/15 text-[#4fb8a5]",
  notes: "bg-[#4fb8a5]/15 text-[#4fb8a5]",
};

const TONE_ICONS: Record<FieldTone, LucideIcon> = {
  bed: Thermometer,
  nozzle: Thermometer,
  speed: Activity,
  flow: Droplet,
  retraction: MoveHorizontal,
  notes: NotebookText,
};

/** Rótulo com o ícone colorido do tipo de valor. */
function FieldLabel({
  tone,
  children,
}: {
  tone: FieldTone;
  children: ReactNode;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <FormLabel className="gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-5.5 shrink-0 place-items-center rounded-md",
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="size-3.25" />
      </span>
      {children}
    </FormLabel>
  );
}

// Na ordem em que se preenche o perfil do filamento no fatiador, dois por
// linha. A unidade vai no título.
const MEASURED_FIELDS: {
  name:
    | "bedTempFirstLayer"
    | "bedTemp"
    | "nozzleTempInitial"
    | "nozzleTemp"
    | "maxVolumetricSpeed"
    | "pressureAdvance"
    | "flow"
    | "retractionDistance";
  label: string;
  tone: FieldTone;
  placeholder: string;
  /** Casas depois da vírgula; 0 = inteiro. */
  decimals: number;
}[] = [
  {
    name: "bedTempFirstLayer",
    label: "Temperatura mesa 1ª camada (°C)",
    tone: "bed",
    placeholder: "65",
    decimals: 0,
  },
  {
    name: "bedTemp",
    label: "Temperatura mesa demais camadas (°C)",
    tone: "bed",
    placeholder: "60",
    decimals: 0,
  },
  {
    name: "nozzleTempInitial",
    label: "Temperatura bico inicial (°C)",
    tone: "nozzle",
    placeholder: "215",
    decimals: 0,
  },
  {
    name: "nozzleTemp",
    label: "Temperatura bico final (°C)",
    tone: "nozzle",
    placeholder: "210",
    decimals: 0,
  },
  {
    name: "maxVolumetricSpeed",
    label: "Max Volumetric Speed (mm³/s)",
    tone: "speed",
    placeholder: "18,5",
    decimals: 2,
  },
  {
    name: "pressureAdvance",
    label: "Pressure Advance",
    tone: "speed",
    placeholder: "0,020",
    decimals: 3,
  },
  {
    name: "flow",
    label: "Fluxo",
    tone: "flow",
    placeholder: "1,00",
    decimals: 3,
  },
  {
    name: "retractionDistance",
    label: "Retração de distância (mm)",
    tone: "retraction",
    placeholder: "0,8",
    decimals: 2,
  },
];

function SectionHead({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <CalLabel>{label}</CalLabel>
      <span className="text-[11.5px] text-foreground/40">{hint}</span>
    </div>
  );
}

function SlicerSegment({
  value,
  onChange,
}: {
  value: Slicer;
  onChange: (value: Slicer) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Fatiador"
      className="inline-flex h-9 items-center gap-0.5 rounded-md border border-border p-0.5"
    >
      {SLICERS.map((slicer) => (
        <button
          key={slicer}
          type="button"
          role="radio"
          aria-checked={value === slicer}
          onClick={() => onChange(slicer)}
          className={cn(
            "h-full rounded-[5px] px-3.5 text-[13px] transition-colors",
            value === slicer
              ? "bg-brand/14 text-brand"
              : "text-foreground/70 hover:bg-foreground/6 hover:text-foreground",
          )}
        >
          {SLICER_LABELS[slicer]}
        </button>
      ))}
    </div>
  );
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <CalLabel className="mb-1 block">{label}</CalLabel>
      <div className="text-base tabular-nums">{value}</div>
    </div>
  );
}

function PreviousValues({ calibration }: { calibration: Calibration }) {
  return (
    <div className="flex flex-col gap-2 text-[12.5px] text-foreground/62">
      {(
        [
          ["Fluxo", formatFlow(calibration.flow)],
          ["Bico", formatTemp(calibration.nozzleTemp)],
          ["Pressure advance", formatPressureAdvance(calibration.pressureAdvance)],
          ["Calibrada", formatCalibrationAge(calibration.calibratedAt)],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="flex justify-between">
          <span>{label}</span>
          <span className="text-foreground tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export type CalibrationFormProps = {
  /** Calibração sendo corrigida no lugar. Omitida = nova (ou nova versão). */
  calibration?: Calibration | null;
  defaults?: CalibrationFormDefaults;
  breadcrumb: ReactNode;
  cancelHref: string;
  onSubmit: (input: CalibrationInput) => Promise<void>;
};

export function CalibrationForm({
  calibration,
  defaults,
  breadcrumb,
  cancelHref,
  onSubmit,
}: CalibrationFormProps) {
  const router = useRouter();
  const isEditing = !!calibration;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [filaments, setFilaments] = useState<CalibrationFilament[]>([]);
  const [printers, setPrinters] = useState<CalibrationPrinter[]>([]);
  const [existing, setExisting] = useState<Calibration[]>([]);

  const form = useForm<CalibrationFormValues>({
    resolver: zodResolver(calibrationFormSchema),
    defaultValues: toDefaultValues(calibration, defaults),
  });

  useEffect(() => {
    Promise.all([
      listCalibrationFilaments(),
      listCalibrationPrinters(),
      // Só serve para "calibração anterior" e "copiar de": sem ela o
      // formulário continua funcionando.
      listCalibrations().catch(() => []),
    ]).then(([fils, prns, cals]) => {
      setFilaments(fils);
      setPrinters(prns);
      setExisting(cals);
      // Uma impressora só: já vem escolhida.
      if (!form.getValues("printerId") && prns.length === 1) {
        form.setValue("printerId", prns[0].id);
      }
    });
  }, [form]);

  const isSubmitting = form.formState.isSubmitting;

  usePageHeaderBreadcrumb(breadcrumb);

  usePageHeaderAction(
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(cancelHref)}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form={FORM_ID}
        size="sm"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        <Check />
        {isSubmitting
          ? "Salvando..."
          : isEditing
            ? "Salvar alterações"
            : "Salvar calibração"}
      </Button>
    </div>,
  );

  const watched = form.watch();
  const filament = filaments.find((f) => f.id === watched.filamentId);
  const printer = printers.find((p) => p.id === watched.printerId);
  const target: CalibrationTarget | null = watched.group
    ? watched.group
    : watched.filamentId
      ? { filamentId: watched.filamentId }
      : null;
  const previous =
    !isEditing && target && watched.printerId
      ? findCalibrationFor(existing, target, watched.printerId, watched.slicer)
      : undefined;
  // Específica nova de um filamento que já tem genérica: dá para partir dela.
  const groupTarget = filament ? targetForGroupOf(filament) : null;
  const genericBase =
    !previous && !watched.group && groupTarget && watched.printerId
      ? findCalibrationFor(
          existing,
          groupTarget,
          watched.printerId,
          watched.slicer,
        )
      : undefined;
  const copySources = existing.filter((c) => c.id !== calibration?.id);
  const preview = watched.group
    ? {
        name: `Todas as cores · ${watched.group.brandName}`,
        type: watched.group.type,
        colors: filaments
          .filter(
            (f) =>
              f.brandId === watched.group!.brandId &&
              sameFilamentType(f.type, watched.group!.type),
          )
          .slice(0, 3)
          .flatMap((f) => f.colors.slice(0, 1)),
      }
    : filament
      ? { name: filament.colorName, type: filament.type, colors: filament.colors }
      : null;

  const show = (value: string, format: (n: number) => string) => {
    const n = parseDecimal(value);
    return n == null ? "—" : format(n);
  };

  function copyFrom(id: string) {
    const source = existing.find((c) => c.id === id);
    if (!source) return;
    copyValues(source);
  }

  function copyValues(source: CalibrationValues) {
    const values = valuesToForm(source);
    (Object.keys(values) as (keyof typeof values)[]).forEach((key) =>
      form.setValue(key, values[key], { shouldDirty: true }),
    );
  }

  async function handleSubmit(values: CalibrationFormValues) {
    setSubmitError(null);
    try {
      await onSubmit(toInput(values));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    }
  }

  return (
    <div className="-m-4 grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_366px]">
      <Form {...form}>
        <form
          id={FORM_ID}
          className="flex min-w-0 flex-col gap-6 px-7.5 py-6"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div>
            <h1 className="text-[32px] leading-tight font-bold">
              {isEditing ? "Editar calibração" : "Nova calibração"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Corrige a versão atual sem criar outra no histórico."
                : "Os valores que deram o melhor resultado neste filamento, nesta máquina. Em “Todas as cores”, vale para a marca e o material inteiros."}
            </p>
          </div>

          {submitError && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {submitError}
            </p>
          )}

          <section className="flex flex-col gap-3.5">
            <SectionHead label="Vínculo" hint="os três definem a calibração" />
            <FormField
              control={form.control}
              name="filamentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filamento</FormLabel>
                  <FormControl>
                    <FilamentCascadeSelect
                      filaments={filaments}
                      value={field.value}
                      onChange={field.onChange}
                      group={watched.group}
                      onGroupChange={(group) => {
                        form.setValue("group", group, { shouldDirty: true });
                        if (group) form.clearErrors("filamentId");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="printerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impressora</FormLabel>
                    <Select
                      value={field.value || null}
                      onValueChange={(value) => field.onChange(value ?? "")}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string | null) => {
                              const p = printers.find((o) => o.id === value);
                              return p ? (
                                <span className="flex items-center gap-2">
                                  <Printer aria-hidden="true" />
                                  {p.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Escolha a impressora
                                </span>
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {printers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slicer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fatiador</FormLabel>
                    <SlicerSegment
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="calibratedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calibrada em</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={today()}
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <hr className="fade-rule" />

          <section className="flex flex-col gap-3.5">
            <SectionHead
              label="Valores medidos"
              hint="na ordem em que você preenche o fatiador"
            />
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3.5 sm:grid-cols-2">
              {MEASURED_FIELDS.map(
                ({ name, label, tone, placeholder, decimals }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FieldLabel tone={tone}>{label}</FieldLabel>
                        <FormControl>
                          <Input
                            inputMode={decimals ? "decimal" : "numeric"}
                            autoComplete="off"
                            className="tabular-nums"
                            placeholder={placeholder}
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                sanitizeNumber(e.target.value, decimals),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ),
              )}
            </div>
          </section>

          <hr className="fade-rule" />

          <section className="flex flex-col gap-3.5">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FieldLabel tone="notes">Notas</FieldLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      className="min-h-20 resize-none leading-relaxed"
                      placeholder="O que mudou em relação à tentativa anterior, o que ainda ficou ruim…"
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </section>
        </form>
      </Form>

      <aside className="flex min-w-0 flex-col gap-5 border-t bg-[#1a1c29] px-6.5 py-6 lg:border-t-0 lg:border-l">
        <CalLabel>Como vai aparecer na lista</CalLabel>

        <div className="flex flex-col gap-3.25 rounded-md bg-card px-4 py-3.5 shadow-sm">
          <div className="flex items-center gap-2.25 text-[14.5px]">
            {preview ? (
              <>
                <CalSwatch colors={preview.colors} />
                <span className="truncate">{preview.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Filamento</span>
            )}
            <Copy
              className="ml-auto size-3.75 shrink-0 text-foreground/40"
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center gap-2">
            {preview && <Badge variant="outline">{preview.type}</Badge>}
            {watched.group && <Badge variant="secondary">Genérica</Badge>}
            <span className="text-xs text-foreground/55">
              {SLICER_LABELS[watched.slicer]}
              {printer && ` · ${printer.name}`}
            </span>
          </div>
          <hr className="fade-rule" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <PreviewValue
              label="Fluxo"
              value={show(watched.flow, formatFlow)}
            />
            <PreviewValue
              label="Bico / mesa"
              value={`${show(watched.nozzleTemp, formatTemp)} / ${show(watched.bedTemp, formatTemp)}`}
            />
            <PreviewValue
              label="Pressure advance"
              value={show(watched.pressureAdvance, formatPressureAdvance)}
            />
            <PreviewValue
              label="Retração"
              value={show(watched.retractionDistance, formatRetraction)}
            />
          </div>
        </div>

        {previous && (
          <div className="flex flex-col gap-2.75">
            <CalLabel>
              {watched.group
                ? "Genérica atual desta marca e material"
                : "Calibração anterior deste filamento"}
            </CalLabel>
            <PreviousValues calibration={previous} />
            <p className="text-xs leading-normal text-foreground/45">
              Salvar substitui esses valores. A anterior fica no histórico da
              calibração.
            </p>
          </div>
        )}

        {genericBase && (
          <div className="flex flex-col gap-2.75">
            <CalLabel>
              Genérica de {genericBase.group!.type} ·{" "}
              {genericBase.group!.brandName}
            </CalLabel>
            <PreviousValues calibration={genericBase} />
            <p className="text-xs leading-normal text-foreground/45">
              Hoje este filamento usa a genérica. Salvar cria uma calibração
              só dele, que passa a valer no lugar dela.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => copyValues(genericBase)}
            >
              <Copy />
              Partir destes valores
            </Button>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2.25">
          <Select
            value={null}
            onValueChange={(value) => value && copyFrom(value as string)}
          >
            <SelectTrigger className="h-auto w-full bg-transparent px-2.75 py-2.25 hover:border-brand hover:text-brand">
              <span className="flex items-center gap-2.25">
                <Copy className="size-4" aria-hidden="true" />
                Copiar de outra calibração
              </span>
            </SelectTrigger>
            <SelectContent>
              {copySources.map((c) => {
                const subject = calibrationSubject(c);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    <CalSwatch colors={subject.colors} className="size-3" />
                    {subject.name} · {SLICER_LABELS[c.slicer]}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Link
            href="/dashboard/diario/new"
            className="flex items-center gap-2.25 rounded-md border border-border px-2.75 py-2.25 text-[13px] transition-colors hover:border-brand hover:bg-brand/8 hover:text-brand"
          >
            <NotebookPen className="size-4" aria-hidden="true" />
            Abrir entrada no diário
          </Link>
        </div>
      </aside>
    </div>
  );
}
