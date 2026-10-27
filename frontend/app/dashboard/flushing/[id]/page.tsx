"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundState } from "@/components/dashboard/not-found-state";
import { flushPairName } from "@/components/flushing/flush-pair-card";
import { FlushPairDeleteDialog } from "@/components/flushing/flush-pair-delete-dialog";
import { FlushPairForm } from "@/components/flushing/flush-pair-form";
import { usePageHeaderBreadcrumb } from "@/contexts/page-header-action-context";
import { isNotFoundError } from "@/lib/api/client";
import {
  FlushPair,
  FlushPairInput,
  getFlushPair,
  updateFlushPair,
} from "@/lib/api/flushing";

// Abrir o card mostra a tabela do par já pronta para editar.
export default function FlushPairPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pair, setPair] = useState<FlushPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    getFlushPair(params.id)
      .then((result) => {
        if (!ignore) setPair(result);
      })
      .catch((err) => {
        if (ignore) return;
        if (isNotFoundError(err)) setIsNotFound(true);
        else
          setLoadError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar o registro.",
          );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [params.id]);

  usePageHeaderBreadcrumb(
    pair ? (
      <>
        <Link
          href="/dashboard/flushing"
          className="text-muted-foreground hover:text-foreground"
        >
          Flushing
        </Link>
        <ChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate font-medium">{flushPairName(pair)}</span>
      </>
    ) : null,
  );

  async function handleSubmit(input: FlushPairInput) {
    setPair(await updateFlushPair(params.id, input));
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isNotFound) return <NotFoundState resource="flushing" />;

  if (loadError || !pair) {
    return (
      <div className="p-8">
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError ?? "Registro não encontrado."}
        </p>
      </div>
    );
  }

  return (
    <>
      <FlushPairForm
        pair={pair}
        onSubmit={handleSubmit}
        onDelete={() => setIsDeleteDialogOpen(true)}
      />
      <FlushPairDeleteDialog
        pairId={pair.id}
        pairName={flushPairName(pair)}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={() => router.push("/dashboard/flushing")}
      />
    </>
  );
}
