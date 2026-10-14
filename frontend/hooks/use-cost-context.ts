import { useEffect, useState } from "react";

import { getCostSettings } from "@/lib/api/cost-settings";
import { CostContext } from "@/lib/api/print";
import { listPrinters } from "@/lib/api/printer";

/** Custos e energia + impressoras, para calcular o custo das impressões. */
export function useCostContext() {
  const [costs, setCosts] = useState<CostContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getCostSettings(), listPrinters()])
      .then(([settings, printers]) => {
        if (!ignore) setCosts({ settings, printers });
      })
      .catch(() => {
        if (!ignore) {
          setLoadError("Não foi possível carregar os custos e as impressoras.");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  return { costs, loadError };
}
