import { useEffect, useState } from "react";

import { PrintItem, getPrintItem } from "@/lib/api/print";

export function usePrintItem(id: string) {
  const [item, setItem] = useState<PrintItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadItem() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await getPrintItem(id);
        if (!ignore) setItem(result);
      } catch (err) {
        if (!ignore) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar a impressão.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadItem();
    return () => {
      ignore = true;
    };
  }, [id]);

  return { item, setItem, isLoading, loadError };
}
