"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { BrandForm } from "@/components/brands/brand-form";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { useBrand } from "@/hooks/use-brand";
import { BrandInput, updateBrand } from "@/lib/api/brand";

export default function EditBrandPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { brand, isLoading, loadError, isNotFound } = useBrand(params.id);

  async function handleSubmit(input: BrandInput) {
    if (!brand) return;
    // Na edição o formulário não envia observações: elas ficam na página da marca.
    await updateBrand(brand.id, input);
    router.push(`/dashboard/marcas/${brand.id}`);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
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

  return (
    <BrandForm
      brand={brand}
      cancelHref={`/dashboard/marcas/${brand.id}`}
      onSubmit={handleSubmit}
      breadcrumb={
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
          <Link
            href={`/dashboard/marcas/${brand.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {brand.name}
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="font-medium">Editar</span>
        </>
      }
    />
  );
}
