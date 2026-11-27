import { z } from "zod";
import {
  ATRIBUTO_A_RECORTE,
  ATRIBUTOS_VISION,
  type AtributoVision,
  IDS_VALIDOS,
} from "./visionAttributes";

const FORBIDDEN_FEEDBACK_KEYS = new Set([
  "image",
  "photo",
  "foto",
  "imageDataUrl",
  "dataUrl",
  "pixels",
  "rgba",
  "email",
  "correo",
  "user",
  "userId",
  "usuario",
  "name",
  "nombre",
  "phone",
  "telefono",
  "measurements",
  "medidas",
]);

function decodificarLongitudBase64(b64: string): number {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").byteLength;
  }
  return atob(b64).length;
}

export function contieneCamposProhibidosFeedback(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const check = (obj: unknown, depth = 0): boolean => {
    if (!obj || typeof obj !== "object" || depth > 4) return false;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (FORBIDDEN_FEEDBACK_KEYS.has(k)) return true;
      if (v && typeof v === "object" && check(v, depth + 1)) return true;
    }
    return false;
  };
  return check(payload);
}

export const VisionFeedbackPayloadSchema = z
  .object({
    modelId: z.string().trim().min(3).max(160),
    attribute: z.enum(ATRIBUTOS_VISION as [AtributoVision, ...AtributoVision[]]),
    cropKey: z.enum(["full", "neckline", "sleeves", "waistLower"]),
    predictedLabel: z.string().trim().min(1).max(64),
    correctedLabel: z.string().trim().min(1).max(64),
    predictedConfidence: z.number().min(0).max(1).optional(),
    dim: z.number().int().min(64).max(2048),
    vectorInt8B64: z
      .string()
      .trim()
      .min(64)
      .max(4096)
      .regex(/^[A-Za-z0-9+/=]+$/, "Base64 inválido"),
    consentAccepted: z.literal(true),
  })
  .superRefine((data, ctx) => {
    const expectedCrop = ATRIBUTO_A_RECORTE[data.attribute];
    if (data.cropKey !== expectedCrop) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cropKey"],
        message: `El atributo '${data.attribute}' requiere el recorte '${expectedCrop}'.`,
      });
    }
    const validIds = IDS_VALIDOS[data.attribute];
    if (!validIds.includes(data.correctedLabel)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctedLabel"],
        message: `Etiqueta '${data.correctedLabel}' no permitida para '${data.attribute}'.`,
      });
    }
    try {
      const byteLen = decodificarLongitudBase64(data.vectorInt8B64);
      if (byteLen !== data.dim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vectorInt8B64"],
          message: `La longitud del vector (${byteLen} bytes) no coincide con dim=${data.dim}.`,
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vectorInt8B64"],
        message: "No se pudo decodificar el vector base64.",
      });
    }
  });

export type VisionFeedbackPayload = z.infer<typeof VisionFeedbackPayloadSchema>;
