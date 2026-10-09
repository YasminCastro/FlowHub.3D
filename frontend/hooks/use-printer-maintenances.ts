import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import {
  PrinterMaintenance,
  listPrinterMaintenances,
} from "@/lib/api/printer";

export function usePrinterMaintenances(printerId: string) {
  const [maintenances, setMaintenances] = useState<PrinterMaintenance[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadMaintenances() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await listPrinterMaintenances(printerId);
        if (!ignore) {
          setMaintenances(result.maintenances);
          setTotalCost(result.totalCost);
        }
      } catch (err) {
        if (!ignore) {
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar o histórico de manutenção.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadMaintenances();
    return () => {
      ignore = true;
    };
  }, [printerId, reloadToken]);

  return {
    maintenances,
    totalCost,
    isLoading,
    loadError,
    reload: () => setReloadToken((token) => token + 1),
  };
}
