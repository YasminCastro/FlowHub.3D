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

const SHARED_HINT =
  "Quem tiver o link vê a fila com tempo, gramas, custo do filamento, custo e preço sugerido (sem clientes, contatos nem observações) e pede impressões sem login.";

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
    <section className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className="flex shrink-0 items-center gap-1.75 text-[13px]"
          title={url ? SHARED_HINT : undefined}
        >
          <Link2 className="size-3.5 text-brand" aria-hidden="true" />
          Link de pedidos
        </span>

        {url ? (
          <>
            <Input
              readOnly
              value={url}
              aria-label="Link de pedidos"
              aria-description={SHARED_HINT}
              onFocus={(e) => e.currentTarget.select()}
              className="h-7 max-w-xs min-w-40 flex-1 text-xs"
            />
            <Button size="sm" variant="secondary" onClick={() => copy(url)}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={isBusy}
              title="Gerar outro link (o atual para de funcionar)"
              aria-label="Gerar outro link"
              onClick={() => run(regenerateShareLink)}
            >
              <RefreshCw />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={isBusy}
              className="text-muted-foreground"
              title="Desativar link"
              aria-label="Desativar link"
              onClick={() =>
                run(async () => {
                  await disableShareLink();
                  return null;
                })
              }
            >
              <X />
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              Para outras pessoas verem a fila e pedirem impressões sem conta.
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={isBusy}
              onClick={() => run(regenerateShareLink)}
            >
              <Link2 />
              Criar link
            </Button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
