import {
  DEFAULT_GARMENT_EXTRAS,
  DressSubStyle,
  GarmentCategory,
  GarmentExtras,
  NecklineStyle,
  PantsSubStyle,
  QuickLengthPreset,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "./types";

export interface DetectedGarmentConfig {
  category: GarmentCategory;
  topSubStyle?: TopSubStyle;
  pantsSubStyle?: PantsSubStyle;
  skirtSubStyle?: SkirtSubStyle;
  dressSubStyle?: DressSubStyle;
  twoPieceTopStyle?: TwoPieceTopStyle;
  twoPieceBottomStyle?: TwoPieceBottomStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  torsoFit: TorsoFit;
  extras: GarmentExtras;
  quickLength: QuickLengthPreset;
  styleVariant: StyleVariant;
}

export interface DetectedAttributeScores {
  category: { label: string; score: number };
  sleeve: { label: string; score: number };
  torsoFit: { label: string; score: number };
  neckline: { label: string; score: number };
  waistTieConfidence: number;
  hemRuffleConfidence: number;
}

export type BrowserStyleDetectionResult =
  | {
      status: "detected";
      config: DetectedGarmentConfig;
      scores: DetectedAttributeScores;
    }
  | {
      status: "unavailable" | "timeout" | "error";
      reason: string;
    };

type ZeroShotImageClassifier = (
  images: HTMLCanvasElement | string,
  candidate_labels: string[],
  options?: { hypothesis_template?: string }
) => Promise<Array<{ label: string; score: number }>>;

const CATEGORY_PROMPTS: { id: GarmentCategory; prompt: string }[] = [
  {
    id: "dress",
    prompt: "a full length or knee length one-piece dress",
  },
  {
    id: "two_piece",
    prompt:
      "a two-piece outfit with a separate crop top and skirt or pants showing midriff",
  },
  {
    id: "top",
    prompt: "a standalone top, blouse, or shirt",
  },
  {
    id: "skirt",
    prompt: "a standalone skirt",
  },
  {
    id: "pants",
    prompt: "a pair of trousers, palazzo pants, or shorts",
  },
];

const SLEEVE_PROMPTS: { id: SleeveStyle; prompt: string }[] = [
  {
    id: "kimono",
    prompt:
      "loose wide kimono sleeves, batwing dolman sleeves with dropped shoulder and no armhole seam, flowy wide cuffs",
  },
  {
    id: "short",
    prompt: "short fitted sleeves with a structured shoulder seam",
  },
  {
    id: "long",
    prompt: "long fitted sleeves with a structured shoulder seam",
  },
  {
    id: "sleeveless",
    prompt: "sleeveless garment, tank straps or bare shoulders",
  },
];

const TORSO_FIT_PROMPTS: { id: TorsoFit; prompt: string }[] = [
  {
    id: "loose",
    prompt:
      "loose, flowy, bloused bodice with soft fabric folds and draped volume gathered at the waist",
  },
  {
    id: "fitted",
    prompt:
      "tight, form-fitting, tailored bodice fitted closely to the waist and bust",
  },
];

const NECKLINE_FRONT_PROMPTS: {
  id: "cruzado" | "v_normal" | "redondo" | "cuadrado";
  neckline: NecklineStyle;
  wrapFront: boolean;
  prompt: string;
}[] = [
  {
    id: "cruzado",
    neckline: "v_neck",
    wrapFront: true,
    prompt:
      "surplice wrap dress front with deep crossover v-neckline overlapping diagonally",
  },
  {
    id: "v_normal",
    neckline: "v_neck",
    wrapFront: false,
    prompt: "symmetrical v-neck neckline without crossover wrap",
  },
  {
    id: "redondo",
    neckline: "round",
    wrapFront: false,
    prompt: "round crew neckline",
  },
  {
    id: "cuadrado",
    neckline: "square",
    wrapFront: false,
    prompt: "square or straight neckline",
  },
];

const WAIST_TIE_PROMPT = "waist tie belt, fabric sash tied around the waist";
const NO_WAIST_TIE_PROMPT = "no belt or waist tie";

const HEM_RUFFLE_PROMPT = "tiered skirt with ruffled hem flounce";
const NO_HEM_RUFFLE_PROMPT = "plain straight hem without ruffles";

function loadImageIntoCanvas(imageDataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxDim = 384;
      const scale = Math.min(
        1,
        maxDim / Math.max(img.width || 1, img.height || 1)
      );
      const w = Math.max(1, Math.round((img.width || maxDim) * scale));
      const h = Math.max(1, Math.round((img.height || maxDim) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
    img.src = imageDataUrl;
  });
}

let cachedClassifierPromise: Promise<ZeroShotImageClassifier> | null = null;

async function getZeroShotClassifier(
  onProgress?: (percent: number) => void
): Promise<ZeroShotImageClassifier> {
  if (!cachedClassifierPromise) {
    cachedClassifierPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;
      env.useWasmCache = true;

      const clf = await pipeline(
        "zero-shot-image-classification",
        "Xenova/clip-vit-base-patch32",
        {
          dtype: "q8",
          progress_callback: (info: { status?: string; progress?: number }) => {
            if (
              onProgress &&
              info.status === "progress" &&
              typeof info.progress === "number"
            ) {
              onProgress(Math.round(info.progress));
            }
          },
        }
      );
      return clf as unknown as ZeroShotImageClassifier;
    })().catch((err) => {
      cachedClassifierPromise = null;
      throw err;
    });
  }
  return cachedClassifierPromise;
}

function pickTop<T extends { prompt: string }>(
  items: T[],
  results: Array<{ label: string; score: number }>
): { item: T; score: number } {
  const byPrompt = new Map(items.map((x) => [x.prompt, x]));
  const sorted = [...results].sort((a, b) => b.score - a.score);
  for (const r of sorted) {
    const found = byPrompt.get(r.label);
    if (found) return { item: found, score: Number(r.score) };
  }
  return { item: items[0], score: 0 };
}

/**
 * Runs 100% client-side multi-attribute zero-shot classification in the browser
 * using Xenova/clip-vit-base-patch32. Evaluates 5 independent garment dimensions:
 * 1) Base category, 2) Shoulder & sleeve construction (kimono vs. set-in),
 * 3) Torso looseness/blousing, 4) Neckline & crossover wrap, 5) Waist tie & ruffle extras.
 */
export async function detectFashionStyleInBrowser(
  imageDataUrl: string,
  options?: {
    timeoutMs?: number;
    onProgress?: (percent: number) => void;
  }
): Promise<BrowserStyleDetectionResult> {
  if (typeof window === "undefined") {
    return { status: "unavailable", reason: "ssr_environment" };
  }

  if (typeof WebAssembly === "undefined") {
    return {
      status: "unavailable",
      reason: "Tu navegador tiene WebAssembly deshabilitado.",
    };
  }

  const timeoutMs = options?.timeoutMs ?? 60000;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  try {
    const inferencePromise = (async (): Promise<BrowserStyleDetectionResult> => {
      const [classifier, canvas] = await Promise.all([
        getZeroShotClassifier(options?.onProgress),
        loadImageIntoCanvas(imageDataUrl),
      ]);

      const opts = { hypothesis_template: "a fashion photo of {}" };

      // 1. Base Category
      const catOut = await classifier(
        canvas,
        CATEGORY_PROMPTS.map((c) => c.prompt),
        opts
      );
      const bestCat = pickTop(CATEGORY_PROMPTS, catOut);

      // 2. Shoulder & Sleeve Construction
      const sleeveOut = await classifier(
        canvas,
        SLEEVE_PROMPTS.map((s) => s.prompt),
        opts
      );
      const bestSleeve = pickTop(SLEEVE_PROMPTS, sleeveOut);

      // 3. Torso Fit & Looseness
      const fitOut = await classifier(
        canvas,
        TORSO_FIT_PROMPTS.map((f) => f.prompt),
        opts
      );
      const bestFit = pickTop(TORSO_FIT_PROMPTS, fitOut);

      // 4. Neckline & Crossover Wrap
      const neckOut = await classifier(
        canvas,
        NECKLINE_FRONT_PROMPTS.map((n) => n.prompt),
        opts
      );
      const bestNeck = pickTop(NECKLINE_FRONT_PROMPTS, neckOut);

      // 5a. Waist Tie / Belt (> 60% confidence vs. opposite)
      const tieOut = await classifier(
        canvas,
        [WAIST_TIE_PROMPT, NO_WAIST_TIE_PROMPT],
        opts
      );
      const waistTieConfidence =
        tieOut.find((r) => r.label === WAIST_TIE_PROMPT)?.score ?? 0;

      // 5b. Ruffled Hem / Bolero (> 60% confidence vs. opposite)
      const ruffleOut = await classifier(
        canvas,
        [HEM_RUFFLE_PROMPT, NO_HEM_RUFFLE_PROMPT],
        opts
      );
      const hemRuffleConfidence =
        ruffleOut.find((r) => r.label === HEM_RUFFLE_PROMPT)?.score ?? 0;

      const hasUpperBodice =
        bestCat.item.id === "dress" ||
        bestCat.item.id === "top" ||
        bestCat.item.id === "two_piece";

      const extras: GarmentExtras = {
        ...DEFAULT_GARMENT_EXTRAS,
        wrapFront: hasUpperBodice ? bestNeck.item.wrapFront : false,
        waistTie: waistTieConfidence > 0.6,
        hemRuffle: bestCat.item.id !== "pants" && hemRuffleConfidence > 0.6,
      };

      const config: DetectedGarmentConfig = {
        category: bestCat.item.id,
        topSubStyle: bestCat.item.id === "top" ? "blouse" : undefined,
        pantsSubStyle: bestCat.item.id === "pants" ? "wide" : undefined,
        skirtSubStyle:
          bestCat.item.id === "skirt" || bestCat.item.id === "dress"
            ? "a_line"
            : undefined,
        dressSubStyle: bestCat.item.id === "dress" ? "dress" : undefined,
        twoPieceTopStyle:
          bestCat.item.id === "two_piece"
            ? bestFit.item.id === "loose"
              ? "waist_blouse"
              : "crop_top"
            : undefined,
        twoPieceBottomStyle:
          bestCat.item.id === "two_piece" ? "aline_skirt" : undefined,
        necklineStyle: bestNeck.item.neckline,
        sleeveStyle: bestSleeve.item.id,
        torsoFit: bestFit.item.id,
        extras,
        quickLength:
          bestCat.item.id === "dress" || bestCat.item.id === "skirt"
            ? "midi"
            : "photo",
        styleVariant: "default",
      };

      return {
        status: "detected",
        config,
        scores: {
          category: { label: bestCat.item.id, score: bestCat.score },
          sleeve: { label: bestSleeve.item.id, score: bestSleeve.score },
          torsoFit: { label: bestFit.item.id, score: bestFit.score },
          neckline: { label: bestNeck.item.id, score: bestNeck.score },
          waistTieConfidence: Number(waistTieConfidence),
          hemRuffleConfidence: Number(hemRuffleConfidence),
        },
      };
    })();

    const timeoutPromise = new Promise<BrowserStyleDetectionResult>(
      (resolve) => {
        timerId = setTimeout(() => {
          resolve({
            status: "timeout",
            reason:
              "La descarga o análisis del modelo tardó demasiado. Puedes elegir el estilo manualmente.",
          });
        }, timeoutMs);
      }
    );

    return await Promise.race([inferencePromise, timeoutPromise]);
  } catch (err) {
    return {
      status: "error",
      reason:
        err instanceof Error
          ? err.message
          : "No fue posible ejecutar el análisis automático en el navegador.",
    };
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}
