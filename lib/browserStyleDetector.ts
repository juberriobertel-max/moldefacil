import {
  FASHION_STYLES_CATALOG,
  FashionStylePreset,
} from "./fashionStylesCatalog";

export interface StyleDetectionScore {
  presetId: string;
  name: string;
  score: number;
}

export type BrowserStyleDetectionResult =
  | {
      status: "detected";
      preset: FashionStylePreset;
      confidence: number;
      ranking: StyleDetectionScore[];
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

function loadImageIntoCanvas(imageDataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxDim = 384;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
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

/**
 * Runs 100% client-side zero-shot fashion style recognition in the browser
 * using Xenova/clip-vit-base-patch32 against the 12 styles in FASHION_STYLES_CATALOG.
 * Fails gracefully if WebAssembly is blocked, offline, or exceeds timeoutMs.
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
  const candidateLabels = FASHION_STYLES_CATALOG.map((item) => item.clipPrompt);

  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const inferencePromise = (async (): Promise<BrowserStyleDetectionResult> => {
      const [classifier, canvas] = await Promise.all([
        getZeroShotClassifier(options?.onProgress),
        loadImageIntoCanvas(imageDataUrl),
      ]);
      const rawOutput = await classifier(canvas, candidateLabels, {
        hypothesis_template: "a fashion photo of {}",
      });

      const byPrompt = new Map(
        FASHION_STYLES_CATALOG.map((item) => [item.clipPrompt, item])
      );

      const ranking: StyleDetectionScore[] = rawOutput
        .map((entry) => {
          const matched = byPrompt.get(entry.label);
          return matched
            ? {
                presetId: matched.id,
                name: matched.name,
                score: Number(entry.score),
              }
            : null;
        })
        .filter((x): x is StyleDetectionScore => x !== null)
        .sort((a, b) => b.score - a.score);

      const winner = ranking[0];
      const winnerPreset = winner
        ? FASHION_STYLES_CATALOG.find((item) => item.id === winner.presetId)
        : undefined;

      if (!winner || !winnerPreset) {
        return {
          status: "error",
          reason: "No se pudo asociar la imagen a un estilo del catálogo.",
        };
      }

      return {
        status: "detected",
        preset: winnerPreset,
        confidence: winner.score,
        ranking,
      };
    })();

    const timeoutPromise = new Promise<BrowserStyleDetectionResult>((resolve) => {
      timerId = setTimeout(() => {
        resolve({
          status: "timeout",
          reason:
            "La descarga o análisis del modelo tardó demasiado. Puedes elegir el estilo manualmente.",
        });
      }, timeoutMs);
    });

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
