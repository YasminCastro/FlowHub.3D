"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowLeft, Images, TriangleAlert } from "lucide-react";
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
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { ApiError } from "@/lib/api/auth";
import {
  ExtraItem,
  ExtraItemInput,
  formatUnits,
  listExtraItems,
} from "@/lib/api/extra-item";
import { formatBRL } from "@/lib/utils";

const FORM_ID = "extra-item-form";

const extraItemFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do item."),
  purchasedAt: z.string(),
  lotPrice: z
    .string()
    .trim()
    .refine(
      (value) => value !== "" && Number(value) > 0,
      "Informe o preço do lote.",
    ),
  lotQuantity: z
    .string()
    .trim()
    .refine(
      (value) => Number.isInteger(Number(value)) && Number(value) > 0,
      "Informe quantas unidades vêm no lote.",
    ),
  notes: z.string(),
});

type ExtraItemFormValues = z.infer<typeof extraItemFormSchema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDefaultValues(item?: ExtraItem | null): ExtraItemFormValues {
  return {
    name: item?.name ?? "",
    purchasedAt: today(),
    lotPrice: item ? String(item.lotPrice) : "",
    lotQuantity: item ? String(item.lotQuantity) : "",
    notes: item?.notes ?? "",
  };
}

export type ExtraItemFormProps = {
  /** Item sendo editado. Omitido/nulo = formulário de criação. */
  item?: ExtraItem | null;
  breadcrumb: ReactNode;
  cancelHref: string;
  onSubmit: (input: ExtraItemInput) => Promise<void>;
};

export function ExtraItemForm({
  item,
  breadcrumb,
  cancelHref,
  onSubmit,
}: ExtraItemFormProps) {
  const router = useRouter();
  const isEditing = !!item;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [otherItems, setOtherItems] = useState<ExtraItem[] | null>(null);

  const form = useForm<ExtraItemFormValues>({
    resolver: zodResolver(extraItemFormSchema),
    defaultValues: toDefaultValues(item),
  });

  useEffect(() => {
    listExtraItems()
      .then((items) =>
        setOtherItems(items.filter((other) => other.id !== item?.id)),
      )
      .catch(() => setOtherItems(null));
  }, [item?.id]);

  function toInput(values: ExtraItemFormValues): ExtraItemInput {
    const lotQuantity = Number(values.lotQuantity);
    return {
      name: values.name,
      lotPrice: Number(values.lotPrice),
      lotQuantity,
      notes: values.notes.trim() || null,
      purchasedAt: isEditing
        ? undefined
        : new Date(`${values.purchasedAt}T12:00:00`).toISOString(),
    };
  }

  async function submitWith(
    handler: (input: ExtraItemInput) => Promise<void>,
    values: ExtraItemFormValues,
  ) {
    setSubmitError(null);
    try {
      await handler(toInput(values));
      return true;
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o item.",
      );
      return false;
    }
  }

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
        {isSubmitting
          ? "Salvando..."
          : isEditing
            ? "Salvar alterações"
            : "Salvar item"}
      </Button>
    </div>,
  );

  const name = form.watch("name").trim();
  const lotPrice = Number(form.watch("lotPrice"));
  const lotQuantity = Number(form.watch("lotQuantity"));
  const hasLot = lotPrice > 0 && lotQuantity > 0;
  const unitCost = hasLot ? lotPrice / lotQuantity : null;

  const normalizedName = name.toLowerCase();
  const duplicate = normalizedName
    ? otherItems?.find((other) => other.name.toLowerCase() === normalizedName)
    : undefined;

  return (
    <div className="flex flex-col gap-6 p-8 lg:flex-row lg:gap-10">
      <Form {...form}>
        <form
          id={FORM_ID}
          className="flex min-w-0 flex-1 flex-col gap-6"
          onSubmit={form.handleSubmit((values) => submitWith(onSubmit, values))}
        >
          <div>
            <h1 className="text-4xl font-bold">
              {isEditing ? "Editar item extra" : "Novo item extra"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Comprado em lote, usado por unidade. O unitário é calculado.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do item</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Argola Chaveiro"
                      autoFocus
                      maxLength={100}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditing && (
              <FormField
                control={form.control}
                name="purchasedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da compra</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={today()}
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </div>

          <Separator />

          <section className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {isEditing ? "Lote mais recente" : "Lote comprado"}{" "}
              <span className="normal-case text-muted-foreground/70">
                —{" "}
                {isEditing
                  ? "corrige o último lote; recompra é pelo “Registrar novo lote”"
                  : "o unitário sai daqui"}
              </span>
            </span>
            <div className="grid grid-cols-2 items-start gap-4">
              <FormField
                control={form.control}
                name="lotPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço do lote</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="23,00"
                          className="pl-8 tabular-nums"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lotQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidades no lote</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="100"
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
                    placeholder="Medida, cor, fornecedor que valeu a pena..."
                    maxLength={2000}
                    {...field}
                  />
                </FormControl>
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

      <aside className="flex w-full flex-col gap-6 lg:w-80 lg:flex-none lg:border-l lg:pl-6">
        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Calculado
          </span>
          <div className="flex flex-col gap-2 rounded-md border border-border p-3.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Custo unitário</span>
              <span className="font-heading text-[15px] font-medium tabular-nums">
                {unitCost != null ? formatBRL(unitCost) : "—"}
              </span>
            </div>
            <Separator className="my-0.5" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasLot
                ? `${formatBRL(lotPrice)} ÷ ${lotQuantity} unidades. `
                : "Preencha o preço e as unidades do lote. "}
              Recomprar o lote atualiza o unitário e mantém o histórico.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Como vai aparecer na lista
          </span>
          <div className="flex flex-col gap-2 rounded-md border border-border px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm">
                {name || (
                  <span className="text-muted-foreground">Nome do item</span>
                )}
              </span>
              <span className="font-heading text-sm font-medium tabular-nums">
                {unitCost != null ? formatBRL(unitCost) : "—"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {hasLot
                ? `${formatBRL(lotPrice)} · ${formatUnits(lotQuantity)}`
                : "—"}
            </span>
          </div>
        </section>

        {duplicate && (
          <p className="flex items-start gap-2 text-[12.5px] text-amber-400">
            <TriangleAlert
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            Já existe &ldquo;{duplicate.name}&rdquo;. Para comprar mais, use
            &ldquo;Registrar novo lote&rdquo; no item.
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
                <Images className="size-4" aria-hidden="true" />
                Usar em uma impressão
              </div>
              <button
                type="button"
                onClick={() => router.push(cancelHref)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-brand/8 hover:text-brand"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar para itens extras
              </button>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
