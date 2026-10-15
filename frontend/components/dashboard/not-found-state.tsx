"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  GaugeIcon,
  ImagesIcon,
  LayersIcon,
  LayoutGridIcon,
  ListOrderedIcon,
  LucideIcon,
  NotebookIcon,
  PackageIcon,
  PlusIcon,
  PrinterIcon,
  ShoppingBagIcon,
  StoreIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NotFoundResource = {
  /** "Este filamento não existe" */
  title: string;
  /** Sujeito da frase de explicação: "O filamento pode ter sido excluído". */
  subject: string;
  listLabel: string;
  listHref: string;
  icon: LucideIcon;
  newLabel: string;
  newHref: string;
};

const RESOURCES = {
  impressoes: {
    title: "Esta impressão não existe",
    subject: "A impressão",
    listLabel: "Ver todas as impressões",
    listHref: "/dashboard/impressoes",
    icon: ImagesIcon,
    newLabel: "Cadastrar impressão",
    newHref: "/dashboard/impressoes/new",
  },
  fila: {
    title: "Este item da fila não existe",
    subject: "O item",
    listLabel: "Ver a fila de impressão",
    listHref: "/dashboard/fila",
    icon: ListOrderedIcon,
    newLabel: "Adicionar à fila",
    newHref: "/dashboard/fila/new",
  },
  catalogo: {
    title: "Este item do catálogo não existe",
    subject: "O item",
    listLabel: "Ver o catálogo",
    listHref: "/dashboard/catalogo",
    icon: StoreIcon,
    newLabel: "Cadastrar item",
    newHref: "/dashboard/catalogo/new",
  },
  diario: {
    title: "Esta entrada do diário não existe",
    subject: "A entrada",
    listLabel: "Ver o diário",
    listHref: "/dashboard/diario",
    icon: NotebookIcon,
    newLabel: "Nova entrada",
    newHref: "/dashboard/diario/new",
  },
  impressoras: {
    title: "Esta impressora não existe",
    subject: "A impressora",
    listLabel: "Ver todas as impressoras",
    listHref: "/dashboard/printers",
    icon: PrinterIcon,
    newLabel: "Cadastrar impressora",
    newHref: "/dashboard/printers/new",
  },
  filamentos: {
    title: "Este filamento não existe",
    subject: "O filamento",
    listLabel: "Ver todos os filamentos",
    listHref: "/dashboard/filamentos",
    icon: LayersIcon,
    newLabel: "Cadastrar filamento",
    newHref: "/dashboard/filamentos/new",
  },
  calibracoes: {
    title: "Esta calibração não existe",
    subject: "A calibração",
    listLabel: "Ver todas as calibrações",
    listHref: "/dashboard/calibracoes",
    icon: GaugeIcon,
    newLabel: "Nova calibração",
    newHref: "/dashboard/calibracoes/new",
  },
  marcas: {
    title: "Esta marca não existe",
    subject: "A marca",
    listLabel: "Ver todas as marcas",
    listHref: "/dashboard/marcas",
    icon: PackageIcon,
    newLabel: "Cadastrar marca",
    newHref: "/dashboard/marcas/new",
  },
  "itens-extras": {
    title: "Este item extra não existe",
    subject: "O item",
    listLabel: "Ver todos os itens extras",
    listHref: "/dashboard/itens-extras",
    icon: ShoppingBagIcon,
    newLabel: "Cadastrar item extra",
    newHref: "/dashboard/itens-extras/new",
  },
} satisfies Record<string, NotFoundResource>;

export type NotFoundResourceKey = keyof typeof RESOURCES;

const actionClass =
  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-3 text-left text-[13px] transition-colors hover:border-brand hover:bg-brand/8 hover:text-brand [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * 404 dentro do app: a navegação continua ali e o erro ocupa só o miolo,
 * com saídas concretas para onde a pessoa provavelmente ia.
 */
export function NotFoundState({
  resource,
}: {
  /** Sem `resource`, é o caso genérico de uma URL que não existe. */
  resource?: NotFoundResourceKey;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const config: NotFoundResource | undefined = resource
    ? RESOURCES[resource]
    : undefined;

  return (
    <div className="flex max-w-160 flex-col gap-7.5 px-4 py-12 sm:px-7 sm:py-16">
      <div className="flex flex-col gap-3">
        <div className="font-heading text-[64px] leading-none font-medium tracking-tight text-brand-300 tabular-nums sm:text-[76px]">
          404
        </div>
        <h1 className="m-0 text-2xl font-medium sm:text-[28px]">
          {config?.title ?? "Esta página não existe"}
        </h1>
        <p className="m-0 max-w-[52ch] text-[13.5px] leading-relaxed text-pretty text-muted-foreground">
          O endereço{" "}
          <span className="font-mono text-[12.5px] break-all text-foreground">
            {pathname}
          </span>{" "}
          não levou a nada. {config?.subject ?? "O registro"} pode ter sido
          excluído, ou o link está incompleto.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
          Você talvez queira
        </span>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {config && (
            <>
              <Link href={config.listHref} className={actionClass}>
                <config.icon />
                {config.listLabel}
              </Link>
              <Link href={config.newHref} className={actionClass}>
                <PlusIcon />
                {config.newLabel}
              </Link>
            </>
          )}
          <Link href="/dashboard" className={actionClass}>
            <LayoutGridIcon />
            Voltar ao início
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(actionClass, "bg-transparent")}
          >
            <ArrowLeftIcon />
            Página anterior
          </button>
        </div>
      </div>
    </div>
  );
}
