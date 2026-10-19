"use client";

import { SetStateAction, useCallback, useMemo, useSyncExternalStore } from "react";

// Estado de tela que sobrevive a atualizar a página (filtros, ordenação).
// Guarda no localStorage deste navegador; se ele não estiver disponível (aba
// anônima com armazenamento bloqueado), fica só em memória até recarregar.

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, raw: string) {
  memory.set(key, raw);
  try {
    localStorage.setItem(key, raw);
  } catch {
    // Sem localStorage: a cópia em memória basta.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Outra aba mudou o mesmo filtro.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse<T>(raw: string | null, initial: T) {
  if (raw == null) return initial;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

/**
 * Como useState, mas lembrado entre recarregamentos. No servidor (e no
 * primeiro render da hidratação) vale o `initial`; o salvo entra logo depois.
 */
export function useStoredState<T>(key: string, initial: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  // `initial` costuma ser literal: fica fora das dependências de propósito.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => parse(raw, initial), [raw]);

  const setValue = useCallback(
    (action: SetStateAction<T>) => {
      const current = parse(read(key), initial);
      const next =
        typeof action === "function"
          ? (action as (prev: T) => T)(current)
          : action;
      write(key, JSON.stringify(next));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, setValue] as const;
}
