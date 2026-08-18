"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

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
import { Logo } from "@/components/logo";
import { ApiError } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

const loginSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      await login(values.email, values.password);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível entrar.",
      );
    }
  }

  return (
    <div className="grid flex-1 md:grid-cols-[1.05fr_1fr]">
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-end gap-8 overflow-hidden bg-[#1b1d2c] p-12 lg:p-20 md:flex"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 0% 100%, var(--brand-900) 0%, transparent 62%)",
        }}
      >
        <div className="absolute top-12 left-12">
          <Logo />
        </div>

        <div className="flex flex-col gap-6">
          <p className="max-w-96 text-5xl leading-[1.14] text-balance">
            Cada rolo, cada peça, cada valor que funcionou.
          </p>
          <div className="flex items-stretch gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="text-xs text-muted-foreground">Rolos</div>
              <div className="text-3xl font-medium">14</div>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-1.5">
              <div className="text-xs text-muted-foreground">Impressões</div>
              <div className="text-3xl font-medium">96</div>
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col gap-1.5">
              <div className="text-xs text-muted-foreground">Calibrações</div>
              <div className="text-3xl font-medium">13</div>
            </div>
          </div>
          <p className="max-w-[38ch] text-sm text-muted-foreground">
            O que você registra aqui volta como preço de peça, gramas restantes
            e o perfil que já deu certo naquele filamento.
          </p>
        </div>
      </aside>

      <section
        aria-labelledby="login-heading"
        className="flex min-w-0 flex-col justify-center bg-card p-12 md:p-15"
      >
        <div className="mb-8 flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Entrar</p>
          <h1 id="login-heading" className="text-2xl font-medium">
            Bem-vinda de volta
          </h1>
          <p className="text-sm text-muted-foreground">
            Use a mesma conta de sempre para achar seus registros.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full justify-center gap-2.5"
        >
          <FcGoogle className="size-5" aria-hidden="true" />
          Continuar com Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <hr className="fade-rule flex-1" />
          <span className="text-[11px] tracking-widest text-muted-foreground uppercase">
            ou
          </span>
          <hr className="fade-rule flex-1" />
        </div>

        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2.5">
                    <FormLabel>Senha</FormLabel>
                    <Link
                      href="#"
                      className="ml-auto text-[11.5px] text-brand hover:underline"
                    >
                      Esqueci a senha
                    </Link>
                  </div>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="pr-9"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showPassword}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-3.75" aria-hidden="true" />
                      ) : (
                        <Eye className="size-3.75" aria-hidden="true" />
                      )}
                    </button>
                  </div>
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
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-[12.5px] text-muted-foreground">
          Primeira vez aqui?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Criar uma conta
          </Link>
        </p>
      </section>
    </div>
  );
}
