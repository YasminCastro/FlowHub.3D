"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Check,
  ChevronRight,
  ImageIcon,
  LinkIcon,
  Maximize2,
  Plus,
  Shapes,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LOW_STOCK_COLOR } from "@/components/catalog/catalog-card";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import { parseDecimal } from "@/components/prints/filament-usage-fields";
import {
  OptionalHint,
  PhotoPlaceholder,
  SectionLabel,
} from "@/components/prints/print-bits";
import { Field, Step } from "@/components/queue/queue-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCatalogData } from "@/hooks/use-catalog-data";
import {
  CATALOG_KIND_LABELS,
  CatalogItem,
  CatalogItemInput,
  CatalogKind,
  getCatalogColors,
  getKitCalculated,
  getMaterials,
  getPrintPhotos,
  formatPriceRange,
  lowColorWarning,
  resolveVariant,
} from "@/lib/api/catalog";
import { CategoryWithUsage, listCategories } from "@/lib/api/category";
import { formatDecimal } from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

type VariantDraft = {
  // Chave só da tela: ao salvar, o backend troca as variações inteiras.
  key: string;
  label: string;
  printItemId: string;
  // Vazio: usa o calculado.
  price: string;
};

type Draft = {
  name: string;
  description: string;
  categoryId: string;
  kind: CatalogKind;
  variants: VariantDraft[];
  kitPrice: string;
  photoIds: string[];
};

const SIZE_LABELS = ["P", "M", "G", "GG"];

const KIND_OPTIONS: {
  value: CatalogKind;
  icon: typeof Box;
  description: string;
}[] = [
  { value: "SINGLE", icon: Box, description: "Uma impressão, um preço." },
  {
    value: "SIZES",
    icon: Maximize2,
    description: "P, M, G… cada tamanho é uma impressão.",
  },
  {
    value: "KIT",
    icon: Shapes,
    description: "Várias impressões vendidas juntas.",
  },
];

function emptyVariant(label = ""): VariantDraft {
  return { key: crypto.randomUUID(), label, printItemId: "", price: "" };
}

function priceText(value: number | null) {
  return value == null ? "" : value.toFixed(2).replace(".", ",");
}

function parsePrice(text: string) {
  return text.trim() ? Math.round(parseDecimal(text) * 100) / 100 : null;
}

function draftFrom(item: CatalogItem | undefined): Draft {
  if (!item) {
    return {
      name: "",
      description: "",
      categoryId: "",
      kind: "SINGLE",
      variants: [emptyVariant()],
      kitPrice: "",
      photoIds: [],
    };
  }
  return {
    name: item.name,
    description: item.description ?? "",
    categoryId: item.category?.id ?? "",
    kind: item.kind,
    variants: item.variants.map((v) => ({
      key: v.id,
      label: v.label,
      // Impressão excluída: a linha volta a pedir uma.
      printItemId: v.printItemId ?? "",
      price: priceText(v.priceOverride),
    })),
    kitPrice: priceText(item.kitPrice),
    photoIds: item.photoIds,
  };
}

// Trocar o tipo mantém as impressões já escolhidas.
function switchKind(draft: Draft, kind: CatalogKind): Draft {
  let variants = draft.variants;
  if (kind === "SIZES") {
    variants = variants.map((v, index) => ({
      ...v,
      label: v.label || SIZE_LABELS[index] || "",
    }));
    if (variants.length < 2) {
      variants = [...variants, emptyVariant(SIZE_LABELS[variants.length])];
    }
  }
  return { ...draft, kind, variants };
}

function PriceInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const manual = value.trim() !== "";
  return (
    <div className="flex items-center gap-1.75">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
          R$
        </span>
        <Input
          inputMode="decimal"
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))}
          className={cn(
            "pl-8 tabular-nums",
            manual && "shadow-[inset_0_0_0_1px_var(--brand-700)]",
          )}
        />
      </div>
      <span
        className={cn(
          "w-11 text-[10.5px] whitespace-nowrap",
          manual ? "text-brand-300" : "text-muted-foreground/70",
        )}
      >
        {manual ? "manual" : "auto"}
      </span>
    </div>
  );
}

export function CatalogItemForm({
  item,
  onSubmit,
}: {
  item?: CatalogItem;
  onSubmit: (input: CatalogItemInput) => Promise<string>;
}) {
  const router = useRouter();
  const { data, loadError } = useCatalogData();
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const cancelHref = item
    ? `/dashboard/catalogo/${item.id}`
    : "/dashboard/catalogo";

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setVariant(key: string, patch: Partial<VariantDraft>) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.key === key ? { ...v, ...patch } : v,
      ),
    }));
  }

  function addVariant() {
    setDraft((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        emptyVariant(
          prev.kind === "SIZES" ? SIZE_LABELS[prev.variants.length] : "",
        ),
      ],
    }));
  }

  function removeVariant(key: string) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.key !== key),
    }));
  }

  function togglePhoto(id: string) {
    setDraft((prev) => ({
      ...prev,
      photoIds: prev.photoIds.includes(id)
        ? prev.photoIds.filter((p) => p !== id)
        : [...prev.photoIds, id],
    }));
  }

  const prints = data?.prints ?? [];
  const visibleVariants =
    draft.kind === "SINGLE" ? draft.variants.slice(0, 1) : draft.variants;
  const resolved = data
    ? visibleVariants.map((v) =>
        resolveVariant(
          {
            id: v.key,
            label: v.label,
            printItemId: v.printItemId,
            priceOverride: draft.kind === "KIT" ? null : parsePrice(v.price),
          },
          data.prints,
          data.filaments,
          data.costs,
        ),
      )
    : [];
  const linked = resolved.map((v) => v.print);
  const materials = getMaterials(linked);
  const { colors } = data
    ? getCatalogColors(materials, data.filaments)
    : { colors: [] };
  const availablePhotos = getPrintPhotos(linked);
  const kitCalculated = getKitCalculated(resolved);
  const kitPrice = parsePrice(draft.kitPrice);
  const prices =
    draft.kind === "KIT"
      ? [kitPrice ?? kitCalculated].flatMap((p) => (p == null ? [] : [p]))
      : resolved.flatMap((v) => (v.price == null ? [] : [v.price]));
  const previewPhoto =
    availablePhotos.find((p) => draft.photoIds.includes(p.id)) ??
    availablePhotos[0];

  async function save() {
    setError(null);
    setIsSaving(true);
    try {
      const id = await onSubmit({
        name: draft.name,
        description: draft.description,
        categoryId: draft.categoryId || null,
        kind: draft.kind,
        variants: visibleVariants.map((v) => ({
          label: v.label,
          printItemId: v.printItemId,
          priceOverride: parsePrice(v.price),
        })),
        kitPrice,
        // Só as fotos que ainda são das impressões ligadas.
        photoIds: draft.photoIds.filter((id) =>
          availablePhotos.some((p) => p.id === id),
        ),
      });
      router.push(`/dashboard/catalogo/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setIsSaving(false);
    }
  }

  usePageHeaderBreadcrumb(
    <>
      <Link
        href="/dashboard/catalogo"
        className="text-muted-foreground hover:text-foreground"
      >
        Catálogo
      </Link>
      <ChevronRight
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      {item ? (
        <>
          <Link
            href={cancelHref}
            className="max-w-60 truncate text-muted-foreground hover:text-foreground"
          >
            {item.name}
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="font-medium">Editar</span>
        </>
      ) : (
        <span className="font-medium">Novo item</span>
      )}
    </>,
  );

  usePageHeaderAction(
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(cancelHref)}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={isSaving || !data}
        aria-busy={isSaving}
        onClick={save}
      >
        <Check />
        {isSaving ? "Salvando..." : "Salvar item"}
      </Button>
    </>,
  );

  if (loadError) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const margin = formatDecimal(data.costs.settings.defaultMarginPercent);
  const rowGrid =
    draft.kind === "SIZES"
      ? "md:grid-cols-[72px_minmax(0,1.5fr)_84px_92px_170px_24px]"
      : draft.kind === "KIT"
        ? "md:grid-cols-[minmax(0,1.5fr)_84px_92px_24px]"
        : "md:grid-cols-[minmax(0,1.5fr)_84px_92px_170px]";
  const stepTitle =
    draft.kind === "SIZES"
      ? "Tamanhos e preço"
      : draft.kind === "KIT"
        ? "Peças e preço"
        : "Impressão e preço";

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
          <h1 className="text-4xl font-bold">
            {item ? "Editar item do catálogo" : "Novo item do catálogo"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Um item que você vende, ligado a uma ou mais impressões.
          </p>
        </div>

        <Step n={1} title="O item">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Nome" htmlFor="catalog-name">
              <Input
                id="catalog-name"
                placeholder="Ex.: Vaso hexagonal"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <Select
                value={draft.categoryId || null}
                onValueChange={(value) => set("categoryId", value ?? "")}
              >
                <SelectTrigger aria-label="Categoria" className="w-full">
                  <SelectValue>
                    {(value: string) => {
                      const c =
                        categories.find((cat) => cat.id === value) ??
                        (item?.category?.id === value ? item.category : null);
                      return c ? (
                        <>
                          {c.color && (
                            <span
                              className="size-2.5 rounded-[3px]"
                              style={{ background: c.color }}
                            />
                          )}
                          {c.name}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Sem categoria
                        </span>
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
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
          </div>
          <Field
            label={
              <>
                Descrição <OptionalHint />
              </>
            }
            htmlFor="catalog-description"
          >
            <Input
              id="catalog-description"
              placeholder="Para que serve, cuidados, o que vem junto…"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </Step>

        <Separator />

        <Step n={2} title="Como é vendido">
          <div
            role="radiogroup"
            aria-label="Como é vendido"
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
          >
            {KIND_OPTIONS.map(({ value, icon: Icon, description }) => {
              const selected = draft.kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDraft((prev) => switchKind(prev, value))}
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-md px-3.5 py-3.25 text-left transition-colors",
                    selected
                      ? "bg-brand/8 shadow-[inset_0_0_0_1px_var(--brand-700)]"
                      : "shadow-[inset_0_0_0_1px_var(--neutral-700)] hover:bg-foreground/3",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                      selected
                        ? "shadow-[inset_0_0_0_1.5px_var(--brand)]"
                        : "shadow-[inset_0_0_0_1.5px_var(--neutral-600)]",
                    )}
                  >
                    {selected && (
                      <span className="size-2 rounded-full bg-brand" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-2 text-[13.5px]">
                      <Icon
                        className={cn(
                          "size-3.75",
                          selected ? "text-brand" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                      {CATALOG_KIND_LABELS[value]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Separator />

        <Step n={3} title={stepTitle} hint={`margem padrão ${margin}%`}>
          {prints.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              Nenhuma impressão cadastrada ainda.{" "}
              <Link
                href="/dashboard/impressoes/new"
                className="text-brand-300 hover:underline"
              >
                Cadastre a peça em Impressões
              </Link>{" "}
              para ligar ao catálogo.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className={cn("hidden gap-3 md:grid", rowGrid)}>
                {draft.kind === "SIZES" && <SectionLabel>Tamanho</SectionLabel>}
                <SectionLabel>Impressão</SectionLabel>
                <SectionLabel className="text-right">Custo</SectionLabel>
                <SectionLabel className="text-right">Calculado</SectionLabel>
                {draft.kind !== "KIT" && <SectionLabel>Preço</SectionLabel>}
                {draft.kind !== "SINGLE" && <span />}
              </div>

              {visibleVariants.map((v, index) => {
                const r = resolved[index];
                return (
                  <div
                    key={v.key}
                    className={cn(
                      "grid grid-cols-2 items-center gap-3",
                      rowGrid,
                    )}
                  >
                    {draft.kind === "SIZES" && (
                      <Input
                        aria-label="Tamanho"
                        value={v.label}
                        onChange={(e) =>
                          setVariant(v.key, { label: e.target.value })
                        }
                      />
                    )}
                    <Select
                      value={v.printItemId || null}
                      onValueChange={(value) =>
                        value && setVariant(v.key, { printItemId: value })
                      }
                    >
                      <SelectTrigger
                        aria-label="Impressão"
                        className="col-span-2 w-full md:col-span-1"
                      >
                        <SelectValue>
                          {(value: string) => {
                            const p = prints.find(
                              (print) => print.id === value,
                            );
                            return p ? (
                              <>
                                <LinkIcon
                                  className="size-3.25 opacity-60"
                                  aria-hidden="true"
                                />
                                {p.name}
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {value
                                  ? "Impressão excluída"
                                  : "Escolha a impressão"}
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {prints.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">
                      {r.cost != null ? formatBRL(r.cost) : "–"}
                    </span>
                    <span className="text-right text-[12.5px] text-muted-foreground/80 tabular-nums">
                      {r.calculated != null ? formatBRL(r.calculated) : "–"}
                    </span>
                    {draft.kind !== "KIT" && (
                      <PriceInput
                        label={`Preço${v.label ? ` do ${v.label}` : ""}`}
                        value={v.price}
                        onChange={(price) => setVariant(v.key, { price })}
                        placeholder={priceText(r.calculated)}
                      />
                    )}
                    {draft.kind !== "SINGLE" && (
                      <button
                        type="button"
                        aria-label="Remover linha"
                        disabled={visibleVariants.length === 1}
                        onClick={() => removeVariant(v.key)}
                        className="grid size-6 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {draft.kind !== "SINGLE" && (
                <button
                  type="button"
                  onClick={addVariant}
                  className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-brand-300 hover:underline"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {draft.kind === "SIZES" ? "Outro tamanho" : "Outra peça"}
                </button>
              )}

              {draft.kind === "KIT" && (
                <div className="flex flex-wrap items-end gap-4 pt-1">
                  <Field label="Preço do kit" className="w-56">
                    <PriceInput
                      label="Preço do kit"
                      value={draft.kitPrice}
                      onChange={(value) => set("kitPrice", value)}
                      placeholder={priceText(kitCalculated)}
                    />
                  </Field>
                  <span className="pb-2.5 text-[12px] text-muted-foreground">
                    Calculado: soma das peças
                    {kitCalculated != null && ` (${formatBRL(kitCalculated)})`}
                  </span>
                </div>
              )}

              <p className="text-[11.5px] text-muted-foreground/80">
                Digite um preço para sobrescrever o calculado. Apague para
                voltar ao automático.
              </p>
            </div>
          )}
        </Step>

        <Separator />

        <Step n={4} title="Fotos">
          {availablePhotos.length ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {availablePhotos.map((photo) => {
                const selected = draft.photoIds.includes(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? "Tirar a foto" : "Usar a foto"}
                    onClick={() => togglePhoto(photo.id)}
                    className={cn(
                      "relative h-19.5 overflow-hidden rounded-sm",
                      selected && "ring-[1.5px] ring-brand ring-inset",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.src}
                      alt=""
                      className={cn(
                        "size-full object-cover",
                        !selected && "opacity-70",
                      )}
                    />
                    {selected && (
                      <span className="absolute top-1.25 right-1.25 grid size-4 place-items-center rounded-full bg-brand text-background">
                        <Check className="size-2.5" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <PhotoPlaceholder className="h-19.5 gap-1.5 rounded-sm">
              <span className="flex items-center gap-1.5 text-[11.5px]">
                <ImageIcon className="size-4" aria-hidden="true" />
                As impressões ligadas ainda não têm fotos.
              </span>
            </PhotoPlaceholder>
          )}
          <p className="text-[11.5px] text-muted-foreground/80">
            Fotos dos registros das impressões ligadas. Escolha quais aparecem
            no catálogo; sem escolha, vai a primeira.
          </p>
        </Step>

        {error && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-3.5 rounded-lg bg-card px-4.5 py-4.5 shadow-[0_0_0_1px_var(--neutral-800)] lg:sticky lg:top-5">
        <SectionLabel>Cores disponíveis</SectionLabel>
        <span className="text-xs text-muted-foreground">
          {materials.length
            ? `Automático: rolos de ${materials.join(" e ")} em estoque, o material dos registros padrão.`
            : "Automático: escolha uma impressão e as cores vêm dos rolos em estoque do mesmo material."}
        </span>
        {colors.length > 0 && (
          <div className="flex flex-col gap-2.25">
            {colors.map((color) => (
              <div
                key={color.filament.id}
                className="flex items-center gap-2.25 text-[12.5px]"
              >
                <FilamentDot
                  colors={color.filament.colors}
                  className="size-3"
                />
                <span className="min-w-0 truncate">
                  {color.filament.colorName}
                </span>
                {color.low ? (
                  <span
                    className="ml-auto inline-flex items-center gap-1 text-[11.5px] whitespace-nowrap"
                    style={{ color: LOW_STOCK_COLOR }}
                    title={
                      lowColorWarning(
                        { kind: draft.kind, variants: resolved },
                        color,
                      ) ?? undefined
                    }
                  >
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    acabando
                  </span>
                ) : (
                  <span className="ml-auto text-[11.5px] text-muted-foreground">
                    {color.filament.brand.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <Separator />
        <SectionLabel>No card</SectionLabel>
        <div className="flex flex-col gap-1.5">
          {previewPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewPhoto.src}
              alt=""
              className="h-24 w-full rounded-sm object-cover"
            />
          ) : (
            <PhotoPlaceholder className="h-24 rounded-sm" />
          )}
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 truncate font-heading text-[13.5px] font-medium">
              {draft.name.trim() || "Sem nome"}
            </span>
            <span className="ml-auto shrink-0 font-heading text-sm font-medium tabular-nums">
              {prices.length
                ? formatPriceRange(Math.min(...prices), Math.max(...prices))
                : "–"}
            </span>
          </div>
          <div className="flex gap-1.25">
            {colors.slice(0, 6).map((color) => (
              <FilamentDot
                key={color.filament.id}
                colors={color.filament.colors}
                className="size-2.5"
              />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
