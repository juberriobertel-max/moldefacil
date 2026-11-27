import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RawImage } from "@huggingface/transformers";
import type { CropRawInput } from "../../lib/vision/cascadeRunner";
import {
  calcularCoordenadasMultiCrop,
  detectarRecorteBarrasCaptura,
  type TrimResult,
  type VisionCropKey,
} from "../../lib/vision/imagePreprocessor";
import {
  type AtributoVision,
  ATRIBUTOS_VISION,
  IDS_VALIDOS,
} from "../../lib/vision/visionAttributes";

export type VisionManifestSource =
  | "ai_generated"
  | "propia"
  | "modista"
  | "render_propio"
  | "licencia_abierta";

export interface VisionManifestItem {
  id: string;
  file: string;
  labels: Partial<Record<AtributoVision, string>>;
  source: VisionManifestSource;
  license: string;
  notes?: string;
}

export interface VisionManifestFile {
  version: 1;
  items: VisionManifestItem[];
}

export interface NodePreprocessedImage {
  absPath: string;
  sha256: string;
  trim: TrimResult;
  crops: Record<VisionCropKey, CropRawInput>;
}

const MAX_WORKING_DIMENSION = 768;
const TARGET_CROP_SIZE = 224;
const CROP_KEYS: readonly VisionCropKey[] = [
  "full",
  "neckline",
  "sleeves",
  "waistLower",
];

/**
 * Convierte un `modelId` de Hugging Face al nombre base de archivo JSON de referencia.
 */
export function slugModeloVision(modelId: string): string {
  const clean = modelId.trim();
  const afterSlash = clean.includes("/")
    ? clean.split("/").slice(1).join("-")
    : clean;
  return afterSlash.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/**
 * Lee y valida un `manifest.json` contra `IDS_VALIDOS`.
 * Falla explícitamente si hay formato inválido o etiquetas desconocidas.
 */
export function cargarYValidarManifest(manifestPath: string): {
  manifestDir: string;
  items: VisionManifestItem[];
} {
  const absManifest = path.resolve(manifestPath);
  if (!fs.existsSync(absManifest)) {
    throw new Error(`No existe el archivo de manifiesto: ${absManifest}`);
  }

  const rawText = fs.readFileSync(absManifest, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(rawText) as Partial<VisionManifestFile>;
  if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error(
      `El manifiesto ${absManifest} debe tener { "version": 1, "items": [...] }.`
    );
  }

  const errores: string[] = [];
  const validAttrSet = new Set<string>(ATRIBUTOS_VISION);
  const validValuesByAttr = new Map<string, Set<string>>();
  for (const attr of ATRIBUTOS_VISION) {
    validValuesByAttr.set(attr, new Set(IDS_VALIDOS[attr]));
  }

  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i] as Partial<VisionManifestItem>;
    const prefix = `Item #${i} (${item?.id ?? "sin-id"})`;
    if (!item?.id || typeof item.id !== "string") {
      errores.push(`${prefix}: falta campo 'id' string.`);
    }
    if (!item?.file || typeof item.file !== "string") {
      errores.push(`${prefix}: falta campo 'file' string.`);
    }
    if (!item?.labels || typeof item.labels !== "object") {
      errores.push(`${prefix}: falta objeto 'labels'.`);
      continue;
    }
    for (const [attr, val] of Object.entries(item.labels)) {
      if (!validAttrSet.has(attr)) {
        errores.push(`${prefix}: atributo desconocido '${attr}'.`);
        continue;
      }
      if (typeof val !== "string" || !validValuesByAttr.get(attr)?.has(val)) {
        const permitidos = Array.from(validValuesByAttr.get(attr) ?? []).join(", ");
        errores.push(
          `${prefix}: valor '${String(val)}' no válido para '${attr}'. Permitidos: [${permitidos}].`
        );
      }
    }
  }

  if (errores.length > 0) {
    throw new Error(
      `Se encontraron ${errores.length} error(es) de validación en ${absManifest}:\n- ${errores.join("\n- ")}`
    );
  }

  return {
    manifestDir: path.dirname(absManifest),
    items: parsed.items,
  };
}

/**
 * Calcula el SHA-256 binario de un archivo de imagen para control estricto de fugas eval/reference.
 */
export function calcularSha256Archivo(absPath: string): string {
  const bytes = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function componerSobreBlancoRgba(
  data: Uint8Array | Uint8ClampedArray
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 255) {
      out[i] = data[i];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[i + 2];
      out[i + 3] = 255;
    } else if (a === 0) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    } else {
      const inv = 255 - a;
      out[i] = Math.round((data[i] * a + 255 * inv) / 255);
      out[i + 1] = Math.round((data[i + 1] * a + 255 * inv) / 255);
      out[i + 2] = Math.round((data[i + 2] * a + 255 * inv) / 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Preprocesa una imagen en Node replicando exactamente el preprocesamiento del navegador:
 * 1. Escala a máx 768 px y compone transparencia sobre blanco.
 * 2. Recorta franjas sólidas uniformes con `detectarRecorteBarrasCaptura`.
 * 3. Extrae las 4 vistas Multi-Crop (`full`, `neckline`, `sleeves`, `waistLower`) en 224×224 RGBA.
 */
export async function prepararRecortesDesdeArchivo(
  absPath: string
): Promise<NodePreprocessedImage> {
  const sha256 = calcularSha256Archivo(absPath);
  let rawImg = (await RawImage.read(absPath)).rgba();

  const natW = Math.max(1, rawImg.width);
  const natH = Math.max(1, rawImg.height);
  const scale = Math.min(1, MAX_WORKING_DIMENSION / Math.max(natW, natH));
  const workW = Math.max(1, Math.round(natW * scale));
  const workH = Math.max(1, Math.round(natH * scale));
  if (workW !== natW || workH !== natH) {
    rawImg = (await rawImg.resize(workW, workH)).rgba();
  }

  const whiteRgba = componerSobreBlancoRgba(rawImg.data);
  const cleanFull = new RawImage(whiteRgba, rawImg.width, rawImg.height, 4);
  const trim = detectarRecorteBarrasCaptura(
    whiteRgba,
    rawImg.width,
    rawImg.height
  );

  const trimmedImg = await cleanFull
    .clone()
    .crop([
      trim.left,
      trim.top,
      trim.left + trim.trimmedWidth - 1,
      trim.top + trim.trimmedHeight - 1,
    ]);

  const boxes = calcularCoordenadasMultiCrop(
    trim.trimmedWidth,
    trim.trimmedHeight
  );

  const crops = {} as Record<VisionCropKey, CropRawInput>;
  for (const key of CROP_KEYS) {
    const box = boxes[key];
    const subImg = await trimmedImg
      .clone()
      .crop([box.x, box.y, box.x + box.width - 1, box.y + box.height - 1]);
    const resized = (await subImg.resize(TARGET_CROP_SIZE, TARGET_CROP_SIZE)).rgba();
    crops[key] = {
      width: resized.width,
      height: resized.height,
      rgba: new Uint8ClampedArray(resized.data),
    };
  }

  return {
    absPath,
    sha256,
    trim,
    crops,
  };
}

/**
 * Convierte un `CropRawInput` RGBA a `RawImage` RGB listo para procesador / modelo CLIP/SigLIP.
 */
export function cropARawImage(crop: CropRawInput): RawImage {
  const bytes =
    crop.rgba instanceof Uint8ClampedArray
      ? crop.rgba
      : new Uint8ClampedArray(crop.rgba);
  return new RawImage(bytes, crop.width, crop.height, 4).rgb();
}
