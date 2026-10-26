"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/logo";
import { SharedQueueList } from "@/components/queue/shared-queue-list";
import { useStoredState } from "@/hooks/use-stored-state";
import { ApiError } from "@/lib/api/auth";
import { isNotFoundError } from "@/lib/api/client";
import {
  SharedQueue,
  getSharedQueue,
  sendShareRequest,
} from "@/lib/api/print-queue";

const requestSchema = z.object({
  requesterName: z.string().trim().min(1, "Diga seu nome."),
  contact: z.string().trim(),
  colors: z.string().trim().min(1, "Diga as cores."),
  name: z.string().trim().min(1, "Diga o que quer imprimir."),
  // Texto no campo; vira número no envio.
  units: z
    .string()
    .trim()
    .regex(/^\d+$/, "Use um número inteiro.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 10_000, "Entre 1 e 10.000."),
  modelUrl: z.string().trim().min(1, "Mande o link do modelo."),
  note: z.string().trim(),
});

type RequestValues = z.infer<typeof requestSchema>;

const EMPTY: RequestValues = {
  requesterName: "",
  contact: "",
  colors: "",
  name: "",
  units: "1",
  modelUrl: "",
  note: "",
};

type LinkState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "error" }
  | { status: "ready"; queue: SharedQueue };

// De quanto em quanto tempo a fila é recarregada com a página aberta.
const REFRESH_MS = 60_000;

export default function ShareRequestPage() {
  const { token } = useParams<{ token: string }>();
  const [link, setLink] = useState<LinkState>({ status: "loading" });
  const [sentName, setSentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pedidos feitos deste navegador, para marcar na fila.
  const [myIds, setMyIds] = useStoredState<string[]>(
    `flowhub:pedidos:${token}`,
    [],
  );

  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: EMPTY,
  });
  const isSubmitting = form.formState.isSubmitting;

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const queue = await getSharedQueue(token);
        if (!isCancelled()) setLink({ status: "ready", queue });
      } catch (err) {
        if (isCancelled()) return;
        // Recarga que falhou por rede mantém a fila que já está na tela.
        setLink((prev) =>
          isNotFoundError(err)
            ? { status: "invalid" }
            : prev.status === "ready"
              ? prev
              : { status: "error" },
        );
      }
    },
    [token],
  );

  useEffect(() => {
    let ignore = false;
    const isCancelled = () => ignore;
    load(isCancelled);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(isCancelled);
    }, REFRESH_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [load]);

  async function onSubmit(values: RequestValues) {
    setError(null);
    try {
      const id = await sendShareRequest(token, {
        ...values,
        units: Number(values.units),
        contact: values.contact || null,
        note: values.note || null,
      });
      // Os mais antigos já saíram da fila há tempo; não precisa guardar todos.
      setMyIds((prev) => [...prev, id].slice(-50));
      setSentName(values.name);
      load();
      // Quem pede de novo não precisa redigitar quem é.
      form.reset({
        ...EMPTY,
        requesterName: values.requesterName,
        contact: values.contact,
      });
    } catch (err) {
      if (isNotFoundError(err)) {
        setLink({ status: "invalid" });
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar o pedido.",
      );
    }
  }

  function renderRequest() {
    if (sentName) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="size-8 text-brand" aria-hidden="true" />
          <h2 className="text-xl font-medium">Pedido enviado</h2>
          <p className="max-w-[40ch] text-sm text-muted-foreground">
            “{sentName}” entrou no fim da fila; ele aparece marcado como seu
            pedido. Se precisar, entram em contato com você para combinar os
            detalhes.
          </p>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => setSentName(null)}
          >
            Pedir outra coisa
          </Button>
        </div>
      );
    }

    return (
      <>
        <div className="mb-6 flex flex-col gap-1.5">
          <h2 className="text-xl font-medium">Pedir uma impressão</h2>
        </div>

        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            {/* Volta para sm:grid-cols-2 quando o contato voltar. */}
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="requesterName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seu nome</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" maxLength={500} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp ou e-mail (opcional)</FormLabel>
                    <FormControl>
                      <Input maxLength={500} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>O que quer imprimir</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: chaveiro de porquinho"
                        maxLength={120}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="colors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cores</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: rosa com detalhes em branco"
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link do modelo</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="makerworld.com/models/…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea maxLength={500} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p role="alert" className="text-[12.5px] text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="mt-1 h-11 w-full justify-center"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Enviando..." : "Enviar pedido"}
            </Button>
          </form>
        </Form>
      </>
    );
  }

  function renderBody() {
    if (link.status === "loading") {
      return (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(0,28rem)]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-2/3" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      );
    }

    if (link.status === "invalid" || link.status === "error") {
      return (
        <section className="w-full max-w-xl rounded-xl bg-card p-6 sm:p-10">
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <LinkIcon className="size-6" aria-hidden="true" />
            <p className="text-sm">
              {link.status === "invalid"
                ? "Este link não existe ou foi desativado. Peça um novo para quem te enviou."
                : "Não foi possível abrir o link agora. Tente de novo em instantes."}
            </p>
          </div>
        </section>
      );
    }

    const owner = link.queue.ownerName?.trim() || null;

    return (
      <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_minmax(0,28rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Fila de impressão</p>
            <h1 className="text-2xl font-medium">
              {owner ? `O que ${owner} vai imprimir` : "O que vai ser impresso"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Na ordem em que vai sair da impressora.
            </p>
          </div>
          <SharedQueueList queue={link.queue} myIds={myIds} />
        </div>
        <section className="w-full rounded-xl bg-card p-6 sm:p-8 lg:sticky lg:top-8">
          {renderRequest()}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-4 py-10 sm:py-16">
      <Logo />
      {renderBody()}
    </div>
  );
}
