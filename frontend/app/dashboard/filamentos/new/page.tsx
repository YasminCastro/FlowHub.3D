"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { FilamentForm } from "@/components/filaments/filament-form";
import { FilamentInput, createFilament } from "@/lib/api/filament";

export default function NewFilamentPage() {
  async function handleSubmit(input: FilamentInput) {
    const created = await createFilament(input);
    return created.id;
  }

  return (
    <FilamentForm
      cancelHref="/dashboard/filamentos"
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
          <span className="font-medium">Novo filamento</span>
        </>
      }
    />
  );
}
