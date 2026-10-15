import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import { JournalEntry, getJournalEntry } from "@/lib/api/journal";

export function useJournalEntry(id: string) {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadEntry() {
      setIsLoading(true);
      setLoadError(null);
      setIsNotFound(false);
      try {
        const result = await getJournalEntry(id);
        if (!ignore) setEntry(result);
      } catch (err) {
        if (!ignore) {
          setIsNotFound(isNotFoundError(err));
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar a entrada.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadEntry();
    return () => {
      ignore = true;
    };
  }, [id]);

  return { entry, setEntry, isLoading, loadError, isNotFound };
}
