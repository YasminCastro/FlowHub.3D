import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="relative flex flex-1 flex-col p-12 md:p-15">
      <div className="absolute top-12 left-12">
        <Logo />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="font-heading text-[84px] leading-none font-medium text-brand-300 sm:text-[110px]">
          404
        </div>
        <h1 className="text-2xl font-medium sm:text-[28px]">
          Endereço não encontrado
        </h1>
        <p className="max-w-[42ch] text-[14.5px] leading-relaxed text-muted-foreground">
          Confira o link. Se ele veio de um lugar que era seu, talvez você
          precise entrar primeiro.
        </p>
        <div className="flex items-center gap-4">
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            size="lg"
            className="px-5"
          >
            Entrar
          </Button>
          <Link
            href="/dashboard"
            className="text-sm text-brand hover:underline"
          >
            Ir para o início
          </Link>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/50">
        Se o erro se repetir no mesmo link, escreva para o suporte.
      </p>
    </div>
  );
}
