"use client";

import { useSearchParams } from "next/navigation";

import { CatalogItemForm } from "@/components/catalog/catalog-item-form";
import { createCatalogItem } from "@/lib/api/catalog";

export default function NewCatalogItemPage() {
  // Vindo de uma impressão (?impressao=id): o item já começa ligado a ela.
  const fromPrintId = useSearchParams().get("impressao");
  return (
    <CatalogItemForm
      fromPrintId={fromPrintId}
      onSubmit={async (input) => (await createCatalogItem(input)).id}
    />
  );
}
