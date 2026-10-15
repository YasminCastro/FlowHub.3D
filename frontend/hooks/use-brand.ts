import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import { BrandWithNotes, getBrand } from "@/lib/api/brand";

export function useBrand(id: string) {
  const [brand, setBrand] = useState<BrandWithNotes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadBrand() {
      setLoadError(null);
      setIsNotFound(false);
      try {
        const result = await getBrand(id);
        if (!ignore) setBrand(result);
      } catch (err) {
        if (!ignore) {
          setIsNotFound(isNotFoundError(err));
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar a marca.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadBrand();
    return () => {
      ignore = true;
    };
  }, [id, reloadToken]);

  return {
    brand,
    setBrand,
    isLoading,
    loadError,
    isNotFound,
    reload: () => setReloadToken((token) => token + 1),
  };
}
