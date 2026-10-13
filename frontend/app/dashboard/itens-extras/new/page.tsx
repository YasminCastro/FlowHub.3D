"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { ExtraItemForm } from "@/components/extra-items/extra-item-form";
import { ExtraItemInput, createExtraItem } from "@/lib/api/extra-item";

export default function NewExtraItemPage() {
  const router = useRouter();

  async function handleSubmit(input: ExtraItemInput) {
    const created = await createExtraItem(input);
    router.push(`/dashboard/itens-extras/${created.id}`);
  }

  async function handleSubmitAndContinue(input: ExtraItemInput) {
    await createExtraItem(input);
  }

  return (
    <ExtraItemForm
      cancelHref="/dashboard/itens-extras"
      onSubmit={handleSubmit}
      onSubmitAndContinue={handleSubmitAndContinue}
      breadcrumb={
        <>
          <Link
            href="/dashboard/itens-extras"
            className="text-muted-foreground hover:text-foreground"
          >
            Itens extras
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="font-medium">Novo item</span>
        </>
      }
    />
  );
}
