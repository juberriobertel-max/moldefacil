/**
 * Preprocesador inteligente de imagen 100% en navegador (Zero external APIs).
 *
 * Responsabilidades:
 * 1. Detectar y recortar automáticamente franjas sólidas de captura
 *    (negras, blancas o grises uniformes de Instagram, TikTok o Pinterest).
 * 2. Calcular y generar 4 vistas virtuales (Multi-Crop 224x224):
 *    - `full`: imagen completa limpia (categoría, largo, silueta, tela, estampado)
 *    - `neckline`: zoom en pecho y hombros (y: 12%–46%, x: 18%–82%)
 *    - `sleeves`: zoom en hombros y brazos (y: 12%–58%, x: 5%–95%)
 *    - `waistLower`: zoom en cintura y parte inferior (y: 38%–88%, x: 10%–90%)
 * 3. Extraer un buffer compacto de píxeles centrales (x: 30%–70%, y: 25%–70%)
 *    para detectar el color dominante sin depender del DOM dentro del Web Worker.
 */

export type VisionCropKey = "full" | "neckline" | "sleeves" | "waistLower";

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrimResult {
  top: number;
  bottom: number;
  left: number;
  right: number;
  trimmedWidth: number;
  trimmedHeight: number;
  barDetected: boolean;
}

export interface VisionCropPayload {
  key: VisionCropKey;
  width: number;
  height: number;
  dataUrl: string;
  rgba: Uint8ClampedArray;
}

export interface PreprocessedGarmentImage {
  sourceWidth: number;
  sourceHeight: number;
  trim: TrimResult;
  crops: Record<VisionCropKey, VisionCropPayload>;
  centralPixels: Uint8ClampedArray;
  centralWidth: number;
  centralHeight: number;
  silhouettePixels: Uint8ClampedArray;
  silhouetteWidth: number;
  silhouetteHeight: number;
}

const TARGET_CROP_SIZE = 224;
const CENTRAL_COLOR_SAMPLE_SIZE = 64;
const SILHOUETTE_SAMPLE_W = 120;
const SILHOUETTE_SAMPLE_H = 160;
const MAX_WORKING_DIMENSION = 768;

/**
 * Evalúa si una línea horizontal (fila) o vertical (columna) es una barra sólida
 * o casi uniforme típica de capturas móviles.
 */
function esLineaUniforme(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  esFila: boolean,
  indice: number,
  rangoInicio = 0,
  rangoFin?: number
): boolean {
  const maxExtremo = esFila ? width : height;
  const inicio = Math.max(0, Math.min(maxExtremo - 1, rangoInicio));
  const fin = Math.max(inicio + 1, Math.min(maxExtremo, rangoFin ?? maxExtremo));
  const longitud = fin - inicio;
  if (longitud <= 0) return false;

  const numMuestras = Math.min(48, longitud);
  const paso = Math.max(1, Math.floor(longitud / numMuestras));

  const rVals: number[] = [];
  const gVals: number[] = [];
  const bVals: number[] = [];
  const lumas: number[] = [];

  for (let i = inicio; i < fin; i += paso) {
    const x = esFila ? i : indice;
    const y = esFila ? indice : i;
    const idx = (y * width + x) * 4;
    const a = pixels[idx + 3] ?? 255;
    if (a < 16) continue;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    rVals.push(r);
    gVals.push(g);
    bVals.push(b);
    lumas.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  if (lumas.length === 0) return true;

  const sortedR = [...rVals].sort((a, b) => a - b);
  const sortedG = [...gVals].sort((a, b) => a - b);
  const sortedB = [...bVals].sort((a, b) => a - b);
  const mid = Math.floor(lumas.length / 2);
  const mr = sortedR[mid];
  const mg = sortedG[mid];
  const mb = sortedB[mid];

  let dentroDeTolerancia = 0;
  let sumaLuma = 0;
  for (let i = 0; i < lumas.length; i++) {
    sumaLuma += lumas[i];
    const maxDiff = Math.max(
      Math.abs(rVals[i] - mr),
      Math.abs(gVals[i] - mg),
      Math.abs(bVals[i] - mb)
    );
    if (maxDiff <= 14) {
      dentroDeTolerancia++;
    }
  }

  const ratioCoincidencia = dentroDeTolerancia / lumas.length;
  if (ratioCoincidencia < 0.9) return false;

  const mediaLuma = sumaLuma / lumas.length;
  let varianza = 0;
  for (let i = 0; i < lumas.length; i++) {
    const d = lumas[i] - mediaLuma;
    varianza += d * d;
  }
  const stdLuma = Math.sqrt(varianza / lumas.length);
  return stdLuma < 11;
}

/**
 * Detecta y calcula el recorte automático de barras negras, blancas o grises
 * uniformes en los cuatro bordes de una captura de pantalla.
 * Siempre conserva al menos el 50% del ancho y el alto originales.
 */
export function detectarRecorteBarrasCaptura(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): TrimResult {
  if (width < 16 || height < 16) {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      trimmedWidth: width,
      trimmedHeight: height,
      barDetected: false,
    };
  }

  const maxTopBottom = Math.floor(height * 0.25);
  const maxLeftRight = Math.floor(width * 0.22);
  const xSampleMin = Math.floor(width * 0.15);
  const xSampleMax = Math.ceil(width * 0.85);

  let top = 0;
  while (
    top < maxTopBottom &&
    esLineaUniforme(pixels, width, height, true, top, xSampleMin, xSampleMax)
  ) {
    top++;
  }

  let bottom = 0;
  while (
    bottom < maxTopBottom &&
    height - 1 - bottom > top &&
    esLineaUniforme(
      pixels,
      width,
      height,
      true,
      height - 1 - bottom,
      xSampleMin,
      xSampleMax
    )
  ) {
    bottom++;
  }

  const yInteriorMin = top;
  const yInteriorMax = Math.max(top + 1, height - bottom);

  let left = 0;
  while (
    left < maxLeftRight &&
    esLineaUniforme(
      pixels,
      width,
      height,
      false,
      left,
      yInteriorMin,
      yInteriorMax
    )
  ) {
    left++;
  }

  let right = 0;
  while (
    right < maxLeftRight &&
    width - 1 - right > left &&
    esLineaUniforme(
      pixels,
      width,
      height,
      false,
      width - 1 - right,
      yInteriorMin,
      yInteriorMax
    )
  ) {
    right++;
  }

  // Ignorar bordes de 1px aislados por compresión JPEG
  if (top < 2) top = 0;
  if (bottom < 2) bottom = 0;
  if (left < 2) left = 0;
  if (right < 2) right = 0;

  // Garantizar mínimo 50% del tamaño original
  const minW = Math.ceil(width * 0.5);
  const minH = Math.ceil(height * 0.5);

  if (height - top - bottom < minH) {
    const exceso = minH - (height - top - bottom);
    top = Math.max(0, top - Math.ceil(exceso / 2));
    bottom = Math.max(0, height - minH - top);
  }
  if (width - left - right < minW) {
    const exceso = minW - (width - left - right);
    left = Math.max(0, left - Math.ceil(exceso / 2));
    right = Math.max(0, width - minW - left);
  }

  const trimmedWidth = Math.max(1, width - left - right);
  const trimmedHeight = Math.max(1, height - top - bottom);

  return {
    top,
    bottom,
    left,
    right,
    trimmedWidth,
    trimmedHeight,
    barDetected: top > 0 || bottom > 0 || left > 0 || right > 0,
  };
}

function clampBox(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number,
  width: number,
  height: number
): CropBox {
  const x = Math.max(0, Math.min(width - 1, Math.round(width * rx1)));
  const y = Math.max(0, Math.min(height - 1, Math.round(height * ry1)));
  const maxX = Math.max(x + 1, Math.min(width, Math.round(width * rx2)));
  const maxY = Math.max(y + 1, Math.min(height, Math.round(height * ry2)));
  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

/**
 * Calcula las 4 regiones de recorte Multi-Crop sobre dimensiones limpias.
 */
export function calcularCoordenadasMultiCrop(
  width: number,
  height: number
): Record<VisionCropKey, CropBox> {
  return {
    full: { x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) },
    neckline: clampBox(0.18, 0.12, 0.82, 0.46, width, height),
    sleeves: clampBox(0.05, 0.12, 0.95, 0.58, width, height),
    waistLower: clampBox(0.1, 0.38, 0.9, 0.88, width, height),
  };
}

/**
 * Región central para extracción de color dominante (x: 30%–70%, y: 25%–70%).
 */
export function calcularCoordenadasCentroPrenda(
  width: number,
  height: number
): CropBox {
  return clampBox(0.3, 0.25, 0.7, 0.7, width, height);
}

function cargarImagenEnCanvas(imageSrc: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const natW = Math.max(1, img.naturalWidth || img.width || 360);
      const natH = Math.max(1, img.naturalHeight || img.height || 480);
      const scale = Math.min(1, MAX_WORKING_DIMENSION / Math.max(natW, natH));
      const w = Math.max(1, Math.round(natW * scale));
      const h = Math.max(1, Math.round(natH * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Contexto 2D no disponible"));
        return;
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen subida"));
    img.src = imageSrc;
  });
}

function generarRecorteNormalizado(
  sourceCanvas: HTMLCanvasElement,
  box: CropBox,
  key: VisionCropKey
): VisionCropPayload {
  const out = document.createElement("canvas");
  out.width = TARGET_CROP_SIZE;
  out.height = TARGET_CROP_SIZE;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Contexto 2D no disponible al generar vista virtual");
  }
  ctx.fillStyle = "#F7F5F2";
  ctx.fillRect(0, 0, TARGET_CROP_SIZE, TARGET_CROP_SIZE);
  ctx.drawImage(
    sourceCanvas,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    TARGET_CROP_SIZE,
    TARGET_CROP_SIZE
  );
  const rgba = ctx.getImageData(0, 0, TARGET_CROP_SIZE, TARGET_CROP_SIZE).data;
  const dataUrl = out.toDataURL("image/jpeg", 0.88);
  return {
    key,
    width: TARGET_CROP_SIZE,
    height: TARGET_CROP_SIZE,
    dataUrl,
    rgba,
  };
}

/**
 * Preprocesa la imagen subida en el hilo principal (< 15 ms):
 * - Auto-recorta franjas uniformes de captura.
 * - Produce las 4 vistas normalizadas 224x224 listas para transferir al Web Worker.
 * - Extrae la muestra central para identificar el color dominante de la tela.
 */
export async function preprocesarImagenPrenda(
  imageSrc: string
): Promise<PreprocessedGarmentImage> {
  if (typeof document === "undefined") {
    throw new Error("preprocesarImagenPrenda requiere entorno de navegador");
  }

  const rawCanvas = await cargarImagenEnCanvas(imageSrc);
  const rawCtx = rawCanvas.getContext("2d", { willReadFrequently: true });
  if (!rawCtx) {
    throw new Error("No se pudo leer los píxeles de la imagen");
  }

  const rawPixels = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height).data;
  const trim = detectarRecorteBarrasCaptura(rawPixels, rawCanvas.width, rawCanvas.height);

  const cleanCanvas = document.createElement("canvas");
  cleanCanvas.width = trim.trimmedWidth;
  cleanCanvas.height = trim.trimmedHeight;
  const cleanCtx = cleanCanvas.getContext("2d", { willReadFrequently: true });
  if (!cleanCtx) {
    throw new Error("Contexto 2D no disponible para lienzo limpio");
  }
  cleanCtx.drawImage(
    rawCanvas,
    trim.left,
    trim.top,
    trim.trimmedWidth,
    trim.trimmedHeight,
    0,
    0,
    trim.trimmedWidth,
    trim.trimmedHeight
  );

  const boxes = calcularCoordenadasMultiCrop(trim.trimmedWidth, trim.trimmedHeight);
  const crops: Record<VisionCropKey, VisionCropPayload> = {
    full: generarRecorteNormalizado(cleanCanvas, boxes.full, "full"),
    neckline: generarRecorteNormalizado(cleanCanvas, boxes.neckline, "neckline"),
    sleeves: generarRecorteNormalizado(cleanCanvas, boxes.sleeves, "sleeves"),
    waistLower: generarRecorteNormalizado(cleanCanvas, boxes.waistLower, "waistLower"),
  };

  // Extraer región central de 64x64 para color dominante
  const centralBox = calcularCoordenadasCentroPrenda(trim.trimmedWidth, trim.trimmedHeight);
  const centralCanvas = document.createElement("canvas");
  centralCanvas.width = CENTRAL_COLOR_SAMPLE_SIZE;
  centralCanvas.height = CENTRAL_COLOR_SAMPLE_SIZE;
  const centralCtx = centralCanvas.getContext("2d", { willReadFrequently: true });
  if (!centralCtx) {
    throw new Error("Contexto 2D no disponible para muestra de color");
  }
  centralCtx.drawImage(
    cleanCanvas,
    centralBox.x,
    centralBox.y,
    centralBox.width,
    centralBox.height,
    0,
    0,
    CENTRAL_COLOR_SAMPLE_SIZE,
    CENTRAL_COLOR_SAMPLE_SIZE
  );
  const centralPixels = centralCtx.getImageData(
    0,
    0,
    CENTRAL_COLOR_SAMPLE_SIZE,
    CENTRAL_COLOR_SAMPLE_SIZE
  ).data;

  // Extraer mapa de silueta completo (120x160) para auto-colocar los pines 2D
  const silCanvas = document.createElement("canvas");
  silCanvas.width = SILHOUETTE_SAMPLE_W;
  silCanvas.height = SILHOUETTE_SAMPLE_H;
  const silCtx = silCanvas.getContext("2d", { willReadFrequently: true });
  if (!silCtx) {
    throw new Error("Contexto 2D no disponible para análisis de silueta");
  }
  silCtx.drawImage(
    cleanCanvas,
    0,
    0,
    trim.trimmedWidth,
    trim.trimmedHeight,
    0,
    0,
    SILHOUETTE_SAMPLE_W,
    SILHOUETTE_SAMPLE_H
  );
  const silhouettePixels = silCtx.getImageData(
    0,
    0,
    SILHOUETTE_SAMPLE_W,
    SILHOUETTE_SAMPLE_H
  ).data;

  return {
    sourceWidth: rawCanvas.width,
    sourceHeight: rawCanvas.height,
    trim,
    crops,
    centralPixels,
    centralWidth: CENTRAL_COLOR_SAMPLE_SIZE,
    centralHeight: CENTRAL_COLOR_SAMPLE_SIZE,
    silhouettePixels,
    silhouetteWidth: SILHOUETTE_SAMPLE_W,
    silhouetteHeight: SILHOUETTE_SAMPLE_H,
  };
}
