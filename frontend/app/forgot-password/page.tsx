"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, MailCheck } from "lucide-react";
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
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/contexts/auth-context";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 45;

const forgotPasswordSchema = z.object({
  email: z.email("E-mail inválido."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Use pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, resetPassword } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const emailForm = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const isRequesting = emailForm.formState.isSubmitting;
  const isResetting = resetForm.formState.isSubmitting;

  useEffect(() => {
    if (!sentTo || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [sentTo, cooldown]);

  useEffect(() => {
    if (sentTo) inputsRef.current[0]?.focus();
  }, [sentTo]);

  async function requestCode(values: ForgotPasswordValues) {
    setError(null);
    try {
      await forgotPassword(values.email);
      setSentTo(values.email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(""));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar o código.",
      );
    }
  }

  async function handleResend() {
    if (!sentTo || cooldown > 0 || isResending) return;

    setError(null);
    setIsResending(true);
    try {
      await forgotPassword(sentTo);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível reenviar o código.",
      );
    } finally {
      setIsResending(false);
    }
  }

  function updateDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = clean[i];
      }
      return next;
    });

    const nextIndex = Math.min(index + clean.length, CODE_LENGTH - 1);
    inputsRef.current[nextIndex]?.focus();
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  const code = digits.join("");
  const isCodeComplete = code.length === CODE_LENGTH;

  async function handleReset(values: ResetPasswordValues) {
    if (!sentTo || !isCodeComplete) return;

    setError(null);
    try {
      await resetPassword(sentTo, code, values.newPassword);
      router.push("/login");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível redefinir a senha.",
      );
      setDigits(Array(CODE_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center bg-card p-8">
      <div className="absolute top-12 left-12">
        <Logo />
      </div>

      <div className="w-full max-w-105">
        {sentTo ? (
          <>
            <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-brand/14 text-brand">
              <MailCheck aria-hidden="true" className="size-5" />
            </div>
            <h1 className="text-2xl font-medium">Verifique seu e-mail</h1>
            <p className="mt-1.5 mb-7 max-w-[44ch] text-sm text-muted-foreground text-pretty">
              Se existir uma conta em{" "}
              <span className="text-foreground">{sentTo}</span>, um código para
              definir a nova senha chega em instantes. Ele vale por 10 minutos.
            </p>

            <form
              onSubmit={resetForm.handleSubmit(handleReset)}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="code-0"
                  className="text-xs text-muted-foreground"
                >
                  Código
                </label>
                <div
                  className="flex gap-2.25"
                  role="group"
                  aria-label="Código de redefinição"
                >
                  {digits.map((digit, i) => (
                    <Input
                      key={i}
                      id={`code-${i}`}
                      ref={(el) => {
                        inputsRef.current[i] = el;
                      }}
                      value={digit}
                      onChange={(e) => updateDigit(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={CODE_LENGTH}
                      aria-invalid={!!error}
                      className="h-14 w-12.5 p-0 text-center text-xl font-medium tabular-nums"
                    />
                  ))}
                </div>
              </div>

              <Form {...resetForm}>
                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repetir a senha</FormLabel>
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
                            showConfirmPassword
                              ? "Ocultar senha"
                              : "Mostrar senha"
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
              </Form>

              {error && (
                <p role="alert" className="text-[12.5px] text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-11 w-full justify-center"
                disabled={!isCodeComplete || isResetting}
                aria-busy={isResetting}
              >
                {isResetting ? "Salvando..." : "Salvar e entrar"}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
              <span>Não chegou?</span>
              {cooldown > 0 ? (
                <span className="text-muted-foreground/70">
                  reenviar em {formatCountdown(cooldown)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-brand hover:underline disabled:opacity-50"
                >
                  {isResending ? "Enviando..." : "Enviar de novo"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setError(null);
                  emailForm.reset();
                  resetForm.reset();
                }}
                className="ml-auto text-brand hover:underline"
              >
                Usar outro e-mail
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium">Recuperar senha</h1>
            <p className="mt-1.5 mb-7 max-w-[42ch] text-sm text-muted-foreground">
              Diga o e-mail da conta e enviamos um código para você definir uma
              nova senha.
            </p>

            <Form {...emailForm}>
              <form
                className="flex flex-col gap-4"
                onSubmit={emailForm.handleSubmit(requestCode)}
                noValidate
              >
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          autoFocus
                          {...field}
                        />
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
                  disabled={isRequesting}
                  aria-busy={isRequesting}
                >
                  {isRequesting ? "Enviando..." : "Enviar código"}
                </Button>
              </form>
            </Form>
          </>
        )}

        <p className="mt-7 text-[12.5px] text-muted-foreground">
          <Link href="/login" className="text-brand hover:underline">
            Voltar para entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
