import {
  AccessorySubStyle,
  DEFAULT_GARMENT_EXTRAS,
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  JumpsuitSubStyle,
  KidsSubStyle,
  LoungewearSubStyle,
  NecklineStyle,
  PantsSubStyle,
  QuickLengthPreset,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
  TracingPins,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "../types";
import type { TipoEstampado, TipoTela } from "../3d/types";
import type { DominantColorResult } from "./colorExtractor";
import {
  CategoryPromptId,
  EvaluatedPromptGroup,
  FitPromptId,
  HIGH_CONFIDENCE_THRESHOLD,
  LengthPromptId,
  NecklinePromptId,
  PantsCutPromptId,
  RufflePromptId,
  SkirtCutPromptId,
  SleevePromptId,
  ValidityPromptId,
  WaistTiePromptId,
} from "./garmentPrompts";

export interface DetectedGarmentConfig {
  category: GarmentCategory;
  topSubStyle?: TopSubStyle;
  pantsSubStyle?: PantsSubStyle;
  skirtSubStyle?: SkirtSubStyle;
  dressSubStyle?: DressSubStyle;
  twoPieceTopStyle?: TwoPieceTopStyle;
  twoPieceBottomStyle?: TwoPieceBottomStyle;
  jumpsuitSubStyle?: JumpsuitSubStyle;
  kidsSubStyle?: KidsSubStyle;
  loungewearSubStyle?: LoungewearSubStyle;
  accessorySubStyle?: AccessorySubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  torsoFit: TorsoFit;
  extras: GarmentExtras;
  quickLength: QuickLengthPreset;
  styleVariant: StyleVariant;
  fabricType?: FabricType;
  apariencia3D?: {
    color: string;
    tela: TipoTela;
    estampado: TipoEstampado;
  };
  autoPins?: TracingPins;
}

export interface DetectedAttributeCandidate {
  id: string;
  label: string;
  confidence: number;
}

export type DetectedAttributeKey =
  | "category"
  | "neckline"
  | "sleeve"
  | "fit"
  | "skirtCut"
  | "pantsCut"
  | "length"
  | "waistTie"
  | "hemRuffle"
  | "fabric"
  | "print";

export interface DetectedAttributeItem {
  key: DetectedAttributeKey;
  titleEs: string;
  selectedId: string;
  selectedLabel: string;
  confidence: number;
  esAltaConfianza: boolean;
  reglaAplicada?: string;
  top2Opciones: [DetectedAttributeCandidate, DetectedAttributeCandidate] | null;
}

export interface DetectedAttributeScores {
  category: { label: string; score: number };
  sleeve: { label: string; score: number };
  torsoFit: { label: string; score: number };
  neckline: { label: string; score: number };
  waistTieConfidence: number;
  hemRuffleConfidence: number;
}

export interface RawVisionEvaluation {
  modelId: string;
  backend: "webgpu" | "wasm";
  cropTrimmedBars: boolean;
  validity: EvaluatedPromptGroup<ValidityPromptId>;
  category: EvaluatedPromptGroup<CategoryPromptId>;
  neckline?: EvaluatedPromptGroup<NecklinePromptId>;
  sleeves?: EvaluatedPromptGroup<SleevePromptId>;
  fit: EvaluatedPromptGroup<FitPromptId>;
  length?: EvaluatedPromptGroup<LengthPromptId>;
  skirtCut?: EvaluatedPromptGroup<SkirtCutPromptId>;
  pantsCut?: EvaluatedPromptGroup<PantsCutPromptId>;
  waistTie?: EvaluatedPromptGroup<WaistTiePromptId>;
  ruffle?: EvaluatedPromptGroup<RufflePromptId>;
  fabric: EvaluatedPromptGroup<TipoTela>;
  print: EvaluatedPromptGroup<TipoEstampado>;
  colorDominante: DominantColorResult;
  autoPinsByCategory?: Record<GarmentCategory, TracingPins>;
}

export interface TailoredVisionOutput {
  config: DetectedGarmentConfig;
  scores: DetectedAttributeScores;
  atributosConConfianza: DetectedAttributeItem[];
  colorDominante: DominantColorResult;
  esPrendaValida: boolean;
  avisoBajaValidez?: string;
  reglasAplicadas: string[];
  modelId: string;
  backend: "webgpu" | "wasm";
  cropTrimmedBars: boolean;
  autoPinsByCategory?: Record<GarmentCategory, TracingPins>;
}

function top2DesdeGrupo<T extends string>(
  grupo: EvaluatedPromptGroup<T>
): [DetectedAttributeCandidate, DetectedAttributeCandidate] | null {
  if (!grupo.top2) return null;
  return [
    {
      id: grupo.top1.id,
      label: grupo.top1.labelEs,
      confidence: grupo.top1.confidence,
    },
    {
      id: grupo.top2.id,
      label: grupo.top2.labelEs,
      confidence: grupo.top2.confidence,
    },
  ];
}

function buildAttributeItem<T extends string>(
  key: DetectedAttributeKey,
  titleEs: string,
  grupo: EvaluatedPromptGroup<T>,
  overrideId?: string,
  overrideLabel?: string,
  reglaAplicada?: string
): DetectedAttributeItem {
  const chosenId = overrideId ?? grupo.top1.id;
  const matched = grupo.all.find((x) => x.id === chosenId) ?? grupo.top1;
  const conf = matched.confidence;
  return {
    key,
    titleEs,
    selectedId: chosenId,
    selectedLabel: overrideLabel ?? matched.labelEs,
    confidence: conf,
    esAltaConfianza: reglaAplicada ? true : conf >= HIGH_CONFIDENCE_THRESHOLD,
    reglaAplicada,
    top2Opciones: top2DesdeGrupo(grupo),
  };
}

function mapCategoryAndSubStyles(
  catId: CategoryPromptId,
  raw: RawVisionEvaluation
): Pick<
  DetectedGarmentConfig,
  | "category"
  | "topSubStyle"
  | "pantsSubStyle"
  | "skirtSubStyle"
  | "dressSubStyle"
  | "twoPieceTopStyle"
  | "twoPieceBottomStyle"
  | "jumpsuitSubStyle"
  | "accessorySubStyle"
> {
  switch (catId) {
    case "bucketHat":
      return {
        category: "accessories",
        accessorySubStyle: "bucket_hat",
      };
    case "falda":
      return {
        category: "skirt",
        skirtSubStyle: raw.skirtCut?.top1.id ?? "a_line",
      };
    case "pantalon":
      return {
        category: "pants",
        pantsSubStyle: raw.pantsCut?.top1.id ?? "wide",
      };
    case "blusa":
      return {
        category: "top",
        topSubStyle: "blouse",
      };
    case "chaqueta":
      return {
        category: "top",
        topSubStyle: "jacket",
      };
    case "conjunto":
      return {
        category: "two_piece",
        twoPieceTopStyle:
          raw.fit.top1.id === "loose" ? "waist_blouse" : "crop_top",
        twoPieceBottomStyle:
          raw.skirtCut?.top1.id === "straight" ? "straight_skirt" : "aline_skirt",
      };
    case "enterizo":
      return {
        category: "jumpsuit",
        jumpsuitSubStyle:
          raw.length?.top1.id === "short" ? "romper_short" : "romper_long",
      };
    case "vestido":
    default:
      return {
        category: "dress",
        dressSubStyle: "dress",
        skirtSubStyle: raw.skirtCut?.top1.id ?? "a_line",
      };
  }
}

function mapNeckline(id?: NecklinePromptId): {
  necklineStyle: NecklineStyle;
  wrapFront: boolean;
} {
  switch (id) {
    case "wrap":
      return { necklineStyle: "v_neck", wrapFront: true };
    case "v_neck":
      return { necklineStyle: "v_neck", wrapFront: false };
    case "square":
      return { necklineStyle: "square", wrapFront: false };
    case "tailored_lapel":
      return { necklineStyle: "tailored_lapel", wrapFront: false };
    case "shirt_collar":
      return { necklineStyle: "shirt_collar", wrapFront: false };
    case "high":
      return { necklineStyle: "high", wrapFront: false };
    case "round":
    default:
      return { necklineStyle: "round", wrapFront: false };
  }
}

function mapSleeve(
  sleeveGroup?: EvaluatedPromptGroup<SleevePromptId>
): { sleeveStyle: SleeveStyle; flaredSleeve: boolean } {
  const id = sleeveGroup?.top1.id ?? "short";
  if (id === "kimono") {
    return { sleeveStyle: "kimono", flaredSleeve: false };
  }
  if (id === "farol") {
    return { sleeveStyle: "long", flaredSleeve: true };
  }
  if (id === "acampanada") {
    const scoreLong =
      sleeveGroup?.all.find((s) => s.id === "long")?.confidence ?? 0;
    const scoreShort =
      sleeveGroup?.all.find((s) => s.id === "short")?.confidence ?? 0;
    return {
      sleeveStyle: scoreLong >= scoreShort ? "long" : "short",
      flaredSleeve: true,
    };
  }
  if (id === "long") {
    return { sleeveStyle: "long", flaredSleeve: false };
  }
  if (id === "sleeveless") {
    return { sleeveStyle: "sleeveless", flaredSleeve: false };
  }
  return { sleeveStyle: "short", flaredSleeve: false };
}

/**
 * Capa determinista post-IA que aplica reglas de coherencia de modistería:
 * 1. `bucketHat` salta directo a accesorios omitiendo atributos corporales.
 * 2. `solapaSastre` (>55%) + categoría blusa/empate con chaqueta -> prioriza `chaqueta`.
 * 3. `falda` y `pantalon` omiten inferencia/etiquetas de escote y mangas.
 * 4. `manga === "kimono"` con confianza >= 55% ajusta silueta a `holgado`
 *    salvo que `entallado` supere el 80%.
 * 5. Mapea tela, estampado y color dominante para el probador 3D y pines 2D.
 */
export function aplicarReglasCoherenciaModisteria(
  raw: RawVisionEvaluation
): TailoredVisionOutput {
  const reglasAplicadas: string[] = [];

  const validScore =
    raw.validity.all.find((v) => v.id === "valid_garment")?.confidence ?? 1;
  const nonGarmentScore =
    raw.validity.all.find((v) => v.id === "non_garment")?.confidence ?? 0;
  const esPrendaValida = !(nonGarmentScore > 0.62 && validScore < 0.38);
  const avisoBajaValidez = esPrendaValida
    ? undefined
    : "No logramos distinguir con claridad una prenda textil en esta imagen. Sube una foto más cercana o iluminada de la prenda.";

  let catFinalId: CategoryPromptId = raw.category.top1.id;
  let reglaCategoria: string | undefined;

  // Regla 3: Solapa Sastre con confianza > 55% prioriza Chaqueta cuando está cerca/empatada con Blusa
  const solapaCand = raw.neckline?.all.find((n) => n.id === "tailored_lapel");
  const solapaConf = solapaCand?.confidence ?? 0;
  const jacketScore =
    raw.category.all.find((c) => c.id === "chaqueta")?.confidence ?? 0;
  const blouseScore =
    raw.category.all.find((c) => c.id === "blusa")?.confidence ?? 0;

  if (
    solapaConf > 0.55 &&
    (catFinalId === "blusa" ||
      (catFinalId !== "vestido" &&
        catFinalId !== "falda" &&
        catFinalId !== "pantalon" &&
        catFinalId !== "bucketHat" &&
        Math.abs(blouseScore - jacketScore) < 0.2))
  ) {
    catFinalId = "chaqueta";
    reglaCategoria = "Solapa sastre (>55%) priorizó Chaqueta";
    reglasAplicadas.push(reglaCategoria);
  }

  // Regla 2: Bucket Hat -> directo a accesorios
  if (catFinalId === "bucketHat") {
    reglasAplicadas.push("Accesorio Bucket Hat: atributos corporales omitidos");
    const telaId = raw.fabric.top1.id;
    const estampadoId = raw.print.top1.id;

    const config: DetectedGarmentConfig = {
      category: "accessories",
      accessorySubStyle: "bucket_hat",
      necklineStyle: "round",
      sleeveStyle: "sleeveless",
      torsoFit: "fitted",
      extras: { ...DEFAULT_GARMENT_EXTRAS },
      quickLength: "photo",
      styleVariant: "default",
      fabricType: telaId === "licra" ? "stretch" : "woven",
      apariencia3D: {
        color: raw.colorDominante.hexDetectado,
        tela: telaId,
        estampado: estampadoId,
      },
      autoPins: raw.autoPinsByCategory?.accessories,
    };

    return {
      config,
      scores: {
        category: { label: "bucketHat", score: raw.category.top1.confidence },
        sleeve: { label: "none", score: 0 },
        torsoFit: { label: "fitted", score: raw.fit.top1.confidence },
        neckline: { label: "none", score: 0 },
        waistTieConfidence: 0,
        hemRuffleConfidence: 0,
      },
      atributosConConfianza: [
        buildAttributeItem(
          "category",
          "Prenda",
          raw.category,
          "bucketHat",
          "Sombrero Bucket Hat"
        ),
        buildAttributeItem("fabric", "Tela", raw.fabric),
        buildAttributeItem("print", "Estampado", raw.print),
      ],
      colorDominante: raw.colorDominante,
      esPrendaValida,
      avisoBajaValidez,
      reglasAplicadas,
      modelId: raw.modelId,
      backend: raw.backend,
      cropTrimmedBars: raw.cropTrimmedBars,
      autoPinsByCategory: raw.autoPinsByCategory,
    };
  }

  const mappedCat = mapCategoryAndSubStyles(catFinalId, raw);
  const esSoloInferior = catFinalId === "falda" || catFinalId === "pantalon";

  if (esSoloInferior) {
    reglasAplicadas.push(
      `Prenda inferior (${catFinalId}): escote y mangas omitidos`
    );
  }

  // Cuello y manga solo para prendas con parte superior
  const neckMapped = esSoloInferior
    ? { necklineStyle: "round" as NecklineStyle, wrapFront: false }
    : mapNeckline(raw.neckline?.top1.id);

  const sleeveMapped = esSoloInferior
    ? { sleeveStyle: "sleeveless" as SleeveStyle, flaredSleeve: false }
    : mapSleeve(raw.sleeves);

  // Regla 4: Manga kimono con alta confianza -> ajusta silueta hacia holgado salvo entalle > 80%
  let torsoFit: TorsoFit = raw.fit.top1.id;
  let reglaFit: string | undefined;
  const kimonoScore =
    raw.sleeves?.all.find((s) => s.id === "kimono")?.confidence ?? 0;
  const fittedScore =
    raw.fit.all.find((f) => f.id === "fitted")?.confidence ?? 0;

  if (
    !esSoloInferior &&
    raw.sleeves?.top1.id === "kimono" &&
    kimonoScore >= 0.55 &&
    fittedScore <= 0.8
  ) {
    if (torsoFit !== "loose") {
      torsoFit = "loose";
      reglaFit = "Manga kimono ajustó caída a Holgado";
      reglasAplicadas.push(reglaFit);
    }
  }

  const beltConfidence =
    raw.waistTie?.all.find((w) => w.id === "with_belt")?.confidence ?? 0;
  const ruffleConfidence =
    raw.ruffle?.all.find((r) => r.id === "with_ruffle")?.confidence ?? 0;

  const waistTie = neckMapped.wrapFront
    ? beltConfidence >= 0.52
    : beltConfidence >= HIGH_CONFIDENCE_THRESHOLD;
  const hemRuffle =
    catFinalId !== "pantalon" && ruffleConfidence >= HIGH_CONFIDENCE_THRESHOLD;

  const extras: GarmentExtras = {
    ...DEFAULT_GARMENT_EXTRAS,
    wrapFront: !esSoloInferior && neckMapped.wrapFront,
    flaredSleeve: !esSoloInferior && sleeveMapped.flaredSleeve,
    waistTie,
    hemRuffle,
  };

  let quickLength: QuickLengthPreset = "photo";
  if (catFinalId === "vestido" || catFinalId === "falda") {
    const lId = raw.length?.top1.id ?? "midi";
    quickLength = lId === "short" ? "mini" : lId === "long" ? "maxi" : "midi";
  }

  const telaId = raw.fabric.top1.id;
  const estampadoId = raw.print.top1.id;

  const rawPinsCat = raw.autoPinsByCategory?.[mappedCat.category];
  const resolvedAutoPins: TracingPins | undefined = rawPinsCat
    ? {
        ...rawPinsCat,
        neckline:
          !esSoloInferior &&
          (neckMapped.wrapFront || neckMapped.necklineStyle === "v_neck")
            ? {
                ...rawPinsCat.neckline,
                y: Number(Math.min(0.88, rawPinsCat.neckline.y + 0.035).toFixed(4)),
              }
            : rawPinsCat.neckline,
      }
    : undefined;

  const config: DetectedGarmentConfig = {
    ...mappedCat,
    necklineStyle: neckMapped.necklineStyle,
    sleeveStyle: sleeveMapped.sleeveStyle,
    torsoFit,
    extras,
    quickLength,
    styleVariant: "default",
    fabricType: telaId === "licra" ? "stretch" : "woven",
    apariencia3D: {
      color: raw.colorDominante.hexDetectado,
      tela: telaId,
      estampado: estampadoId,
    },
    autoPins: resolvedAutoPins,
  };

  const atributosConConfianza: DetectedAttributeItem[] = [
    buildAttributeItem(
      "category",
      "Prenda",
      raw.category,
      catFinalId,
      raw.category.all.find((c) => c.id === catFinalId)?.labelEs,
      reglaCategoria
    ),
  ];

  if (!esSoloInferior && raw.neckline) {
    atributosConConfianza.push(
      buildAttributeItem("neckline", "Escote / Cuello", raw.neckline)
    );
  }
  if (!esSoloInferior && raw.sleeves) {
    atributosConConfianza.push(
      buildAttributeItem("sleeve", "Mangas", raw.sleeves)
    );
  }
  if (!esSoloInferior) {
    atributosConConfianza.push(
      buildAttributeItem(
        "fit",
        "Silueta",
        raw.fit,
        torsoFit,
        torsoFit === "loose" ? "Torso Holgado" : "Torso Entallado",
        reglaFit
      )
    );
  }
  if ((catFinalId === "falda" || catFinalId === "vestido") && raw.skirtCut) {
    atributosConConfianza.push(
      buildAttributeItem("skirtCut", "Vuelo / Falda", raw.skirtCut)
    );
  }
  if (catFinalId === "pantalon" && raw.pantsCut) {
    atributosConConfianza.push(
      buildAttributeItem("pantsCut", "Corte Pantalón", raw.pantsCut)
    );
  }
  if (raw.length && (catFinalId === "vestido" || catFinalId === "falda")) {
    atributosConConfianza.push(
      buildAttributeItem("length", "Largo", raw.length)
    );
  }
  if (raw.waistTie && waistTie) {
    atributosConConfianza.push(
      buildAttributeItem("waistTie", "Cintura", raw.waistTie, "with_belt")
    );
  }
  if (raw.ruffle && hemRuffle) {
    atributosConConfianza.push(
      buildAttributeItem("hemRuffle", "Ruedo", raw.ruffle, "with_ruffle")
    );
  }

  atributosConConfianza.push(buildAttributeItem("fabric", "Tela", raw.fabric));
  atributosConConfianza.push(
    buildAttributeItem("print", "Estampado", raw.print)
  );

  return {
    config,
    scores: {
      category: {
        label: catFinalId,
        score:
          raw.category.all.find((c) => c.id === catFinalId)?.confidence ??
          raw.category.top1.confidence,
      },
      sleeve: {
        label: esSoloInferior ? "omitted" : (raw.sleeves?.top1.id ?? "short"),
        score: esSoloInferior ? 0 : (raw.sleeves?.top1.confidence ?? 0),
      },
      torsoFit: { label: torsoFit, score: raw.fit.top1.confidence },
      neckline: {
        label: esSoloInferior ? "omitted" : (raw.neckline?.top1.id ?? "round"),
        score: esSoloInferior ? 0 : (raw.neckline?.top1.confidence ?? 0),
      },
      waistTieConfidence: beltConfidence,
      hemRuffleConfidence: ruffleConfidence,
    },
    atributosConConfianza,
    colorDominante: raw.colorDominante,
    esPrendaValida,
    avisoBajaValidez,
    reglasAplicadas,
    modelId: raw.modelId,
    backend: raw.backend,
    cropTrimmedBars: raw.cropTrimmedBars,
    autoPinsByCategory: raw.autoPinsByCategory,
  };
}

/**
 * Permite a la usuaria elegir en 1 toque entre las 2 opciones principales
 * cuando un atributo presenta confianza media (< 60%), actualizando
 * inmediatamente tanto la configuración del molde 2D como la vista 3D.
 */
export function aplicarCorreccionUnToque(
  resultado: TailoredVisionOutput,
  key: DetectedAttributeKey,
  nuevaOpcionId: string,
  nuevaEtiqueta?: string
): TailoredVisionOutput {
  const nextConfig: DetectedGarmentConfig = {
    ...resultado.config,
    extras: { ...resultado.config.extras },
    apariencia3D: resultado.config.apariencia3D
      ? { ...resultado.config.apariencia3D }
      : undefined,
  };

  if (key === "category") {
    const cId = nuevaOpcionId as CategoryPromptId;
    if (cId === "bucketHat") {
      nextConfig.category = "accessories";
      nextConfig.accessorySubStyle = "bucket_hat";
    } else if (cId === "vestido") {
      nextConfig.category = "dress";
      nextConfig.dressSubStyle = "dress";
    } else if (cId === "blusa") {
      nextConfig.category = "top";
      nextConfig.topSubStyle = "blouse";
    } else if (cId === "chaqueta") {
      nextConfig.category = "top";
      nextConfig.topSubStyle = "jacket";
      nextConfig.necklineStyle = "tailored_lapel";
    } else if (cId === "falda") {
      nextConfig.category = "skirt";
      nextConfig.skirtSubStyle = nextConfig.skirtSubStyle ?? "a_line";
    } else if (cId === "pantalon") {
      nextConfig.category = "pants";
      nextConfig.pantsSubStyle = nextConfig.pantsSubStyle ?? "wide";
    } else if (cId === "conjunto") {
      nextConfig.category = "two_piece";
      nextConfig.twoPieceTopStyle = nextConfig.twoPieceTopStyle ?? "crop_top";
      nextConfig.twoPieceBottomStyle =
        nextConfig.twoPieceBottomStyle ?? "aline_skirt";
    } else if (cId === "enterizo") {
      nextConfig.category = "jumpsuit";
      nextConfig.jumpsuitSubStyle = nextConfig.jumpsuitSubStyle ?? "romper_long";
    }
  } else if (key === "neckline") {
    const mapped = mapNeckline(nuevaOpcionId as NecklinePromptId);
    nextConfig.necklineStyle = mapped.necklineStyle;
    nextConfig.extras.wrapFront = mapped.wrapFront;
  } else if (key === "sleeve") {
    const slId = nuevaOpcionId as SleevePromptId;
    if (slId === "kimono") {
      nextConfig.sleeveStyle = "kimono";
      nextConfig.extras.flaredSleeve = false;
      nextConfig.torsoFit = "loose";
    } else if (slId === "farol") {
      nextConfig.sleeveStyle = "long";
      nextConfig.extras.flaredSleeve = true;
    } else if (slId === "acampanada") {
      nextConfig.sleeveStyle = "short";
      nextConfig.extras.flaredSleeve = true;
    } else if (slId === "long" || slId === "short" || slId === "sleeveless") {
      nextConfig.sleeveStyle = slId;
      nextConfig.extras.flaredSleeve = false;
    }
  } else if (key === "fit") {
    nextConfig.torsoFit = nuevaOpcionId === "loose" ? "loose" : "fitted";
  } else if (key === "skirtCut") {
    nextConfig.skirtSubStyle = nuevaOpcionId as SkirtSubStyle;
  } else if (key === "pantsCut") {
    nextConfig.pantsSubStyle = nuevaOpcionId as PantsSubStyle;
  } else if (key === "length") {
    nextConfig.quickLength =
      nuevaOpcionId === "short"
        ? "mini"
        : nuevaOpcionId === "long"
          ? "maxi"
          : "midi";
  } else if (key === "fabric") {
    const tela = nuevaOpcionId as TipoTela;
    nextConfig.fabricType = tela === "licra" ? "stretch" : "woven";
    if (nextConfig.apariencia3D) {
      nextConfig.apariencia3D.tela = tela;
    }
  } else if (key === "print" && nextConfig.apariencia3D) {
    nextConfig.apariencia3D.estampado = nuevaOpcionId as TipoEstampado;
  }

  const nextAttrs = resultado.atributosConConfianza.map((item) => {
    if (item.key !== key) return item;
    const opcionEncontrada = item.top2Opciones?.find(
      (opt) => opt.id === nuevaOpcionId
    );
    return {
      ...item,
      selectedId: nuevaOpcionId,
      selectedLabel:
        nuevaEtiqueta ?? opcionEncontrada?.label ?? item.selectedLabel,
      confidence: 1,
      esAltaConfianza: true,
      reglaAplicada: "Confirmado en 1 toque",
    };
  });

  if (key === "category" && resultado.autoPinsByCategory?.[nextConfig.category]) {
    nextConfig.autoPins = {
      ...resultado.autoPinsByCategory[nextConfig.category],
    };
  } else if (
    key === "neckline" &&
    resultado.autoPinsByCategory?.[nextConfig.category]
  ) {
    const basePins = resultado.autoPinsByCategory[nextConfig.category];
    const esEscoteProfundo =
      nextConfig.extras.wrapFront || nextConfig.necklineStyle === "v_neck";
    nextConfig.autoPins = {
      ...basePins,
      neckline: {
        ...basePins.neckline,
        y: esEscoteProfundo
          ? Number(Math.min(0.88, basePins.neckline.y + 0.035).toFixed(4))
          : basePins.neckline.y,
      },
    };
  }

  return {
    ...resultado,
    config: nextConfig,
    atributosConConfianza: nextAttrs,
  };
}
