"use client";

import { Check, Copy, Link2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/auth";
import {
  disableShareLink,
  getShareLink,
  regenerateShareLink,
  shareLinkUrl,
} from "@/lib/api/print-queue";

/**
 * Link público da fila: quem tem o link vê a fila e pede impressões sem
 * login, e o pedido entra no fim da fila marcado "via link".
 */
export function QueueShareLink() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getShareLink()
      .then((found) => {
        if (!ignore) setToken(found);
      })
      .catch(() => {
        if (!ignore) setError("Não foi possível carregar o link de pedidos.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function run(action: () => Promise<string | null>) {
    setIsBusy(true);
    setError(null);
    setCopied(false);
    try {
      setToken(await action());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atualizar o link.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Selecione o link e copie à mão.");
    }
  }

  if (isLoading) return null;

  const url = token ? shareLinkUrl(token) : null;

  return (
    <section className="flex flex-col gap-2.5 rounded-md px-3.75 py-3.5 shadow-[inset_0_0_0_1px_var(--neutral-700)]">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="flex items-center gap-2 text-[13.5px]">
          <Link2 className="size-3.75 text-brand" aria-hidden="true" />
          Link de pedidos
        </span>
        <span className="text-xs text-muted-foreground">
          {url
            ? "Quem tiver o link vê a fila com tempo, gramas, custo do filamento, custo e preço sugerido (sem clientes, contatos nem observações) e pede impressões sem login."
            : "Crie um link para outras pessoas verem a fila e pedirem impressões sem precisar de conta."}
        </span>
      </div>

      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            readOnly
            value={url}
            aria-label="Link de pedidos"
            onFocus={(e) => e.currentTarget.select()}
            className="h-8 max-w-md min-w-0 flex-1 text-[12.5px]"
          />
          <Button size="sm" variant="secondary" onClick={() => copy(url)}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            title="O link atual para de funcionar"
            onClick={() => run(regenerateShareLink)}
          >
            <RefreshCw />
            Gerar outro
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            className="text-muted-foreground"
            onClick={() =>
              run(async () => {
                await disableShareLink();
                return null;
              })
            }
          >
            <X />
            Desativar
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={isBusy}
          onClick={() => run(regenerateShareLink)}
        >
          <Link2 />
          Criar link
        </Button>
      )}

      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
