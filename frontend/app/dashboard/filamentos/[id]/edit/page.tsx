"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { FilamentForm } from "@/components/filaments/filament-form";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { useFilament } from "@/hooks/use-filament";
import { FilamentInput, updateFilament } from "@/lib/api/filament";

export default function EditFilamentPage() {
  const params = useParams<{ id: string }>();
  const { filament, isLoading, loadError, isNotFound } = useFilament(params.id);

  async function handleSubmit(input: FilamentInput) {
    // Observações só entram na criação; na edição ficam no detalhe.
    const data: Partial<FilamentInput> = { ...input };
    delete data.notes;
    const updated = await updateFilament(params.id, data);
    return updated.id;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="filamentos" />;

  if (loadError || !filament) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Filamento não encontrado."}
        </p>
      </div>
    );
  }

  return (
    <FilamentForm
      filament={filament}
      cancelHref={`/dashboard/filamentos/${filament.id}`}
      onSubmit={handleSubmit}
      breadcrumb={
        <>
          <Link
            href="/dashboard/filamentos"
            className="text-muted-foreground hover:text-foreground"
          >
            Filamentos
          </Link>
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Link
            href={`/dashboard/filamentos/${filament.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {filament.colorName}
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
