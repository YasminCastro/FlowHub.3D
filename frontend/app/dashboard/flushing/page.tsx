"use client";

import Link from "next/link";
import { Blend, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CalLabel } from "@/components/calibrations/calibration-bits";
import {
  FLUSH_MATRIX_MAX_COLORS,
  FlushMatrix,
  matrixFilaments,
} from "@/components/flushing/flush-matrix";
import {
  FlushPairCard,
  flushPairName,
} from "@/components/flushing/flush-pair-card";
import { usePageHeaderAction } from "@/contexts/page-header-action-context";
import { useStoredState } from "@/hooks/use-stored-state";
import { ApiError } from "@/lib/api/auth";
import { SLICER_LABELS } from "@/lib/api/calibration";
import { FlushPair, listFlushPairs } from "@/lib/api/flushing";

// A tabela só junta pares da mesma impressora e fatiador.
const sameSetup = (x: FlushPair, y: FlushPair) =>
  x.printerId === y.printerId && x.slicer === y.slicer;

export default function FlushingPage() {
  const [pairs, setPairs] = useState<FlushPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Os pares marcados para a tabela de cores, lembrados entre visitas.
  const [selectedIds, setSelectedIds] = useStoredState<string[]>(
    "flushing:tabela",
    [],
  );
  // A ordem das cores na tabela, para bater com os slots do fatiador.
  const [colorOrder, setColorOrder] = useStoredState<string[]>(
    "flushing:ordem",
    [],
  );

  useEffect(() => {
    let ignore = false;
    listFlushPairs()
      .then((result) => {
        if (!ignore) setPairs(result);
      })
      .catch((err) => {
        if (ignore) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os registros de flushing.",
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  usePageHeaderAction(
    <Button
      size="sm"
      render={<Link href="/dashboard/flushing/new" />}
      nativeButton={false}
    >
      <Plus />
      Novo flushing
    </Button>,
  );

  const query = search.trim().toLowerCase();
  const visiblePairs = pairs
    .filter((pair) => flushPairName(pair).toLowerCase().includes(query))
    .sort((x, y) => flushPairName(x).localeCompare(flushPairName(y), "pt-BR"));

  // Par apagado sai da seleção sozinho.
  const selected = selectedIds.flatMap((id) => {
    const pair = pairs.find((p) => p.id === id);
    return pair ? [pair] : [];
  });
  const selectedColors = matrixFilaments(selected);
  const setup = selected[0];

  function selectDisabledReason(pair: FlushPair) {
    if (setup && !sameSetup(setup, pair)) {
      return `A tabela está montada para ${SLICER_LABELS[setup.slicer]} · ${setup.printer.name}.`;
    }
    const colors = matrixFilaments([...selected, pair]);
    if (colors.length > FLUSH_MATRIX_MAX_COLORS) {
      return `A tabela vai até ${FLUSH_MATRIX_MAX_COLORS} cores.`;
    }
    return null;
  }

  function toggleSelected(pair: FlushPair, checked: boolean) {
    setSelectedIds((prev) =>
      checked
        ? [...prev.filter((id) => id !== pair.id), pair.id]
        : prev.filter((id) => id !== pair.id),
    );
  }

  function renderMatrix() {
    if (isLoading || loadError || pairs.length === 0) return null;
    return (
      <section className="flex flex-col gap-3.5 rounded-md bg-[#1a1c29] px-4.5 py-4 shadow-[inset_0_0_0_1px_var(--border)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <CalLabel>Tabela de cores</CalLabel>
          <span className="text-xs text-foreground/55">
            {setup
              ? `${selectedColors.length} de ${FLUSH_MATRIX_MAX_COLORS} cores · ${SLICER_LABELS[setup.slicer]} · ${setup.printer.name}`
              : `Marque os cards para montar a tabela do fatiador com até ${FLUSH_MATRIX_MAX_COLORS} cores.`}
          </span>
          {setup && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectedIds([])}
            >
              <X />
              Limpar
            </Button>
          )}
        </div>
        {setup && (
          <FlushMatrix
            selected={selected}
            pairs={pairs.filter((p) => sameSetup(p, setup))}
            order={colorOrder}
            onOrderChange={setColorOrder}
          />
        )}
      </section>
    );
  }

  function renderContent() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      );
    }

    if (loadError) {
      return (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      );
    }

    if (pairs.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <Blend className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhum flushing cadastrado ainda.</p>
          <Button
            size="sm"
            render={<Link href="/dashboard/flushing/new" />}
            nativeButton={false}
          >
            <Plus />
            Novo flushing
          </Button>
        </div>
      );
    }

    if (visiblePairs.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhum flushing com essa cor.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visiblePairs.map((pair) => (
          <FlushPairCard
            key={pair.id}
            pair={pair}
            selected={selectedIds.includes(pair.id)}
            onSelectedChange={(checked) => toggleSelected(pair, checked)}
            selectDisabledReason={selectDisabledReason(pair)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold">Flushing</h1>
          <p className="text-sm text-muted-foreground">
            O volume purgado na troca entre dois filamentos, nas duas direções.
          </p>
        </div>

        {pairs.length > 0 && (
          <div className="relative ml-auto">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por cor…"
              aria-label="Filtrar flushing pelo nome da cor"
              className="w-56 pl-8"
            />
          </div>
        )}
      </div>

      {renderMatrix()}
      {renderContent()}
    </div>
  );
}
