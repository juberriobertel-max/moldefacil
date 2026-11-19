import { COLORES_RAPIDOS } from "../3d/types";

export interface DominantColorResult {
  hexDetectado: string;
  colorTallerHex: string;
  colorTallerNombre: string;
  porcentajeMuestrasValidas: number;
  muestrasEvaluadas: number;
}

interface RgbSample {
  r: number;
  g: number;
  b: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${clampByte(r)}${clampByte(g)}${clampByte(b)}`;
}

function hexToRgb(hex: string): RgbSample {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function saturacionHsv(r: number, g: number, b: number): number {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  if (maxC === 0) return 0;
  return (maxC - minC) / maxC;
}

/**
 * Distancia perceptual Redmean en sRGB entre dos colores.
 */
function distanciaRedmean(a: RgbSample, b: RgbSample): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const wr = 2 + rMean / 256;
  const wg = 4;
  const wb = 2 + (255 - rMean) / 256;
  return Math.sqrt(wr * dr * dr + wg * dg * dg + wb * db * db);
}

/**
 * Descarta píxeles transparentes, fondo casi blanco/negro y tonos de piel humana
 * combinando rangos YCbCr estándar con saturación y dominancia cálida para
 * evitar descartar telas terracota o coral saturadas.
 */
export function esPixelFondoOPiel(
  r: number,
  g: number,
  b: number,
  a = 255
): boolean {
  if (a < 128) return true;

  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = saturacionHsv(r, g, b);

  // Fondo casi blanco / estudio iluminado
  if ((r > 236 && g > 236 && b > 236) || (luma > 238 && sat < 0.1)) {
    return true;
  }

  // Fondo / sombra casi negra
  if (r < 18 && g < 18 && b < 18) {
    return true;
  }

  // Detección de tono de piel humana en espacio BT.601 YCbCr + HSV
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const enRangoYCbCr = cb >= 80 && cb <= 124 && cr >= 135 && cr <= 168;
  const dominanciaCalidaPiel =
    r > g && g > b && r - g >= 12 && r - g <= 78 && sat >= 0.14 && sat <= 0.52;

  if (enRangoYCbCr && dominanciaCalidaPiel) {
    return true;
  }

  return false;
}

/**
 * Agrupamiento K-Means ligero (k = 4, 8 iteraciones deterministas) en espacio RGB.
 */
function agruparKMeans4(
  samples: RgbSample[],
  priorizarCroma: boolean
): RgbSample {
  if (samples.length === 0) {
    return { r: 200, g: 90, b: 50 };
  }
  if (samples.length <= 4) {
    const sum = samples.reduce(
      (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
      { r: 0, g: 0, b: 0 }
    );
    return {
      r: sum.r / samples.length,
      g: sum.g / samples.length,
      b: sum.b / samples.length,
    };
  }

  const ordenados = [...samples].sort(
    (a, b) => a.r * 0.299 + a.g * 0.587 + a.b * 0.114 - (b.r * 0.299 + b.g * 0.587 + b.b * 0.114)
  );
  const K = 4;
  const centroides: RgbSample[] = [0.125, 0.375, 0.625, 0.875].map((q) => {
    const p = ordenados[Math.min(ordenados.length - 1, Math.floor(q * ordenados.length))];
    return { ...p };
  });

  const asignaciones = new Uint8Array(samples.length);
  const counts = [0, 0, 0, 0];

  for (let iter = 0; iter < 8; iter++) {
    counts.fill(0);
    const sumR = [0, 0, 0, 0];
    const sumG = [0, 0, 0, 0];
    const sumB = [0, 0, 0, 0];

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      let mejorK = 0;
      let mejorDist = Infinity;
      for (let k = 0; k < K; k++) {
        const c = centroides[k];
        const dr = p.r - c.r;
        const dg = p.g - c.g;
        const db = p.b - c.b;
        const d2 = dr * dr + dg * dg + db * db;
        if (d2 < mejorDist) {
          mejorDist = d2;
          mejorK = k;
        }
      }
      asignaciones[i] = mejorK;
      counts[mejorK]++;
      sumR[mejorK] += p.r;
      sumG[mejorK] += p.g;
      sumB[mejorK] += p.b;
    }

    for (let k = 0; k < K; k++) {
      if (counts[k] > 0) {
        centroides[k] = {
          r: sumR[k] / counts[k],
          g: sumG[k] / counts[k],
          b: sumB[k] / counts[k],
        };
      }
    }
  }

  let ganadorK = 0;
  let mejorPuntaje = -1;
  for (let k = 0; k < K; k++) {
    if (counts[k] === 0) continue;
    const c = centroides[k];
    const sat = saturacionHsv(c.r, c.g, c.b);
    const peso = priorizarCroma ? counts[k] * (0.85 + 0.35 * sat) : counts[k];
    if (peso > mejorPuntaje) {
      mejorPuntaje = peso;
      ganadorK = k;
    }
  }

  return centroides[ganadorK];
}

/**
 * Calcula el color dominante de la prenda sobre la región central
 * descartando fondo blanco/negro y tonos de piel humana.
 */
export function extraerColorDominantePrenda(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): DominantColorResult {
  const muestrasFiltradas: RgbSample[] = [];
  const muestrasNucleo: RgbSample[] = [];
  let visibles = 0;

  const coreMinX = Math.floor(width * 0.2);
  const coreMaxX = Math.ceil(width * 0.8);
  const coreMinY = Math.floor(height * 0.2);
  const coreMaxY = Math.ceil(height * 0.8);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3] ?? 255;
      if (a < 128) continue;
      visibles++;

      if (!esPixelFondoOPiel(r, g, b, a)) {
        muestrasFiltradas.push({ r, g, b });
      }
      if (x >= coreMinX && x < coreMaxX && y >= coreMinY && y < coreMaxY) {
        muestrasNucleo.push({ r, g, b });
      }
    }
  }

  // Salvaguarda para prendas blancas, marfil o negro absoluto
  const ratioValidas = visibles > 0 ? muestrasFiltradas.length / visibles : 0;
  const usarFallbackMonocromo = ratioValidas < 0.18 && muestrasNucleo.length > 0;
  const muestraFinal = usarFallbackMonocromo
    ? muestrasNucleo
    : muestrasFiltradas.length > 0
      ? muestrasFiltradas
      : muestrasNucleo;

  const centroide = agruparKMeans4(muestraFinal, !usarFallbackMonocromo);
  const hexDetectado = rgbToHex(centroide.r, centroide.g, centroide.b);

  let colorTallerHex: string = COLORES_RAPIDOS[0].hex;
  let colorTallerNombre: string = COLORES_RAPIDOS[0].nombre;
  let menorDistancia = Infinity;

  for (const item of COLORES_RAPIDOS) {
    const dist = distanciaRedmean(centroide, hexToRgb(item.hex));
    if (dist < menorDistancia) {
      menorDistancia = dist;
      colorTallerHex = item.hex;
      colorTallerNombre = item.nombre;
    }
  }

  return {
    hexDetectado,
    colorTallerHex,
    colorTallerNombre,
    porcentajeMuestrasValidas: Number(
      (usarFallbackMonocromo ? muestrasNucleo.length / Math.max(1, visibles) : ratioValidas).toFixed(3)
    ),
    muestrasEvaluadas: muestraFinal.length,
  };
}
