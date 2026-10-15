"use client";

import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { CatalogItemForm } from "@/components/catalog/catalog-item-form";
import { useCatalogItem } from "@/hooks/use-catalog-item";
import { updateCatalogItem } from "@/lib/api/catalog";

export default function EditCatalogItemPage() {
  const params = useParams<{ id: string }>();
  const { item, isLoading, loadError } = useCatalogItem(params.id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Item do catálogo não encontrado."}
        </p>
      </div>
    );
  }

  return (
    <CatalogItemForm
      item={item}
      onSubmit={async (input) => (await updateCatalogItem(item.id, input)).id}
    />
  );
}
