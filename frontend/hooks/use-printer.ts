import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import { Printer, getPrinter } from "@/lib/api/printer";

export function usePrinter(id: string) {
  const [printer, setPrinter] = useState<Printer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadPrinter() {
      setIsLoading(true);
      setLoadError(null);
      setIsNotFound(false);
      try {
        const result = await getPrinter(id);
        if (!ignore) setPrinter(result);
      } catch (err) {
        if (!ignore) {
          setIsNotFound(isNotFoundError(err));
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar a impressora.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadPrinter();
    return () => {
      ignore = true;
    };
  }, [id, reloadToken]);

  return {
    printer,
    isLoading,
    loadError,
    isNotFound,
    reload: () => setReloadToken((token) => token + 1),
  };
}
