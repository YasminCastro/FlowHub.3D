import {
  CalibrationFilament,
  CalibrationPrinter,
  CalibrationValues,
  SLICER_FULL_LABELS,
  Slicer,
} from "@/lib/api/calibration";

// Guia de calibração por fatiador: cinco testes na ordem que importa. O texto
// cita os valores do rolo escolhido em vez de marcadores genéricos.

export type GuideContext = {
  filament: CalibrationFilament;
  printer?: CalibrationPrinter;
  slicer: Slicer;
  /** Valores já anotados nos passos concluídos: passo → campo → valor. */
  results: Partial<Record<GuideStepId, Record<string, string>>>;
};

export type GuideStepId =
  "temperature" | "flow" | "pressureAdvance" | "retraction" | "maxFlow";

export type GuideField = {
  key: string;
  label: string;
  unit?: string;
  placeholder: string | ((ctx: GuideContext) => string);
  /** Casas depois da vírgula; 0 = inteiro. */
  decimals: number;
  /** Valor da calibração que este campo preenche, quando há um. */
  target?: keyof CalibrationValues;
};

/** Família do guia: o Anycubic Slicer Next é baseado no Orca e segue os
 * mesmos testes e menus. */
export type SlicerFamily = "ORCA" | "CREALITY";

export function slicerFamily(slicer: Slicer): SlicerFamily {
  return slicer === "CREALITY" ? "CREALITY" : "ORCA";
}

/** Texto igual nas duas famílias, ou um para cada. */
export type SlicerText = string | Record<SlicerFamily, string>;

export function forSlicer(text: SlicerText, slicer: Slicer) {
  return typeof text === "string" ? text : text[slicerFamily(slicer)];
}

/** Texto da família do fatiador, com "Orca Slicer" trocado pelo nome dele. */
export function forSlicerFamily(
  text: Partial<Record<SlicerFamily, string>>,
  slicer: Slicer,
) {
  return text[slicerFamily(slicer)]?.replaceAll(
    "Orca Slicer",
    SLICER_FULL_LABELS[slicer],
  );
}

export type GuideStep = {
  id: GuideStepId;
  title: string;
  /** Nome do teste no fatiador, entre parênteses no título do passo. */
  testName?: SlicerText;
  summary: SlicerText;
  /** Valores anotados ao concluir o teste, lado a lado. */
  fields: GuideField[];
  /** Resumo dos valores na trilha de testes; sem ele, junta com " · ". */
  summarize?: (values: Record<string, string>) => string;
  howTo: (ctx: GuideContext) => string[];
  analyze: string[] | ((ctx: GuideContext) => string[]);
  applyAt: Record<SlicerFamily, string>;
  /** Instrução final, no lugar de "Onde aplicar" quando o passo tem. */
  whatToDo?: Record<SlicerFamily, string>;
  /** Dica em destaque, depois do bloco de valores. */
  tip?: Partial<Record<SlicerFamily, string>>;
  /** Trecho do vídeo de referência que mostra este passo. */
  video?: SlicerText;
};

/** Vídeo com o passo a passo completo de cada fatiador. */
export const GUIDE_VIDEOS: Record<Slicer, string> = {
  ORCA: "https://www.youtube.com/watch?v=gVU5If1VsAM",
  CREALITY: "https://www.youtube.com/watch?v=l8cSIx0D-L8",
  // Baseado no Orca: o mesmo vídeo vale.
  ANYCUBIC: "https://www.youtube.com/watch?v=gVU5If1VsAM",
};

export type MaterialDefaults = {
  nozzleRange: [number, number];
  bedTemp: number;
};

// Faixa típica do material, pelo nome do tipo ("PLA Silk", "PETG"...). Só
// vale quando o filamento não tem a faixa do fabricante cadastrada.
export function materialDefaults(type: string): MaterialDefaults {
  const t = type.toLowerCase();
  if (t.includes("petg")) return { nozzleRange: [230, 250], bedTemp: 80 };
  if (t.includes("abs") || t.includes("asa"))
    return { nozzleRange: [240, 260], bedTemp: 100 };
  if (t.includes("tpu")) return { nozzleRange: [210, 230], bedTemp: 40 };
  if (t.includes("silk")) return { nozzleRange: [200, 230], bedTemp: 60 };
  return { nozzleRange: [190, 220], bedTemp: 60 };
}

export type FilamentTemps = {
  nozzle: { range: [number, number]; fromManufacturer: boolean };
  bed: { range: [number, number]; fromManufacturer: boolean };
};

// Com só um dos limites cadastrado, a faixa vira esse valor.
function manufacturerRange(
  min: number | null | undefined,
  max: number | null | undefined,
): [number, number] | null {
  if (min == null && max == null) return null;
  return [min ?? max!, max ?? min!];
}

/**
 * Faixas de bico e mesa do rolo: as do fabricante, cadastradas no filamento,
 * e a típica do material só para o que não estiver cadastrado.
 */
export function filamentTemps(filament: CalibrationFilament): FilamentTemps {
  const typical = materialDefaults(filament.type);
  const nozzle = manufacturerRange(
    filament.nozzleTempMin,
    filament.nozzleTempMax,
  );
  const bed = manufacturerRange(filament.bedTempMin, filament.bedTempMax);
  return {
    nozzle: {
      range: nozzle ?? typical.nozzleRange,
      fromManufacturer: !!nozzle,
    },
    bed: {
      range: bed ?? [typical.bedTemp, typical.bedTemp],
      fromManufacturer: !!bed,
    },
  };
}

export function formatTempRange([min, max]: [number, number]) {
  return min === max ? `${min} °C` : `${min}–${max} °C`;
}

/** Meio da faixa, arredondado para múltiplo de 5 (190–220 → 205). */
export function middleOf([min, max]: [number, number]) {
  return Math.round((min + max) / 2 / 5) * 5;
}

/** Temperatura anotada no teste de temperatura, ou o meio da faixa do rolo. */
export function guideNozzleTemp(ctx: GuideContext) {
  const found = ctx.results.temperature?.nozzleTemp?.trim();
  if (found) return found;
  return String(middleOf(filamentTemps(ctx.filament).nozzle.range));
}

/** Tipo de filamento como o fatiador escreve: "PLA Matte" → "pla_matte". */
function slicerFilamentType(ctx: GuideContext) {
  return ctx.filament.type.trim().toLowerCase().replace(/\s+/g, "_");
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "temperature",
    title: "Temperatura do bico",
    testName: { ORCA: "Temperature Tower", CREALITY: "Torre de Temperatura" },
    summary: {
      ORCA: "Determina a melhor temperatura para equilibrar acabamento visual e resistência mecânica.",
      CREALITY: "Ajusta a temperatura ideal do bico para o seu filamento.",
    },
    fields: [
      {
        key: "bedTempFirstLayer",
        target: "bedTempFirstLayer",
        label: "Mesa inicial",
        unit: "°C",
        decimals: 0,
        placeholder: (ctx) =>
          String(middleOf(filamentTemps(ctx.filament).bed.range)),
      },
      {
        key: "bedTemp",
        target: "bedTemp",
        label: "Mesa final",
        unit: "°C",
        decimals: 0,
        placeholder: (ctx) =>
          String(middleOf(filamentTemps(ctx.filament).bed.range)),
      },
      {
        key: "nozzleTempInitial",
        target: "nozzleTempInitial",
        label: "Bico inicial",
        unit: "°C",
        decimals: 0,
        placeholder: (ctx) =>
          String(middleOf(filamentTemps(ctx.filament).nozzle.range)),
      },
      {
        key: "nozzleTemp",
        target: "nozzleTemp",
        label: "Bico final",
        unit: "°C",
        decimals: 0,
        placeholder: (ctx) =>
          String(middleOf(filamentTemps(ctx.filament).nozzle.range)),
      },
    ],
    summarize: (v) =>
      `Mesa ${v.bedTempFirstLayer}/${v.bedTemp} · Bico ${v.nozzleTempInitial}/${v.nozzleTemp} °C`,
    howTo: (ctx) => {
      const { range, fromManufacturer } = filamentTemps(ctx.filament).nozzle;
      const [min, max] = range;
      const source = fromManufacturer
        ? "a recomendação do fabricante"
        : "a faixa típica do material";
      const temps = `**Start Temp ${max} °C** e **End Temp ${min} °C**`;
      return slicerFamily(ctx.slicer) === "ORCA"
        ? [
            `No ${SLICER_FULL_LABELS[ctx.slicer]}, selecione um perfil genérico do mesmo material do filamento a ser calibrado (**${ctx.filament.type}**).`,
            "Vá no menu superior em **Calibration › Temperature**.",
            `Selecione o tipo de filamento como **${slicerFilamentType(ctx)}**.`,
            `Preencha as configurações com ${source}: ${temps}.`,
            "Fatie e envie para impressão.",
          ]
        : [
            "No menu do Creality Print, vá em **Calibração › Temperatura**.",
            `Selecione o tipo de filamento como **${slicerFilamentType(ctx)}**.`,
            `Preencha as configurações com ${source}: ${temps}.`,
            "Clique em **OK** para gerar o modelo da Torre de Temperatura e clique em **Fatiar / Imprimir**.",
          ];
    },
    analyze: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "Observe: pontes (bridging), cantos, fiapos (stringing) e paredes externas.",
            "Escolha a temperatura que entregar a melhor combinação de acabamento.",
            "Em caso de dúvida entre duas temperaturas, prefira a mais alta — isso garante melhor fusão entre camadas e peças mais resistentes.",
          ]
        : [
            "Observe as teias de aranha (stringing), o acabamento das pontes (bridges) e o balanço (overhang).",
            "Identifique a temperatura da zona que teve a menor quantidade de teias e a melhor qualidade nas camadas.",
          ],
    applyAt: {
      ORCA: "Filament Settings › Filament › Nozzle temperature",
      CREALITY: "Filamento › Print Temperature",
    },
    whatToDo: {
      ORCA: "Vá em Filament Settings › altere a temperatura › salve com um novo nome.",
      CREALITY:
        "Na aba lateral, clique no ícone de lápis ao lado do seu filamento, procure por Print Temperature, insira o valor encontrado na torre e salve.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=132",
  },
  {
    id: "maxFlow",
    title: "Vazão volumétrica máxima",
    testName: { ORCA: "Max Volumetric Speed", CREALITY: "Max Flow Rate" },
    summary: {
      ORCA: "Define a quantidade máxima de plástico que sua impressora consegue derreter e empurrar por segundo sem perder qualidade.",
      CREALITY:
        "Descobre o limite de velocidade em que a sua impressora consegue derreter o filamento mantendo a qualidade.",
    },
    fields: [
      {
        key: "maxVolumetricSpeed",
        target: "maxVolumetricSpeed",
        label: "Vazão máxima",
        unit: "mm³/s",
        placeholder: "18",
        decimals: 2,
      },
    ],
    howTo: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            `Selecione o perfil de filamento com a temperatura já ajustada (bico **${guideNozzleTemp(ctx)} °C**).`,
            "Acesse **Calibration › Max Flow Rate**.",
            "Mantenha os valores padrão e imprima o modelo.",
          ]
        : [
            "Vá em **Calibração › Max Volume Flow** e clique em **OK**.",
            "Imprima a peça de teste (leva cerca de **40 min**).",
          ],
    analyze: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "Procure a altura onde começam os primeiros defeitos de extrusão ou perda de brilho no plástico.",
            "Meça com um paquímetro a distância (em mm) da base até a altura do defeito.",
            `No ${SLICER_FULL_LABELS[ctx.slicer]} (na aba Preview), altere a visualização superior para Flow.`,
            "Arraste a barra vertical até a altura medida para ver a vazão referente àquele ponto.",
            "Subtraia de 10% a 20% desse valor para ter uma margem de segurança.",
          ]
        : [
            "Com uma régua ou paquímetro, meça a altura da peça (a partir da base) até o ponto exato onde a impressão começa a perder qualidade ou espaçar camadas (exemplo: 27 mm).",
            "Calcule o fluxo volumétrico: 5 + (medida em mm × 0.5). Exemplo: 5 + (27 × 0.5) = 18.5.",
          ],
    applyAt: {
      ORCA: "Filament Settings › Max volumetric speed",
      CREALITY: "Filamento › Advance › Max Volumetric Speed",
    },
    whatToDo: {
      ORCA: "Vá em Filament Settings › Max Volumetric Speed › insira o novo valor e salve.",
      CREALITY:
        "Abra o perfil do filamento (ícone do lápis), ative a opção Advance e insira o resultado no campo Max Volumetric Speed. Salve.",
    },
    tip: {
      ORCA: "Antes de salvar, feche e abra o Orca Slicer novamente para não salvar com os valores usados no teste.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=254",
  },
  {
    id: "pressureAdvance",
    title: "Pressure Advance",
    testName: "Fator K",
    summary: {
      ORCA: "Evita cantos arredondados, acúmulos de plástico ou falhas ao acelerar e desacelerar a impressora.",
      CREALITY:
        "Evita acúmulo de material ou cantos arredondados nas quinas da impressão.",
    },
    fields: [
      {
        key: "pressureAdvance",
        target: "pressureAdvance",
        label: "PA Value",
        placeholder: "0,024",
        decimals: 3,
      },
    ],
    howTo: (ctx) => {
      const extruder = ctx.printer?.extrusionType
        ? `(a ${ctx.printer.name} é **${ctx.printer.extrusionType}**)`
        : "(**Direct Drive** ou **Bowden**)";
      return slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "Vá em **Calibration › Pressure Advance**.",
            `Selecione o seu tipo de extrusor ${extruder}.`,
            "Escolha o teste no formato **PA Pattern**.",
            "Defina no teste a mesma velocidade e aceleração que você costuma usar para paredes externas (ex: **200 mm/s** e **5000 mm/s²**).",
            "Imprima o teste.",
          ]
        : [
            "Vá em **Calibração › Pressure Advance › PA Line**.",
            `Selecione o tipo da sua impressora ${extruder}.`,
            "Imprima a peça com o padrão de linhas.",
          ];
    },
    analyze: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "Olhe para as quinas das linhas impressas.",
            "Encontre a linha onde a quina está o mais reta e afiada possível, sem falhas ou excesso de plástico.",
            "Identifique o número (PA Value) correspondente a essa linha.",
          ]
        : [
            "Observe as linhas impressas.",
            "Escolha a linha que está com a largura mais uniforme e contínua (sem falhas de material ou bolhas de acúmulo).",
          ],
    applyAt: {
      ORCA: "Filament Settings › Enable pressure advance",
      CREALITY: "Filamento › Enable Pressure Advance",
    },
    whatToDo: {
      ORCA: "Em Filament Settings, ative a opção Pressure Advance › insira o valor e salve.",
      CREALITY:
        "No perfil do filamento (ícone do lápis), marque Enable Pressure Advance, insira o número da linha escolhida (ex.: 0.044) e salve.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=454",
  },
  {
    id: "flow",
    title: "Taxa de fluxo",
    testName: "Flow Ratio",
    summary: {
      ORCA: "Garante que a espessura de cada linha seja exata, evitando que a peça fique superdimensionada ou com lacunas.",
      CREALITY:
        "Ajusta a quantidade exata de filamento que o bico deve expelir, em duas etapas.",
    },
    fields: [
      {
        key: "flow",
        target: "flow",
        label: "Flow Ratio",
        placeholder: "0,98",
        decimals: 3,
      },
    ],
    howTo: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "Vá em **Calibration › Flow Rate › YOLO (Recommended)**.",
            "Imprima as amostras numéricas.",
          ]
        : [
            "**Passo 2.1 (ajuste básico):** vá em **Calibração › Fluxo › Passo 1** e imprima as peças do teste.",
            "**Passo 2.2 (ajuste fino):** vá em **Calibração › Fluxo › Passo 2**, selecione o número da peça escolhida no Passo 2.1 e imprima o novo teste.",
          ],
    analyze: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "Procure o quadrado com a superfície superior mais lisa e uniforme, sem ranhuras (excesso) e sem frestas entre as linhas (falta).",
            "Some/subtraia o valor escolhido ao seu Flow Ratio atual (ex.: se o atual é 1.0 e a melhor amostra foi -0.02, o novo valor será 0.98).",
          ]
        : [
            "Passo 2.1: escolha a peça mais lisa e sem lacunas visíveis no topo (exemplo: peça escolhida = +15).",
            "Passo 2.2: passe a unha pelas peças e escolha a que estiver lisa ao toque e com linhas perfeitamente unidas (exemplo: peça escolhida = -5).",
          ],
    applyAt: {
      ORCA: "Filament Settings › Flow ratio",
      CREALITY: "Filamento › Flow Ratio",
    },
    whatToDo: {
      ORCA: "Atualize o campo Flow Ratio nas configurações do filamento e salve.",
      CREALITY:
        "Some os dois resultados (exemplo: 15 + (-5) = 10) e adicione essa porcentagem ao Flow Ratio atual no perfil do filamento (ícone do lápis) — ex.: se era 0.95, somando 10% o novo valor será 1.05. Salve.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=785",
  },
  {
    id: "retraction",
    title: "Distância de retração",
    testName: { ORCA: "Retraction Distance", CREALITY: "Torre de Retração" },
    summary: {
      ORCA: 'Evita a "teia de aranha" (stringing) e pequenos relevos na superfície.',
      CREALITY:
        'Ajusta o "puxão" de filamento para evitar teias ao mover o cabeçote.',
    },
    fields: [
      {
        key: "retractionDistance",
        target: "retractionDistance",
        label: "Retraction Length",
        unit: "mm",
        placeholder: "0,8",
        decimals: 2,
      },
    ],
    howTo: (ctx) => {
      const type = ctx.printer?.extrusionType?.toLowerCase();
      const name = ctx.printer?.name;
      if (ctx.slicer === "CREALITY") {
        const directDrive = "**Começo 0.1**, **Fim 2.0**, **Passo 0.1**";
        const bowden = "**Começo 1.0**, **Fim 4.0**, **Passo 0.2**";
        const values =
          type === "bowden"
            ? `A ${name} é **Bowden**: preencha ${bowden}.`
            : type === "direct drive"
              ? `A ${name} é **Direct Drive**: preencha ${directDrive}.`
              : `Preencha os valores sugeridos: **Direct Drive** (${directDrive}) ou **Bowden** (${bowden}).`;
        return [
          "Vá em **Calibração › Retração › Distância**.",
          values,
          "Imprima a Torre de Retração.",
        ];
      }
      const extruder =
        type === "bowden"
          ? `A ${name} é **Bowden**: defina o limite final para **6 mm**.`
          : type === "direct drive"
            ? `A ${name} é **Direct Drive**: mantenha os padrões.`
            : "Para impressoras **Direct Drive**, mantenha os padrões. Para **Bowden**, defina o limite final para **6 mm**.";
      return [
        "Vá em **Calibration › Retraction**.",
        extruder,
        "Imprima o teste.",
      ];
    },
    analyze: (ctx) =>
      slicerFamily(ctx.slicer) === "ORCA"
        ? [
            "O teste imprime anéis empilhados. Identifique a altura do primeiro anel onde o stringing desaparece completamente.",
            "Verifique no fatiador qual comprimento de retração corresponde àquela altura.",
          ]
        : [
            "Olhe as marcações nas hastes da torre (cada degrau é um step de incremento).",
            "Identifique o degrau mais baixo onde as teias desapareceram totalmente.",
          ],
    applyAt: {
      ORCA: "Filament Settings › Setting overrides › Retraction length",
      CREALITY: "Configurações da Impressora › Extruder 1 › Retraction Length",
    },
    whatToDo: {
      ORCA: "Em Filament Settings › aba Setting Override › ative e ajuste o Retraction Length.",
      CREALITY:
        "Em Configurações da Impressora (ícone da impressora › lápis) › Extruder 1, insira o valor do degrau identificado em Retraction Length e salve.",
    },
    tip: {
      CREALITY:
        "Se as teias continuarem fortes em toda a torre, o seu filamento provavelmente está com umidade. Seque o filamento antes de tentar novamente.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=912",
  },
];

// Cada fatiador tem a sua ordem de testes.
const GUIDE_STEP_ORDER: Record<SlicerFamily, GuideStepId[]> = {
  ORCA: ["temperature", "maxFlow", "pressureAdvance", "flow", "retraction"],
  CREALITY: ["temperature", "flow", "pressureAdvance", "retraction", "maxFlow"],
};

/** Testes do guia na ordem do fatiador. */
export function guideSteps(slicer: Slicer): GuideStep[] {
  return GUIDE_STEP_ORDER[slicerFamily(slicer)].map(
    (id) => GUIDE_STEPS.find((s) => s.id === id)!,
  );
}
