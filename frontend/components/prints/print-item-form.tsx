"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Plus, Upload, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FilamentUsageDraft,
  FilamentUsageFields,
  parseDecimal,
  toUsages,
} from "@/components/prints/filament-usage-fields";
import {
  OptionalHint,
  SectionLabel,
  StatDivider,
  SuffixInput,
} from "@/components/prints/print-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import {
  INFILL_PATTERNS,
  MOCK_CATEGORIES,
  MOCK_PRINTERS,
  PrintFilament,
  PrintItem,
  PrintRecord,
  SLICERS,
  computeCost,
  createPrintItem,
  describePrintFilament,
  divideCost,
  formatDecimal,
  formatDuration,
  formatGrams,
  getDefaultRecord,
  listPrintFilaments,
  listPrintItems,
  parseDuration,
} from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

const NO_PARENT = "none";
// Escala da barra do rolo, enquanto o filamento não guarda o peso do carretel.
const SPOOL_BAR_GRAMS = 1000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

type Draft = {
  name: string;
  categoryId: string;
  modelUrl: string;
  parentId: string;
  date: string;
  printerId: string;
  time: string;
  units: string;
  usages: FilamentUsageDraft[];
  slicer: string;
  layerHeightMm: string;
  infillPercent: string;
  infillPattern: string;
  walls: string;
  temperatureC: string;
  extras: string;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  categoryId: "",
  modelUrl: "",
  parentId: NO_PARENT,
  date: today(),
  printerId: MOCK_PRINTERS[0].id,
  time: "",
  units: "1",
  usages: [{ filamentId: "", grams: "" }],
  slicer: "Orca",
  layerHeightMm: "0,2",
  infillPercent: "15",
  infillPattern: "giroide",
  walls: "2",
  temperatureC: "215",
  extras: "",
  note: "",
};

// Derivado: começa com a categoria e a impressão do item de origem.
function draftFromParent(parent: PrintItem, record: PrintRecord): Draft {
  return {
    ...EMPTY_DRAFT,
    categoryId: parent.category.id,
    parentId: parent.id,
    printerId: record.printer.id,
    time: formatDuration(record.totalMinutes),
    units: String(record.units),
    usages: record.filaments.map((u) => ({
      filamentId: u.filament.id,
      grams: formatDecimal(u.grams, 1),
    })),
    slicer: record.settings.slicer,
    layerHeightMm: formatDecimal(record.settings.layerHeightMm),
    infillPercent: String(record.settings.infillPercent),
    infillPattern: record.settings.infillPattern,
    walls: String(record.settings.walls),
    temperatureC: String(record.settings.temperatureC),
    extras: record.settings.extras,
  };
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[11px] text-brand-300 tabular-nums">{n}</span>
        <h2 className="font-heading text-[17px] font-medium">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function PrintItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentParam = searchParams.get("derivadoDe");
  const recordParam = searchParams.get("registro");

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [filaments, setFilaments] = useState<PrintFilament[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listPrintFilaments().then(setFilaments);
    listPrintItems().then((result) => {
      setItems(result);
      const parent = result.find((item) => item.id === parentParam);
      if (!parent) return;
      const record =
        parent.records.find((r) => r.id === recordParam) ??
        getDefaultRecord(parent);
      setDraft(draftFromParent(parent, record));
      if (record.settings.extras) setShowExtras(true);
    });
  }, [parentParam, recordParam]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const units = Math.max(1, Math.round(parseDecimal(draft.units)) || 1);
  const minutes = parseDuration(draft.time) ?? 0;
  const usages = toUsages(draft.usages, filaments);
  const grams = usages.reduce((sum, u) => sum + u.grams, 0);
  const perUnitCost = divideCost(
    computeCost({ filaments: usages, totalMinutes: minutes }),
    units,
  );
  const parent = items.find((item) => item.id === draft.parentId);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => [
      ...prev,
      ...images.map((file) => URL.createObjectURL(file)),
    ]);
  }

  function validate() {
    if (!draft.name.trim()) return "Dê um nome para a peça.";
    if (!draft.categoryId) return "Escolha a categoria.";
    if (!usages.length) return "Escolha ao menos um filamento.";
    if (usages.some((u) => u.grams <= 0))
      return "Informe as gramas de cada filamento.";
    if (minutes <= 0) return "Informe o tempo total (ex.: 2 h 06).";
    return null;
  }

  async function save() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    setIsSaving(true);
    try {
      const created = await createPrintItem({
        name: draft.name.trim(),
        categoryId: draft.categoryId,
        modelUrl: draft.modelUrl.trim() || null,
        derivedFromId: draft.parentId === NO_PARENT ? null : draft.parentId,
        firstRecord: {
          printedAt: toIso(draft.date),
          printer:
            MOCK_PRINTERS.find((p) => p.id === draft.printerId) ??
            MOCK_PRINTERS[0],
          filaments: usages,
          units,
          totalMinutes: minutes,
          settings: {
            slicer: draft.slicer,
            layerHeightMm: parseDecimal(draft.layerHeightMm),
            infillPercent: Math.round(parseDecimal(draft.infillPercent)),
            infillPattern: draft.infillPattern,
            walls: Math.round(parseDecimal(draft.walls)),
            temperatureC: Math.round(parseDecimal(draft.temperatureC)),
            extras: draft.extras.trim(),
          },
          outcome: "SUCCESS",
          failureReason: null,
          note: draft.note.trim() || null,
          changeSummary: "Primeira impressão",
          photos,
        },
      });
      router.push(`/dashboard/impressoes/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setIsSaving(false);
    }
  }

  usePageHeaderBreadcrumb(
    <>
      <Link
        href="/dashboard/impressoes"
        className="text-muted-foreground hover:text-foreground"
      >
        Impressões
      </Link>
      <ChevronRight
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="font-medium">Nova impressão</span>
    </>,
  );

  usePageHeaderAction(
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard/impressoes")}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={isSaving}
        aria-busy={isSaving}
        onClick={save}
      >
        <Check />
        {isSaving ? "Salvando..." : "Salvar impressão"}
      </Button>
    </>,
  );

  const costRows = [
    ["Filamento", perUnitCost.filament],
    ["Energia", perUnitCost.energy],
    ["Impressora (hora)", perUnitCost.printer],
    ["Mão de obra", perUnitCost.labor],
  ] as const;

  return (
    <div className="grid grid-cols-1 items-start gap-9 p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        className="flex min-w-0 flex-col gap-7.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <h1 className="text-4xl font-bold">Nova impressão</h1>
          <p className="text-sm text-muted-foreground">
            A peça e a primeira vez que ela foi impressa. Das próximas vezes,
            use &ldquo;Novo registro&rdquo; dentro do item.
          </p>
        </div>

        <Step n={1} title="A peça">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              {photos.length ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {photos.map((src, index) => (
                    <div
                      key={src}
                      className={cn(
                        "group relative h-19",
                        index === 0 && "col-span-2 h-30",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Foto ${index + 1}`}
                        className="size-full rounded-sm object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remover foto ${index + 1}`}
                        onClick={() => {
                          URL.revokeObjectURL(src);
                          setPhotos((prev) => prev.filter((p) => p !== src));
                        }}
                        className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid h-19 place-items-center rounded-sm border border-dashed border-neutral-700 text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                    aria-label="Adicionar mais fotos"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    addPhotos(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex h-40 flex-col items-center justify-center gap-1.75 rounded-md border border-dashed bg-[repeating-linear-gradient(135deg,#20222f_0_8px,#252838_8px_16px)] text-muted-foreground transition-colors hover:border-brand hover:text-brand",
                    isDragging
                      ? "border-brand text-brand"
                      : "border-neutral-700",
                  )}
                >
                  <Upload className="size-5.5" aria-hidden="true" />
                  <span className="text-[11.5px]">Fotos da peça</span>
                </button>
              )}
              <span className="text-[11px] text-muted-foreground/80">
                A primeira vira a capa.
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-3.5">
              <Field label="Nome" htmlFor="print-name">
                <Input
                  id="print-name"
                  autoFocus
                  placeholder={
                    parent ? `Ex.: ${parent.name} XL` : "Ex.: Chaveiro de porco"
                  }
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field label="Categoria">
                  <Select
                    value={draft.categoryId}
                    onValueChange={(value) => set("categoryId", value ?? "")}
                  >
                    <SelectTrigger aria-label="Categoria" className="w-full">
                      <SelectValue>
                        {(value: string) => {
                          const c = MOCK_CATEGORIES.find((o) => o.id === value);
                          return c ? (
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-[3px]"
                                style={{ background: c.color }}
                              />
                              {c.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Escolha a categoria
                            </span>
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span
                            className="size-2.5 rounded-[3px]"
                            style={{ background: c.color }}
                          />
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label={
                    <>
                      Link do modelo <OptionalHint />
                    </>
                  }
                  htmlFor="print-url"
                >
                  <Input
                    id="print-url"
                    type="url"
                    placeholder="makerworld.com/models/..."
                    value={draft.modelUrl}
                    onChange={(e) => set("modelUrl", e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={
                  <>
                    Derivado de <OptionalHint />
                  </>
                }
              >
                <Select
                  value={draft.parentId}
                  onValueChange={(value) => set("parentId", value ?? NO_PARENT)}
                >
                  <SelectTrigger aria-label="Derivado de" className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        const p = items.find((item) => item.id === value);
                        return p ? (
                          p.name
                        ) : (
                          <span className="text-muted-foreground">
                            Escolha se esta peça é uma versão de outra (escala,
                            base diferente…)
                          </span>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>Nenhum</SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </Step>

        <Separator />

        <Step n={2} title="Primeira impressão" hint="vira o registro padrão">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-[1fr_1fr_1fr_110px]">
            <Field label="Data" htmlFor="print-date">
              <Input
                id="print-date"
                type="date"
                max={today()}
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="Impressora">
              <Select
                value={draft.printerId}
                onValueChange={(value) => value && set("printerId", value)}
              >
                <SelectTrigger aria-label="Impressora" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      MOCK_PRINTERS.find((p) => p.id === value)?.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MOCK_PRINTERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tempo total" htmlFor="print-time">
              <Input
                id="print-time"
                placeholder="2 h 06"
                value={draft.time}
                onChange={(e) => set("time", e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="Unidades" htmlFor="print-units">
              <Input
                id="print-units"
                inputMode="numeric"
                value={draft.units}
                onChange={(e) => set("units", e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <SectionLabel>Filamento</SectionLabel>
            <FilamentUsageFields
              value={draft.usages}
              onChange={(next) => set("usages", next)}
              filaments={filaments}
            />
          </div>
        </Step>

        <Separator />

        <Step n={3} title="Configuração do fatiador">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Field label="Fatiador">
              <Select
                value={draft.slicer}
                onValueChange={(value) => value && set("slicer", value)}
              >
                <SelectTrigger aria-label="Fatiador" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLICERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Camada" htmlFor="print-layer">
              <SuffixInput
                id="print-layer"
                suffix="mm"
                value={draft.layerHeightMm}
                onChange={(e) => set("layerHeightMm", e.target.value)}
              />
            </Field>
            <Field label="Preenchimento" htmlFor="print-infill">
              <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-1.5">
                <SuffixInput
                  id="print-infill"
                  suffix="%"
                  className="pr-6"
                  value={draft.infillPercent}
                  onChange={(e) => set("infillPercent", e.target.value)}
                />
                <Select
                  value={draft.infillPattern}
                  onValueChange={(value) =>
                    value && set("infillPattern", value)
                  }
                >
                  <SelectTrigger
                    aria-label="Padrão de preenchimento"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INFILL_PATTERNS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Field>
            <Field label="Paredes" htmlFor="print-walls">
              <Input
                id="print-walls"
                inputMode="numeric"
                value={draft.walls}
                onChange={(e) => set("walls", e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="Temperatura" htmlFor="print-temp">
              <SuffixInput
                id="print-temp"
                suffix="°C"
                value={draft.temperatureC}
                onChange={(e) => set("temperatureC", e.target.value)}
              />
            </Field>
          </div>
          {showExtras ? (
            <Field label="Outros ajustes" htmlFor="print-extras">
              <Textarea
                id="print-extras"
                className="min-h-16"
                placeholder="Ex.: suporte em árvore, brim 5 mm, velocidade 80%"
                maxLength={500}
                value={draft.extras}
                onChange={(e) => set("extras", e.target.value)}
              />
            </Field>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-brand-300"
              onClick={() => setShowExtras(true)}
            >
              <Plus />
              Suporte, brim, velocidade, outros
            </Button>
          )}
        </Step>

        <Separator />

        <Step n={4} title="Resultado">
          <Field
            label={
              <>
                Observação <OptionalHint />
              </>
            }
            htmlFor="print-note"
          >
            <Input
              id="print-note"
              placeholder="Ex.: acabamento bom, orelhas saíram com fio"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </Field>
        </Step>

        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-4 rounded-lg bg-card px-4.5 py-4.5 shadow-[0_0_0_1px_var(--neutral-800)] lg:sticky lg:top-5">
        <SectionLabel>Por unidade</SectionLabel>
        <div className="flex items-stretch gap-4.5">
          <div className="flex flex-col gap-1.25">
            <SectionLabel>Gramas</SectionLabel>
            <span className="font-heading text-2xl leading-none font-medium tabular-nums">
              {grams ? formatGrams(grams / units) : "–"}
            </span>
          </div>
          <StatDivider />
          <div className="flex flex-col gap-1.25">
            <SectionLabel>Tempo</SectionLabel>
            <span className="font-heading text-2xl leading-none font-medium tabular-nums">
              {minutes ? formatDuration(minutes / units) : "–"}
            </span>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 text-[12.5px] text-muted-foreground tabular-nums">
          {costRows.map(([label, value]) => (
            <div key={label} className="flex">
              <span>{label}</span>
              <span className="ml-auto">{formatBRL(value)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-baseline">
          <span className="text-[13px]">Custo / un.</span>
          <span className="ml-auto font-heading text-[26px] leading-none font-medium tabular-nums">
            {formatBRL(perUnitCost.total)}
          </span>
        </div>
        {usages.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              {usages.map(({ filament, grams: used }) => {
                const after = Math.max(0, filament.remainingGrams - used);
                return (
                  <div key={filament.id} className="flex flex-col gap-1.75">
                    <div className="flex items-center gap-1.75 text-xs text-muted-foreground tabular-nums">
                      <FilamentDot colors={filament.colors} />
                      {describePrintFilament(filament)}
                      <span className="ml-auto">
                        {formatGrams(filament.remainingGrams)} →{" "}
                        {formatGrams(after)}
                      </span>
                    </div>
                    <div className="h-1.25 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full bg-brand"
                        style={{
                          width: `${Math.min(100, (after / SPOOL_BAR_GRAMS) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <span className="text-[11px] text-muted-foreground/80">
                Desconta do rolo ao salvar.
              </span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
