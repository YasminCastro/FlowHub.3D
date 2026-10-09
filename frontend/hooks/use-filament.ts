import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { FilamentWithDetails, getFilament } from "@/lib/api/filament";

export function useFilament(id: string) {
  const [filament, setFilament] = useState<FilamentWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadFilament() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await getFilament(id);
        if (!ignore) setFilament(result);
      } catch (err) {
        if (!ignore) {
          setLoadError(
            err instanceof ApiError || err instanceof Error
              ? err.message
              : "Não foi possível carregar o filamento.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadFilament();
    return () => {
      ignore = true;
    };
  }, [id]);

  return { filament, setFilament, isLoading, loadError };
}
