"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CircleDollarSign, Eye, EyeOff, Gauge, Layers } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const label = ["Fraca", "Fraca", "Razoável", "Boa", "Forte"][score];
  return { score, label };
}

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome."),
    email: z.email("E-mail inválido."),
    password: z.string().min(8, "Use pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
    acceptedTerms: z.boolean().refine((value) => value === true, {
      message: "Aceite os termos e a política de privacidade para continuar.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });

  const password = useWatch({ control: form.control, name: "password" });
  const strength = useMemo(() => passwordStrength(password), [password]);
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: SignupValues) {
    setError(null);
    try {
      await register(values.email, values.password, values.name);
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a conta.",
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
          <p className="max-w-2xl text-5xl leading-[1.14] text-balance">
            Comece registrando o primeiro rolo.
          </p>
          <ul className="flex max-w-[40ch] flex-col gap-3.5">
            <li className="flex gap-2.5 text-[13px] leading-[1.55] text-muted-foreground">
              <Layers
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand"
              />
              <span>
                <strong className="font-medium text-foreground">
                  Filamentos por consumo
                </strong>{" "}
                — quanto saiu do rolo, quanto sobrou e quantas peças ainda dá.
              </span>
            </li>
            <li className="flex gap-2.5 text-[13px] leading-[1.55] text-muted-foreground">
              <Gauge
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand"
              />
              <span>
                <strong className="font-medium text-foreground">
                  Calibrações que funcionaram
                </strong>{" "}
                — fluxo, temperatura, pressure advance e retração por filamento.
              </span>
            </li>
            <li className="flex gap-2.5 text-[13px] leading-[1.55] text-muted-foreground">
              <CircleDollarSign
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand"
              />
              <span>
                <strong className="font-medium text-foreground">
                  Custo real da peça
                </strong>{" "}
                — filamento, energia, manutenção e itens extras somados.
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <section
        aria-labelledby="signup-heading"
        className="flex min-w-0 flex-col justify-center bg-card p-12 md:p-15"
      >
        <div className="mb-8 flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Criar conta</p>
          <h1 id="signup-heading" className="text-2xl font-medium">
            Sua oficina, do zero
          </h1>
          <p className="text-sm text-muted-foreground">
            Leva um minuto. Comece a registrar rolos, impressões e calibrações
            agora mesmo.
          </p>
        </div>

        {/* 
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full justify-center gap-2.5"
        >
          <FcGoogle className="size-5" aria-hidden="true" />
          Criar conta com Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <hr className="fade-rule flex-1" />
          <span className="text-[11px] tracking-widest text-muted-foreground uppercase">
            ou
          </span>
          <hr className="fade-rule flex-1" />
        </div> */}

        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="name"
                      placeholder="Como quer ser chamada"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormLabel>Senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
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
                  {password && (
                    <div className="flex items-center gap-2.5">
                      <div
                        role="meter"
                        aria-label="Força da senha"
                        aria-valuemin={0}
                        aria-valuemax={4}
                        aria-valuenow={strength.score}
                        aria-valuetext={strength.label}
                        className="flex flex-1 gap-1"
                      >
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-0.75 flex-1 rounded-full ${
                              i < strength.score ? "bg-brand" : "bg-neutral-700"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11.5px] text-muted-foreground">
                        {strength.label} · mínimo 8 caracteres
                      </span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-9"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={
                        showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showConfirmPassword}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                    >
                      {showConfirmPassword ? (
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

            <FormField
              control={form.control}
              name="acceptedTerms"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-2.5">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <FormLabel className="block text-[12.5px] leading-normal font-normal text-muted-foreground">
                      Aceito os{" "}
                      <Link href="#" className="text-brand hover:underline">
                        termos
                      </Link>{" "}
                      e a{" "}
                      <Link href="#" className="text-brand hover:underline">
                        política de privacidade
                      </Link>
                    </FormLabel>
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
              {isSubmitting ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-[12.5px] text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Entrar
          </Link>
        </p>
      </section>
    </div>
  );
}
