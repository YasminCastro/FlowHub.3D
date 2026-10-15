import {
  CalibrationFilament,
  CalibrationPrinter,
  CalibrationValues,
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

export type GuideStep = {
  id: GuideStepId;
  title: string;
  /** Nome do teste no fatiador, entre parênteses no título do passo. */
  testName?: string;
  summary: string;
  /** Valores anotados ao concluir o teste, lado a lado. */
  fields: GuideField[];
  /** Resumo dos valores na trilha de testes; sem ele, junta com " · ". */
  summarize?: (values: Record<string, string>) => string;
  howTo: (ctx: GuideContext) => string[];
  analyze: string[] | ((ctx: GuideContext) => string[]);
  applyAt: Record<Slicer, string>;
  /** Instrução final, no lugar de "Onde aplicar" quando o passo tem. */
  whatToDo?: Record<Slicer, string>;
  /** Dica em destaque, depois do bloco de valores. */
  tip?: Record<Slicer, string>;
  /** Trecho do vídeo de referência que mostra este passo. */
  video?: string;
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
    testName: "Temperature Tower",
    summary:
      "Determina a melhor temperatura para equilibrar acabamento visual e resistência mecânica.",
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
      return ctx.slicer === "ORCA"
        ? [
            `No Orca Slicer, selecione um perfil genérico do mesmo material do filamento a ser calibrado (**${ctx.filament.type}**).`,
            "Vá no menu superior em **Calibration › Temperature**.",
            `Selecione o tipo de filamento como **${slicerFilamentType(ctx)}**.`,
            `Preencha as configurações com ${source}: ${temps}.`,
            "Fatie e envie para impressão.",
          ]
        : [
            `No Creality Print, selecione um perfil genérico do mesmo material do filamento a ser calibrado (**${ctx.filament.type}**).`,
            "Vá no menu superior em **Calibração › Temperatura**.",
            `Preencha as configurações com ${source}: ${temps}.`,
            "Fatie e envie para impressão.",
          ];
    },
    analyze: [
      "Observe: pontes (bridging), cantos, fiapos (stringing) e paredes externas.",
      "Escolha a temperatura que entregar a melhor combinação de acabamento.",
      "Em caso de dúvida entre duas temperaturas, prefira a mais alta — isso garante melhor fusão entre camadas e peças mais resistentes.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Filament › Nozzle temperature",
      CREALITY: "Filamento › Temperatura do bico",
    },
    whatToDo: {
      ORCA: "Vá em Filament Settings › altere a temperatura › salve com um novo nome.",
      CREALITY:
        "Vá nas configurações do filamento › altere a temperatura › salve com um novo nome.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=132",
  },
  {
    id: "maxFlow",
    title: "Vazão volumétrica máxima",
    testName: "Max Volumetric Speed",
    summary:
      "Define a quantidade máxima de plástico que sua impressora consegue derreter e empurrar por segundo sem perder qualidade.",
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
      ctx.slicer === "ORCA"
        ? [
            `Selecione o perfil de filamento com a temperatura já ajustada (bico **${guideNozzleTemp(ctx)} °C**).`,
            "Acesse **Calibration › Max Flow Rate**.",
            "Mantenha os valores padrão e imprima o modelo.",
          ]
        : [
            `Selecione o perfil de filamento com a temperatura já ajustada (bico **${guideNozzleTemp(ctx)} °C**).`,
            "Acesse **Calibração › Velocidade volumétrica máxima**.",
            "Mantenha os valores padrão e imprima o modelo.",
          ],
    analyze: (ctx) => [
      "Procure a altura onde começam os primeiros defeitos de extrusão ou perda de brilho no plástico.",
      "Meça com um paquímetro a distância (em mm) da base até a altura do defeito.",
      ctx.slicer === "ORCA"
        ? "No Orca Slicer (na aba Preview), altere a visualização superior para Flow."
        : "No Creality Print (na pré-visualização), altere a visualização para Fluxo.",
      "Arraste a barra vertical até a altura medida para ver a vazão referente àquele ponto.",
      "Subtraia de 10% a 20% desse valor para ter uma margem de segurança.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Max volumetric speed",
      CREALITY: "Filamento › Velocidade volumétrica máxima",
    },
    whatToDo: {
      ORCA: "Vá em Filament Settings › Max Volumetric Speed › insira o novo valor e salve.",
      CREALITY:
        "Vá nas configurações do filamento › Velocidade volumétrica máxima › insira o novo valor e salve.",
    },
    tip: {
      ORCA: "Antes de salvar, feche e abra o Orca Slicer novamente para não salvar com os valores usados no teste.",
      CREALITY:
        "Antes de salvar, feche e abra o Creality Print novamente para não salvar com os valores usados no teste.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=254",
  },
  {
    id: "pressureAdvance",
    title: "Pressure Advance",
    testName: "Fator K",
    summary:
      "Evita cantos arredondados, acúmulos de plástico ou falhas ao acelerar e desacelerar a impressora.",
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
      return [
        ctx.slicer === "ORCA"
          ? "Vá em **Calibration › Pressure Advance**."
          : "Vá em **Calibração › Pressure Advance**.",
        `Selecione o seu tipo de extrusor ${extruder}.`,
        "Escolha o teste no formato **PA Pattern**.",
        "Defina no teste a mesma velocidade e aceleração que você costuma usar para paredes externas (ex: **200 mm/s** e **5000 mm/s²**).",
        "Imprima o teste.",
      ];
    },
    analyze: [
      "Olhe para as quinas das linhas impressas.",
      "Encontre a linha onde a quina está o mais reta e afiada possível, sem falhas ou excesso de plástico.",
      "Identifique o número (PA Value) correspondente a essa linha.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Enable pressure advance",
      CREALITY: "Filamento › Pressure advance",
    },
    whatToDo: {
      ORCA: "Em Filament Settings, ative a opção Pressure Advance › insira o valor e salve.",
      CREALITY:
        "Nas configurações do filamento, ative a opção Pressure Advance › insira o valor e salve.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=454",
  },
  {
    id: "flow",
    title: "Taxa de fluxo",
    testName: "Flow Ratio",
    summary:
      "Garante que a espessura de cada linha seja exata, evitando que a peça fique superdimensionada ou com lacunas.",
    fields: [
      {
        key: "flow",
        target: "flow",
        label: "Flow Ratio",
        placeholder: "0,98",
        decimals: 3,
      },
    ],
    howTo: (ctx) => [
      ctx.slicer === "ORCA"
        ? "Vá em **Calibration › Flow Rate › YOLO (Recommended)**."
        : "Vá em **Calibração › Fluxo**.",
      "Imprima as amostras numéricas.",
    ],
    analyze: [
      "Procure o quadrado com a superfície superior mais lisa e uniforme, sem ranhuras (excesso) e sem frestas entre as linhas (falta).",
      "Some/subtraia o valor escolhido ao seu Flow Ratio atual (ex.: se o atual é 1.0 e a melhor amostra foi -0.02, o novo valor será 0.98).",
    ],
    applyAt: {
      ORCA: "Filament Settings › Flow ratio",
      CREALITY: "Filamento › Taxa de fluxo",
    },
    whatToDo: {
      ORCA: "Atualize o campo Flow Ratio nas configurações do filamento e salve.",
      CREALITY:
        "Atualize o campo de taxa de fluxo nas configurações do filamento e salve.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=785",
  },
  {
    id: "retraction",
    title: "Distância de retração",
    testName: "Retraction Distance",
    summary:
      'Evita a "teia de aranha" (stringing) e pequenos relevos na superfície.',
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
      const extruder =
        type === "bowden"
          ? `A ${name} é **Bowden**: defina o limite final para **6 mm**.`
          : type === "direct drive"
            ? `A ${name} é **Direct Drive**: mantenha os padrões.`
            : "Para impressoras **Direct Drive**, mantenha os padrões. Para **Bowden**, defina o limite final para **6 mm**.";
      return [
        ctx.slicer === "ORCA"
          ? "Vá em **Calibration › Retraction**."
          : "Vá em **Calibração › Retração**.",
        extruder,
        "Imprima o teste.",
      ];
    },
    analyze: [
      "O teste imprime anéis empilhados. Identifique a altura do primeiro anel onde o stringing desaparece completamente.",
      "Verifique no fatiador qual comprimento de retração corresponde àquela altura.",
    ],
    applyAt: {
      ORCA: "Filament Settings › Setting overrides › Retraction length",
      CREALITY: "Filamento › Sobrescrever › Comprimento de retração",
    },
    whatToDo: {
      ORCA: "Em Filament Settings › aba Setting Override › ative e ajuste o Retraction Length.",
      CREALITY:
        "Nas configurações do filamento › aba de sobrescrever configurações › ative e ajuste o comprimento de retração.",
    },
    video: "https://youtu.be/gVU5If1VsAM?t=912",
  },
];
