import {
  CalibrationFilament,
  CalibrationValues,
  Slicer,
} from "@/lib/api/calibration";

// Guia de calibração por fatiador: seis testes na ordem que importa. O texto
// cita os valores do rolo escolhido em vez de marcadores genéricos.

export type GuideContext = {
  filament: CalibrationFilament;
  slicer: Slicer;
  /** Resultados já anotados nos passos anteriores, pela chave do passo. */
  results: Partial<Record<GuideStepId, string>>;
};

export type GuideStepId =
  | "temperature"
  | "flow"
  | "pressureAdvance"
  | "retraction"
  | "maxFlow"
  | "tolerance";

export type GuideStep = {
  id: GuideStepId;
  title: string;
  summary: string;
  /** Campo onde o valor encontrado entra na calibração, quando há um. */
  field?: keyof CalibrationValues;
  valueLabel: string;
  unit?: string;
  placeholder: string;
  howTo: (ctx: GuideContext) => string[];
  analyze: string[];
  applyAt: Record<Slicer, string>;
};

export type MaterialDefaults = { nozzleRange: [number, number]; bedTemp: number };

// O filamento não guarda a faixa do fabricante; o guia parte da faixa
// típica do material, pelo nome do tipo ("PLA Silk", "PETG"...).
export function materialDefaults(type: string): MaterialDefaults {
  const t = type.toLowerCase();
  if (t.includes("petg")) return { nozzleRange: [230, 250], bedTemp: 80 };
  if (t.includes("abs") || t.includes("asa"))
    return { nozzleRange: [240, 260], bedTemp: 100 };
  if (t.includes("tpu")) return { nozzleRange: [210, 230], bedTemp: 40 };
  if (t.includes("silk")) return { nozzleRange: [200, 230], bedTemp: 60 };
  return { nozzleRange: [190, 220], bedTemp: 60 };
}

/** Temperatura do passo 1, ou o meio da faixa típica do material. */
export function guideNozzleTemp(ctx: GuideContext) {
  const found = ctx.results.temperature?.trim();
  if (found) return found;
  const [min, max] = materialDefaults(ctx.filament.type).nozzleRange;
  return String(Math.round((min + max) / 2 / 5) * 5);
}

function genericProfile(ctx: GuideContext) {
  return `${ctx.filament.type} genérico`;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "temperature",
    title: "Temperatura do bico",
    summary:
      "Acha a temperatura em que o filamento adere bem entre camadas sem fiapos. Todos os outros testes partem dela.",
    field: "nozzleTemp",
    valueLabel: "Bico",
    unit: "°C",
    placeholder: "210",
    howTo: (ctx) => {
      const [min, max] = materialDefaults(ctx.filament.type).nozzleRange;
      return ctx.slicer === "ORCA"
        ? [
            `No Orca, abra o perfil **${genericProfile(ctx)}** e escolha a impressora.`,
            "Menu superior em **Calibration › Temperature**.",
            `Defina a torre de **${max} °C** até **${min} °C**, em passos de 5 °C.`,
            "Fatie e imprima. Cada bloco da torre corresponde a uma temperatura.",
          ]
        : [
            `No Creality Print, selecione o perfil **${genericProfile(ctx)}**.`,
            "Menu **Calibração › Temperatura**.",
            `Use a faixa típica do material: **${max} °C** a **${min} °C**, passo de 5 °C.`,
            "Imprima a torre e anote em que bloco cada temperatura começa.",
          ];
    },
    analyze: [
      "Procure o bloco com ponte limpa, sem fiapos entre as torres e com o texto em relevo legível.",
      "Tente quebrar a torre com a mão: os blocos frios demais descolam primeiro.",
      "Entre dois blocos parecidos, fique com o mais frio — menos fiapo nas próximas peças.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Filament › Nozzle temperature",
      CREALITY: "Filamento › Temperatura do bico",
    },
  },
  {
    id: "flow",
    title: "Fluxo (flow rate)",
    summary:
      "Ajusta quanto material sai de fato. É o teste que fecha falhas de parede e paredes infladas.",
    field: "flow",
    valueLabel: "Fluxo",
    placeholder: "0,98",
    howTo: (ctx) =>
      ctx.slicer === "ORCA"
        ? [
            `No Orca, abra o perfil **${genericProfile(ctx)}** com a temperatura que você fixou no passo 1: **${guideNozzleTemp(ctx)} °C**.`,
            "Menu superior em **Calibration › Flow rate › Pass 1**.",
            "Fatie e imprima os quadrados. Depois rode o **Pass 2** a partir do quadrado escolhido.",
            "Some os dois modificadores: o valor final é **1 + pass 1 + pass 2**.",
          ]
        : [
            `No Creality Print, use o perfil **${genericProfile(ctx)}** a **${guideNozzleTemp(ctx)} °C**.`,
            "Menu **Calibração › Fluxo › Calibração grossa**.",
            "Imprima, escolha o melhor bloco e rode a **calibração fina** a partir dele.",
            "O fatiador já mostra o fluxo final do bloco escolhido.",
          ],
    analyze: [
      "Olhe a superfície de topo com luz de lado, não de frente.",
      "Vale o quadrado mais liso, sem vãos entre as linhas e sem brilho de material acumulado.",
      "Na dúvida entre dois, prefira o menor — excesso de fluxo aparece depois como parede inflada.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Flow ratio",
      CREALITY: "Filamento › Taxa de fluxo",
    },
  },
  {
    id: "pressureAdvance",
    title: "Pressure advance",
    summary:
      "Compensa a pressão no bico nas acelerações. Cantos ficam vivos, sem bolha na entrada nem falha na saída.",
    field: "pressureAdvance",
    valueLabel: "Pressure advance",
    placeholder: "0,024",
    howTo: (ctx) =>
      ctx.slicer === "ORCA"
        ? [
            `Com **${guideNozzleTemp(ctx)} °C** e o fluxo do passo 2 já salvos no perfil, abra **Calibration › Pressure advance**.`,
            "Escolha o teste **PA Pattern** (mais rápido de ler em Klipper).",
            `Para ${ctx.filament.type === "PETG" ? "PETG, comece em 0 e vá até 0,1 com passo 0,005" : "PLA, comece em 0 e vá até 0,08 com passo 0,002"}.`,
            "Imprima e procure a linha com os cantos mais nítidos.",
          ]
        : [
            "Menu **Calibração › Pressure Advance**.",
            "Use o modo **linhas** com o perfil já ajustado de temperatura e fluxo.",
            `Faixa sugerida: **0** a **${ctx.filament.type === "PETG" ? "0,1" : "0,08"}**.`,
            "Imprima e conte a linha em que a espessura fica uniforme.",
          ],
    analyze: [
      "Na linha certa, o trecho rápido e o lento têm a mesma espessura.",
      "Valor baixo demais: bolha no fim da linha. Alto demais: falha logo no começo.",
      "Confira com um cubo pequeno — o canto não deve abaular.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Enable pressure advance",
      CREALITY: "Filamento › Pressure advance",
    },
  },
  {
    id: "retraction",
    title: "Retração",
    summary:
      "Quanto filamento recuar nas viagens. Resolve fiapos sem entupir o bico com retração demais.",
    field: "retractionDistance",
    valueLabel: "Retração",
    unit: "mm",
    placeholder: "0,8",
    howTo: (ctx) =>
      ctx.slicer === "ORCA"
        ? [
            "Menu **Calibration › Retraction test**.",
            "Em extrusora direta, teste de **0** a **2 mm**, passo de 0,1 mm.",
            `Mantenha **${guideNozzleTemp(ctx)} °C** — temperatura mais alta pede mais retração.`,
            "Imprima as duas torres e anote a altura em que os fiapos somem.",
          ]
        : [
            "Menu **Calibração › Retração**.",
            "Extrusora direta: faixa de **0** a **2 mm**, passo de 0,1 mm.",
            `Imprima a **${guideNozzleTemp(ctx)} °C**.`,
            "Conte as camadas até a altura em que o fiapo desaparece.",
          ],
    analyze: [
      "Use o menor valor em que os fiapos somem — retração demais desgasta o filamento.",
      "Fiapo fino que sai com ar quente é normal; fiapo grosso é retração curta.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Setting overrides › Retraction length",
      CREALITY: "Filamento › Sobrescrever › Comprimento de retração",
    },
  },
  {
    id: "maxFlow",
    title: "Vazão máxima",
    summary:
      "O limite de mm³/s que o hotend derrete este filamento. Evita subextrusão nas peças rápidas.",
    field: "maxVolumetricSpeed",
    valueLabel: "Vazão máxima",
    unit: "mm³/s",
    placeholder: "18",
    howTo: (ctx) =>
      ctx.slicer === "ORCA"
        ? [
            "Menu **Calibration › Max flowrate**.",
            "Comece em **5 mm³/s** e vá até **25 mm³/s**, passo de 0,5.",
            "Imprima o vaso em espiral e meça a altura em que a parede começa a falhar.",
          ]
        : [
            "Menu **Calibração › Velocidade volumétrica máxima**.",
            "Faixa de **5** a **25 mm³/s**.",
            "Meça a altura da primeira falha e converta pela tabela do teste.",
          ],
    analyze: [
      "A vazão é a da camada logo abaixo da primeira falha visível.",
      "Use ~10% abaixo do valor medido como margem de segurança.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Max volumetric speed",
      CREALITY: "Filamento › Velocidade volumétrica máxima",
    },
  },
  {
    id: "tolerance",
    title: "Tolerância dimensional",
    summary:
      "Confere se encaixes saem no tamanho. Só importa para peças que montam umas nas outras.",
    valueLabel: "Compensação",
    unit: "mm",
    placeholder: "0,05",
    howTo: (ctx) =>
      ctx.slicer === "ORCA"
        ? [
            "Menu **Calibration › Tolerance test**.",
            "Imprima a placa com os furos hexagonais e os pinos.",
            "Tente encaixar cada pino: anote a menor folga que entra sem forçar.",
          ]
        : [
            "Baixe um teste de tolerância (placa com pinos de folgas diferentes).",
            "Imprima com o perfil já calibrado.",
            "Anote a menor folga que encaixa sem forçar.",
          ],
    analyze: [
      "Se nenhum pino entra, compense o furo para fora (valor positivo).",
      "Meça com paquímetro antes de mexer — às vezes o problema é a primeira camada esmagada.",
    ],
    applyAt: {
      ORCA: "Process › Quality › X-Y hole compensation",
      CREALITY: "Qualidade › Compensação de furos X-Y",
    },
  },
];
