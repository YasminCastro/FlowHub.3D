"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { ApiError } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 45;

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, resendCode } = useAuth();

  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

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

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await verifyEmail(email, code);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível ativar a conta.",
      );
      setDigits(Array(CODE_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || isResending) return;

    setError(null);
    setIsResending(true);
    try {
      await resendCode(email);
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

  return (
    <div className="flex flex-1 items-center justify-center bg-card p-8">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="mb-2 flex items-center gap-2.5">
          <span className="text-[11px] tracking-widest text-muted-foreground uppercase">
            Passo 2 de 2
          </span>
          <span className="flex gap-1">
            <span className="h-0.75 w-6.5 rounded-full bg-brand" />
            <span className="h-0.75 w-6.5 rounded-full bg-brand" />
          </span>
        </div>

        <h1 className="text-2xl font-medium">Ative sua conta</h1>
        <p className="mt-1.5 mb-7 max-w-[44ch] text-sm text-muted-foreground">
          Enviamos um código de seis dígitos para{" "}
          <span className="text-foreground">{email || "seu e-mail"}</span>.{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Alterar e-mail
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="code-0" className="text-xs text-muted-foreground">
              Código
            </label>
            <div className="flex gap-2.25" role="group" aria-label="Código de verificação">
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
            {error && (
              <p role="alert" className="text-[12.5px] text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full justify-center"
            disabled={!isComplete || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Ativando..." : "Ativar conta"}
          </Button>

          <div className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
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
                {isResending ? "Enviando..." : "Enviar novo código"}
              </button>
            )}
            <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground/70">
              <Clock aria-hidden="true" className="size-3.25" />
              o código vale 10 min
            </span>
          </div>
        </form>

        <p className="mt-7 text-[12.5px] text-muted-foreground">
          <Link href="/login" className="text-brand hover:underline">
            Voltar para entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
