import { GarmentCategory, TracingPins } from "../types";
import { getDefaultPinsForCategory } from "../proportionSolver";
import type { DominantColorResult } from "./colorExtractor";
import type { TrimResult } from "./imagePreprocessor";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface RowProfile {
  y: number;
  xLeft: number;
  xRight: number;
  xCenter: number;
  garmentCount: number;
  skinCenterCount: number;
  hasFlankedGarment: boolean;
}

export interface DetectedSilhouetteBounds {
  detected: boolean;
  bodyTopNorm: number;
  bottomNorm: number;
  splitNorm: number;
  waistNorm: number;
  crotchNorm: number;
  shoulderLeftNorm: number;
  shoulderCenterNorm: number;
  waistLeftNorm: number;
  hipLeftNorm: number;
  hemLeftNorm: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 200, g: 90, b: 50 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorDist(a: RgbColor, r: number, g: number, b: number): number {
  const dr = a.r - r;
  const dg = a.g - g;
  const db = a.b - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Detecta tonos de piel humana en YCbCr + HSV sin descartar telas blancas,
 * marfil ni negras para preservar siluetas de alto contraste.
 */
export function esPixelPielHumana(r: number, g: number, b: number): boolean {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return (
    cb >= 80 &&
    cb <= 124 &&
    cr >= 135 &&
    cr <= 168 &&
    r > g &&
    g > b &&
    r - g >= 12 &&
    r - g <= 78 &&
    sat >= 0.14 &&
    sat <= 0.52
  );
}

function agruparCentroidesRapido(
  samples: RgbColor[],
  kClusters = 4
): RgbColor[] {
  if (samples.length === 0) return [{ r: 245, g: 245, b: 245 }];
  const sorted = [...samples].sort(
    (a, b) =>
      0.299 * a.r + 0.587 * a.g + 0.114 * a.b - (0.299 * b.r + 0.587 * b.g + 0.114 * b.b)
  );
  const K = Math.min(kClusters, sorted.length);
  const centroids: RgbColor[] = [];
  for (let k = 0; k < K; k++) {
    const idx = Math.min(
      sorted.length - 1,
      Math.floor(((k + 0.5) / K) * sorted.length)
    );
    centroids.push({ ...sorted[idx] });
  }

  for (let iter = 0; iter < 5; iter++) {
    const sumR = new Array<number>(K).fill(0);
    const sumG = new Array<number>(K).fill(0);
    const sumB = new Array<number>(K).fill(0);
    const counts = new Array<number>(K).fill(0);

    for (const p of samples) {
      let bestK = 0;
      let bestDist = Infinity;
      for (let k = 0; k < K; k++) {
        const d = colorDist(centroids[k], p.r, p.g, p.b);
        if (d < bestDist) {
          bestDist = d;
          bestK = k;
        }
      }
      counts[bestK]++;
      sumR[bestK] += p.r;
      sumG[bestK] += p.g;
      sumB[bestK] += p.b;
    }

    for (let k = 0; k < K; k++) {
      if (counts[k] > 0) {
        centroids[k] = {
          r: sumR[k] / counts[k],
          g: sumG[k] / counts[k],
          b: sumB[k] / counts[k],
        };
      }
    }
  }

  return centroids;
}

function estimarFondoYPrenda(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  colorDominante?: DominantColorResult
): {
  bgCentroids: RgbColor[];
  fgSignatures: RgbColor[];
} {
  const bgSamples: RgbColor[] = [];
  const topBand = Math.max(2, Math.floor(height * 0.06));
  const sideBand = Math.max(2, Math.floor(width * 0.08));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const esBorde =
        y < topBand ||
        (y >= topBand &&
          y < Math.floor(height * 0.92) &&
          (x < sideBand || x >= width - sideBand));
      if (!esBorde) continue;
      const idx = (y * width + x) * 4;
      if ((pixels[idx + 3] ?? 255) < 128) continue;
      bgSamples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
    }
  }

  const bgCentroids = agruparCentroidesRapido(bgSamples, 4);
  const distFondo = (r: number, g: number, b: number) => {
    let minD = Infinity;
    for (const bg of bgCentroids) {
      const d = colorDist(bg, r, g, b);
      if (d < minD) minD = d;
    }
    return minD;
  };

  // Firmas de color para torso superior e inferior (soporta 2 piezas bicolores)
  const upperSamples: RgbColor[] = [];
  const lowerSamples: RgbColor[] = [];
  const cxMin = Math.floor(width * 0.32);
  const cxMax = Math.ceil(width * 0.68);

  for (let y = Math.floor(height * 0.28); y < Math.ceil(height * 0.86); y++) {
    for (let x = cxMin; x < cxMax; x++) {
      const idx = (y * width + x) * 4;
      if ((pixels[idx + 3] ?? 255) < 128) continue;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      if (esPixelPielHumana(r, g, b)) continue;
      if (distFondo(r, g, b) < 38) continue;

      if (y < height * 0.54) {
        upperSamples.push({ r, g, b });
      } else {
        lowerSamples.push({ r, g, b });
      }
    }
  }

  const fgSignatures: RgbColor[] = [];
  if (upperSamples.length >= 6) {
    fgSignatures.push(agruparCentroidesRapido(upperSamples, 1)[0]);
  }
  if (lowerSamples.length >= 6) {
    fgSignatures.push(agruparCentroidesRapido(lowerSamples, 1)[0]);
  }
  if (fgSignatures.length === 0 && colorDominante) {
    fgSignatures.push(hexToRgb(colorDominante.hexDetectado));
  }

  return { bgCentroids, fgSignatures };
}

/**
 * Segmenta en < 5 ms la silueta de la prenda, separando rostro/cabello superior
 * y ubicando bordes horizontales y verticales reales fila por fila.
 */
export function detectarSiluetaPrenda(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  colorDominante?: DominantColorResult
): DetectedSilhouetteBounds {
  const fallback: DetectedSilhouetteBounds = {
    detected: false,
    bodyTopNorm: 0.14,
    bottomNorm: 0.86,
    splitNorm: 0.41,
    waistNorm: 0.43,
    crotchNorm: 0.44,
    shoulderLeftNorm: 0.36,
    shoulderCenterNorm: 0.5,
    waistLeftNorm: 0.4,
    hipLeftNorm: 0.36,
    hemLeftNorm: 0.34,
  };

  if (width < 24 || height < 24) return fallback;

  const { bgCentroids, fgSignatures } = estimarFondoYPrenda(
    pixels,
    width,
    height,
    colorDominante
  );

  const distMin = (list: RgbColor[], r: number, g: number, b: number) => {
    let best = Infinity;
    for (const c of list) {
      const d = colorDist(c, r, g, b);
      if (d < best) best = d;
    }
    return best;
  };

  const xMinScan = Math.floor(width * 0.12);
  const xMaxScan = Math.ceil(width * 0.88);
  const skinBandMin = Math.floor(width * 0.34);
  const skinBandMax = Math.ceil(width * 0.66);

  const profiles: RowProfile[] = [];
  const activeMinPixels = Math.max(4, Math.round(width * 0.055));

  for (let y = 0; y < height; y++) {
    const fgXs: number[] = [];
    const skinXs: number[] = [];

    for (let x = xMinScan; x < xMaxScan; x++) {
      const idx = (y * width + x) * 4;
      if ((pixels[idx + 3] ?? 255) < 128) continue;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const isSkin = esPixelPielHumana(r, g, b);
      if (isSkin && x >= skinBandMin && x < skinBandMax) {
        skinXs.push(x);
        continue;
      }

      const dBg = distMin(bgCentroids, r, g, b);
      const dFg =
        fgSignatures.length > 0 ? distMin(fgSignatures, r, g, b) : 0;

      // Rechaza fondo; acepta tonos de prenda cercanos o contraste alto claro sobre fondo
      const isGarmentPixel =
        dBg > 40 &&
        !isSkin &&
        (fgSignatures.length === 0 ||
          dFg < Math.max(115, dBg * 1.15) ||
          dBg > 82);

      if (isGarmentPixel) {
        fgXs.push(x);
      }
    }

    if (fgXs.length >= activeMinPixels) {
      const p12 = fgXs[Math.floor(fgXs.length * 0.12)];
      const p88 = fgXs[Math.min(fgXs.length - 1, Math.floor(fgXs.length * 0.88))];
      const leftRatio = p12 / width;
      const rightRatio = p88 / width;
      const centerRatio = (leftRatio + rightRatio) / 2;

      let leftSideFg = 0;
      let rightSideFg = 0;
      if (skinXs.length > 0) {
        const skinAvgX =
          skinXs.reduce((a, v) => a + v, 0) / skinXs.length;
        for (const gx of fgXs) {
          if (gx < skinAvgX - 2) leftSideFg++;
          else if (gx > skinAvgX + 2) rightSideFg++;
        }
      }

      profiles.push({
        y,
        xLeft: leftRatio,
        xRight: rightRatio,
        xCenter: centerRatio,
        garmentCount: fgXs.length,
        skinCenterCount: skinXs.length,
        hasFlankedGarment: leftSideFg >= 3 && rightSideFg >= 3,
      });
    } else {
      const approxCenter = 0.5;
      profiles.push({
        y,
        xLeft: 0.38,
        xRight: 0.62,
        xCenter: approxCenter,
        garmentCount: fgXs.length,
        skinCenterCount: skinXs.length,
        hasFlankedGarment: false,
      });
    }
  }

  // Encontrar la masa principal de la prenda (ignorando ruido aislado arriba/abajo)
  const isRowDense = (p: RowProfile) => p.garmentCount >= activeMinPixels;
  let firstActive = -1;
  let lastActive = -1;
  for (let y = 0; y < height; y++) {
    if (!isRowDense(profiles[y])) continue;
    // Verificar continuidad en ventana local de 5 filas
    let neighbors = 0;
    for (
      let k = Math.max(0, y - 2);
      k <= Math.min(height - 1, y + 4);
      k++
    ) {
      if (isRowDense(profiles[k])) neighbors++;
    }
    if (neighbors >= 3) {
      if (firstActive === -1) firstActive = y;
      lastActive = y;
    }
  }

  if (firstActive === -1 || lastActive - firstActive < height * 0.16) {
    return fallback;
  }

  // Exclusión de rostro/cabello superior:
  // Recorremos de arriba hacia abajo solo HASTA encontrar el primer bloque sólido de prenda
  // (hombros/blusa/top). Una vez encontrado un bloque de torso (>= 5 filas densas), cualquier
  // piel posterior (ej. abdomen descubierto debajo de un crop top) ya corresponde al corte 2 piezas.
  let bodyTopRow = firstActive;
  const minSkinFacePixels = Math.max(3, Math.round(width * 0.03));
  const minBodiceWidthPixels = Math.max(6, Math.round(width * 0.09));
  const upperScanLimit = Math.min(
    Math.floor(height * 0.46),
    lastActive - Math.floor(height * 0.16)
  );

  let foundUpperFace = false;
  let lastFaceBeforeGarment = -1;
  let denseGarmentStreak = 0;

  for (let y = Math.floor(height * 0.04); y <= upperScanLimit; y++) {
    const p = profiles[y];
    if (p.skinCenterCount >= minSkinFacePixels && !p.hasFlankedGarment) {
      foundUpperFace = true;
      lastFaceBeforeGarment = y;
      denseGarmentStreak = 0;
      continue;
    }

    if (p.garmentCount >= minBodiceWidthPixels) {
      denseGarmentStreak++;
      // Si ya llevamos al menos 4 filas seguidas de prenda ancha (ej. top/hombros),
      // detenemos el escaneo de cabeza para no confundir un abdomen descubierto con un rostro.
      if (denseGarmentStreak >= 4) {
        break;
      }
    } else {
      denseGarmentStreak = 0;
    }
  }

  if (foundUpperFace && lastFaceBeforeGarment > 0) {
    for (let y = lastFaceBeforeGarment + 1; y < lastActive - 8; y++) {
      let denseCount = 0;
      for (let k = y; k <= Math.min(lastActive, y + 4); k++) {
        if (isRowDense(profiles[k])) denseCount++;
      }
      if (denseCount >= 4) {
        bodyTopRow = y;
        break;
      }
    }
  }

  const bodySpan = Math.max(height * 0.18, lastActive - bodyTopRow);

  // Buscar separación 2 piezas (abertura en cintura con piel o caída en densidad de tela)
  const splitSearchStart = Math.round(bodyTopRow + bodySpan * 0.14);
  const splitSearchEnd = Math.round(bodyTopRow + bodySpan * 0.48);
  let bestSplitRow = Math.round(bodyTopRow + bodySpan * 0.30);
  let bestSplitScore = -Infinity;

  for (let y = splitSearchStart; y <= splitSearchEnd; y++) {
    const p = profiles[y];
    const spanRatio = (p.y - bodyTopRow) / bodySpan;
    const densityDrop = 1 - Math.min(1, p.garmentCount / Math.max(8, width * 0.28));
    const skinBonus = p.skinCenterCount >= 3 ? 0.9 : 0;
    const priorCenterBonus = 0.25 * (1 - Math.abs(spanRatio - 0.29) / 0.2);
    const score = skinBonus + densityDrop * 0.65 + priorCenterBonus;
    if (score > bestSplitScore) {
      bestSplitScore = score;
      bestSplitRow = y;
    }
  }

  // Cintura más estrecha en vestido/blusa entre 20% y 46%
  const waistSearchStart = Math.round(bodyTopRow + bodySpan * 0.2);
  const waistSearchEnd = Math.round(bodyTopRow + bodySpan * 0.46);
  let bestWaistRow = Math.round(bodyTopRow + bodySpan * 0.34);
  let minGarmentSpan = Infinity;

  for (let y = waistSearchStart; y <= waistSearchEnd; y++) {
    const p = profiles[y];
    if (!isRowDense(p)) continue;
    const wNorm = p.xRight - p.xLeft;
    if (wNorm > 0.04 && wNorm < minGarmentSpan) {
      minGarmentSpan = wNorm;
      bestWaistRow = y;
    }
  }

  // Bifurcación para tiro de pantalón entre 26% y 55%
  const crotchSearchStart = Math.round(bodyTopRow + bodySpan * 0.26);
  const crotchSearchEnd = Math.round(bodyTopRow + bodySpan * 0.55);
  let bestCrotchRow = Math.round(bodyTopRow + bodySpan * 0.42);
  for (let y = crotchSearchStart; y <= crotchSearchEnd; y++) {
    const p = profiles[y];
    if (!isRowDense(p)) continue;
    // Revisar si el centro [xCenter - 2px .. xCenter + 2px] tiene hueco de fondo entre piernas
    const cx = Math.round(p.xCenter * width);
    let centerBgHits = 0;
    for (let dx = -2; dx <= 2; dx++) {
      const pxX = clamp(cx + dx, 0, width - 1);
      const idx = (y * width + pxX) * 4;
      const dBg = distMin(bgCentroids, pixels[idx], pixels[idx + 1], pixels[idx + 2]);
      if (dBg < 34) centerBgHits++;
    }
    if (centerBgHits >= 3) {
      bestCrotchRow = y;
      break;
    }
  }

  // Muestrear perfiles promediados en 5 puntos verticales clave
  const sampleBand = (targetY: number): { left: number; right: number; center: number } => {
    const rMin = clamp(Math.round(targetY) - 2, bodyTopRow, lastActive);
    const rMax = clamp(Math.round(targetY) + 2, bodyTopRow, lastActive);
    let sumL = 0;
    let sumC = 0;
    let sumR = 0;
    let n = 0;
    for (let ry = rMin; ry <= rMax; ry++) {
      const pr = profiles[ry];
      if (!isRowDense(pr)) continue;
      sumL += pr.xLeft;
      sumR += pr.xRight;
      sumC += pr.xCenter;
      n++;
    }
    if (n === 0) return { left: 0.36, right: 0.64, center: 0.5 };
    return {
      left: sumL / n,
      right: sumR / n,
      center: sumC / n,
    };
  };

  const shoulderRow = clamp(Math.round(bodyTopRow + bodySpan * 0.045), bodyTopRow, lastActive);
  const hipRow = clamp(
    Math.round(bestWaistRow + (lastActive - bestWaistRow) * 0.28),
    bodyTopRow,
    lastActive
  );
  const hemRow = clamp(Math.round(lastActive - bodySpan * 0.025), bodyTopRow, lastActive);

  const shoulderBand = sampleBand(shoulderRow);
  const waistBand = sampleBand(bestWaistRow);
  const hipBand = sampleBand(hipRow);
  const hemBand = sampleBand(hemRow);

  return {
    detected: true,
    bodyTopNorm: clamp(bodyTopRow / height, 0.04, 0.65),
    bottomNorm: clamp(lastActive / height, 0.35, 0.96),
    splitNorm: clamp(bestSplitRow / height, 0.2, 0.72),
    waistNorm: clamp(bestWaistRow / height, 0.2, 0.68),
    crotchNorm: clamp(bestCrotchRow / height, 0.25, 0.72),
    shoulderLeftNorm: clamp(shoulderBand.left, 0.1, 0.75),
    shoulderCenterNorm: clamp(shoulderBand.center, 0.2, 0.8),
    waistLeftNorm: clamp(waistBand.left, 0.1, 0.75),
    hipLeftNorm: clamp(hipBand.left, 0.1, 0.75),
    hemLeftNorm: clamp(hemBand.left, 0.1, 0.75),
  };
}

/**
 * Proyecta un punto (u, v) del área preprocesada limpia hacia las coordenadas [0.05..0.94]
 * visibles dentro del marco `aspect-[3/4]` con CSS `object-contain`.
 */
export function proyectarAContenedorContain(
  uClean: number,
  vClean: number,
  sourceWidth: number,
  sourceHeight: number,
  trim: TrimResult
): { x: number; y: number } {
  const safeW = Math.max(1, sourceWidth);
  const safeH = Math.max(1, sourceHeight);

  const imgU = clamp((trim.left + uClean * trim.trimmedWidth) / safeW, 0, 1);
  const imgV = clamp((trim.top + vClean * trim.trimmedHeight) / safeH, 0, 1);

  const imgAspect = safeW / safeH;
  const containerAspect = 0.75; // aspect-[3/4]

  let boxX: number;
  let boxY: number;

  if (Math.abs(imgAspect - containerAspect) < 0.01) {
    boxX = imgU;
    boxY = imgV;
  } else if (imgAspect > containerAspect) {
    const renderedH = containerAspect / imgAspect;
    const padY = (1 - renderedH) / 2;
    boxX = imgU;
    boxY = padY + imgV * renderedH;
  } else {
    const renderedW = imgAspect / containerAspect;
    const padX = (1 - renderedW) / 2;
    boxX = padX + imgU * renderedW;
    boxY = imgV;
  }

  return {
    x: Number(clamp(boxX, 0.06, 0.94).toFixed(4)),
    y: Number(clamp(boxY, 0.06, 0.93).toFixed(4)),
  };
}

/**
 * Calcula los pines anatómicos auto-posicionados para TODAS las categorías
 * sobre la silueta real detectada en la foto. Si la silueta no es clara,
 * conserva los valores por defecto seguros de `getDefaultPinsForCategory`.
 */
export function calcularPinesAutomaticosPorCategoria(params: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  trim: TrimResult;
  colorDominante?: DominantColorResult;
}): Record<GarmentCategory, TracingPins> {
  const { pixels, width, height, sourceWidth, sourceHeight, trim, colorDominante } =
    params;

  const s = detectarSiluetaPrenda(pixels, width, height, colorDominante);
  if (!s.detected) {
    return {
      top: getDefaultPinsForCategory("top"),
      pants: getDefaultPinsForCategory("pants"),
      skirt: getDefaultPinsForCategory("skirt"),
      dress: getDefaultPinsForCategory("dress"),
      two_piece: getDefaultPinsForCategory("two_piece"),
      jumpsuit: getDefaultPinsForCategory("jumpsuit"),
      kids: getDefaultPinsForCategory("kids"),
      loungewear: getDefaultPinsForCategory("loungewear"),
      accessories: getDefaultPinsForCategory("accessories"),
    };
  }

  const p = (u: number, v: number) =>
    proyectarAContenedorContain(u, v, sourceWidth, sourceHeight, trim);

  const H = Math.max(0.2, s.bottomNorm - s.bodyTopNorm);
  const cx = s.shoulderCenterNorm;
  const shoulderX = lerp(s.shoulderLeftNorm, cx, 0.14);
  const topY = s.bodyTopNorm + H * 0.04;
  const neckY = s.bodyTopNorm + H * 0.1;

  // Pines base compartidos
  const shoulderPt = p(shoulderX, topY);
  const necklinePt = p(cx, neckY);
  const waistPt = p(lerp(s.waistLeftNorm, cx, 0.12), s.waistNorm);
  const hipPt = p(
    lerp(s.hipLeftNorm, cx, 0.08),
    s.waistNorm + Math.max(0.08, (s.bottomNorm - s.waistNorm) * 0.3)
  );
  const hemPt = p(lerp(s.hemLeftNorm, cx, 0.08), s.bottomNorm - H * 0.025);

  const splitY = clamp(s.splitNorm, topY + H * 0.14, s.bottomNorm - H * 0.28);
  const topEndPt = p(
    lerp(s.waistLeftNorm, cx, 0.18),
    Math.max(topY + 0.05, splitY - H * 0.04)
  );
  const bottomStartPt = p(
    lerp(s.waistLeftNorm, cx, 0.16),
    Math.min(s.bottomNorm - H * 0.18, splitY + H * 0.045)
  );
  const twoPieceHipPt = p(
    lerp(s.hipLeftNorm, cx, 0.08),
    splitY + H * 0.045 + Math.max(0.08, (s.bottomNorm - splitY) * 0.3)
  );

  const dressPins: TracingPins = {
    shoulder: shoulderPt,
    neckline: necklinePt,
    armhole: p(lerp(s.shoulderLeftNorm, cx, 0.12), s.bodyTopNorm + H * 0.25),
    waist: waistPt,
    crotch: p(cx, s.crotchNorm),
    topEnd: topEndPt,
    bottomStart: bottomStartPt,
    hip: hipPt,
    hem: hemPt,
  };

  const twoPiecePins: TracingPins = {
    ...dressPins,
    topEnd: topEndPt,
    bottomStart: bottomStartPt,
    hip: twoPieceHipPt,
  };

  const topPins: TracingPins = {
    ...dressPins,
    shoulder: shoulderPt,
    neckline: p(cx, s.bodyTopNorm + H * 0.13),
    armhole: p(lerp(s.shoulderLeftNorm, cx, 0.15), s.bodyTopNorm + H * 0.34),
    hem: p(lerp(s.hemLeftNorm, cx, 0.12), s.bottomNorm - H * 0.04),
  };

  const skirtPins: TracingPins = {
    ...dressPins,
    waist: p(lerp(s.waistLeftNorm, cx, 0.1), s.bodyTopNorm + H * 0.04),
    hip: p(lerp(s.hipLeftNorm, cx, 0.08), s.bodyTopNorm + H * 0.32),
    hem: hemPt,
  };

  const pantsPins: TracingPins = {
    ...dressPins,
    waist: p(lerp(s.waistLeftNorm, cx, 0.1), s.bodyTopNorm + H * 0.04),
    hip: p(lerp(s.hipLeftNorm, cx, 0.08), s.bodyTopNorm + H * 0.26),
    crotch: p(cx, s.crotchNorm),
    hem: hemPt,
  };

  return {
    top: topPins,
    pants: pantsPins,
    skirt: skirtPins,
    dress: dressPins,
    two_piece: twoPiecePins,
    jumpsuit: dressPins,
    kids: dressPins,
    loungewear: pantsPins,
    accessories: skirtPins,
  };
}
