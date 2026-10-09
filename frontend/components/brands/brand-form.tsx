"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CircleCheck, Layers, TriangleAlert } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BrandColorInput } from "@/components/brands/brand-color-input";
import { BrandRowPreview } from "@/components/brands/brand-row-preview";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  BRAND_STATUS_LABELS,
  Brand,
  BrandInput,
  BrandStatus,
  FILAMENT_TYPE_OPTIONS,
  PURCHASE_CHANNELS,
  PURCHASE_CHANNEL_LABELS,
  PurchaseChannel,
  getAveragePricePerKg,
  getCostBenefit,
  getResearchedPrice,
  listBrands,
} from "@/lib/api/brand";
import { cn, formatBRL } from "@/lib/utils";

const FORM_ID = "brand-form";

const priceField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || Number(value) >= 0,
    "Informe um preço válido.",
  );

const brandFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da marca."),
    website: z.string().trim(),
    purchaseChannels: z.array(z.string()),
    filamentTypes: z.array(z.string()),
    preferredColors: z.array(z.string()),
    status: z.enum(["PURCHASED", "RESEARCHED"]),
    researchedMinPricePerKg: priceField,
    researchedMaxPricePerKg: priceField,
    notes: z.string(),
  })
  .refine(
    (values) =>
      values.status !== "RESEARCHED" ||
      values.researchedMinPricePerKg === "" ||
      values.researchedMaxPricePerKg === "" ||
      Number(values.researchedMinPricePerKg) <=
        Number(values.researchedMaxPricePerKg),
    {
      message: "O máximo precisa ser maior ou igual ao mínimo.",
      path: ["researchedMaxPricePerKg"],
    },
  );

function toPrice(value: string) {
  return value === "" ? null : Number(value);
}

type BrandFormValues = z.infer<typeof brandFormSchema>;

function toDefaultValues(brand?: Brand | null): BrandFormValues {
  return {
    name: brand?.name ?? "",
    website: brand?.website ?? "",
    purchaseChannels: brand?.purchaseChannels ?? [],
    filamentTypes: brand?.filamentTypes ?? [],
    preferredColors: brand?.preferredColors ?? [],
    status: brand?.status ?? "PURCHASED",
    researchedMinPricePerKg: brand?.researchedMinPricePerKg?.toString() ?? "",
    researchedMaxPricePerKg: brand?.researchedMaxPricePerKg?.toString() ?? "",
    notes: "",
  };
}

function normalize(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function ChipGroup({
  options,
  value,
  onChange,
  getLabel = (option) => option,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  getLabel?: (option: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== option)
                  : [...value, option],
              )
            }
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              selected
                ? "border-brand bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {getLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

export type BrandFormProps = {
  /** Marca sendo editada. Omitido/nulo = formulário de criação. */
  brand?: Brand | null;
  breadcrumb: ReactNode;
  cancelHref: string;
  onSubmit: (input: BrandInput) => Promise<void>;
};

export function BrandForm({
  brand,
  breadcrumb,
  cancelHref,
  onSubmit,
}: BrandFormProps) {
  const router = useRouter();
  const isEditing = !!brand;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [otherBrands, setOtherBrands] = useState<Brand[] | null>(null);

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: toDefaultValues(brand),
  });

  // Ativas e arquivadas: o nome é único entre todas.
  useEffect(() => {
    Promise.all([listBrands(), listBrands({ archived: true })])
      .then(([active, archived]) =>
        setOtherBrands(
          [...active, ...archived].filter((item) => item.id !== brand?.id),
        ),
      )
      .catch(() => setOtherBrands(null));
  }, [brand?.id]);

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
            : "Salvar marca"}
      </Button>
    </div>,
  );

  async function handleSubmit(values: BrandFormValues) {
    setSubmitError(null);
    // A faixa pesquisada só vale para "Só pesquisei"; ao virar "Já comprei"
    // ela é limpa, e o preço passa a vir dos rolos.
    const isResearched = values.status === "RESEARCHED";
    const input: BrandInput = {
      name: values.name,
      // Na edição, apagar o site precisa chegar como null para limpar.
      website: values.website || (isEditing ? null : undefined),
      purchaseChannels: values.purchaseChannels as PurchaseChannel[],
      filamentTypes: values.filamentTypes,
      preferredColors: values.preferredColors,
      status: values.status,
      researchedMinPricePerKg: isResearched
        ? toPrice(values.researchedMinPricePerKg)
        : null,
      researchedMaxPricePerKg: isResearched
        ? toPrice(values.researchedMaxPricePerKg)
        : null,
      notes: !isEditing && values.notes.trim() ? values.notes : undefined,
    };

    try {
      await onSubmit(input);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a marca.",
      );
    }
  }

  const name = form.watch("name");
  const status = form.watch("status");
  const filamentTypes = form.watch("filamentTypes");
  const researchedMin = form.watch("researchedMinPricePerKg");
  const researchedMax = form.watch("researchedMaxPricePerKg");
  const researchedPrice = getResearchedPrice({
    status,
    researchedMinPricePerKg:
      researchedMin === "" ? null : Number(researchedMin),
    researchedMaxPricePerKg:
      researchedMax === "" ? null : Number(researchedMax),
  });
  // A marca do formulário entra na média junto com as outras ativas, como
  // vai acontecer na lista depois de salvar.
  const averagePricePerKg = getAveragePricePerKg([
    ...(otherBrands ?? []).filter((item) => !item.archivedAt),
    {
      status,
      researchedMinPricePerKg: researchedPrice?.min ?? null,
      researchedMaxPricePerKg: researchedPrice?.max ?? null,
    },
  ]);
  const costBenefit = getCostBenefit(
    researchedPrice?.average,
    averagePricePerKg,
  );

  const normalizedName = normalize(name);
  const similarBrand =
    normalizedName.length >= 2
      ? otherBrands?.find((item) => {
          const other = normalize(item.name);
          return (
            other === normalizedName ||
            other.includes(normalizedName) ||
            normalizedName.includes(other)
          );
        })
      : undefined;

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
              {isEditing ? "Editar marca" : "Nova marca"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Preço, nota e custo-benefício vêm dos rolos — aqui só o que
              identifica a marca.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da marca</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Voolt3D"
                      autoFocus
                      maxLength={100}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Site da loja{" "}
                    <span className="text-muted-foreground">opcional</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      inputMode="url"
                      placeholder="Ex: voolt3d.com.br"
                      maxLength={255}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="purchaseChannels"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  Onde você compra
                </FormLabel>
                <FormControl>
                  <ChipGroup
                    options={PURCHASE_CHANNELS}
                    value={field.value}
                    onChange={field.onChange}
                    getLabel={(option) =>
                      PURCHASE_CHANNEL_LABELS[option as PurchaseChannel]
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="filamentTypes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tipos que ela vende
                </FormLabel>
                <FormControl>
                  <ChipGroup
                    options={FILAMENT_TYPE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferredColors"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cores preferidas{" "}
                  <span className="normal-case text-muted-foreground/70">
                    — as que você mais compra dessa marca
                  </span>
                </FormLabel>
                <FormControl>
                  <BrandColorInput
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  Situação
                </FormLabel>
                <FormControl>
                  <div className="inline-flex w-fit rounded-md border border-border p-0.5">
                    {(["PURCHASED", "RESEARCHED"] as BrandStatus[]).map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={field.value === option}
                          onClick={() => field.onChange(option)}
                          className={cn(
                            "rounded-[6px] px-3 py-1.5 text-sm transition-colors",
                            field.value === option
                              ? "bg-brand/15 text-brand"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {BRAND_STATUS_LABELS[option]}
                        </button>
                      ),
                    )}
                  </div>
                </FormControl>
                <p className="text-[12.5px] text-muted-foreground">
                  &ldquo;Só pesquisei&rdquo; mantém a marca fora dos totais de
                  gasto até o primeiro rolo.
                </p>
              </FormItem>
            )}
          />

          {status === "RESEARCHED" && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Preço pesquisado{" "}
                <span className="normal-case text-muted-foreground/70">
                  — por kg, entra na comparação de custo-benefício
                </span>
              </span>
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="researchedMinPricePerKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mínimo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="89,90"
                            className="pr-14"
                            {...field}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            R$/kg
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="researchedMaxPricePerKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máximo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="139,90"
                            className="pr-14"
                            {...field}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            R$/kg
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Média</span>
                  <span className="flex h-8 items-center text-lg font-medium text-brand">
                    {researchedPrice
                      ? `${formatBRL(researchedPrice.average)} / kg`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isEditing && (
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
                      placeholder="Frete, qualidade, linhas que valem a pena..."
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

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
            Como vai aparecer na lista
          </span>
          <BrandRowPreview
            name={name}
            status={status}
            filamentTypes={filamentTypes}
            researchedPrice={researchedPrice}
            costBenefit={costBenefit}
          />
        </section>

        {otherBrands && normalizedName.length >= 2 && (
          <p
            className={cn(
              "flex items-start gap-2 text-[12.5px]",
              similarBrand ? "text-amber-400" : "text-muted-foreground",
            )}
          >
            {similarBrand ? (
              <>
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Já existe &ldquo;{similarBrand.name}&rdquo;
                {similarBrand.archivedAt ? " (arquivada)" : ""}. Confira se não
                é a mesma marca.
              </>
            ) : (
              <>
                <CircleCheck
                  className="mt-0.5 size-3.5 shrink-0 text-brand"
                  aria-hidden="true"
                />
                Nenhuma marca cadastrada com nome parecido — pode salvar sem
                risco de duplicar.
              </>
            )}
          </p>
        )}

        {!isEditing && (
          <>
            <Separator />
            <section className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Depois de salvar
              </span>
              <div className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground/60">
                <Layers className="size-4" aria-hidden="true" />
                Cadastrar o primeiro rolo
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Com um rolo cadastrado a marca já entra na comparação de preço
                por kg.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
