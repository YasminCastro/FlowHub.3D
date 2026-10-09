"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { BrandForm } from "@/components/brands/brand-form";
import { BrandInput, createBrand } from "@/lib/api/brand";

export default function NewBrandPage() {
  const router = useRouter();

  async function handleSubmit(input: BrandInput) {
    const created = await createBrand(input);
    router.push(`/dashboard/marcas/${created.id}`);
  }

  return (
    <BrandForm
      cancelHref="/dashboard/marcas"
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
          <span className="font-medium">Nova marca</span>
        </>
      }
    />
  );
}
