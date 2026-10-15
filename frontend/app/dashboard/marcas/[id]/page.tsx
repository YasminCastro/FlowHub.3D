"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  ExternalLink,
  Layers,
  Package,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandDeleteDialog } from "@/components/brands/brand-delete-dialog";
import { BrandNotes } from "@/components/brands/brand-notes";
import {
  BrandStatusBadge,
  FilamentTypeTags,
  formatFilamentCount,
} from "@/components/brands/brand-row-preview";
import { FilamentCard } from "@/components/filaments/filament-card";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import {
  usePageHeaderAction,
  usePageHeaderBreadcrumb,
} from "@/contexts/page-header-action-context";
import { useBrand } from "@/hooks/use-brand";
import { ApiError } from "@/lib/api/auth";
import {
  Brand,
  BrandPrice,
  COST_BENEFIT_LABELS,
  BrandUpdateInput,
  CostBenefit,
  PURCHASE_CHANNEL_LABELS,
  brandWebsiteHref,
  formatResearchedRange,
  getAveragePricePerKg,
  getBrandPrice,
  getCostBenefit,
  listBrands,
  updateBrand,
} from "@/lib/api/brand";
import { Filament, formatRating, listFilaments } from "@/lib/api/filament";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

// Preço, nota e compras saem dos filamentos da marca. Sem nenhum, uma marca
// "Só pesquisei" mostra a faixa de preço da pesquisa.
const COST_BENEFIT_TEXT_STYLES: Record<CostBenefit, string> = {
  GOOD: "text-emerald-400",
  MODERATE: "text-amber-400",
  HIGH: "text-destructive",
};

// "14% acima da média de R$ 114,00"; perto de zero vira "na média".
function describeDistanceFromAverage(price: number, average: number) {
  const percent = Math.round(((price - average) / average) * 100);
  const reference = `da média de ${formatBRL(average)}`;
  if (percent === 0) return `na média de ${formatBRL(average)}`;
  return `${Math.abs(percent)}% ${percent < 0 ? "abaixo" : "acima"} ${reference}`;
}

function buildCostBenefitStat(
  price: BrandPrice | null,
  costBenefit: CostBenefit | null,
  averagePricePerKg: number | null,
) {
  const label = "Custo-benefício";
  if (!price) {
    return { label, value: "—", caption: "sem preço cadastrado" };
  }
  if (!costBenefit || averagePricePerKg == null) {
    return {
      label,
      value: "—",
      caption: "precisa de outra marca com preço",
    };
  }
  return {
    label,
    value: COST_BENEFIT_LABELS[costBenefit],
    valueClassName: COST_BENEFIT_TEXT_STYLES[costBenefit],
    caption: describeDistanceFromAverage(
      price.average,
      averagePricePerKg,
    ),
  };
}

function buildPurchaseStats(
  price: BrandPrice | null,
  costBenefit: CostBenefit | null,
  averagePricePerKg: number | null,
  brandFilaments: Filament[],
): {
  label: string;
  value: string;
  caption?: string;
  valueClassName?: string;
}[] {
  const fromFilaments = price?.source === "filaments";
  const purchaseCount = brandFilaments.reduce(
    (sum, filament) => sum + filament.purchaseCount,
    0,
  );
  const ratings = brandFilaments
    .map((filament) => filament.rating)
    .filter((rating): rating is number => rating != null);
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null;
  const lastPurchase = brandFilaments
    .map((filament) => filament.lastPurchasedAt)
    .filter((date): date is string => date != null)
    .sort()
    .at(-1);

  return [
    price
      ? {
          label: "Preço por kg",
          value: formatBRL(price.average),
          caption: fromFilaments
            ? `média de ${formatFilamentCount(price.filamentCount)}`
            : "média da pesquisa",
        }
      : { label: "Preço por kg", value: "—", caption: "sem rolo cadastrado" },
    buildCostBenefitStat(price, costBenefit, averagePricePerKg),
    price
      ? {
          label: fromFilaments ? "Faixa por kg" : "Faixa pesquisada",
          value: formatResearchedRange(price),
          caption: fromFilaments ? "R$ por kg, entre as compras" : "R$ por kg",
        }
      : { label: "Faixa por kg", value: "—" },
    { label: "Rolos comprados", value: String(purchaseCount) },
    averageRating != null
      ? {
          label: "Nota média",
          value: formatRating(averageRating),
          caption: `${ratings.length} ${ratings.length === 1 ? "avaliação" : "avaliações"}`,
        }
      : { label: "Nota média", value: "—", caption: "sem uso" },
    lastPurchase
      ? { label: "Última compra", value: formatDatePtBR(lastPurchase) }
      : { label: "Última compra", value: "—" },
  ];
}

export default function BrandDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { brand, setBrand, isLoading, loadError, isNotFound } = useBrand(params.id);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeBrands, setActiveBrands] = useState<Brand[] | null>(null);
  const [filaments, setFilaments] = useState<Filament[]>([]);

  // O custo é relativo à média das marcas ativas, então precisa da lista; o
  // preço de cada uma sai dos filamentos cadastrados.
  useEffect(() => {
    let ignore = false;
    Promise.all([listBrands(), listFilaments()])
      .then(([brands, allFilaments]) => {
        if (ignore) return;
        setActiveBrands(brands);
        setFilaments(allFilaments);
      })
      .catch(() => {
        if (!ignore) setActiveBrands(null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function applyUpdate(input: BrandUpdateInput) {
    if (!brand) return;
    setIsUpdating(true);
    setActionError(null);
    try {
      setBrand(await updateBrand(brand.id, input));
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar a marca.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  usePageHeaderBreadcrumb(
    brand ? (
      <>
        <Link
          href="/dashboard/marcas"
          className="text-muted-foreground hover:text-foreground"
        >
          Marcas
        </Link>
        <ChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="font-medium">{brand.name}</span>
      </>
    ) : null,
  );

  usePageHeaderAction(
    brand ? (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/dashboard/marcas/${brand.id}/edit`} />}
          nativeButton={false}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isUpdating}
          onClick={() => applyUpdate({ archived: !brand.archivedAt })}
        >
          {brand.archivedAt ? <ArchiveRestore /> : <Archive />}
          {brand.archivedAt ? "Desarquivar" : "Arquivar"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 />
          Excluir
        </Button>
      </div>
    ) : null,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="marcas" />;

  if (loadError || !brand) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Marca não encontrada."}
        </p>
      </div>
    );
  }

  const brandFilaments = filaments.filter(
    (filament) => filament.brandId === brand.id,
  );
  const price = getBrandPrice(brand, filaments);
  // A versão da marca carregada aqui é a mais nova (pode ter acabado de ser
  // editada), então ela substitui a da lista no cálculo da média.
  const averagePricePerKg = activeBrands
    ? getAveragePricePerKg(
        [
          ...activeBrands.filter((item) => item.id !== brand.id),
          ...(brand.archivedAt ? [] : [brand]),
        ].map((item) => getBrandPrice(item, filaments)?.average),
      )
    : null;
  const costBenefit = getCostBenefit(price?.average, averagePricePerKg);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {brand.archivedAt && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
            Arquivada em {formatDatePtBR(brand.archivedAt)}. Ela não aparece
            na lista de marcas, mas o histórico continua aqui.
          </p>
        )}

        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Package className="size-7" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-medium leading-none">
                {brand.name}
              </h1>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  brand.isFavorite
                    ? "Remover das favoritas"
                    : "Marcar como favorita"
                }
                aria-pressed={brand.isFavorite}
                disabled={isUpdating}
                onClick={() => applyUpdate({ isFavorite: !brand.isFavorite })}
              >
                <Star
                  className={cn(
                    brand.isFavorite && "fill-amber-400 text-amber-400",
                  )}
                />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Marca de filamento</span>
              <BrandStatusBadge status={brand.status} />
              {brand.website && (
                <a
                  href={brandWebsiteHref(brand.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-brand-300 hover:underline"
                >
                  Abrir loja
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {actionError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-6">
          {buildPurchaseStats(
            price,
            costBenefit,
            averagePricePerKg,
            brandFilaments,
          ).map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <span className={cn("text-2xl font-medium", stat.valueClassName)}>
                {stat.value}
              </span>
              {stat.caption && (
                <span className="text-xs text-muted-foreground">
                  {stat.caption}
                </span>
              )}
            </div>
          ))}
        </div>

        <Separator />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Filamentos desta marca
            </span>
            <span className="text-xs text-muted-foreground">
              {formatFilamentCount(brandFilaments.length)}
            </span>
          </div>
          {brandFilaments.length ? (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {brandFilaments.map((filament) => (
                <FilamentCard
                  key={filament.id}
                  filament={filament}
                  href={`/dashboard/filamentos/${filament.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-10 text-center text-muted-foreground">
              <Layers className="size-6" aria-hidden="true" />
              <p className="text-sm">Nenhum rolo cadastrado desta marca.</p>
              <p className="max-w-sm text-[12.5px]">
                Quando você cadastrar filamentos, cor, preço do rolo, preço
                por kg e quanto sobrou aparecem aqui.
              </p>
            </div>
          )}
        </section>
      </div>

      <aside className="flex w-full flex-col gap-6 lg:w-80 lg:flex-none lg:border-l lg:pl-6">
        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Onde compra
          </span>
          {brand.purchaseChannels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {brand.purchaseChannels.map((channel) => (
                <span
                  key={channel}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  {PURCHASE_CHANNEL_LABELS[channel]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Nenhum canal informado.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Tipos que vende
          </span>
          <FilamentTypeTags types={brand.filamentTypes} />
        </section>

        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Cores preferidas
          </span>
          {brand.preferredColors.length ? (
            <div className="flex flex-wrap gap-1.5">
              {brand.preferredColors.map((color) => (
                <span
                  key={color}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  {color}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Nenhuma cor preferida.{" "}
              <Link
                href={`/dashboard/marcas/${brand.id}/edit`}
                className="text-brand-300 hover:underline"
              >
                Adicionar
              </Link>
            </p>
          )}
        </section>

        <Separator />

        <BrandNotes
          brandId={brand.id}
          notes={brand.notes}
          onChange={(notes) => setBrand({ ...brand, notes })}
        />
      </aside>

      <BrandDeleteDialog
        brandId={brand.id}
        brandName={brand.name}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/marcas")}
        onArchiveInstead={
          brand.archivedAt
            ? undefined
            : () => {
                setIsDeleteDialogOpen(false);
                applyUpdate({ archived: true });
              }
        }
      />
    </div>
  );
}
