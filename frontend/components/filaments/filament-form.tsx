"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { FilamentCard } from "@/components/filaments/filament-card";
import { FilamentColorsInput } from "@/components/filaments/filament-colors-input";
import { FilamentRatingInput } from "@/components/filaments/filament-rating";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  Brand,
  PURCHASE_CHANNELS,
  PURCHASE_CHANNEL_LABELS,
  PurchaseChannel,
  listBrands,
} from "@/lib/api/brand";
import {
  FILAMENT_AVAILABILITY_LABELS,
  FILAMENT_COLORS_MAX_COUNT,
  FILAMENT_TYPES,
  Filament,
  FilamentAvailability,
  FilamentInput,
  SPOOL_WEIGHT_OPTIONS,
  formatPricePerKg,
  formatSpoolWeight,
  getPricePerKg,
  isValidHex,
} from "@/lib/api/filament";
import { cn, formatBRL } from "@/lib/utils";

const FORM_ID = "filament-form";

const optionalNumber = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || Number(value) >= 0,
    "Informe um número válido.",
  );

const optionalTemp = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (Number.isInteger(Number(value)) && Number(value) >= 0),
    "Informe uma temperatura válida.",
  );

function isValidTempRange(min: string, max: string) {
  return min === "" || max === "" || Number(min) <= Number(max);
}

const filamentFormSchema = z
  .object({
    brandId: z.string().min(1, "Escolha a marca."),
    type: z.string().min(1, "Escolha o tipo."),
    colorName: z.string().trim().min(1, "Informe o nome da cor."),
    colors: z
      .array(z.string().refine(isValidHex, "Use o formato #rrggbb."))
      .min(1)
      .max(FILAMENT_COLORS_MAX_COUNT),
    spoolWeightGrams: z.string(),
    minPricePaid: z
      .string()
      .trim()
      .refine(
        (value) => value !== "" && Number(value) > 0,
        "Informe quanto pagou no rolo.",
      ),
    maxPricePaid: optionalNumber,
    lastPurchasedAt: z.string(),
    purchaseChannel: z.string(),
    availability: z.enum(["AVAILABLE", "SOLD_OUT"]),
    isOutlet: z.boolean(),
    purchaseCount: z.number().int().min(1),
    rating: z.number().int().min(1).max(5).nullable(),
    ratingComment: z.string().trim(),
    nozzleTempMin: optionalTemp,
    nozzleTempMax: optionalTemp,
    bedTempMin: optionalTemp,
    bedTempMax: optionalTemp,
    notes: z.string(),
  })
  .refine(
    (values) =>
      values.maxPricePaid === "" ||
      Number(values.minPricePaid) <= Number(values.maxPricePaid),
    {
      message: "O máximo precisa ser maior ou igual ao mínimo.",
      path: ["maxPricePaid"],
    },
  )
  .refine(
    (values) => isValidTempRange(values.nozzleTempMin, values.nozzleTempMax),
    {
      message: "A máxima precisa ser maior ou igual à mínima.",
      path: ["nozzleTempMax"],
    },
  )
  .refine((values) => isValidTempRange(values.bedTempMin, values.bedTempMax), {
    message: "A máxima precisa ser maior ou igual à mínima.",
    path: ["bedTempMax"],
  });

type FilamentFormValues = z.infer<typeof filamentFormSchema>;

type BrandOption = { id: string; name: string };

function toText(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function toNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDefaultValues(
  filament: Filament | null | undefined,
): FilamentFormValues {
  return {
    brandId: filament?.brandId ?? "",
    type: filament?.type ?? "PLA",
    colorName: filament?.colorName ?? "",
    colors: filament?.colors ?? ["#2f313c"],
    spoolWeightGrams: String(filament?.spoolWeightGrams ?? 1000),
    minPricePaid: toText(filament?.minPricePaid),
    maxPricePaid: toText(filament?.maxPricePaid),
    lastPurchasedAt: filament?.lastPurchasedAt?.slice(0, 10) ?? today(),
    purchaseChannel: filament?.purchaseChannel ?? "",
    availability: filament?.availability ?? "AVAILABLE",
    isOutlet: filament?.isOutlet ?? false,
    purchaseCount: filament?.purchaseCount ?? 1,
    rating: filament?.rating ?? null,
    ratingComment: filament?.ratingComment ?? "",
    nozzleTempMin: toText(filament?.nozzleTempMin),
    nozzleTempMax: toText(filament?.nozzleTempMax),
    bedTempMin: toText(filament?.bedTempMin),
    bedTempMax: toText(filament?.bedTempMax),
    notes: "",
  };
}

const RATING_HINTS: Record<number, string> = {
  1: "Ruim",
  2: "Fraco",
  3: "Ok",
  4: "Bom",
  5: "Excelente",
};

function SectionToggle({
  open,
  onToggle,
  label,
  hint,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  hint: string;
}) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-fit items-center gap-2 text-left"
    >
      <Icon
        className={cn(
          "size-3.5",
          open ? "text-brand" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-muted-foreground/70">{hint}</span>
    </button>
  );
}

function SuffixInput({
  suffix,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative">
      <Input className={cn("pr-12", className)} {...props} />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

export type FilamentFormProps = {
  /** Rolo sendo editado. Omitido/nulo = formulário de criação. */
  filament?: Filament | null;
  breadcrumb: ReactNode;
  cancelHref: string;
  /** Devolve o id salvo; o formulário decide se navega ou recomeça. */
  onSubmit: (input: FilamentInput) => Promise<string>;
};

export function FilamentForm({
  filament,
  breadcrumb,
  cancelHref,
  onSubmit,
}: FilamentFormProps) {
  const router = useRouter();
  const isEditing = !!filament;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brandsError, setBrandsError] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const form = useForm<FilamentFormValues>({
    resolver: zodResolver(filamentFormSchema),
    defaultValues: toDefaultValues(filament),
  });

  useEffect(() => {
    let ignore = false;
    listBrands()
      .then((result) => {
        if (ignore) return;
        setBrands(result);
      })
      .catch(() => {
        if (!ignore) setBrandsError(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const brandOptions: BrandOption[] = (brands ?? []).map((brand) => ({
    id: brand.id,
    name: brand.name,
  }));
  // A lista só traz marcas ativas; na edição, a marca do filamento continua
  // como opção mesmo se tiver sido arquivada.
  if (
    filament &&
    !brandOptions.some((option) => option.id === filament.brandId)
  ) {
    brandOptions.push(filament.brand);
  }

  usePageHeaderBreadcrumb(breadcrumb);

  const isSubmitting = form.formState.isSubmitting;
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
        {isSubmitting
          ? "Salvando..."
          : isEditing
            ? "Salvar alterações"
            : "Salvar rolo"}
      </Button>
    </div>,
  );

  async function handleSubmit(values: FilamentFormValues) {
    setSubmitError(null);
    const input: FilamentInput = {
      brandId: values.brandId,
      type: values.type,
      colorName: values.colorName,
      colors: values.colors.map((color) => color.toLowerCase()),
      spoolWeightGrams: Number(values.spoolWeightGrams),
      minPricePaid: Number(values.minPricePaid),
      maxPricePaid: toNumber(values.maxPricePaid),
      purchaseCount: values.purchaseCount,
      lastPurchasedAt: values.lastPurchasedAt
        ? new Date(`${values.lastPurchasedAt}T12:00:00`).toISOString()
        : null,
      purchaseChannel: (values.purchaseChannel ||
        null) as PurchaseChannel | null,
      availability: values.availability,
      isOutlet: values.isOutlet,
      rating: values.rating,
      ratingComment: values.rating ? values.ratingComment || null : null,
      nozzleTempMin: toNumber(values.nozzleTempMin),
      nozzleTempMax: toNumber(values.nozzleTempMax),
      bedTempMin: toNumber(values.bedTempMin),
      bedTempMax: toNumber(values.bedTempMax),
      notes: !isEditing && values.notes.trim() ? values.notes : undefined,
    };

    try {
      const id = await onSubmit(input);
      router.push(`/dashboard/filamentos/${id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o filamento.",
      );
    }
  }

  const values = form.watch();
  const selectedBrand = brandOptions.find(
    (option) => option.id === values.brandId,
  );
  const spoolWeight = Number(values.spoolWeightGrams);
  const price = getPricePerKg({
    minPricePaid: Number(values.minPricePaid) || 0,
    maxPricePaid: toNumber(values.maxPricePaid),
    spoolWeightGrams: spoolWeight,
  });
  const rating = values.rating;

  return (
    <div className="flex flex-col gap-10 p-8 lg:flex-row">
      <Form {...form}>
        <form
          id={FORM_ID}
          className="flex min-w-0 flex-1 flex-col gap-6"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div>
            <h1 className="text-4xl font-bold">
              {isEditing ? "Editar filamento" : "Novo filamento"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Marca, cor e o que você pagou nas compras."
                : "Uma cor que você comprou: marca, tipo e quanto pagou no rolo."}
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem className="sm:w-60">
                  <FormLabel>Marca</FormLabel>
                  <Select
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Escolha a marca">
                          {(value: string | null) =>
                            brandOptions.find((option) => option.id === value)
                              ?.name ?? "Escolha a marca"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {brandOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {brands && brands.length === 0 && (
                    <p className="text-[12.5px] text-muted-foreground">
                      Nenhuma marca ainda.{" "}
                      <Link
                        href="/dashboard/marcas/new"
                        className="text-brand-300 hover:underline"
                      >
                        Cadastrar marca
                      </Link>
                    </p>
                  )}
                  {brandsError && (
                    <p className="text-[12.5px] text-destructive">
                      Não foi possível carregar as marcas.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <div
                      role="radiogroup"
                      aria-label="Tipo"
                      className="flex flex-wrap gap-1.5"
                    >
                      {FILAMENT_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={field.value === type}
                          onClick={() => field.onChange(type)}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-sm transition-colors",
                            field.value === type
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <section className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Cor
            </span>
            <FormField
              control={form.control}
              name="colorName"
              render={({ field }) => (
                <FormItem className="w-72">
                  <FormLabel>Nome da cor</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Verde e Preto Silk"
                      autoFocus={!isEditing}
                      maxLength={80}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="colors"
              render={({ field }) => (
                <FilamentColorsInput
                  value={field.value}
                  onChange={(colors) =>
                    form.setValue("colors", colors, {
                      shouldDirty: true,
                      shouldValidate: form.formState.isSubmitted,
                    })
                  }
                  showErrors={form.formState.isSubmitted}
                />
              )}
            />
          </section>

          <Separator />

          <div className="flex flex-wrap items-start gap-4">
            <FormField
              control={form.control}
              name="spoolWeightGrams"
              render={({ field }) => (
                <FormItem className="w-32">
                  <FormLabel>Peso do rolo</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? "1000")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) => formatSpoolWeight(Number(value))}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SPOOL_WEIGHT_OPTIONS.map((grams) => (
                        <SelectItem key={grams} value={String(grams)}>
                          {formatSpoolWeight(grams)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minPricePaid"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel>Preço mínimo pago</FormLabel>
                  <FormControl>
                    <SuffixInput
                      suffix="R$"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="110,00"
                      className="tabular-nums"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxPricePaid"
              render={({ field }) => (
                <FormItem className="w-52">
                  <FormLabel className="whitespace-nowrap">
                    Preço máximo pago{" "}
                    <span className="text-muted-foreground">opcional</span>
                  </FormLabel>
                  <FormControl>
                    <SuffixInput
                      suffix="R$"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="120,00"
                      className="tabular-nums"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastPurchasedAt"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel>Data da compra</FormLabel>
                  <FormControl>
                    <Input type="date" className="tabular-nums" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchaseChannel"
              render={({ field }) => (
                <FormItem className="w-48">
                  <FormLabel>Onde comprou</FormLabel>
                  <Select
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Escolha">
                          {(value: PurchaseChannel | null) =>
                            value ? PURCHASE_CHANNEL_LABELS[value] : "Escolha"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PURCHASE_CHANNELS.map((channel) => (
                        <SelectItem key={channel} value={channel}>
                          {PURCHASE_CHANNEL_LABELS[channel]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {/* Um filamento novo sempre está disponível na marca; dá para
                marcar "Esgotado" depois, na edição. */}
            {isEditing && (
              <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Na marca</FormLabel>
                    <FormControl>
                      <div className="inline-flex w-fit rounded-md border border-border p-0.5">
                        {(
                          ["AVAILABLE", "SOLD_OUT"] as FilamentAvailability[]
                        ).map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={field.value === option}
                            onClick={() => field.onChange(option)}
                            className={cn(
                              "rounded-[6px] px-3 py-1 text-sm transition-colors",
                              field.value === option
                                ? "bg-brand/15 text-brand"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {FILAMENT_AVAILABILITY_LABELS[option]}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="purchaseCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vezes que comprou</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Uma compra a menos"
                        disabled={field.value <= 1}
                        onClick={() => field.onChange(field.value - 1)}
                      >
                        <Minus />
                      </Button>
                      <span
                        aria-live="polite"
                        className="w-10 text-center tabular-nums"
                      >
                        {field.value}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Uma compra a mais"
                        onClick={() => field.onChange(field.value + 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isOutlet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outlet</FormLabel>
                  <FormControl>
                    <button
                      type="button"
                      aria-pressed={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={cn(
                        "flex h-8 w-fit items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
                        field.value
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {field.value && (
                        <Check className="size-3.5" aria-hidden="true" />
                      )}
                      Comprado no outlet
                    </button>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Configurações do fabricante
              </span>
              <span className="text-xs text-muted-foreground/70">
                opcional — faixa de temperatura indicada na caixa do rolo
              </span>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <FormField
                control={form.control}
                name="nozzleTempMin"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormLabel>Bico mínimo</FormLabel>
                    <FormControl>
                      <SuffixInput
                        suffix="°C"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="200"
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nozzleTempMax"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormLabel>Bico máximo</FormLabel>
                    <FormControl>
                      <SuffixInput
                        suffix="°C"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="230"
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bedTempMin"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormLabel>Mesa mínima</FormLabel>
                    <FormControl>
                      <SuffixInput
                        suffix="°C"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="50"
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bedTempMax"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormLabel>Mesa máxima</FormLabel>
                    <FormControl>
                      <SuffixInput
                        suffix="°C"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="70"
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

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Sua nota
              </span>
              <span className="text-xs text-muted-foreground/70">
                opcional — pode avaliar depois de imprimir
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilamentRatingInput
                value={rating}
                onChange={(star) =>
                  form.setValue("rating", star, { shouldDirty: true })
                }
              />
              <span className="font-heading text-sm font-medium tabular-nums">
                {rating ? `${rating},0` : "—"}
              </span>
              {rating && (
                <>
                  <span className="text-[12.5px] text-muted-foreground">
                    {RATING_HINTS[rating]}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="ml-auto"
                    onClick={() =>
                      form.setValue("rating", null, { shouldDirty: true })
                    }
                  >
                    Limpar
                  </Button>
                </>
              )}
            </div>
            {rating && (
              <FormField
                control={form.control}
                name="ratingComment"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Ex: imprime limpo, cor um pouco mais escura que a foto"
                        aria-label="Comentário da nota"
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </section>

          {!isEditing && (
            <section className="flex flex-col gap-3">
              <SectionToggle
                open={notesOpen}
                onToggle={() => setNotesOpen((prev) => !prev)}
                label="Observações"
                hint="como a cor se comporta, defeitos, o que evitar"
              />
              {notesOpen && (
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: em 0,28 a textura velvet some."
                          aria-label="Observações"
                          maxLength={2000}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </section>
          )}

          {submitError && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {submitError}
            </p>
          )}
        </form>
      </Form>

      <aside className="flex w-full flex-col gap-6 lg:w-80 lg:flex-none">
        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Prévia do card
          </span>
          <FilamentCard
            filament={{
              colorName: values.colorName,
              colors: values.colors,
              brand: { id: values.brandId, name: selectedBrand?.name ?? "" },
              type: values.type,
              spoolWeightGrams: spoolWeight,
              spoolLevel: filament?.spoolLevel ?? "FULL",
              finishedAt: filament?.finishedAt ?? null,
              minPricePaid: Number(values.minPricePaid) || 0,
              maxPricePaid: toNumber(values.maxPricePaid),
              rating: values.rating,
              availability: values.availability,
              isOutlet: values.isOutlet,
              purchaseCount: values.purchaseCount,
            }}
          />
        </section>

        <section className="flex flex-col gap-2.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Calculado
          </span>
          {[
            {
              label: "Custo por kg",
              value: price ? formatPricePerKg(price, "") : "—",
            },
            {
              label: "Média por kg",
              value: price ? formatBRL(price.average) : "—",
            },
            {
              label: "Custo por 100 g",
              value: price ? formatBRL(price.average / 10) : "—",
            },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular-nums">{row.value}</span>
            </div>
          ))}
          <p className="text-[12.5px] leading-relaxed text-muted-foreground/80">
            O custo de cada impressão usa a média; a faixa mostra a variação
            entre as compras deste filamento.
          </p>
        </section>
      </aside>
    </div>
  );
}
