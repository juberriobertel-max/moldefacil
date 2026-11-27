import { env, pipeline, RawImage } from "@huggingface/transformers";
import {
  CATEGORY_PROMPT_GROUP,
  DEFAULT_HYPOTHESIS_TEMPLATE,
  evaluarGrupoPrompts,
  type EvaluatedPromptGroup,
  FABRIC_PROMPT_GROUP,
  FALLBACK_VISION_MODEL,
  FIT_PROMPT_GROUP,
  HIGH_CONFIDENCE_THRESHOLD,
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
import {
  calcularEmbeddingImagen,
  cargarEmbedderImagen,
} from "./imageEmbedder";
import type { VisionCropKey } from "./imagePreprocessor";
import {
  cuantizarVector,
  decodificarCubetaReferencia,
  type DecodedReferenceEntry,
  mezclarProbabilidades,
  type ReferenceAttributeBucket,
  type ReferenceLibraryFile,
  UMBRAL_SIN_COINCIDENCIA,
  votarKnn,
} from "./referenceMatcher";
import type { RawVisionEvaluation } from "./tailoringRules";
import {
  ATRIBUTO_A_RECORTE,
  ATRIBUTOS_VISION,
  type AtributoVision,
  IDS_VALIDOS,
} from "./visionAttributes";

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
  backend: "webgpu" | "wasm" | "cpu";
}

function esEntornoNode(): boolean {
  return (
    typeof process !== "undefined" &&
    Boolean(process.versions?.node) &&
    typeof self === "undefined" &&
    typeof window === "undefined"
  );
}

let cachedEnginePromise: Promise<LoadedEngine> | null = null;
const cachedReferenceLibs = new Map<
  string,
  Promise<ReferenceLibraryFile | null>
>();
const cachedDecodedBuckets = new Map<string, DecodedReferenceEntry[]>();
let lastLoadedMeta: { ready: boolean; failed: boolean } = {
  ready: false,
  failed: false,
};

function slugModeloReferencia(modelId: string): string {
  const afterSlash = modelId.includes("/")
    ? modelId.split("/").slice(1).join("-")
    : modelId;
  return afterSlash.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function esCubetaElegibleParaBlend(
  bucket: ReferenceAttributeBucket | undefined,
  attr: AtributoVision
): boolean {
  if (!bucket || bucket.entries.length === 0) return false;
  if (process.env.NEXT_PUBLIC_VISION_REF_BLEND === "always") return true;
  const distinctLabels = new Set(bucket.entries.map((e) => e.label)).size;
  const totalIds = IDS_VALIDOS[attr].length;
  return (
    distinctLabels >= 2 &&
    (bucket.entries.length >= totalIds * 2 ||
      (distinctLabels >= Math.ceil(totalIds * 0.5) &&
        bucket.entries.length >= 10))
  );
}

async function cargarBibliotecaReferenciaNavegador(
  modelId: string
): Promise<ReferenceLibraryFile | null> {
  if (esEntornoNode() || typeof fetch !== "function") return null;
  const existente = cachedReferenceLibs.get(modelId);
  if (existente) return existente;

  const slug = slugModeloReferencia(modelId);
  const rel = `/vision/reference/${slug}.json`;
  const url =
    typeof location !== "undefined" && location.origin
      ? `${location.origin}${rel}`
      : rel;

  const promesa = fetch(url, { cache: "force-cache" })
    .then(async (res) => {
      if (!res.ok) return null;
      const json = (await res.json()) as Partial<ReferenceLibraryFile>;
      if (
        json.version !== 1 ||
        json.modelId !== modelId ||
        !json.dim ||
        !json.attributes
      ) {
        return null;
      }
      return json as ReferenceLibraryFile;
    })
    .catch(() => null);

  cachedReferenceLibs.set(modelId, promesa);
  return promesa;
}

function reconstruirGrupoConBlend<T extends string>(
  grupo: EvaluatedPromptGroup<T>,
  probsMezcladas: Record<string, number>,
  knnMaxSim?: number
): EvaluatedPromptGroup<T> {
  const all = grupo.all
    .map((cand) => ({
      ...cand,
      confidence: Number((probsMezcladas[cand.id] ?? cand.confidence).toFixed(4)),
    }))
    .sort((a, b) => b.confidence - a.confidence);
  const top1 = all[0];
  const top2 = all[1] ?? null;
  const top3 = all.slice(0, 3);
  const tieneSimilitud =
    knnMaxSim === undefined || knnMaxSim >= UMBRAL_SIN_COINCIDENCIA;
  return {
    top1,
    top2,
    top3,
    all,
    esAltaConfianza:
      top1.confidence >= HIGH_CONFIDENCE_THRESHOLD && tieneSimilitud,
  };
}

/**
 * Extrae el vector L2-normalizado cuantizado (`int8` base64) de un recorte de prenda,
 * usado cuando la usuaria acepta enviar una corrección anónima (nunca la imagen).
 */
export async function extraerVectorDeRecorte(
  crop: CropRawInput,
  preferredModelId?: string
): Promise<{ modelId: string; dim: number; vectorInt8B64: string }> {
  const engine = await obtenerMotorVision();
  const targetModel = preferredModelId?.includes("/")
    ? preferredModelId
    : engine.modelId;
  const embedder = await cargarEmbedderImagen(targetModel, engine.backend);
  const vec = await calcularEmbeddingImagen(embedder, toRawImageRgb(crop));
  return {
    modelId: targetModel,
    dim: vec.length,
    vectorInt8B64: cuantizarVector(vec),
  };
}

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
  device: "webgpu" | "wasm" | "cpu",
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
      const enNode = esEntornoNode();
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = !enNode;
      env.useWasmCache = true;

      const soportaWebGpu = enNode ? false : await detectarSoporteWebGPU();
      const modelos = [
        PRIMARY_VISION_MODEL,
        FALLBACK_VISION_MODEL,
        SECONDARY_FALLBACK_VISION_MODEL,
      ];

      let ultimoError: unknown;
      for (const modelId of modelos) {
        const dispositivos: Array<"webgpu" | "wasm" | "cpu"> = enNode
          ? ["cpu"]
          : soportaWebGpu
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
  onProgress?: (percent: number, stepLabel: string, modelId?: string) => void,
  options?: { disableReferenceBlend?: boolean }
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

  const result: Omit<RawVisionEvaluation, "colorDominante" | "cropTrimmedBars"> =
    {
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
      referenciaUsada: false,
    };

  if (!options?.disableReferenceBlend) {
    try {
      const refLib = await cargarBibliotecaReferenciaNavegador(modelId);
      if (refLib) {
        const eligibleAttrs = ATRIBUTOS_VISION.filter((attr) =>
          esCubetaElegibleParaBlend(refLib.attributes[attr], attr)
        );
        if (eligibleAttrs.length > 0) {
          const embedder = await cargarEmbedderImagen(modelId, backend);
          const cropVecCache = new Map<VisionCropKey, Float32Array>();
          const similitudPorAttr: Partial<Record<AtributoVision, number>> = {};
          let blendedAny = false;

          const groupMap: Partial<
            Record<AtributoVision, EvaluatedPromptGroup<string> | undefined>
          > = {
            category: result.category,
            neckline: result.neckline,
            sleeve: result.sleeves,
            fit: result.fit,
            length: result.length,
            skirtCut: result.skirtCut,
            pantsCut: result.pantsCut,
            waistTie: result.waistTie,
            ruffle: result.ruffle,
            fabric: result.fabric,
            print: result.print,
          };

          for (const attr of eligibleAttrs) {
            const zsGroup = groupMap[attr];
            const bucket = refLib.attributes[attr];
            if (!zsGroup || !bucket) continue;

            const cacheKey = `${modelId}::${attr}`;
            let decoded = cachedDecodedBuckets.get(cacheKey);
            if (!decoded) {
              decoded = decodificarCubetaReferencia(bucket, refLib.dim);
              cachedDecodedBuckets.set(cacheKey, decoded);
            }

            const cropKey = ATRIBUTO_A_RECORTE[attr];
            let qVec = cropVecCache.get(cropKey);
            if (!qVec) {
              qVec = await calcularEmbeddingImagen(
                embedder,
                toRawImageRgb(crops[cropKey])
              );
              cropVecCache.set(cropKey, qVec);
            }

            const knn = votarKnn(qVec, decoded);
            similitudPorAttr[attr] = Number(knn.maxSim.toFixed(4));
            const zsProbs = Object.fromEntries(
              zsGroup.all.map((c) => [c.id, c.confidence])
            );
            const blended = mezclarProbabilidades(zsProbs, knn.probs, 0.6);
            const updatedGroup = reconstruirGrupoConBlend(
              zsGroup,
              blended,
              knn.maxSim
            );

            switch (attr) {
              case "category":
                result.category = updatedGroup as typeof result.category;
                break;
              case "neckline":
                result.neckline = updatedGroup as typeof result.neckline;
                break;
              case "sleeve":
                result.sleeves = updatedGroup as typeof result.sleeves;
                break;
              case "fit":
                result.fit = updatedGroup as typeof result.fit;
                break;
              case "length":
                result.length = updatedGroup as typeof result.length;
                break;
              case "skirtCut":
                result.skirtCut = updatedGroup as typeof result.skirtCut;
                break;
              case "pantsCut":
                result.pantsCut = updatedGroup as typeof result.pantsCut;
                break;
              case "waistTie":
                result.waistTie = updatedGroup as typeof result.waistTie;
                break;
              case "ruffle":
                result.ruffle = updatedGroup as typeof result.ruffle;
                break;
              case "fabric":
                result.fabric = updatedGroup as typeof result.fabric;
                break;
              case "print":
                result.print = updatedGroup as typeof result.print;
                break;
            }
            blendedAny = true;
          }

          if (blendedAny) {
            result.referenciaUsada = true;
            result.similitudReferenciaPorAtributo = similitudPorAttr;
          }
        }
      }
    } catch {
      // Fallback limpio a zero-shot si falla carga del embedder o biblioteca
    }
  }

  return result;
}
