"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Coins,
  Gauge,
  Layers,
  Plus,
  Scale,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Bar, BarChart, Brush, Cell, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FAILURE_COLOR,
  PhotoPlaceholder,
  SectionLabel,
  StatDivider,
} from "@/components/prints/print-bits";
import { useAuth } from "@/contexts/auth-context";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { useCostContext } from "@/hooks/use-cost-context";
import { ApiError } from "@/lib/api/auth";
import {
  Filament,
  filamentSwatchBackground,
  listFilaments,
} from "@/lib/api/filament";
import {
  CostContext,
  PrintItem,
  PrintRecord,
  computeCost,
  formatDecimal,
  formatDuration,
  formatGrams,
  getDefaultRecord,
  getItemStats,
  getPerUnit,
  getRecordGrams,
  listPrintItems,
} from "@/lib/api/print";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

type Range = "7d" | "30d" | "year" | "all";

// days null: todo o tempo, sem período anterior para comparar.
const RANGES: {
  value: Range;
  label: string;
  days: number | null;
  prev: string;
}[] = [
  { value: "7d", label: "7 dias", days: 7, prev: "semana anterior" },
  { value: "30d", label: "30 dias", days: 30, prev: "mês anterior" },
  { value: "year", label: "Ano", days: 365, prev: "ano anterior" },
  { value: "all", label: "Todo tempo", days: null, prev: "" },
];

const DAY_MS = 86_400_000;
const RECENT_ITEMS = 4;
const ALERT_LIMIT = 5;

// Esgotado (acabou ou fora de linha) vem antes de acabando.
const WARNING_COLOR = "#d9b45e";

const SHORTCUTS = [
  { label: "Novo filamento", href: "/dashboard/filamentos/new", icon: Layers },
  { label: "Nova calibração", href: "/dashboard/calibracoes/new", icon: Gauge },
  { label: "Nova entrada", href: "/dashboard/diario/new", icon: BookOpen },
];

type Totals = {
  records: number;
  grams: number;
  minutes: number;
  cost: number;
  lost: number;
};

function sumRecords(records: PrintRecord[], costs: CostContext): Totals {
  return records.reduce<Totals>(
    (acc, record) => {
      const cost = computeCost(record, costs).total;
      const failed = record.outcome === "FAILURE";
      return {
        records: acc.records + 1,
        grams: acc.grams + getRecordGrams(record),
        minutes: acc.minutes + record.totalMinutes,
        cost: acc.cost + cost,
        lost: acc.lost + (failed ? cost : 0),
      };
    },
    { records: 0, grams: 0, minutes: 0, cost: 0, lost: 0 },
  );
}

function inWindow(iso: string, from: number, to: number) {
  const time = new Date(iso).getTime();
  return time >= from && time < to;
}

function formatDelta(delta: number, prevLabel: string) {
  if (delta === 0) return `igual ao ${prevLabel}`;
  return `${delta > 0 ? "+" : ""}${delta} vs. ${prevLabel}`;
}

type ChartBucket = {
  key: string;
  label: string;
  tooltip: string;
  start: number;
  grams: number;
};

// Com mais anos que isso, "Todo tempo" ganha a linha do tempo embaixo.
const MAX_VISIBLE_YEARS = 8;

const CHART_TITLES: Record<Range, string> = {
  "7d": "Gramas por dia",
  "30d": "Gramas por dia",
  year: "Gramas por mês",
  all: "Gramas por ano",
};

function bucket(start: Date, label: string, tooltip: string): ChartBucket {
  return {
    key: start.toISOString(),
    label,
    tooltip,
    start: start.getTime(),
    grams: 0,
  };
}

// As barras seguem o período: dias em 7 e 30 dias, meses no ano e anos em
// todo o tempo. A última barra é sempre a de agora.
function chartBuckets(range: Range, now: Date, firstPrintedAt: string) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(y, m, d - (days - 1 - i));
      const label =
        range === "7d"
          ? day.toLocaleDateString("pt-BR", { weekday: "short" })
          : day.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            });
      return bucket(
        day,
        label.replace(".", ""),
        day.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
    });
  }

  if (range === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const month = new Date(y, m - (11 - i), 1);
      return bucket(
        month,
        month.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      );
    });
  }

  const firstYear = Math.min(new Date(firstPrintedAt).getFullYear(), y);
  return Array.from({ length: y - firstYear + 1 }, (_, i) => {
    const year = firstYear + i;
    return bucket(new Date(year, 0, 1), String(year), String(year));
  });
}

function chartData(
  records: PrintRecord[],
  range: Range,
  now: Date,
  firstPrintedAt: string,
) {
  const buckets = chartBuckets(range, now, firstPrintedAt);
  for (const record of records) {
    const time = new Date(record.printedAt).getTime();
    if (time < buckets[0].start || time > now.getTime()) continue;
    const index = buckets.findLastIndex((b) => b.start <= time);
    buckets[index].grams += getRecordGrams(record);
  }
  return buckets;
}

function getAlerts(filaments: Filament[]) {
  return filaments
    .flatMap((filament) => {
      if (filament.spoolLevel === "FINISHED") {
        return [{ filament, label: "acabou", color: FAILURE_COLOR, rank: 0 }];
      }
      if (filament.availability === "SOLD_OUT") {
        return [{ filament, label: "esgotado", color: FAILURE_COLOR, rank: 1 }];
      }
      if (filament.spoolLevel === "LOW") {
        return [{ filament, label: "acabando", color: WARNING_COLOR, rank: 2 }];
      }
      return [];
    })
    .sort((a, b) => a.rank - b.rank);
}

function BigStat({
  label,
  value,
  unit,
  hint,
  hintAccent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  hintAccent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <span className="font-heading text-[44px] leading-none font-medium tracking-[-0.02em] tabular-nums">
        {value}
        {unit && <span className="text-xl opacity-50">{unit}</span>}
      </span>
      <span
        className={cn(
          "text-[11px]",
          hintAccent ? "text-brand-300" : "text-muted-foreground",
        )}
      >
        {hint}
      </span>
    </div>
  );
}

function RecentPrintCard({
  item,
  costs,
}: {
  item: PrintItem;
  costs: CostContext;
}) {
  const perUnit = getPerUnit(getDefaultRecord(item), costs);
  const color = getItemStats(item).colors[0];
  const cover = item.records.find((r) => r.photos.length)?.photos[0]?.src;

  return (
    <Link
      href={`/dashboard/impressoes/${item.id}`}
      className="flex flex-col overflow-hidden rounded-md bg-card shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.75 hover:shadow-[0_0_0_1px_var(--color-brand-700),0_10px_26px_rgba(0,0,0,0.5)] focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="h-23">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover" />
        ) : (
          <PhotoPlaceholder className="size-full" />
        )}
      </div>
      <div className="flex flex-col gap-1.75 px-2.75 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {color && <FilamentDot colors={color} className="rounded-[2px]" />}
          <span className="truncate font-heading text-[13.5px] leading-tight font-medium">
            {item.name}
          </span>
          {item.category && (
            <span className="ml-auto shrink-0 rounded-full bg-secondary px-1.75 py-0.5 text-[9.5px] text-muted-foreground">
              {item.category.name}
            </span>
          )}
        </div>
        <div className="flex gap-2.5 text-[11px] text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1.25">
            <Clock className="size-3 opacity-70" aria-hidden="true" />
            {formatDuration(perUnit.minutes)}
          </span>
          <span className="inline-flex items-center gap-1.25">
            <Scale className="size-3 opacity-70" aria-hidden="true" />
            {formatGrams(perUnit.grams)}
          </span>
          <span className="inline-flex items-center gap-1.25 text-brand-300">
            <Coins className="size-3 opacity-70" aria-hidden="true" />
            {formatBRL(perUnit.cost)}
          </span>
        </div>
      </div>
    </Link>
  );
}

const chartConfig = {
  grams: { label: "Filamento", color: "var(--brand-700)" },
} satisfies ChartConfig;

function GramsChart({
  records,
  range,
  now,
  firstPrintedAt,
}: {
  records: PrintRecord[];
  range: Range;
  now: Date;
  firstPrintedAt: string;
}) {
  const data = chartData(records, range, now, firstPrintedAt);
  const isEmpty = data.every((b) => b.grams === 0);
  const showTimeline = range === "all" && data.length > MAX_VISIBLE_YEARS;
  const subtitle =
    range === "all"
      ? `desde ${data[0].label}`
      : range === "year"
        ? "últimos 12 meses"
        : `últimos ${data.length} dias`;

  return (
    <div className="flex flex-col gap-2.25">
      <div className="flex items-baseline gap-2.5">
        <SectionLabel>{CHART_TITLES[range]}</SectionLabel>
        <span className="ml-auto text-[11px] text-muted-foreground/80">
          {subtitle}
        </span>
      </div>
      {isEmpty ? (
        <p className="py-6 text-[12.5px] text-muted-foreground">
          Nenhuma impressão no período.
        </p>
      ) : (
        <ChartContainer
          config={chartConfig}
          className={cn("aspect-auto w-full", showTimeline ? "h-44" : "h-36")}
        >
          <BarChart
            data={data}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={8}
              fontSize={10}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="bg-popover"
                  labelFormatter={(_, payload) => payload[0]?.payload.tooltip}
                  formatter={(value) => (
                    <div className="flex w-full items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-[2px] bg-brand" />
                      <span className="text-muted-foreground">Filamento</span>
                      <span className="ml-auto font-medium text-foreground tabular-nums">
                        {formatGrams(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="grams" radius={2}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.key}
                  fill={
                    index === data.length - 1
                      ? "var(--brand)"
                      : "var(--color-grams)"
                  }
                />
              ))}
            </Bar>
            {showTimeline && (
              <Brush
                dataKey="label"
                height={18}
                travellerWidth={8}
                startIndex={data.length - MAX_VISIBLE_YEARS}
                stroke="var(--brand-700)"
                fill="transparent"
              />
            )}
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

// Primeiro acesso: a ordem dos cadastros, porque impressão depende de
// rolo e de máquina.
function FirstSteps({
  name,
  hasTariff,
  hasPrinter,
  hasFilament,
}: {
  name: string | null;
  hasTariff: boolean;
  hasPrinter: boolean;
  hasFilament: boolean;
}) {
  const steps = [
    {
      done: hasTariff,
      title: "Sua tarifa de energia",
      text: "O preço do kWh que vira custo de energia de cada peça.",
      doneText: "Dá para mudar em Custos e energia.",
      href: "/dashboard/custos-energia",
      cta: "Definir tarifa",
    },
    {
      done: hasPrinter,
      title: "Cadastre sua impressora",
      text: "Nome, bico e o consumo em watts. É o que transforma horas de impressão em custo.",
      doneText: "Impressora cadastrada.",
      href: "/dashboard/printers/new",
      cta: "Nova impressora",
    },
    {
      done: hasFilament,
      title: "Cadastre o primeiro rolo",
      text: "Marca, cor, peso e o que você pagou. O custo por grama sai daí.",
      doneText: "Rolo cadastrado.",
      href: "/dashboard/filamentos/new",
      cta: "Novo filamento",
    },
    {
      done: false,
      title: "Registre uma impressão",
      text: "Com rolo e máquina cadastrados, o custo da peça aparece pronto.",
      doneText: "",
      href: "/dashboard/impressoes/new",
      cta: "Nova impressão",
    },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <div className="flex max-w-190 flex-col gap-8 px-1.5 pt-1 pb-6">
      <div>
        <h1 className="mb-1.5 text-[34px] font-bold">
          {name ? `Bem-vinda, ${name}` : "Bem-vinda"}
        </h1>
        <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Três cadastros e o app já calcula o custo das suas peças. Dá para
          fazer agora ou conforme for imprimindo.
        </p>
      </div>

      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const isNext = index === nextIndex;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.title} className="flex gap-4">
              <div className="flex w-6.5 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "grid size-6.5 place-items-center rounded-full font-heading text-xs font-medium tabular-nums",
                    step.done
                      ? "bg-brand text-background"
                      : isNext
                        ? "text-brand shadow-[inset_0_0_0_1px_var(--color-brand)]"
                        : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--color-neutral-700)]",
                  )}
                >
                  {step.done ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                {!isLast && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-6")}>
                <div className="flex items-baseline gap-2.25">
                  <span
                    className={cn(
                      "font-heading text-[17px] leading-snug font-medium",
                      !step.done && !isNext && "text-foreground/75",
                    )}
                  >
                    {step.title}
                  </span>
                  {step.done && (
                    <span className="rounded-full bg-brand/14 px-2 py-0.5 text-[10.5px] text-brand">
                      feito
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-1 max-w-[50ch] text-[12.5px] leading-relaxed",
                    isNext ? "text-muted-foreground" : "text-foreground/45",
                  )}
                >
                  {step.done ? step.doneText : step.text}
                </p>
                {isNext && (
                  <Button
                    className="mt-3 h-9"
                    render={<Link href={step.href} />}
                    nativeButton={false}
                  >
                    <Plus />
                    {step.cta}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { costs, loadError: costsError } = useCostContext();
  const [items, setItems] = useState<PrintItem[] | null>(null);
  const [filaments, setFilaments] = useState<Filament[] | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    let ignore = false;
    Promise.all([listPrintItems(), listFilaments()])
      .then(([printItems, filamentList]) => {
        if (ignore) return;
        setItems(printItems);
        setFilaments(filamentList);
      })
      .catch((err) => {
        if (ignore) return;
        setDataError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o painel.",
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <>
      {SHORTCUTS.map(({ label, href, icon: Icon }) => (
        <Button
          key={href}
          variant="secondary"
          size="sm"
          render={<Link href={href} />}
          nativeButton={false}
        >
          <Icon />
          {label}
        </Button>
      ))}
      <Button
        size="sm"
        render={<Link href="/dashboard/impressoes/new" />}
        nativeButton={false}
      >
        <Plus />
        Nova impressão
      </Button>
    </>,
  );

  const loadError = dataError ?? costsError;

  if (loadError) {
    return (
      <p role="alert" className="p-8 text-[12.5px] text-destructive">
        {loadError}
      </p>
    );
  }

  if (!costs || !items || !filaments) {
    return (
      <div className="flex flex-col gap-6 px-6.5 pt-1 pb-6.5">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-6 lg:grid-cols-[1.62fr_1fr]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? null;

  if (items.length === 0) {
    return (
      <FirstSteps
        name={firstName}
        hasTariff={costs.settings.energyCostPerKwh > 0}
        hasPrinter={costs.printers.length > 0}
        hasFilament={filaments.length > 0}
      />
    );
  }

  const now = new Date();
  const rangeInfo = RANGES.find((r) => r.value === range)!;
  const records = items.flatMap((item) => item.records);
  const firstPrintedAt = records.reduce(
    (min, r) => (r.printedAt < min ? r.printedAt : min),
    now.toISOString(),
  );

  const end = now.getTime();
  const days =
    rangeInfo.days ??
    Math.max(1, Math.ceil((end - new Date(firstPrintedAt).getTime()) / DAY_MS));
  const start = rangeInfo.days ? end - days * DAY_MS : -Infinity;
  const prevStart = start - days * DAY_MS;

  const current = sumRecords(
    records.filter((r) => inWindow(r.printedAt, start, end + 1)),
    costs,
  );
  const previous = sumRecords(
    records.filter((r) => inWindow(r.printedAt, prevStart, start)),
    costs,
  );

  const hours = Math.floor(current.minutes / 60);
  const minutes = Math.round(current.minutes % 60);
  const gramsPerDay = current.grams / days;

  const recentItems = [...items]
    .sort((a, b) =>
      (getItemStats(b).lastPrintedAt ?? "").localeCompare(
        getItemStats(a).lastPrintedAt ?? "",
      ),
    )
    .slice(0, RECENT_ITEMS);

  const alerts = getAlerts(filaments);
  const printerNames = costs.printers.map((p) => p.name).join(" · ");

  return (
    <div className="flex min-w-0 flex-col gap-5 px-6.5 pt-1 pb-5.5">
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <h1 className="mb-0.75 text-[34px] font-bold">Painel</h1>
          <p className="text-[13px] text-muted-foreground">
            Visão geral da sua produção 3D
            {printerNames && ` · ${printerNames}`}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Período"
          className="ml-auto inline-flex rounded-md border border-border p-0.5"
        >
          {RANGES.map((option) => {
            const selected = option.value === range;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRange(option.value)}
                className={cn(
                  "rounded-[5px] px-3.5 py-1.25 text-[12.5px] transition-colors",
                  selected
                    ? "bg-brand/14 text-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-6.5 pt-0.5 pb-1">
        <BigStat
          label="Impressões"
          value={String(current.records)}
          hint={
            rangeInfo.days
              ? formatDelta(current.records - previous.records, rangeInfo.prev)
              : `desde ${formatDatePtBR(firstPrintedAt, { month: "short", year: "numeric" })}`
          }
          hintAccent={
            rangeInfo.days != null && current.records > previous.records
          }
        />
        <StatDivider />
        <BigStat
          label="Filamento"
          value={formatDecimal(Math.round(current.grams))}
          unit=" g"
          hint={`≈ ${formatGrams(gramsPerDay)} por dia`}
        />
        <StatDivider />
        <BigStat
          label="Horas de bico"
          value={String(hours)}
          unit={`h ${String(minutes).padStart(2, "0")}`}
          hint={
            current.records
              ? `média ${formatDuration(current.minutes / current.records)} por impressão`
              : "nenhuma impressão no período"
          }
        />
        <StatDivider />
        <BigStat
          label="Custo de produção"
          value={formatBRL(current.cost)}
          hint={
            current.lost > 0
              ? `${formatBRL(current.lost)} perdido em falhas`
              : "nenhuma falha no período"
          }
          hintAccent={current.lost === 0}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.62fr_1fr]">
        <div className="flex min-w-0 flex-col gap-2.75">
          <div className="flex items-baseline gap-2.5">
            <SectionLabel>Últimas impressões</SectionLabel>
            <Link
              href="/dashboard/impressoes"
              className="ml-auto inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              Ver todas <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentItems.map((item) => (
              <RecentPrintCard key={item.id} item={item} costs={costs} />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="flex flex-col gap-2.25">
            <div className="flex items-center gap-1.75">
              <SectionLabel>Alertas de filamento</SectionLabel>
              {alerts.length > 0 && (
                <span className="rounded-full border border-border px-1.75 text-[9.5px] text-muted-foreground tabular-nums">
                  {alerts.length}
                </span>
              )}
            </div>
            {alerts.length === 0 ? (
              <p className="py-2.75 text-[12.5px] text-muted-foreground">
                Todos os rolos com material. Nada para repor.
              </p>
            ) : (
              <ul className="flex flex-col">
                {alerts
                  .slice(0, ALERT_LIMIT)
                  .map(({ filament, label, color }) => (
                    <li key={filament.id}>
                      <Link
                        href={`/dashboard/filamentos/${filament.id}`}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border/50 py-2.75 transition-colors hover:bg-foreground/4"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full shadow-[inset_0_0_0_1px_rgba(233,233,237,0.3)]"
                          style={{
                            background: filamentSwatchBackground(
                              filament.colors,
                              true,
                            ),
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px]">
                            {filament.colorName}
                          </span>
                          <span className="block truncate text-[10.5px] text-muted-foreground">
                            {filament.type} · {filament.brand.name}
                          </span>
                        </span>
                        <span
                          className="text-[10px] tracking-[0.06em] uppercase"
                          style={{ color }}
                        >
                          {label}
                        </span>
                      </Link>
                    </li>
                  ))}
                {alerts.length > ALERT_LIMIT && (
                  <li>
                    <Link
                      href="/dashboard/filamentos"
                      className="block pt-2 text-xs text-brand hover:underline"
                    >
                      Mais {alerts.length - ALERT_LIMIT} em Filamentos
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <GramsChart
        records={records}
        range={range}
        now={now}
        firstPrintedAt={firstPrintedAt}
      />
    </div>
  );
}
