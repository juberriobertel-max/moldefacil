import { env, pipeline, RawImage } from "@huggingface/transformers";
import {
  CATEGORY_PROMPT_GROUP,
  DEFAULT_HYPOTHESIS_TEMPLATE,
  evaluarGrupoPrompts,
  FABRIC_PROMPT_GROUP,
  FALLBACK_VISION_MODEL,
  FIT_PROMPT_GROUP,
  LENGTH_PROMPT_GROUP,
  NECKLINE_PROMPT_GROUP,
  obtenerEtiquetasGrupo,
  PANTS_CUT_PROMPT_GROUP,
  PRIMARY_VISION_MODEL,
  PRINT_PROMPT_GROUP,
  RUFFLE_PROMPT_GROUP,
  SECONDARY_FALLBACK_VISION_MODEL,
  SKIRT_CUT_PROMPT_GROUP,
  SLEEVE_PROMPT_GROUP,
  VALIDITY_PROMPT_GROUP,
  WAIST_TIE_PROMPT_GROUP,
} from "./garmentPrompts";
import type { VisionCropKey } from "./imagePreprocessor";
import type { RawVisionEvaluation } from "./tailoringRules";

export interface CropRawInput {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

type ClassifierOutputItem = { label: string; score: number };
type ZeroShotRunner = (
  image: RawImage,
  candidateLabels: string[],
  options?: { hypothesis_template?: string }
) => Promise<ClassifierOutputItem[]>;

interface LoadedEngine {
  runner: ZeroShotRunner;
  modelId: string;
  backend: "webgpu" | "wasm";
}

let cachedEnginePromise: Promise<LoadedEngine> | null = null;
let lastLoadedMeta: { ready: boolean; failed: boolean } = {
  ready: false,
  failed: false,
};

export function getCascadeEngineStatus(): { ready: boolean; failed: boolean } {
  return { ...lastLoadedMeta };
}

async function detectarSoporteWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const navWithGpu = navigator as unknown as {
    gpu?: { requestAdapter?: () => Promise<unknown | null> };
  };
  if (!navWithGpu.gpu?.requestAdapter) return false;
  try {
    const adapter = await navWithGpu.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function intentarCargarModelo(
  modelId: string,
  device: "webgpu" | "wasm",
  onProgress?: (percent: number, stepLabel: string, modelId?: string) => void
): Promise<LoadedEngine> {
  const clf = await pipeline("zero-shot-image-classification", modelId, {
    dtype: "q8",
    device,
    progress_callback: (info: { status?: string; progress?: number }) => {
      if (
        onProgress &&
        info.status === "progress" &&
        typeof info.progress === "number"
      ) {
        const clamped = Math.max(2, Math.min(28, Math.round(info.progress * 0.28)));
        onProgress(clamped, "Descargando modelo visual en caché...", modelId);
      }
    },
  });

  return {
    runner: clf as unknown as ZeroShotRunner,
    modelId,
    backend: device,
  };
}

/**
 * Carga y cachea el pipeline zero-shot usando cuantización `q8`, prioridad a WebGPU
 * con fallback limpio a WASM, y SigLIP con fallback automático a CLIP.
 */
export async function obtenerMotorVision(
  onProgress?: (percent: number, stepLabel: string, modelId?: string) => void
): Promise<LoadedEngine> {
  if (!cachedEnginePromise) {
    cachedEnginePromise = (async () => {
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;
      env.useWasmCache = true;

      const soportaWebGpu = await detectarSoporteWebGPU();
      const modelos = [
        PRIMARY_VISION_MODEL,
        FALLBACK_VISION_MODEL,
        SECONDARY_FALLBACK_VISION_MODEL,
      ];

      let ultimoError: unknown;
      for (const modelId of modelos) {
        const dispositivos: Array<"webgpu" | "wasm"> = soportaWebGpu
          ? ["webgpu", "wasm"]
          : ["wasm"];

        for (const device of dispositivos) {
          try {
            const engine = await intentarCargarModelo(modelId, device, onProgress);
            lastLoadedMeta = { ready: true, failed: false };
            return engine;
          } catch (err) {
            ultimoError = err;
          }
        }
      }

      lastLoadedMeta = { ready: false, failed: true };
      throw ultimoError instanceof Error
        ? ultimoError
        : new Error("No se pudo inicializar el modelo de visión en el navegador");
    })().catch((err) => {
      cachedEnginePromise = null;
      lastLoadedMeta = { ready: false, failed: true };
      throw err;
    });
  }

  return cachedEnginePromise;
}

function toRawImageRgb(crop: CropRawInput): RawImage {
  const bytes =
    crop.rgba instanceof Uint8ClampedArray
      ? crop.rgba
      : new Uint8ClampedArray(crop.rgba);
  return new RawImage(bytes, crop.width, crop.height, 4).rgb();
}

/**
 * Ejecuta la inferencia en cascada sobre las 4 vistas preprocesadas:
 * 1. Evalúa `full` primero (validez textil y categoría base).
 * 2. Si es `bucketHat` o imagen no válida, termina temprano.
 * 3. Si es `falda` o `pantalon`, omite el análisis de escote y mangas (ahorra ~50%).
 * 4. Para prendas superiores o enteras, analiza escote (`neckline`) y mangas (`sleeves`)
 *    con zoom real y luego cintura/vuelo (`waistLower`).
 */
export async function ejecutarInferenciaEnCascada(
  crops: Record<VisionCropKey, CropRawInput>,
  onProgress?: (percent: number, stepLabel: string, modelId?: string) => void
): Promise<Omit<RawVisionEvaluation, "colorDominante" | "cropTrimmedBars">> {
  onProgress?.(12, "Inicializando motor visual en caché...");
  const engine = await obtenerMotorVision(onProgress);
  const { runner, modelId, backend } = engine;
  const opts = { hypothesis_template: DEFAULT_HYPOTHESIS_TEMPLATE };

  const imgFull = toRawImageRgb(crops.full);
  const imgNeckline = toRawImageRgb(crops.neckline);
  const imgSleeves = toRawImageRgb(crops.sleeves);
  const imgWaistLower = toRawImageRgb(crops.waistLower);

  // 1. Verificar validez de prenda textil sobre imagen completa limpia
  onProgress?.(28, "Verificando prenda textil...", modelId);
  const validityRaw = await runner(
    imgFull,
    obtenerEtiquetasGrupo(VALIDITY_PROMPT_GROUP),
    opts
  );
  const validity = evaluarGrupoPrompts(VALIDITY_PROMPT_GROUP, validityRaw);

  // 2. Categoría principal en vista completa
  onProgress?.(38, "Analizando categoría de prenda...", modelId);
  const catRaw = await runner(
    imgFull,
    obtenerEtiquetasGrupo(CATEGORY_PROMPT_GROUP),
    opts
  );
  const category = evaluarGrupoPrompts(CATEGORY_PROMPT_GROUP, catRaw);

  // Atributos de textura/estampado útiles incluso para salida rápida
  onProgress?.(46, "Identificando textura de tela y estampado...", modelId);
  const [fabricRaw, printRaw] = await Promise.all([
    runner(imgFull, obtenerEtiquetasGrupo(FABRIC_PROMPT_GROUP), opts),
    runner(imgFull, obtenerEtiquetasGrupo(PRINT_PROMPT_GROUP), opts),
  ]);
  const fabric = evaluarGrupoPrompts(FABRIC_PROMPT_GROUP, fabricRaw);
  const print = evaluarGrupoPrompts(PRINT_PROMPT_GROUP, printRaw);

  // Salida temprana en cascada para Bucket Hat o imagen ajena a vestuario
  const validProb =
    validity.all.find((v) => v.id === "valid_garment")?.confidence ?? 1;
  const nonGarmentProb =
    validity.all.find((v) => v.id === "non_garment")?.confidence ?? 0;

  if (
    (nonGarmentProb > 0.62 && validProb < 0.38) ||
    category.top1.id === "bucketHat"
  ) {
    onProgress?.(98, "Finalizando detección...", modelId);
    const neutralFit = evaluarGrupoPrompts(FIT_PROMPT_GROUP, []);
    return {
      modelId,
      backend,
      validity,
      category,
      fit: neutralFit,
      fabric,
      print,
    };
  }

  // 3. Silueta global y largo
  onProgress?.(54, "Analizando silueta y largo...", modelId);
  const fitRaw = await runner(
    imgFull,
    obtenerEtiquetasGrupo(FIT_PROMPT_GROUP),
    opts
  );
  const fit = evaluarGrupoPrompts(FIT_PROMPT_GROUP, fitRaw);

  const lengthRaw = await runner(
    imgFull,
    obtenerEtiquetasGrupo(LENGTH_PROMPT_GROUP),
    opts
  );
  const length = evaluarGrupoPrompts(LENGTH_PROMPT_GROUP, lengthRaw);

  const esInferior =
    category.top1.id === "falda" || category.top1.id === "pantalon";

  let neckline: RawVisionEvaluation["neckline"];
  let sleeves: RawVisionEvaluation["sleeves"];

  if (!esInferior) {
    // 4a. Recorte de escote y solapas
    onProgress?.(68, "Analizando escote y solapas...", modelId);
    const neckRaw = await runner(
      imgNeckline,
      obtenerEtiquetasGrupo(NECKLINE_PROMPT_GROUP),
      opts
    );
    neckline = evaluarGrupoPrompts(NECKLINE_PROMPT_GROUP, neckRaw);

    // 4b. Recorte de hombros y mangas
    onProgress?.(80, "Detectando tipo de mangas...", modelId);
    const sleevesRaw = await runner(
      imgSleeves,
      obtenerEtiquetasGrupo(SLEEVE_PROMPT_GROUP),
      opts
    );
    sleeves = evaluarGrupoPrompts(SLEEVE_PROMPT_GROUP, sleevesRaw);
  }

  // 5. Recorte cintura / parte inferior
  onProgress?.(90, "Analizando cintura, caída y vuelo...", modelId);
  const waistRaw = await runner(
    imgWaistLower,
    obtenerEtiquetasGrupo(WAIST_TIE_PROMPT_GROUP),
    opts
  );
  const waistTie = evaluarGrupoPrompts(WAIST_TIE_PROMPT_GROUP, waistRaw);

  let skirtCut: RawVisionEvaluation["skirtCut"];
  let pantsCut: RawVisionEvaluation["pantsCut"];
  let ruffle: RawVisionEvaluation["ruffle"];

  if (
    category.top1.id === "falda" ||
    category.top1.id === "vestido" ||
    category.top1.id === "conjunto"
  ) {
    const skirtRaw = await runner(
      imgWaistLower,
      obtenerEtiquetasGrupo(SKIRT_CUT_PROMPT_GROUP),
      opts
    );
    skirtCut = evaluarGrupoPrompts(SKIRT_CUT_PROMPT_GROUP, skirtRaw);

    const ruffleRaw = await runner(
      imgWaistLower,
      obtenerEtiquetasGrupo(RUFFLE_PROMPT_GROUP),
      opts
    );
    ruffle = evaluarGrupoPrompts(RUFFLE_PROMPT_GROUP, ruffleRaw);
  }

  if (category.top1.id === "pantalon") {
    const pantsRaw = await runner(
      imgWaistLower,
      obtenerEtiquetasGrupo(PANTS_CUT_PROMPT_GROUP),
      opts
    );
    pantsCut = evaluarGrupoPrompts(PANTS_CUT_PROMPT_GROUP, pantsRaw);
  }

  onProgress?.(96, "Aplicando reglas de modistería...", modelId);

  return {
    modelId,
    backend,
    validity,
    category,
    neckline,
    sleeves,
    fit,
    length,
    skirtCut,
    pantsCut,
    waistTie,
    ruffle,
    fabric,
    print,
  };
}
