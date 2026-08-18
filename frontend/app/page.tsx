import Image from "next/image";
import Link from "next/link";
import {
  PiArrowRight,
  PiClock,
  PiCube,
  PiFirstAidKit,
  PiNut,
  PiPrinter,
  PiScroll,
  PiSlidersHorizontal,
} from "react-icons/pi";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: PiCube,
    title: "Peças e registros",
    body: "Um catálogo com cada modelo que você já imprimiu e um histórico de cada vez que ele rodou. Imprimir de novo é um clique — os dados já estão lá.",
  },
  {
    icon: PiScroll,
    title: "Filamentos com saldo",
    body: "Cadastre o rolo uma vez e ele desconta sozinho a cada impressão. Você vê quantas gramas sobraram e quantas peças ainda cabem nelas.",
  },
  {
    icon: PiSlidersHorizontal,
    title: "Calibrações por fatiador",
    body: "Temperatura, retração e fluxo salvos por filamento, impressora e fatiador — com o passo a passo de onde colar cada valor no Cura ou no Orca.",
  },
  {
    icon: PiPrinter,
    title: "Impressoras e energia",
    body: "Consumo em watts, tarifa de kWh e horas rodadas por máquina. O custo da hora de cada impressora entra no preço sem você calcular nada.",
  },
  {
    icon: PiFirstAidKit,
    title: "Diário de problemas",
    body: "Registre o sintoma, as causas suspeitas e o que você tentou. Na próxima vez que a peça descolar da mesa, a solução que funcionou está escrita.",
  },
  {
    icon: PiNut,
    title: "Itens extras e marcas",
    body: "Ímãs, parafusos, embalagem: comprados em lote, contados por unidade. E a comparação de qual marca de filamento sai mais barata pelo que entrega.",
  },
];

const steps = [
  {
    label: "Cadastre a impressora e o rolo",
    body: "Watts, tarifa de energia, peso e preço do filamento. Duas telas curtas, feitas uma vez.",
  },
  {
    label: "Registre cada impressão",
    body: "Peça, gramas e tempo. O rolo desconta na hora e a peça entra no catálogo com o custo calculado.",
  },
  {
    label: "Consulte na segunda vez",
    body: "Preço, perfil de fatiamento e o que deu errado da última vez — abrindo a peça que você já imprimiu.",
  },
];

const priceLines = [
  { label: "Filamento · 42 g de PLA Azul", value: "R$ 3,78" },
  { label: "Energia · 3 h 12 min a 0,92/kWh", value: "R$ 0,86" },
  { label: "Itens extras · 2 ímãs", value: "R$ 0,64" },
  { label: "Acabamento · 12 min", value: "R$ 1,12" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-8 border-b border-border bg-background/92 px-6 py-3.5 backdrop-blur-md sm:px-13">
        <div className="flex items-center gap-2.5">
          <Image
            src="/flowhub3d.png"
            alt="FlowHub.3D"
            width={28}
            height={28}
            className="object-contain"
          />
          <span className="font-heading text-[15px] font-medium">
            FlowHub.3D
          </span>
        </div>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <a
            href="#o-que-faz"
            className="rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            O que faz
          </a>
          <a
            href="#como-funciona"
            className="rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Como funciona
          </a>
          <a
            href="#preco-da-peca"
            className="rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Preço da peça
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/signup"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            Criar conta
          </Link>
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="px-5">
            Entrar
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 items-center gap-10 bg-[radial-gradient(90%_80%_at_0%_100%,var(--brand-900)_0%,transparent_60%)] px-6 py-16 sm:px-13 sm:py-20 md:grid-cols-[1.02fr_0.98fr] md:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          <Badge variant="outline" className="self-start">
            Para quem imprime e vende
          </Badge>
          <h1 className="max-w-[19ch] text-[38px] leading-[1.1] text-balance sm:text-[50px]">
            Você imprime. O FlowHub guarda o que aquilo custou.
          </h1>
          <p className="max-w-[46ch] text-[15.5px] leading-[1.65] text-muted-foreground">
            Rolos, impressões, calibrações e erros em um só lugar — e cada
            registro volta como gramas restantes no rolo, custo real da
            peça e o perfil de fatiamento que já deu certo.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="h-11.5 px-6.5 text-sm">
              Entrar
            </Button>
            <Button
              render={<Link href="/signup" />} nativeButton={false}
              variant="ghost"
              size="lg"
              className="h-11.5 px-5 text-sm"
            >
              Criar conta grátis
              <PiArrowRight />
            </Button>
          </div>
          <div className="mt-1.5 flex items-stretch gap-6.5">
            <div className="flex flex-col gap-1.5">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Rolos
              </span>
              <span className="font-heading text-[26px] leading-none font-medium tabular-nums">
                14
              </span>
            </div>
            <div className="w-px self-stretch bg-[linear-gradient(to_bottom,transparent,var(--border)_14px,var(--border)_calc(100%-14px),transparent)]" />
            <div className="flex flex-col gap-1.5">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Impressões
              </span>
              <span className="font-heading text-[26px] leading-none font-medium tabular-nums">
                96
              </span>
            </div>
            <div className="w-px self-stretch bg-[linear-gradient(to_bottom,transparent,var(--border)_14px,var(--border)_calc(100%-14px),transparent)]" />
            <div className="flex flex-col gap-1.5">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Calibrações
              </span>
              <span className="font-heading text-[26px] leading-none font-medium tabular-nums">
                13
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3.5 rounded-lg bg-card p-5.5 shadow-[var(--shadow-lg)]">
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
              Peça
            </span>
            <span className="ml-auto text-[11.5px] text-muted-foreground/70">
              28 impressões
            </span>
          </div>
          <div className="font-heading text-xl leading-tight font-medium">
            Vaso hexagonal G
          </div>
          <div className="grid grid-cols-2 gap-x-5.5 gap-y-3.5 border-y border-border py-4">
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Custo
              </span>
              <span className="font-heading text-2xl leading-none font-medium tabular-nums">
                R$ 6,40
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Preço sugerido
              </span>
              <span className="font-heading text-2xl leading-none font-medium tabular-nums text-brand">
                R$ 22,00
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Filamento
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <span className="size-2 flex-none rounded-full bg-[#3f7fd6]" />
                PLA Azul · 42 g
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
                Tempo
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <PiClock className="text-sm" />
                3 h 12 min
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline text-xs text-muted-foreground">
              <span>Rolo em uso</span>
              <span className="ml-auto tabular-nums">612 g de 1000 g</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full w-[61%] bg-brand" />
            </div>
            <div className="text-[11.5px] text-muted-foreground/70">
              Dá para mais 14 peças como esta.
            </div>
          </div>
        </div>
      </section>

      <section id="o-que-faz" className="px-6 pt-14 sm:px-13">
        <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
          O que faz
        </span>
        <h2 className="mt-3 max-w-[24ch] text-2xl sm:text-[32px]">
          Seis coisas que hoje moram em planilhas soltas
        </h2>
        <p className="mt-2.5 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">
          Cada uma existe porque a informação de uma alimenta a outra: o
          rolo desconta pela impressão, a impressão precifica pela
          impressora, a calibração vem do par filamento + fatiador.
        </p>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-px overflow-hidden bg-border sm:grid-cols-2 sm:mx-13 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex flex-col gap-2.5 bg-background p-6.5"
          >
            <Icon className="size-5.5 text-brand" />
            <div className="font-heading text-base font-medium">{title}</div>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </section>

      <section
        id="preco-da-peca"
        className="mt-18 grid grid-cols-1 items-center gap-10 bg-gradient-to-b from-[#1b1d2c] to-[#181a29] px-6 py-16 sm:px-13 md:grid-cols-2 md:gap-14"
      >
        <div className="flex flex-col gap-4">
          <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
            Preço da peça
          </span>
          <h2 className="max-w-[20ch] text-2xl text-balance sm:text-[32px]">
            O número que você precisa na hora que o cliente pergunta
          </h2>
          <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
            Filamento gasto, energia da impressora, sua hora de trabalho,
            itens extras e a margem que você definiu. Tudo já está
            cadastrado, então o preço é consequência — não uma conta feita
            de novo a cada orçamento.
          </p>
          <Button
            render={<Link href="/login" />} nativeButton={false}
            variant="secondary"
            size="lg"
            className="h-10.5 self-start px-5.5"
          >
            Entrar e ver o meu
          </Button>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg bg-card p-6 shadow-[var(--shadow-md)]">
          {priceLines.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-baseline py-2.5 text-[13.5px] text-foreground/80"
            >
              <span>{label}</span>
              <span className="ml-auto tabular-nums">{value}</span>
            </div>
          ))}
          <hr className="fade-rule my-2.5" />
          <div className="flex items-baseline py-1.5 text-[13.5px] text-foreground/80">
            <span>Custo</span>
            <span className="ml-auto font-heading text-[17px] font-medium tabular-nums">
              R$ 6,40
            </span>
          </div>
          <div className="flex items-baseline py-1.5 text-[13.5px] text-foreground/80">
            <span>Margem 240%</span>
            <span className="ml-auto tabular-nums">R$ 15,60</span>
          </div>
          <hr className="fade-rule my-2.5" />
          <div className="flex items-baseline py-1">
            <span className="text-[13.5px]">Preço sugerido</span>
            <span className="ml-auto font-heading text-[30px] leading-none font-medium text-brand">
              R$ 22,00
            </span>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="px-6 pt-18 sm:px-13">
        <span className="font-heading text-[10px] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
          Como funciona
        </span>
        <h2 className="mt-3 mb-9 max-w-[22ch] text-2xl sm:text-[32px]">
          Três cadastros e o resto se resolve
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-[22px] flex-none place-items-center rounded-full bg-brand font-heading text-xs font-medium text-background">
                  {i + 1}
                </span>
                <div className="font-heading text-base font-medium">
                  {step.label}
                </div>
              </div>
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 flex flex-col items-start gap-5.5 bg-[radial-gradient(80%_120%_at_100%_0%,var(--brand-900)_0%,transparent_62%),linear-gradient(#1b1d2c,#1b1d2c)] px-6 py-16 sm:px-13">
        <h2 className="max-w-[22ch] text-[28px] text-balance sm:text-[36px]">
          Comece pelo rolo que está na impressora agora.
        </h2>
        <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
          Cadastrar o primeiro filamento leva menos de um minuto, e a
          partir da primeira impressão registrada o app já responde por
          quanto vender.
        </p>
        <div className="flex items-center gap-3.5">
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="h-11.5 px-7 text-sm">
            Entrar
          </Button>
          <Button
            render={<Link href="/signup" />} nativeButton={false}
            variant="ghost"
            size="lg"
            className="h-11.5 px-5 text-sm"
          >
            Criar conta
          </Button>
        </div>
      </section>

      <footer className="flex items-center gap-3.5 border-t border-border px-6 py-5.5 sm:px-13">
        <Image
          src="/flowhub3d.png"
          alt="FlowHub.3D"
          width={20}
          height={20}
          className="object-contain"
        />
        <span className="text-xs text-muted-foreground/70">
          FlowHub.3D · Gestão de impressão 3D
        </span>
        <span className="ml-auto text-xs text-muted-foreground/70">
          Já tem conta?{" "}
          <Link href="/login" className="text-brand-300 hover:underline">
            Entrar
          </Link>
        </span>
      </footer>
    </div>
  );
}
