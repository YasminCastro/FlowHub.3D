"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FileSliders, ImagePlus, Printer as PrinterIcon } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  DEFAULT_COST_SETTINGS,
  getCostSettings,
  hasOwnTariff,
} from "@/lib/api/cost-settings";
import { Printer, PrinterInput } from "@/lib/api/printer";
import { cn, formatBRL } from "@/lib/utils";

const FORM_ID = "printer-form";

// Valor inicial até carregar a tarifa global de "Custos e energia".
const DEFAULT_TARIFF_PER_KWH = DEFAULT_COST_SETTINGS.energyCostPerKwh;

const BRAND_SUGGESTIONS = [
  "Bambu Lab",
  "Creality",
  "Prusa Research",
  "Anycubic",
  "Elegoo",
  "Voron Design",
  "Artillery",
  "Qidi Tech",
  "Flashforge",
];

const NOZZLE_OPTIONS = ["0,2 mm", "0,4 mm", "0,6 mm", "0,8 mm", "1,0 mm"];

const MATERIAL_OPTIONS = ["PLA", "PETG", "ABS", "TPU"];

const printerFormSchema = z.object({
  name: z.string().min(1, "Informe o nome da impressora."),
  brand: z.string().min(1, "Informe o fabricante."),
  nozzle: z.string(),
  extrusionType: z.enum(["Direct drive", "Bowden"]),
  filamentsTypes: z.array(z.string()),
  powerConsumptionW: z.string(),
  energyCostPerKwh: z.string(),
  maintenanceCostPerHour: z.string(),
  lifespanHours: z.string(),
  purchasePrice: z.string(),
  purchaseDate: z.string(),
  lastMaintenanceDate: z.string(),
  notes: z.string(),
});

type PrinterFormValues = z.infer<typeof printerFormSchema>;

function toNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

function parseNum(value: string) {
  const n = Number(value);
  return value.trim() === "" || Number.isNaN(n) ? 0 : n;
}

function toDefaultValues(printer?: Printer | null): PrinterFormValues {
  return {
    name: printer?.name ?? "",
    brand: printer?.brand ?? "",
    nozzle: printer?.nozzle ?? "0,4 mm",
    extrusionType:
      printer?.extrusionType === "Bowden" ? "Bowden" : "Direct drive",
    filamentsTypes: printer?.filamentsTypes.length
      ? printer.filamentsTypes
      : ["PLA"],
    powerConsumptionW: printer?.powerConsumptionW?.toString() ?? "",
    energyCostPerKwh:
      printer?.energyCostPerKwh?.toString() ??
      DEFAULT_TARIFF_PER_KWH.toString(),
    maintenanceCostPerHour: printer?.maintenanceCostPerHour?.toString() ?? "",
    lifespanHours: "10000",
    purchasePrice: printer?.purchasePrice?.toString() ?? "",
    purchaseDate: printer?.purchaseDate?.slice(0, 10) ?? "",
    lastMaintenanceDate: printer?.lastMaintenanceDate?.slice(0, 10) ?? "",
    notes: printer?.notes ?? "",
  };
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-sm transition-colors",
            value === option
              ? "bg-brand/15 text-brand"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export type PrinterFormProps = {
  /** Impressora sendo editada. Omitido/nulo = formulário de criação. */
  printer?: Printer | null;
  breadcrumb: ReactNode;
  cancelHref: string;
  onSubmit: (input: PrinterInput) => Promise<void>;
};

export function PrinterForm({
  printer,
  breadcrumb,
  cancelHref,
  onSubmit,
}: PrinterFormProps) {
  const router = useRouter();
  const isEditing = !!printer;
  const [customTariff, setCustomTariff] = useState(
    printer?.energyCostPerKwh != null &&
      printer.energyCostPerKwh !== DEFAULT_TARIFF_PER_KWH,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Só true se o valor inicial de maintenanceCostPerHour era nulo (impressora
  // nova, ou uma existente que ainda não teve manutenção informada). Assim
  // que o usuário edita o campo à mão, ele deixa de ser recalculado.
  const [isMaintenanceAuto, setIsMaintenanceAuto] = useState(
    printer?.maintenanceCostPerHour == null,
  );

  const form = useForm<PrinterFormValues>({
    resolver: zodResolver(printerFormSchema),
    defaultValues: toDefaultValues(printer),
  });

  // Sem tarifa própria, a impressora acompanha a tarifa global.
  useEffect(() => {
    let ignore = false;
    getCostSettings().then((settings) => {
      if (ignore) return;
      const isOwn = !!printer && hasOwnTariff(printer, settings);
      setCustomTariff(isOwn);
      if (!isOwn) {
        form.setValue("energyCostPerKwh", settings.energyCostPerKwh.toString());
      }
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printer]);

  const watchedPurchasePrice = form.watch("purchasePrice");
  const watchedLifespanHours = form.watch("lifespanHours");

  useEffect(() => {
    if (!isMaintenanceAuto) return;

    const lifespan = Number(watchedLifespanHours);
    if (!watchedLifespanHours || Number.isNaN(lifespan) || lifespan <= 0) {
      return;
    }

    const price = parseNum(watchedPurchasePrice);
    const computed = Math.round((price / lifespan) * 100) / 100;
    form.setValue("maintenanceCostPerHour", computed.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPurchasePrice, watchedLifespanHours, isMaintenanceAuto]);

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
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? "Salvando..."
          : isEditing
            ? "Salvar alterações"
            : "Salvar impressora"}
      </Button>
    </div>,
  );

  async function handleSubmit(values: PrinterFormValues) {
    setSubmitError(null);
    const input: PrinterInput = {
      name: values.name,
      brand: values.brand,
      nozzle: values.nozzle || undefined,
      extrusionType: values.extrusionType,
      filamentsTypes: values.filamentsTypes,
      powerConsumptionW: toNumber(values.powerConsumptionW),
      energyCostPerKwh: toNumber(values.energyCostPerKwh),
      maintenanceCostPerHour: toNumber(values.maintenanceCostPerHour),
      purchasePrice: toNumber(values.purchasePrice),
      purchaseDate: values.purchaseDate || undefined,
      lastMaintenanceDate: values.lastMaintenanceDate || undefined,
      notes: values.notes || undefined,
    };

    try {
      await onSubmit(input);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a impressora.",
      );
    }
  }

  const name = form.watch("name");
  const brand = form.watch("brand");
  const nozzle = form.watch("nozzle");
  const power = parseNum(form.watch("powerConsumptionW"));
  const tariff = parseNum(form.watch("energyCostPerKwh"));
  const maintenance = parseNum(form.watch("maintenanceCostPerHour"));

  const energyPerHour = (power / 1000) * tariff;
  const totalPerHour = energyPerHour + maintenance;

  return (
    <div className="flex flex-col gap-6 p-8 lg:flex-row">
      <Form {...form}>
        <form
          id={FORM_ID}
          className="flex min-w-0 flex-1 flex-col gap-6"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div>
            <h1 className="text-4xl font-bold">
              {isEditing ? "Editar impressora" : "Nova impressora"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Atualize os dados dessa máquina."
                : "Depois de salvar ela vira uma opção ao registrar impressões."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Bambu Lab A1"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabricante</FormLabel>
                  <FormControl>
                    <Input
                      list="brand-suggestions"
                      placeholder="Ex: Bambu Lab"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <datalist id="brand-suggestions">
            {BRAND_SUGGESTIONS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>

          <div className="grid grid-cols-3 items-start gap-4">
            <FormField
              control={form.control}
              name="nozzle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bico</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NOZZLE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
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
              name="extrusionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de extrusão</FormLabel>
                  <FormControl>
                    <SegmentedControl
                      options={["Direct drive", "Bowden"] as const}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="filamentsTypes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  Materiais que ela imprime
                </FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2">
                    {MATERIAL_OPTIONS.map((material) => {
                      const selected = field.value.includes(material);
                      return (
                        <button
                          key={material}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            field.onChange(
                              selected
                                ? field.value.filter(
                                    (m: string) => m !== material,
                                  )
                                : [...field.value, material],
                            )
                          }
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {material}
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          <div className="flex flex-col gap-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Consumo{" "}
              <span className="normal-case text-muted-foreground/70">
                — entra no custo de cada impressão feita nesta máquina
              </span>
            </span>
            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="powerConsumptionW"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potência em impressão</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          placeholder="120"
                          {...field}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          W
                        </span>
                      </div>
                    </FormControl>
                    <div className="min-h-4.5">
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="energyCostPerKwh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa de energia</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        disabled={!customTariff}
                        {...field}
                      />
                    </FormControl>
                    <div className="min-h-4.5">
                      {customTariff ? (
                        <FormMessage />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCustomTariff(true)}
                          className="w-fit text-[12.5px] text-brand-300 hover:underline"
                        >
                          Usar outra tarifa nesta máquina
                        </button>
                      )}
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lifespanHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vida útil</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          placeholder="10000"
                          {...field}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          h
                        </span>
                      </div>
                    </FormControl>
                    <div className="min-h-4.5">
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maintenanceCostPerHour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manutenção</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,25"
                          {...field}
                          onChange={(e) => {
                            setIsMaintenanceAuto(false);
                            field.onChange(e);
                          }}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$/h
                        </span>
                      </div>
                    </FormControl>
                    <div className="min-h-4.5">
                      {isMaintenanceAuto ? (
                        <p className="text-[12.5px] text-muted-foreground">
                          Calculado como preço ÷ vida útil.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsMaintenanceAuto(true)}
                          className="w-fit text-[12.5px] text-brand-300 hover:underline"
                        >
                          Voltar a calcular automaticamente
                        </button>
                      )}
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço pago</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="2500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Data da compra{" "}
                    <span className="text-muted-foreground">opcional</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastMaintenanceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Última manutenção</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Observações{" "}
                  <span className="text-muted-foreground">opcional</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Bicos extras, mods, o que costuma dar problema..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {submitError && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {submitError}
            </p>
          )}
        </form>
      </Form>

      <div className="flex w-full flex-col gap-6 lg:w-80 lg:flex-none lg:border-l lg:pl-6">
        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Custo por hora calculado
          </span>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Energia por hora</span>
              <span className="font-medium">{formatBRL(energyPerHour)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Manutenção por hora</span>
              <span className="font-medium">{formatBRL(maintenance)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Total por hora</span>
              <span className="font-medium text-brand">
                {formatBRL(totalPerHour)}
              </span>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Peça de 4 h</span>
              <span className="font-medium">{formatBRL(totalPerHour * 4)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Peça de 12 h</span>
              <span className="font-medium">
                {formatBRL(totalPerHour * 12)}
              </span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {power || 0} W × {formatBRL(tariff)} / kWh, mais a manutenção por
            hora.
          </p>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Como vai aparecer
          </span>
          <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <PrinterIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-heading text-sm font-medium">
                  {name || "Nome da impressora"}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {brand || "Fabricante"}
                {nozzle ? ` · bico ${nozzle}` : ""}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{power || 0} W</span>
                <span>{formatBRL(totalPerHour)} / h</span>
                <span>0 h impressas</span>
              </div>
            </div>
          </div>
        </section>

        {!isEditing && (
          <>
            <Separator />
            <section className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Depois de salvar
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground/60">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  Registrar uma impressão nela
                </div>
                <div className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground/60">
                  <FileSliders className="size-4" aria-hidden="true" />
                  Criar perfil de fatiador
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
