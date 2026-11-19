import {
  DominantColorResult,
  extraerColorDominantePrenda,
} from "./vision/colorExtractor";
import {
  preprocesarImagenPrenda,
  VisionCropKey,
} from "./vision/imagePreprocessor";
import {
  aplicarCorreccionUnToque,
  aplicarReglasCoherenciaModisteria,
  DetectedAttributeCandidate,
  DetectedAttributeItem,
  DetectedAttributeKey,
  DetectedAttributeScores,
  DetectedGarmentConfig,
  RawVisionEvaluation,
  TailoredVisionOutput,
} from "./vision/tailoringRules";
import {
  CropRawInput,
  ejecutarInferenciaEnCascada,
  getCascadeEngineStatus,
} from "./vision/cascadeRunner";
import type {
  WorkerRequestMessage,
  WorkerResponseMessage,
} from "../workers/garmentClassifier.worker";

export type {
  DetectedAttributeCandidate,
  DetectedAttributeItem,
  DetectedAttributeKey,
  DetectedAttributeScores,
  DetectedGarmentConfig,
  TailoredVisionOutput,
  DominantColorResult,
};
export { aplicarCorreccionUnToque };

export type BrowserStyleDetectionResult =
  | ({
      status: "detected";
    } & TailoredVisionOutput)
  | {
      status: "unavailable" | "timeout" | "error";
      reason: string;
    };

let sharedWorker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
let modelReadyState = false;
let modelFailedState = false;

interface PendingWorkerTask {
  resolve: (
    value: Omit<RawVisionEvaluation, "colorDominante" | "cropTrimmedBars">
  ) => void;
  reject: (err: Error) => void;
  onProgress?: (percent: number, stepLabel: string, modelId?: string) => void;
}

const pendingTasks = new Map<number, PendingWorkerTask>();
const pendingWarmups = new Map<
  number,
  { resolve: () => void; reject: (err: Error) => void }
>();

function asegurarWorker(): Worker | null {
  if (
    typeof window === "undefined" ||
    typeof Worker === "undefined" ||
    workerUnavailable
  ) {
    return null;
  }
  if (sharedWorker) return sharedWorker;

  try {
    const worker = new Worker(
      new URL("../workers/garmentClassifier.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.addEventListener(
      "message",
      (ev: MessageEvent<WorkerResponseMessage>) => {
        const msg = ev.data;
        if (!msg) return;

        if (msg.type === "progress") {
          pendingTasks
            .get(msg.requestId)
            ?.onProgress?.(msg.percent, msg.stepLabel, msg.modelId);
          return;
        }

        if (msg.type === "warmup_done") {
          modelReadyState = true;
          modelFailedState = false;
          const warm = pendingWarmups.get(msg.requestId);
          if (warm) {
            pendingWarmups.delete(msg.requestId);
            warm.resolve();
          }
          return;
        }

        if (msg.type === "result") {
          modelReadyState = true;
          modelFailedState = false;
          const task = pendingTasks.get(msg.requestId);
          if (task) {
            pendingTasks.delete(msg.requestId);
            task.resolve(msg.payload);
          }
          return;
        }

        if (msg.type === "error") {
          modelFailedState = true;
          const task = pendingTasks.get(msg.requestId);
          if (task) {
            pendingTasks.delete(msg.requestId);
            task.reject(new Error(msg.reason));
          }
          const warm = pendingWarmups.get(msg.requestId);
          if (warm) {
            pendingWarmups.delete(msg.requestId);
            warm.reject(new Error(msg.reason));
          }
        }
      }
    );

    worker.addEventListener("error", () => {
      workerUnavailable = true;
      sharedWorker = null;
      const err = new Error(
        "El Web Worker no pudo continuar; cambiando a hilo secundario"
      );
      for (const [, task] of pendingTasks) {
        task.reject(err);
      }
      pendingTasks.clear();
      for (const [, warm] of pendingWarmups) {
        warm.reject(err);
      }
      pendingWarmups.clear();
    });

    sharedWorker = worker;
    return sharedWorker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

export function isModelReady(): boolean {
  return modelReadyState || getCascadeEngineStatus().ready;
}

export function isModelFailed(): boolean {
  return modelFailedState || getCascadeEngineStatus().failed;
}

/**
 * Precarga el modelo cuantizado SigLIP / CLIP en segundo plano sin bloquear la UI.
 */
export function warmUpBrowserDetector(): void {
  const worker = asegurarWorker();
  if (!worker) return;
  const requestId = nextRequestId++;
  const req: WorkerRequestMessage = { type: "warmup", requestId };
  pendingWarmups.set(requestId, {
    resolve: () => undefined,
    reject: () => undefined,
  });
  worker.postMessage(req);
}

function ejecutarEnWorkerOProceso(
  crops: Record<VisionCropKey, CropRawInput>,
  onProgress?: (percent: number, stepLabel: string, modelId?: string) => void
): Promise<Omit<RawVisionEvaluation, "colorDominante" | "cropTrimmedBars">> {
  const worker = asegurarWorker();
  if (!worker) {
    return ejecutarInferenciaEnCascada(crops, onProgress);
  }

  return new Promise<
    Omit<RawVisionEvaluation, "colorDominante" | "cropTrimmedBars">
  >((resolve, reject) => {
    const requestId = nextRequestId++;
    pendingTasks.set(requestId, { resolve, reject, onProgress });
    const req: WorkerRequestMessage = {
      type: "classify",
      requestId,
      crops,
    };
    try {
      worker.postMessage(req);
    } catch {
      pendingTasks.delete(requestId);
      workerUnavailable = true;
      void ejecutarInferenciaEnCascada(crops, onProgress).then(resolve, reject);
    }
  }).catch((err) => {
    if (workerUnavailable) {
      return ejecutarInferenciaEnCascada(crops, onProgress);
    }
    throw err;
  });
}

/**
 * Analiza una foto o captura de prenda 100% en el navegador (cero APIs externas):
 * 1. Auto-recorta franjas sólidas de captura y genera 4 vistas Multi-Crop (224x224).
 * 2. Extrae el color dominante descartando piel y fondo.
 * 3. Ejecuta clasificación zero-shot SigLIP q8 (con fallback CLIP q8) en Web Worker.
 * 4. Aplica reglas deterministas de coherencia de modistería.
 */
export async function detectFashionStyleInBrowser(
  imageDataUrl: string,
  options?: {
    timeoutMs?: number;
    onProgress?: (percent: number, stepLabel?: string) => void;
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

  const timeoutMs = options?.timeoutMs ?? 90000;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  try {
    const pipelinePromise = (async (): Promise<BrowserStyleDetectionResult> => {
      options?.onProgress?.(6, "Recortando prenda y preparando vistas...");
      const prep = await preprocesarImagenPrenda(imageDataUrl);

      options?.onProgress?.(10, "Extrayendo color dominante de la tela...");
      const colorDominante = extraerColorDominantePrenda(
        prep.centralPixels,
        prep.centralWidth,
        prep.centralHeight
      );

      const cropInputs: Record<VisionCropKey, CropRawInput> = {
        full: {
          width: prep.crops.full.width,
          height: prep.crops.full.height,
          rgba: prep.crops.full.rgba,
        },
        neckline: {
          width: prep.crops.neckline.width,
          height: prep.crops.neckline.height,
          rgba: prep.crops.neckline.rgba,
        },
        sleeves: {
          width: prep.crops.sleeves.width,
          height: prep.crops.sleeves.height,
          rgba: prep.crops.sleeves.rgba,
        },
        waistLower: {
          width: prep.crops.waistLower.width,
          height: prep.crops.waistLower.height,
          rgba: prep.crops.waistLower.rgba,
        },
      };

      const rawEval = await ejecutarEnWorkerOProceso(
        cropInputs,
        (pct, label) => options?.onProgress?.(pct, label)
      );

      options?.onProgress?.(100, "Aplicando reglas de modistería...");

      const tailored = aplicarReglasCoherenciaModisteria({
        ...rawEval,
        colorDominante,
        cropTrimmedBars: prep.trim.barDetected,
      });

      return {
        status: "detected",
        ...tailored,
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

    return await Promise.race([pipelinePromise, timeoutPromise]);
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
