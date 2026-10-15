import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { Filament, listFilaments } from "@/lib/api/filament";
import { PrintItem, listPrintItems } from "@/lib/api/print";
import { useCostContext } from "./use-cost-context";

/**
 * O que o catálogo precisa para virar preço e cores: as impressões ligadas,
 * os rolos (para as cores em estoque) e os custos.
 */
export function useCatalogData() {
  const [prints, setPrints] = useState<PrintItem[] | null>(null);
  const [filaments, setFilaments] = useState<Filament[] | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const { costs, loadError: costsError } = useCostContext();

  useEffect(() => {
    let ignore = false;
    Promise.all([listPrintItems(), listFilaments()])
      .then(([printResult, filamentResult]) => {
        if (ignore) return;
        setPrints(
          [...printResult].sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR"),
          ),
        );
        setFilaments(filamentResult);
      })
      .catch((err) => {
        if (ignore) return;
        setDataError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar as impressões e os filamentos.",
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadError = dataError ?? costsError;
  const data =
    prints && filaments && costs ? { prints, filaments, costs } : null;
  return { data, isLoading: !data && !loadError, loadError };
}
