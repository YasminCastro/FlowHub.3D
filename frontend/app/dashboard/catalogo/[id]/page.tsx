"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  ImageIcon,
  LinkIcon,
  ListOrdered,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { LOW_STOCK_COLOR } from "@/components/catalog/catalog-card";
import { CatalogDeleteDialog } from "@/components/catalog/catalog-delete-dialog";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  PhotoPlaceholder,
  SectionLabel,
  Stat,
  StatDivider,
} from "@/components/prints/print-bits";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useCatalogData } from "@/hooks/use-catalog-data";
import { useCatalogItem } from "@/hooks/use-catalog-item";
import {
  ResolvedVariant,
  describeKind,
  getKitCalculated,
  lowColorWarning,
  resolveCatalogItem,
} from "@/lib/api/catalog";
import { formatDecimal, formatGrams } from "@/lib/api/print";
import { cn, formatBRL } from "@/lib/utils";

function queueHref(variant: ResolvedVariant) {
  return `/dashboard/fila/new?impressao=${variant.printItemId}`;
}

function formatWholeBRL(value: number) {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

export default function CatalogItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    item,
    isLoading: isLoadingItem,
    loadError: itemError,
  } = useCatalogItem(params.id);
  const {
    data,
    isLoading: isLoadingData,
    loadError: dataError,
  } = useCatalogData();
  const isLoading = isLoadingItem || isLoadingData;
  const loadError = itemError ?? dataError;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  const resolved =
    item && data
      ? resolveCatalogItem(item, data.prints, data.filaments, data.costs)
      : null;
  const queueable = resolved?.variants.filter((v) => v.print) ?? [];

  usePageHeaderBreadcrumb(
    item ? (
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
        <span className="max-w-80 truncate font-medium">{item.name}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    item ? (
      <>
        {queueable.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="secondary" size="sm">
                  <ListOrdered />
                  Adicionar à fila
                  <ChevronDown />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {item.kind === "SIZES" ? "Qual tamanho" : "Qual peça"}
                </DropdownMenuLabel>
                {queueable.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => router.push(queueHref(v))}
                  >
                    {item.kind === "SIZES" && (
                      <span className="w-6 font-heading font-medium">
                        {v.label}
                      </span>
                    )}
                    <span className="truncate">{v.print?.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          queueable[0] && (
            <Button
              variant="secondary"
              size="sm"
              render={<Link href={queueHref(queueable[0])} />}
              nativeButton={false}
            >
              <ListOrdered />
              Adicionar à fila
            </Button>
          )
        )}
        <Button
          size="sm"
          render={<Link href={`/dashboard/catalogo/${item.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
          Excluir
        </Button>
      </>
    ) : null,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-75 w-full" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !item || !resolved || !data) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Item do catálogo não encontrado."}
        </p>
      </div>
    );
  }

  const kindTag = describeKind(resolved);
  const photos = resolved.photos.length
    ? resolved.photos
    : resolved.availablePhotos;
  const mainPhoto = photos[activePhoto] ?? photos[0];
  const margin = formatDecimal(data.costs.settings.defaultMarginPercent);
  const isSizes = item.kind === "SIZES";
  const isKit = item.kind === "KIT";
  const kitCalculated = getKitCalculated(resolved.variants);

  const priceStats = isSizes
    ? resolved.variants.map((v) => ({
        label: v.label,
        value: v.price == null ? "–" : formatWholeBRL(v.price),
      }))
    : [
        {
          label: isKit ? "Preço do kit" : "Preço",
          value: resolved.priceMin == null ? "–" : formatBRL(resolved.priceMin),
        },
      ];

  const rowGrid = isSizes
    ? "grid-cols-[48px_minmax(0,1.4fr)_70px_84px_92px_110px]"
    : isKit
      ? "grid-cols-[minmax(0,1.4fr)_70px_84px_92px]"
      : "grid-cols-[minmax(0,1.4fr)_70px_84px_92px_110px]";

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainPhoto.src}
              alt={item.name}
              className="h-75 w-full rounded-md object-cover"
            />
          ) : (
            <PhotoPlaceholder className="h-75 flex-col gap-1.5 rounded-md">
              <ImageIcon className="size-7" aria-hidden="true" />
              <span className="text-[11.5px]">
                Sem fotos. Elas vêm dos registros das impressões ligadas.
              </span>
            </PhotoPlaceholder>
          )}
          {photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.slice(0, 4).map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={`Ver foto ${index + 1}`}
                  onClick={() => setActivePhoto(index)}
                  className={cn(
                    "h-15 overflow-hidden rounded-sm",
                    index === activePhoto &&
                      "shadow-[inset_0_0_0_1px_var(--brand)]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6.5">
          <div className="flex flex-col gap-2">
            {(item.category || kindTag) && (
              <div className="flex flex-wrap items-center gap-2">
                {item.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5 text-[11px] text-foreground/80">
                    {item.category.color && (
                      <span
                        className="size-2 rounded-[2px]"
                        style={{ background: item.category.color }}
                      />
                    )}
                    {item.category.name}
                  </span>
                )}
                {kindTag && (
                  <span className="rounded-sm bg-foreground/8 px-2 py-0.5 text-[11px] text-foreground/80">
                    {kindTag}
                  </span>
                )}
              </div>
            )}
            <h1 className="text-4xl leading-tight font-bold">{item.name}</h1>
            {item.description && (
              <p className="max-w-[60ch] text-[13px] text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-stretch gap-6.5">
            {priceStats.map((stat) => (
              <div key={stat.label} className="flex items-stretch gap-6.5">
                <Stat label={stat.label} value={stat.value} />
                <StatDivider />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Margem</SectionLabel>
              <span className="font-heading text-[28px] leading-none font-medium tracking-[-0.02em] text-foreground/70 tabular-nums">
                {margin}%
              </span>
            </div>
          </div>

          <section className="flex flex-col">
            <h2 className="mb-1.5 font-heading text-[17px] font-medium">
              {isSizes ? "Tamanhos" : isKit ? "Peças" : "Impressão"}
            </h2>
            <div className="overflow-x-auto">
              <div className="min-w-140">
                <div
                  className={cn(
                    "grid gap-3 border-b border-border/60 py-2",
                    rowGrid,
                  )}
                >
                  {isSizes && <SectionLabel>Tam.</SectionLabel>}
                  <SectionLabel>Impressão ligada</SectionLabel>
                  <SectionLabel>Gramas</SectionLabel>
                  <SectionLabel className="text-right">Custo</SectionLabel>
                  <SectionLabel className="text-right">Calculado</SectionLabel>
                  {!isKit && (
                    <SectionLabel className="text-right">Preço</SectionLabel>
                  )}
                </div>
                {resolved.variants.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "grid items-center gap-3 border-b border-border/60 py-2.75",
                      rowGrid,
                    )}
                  >
                    {isSizes && (
                      <span className="font-heading text-sm font-medium">
                        {v.label}
                      </span>
                    )}
                    {v.print ? (
                      <Link
                        href={`/dashboard/impressoes/${v.print.id}`}
                        className="flex min-w-0 items-center gap-1.75 text-[13px] text-brand-300 hover:underline"
                      >
                        <LinkIcon
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{v.print.name}</span>
                      </Link>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">
                        Impressão excluída
                      </span>
                    )}
                    <span className="text-[12.5px] text-foreground/70 tabular-nums">
                      {v.grams != null ? formatGrams(v.grams) : "–"}
                    </span>
                    <span className="text-right text-[12.5px] text-foreground/70 tabular-nums">
                      {v.cost != null ? formatBRL(v.cost) : "–"}
                    </span>
                    <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">
                      {v.calculated != null ? formatBRL(v.calculated) : "–"}
                    </span>
                    {!isKit && (
                      <span className="text-right">
                        <span className="font-heading text-sm font-medium tabular-nums">
                          {v.price != null ? formatBRL(v.price) : "–"}
                        </span>
                        {v.priceOverride != null && (
                          <span className="block text-[10.5px] text-muted-foreground/80">
                            manual
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ))}
                {isKit && (
                  <div
                    className={cn("grid items-baseline gap-3 py-2.75", rowGrid)}
                  >
                    <span className="col-span-3 text-[13px]">
                      Preço do kit
                      {item.kitPrice != null && (
                        <span className="ml-2 text-[10.5px] text-muted-foreground/80">
                          manual · calculado{" "}
                          {kitCalculated != null
                            ? formatBRL(kitCalculated)
                            : "–"}
                        </span>
                      )}
                    </span>
                    <span className="text-right font-heading text-sm font-medium tabular-nums">
                      {resolved.priceMin != null
                        ? formatBRL(resolved.priceMin)
                        : "–"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <p className="pt-2.25 text-[11.5px] text-muted-foreground/80">
              O custo vem do registro padrão de cada impressão. Se o padrão
              mudar, o calculado atualiza; o preço manual fica.
            </p>
          </section>

          <section className="flex flex-col">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-2.5">
              <h2 className="font-heading text-[17px] font-medium">
                Cores disponíveis
              </h2>
              {resolved.materials.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  rolos de {resolved.materials.join(" e ")} em estoque
                </span>
              )}
            </div>
            {resolved.colors.length ? (
              resolved.colors.map((color) => {
                const warning = lowColorWarning(resolved, color);
                return (
                  <div
                    key={color.filament.id}
                    className="grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3 py-2.25"
                  >
                    <FilamentDot
                      colors={color.filament.colors}
                      className="size-3"
                    />
                    <span className="truncate text-[13px]">
                      {color.filament.type} {color.filament.colorName} ·{" "}
                      {color.filament.brand.name}
                    </span>
                    {warning ? (
                      <span
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: LOW_STOCK_COLOR }}
                      >
                        <TriangleAlert
                          className="size-3.25 shrink-0"
                          aria-hidden="true"
                        />
                        {warning}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Cheio
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="py-2 text-[12.5px] text-muted-foreground">
                {resolved.materials.length
                  ? "Nenhum rolo desse material em estoque."
                  : "As impressões ligadas ainda não têm filamento no registro padrão."}
              </p>
            )}
            {resolved.finished.length > 0 && (
              <div className="flex items-center gap-2 pt-2.25 text-[11.5px] text-muted-foreground/80">
                <EyeOff className="size-3.25 shrink-0" aria-hidden="true" />
                {resolved.finished
                  .map((f) => `${f.type} ${f.colorName}`)
                  .join(", ")}{" "}
                {resolved.finished.length === 1
                  ? "acabou e saiu da lista"
                  : "acabaram e saíram da lista"}
                . Volta quando você marcar um rolo novo.
              </div>
            )}
          </section>
        </div>
      </div>

      <CatalogDeleteDialog
        item={item}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/catalogo")}
      />
    </div>
  );
}
