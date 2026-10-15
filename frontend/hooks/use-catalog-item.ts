import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import { CatalogItem, getCatalogItem } from "@/lib/api/catalog";

export function useCatalogItem(id: string) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadItem() {
      setIsLoading(true);
      setLoadError(null);
      setIsNotFound(false);
      try {
        const result = await getCatalogItem(id);
        if (!ignore) setItem(result);
      } catch (err) {
        if (!ignore) {
          setIsNotFound(isNotFoundError(err));
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar o item.",
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

  return { item, isLoading, loadError, isNotFound };
}
