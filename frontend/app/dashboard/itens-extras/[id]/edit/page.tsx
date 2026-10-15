"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { ExtraItemForm } from "@/components/extra-items/extra-item-form";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { useExtraItem } from "@/hooks/use-extra-item";
import { ExtraItemInput, updateExtraItem } from "@/lib/api/extra-item";

export default function EditExtraItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { item, isLoading, loadError, isNotFound } = useExtraItem(params.id);
  const detailHref = `/dashboard/itens-extras/${params.id}`;

  async function handleSubmit(input: ExtraItemInput) {
    // A data só existe na criação: na edição não há lote novo.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { purchasedAt, ...changes } = input;
    await updateExtraItem(params.id, changes);
    router.push(detailHref);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="itens-extras" />;

  if (loadError || !item) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Item não encontrado."}
        </p>
      </div>
    );
  }

  return (
    <ExtraItemForm
      item={item}
      cancelHref={detailHref}
      onSubmit={handleSubmit}
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
          <Link
            href={detailHref}
            className="text-muted-foreground hover:text-foreground"
          >
            {item.name}
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
