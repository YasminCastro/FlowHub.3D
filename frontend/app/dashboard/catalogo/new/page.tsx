"use client";

import { CatalogItemForm } from "@/components/catalog/catalog-item-form";
import { createCatalogItem } from "@/lib/api/catalog";

export default function NewCatalogItemPage() {
  return (
    <CatalogItemForm
      onSubmit={async (input) => (await createCatalogItem(input)).id}
    />
  );
}
