import {
  CropRawInput,
  ejecutarInferenciaEnCascada,
  obtenerMotorVision,
} from "../lib/vision/cascadeRunner";
import type { VisionCropKey } from "../lib/vision/imagePreprocessor";
import type { RawVisionEvaluation } from "../lib/vision/tailoringRules";

export interface WorkerRequestMessage {
  type: "warmup" | "classify";
  requestId: number;
  crops?: Record<VisionCropKey, CropRawInput>;
}

export type WorkerResponseMessage =
  | {
      type: "progress";
      requestId: number;
      percent: number;
      stepLabel: string;
      modelId?: string;
    }
  | {
      type: "warmup_done";
      requestId: number;
      modelId: string;
      backend: "webgpu" | "wasm";
    }
  | {
      type: "result";
      requestId: number;
      payload: Omit<RawVisionEvaluation, "colorDominante" | "cropTrimmedBars">;
    }
  | {
      type: "error";
      requestId: number;
      reason: string;
    };

interface WorkerGlobalLike {
  postMessage: (message: WorkerResponseMessage) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<WorkerRequestMessage>) => void
  ) => void;
}

const workerScope = globalThis as unknown as WorkerGlobalLike;

workerScope.addEventListener(
  "message",
  async (event: MessageEvent<WorkerRequestMessage>) => {
    const msg = event.data;
    if (!msg) return;

    try {
      if (msg.type === "warmup") {
        const engine = await obtenerMotorVision((percent, stepLabel, modelId) => {
          workerScope.postMessage({
            type: "progress",
            requestId: msg.requestId,
            percent,
            stepLabel,
            modelId,
          });
        });
        workerScope.postMessage({
          type: "warmup_done",
          requestId: msg.requestId,
          modelId: engine.modelId,
          backend: engine.backend,
        });
        return;
      }

      if (msg.type === "classify" && msg.crops) {
        const payload = await ejecutarInferenciaEnCascada(
          msg.crops,
          (percent, stepLabel, modelId) => {
            workerScope.postMessage({
              type: "progress",
              requestId: msg.requestId,
              percent,
              stepLabel,
              modelId,
            });
          }
        );
        workerScope.postMessage({
          type: "result",
          requestId: msg.requestId,
          payload,
        });
      }
    } catch (err) {
      workerScope.postMessage({
        type: "error",
        requestId: msg.requestId,
        reason:
          err instanceof Error
            ? err.message
            : "Error inesperado ejecutando el motor visual en el Worker",
      });
    }
  }
);
