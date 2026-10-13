"use client";

import Link from "next/link";
import { Check, Printer as PrinterIcon } from "lucide-react";
import { ReactNode, useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  CURRENCY_LABELS,
  CostSettings,
  Currency,
  getCostSettings,
  getPrinterCostPerHour,
  hasOwnTariff,
  updateCostSettings,
} from "@/lib/api/cost-settings";
import { listPrintItems } from "@/lib/api/print";
import { Printer, listPrinters } from "@/lib/api/printer";
import { cn, formatBRL } from "@/lib/utils";

type NumericKey = Exclude<keyof CostSettings, "currency">;

type FormValues = Record<NumericKey, string> & { currency: Currency };

type FieldSpec = {
  key: NumericKey;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals: number;
  placeholder?: string;
};

const LABOR_FIELDS: FieldSpec[] = [
  {
    key: "laborCostPerHour",
    label: "Sua hora de trabalho",
    prefix: "R$",
    suffix: "/ h",
    decimals: 2,
  },
  {
    key: "prepMinutesPerPiece",
    label: "Tempo de preparo por peça",
    suffix: "min",
    decimals: 0,
  },
  {
    key: "defaultMarginPercent",
    label: "Margem padrão",
    suffix: "%",
    decimals: 0,
  },
];

const FIXED_COST_FIELDS: FieldSpec[] = [
  { key: "packagingCost", label: "Embalagem", prefix: "R$", decimals: 2 },
  {
    key: "failureReservePercent",
    label: "Reserva para falhas",
    suffix: "%",
    decimals: 0,
  },
  {
    key: "otherFixedCost",
    label: "Outros",
    prefix: "R$",
    decimals: 2,
    placeholder: "0,00",
  },
];

const TARIFF_FIELD: FieldSpec = {
  key: "energyCostPerKwh",
  label: "Tarifa de energia",
  prefix: "R$",
  suffix: "/ kWh",
  decimals: 2,
};

const ALL_FIELDS: FieldSpec[] = [
  TARIFF_FIELD,
  ...LABOR_FIELDS,
  ...FIXED_COST_FIELDS,
];

function formatInput(value: number, decimals: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 2),
    useGrouping: false,
  });
}

/** Aceita "0,92" e "0.92"; vazio vira 0. Retorna null se não for número. */
function parseInput(text: string) {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return 0;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function toFormValues(settings: CostSettings): FormValues {
  const values = { currency: settings.currency } as FormValues;
  for (const field of ALL_FIELDS) {
    const value = settings[field.key];
    // Campo opcional zerado fica vazio, mostrando só o placeholder.
    values[field.key] =
      field.placeholder && value === 0 ? "" : formatInput(value, field.decimals);
  }
  return values;
}

function SectionHeading({
  title,
  caption,
}: {
  title: string;
  caption: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <span className="text-[11.5px] text-muted-foreground/70">{caption}</span>
    </div>
  );
}

function AffixInput({
  id,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {prefix && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12.5px] text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "tabular-nums",
          prefix && "pl-9",
          suffix && (suffix.length > 2 ? "pr-14" : "pr-10"),
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SettingField({
  spec,
  value,
  invalid,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{spec.label}</Label>
      <AffixInput
        id={id}
        value={value}
        onChange={onChange}
        prefix={spec.prefix}
        suffix={spec.suffix}
        placeholder={spec.placeholder}
        invalid={invalid}
      />
    </div>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeading title={title} caption={caption} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">{children}</div>
    </div>
  );
}

const PRINTER_GRID =
  "grid grid-cols-[1fr_90px_130px_100px_100px] items-center gap-3.5";

export default function CostsAndEnergyPage() {
  const [settings, setSettings] = useState<CostSettings | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  // Por impressora: null = herda a global; texto = tarifa própria.
  const [overrides, setOverrides] = useState<Record<string, string | null>>(
    {},
  );
  const [initialOverrides, setInitialOverrides] = useState<
    Record<string, string | null>
  >({});
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getCostSettings(), listPrinters()])
      .then(([loadedSettings, loadedPrinters]) => {
        if (ignore) return;
        applyLoaded(loadedSettings, loadedPrinters);
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar as configurações de custo.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    listPrintItems()
      .then((items) => {
        if (ignore) return;
        setRecordCount(
          items.reduce((sum, item) => sum + item.records.length, 0),
        );
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  function applyLoaded(loadedSettings: CostSettings, loadedPrinters: Printer[]) {
    const nextOverrides: Record<string, string | null> = {};
    for (const printer of loadedPrinters) {
      nextOverrides[printer.id] = hasOwnTariff(printer, loadedSettings)
        ? formatInput(printer.energyCostPerKwh!, 2)
        : null;
    }
    setSettings(loadedSettings);
    setValues(toFormValues(loadedSettings));
    setPrinters(loadedPrinters);
    setOverrides(nextOverrides);
    setInitialOverrides(nextOverrides);
  }

  const parsed = values
    ? Object.fromEntries(
        ALL_FIELDS.map((field) => [field.key, parseInput(values[field.key])]),
      )
    : {};
  const invalidKeys = new Set(
    ALL_FIELDS.filter((field) => parsed[field.key] == null).map((f) => f.key),
  );
  const invalidOverrides = new Set(
    Object.entries(overrides)
      .filter(([, text]) => text != null && parseInput(text) == null)
      .map(([id]) => id),
  );
  const hasErrors = invalidKeys.size > 0 || invalidOverrides.size > 0;

  const globalTariff =
    (parsed.energyCostPerKwh as number | null) ??
    settings?.energyCostPerKwh ??
    0;

  const isDirty =
    !!settings &&
    !!values &&
    (JSON.stringify(values) !== JSON.stringify(toFormValues(settings)) ||
      JSON.stringify(overrides) !== JSON.stringify(initialOverrides));

  function setValue(key: keyof FormValues, value: string) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
  }

  function toggleOverride(printer: Printer) {
    setOverrides((prev) => ({
      ...prev,
      [printer.id]:
        prev[printer.id] == null ? formatInput(globalTariff, 2) : null,
    }));
    setSavedAt(null);
  }

  async function handleSave() {
    if (!values || hasErrors) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const nextSettings = { currency: values.currency } as CostSettings;
      for (const field of ALL_FIELDS) {
        nextSettings[field.key] = parsed[field.key] as number;
      }
      // O servidor grava a tarifa em cada impressora: as listadas aqui
      // ficam com a própria, as demais passam a herdar a global.
      const printerTariffs = printers.flatMap((printer) => {
        const override = overrides[printer.id];
        return override == null
          ? []
          : [
              {
                printerId: printer.id,
                energyCostPerKwh: parseInput(override) as number,
              },
            ];
      });
      const saved = await updateCostSettings({
        ...nextSettings,
        printerTariffs,
      });
      const nextPrinters = await listPrinters();
      applyLoaded(saved, nextPrinters);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Não foi possível salvar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  usePageHeaderAction(
    <div className="flex items-center gap-3">
      {recordCount != null && recordCount > 0 && (
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
          Afeta {recordCount}{" "}
          {recordCount === 1
            ? "impressão já registrada"
            : "impressões já registradas"}
        </span>
      )}
      <Button
        size="sm"
        onClick={handleSave}
        disabled={!isDirty || hasErrors || isSaving || isLoading}
      >
        <Check />
        {isSaving ? "Salvando..." : savedAt && !isDirty ? "Salvo" : "Salvar"}
      </Button>
    </div>,
  );

  function renderPrinters() {
    if (printers.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <PrinterIcon className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma impressora cadastrada ainda.</p>
          <Link
            href="/dashboard/printers/new"
            className="text-[12.5px] text-brand-300 hover:underline"
          >
            Cadastrar impressora
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col overflow-x-auto">
        <div
          className={cn(
            PRINTER_GRID,
            "min-w-[620px] border-b py-2 text-xs uppercase text-muted-foreground",
          )}
        >
          <span>Impressora</span>
          <span className="text-right">Consumo</span>
          <span className="text-right">Tarifa</span>
          <span className="text-right">Manutenção</span>
          <span className="text-right">Custo / h</span>
        </div>
        {printers.map((printer) => {
          const override = overrides[printer.id];
          const isOwn = override != null;
          const tariff = isOwn
            ? (parseInput(override) ?? globalTariff)
            : globalTariff;
          return (
            <div
              key={printer.id}
              className={cn(PRINTER_GRID, "min-w-[620px] border-b py-2.5")}
            >
              <span className="flex min-w-0 items-center gap-2.5 text-[13.5px]">
                <PrinterIcon
                  className={cn(
                    "size-4 shrink-0",
                    isOwn ? "text-muted-foreground" : "text-brand",
                  )}
                  aria-hidden="true"
                />
                <Link
                  href={`/dashboard/printers/${printer.id}`}
                  className="truncate hover:underline"
                >
                  {printer.name}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleOverride(printer)}
                  title={
                    isOwn
                      ? "Voltar a usar a tarifa global"
                      : "Usar uma tarifa própria nesta máquina"
                  }
                  className="cursor-pointer rounded-sm focus-visible:ring-3 focus-visible:ring-brand/50 focus-visible:outline-none"
                >
                  <Badge variant={isOwn ? "default" : "outline"}>
                    {isOwn ? "tarifa própria" : "herda"}
                  </Badge>
                </button>
              </span>
              <span className="text-right text-[13px] tabular-nums">
                {printer.powerConsumptionW != null
                  ? `${printer.powerConsumptionW} W`
                  : "—"}
              </span>
              <span className="flex justify-end text-right text-[13px] tabular-nums">
                {isOwn ? (
                  <AffixInput
                    value={override}
                    onChange={(text) => {
                      setOverrides((prev) => ({ ...prev, [printer.id]: text }));
                      setSavedAt(null);
                    }}
                    prefix="R$"
                    invalid={invalidOverrides.has(printer.id)}
                    aria-label={`Tarifa própria de ${printer.name}, em R$ por kWh`}
                    className="w-28 [&_input]:h-8 [&_input]:text-right [&_input]:text-brand-200"
                  />
                ) : (
                  <span className="text-muted-foreground">
                    {formatBRL(globalTariff)}
                  </span>
                )}
              </span>
              <span className="text-right text-[13px] tabular-nums">
                {printer.maintenanceCostPerHour != null
                  ? formatBRL(printer.maintenanceCostPerHour)
                  : "—"}
              </span>
              <span className="text-right text-[13.5px] tabular-nums">
                {printer.powerConsumptionW != null ||
                printer.maintenanceCostPerHour != null
                  ? formatBRL(getPrinterCostPerHour(printer, tariff))
                  : "—"}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-3 gap-3.5">
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-14 w-full" />
              ))}
            </div>
          ))}
        </div>
      );
    }

    if (loadError || !values) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Não foi possível carregar as configurações de custo."}
        </p>
      );
    }

    const field = (spec: FieldSpec) => (
      <SettingField
        key={spec.key}
        spec={spec}
        value={values[spec.key]}
        invalid={invalidKeys.has(spec.key)}
        onChange={(value) => setValue(spec.key, value)}
      />
    );

    return (
      <>
        <Section title="Energia" caption="da sua conta de luz">
          {field(TARIFF_FIELD)}
          <div className="flex flex-col gap-2">
            <Label>Moeda</Label>
            <Select
              value={values.currency}
              onValueChange={(value) => setValue("currency", value as Currency)}
            >
              <SelectTrigger aria-label="Moeda">
                <SelectValue>
                  {(value: Currency) => CURRENCY_LABELS[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CURRENCY_LABELS) as Currency[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CURRENCY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Separator />

        <Section
          title="Seu trabalho e a margem"
          caption="entram no preço sugerido, não no custo"
        >
          {LABOR_FIELDS.map(field)}
        </Section>

        <Separator />

        <Section title="Custo fixo por peça" caption="somado a toda impressão">
          {FIXED_COST_FIELDS.map(field)}
        </Section>

        <Separator />

        <div className="flex min-w-0 flex-col gap-3">
          <SectionHeading
            title="Por impressora"
            caption="sobrescreva só quando a máquina tem tarifa própria"
          />
          {renderPrinters()}
          <p className="max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
            Consumo e manutenção continuam na ficha de cada impressora — são
            características da máquina. Aqui você só decide se ela usa a tarifa
            global.
          </p>
        </div>

        {(hasErrors || saveError) && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {saveError ?? "Revise os campos destacados: use apenas números."}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-4xl font-bold">Custos e energia</h1>
        <p className="max-w-[62ch] text-sm text-muted-foreground">
          Os valores que todas as peças usam para virar preço. Cada impressora
          herda daqui.
        </p>
      </div>

      {renderContent()}
    </div>
  );
}
