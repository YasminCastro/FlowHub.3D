"use client";

import { useStoredState } from "@/hooks/use-stored-state";

/**
 * A última impressora usada num formulário salvo, para já vir escolhida no
 * próximo. `pick` devolve ela se ainda existir; senão, a primeira da lista.
 */
export function useLastPrinter() {
  const [lastPrinterId, rememberPrinter] = useStoredState<string | null>(
    "impressora:ultima",
    null,
  );

  function pick(printers: { id: string }[]) {
    return printers.some((p) => p.id === lastPrinterId)
      ? lastPrinterId!
      : (printers[0]?.id ?? "");
  }

  return { lastPrinterId, pick, rememberPrinter };
}
