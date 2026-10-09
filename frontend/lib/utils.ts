import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function formatDatePtBR(iso: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("pt-BR", options ?? {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
