"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível entrar.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid flex-1 md:grid-cols-[1.05fr_1fr]">
      <div
        className="relative hidden flex-col justify-end gap-8 overflow-hidden bg-[#1b1d2c] p-12 lg:p-20 md:flex"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 0% 100%, var(--brand-900) 0%, transparent 62%)",
        }}
      >
        <div className="absolute top-12 left-12 flex items-center gap-3">
          <Image
            src="/flowhub3d.png"
            alt="FlowHub.3D"
            width={34}
            height={34}
            className="object-contain"
          />
          <div>
            <div className="font-heading text-base font-medium">FlowHub.3D</div>
            <div className="text-[11.5px] text-muted-foreground">
              Impressão 3D
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h1 className="max-w-96 text-5xl leading-[1.14] text-balance">
            Cada rolo, cada peça, cada valor que funcionou.
          </h1>
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
      </div>

      <div className="flex min-w-0 flex-col justify-center bg-card p-12 md:p-15">
        <div className="mb-8 flex flex-col gap-1.5">
          <div className="text-xs text-muted-foreground">Entrar</div>
          <h2 className="text-2xl font-medium">Bem-vinda de volta</h2>
          <p className="text-sm text-muted-foreground">
            Use a mesma conta de sempre para achar seus registros.
          </p>
        </div>

        <Button
          variant="secondary"
          className="h-11 w-full justify-center gap-2.5"
        >
          <FcGoogle className="size-5" />
          Continuar com Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <hr className="fade-rule flex-1" />
          <span className="text-[11px] tracking-widest text-muted-foreground uppercase">
            ou
          </span>
          <hr className="fade-rule flex-1" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="lg-mail">E-mail</Label>
            <Input
              id="lg-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-baseline gap-2.5">
              <Label htmlFor="lg-pw">Senha</Label>
              <Link
                href="#"
                className="ml-auto text-[11.5px] text-brand hover:underline"
              >
                Esqueci a senha
              </Link>
            </div>
            <div className="relative">
              <Input
                id="lg-pw"
                type="password"
                className="pr-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Eye className="absolute top-1/2 right-2.5 size-3.75 -translate-y-1/2 cursor-pointer text-muted-foreground" />
            </div>
          </div>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
          <Button
            type="submit"
            className="mt-1 h-11 w-full justify-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-[12.5px] text-muted-foreground">
          Primeira vez aqui?{" "}
          <Link href="#" className="text-brand hover:underline">
            Criar uma conta
          </Link>
        </p>
      </div>
    </div>
  );
}
