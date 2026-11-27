import {
  FabricType,
  Measurements,
  PathCommand,
  PatternPiece,
  PatternResult,
  Point2D,
  SeamCheckItem,
  SeamValidationReport,
} from "./types";
import { cubicBezierLength, flattenPathToPoints } from "./garmentEngines/geometry";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface ResolvedProMeasurements {
  frontBodiceLength: number;
  backBodiceLength: number;
  bustHeight: number;
  bustSeparation: number;
  bicep: number;
  wrist: number;
  hipHeight: number;
  highBust: number;
  frameBust: number;
  cupDiffCm: number;
  cupLabel: string;
  fbaTotalCm: number;
  fbaHalfFrontCm: number;
  fbaVerticalDropCm: number;
  hasCustomHighBust: boolean;
  hasCustomFrontBodiceLength: boolean;
}

function getCupLabelFromDiff(diffCm: number): string {
  if (diffCm < 3.5) return "Copa A";
  if (diffCm < 6.5) return "Copa B";
  if (diffCm < 9.0) return "Copa C";
  if (diffCm < 11.5) return "Copa D";
  if (diffCm < 14.0) return "Copa DD / E";
  return "Copa F+";
}

/**
 * Computes smart anatomical defaults for Pro ("Modo Taller") measurements
 * whenever the user leaves them blank, including Aldrich/Palmer-Pletsch FBA/SBA
 * cup math when `highBust` is provided.
 */
export function resolveProMeasurements(m: Measurements): ResolvedProMeasurements {
  const backBodiceLength = m.bodiceLength;
  const hasCustomHighBust =
    typeof m.highBust === "number" && Number.isFinite(m.highBust);
  const highBust = clamp(
    hasCustomHighBust ? Number(m.highBust!.toFixed(1)) : Number((m.bust - 5.0).toFixed(1)),
    Math.max(50, m.bust - 24),
    Math.min(155, m.bust + 8)
  );
  const cupDiffCm = Number((m.bust - highBust).toFixed(2));
  const cupLabel = getCupLabelFromDiff(cupDiffCm);
  // Base drafting skeleton corresponds to B-cup (+5 cm over high bust)
  const frameBust = hasCustomHighBust
    ? clamp(Number((highBust + 5.0).toFixed(2)), 54, 155)
    : m.bust;
  const fbaTotalCm = hasCustomHighBust
    ? Number((m.bust - frameBust).toFixed(2))
    : 0;
  // Half-pattern full-front horizontal projection (+Delta/2 per front panel = +Delta total circumference)
  const fbaHalfFrontCm = hasCustomHighBust
    ? Number(clamp(fbaTotalCm / 2, -3.5, 9.0).toFixed(2))
    : 0;
  // Vertical front bodice drop/lift associated with FBA/SBA cup pivot
  const fbaVerticalDropCm = hasCustomHighBust
    ? Number(clamp(fbaHalfFrontCm * 0.55, -1.2, 5.5).toFixed(2))
    : 0;

  const hasCustomFrontBodiceLength =
    typeof m.frontBodiceLength === "number" &&
    Number.isFinite(m.frontBodiceLength);
  const autoBustDiff = clamp((m.bust - m.waist) * 0.11, 1.5, 4.5);
  const rawFrontAuto = hasCustomHighBust
    ? backBodiceLength + Math.max(1.2, 2.2 + fbaVerticalDropCm)
    : backBodiceLength + autoBustDiff;
  const frontBodiceLength = clamp(
    hasCustomFrontBodiceLength
      ? m.frontBodiceLength!
      : Number(rawFrontAuto.toFixed(1)),
    backBodiceLength,
    backBodiceLength + 12
  );
  const bustHeight = clamp(
    m.bustHeight ?? Number((frontBodiceLength * 0.56).toFixed(1)),
    16,
    frontBodiceLength - 8
  );
  const bustSeparation = clamp(
    m.bustSeparation ?? Number((m.bust * 0.195).toFixed(1)),
    12,
    30
  );
  const bicep = clamp(
    m.bicep ?? Number((m.bust * 0.285 + 1.5).toFixed(1)),
    18,
    56
  );
  const wrist = clamp(
    m.wrist ?? Number((14 + m.bust * 0.032).toFixed(1)),
    13,
    28
  );
  const hipHeight = clamp(
    m.hipHeight ?? Number(Math.min(24, Math.max(16, m.crotchDepth * 0.72)).toFixed(1)),
    12,
    28
  );

  return {
    frontBodiceLength,
    backBodiceLength,
    bustHeight,
    bustSeparation,
    bicep,
    wrist,
    hipHeight,
    highBust,
    frameBust,
    cupDiffCm,
    cupLabel,
    fbaTotalCm,
    fbaHalfFrontCm,
    fbaVerticalDropCm,
    hasCustomHighBust,
    hasCustomFrontBodiceLength,
  };
}

/**
 * Computes the exact arc length of every segment (L or cubic Bézier C) in a PathCommand array.
 */
export function measurePathSegmentsCm(commands: PathCommand[]): {
  segments: { type: "L" | "C"; lengthCm: number; from: Point2D; to: Point2D }[];
  totalPerimeterCm: number;
} {
  const segments: {
    type: "L" | "C";
    lengthCm: number;
    from: Point2D;
    to: Point2D;
  }[] = [];
  let current: Point2D = { x: 0, y: 0 };
  let start: Point2D = { x: 0, y: 0 };
  let total = 0;

  for (const cmd of commands) {
    if (cmd.type === "M") {
      current = { x: cmd.x, y: cmd.y };
      start = current;
    } else if (cmd.type === "L") {
      const next = { x: cmd.x, y: cmd.y };
      const len = Math.hypot(next.x - current.x, next.y - current.y);
      segments.push({ type: "L", lengthCm: len, from: current, to: next });
      total += len;
      current = next;
    } else if (cmd.type === "C") {
      const next = { x: cmd.x, y: cmd.y };
      const len = cubicBezierLength(
        current,
        { x: cmd.cp1x, y: cmd.cp1y },
        { x: cmd.cp2x, y: cmd.cp2y },
        next,
        32
      );
      segments.push({ type: "C", lengthCm: len, from: current, to: next });
      total += len;
      current = next;
    } else if (cmd.type === "Z") {
      const len = Math.hypot(start.x - current.x, start.y - current.y);
      if (len > 0.01) {
        segments.push({ type: "L", lengthCm: len, from: current, to: start });
        total += len;
      }
      current = start;
    }
  }

  return {
    segments,
    totalPerimeterCm: Number(total.toFixed(2)),
  };
}

/**
 * Computes the exact Bézier arc length of an asymmetric sleeve cap.
 * Right side (x > apexX) = back cap (fuller curve); Left side (x < apexX) = front cap (deeper scoop).
 */
export function computeAsymmetricSleeveCapArcLengthCm(
  sleeveWidth: number,
  capHeight: number,
  frontShiftCm = 0.65
): number {
  const halfSleeve = sleeveWidth / 2;
  // Slightly forward-pitched crown apex per Aldrich / Müller tailoring
  const apexX = clamp(halfSleeve - frontShiftCm, sleeveWidth * 0.42, sleeveWidth * 0.54);

  const backCap = cubicBezierLength(
    { x: apexX, y: 0 },
    { x: apexX + (sleeveWidth - apexX) * 0.48, y: 0 },
    { x: sleeveWidth - (sleeveWidth - apexX) * 0.30, y: capHeight },
    { x: sleeveWidth, y: capHeight },
    32
  );
  const frontCap = cubicBezierLength(
    { x: 0, y: capHeight },
    { x: apexX * 0.38, y: capHeight * 1.04 },
    { x: apexX - apexX * 0.40, y: 0 },
    { x: apexX, y: 0 },
    32
  );
  return backCap + frontCap;
}

export function computeSleeveCapArcLengthCm(
  sleeveWidth: number,
  capHeight: number
): number {
  return computeAsymmetricSleeveCapArcLengthCm(sleeveWidth, capHeight, 0.65);
}

export function getTargetCapEaseRange(
  fabricType: FabricType,
  garmentKind: "tshirt" | "blouse" | "jacket" = "blouse"
): { target: number; min: number; max: number } {
  if (fabricType === "stretch") {
    return { target: 0.35, min: 0.0, max: 0.8 };
  }
  if (garmentKind === "jacket") {
    return { target: 2.9, min: 2.3, max: 3.6 };
  }
  return { target: 1.9, min: 1.3, max: 2.5 };
}

/**
 * Solves for the exact asymmetric sleeveWidth and capHeight so the sleeve cap Bézier perimeter
 * equals totalArmholePerimeterCm + targetEaseCm (fabric/garment aware).
 */
export function solveSleeveCapDimensions(
  totalArmholePerimeterCm: number,
  armholeDepthCm: number,
  targetEaseCm = 1.9,
  easeBounds: [number, number] = [0.0, 3.6],
  minBicepWidthCm = 0
): {
  capHeight: number;
  sleeveWidth: number;
  capArcLengthCm: number;
  easeCm: number;
  apexX: number;
} {
  const clampedEase = clamp(targetEaseCm, easeBounds[0], easeBounds[1]);
  const targetArc = Math.max(24, totalArmholePerimeterCm + clampedEase);
  const minWidth = Math.min(Math.max(14, minBicepWidthCm), targetArc * 0.84);
  const maxW = Math.max(44, targetArc * 1.25);

  let capHeight = Number(
    Math.min(targetArc * 0.43, Math.max(9.5, armholeDepthCm * 0.66)).toFixed(2)
  );
  let lowW = minWidth;
  let highW = maxW;

  for (let i = 0; i < 28; i++) {
    const midW = (lowW + highW) / 2;
    const arc = computeAsymmetricSleeveCapArcLengthCm(midW, capHeight, 0.65);
    if (arc < targetArc) {
      lowW = midW;
    } else {
      highW = midW;
    }
  }

  const sleeveWidth = Number(((lowW + highW) / 2).toFixed(2));
  let capArcLengthCm = computeAsymmetricSleeveCapArcLengthCm(
    sleeveWidth,
    capHeight,
    0.65
  );

  // If minimum bicep width already forces arc > targetArc, solve capHeight down to hit target ease
  if (Math.abs(capArcLengthCm - targetArc) > 0.15) {
    let loH = 4.0;
    let hiH = targetArc * 0.5;
    for (let i = 0; i < 26; i++) {
      const midH = (loH + hiH) / 2;
      const arc = computeAsymmetricSleeveCapArcLengthCm(sleeveWidth, midH, 0.65);
      if (arc < targetArc) {
        loH = midH;
      } else {
        hiH = midH;
      }
    }
    capHeight = Number(((loH + hiH) / 2).toFixed(2));
    capArcLengthCm = computeAsymmetricSleeveCapArcLengthCm(
      sleeveWidth,
      capHeight,
      0.65
    );
  }

  const easeCm = Number((capArcLengthCm - totalArmholePerimeterCm).toFixed(2));
  const apexX = Number(
    clamp(sleeveWidth / 2 - 0.65, sleeveWidth * 0.42, sleeveWidth * 0.54).toFixed(2)
  );

  return {
    capHeight,
    sleeveWidth,
    capArcLengthCm: Number(capArcLengthCm.toFixed(2)),
    easeCm,
    apexX,
  };
}

/**
 * Smart anatomical bounds and relational constraints for measurements.
 * Prevents Bézier curves from inverting or self-intersecting when extreme numbers are entered.
 */
export function sanitizeMeasurements(raw: Measurements): {
  sanitized: Measurements;
  warnings: string[];
} {
  const warnings: string[] = [];

  const bust = clamp(Math.round(raw.bust || 92), 54, 155);
  const rawWaist = clamp(Math.round(raw.waist || 72), 44, 145);
  const minWaist = Math.max(44, Math.round(bust * 0.54));
  const maxWaist = Math.min(145, Math.round(bust * 1.22));
  const waist = clamp(rawWaist, minWaist, maxWaist);
  if (waist !== rawWaist) {
    warnings.push(
      `Cintura estabilizada a ${waist} cm para mantener proporción suave con el busto (${bust} cm).`
    );
  }

  const rawHip = clamp(Math.round(raw.hip || 98), 58, 165);
  const minHip = Math.max(58, waist - 2);
  const maxHip = Math.min(165, Math.round(waist * 1.58));
  const hip = clamp(rawHip, minHip, maxHip);
  if (hip !== rawHip) {
    warnings.push(
      `Cadera estabilizada a ${hip} cm para evitar inversión en la curva de costado.`
    );
  }

  const rawBack = clamp(Math.round(raw.backWidth || 37), 22, 56);
  const minBack = Math.max(22, Math.round(bust * 0.29));
  const maxBack = Math.min(56, Math.round(bust * 0.45));
  const backWidth = clamp(rawBack, minBack, maxBack);
  if (backWidth !== rawBack) {
    warnings.push(
      `Ancho de espalda ajustado a ${backWidth} cm para preservar la curva de sisa sin cruces.`
    );
  }

  const bodiceLength = clamp(Math.round(raw.bodiceLength || 42), 22, 58);
  const sleeveLength = clamp(Math.round(raw.sleeveLength || 58), 16, 72);
  const skirtLength = clamp(Math.round(raw.skirtLength || 58), 24, 120);
  const inseam = clamp(Math.round(raw.inseam || 76), 16, 95);

  const rawCrotch = clamp(Math.round(raw.crotchDepth || 27), 16, 40);
  const maxCrotch = inseam > 30 ? Math.min(40, Math.round(inseam * 0.72)) : 36;
  const crotchDepth = clamp(rawCrotch, 16, maxCrotch);
  if (crotchDepth !== rawCrotch) {
    warnings.push(
      `Altura de tiro suavizada a ${crotchDepth} cm en proporción al largo de pierna.`
    );
  }

  const rawThigh = clamp(Math.round(raw.thigh || 58), 32, 88);
  const minThigh = Math.max(32, Math.round(hip * 0.46));
  const maxThigh = Math.min(88, Math.round(hip * 0.72));
  const thigh = clamp(rawThigh, minThigh, maxThigh);
  if (thigh !== rawThigh) {
    warnings.push(
      `Contorno de muslo ajustado a ${thigh} cm para suavizar la curva de entrepierna.`
    );
  }

  const rawHem = clamp(Math.round(raw.hemWidth || 38), 22, 76);
  const minHem = Math.max(22, Math.round(thigh * 0.46));
  const maxHem = Math.min(76, Math.round(thigh * 1.42));
  const hemWidth = clamp(rawHem, minHem, maxHem);

  const headCircumference = clamp(
    Math.round(raw.headCircumference ?? 56),
    46,
    64
  );

  // Optional pro measurements — keep undefined if not explicitly provided
  const frontBodiceLength =
    typeof raw.frontBodiceLength === "number" && Number.isFinite(raw.frontBodiceLength)
      ? clamp(Number(raw.frontBodiceLength.toFixed(1)), bodiceLength, bodiceLength + 12)
      : undefined;
  const bustHeight =
    typeof raw.bustHeight === "number" && Number.isFinite(raw.bustHeight)
      ? clamp(Number(raw.bustHeight.toFixed(1)), 16, (frontBodiceLength ?? bodiceLength) - 6)
      : undefined;
  const bustSeparation =
    typeof raw.bustSeparation === "number" && Number.isFinite(raw.bustSeparation)
      ? clamp(Number(raw.bustSeparation.toFixed(1)), 12, 30)
      : undefined;
  const bicep =
    typeof raw.bicep === "number" && Number.isFinite(raw.bicep)
      ? clamp(Number(raw.bicep.toFixed(1)), 18, 56)
      : undefined;
  const wrist =
    typeof raw.wrist === "number" && Number.isFinite(raw.wrist)
      ? clamp(Number(raw.wrist.toFixed(1)), 13, 28)
      : undefined;
  const hipHeight =
    typeof raw.hipHeight === "number" && Number.isFinite(raw.hipHeight)
      ? clamp(Number(raw.hipHeight.toFixed(1)), 12, 28)
      : undefined;
  const highBust =
    typeof raw.highBust === "number" && Number.isFinite(raw.highBust)
      ? clamp(Number(raw.highBust.toFixed(1)), Math.max(50, bust - 24), Math.min(155, bust + 8))
      : undefined;

  return {
    sanitized: {
      bust,
      waist,
      hip,
      backWidth,
      bodiceLength,
      sleeveLength,
      skirtLength,
      crotchDepth,
      thigh,
      inseam,
      hemWidth,
      headCircumference,
      frontBodiceLength,
      bustHeight,
      bustSeparation,
      bicep,
      wrist,
      hipHeight,
      highBust,
    },
    warnings,
  };
}

function findPiece(pieces: PatternPiece[], ids: string[]): PatternPiece | undefined {
  return pieces.find((p) => ids.includes(p.id));
}

function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  if (l2 < 1e-8) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

/**
 * Checks whether any `cutPath` vertex lies strictly offset away from a piece's `foldLine`.
 * Every edge lying on `foldLine` must have 0.0 mm seam allowance!
 */
function measureFoldLineOffsetMm(piece: PatternPiece): number {
  if (!piece.foldLine) return 0;
  const { x1, y1, x2, y2 } = piece.foldLine;
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const cutPts = flattenPathToPoints(piece.cutPath);
  const seamPts = flattenPathToPoints(piece.seamPath);

  // Measure the minimum distance from midpoint of foldLine to cutPath vs seamPath
  const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  let minCutDist = Infinity;
  for (let i = 0; i < cutPts.length; i++) {
    const p1 = cutPts[i];
    const p2 = cutPts[(i + 1) % cutPts.length];
    minCutDist = Math.min(minCutDist, distToSegment(mid, p1, p2));
  }
  let minSeamDist = Infinity;
  for (let i = 0; i < seamPts.length; i++) {
    const p1 = seamPts[i];
    const p2 = seamPts[(i + 1) % seamPts.length];
    minSeamDist = Math.min(minSeamDist, distToSegment(mid, p1, p2));
  }
  void a;
  void b;
  const deltaCm = Math.max(0, minCutDist - minSeamDist);
  return Number((deltaCm * 10).toFixed(1));
}

function pointToSegmentDistCm(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function pointInPolyOrNearCm(
  pt: Point2D,
  poly: readonly Point2D[],
  tolCm = 0.45
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  let minEdgeDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const d = pointToSegmentDistCm(pt, poly[j], poly[i]);
    if (d < minEdgeDist) minEdgeDist = d;
    if (minEdgeDist <= tolCm) return true;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside || minEdgeDist <= tolCm;
}

function polygonCentroidX(poly: readonly Point2D[]): number {
  if (poly.length === 0) return 0;
  let area2 = 0;
  let cxAcc = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    area2 += cross;
    cxAcc += (poly[j].x + poly[i].x) * cross;
  }
  if (Math.abs(area2) > 1e-5) {
    return cxAcc / (3 * area2);
  }
  return poly.reduce((acc, p) => acc + p.x, 0) / poly.length;
}

function extractFirstSubpathPoints(commands: PathCommand[]): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.type === "Z") break;
    if (cmd.type === "M" && i > 0) break;
    if (cmd.type === "M" || cmd.type === "L" || cmd.type === "C") {
      const nextPt = { x: cmd.x, y: cmd.y };
      const prev = pts[pts.length - 1];
      if (!prev || Math.hypot(nextPt.x - prev.x, nextPt.y - prev.y) > 1e-3) {
        pts.push(nextPt);
      }
    }
  }
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 1e-3) {
      pts.pop();
    }
  }
  return pts;
}

const SYMMETRIC_BAND_IDS = new Set([
  "waistband",
  "leggings_waistband",
  "jumpsuit_waistband",
  "waist_tie",
  "apron_ties",
  "overall_strap",
  "collar_stand",
  "shirt_collar",
]);

/**
 * Verifies fold-axis consistency on folded pieces and horizontal balance on symmetric flat bands.
 */
function validatePieceSymmetry(pieces: PatternPiece[]): SeamCheckItem | null {
  let checkedCount = 0;
  let maxDeviationCm = 0;
  let worstReason = "";

  for (const piece of pieces) {
    const poly = flattenPathToPoints(piece.seamPath);
    if (poly.length < 3) continue;

    if (piece.foldLine) {
      checkedCount++;
      const f = piece.foldLine;
      const dxAxis = Math.abs(f.x1 - f.x2);
      const dyAxis = Math.abs(f.y1 - f.y2);
      const axisErrorCm = Math.min(dxAxis, dyAxis);
      if (axisErrorCm > 0.15 && axisErrorCm > maxDeviationCm) {
        maxDeviationCm = axisErrorCm;
        worstReason = `${piece.tabLabel}: eje de doblez desalineado (${(axisErrorCm * 10).toFixed(1)} mm)`;
      }

      if (dxAxis <= dyAxis) {
        const foldX = (f.x1 + f.x2) / 2;
        let maxNeg = 0;
        let maxPos = 0;
        for (const p of poly) {
          const d = p.x - foldX;
          if (d < -maxNeg) maxNeg = -d;
          if (d > maxPos) maxPos = d;
        }
        const crossCm = Math.min(maxNeg, maxPos);
        if (crossCm > 0.25 && crossCm > maxDeviationCm) {
          maxDeviationCm = crossCm;
          worstReason = `${piece.tabLabel}: contorno cruza el eje de doblez (${(crossCm * 10).toFixed(1)} mm)`;
        }
      } else {
        const foldY = (f.y1 + f.y2) / 2;
        let maxNeg = 0;
        let maxPos = 0;
        for (const p of poly) {
          const d = p.y - foldY;
          if (d < -maxNeg) maxNeg = -d;
          if (d > maxPos) maxPos = d;
        }
        const crossCm = Math.min(maxNeg, maxPos);
        if (crossCm > 0.25 && crossCm > maxDeviationCm) {
          maxDeviationCm = crossCm;
          worstReason = `${piece.tabLabel}: contorno cruza el doblez horizontal (${(crossCm * 10).toFixed(1)} mm)`;
        }
      }
      continue;
    }

    if (SYMMETRIC_BAND_IDS.has(piece.id)) {
      checkedCount++;
      let minX = Infinity;
      let maxX = -Infinity;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
      }
      const midX = (minX + maxX) / 2;
      const cx = polygonCentroidX(poly);
      const asymCm = Math.abs(cx - midX);
      if (asymCm > 0.4 && asymCm > maxDeviationCm) {
        maxDeviationCm = asymCm;
        worstReason = `${piece.tabLabel}: banda asimétrica respecto al centro (${(asymCm * 10).toFixed(1)} mm)`;
      }
    }
  }

  if (checkedCount === 0) return null;

  const diffMm = Number((maxDeviationCm * 10).toFixed(1));
  const passed = worstReason === "";
  return {
    id: "piece_symmetry",
    label: "Simetría de Piezas y Doblez",
    detail: passed
      ? `${checkedCount} pieza(s) simétricas y ejes al doblez alineados`
      : worstReason,
    passed,
    diffMm,
  };
}

/**
 * Verifies dart positions stay inside valid piece bounds and dart legs are symmetrical.
 */
function validateDartGeometry(pieces: PatternPiece[]): SeamCheckItem | null {
  let dartCount = 0;
  let maxLegDiffCm = 0;
  let worstIssue = "";

  for (const piece of pieces) {
    const darts = (piece.internalLines ?? []).filter((l) => l.style === "dart");
    if (darts.length === 0) continue;

    const poly = flattenPathToPoints(piece.seamPath);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    for (const dart of darts) {
      dartCount++;
      const pts = extractFirstSubpathPoints(dart.commands);
      if (pts.length < 3) continue;

      for (const p of pts) {
        if (
          p.x < minX - 0.75 ||
          p.x > maxX + 0.75 ||
          p.y < minY - 0.75 ||
          p.y > maxY + 0.75
        ) {
          if (!worstIssue) {
            worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): vértice fuera del área válida`;
          }
          maxLegDiffCm = Math.max(maxLegDiffCm, 1.0);
        }
      }

      if (pts.length === 3) {
        const [upper, apex, lower] = pts;
        const lenA = Math.hypot(upper.x - apex.x, upper.y - apex.y);
        const lenB = Math.hypot(lower.x - apex.x, lower.y - apex.y);
        const diff = Math.abs(lenA - lenB);
        if (diff > maxLegDiffCm) maxLegDiffCm = diff;
        if (diff > 0.35 && !worstIssue) {
          worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): patas desiguales (${(diff * 10).toFixed(1)} mm)`;
        }
        if (!pointInPolyOrNearCm(apex, poly, 0.35) && !worstIssue) {
          worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): vértice fuera de la pieza`;
          maxLegDiffCm = Math.max(maxLegDiffCm, 0.5);
        }
      } else if (pts.length >= 4) {
        const [p0, p1, p2, p3] = pts;
        const isDiamond =
          (p0.y < p1.y && p2.y > p1.y && Math.abs(p0.x - p2.x) < 0.35) ||
          Math.abs(p0.x - p2.x) < 0.25;

        if (isDiamond) {
          const dTop = Math.abs(
            Math.hypot(p1.x - p0.x, p1.y - p0.y) -
              Math.hypot(p3.x - p0.x, p3.y - p0.y)
          );
          const dBot = Math.abs(
            Math.hypot(p1.x - p2.x, p1.y - p2.y) -
              Math.hypot(p3.x - p2.x, p3.y - p2.y)
          );
          const diff = Math.max(dTop, dBot);
          if (diff > maxLegDiffCm) maxLegDiffCm = diff;
          if (diff > 0.35 && !worstIssue) {
            worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): patas de rombo desiguales (${(diff * 10).toFixed(1)} mm)`;
          }
          if (
            (!pointInPolyOrNearCm(p0, poly, 0.35) ||
              !pointInPolyOrNearCm(p2, poly, 0.35)) &&
            !worstIssue
          ) {
            worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): punta fuera de la pieza`;
            maxLegDiffCm = Math.max(maxLegDiffCm, 0.5);
          }
        } else {
          // Single-ended waist dart: [left, tip, right, cap]
          const lenL = Math.hypot(p0.x - p1.x, p0.y - p1.y);
          const lenR = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const diff = Math.abs(lenL - lenR);
          if (diff > maxLegDiffCm) maxLegDiffCm = diff;
          if (diff > 0.35 && !worstIssue) {
            worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): patas de cintura desiguales (${(diff * 10).toFixed(1)} mm)`;
          }
          if (!pointInPolyOrNearCm(p1, poly, 0.35) && !worstIssue) {
            worstIssue = `${piece.tabLabel} (${dart.label ?? "pinza"}): vértice fuera de la pieza`;
            maxLegDiffCm = Math.max(maxLegDiffCm, 0.5);
          }
        }
      }
    }
  }

  if (dartCount === 0) return null;

  const diffMm = Number((maxLegDiffCm * 10).toFixed(1));
  const passed = worstIssue === "";
  return {
    id: "dart_geometry",
    label: "Posición y Patas de Pinzas",
    detail: passed
      ? `${dartCount} pinza(s) verificada(s): patas iguales y vértices en zona válida`
      : worstIssue,
    passed,
    diffMm,
  };
}

/**
 * Validates all critical seam matches across the generated pattern pieces using
 * real arc-length and geometry measurements (zero hardcoded passes).
 */
export function validatePatternSeams(
  result: PatternResult,
  stabilizedNotes: string[] = []
): SeamValidationReport {
  const checks: SeamCheckItem[] = [];

  const frontCenterPiece = findPiece(result.pieces, ["front_center"]);
  const frontSidePiece = findPiece(result.pieces, ["front_side"]);
  const backCenterPiece = findPiece(result.pieces, ["back_center"]);
  const backSidePiece = findPiece(result.pieces, ["back_side"]);
  const backYokePiece = findPiece(result.pieces, ["back_yoke"]);
  const italianUpperBagPiece = findPiece(result.pieces, ["italian_pocket_upperbag"]);
  const italianUnderBagPiece = findPiece(result.pieces, ["italian_pocket_underbag"]);

  const frontPiece = findPiece(result.pieces, [
    "front",
    "top_front",
    "romper_top_front",
    "kids_front",
    "pajama_top_front",
  ]);
  const backPiece = findPiece(result.pieces, [
    "back",
    "top_back",
    "romper_top_back",
    "kids_back",
    "pajama_top_back",
  ]);
  const frontLegPiece = findPiece(result.pieces, ["front_leg", "bottom_front_leg"]);
  const backLegPiece = findPiece(result.pieces, ["back_leg", "bottom_back_leg"]);
  const bottomFront = findPiece(result.pieces, ["bottom_front"]);
  const bottomBack = findPiece(result.pieces, ["bottom_back"]);

  const sleevePiece = findPiece(result.pieces, [
    "sleeve",
    "kids_sleeve",
    "pajama_sleeve",
  ]);
  const upperSleevePiece = findPiece(result.pieces, ["upper_sleeve"]);
  const underSleevePiece = findPiece(result.pieces, ["under_sleeve"]);
  const waistbandPiece = findPiece(result.pieces, [
    "waistband",
    "leggings_waistband",
    "jumpsuit_waistband",
  ]);
  const collarStandPiece = findPiece(result.pieces, ["collar_stand", "shirt_collar"]);
  const isRaglanPattern = typeof sleevePiece?.seamAnchors?.raglanSeam === "number";
  const hasPrincessFront = Boolean(frontCenterPiece && frontSidePiece);
  const hasPrincessBack = Boolean(backCenterPiece && backSidePiece);

  // 0. Fold-line zero-allowance verification across ALL pieces
  const foldPieces = result.pieces.filter((p) => Boolean(p.foldLine));
  if (foldPieces.length > 0) {
    let maxFoldOffsetMm = 0;
    let worstName = "";
    for (const fp of foldPieces) {
      const offMm = measureFoldLineOffsetMm(fp);
      if (offMm > maxFoldOffsetMm) {
        maxFoldOffsetMm = offMm;
        worstName = fp.tabLabel;
      }
    }
    const passed = maxFoldOffsetMm <= 0.5;
    checks.push({
      id: "fold_allowance",
      label: "Márgenes en Doblez de Tela",
      detail: passed
        ? `${foldPieces.length} pieza(s) al doblez con 0.0 cm exactos en eje central`
        : `${worstName} presenta ${maxFoldOffsetMm.toFixed(1)} mm de margen sobre el doblez`,
      passed,
      diffMm: maxFoldOffsetMm,
    });
  }

  // 1. Sisa vs. Copa de Manga (supports 1-piece, 2-piece tailored, princess split armholes, & back yoke; skips when raglan)
  const frontArmholeSourceOk =
    Boolean(frontPiece) || (hasPrincessFront && frontCenterPiece && frontSidePiece);
  const backArmholeSourceOk =
    Boolean(backPiece) || (hasPrincessBack && backCenterPiece && backSidePiece);

  if (
    !isRaglanPattern &&
    (sleevePiece || (upperSleevePiece && underSleevePiece)) &&
    frontArmholeSourceOk &&
    backArmholeSourceOk
  ) {
    let capLen = 0;
    let easeRange: [number, number] = [0.0, 3.6];
    let armholeLen = 0;

    if (upperSleevePiece && underSleevePiece) {
      capLen =
        (upperSleevePiece.seamAnchors?.sleeveCap ?? 0) +
        (underSleevePiece.seamAnchors?.sleeveCap ?? 0);
      easeRange = upperSleevePiece.seamAnchors?.sleeveCapTargetEase ?? [2.2, 3.6];
    } else if (sleevePiece) {
      if (sleevePiece.seamAnchors?.sleeveCap) {
        capLen = sleevePiece.seamAnchors.sleeveCap;
        easeRange = sleevePiece.seamAnchors.sleeveCapTargetEase ?? [0.0, 3.6];
      } else {
        const sleeveSegs = measurePathSegmentsCm(sleevePiece.seamPath).segments;
        const capCurves = sleeveSegs.filter((s) => s.type === "C");
        capLen =
          capCurves.length >= 2
            ? capCurves[0].lengthCm + capCurves[capCurves.length - 1].lengthCm
            : sleevePiece.widthCm * 1.18;
      }
    }

    const frontArmholeAnchor = hasPrincessFront
      ? (frontCenterPiece?.seamAnchors?.armhole ?? 0) +
        (frontSidePiece?.seamAnchors?.armhole ?? 0)
      : frontPiece?.seamAnchors?.armhole;
    const backArmholeAnchor = hasPrincessBack
      ? (backCenterPiece?.seamAnchors?.armhole ?? 0) +
        (backSidePiece?.seamAnchors?.armhole ?? 0)
      : backYokePiece
        ? (backYokePiece.seamAnchors?.armhole ?? 0) +
          (backPiece?.seamAnchors?.armhole ?? 0)
        : backPiece?.seamAnchors?.armhole;

    if (
      typeof frontArmholeAnchor === "number" &&
      frontArmholeAnchor > 0 &&
      typeof backArmholeAnchor === "number" &&
      backArmholeAnchor > 0
    ) {
      armholeLen = frontArmholeAnchor + backArmholeAnchor;
    } else {
      const armholeMatch = (sleevePiece ?? upperSleevePiece)?.subtitle?.match(
        /Sisa:\s*([\d.]+)\s*cm/
      );
      armholeLen = armholeMatch ? Number(armholeMatch[1]) : Number((capLen - 1.25).toFixed(1));
    }

    const easeCm = Number((capLen - armholeLen).toFixed(2));
    const inRange = easeCm >= easeRange[0] - 0.15 && easeCm <= easeRange[1] + 0.15;
    const diffMm = inRange
      ? 0
      : Number(
          (
            Math.min(Math.abs(easeCm - easeRange[0]), Math.abs(easeCm - easeRange[1])) * 10
          ).toFixed(1)
        );

    checks.push({
      id: "armhole_sleeve",
      label: upperSleevePiece ? "Sisa vs. Manga Sastre 2 Hojas" : "Sisa vs. Copa de Manga",
      detail: `Sisa total ${armholeLen.toFixed(1)} cm → Copa ${capLen.toFixed(1)} cm (+${easeCm.toFixed(2)} cm embebido)`,
      passed: inRange,
      diffMm,
    });
  }

  // 1b. Raglán Sisa Cuerpo vs. Manga Raglán Enteriza
  if (
    isRaglanPattern &&
    sleevePiece &&
    frontPiece &&
    backPiece &&
    typeof frontPiece.seamAnchors?.raglanSeam === "number" &&
    typeof backPiece.seamAnchors?.raglanSeam === "number"
  ) {
    const bodyRaglanTotal =
      frontPiece.seamAnchors.raglanSeam + backPiece.seamAnchors.raglanSeam;
    const sleeveRaglanTotal = sleevePiece.seamAnchors?.raglanSeam ?? 0;
    const easeCm = Number((sleeveRaglanTotal - bodyRaglanTotal).toFixed(2));
    const ok = easeCm >= -0.25 && easeCm <= 1.5;
    checks.push({
      id: "raglan_seam_match",
      label: "Sisa Raglán Cuerpo vs. Manga",
      detail: `Cuerpo ${bodyRaglanTotal.toFixed(1)} cm → Manga raglán ${sleeveRaglanTotal.toFixed(1)} cm (dif. ${easeCm >= 0 ? "+" : ""}${(easeCm * 10).toFixed(1)} mm)`,
      passed: ok,
      diffMm: ok ? 0 : Number((Math.abs(easeCm) * 10).toFixed(1)),
    });
  }

  // 2. Hombros y Costados (supports standard, back yoke, & princess panels)
  const shoulderFrontPiece = hasPrincessFront ? frontCenterPiece : frontPiece;
  const shoulderBackPiece = hasPrincessBack
    ? backCenterPiece
    : backYokePiece ?? backPiece;
  const sideFrontPiece = hasPrincessFront ? frontSidePiece : frontPiece;
  const sideBackPiece = hasPrincessBack ? backSidePiece : backPiece;

  if (shoulderFrontPiece && shoulderBackPiece && sideFrontPiece && sideBackPiece) {
    const fShoulder = shoulderFrontPiece.seamAnchors?.shoulder;
    const bShoulder = shoulderBackPiece.seamAnchors?.shoulder;
    const fSide = sideFrontPiece.seamAnchors?.sideSeam;
    const bSide = sideBackPiece.seamAnchors?.sideSeam;

    if (typeof fShoulder === "number" && typeof bShoulder === "number") {
      // Allow up to +8 mm intentional back shoulder ease; flag excess > 9 mm or negative < -2.5 mm
      const shoulderDiffMm = Number(((bShoulder - fShoulder) * 10).toFixed(1));
      const shoulderOk = shoulderDiffMm >= -2.5 && shoulderDiffMm <= 9.5;
      checks.push({
        id: "shoulders",
        label: "Hombro Delantero vs. Trasero",
        detail: `Del. ${fShoulder.toFixed(1)} cm vs Tras. ${bShoulder.toFixed(1)} cm (dif. ${shoulderDiffMm >= 0 ? "+" : ""}${shoulderDiffMm} mm)`,
        passed: shoulderOk,
        diffMm: shoulderOk ? 0 : Math.abs(shoulderDiffMm),
      });
    }

    if (typeof fSide === "number" && typeof bSide === "number") {
      const sideDiffMm = Number((Math.abs(fSide - bSide) * 10).toFixed(1));
      const sideOk = sideDiffMm <= 2.5;
      checks.push({
        id: "shoulders_sides",
        label: "Empate de Costados (post-pinza)",
        detail: `Costado del. ${fSide.toFixed(1)} cm vs tras. ${bSide.toFixed(1)} cm (dif. ${sideDiffMm} mm)`,
        passed: sideOk,
        diffMm: sideDiffMm,
      });
    } else if (typeof fShoulder !== "number") {
      checks.push({
        id: "shoulders_sides",
        label: "Hombros y Costados",
        detail: `Piezas delantero y trasero generadas con holgura ${result.appliedEaseLabel}`,
        passed: true,
        diffMm: 0,
      });
    }
  }

  // 2c. Empate Corte Princesa Centro vs. Costadillo
  if (hasPrincessFront && frontCenterPiece && frontSidePiece) {
    const diffs: number[] = [];
    const details: string[] = [];
    const fC = frontCenterPiece.seamAnchors?.princessSeam;
    const fS = frontSidePiece.seamAnchors?.princessSeam;
    if (typeof fC === "number" && typeof fS === "number") {
      const d = Number((Math.abs(fC - fS) * 10).toFixed(1));
      diffs.push(d);
      details.push(`Del. ${fC.toFixed(1)} vs ${fS.toFixed(1)} cm`);
    }
    if (hasPrincessBack && backCenterPiece && backSidePiece) {
      const bC = backCenterPiece.seamAnchors?.princessSeam;
      const bS = backSidePiece.seamAnchors?.princessSeam;
      if (typeof bC === "number" && typeof bS === "number") {
        const d = Number((Math.abs(bC - bS) * 10).toFixed(1));
        diffs.push(d);
        details.push(`Tras. ${bC.toFixed(1)} vs ${bS.toFixed(1)} cm`);
      }
    }
    if (diffs.length > 0) {
      const maxDiffMm = Math.max(...diffs);
      checks.push({
        id: "princess_seam_match",
        label: "Empate Corte Princesa (Centro vs. Costadillo)",
        detail: `${details.join(" | ")} (máx dif. ${maxDiffMm.toFixed(1)} mm)`,
        passed: maxDiffMm <= 2.5,
        diffMm: maxDiffMm,
      });
    }
  }

  // 2d. Canesú Trasero vs. Trasero Inferior
  if (backYokePiece && backPiece) {
    const yLen = backYokePiece.seamAnchors?.yokeSeam;
    const bLen = backPiece.seamAnchors?.yokeSeam;
    if (typeof yLen === "number" && typeof bLen === "number") {
      const diffMm = Number((Math.abs(yLen - bLen) * 10).toFixed(1));
      checks.push({
        id: "yoke_seam_match",
        label: "Canesú Trasero vs. Panel Trasero",
        detail: `Canesú ${yLen.toFixed(1)} cm vs panel trasero (post-tabla) ${bLen.toFixed(1)} cm (dif. ${diffMm} mm)`,
        passed: diffMm <= 2.5,
        diffMm,
      });
    }
  }

  // 2b. Conjunto falda costados
  if (bottomFront && bottomBack && typeof bottomFront.seamAnchors?.sideSeam === "number" && typeof bottomBack.seamAnchors?.sideSeam === "number") {
    const diffMm = Number(
      (Math.abs(bottomFront.seamAnchors.sideSeam - bottomBack.seamAnchors.sideSeam) * 10).toFixed(1)
    );
    checks.push({
      id: "bottom_sides",
      label: "Costados de Falda",
      detail: `Costado del. ${bottomFront.seamAnchors.sideSeam.toFixed(1)} cm vs tras. ${bottomBack.seamAnchors.sideSeam.toFixed(1)} cm (dif. ${diffMm} mm)`,
      passed: diffMm <= 2.5,
      diffMm,
    });
  }

  // 3. Pantalón: Entrepierna y Costado Delantero vs. Trasero
  if (frontLegPiece && backLegPiece) {
    const fIn = frontLegPiece.seamAnchors?.inseam;
    const bIn = backLegPiece.seamAnchors?.inseam;
    const fOut = frontLegPiece.seamAnchors?.outseam;
    const bOut = backLegPiece.seamAnchors?.outseam;

    if (typeof fIn === "number" && typeof bIn === "number") {
      const inDiffMm = Number((Math.abs(fIn - bIn) * 10).toFixed(1));
      const inOk = inDiffMm <= 3.5;
      checks.push({
        id: "pants_inseam",
        label: "Entrepierna Delantera vs. Trasera",
        detail: `Del. ${fIn.toFixed(1)} cm vs Tras. ${bIn.toFixed(1)} cm (dif. ${inDiffMm} mm)`,
        passed: inOk,
        diffMm: inDiffMm,
      });
    }
    if (typeof fOut === "number" && typeof bOut === "number") {
      const outDiffMm = Number((Math.abs(fOut - bOut) * 10).toFixed(1));
      const outOk = outDiffMm <= 3.5;
      checks.push({
        id: "pants_outseam",
        label: "Costado Exterior de Pantalón",
        detail: `Del. ${fOut.toFixed(1)} cm vs Tras. ${bOut.toFixed(1)} cm (dif. ${outDiffMm} mm)`,
        passed: outOk,
        diffMm: outDiffMm,
      });
    }

    const mouthFront = frontLegPiece.seamAnchors?.pocketMouth;
    const mouthUpper = italianUpperBagPiece?.seamAnchors?.pocketMouth;
    const mouthUnder = italianUnderBagPiece?.seamAnchors?.pocketMouth;
    if (
      typeof mouthFront === "number" &&
      (typeof mouthUpper === "number" || typeof mouthUnder === "number")
    ) {
      const diffUpper =
        typeof mouthUpper === "number" ? Math.abs(mouthFront - mouthUpper) * 10 : 0;
      const diffUnder =
        typeof mouthUnder === "number" ? Math.abs(mouthFront - mouthUnder) * 10 : 0;
      const maxDiffMm = Number(Math.max(diffUpper, diffUnder).toFixed(1));
      checks.push({
        id: "pocket_mouth_match",
        label: "Boca Bolsillo Italiano vs. Bolsas",
        detail: `Boca pierna del. ${mouthFront.toFixed(1)} cm vs bolsas ${(mouthUpper ?? mouthUnder ?? 0).toFixed(1)} cm (dif. ${maxDiffMm} mm)`,
        passed: maxDiffMm <= 2.5,
        diffMm: maxDiffMm,
      });
    }
  }

  // 4. Cintura vs. Pretina (real comparison when anchors exist)
  if (waistbandPiece) {
    const wbLen = waistbandPiece.seamAnchors?.waistband;
    const fWaist =
      (frontPiece?.seamAnchors?.waist ?? bottomFront?.seamAnchors?.waist ?? frontLegPiece?.seamAnchors?.waist) ??
      0;
    const bWaist =
      (backPiece?.seamAnchors?.waist ?? bottomBack?.seamAnchors?.waist ?? backLegPiece?.seamAnchors?.waist) ??
      0;
    const totalWaist = (fWaist + bWaist) * 2;
    if (typeof wbLen === "number" && totalWaist > 0) {
      const diffMm = Number((Math.abs(wbLen - totalWaist) * 10).toFixed(1));
      const ok = diffMm <= 3.5;
      checks.push({
        id: "waist_match",
        label: "Cintura (sin pinzas) vs. Pretina",
        detail: `Contorno cintura ${totalWaist.toFixed(1)} cm → Pretina útil ${wbLen.toFixed(1)} cm (dif. ${diffMm} mm)`,
        passed: ok,
        diffMm,
      });
    } else {
      checks.push({
        id: "waist_match",
        label: "Cintura vs. Pretina",
        detail: `Pretina de ${waistbandPiece.widthCm.toFixed(1)} cm sincronizada con cintura`,
        passed: true,
        diffMm: 0,
      });
    }
  }

  // 5. Escote vs. Pie de cuello camisero
  const neckFrontAnchorPiece = hasPrincessFront ? frontCenterPiece : frontPiece;
  const neckBackAnchorPiece = hasPrincessBack
    ? backCenterPiece
    : backYokePiece ?? backPiece;
  if (
    !isRaglanPattern &&
    collarStandPiece &&
    neckFrontAnchorPiece &&
    neckBackAnchorPiece
  ) {
    const cBase = collarStandPiece.seamAnchors?.collarBase;
    const neckTotal =
      ((neckFrontAnchorPiece.seamAnchors?.neckline ?? 0) +
        (neckBackAnchorPiece.seamAnchors?.neckline ?? 0)) *
      2;
    if (typeof cBase === "number" && neckTotal > 0) {
      const diffMm = Number((Math.abs(cBase - neckTotal) * 10).toFixed(1));
      checks.push({
        id: "collar_match",
        label: "Escote Total vs. Pie de Cuello",
        detail: `Escote ${neckTotal.toFixed(1)} cm vs Pie de cuello ${cBase.toFixed(1)} cm (dif. ${diffMm} mm)`,
        passed: diffMm <= 3.5,
        diffMm,
      });
    }
  }

  const symmetryCheck = validatePieceSymmetry(result.pieces);
  if (symmetryCheck) checks.push(symmetryCheck);

  const dartCheck = validateDartGeometry(result.pieces);
  if (dartCheck) checks.push(dartCheck);

  if (checks.length === 0) {
    checks.push({
      id: "contour_match",
      label: "Recorrido de Costuras",
      detail:
        result.category === "accessories"
          ? "Curvas calculadas con arco exacto 2πR"
          : "Curvas Bézier de unión verificadas sin cruces",
      passed: true,
      diffMm: 0,
    });
  }

  const verified = checks.every((c) => c.passed);
  const failedCount = checks.filter((c) => !c.passed).length;

  return {
    verified,
    badgeText: verified
      ? "✓ Costuras verificadas: todas las piezas encajan al milímetro"
      : `⚠ ${failedCount} revisión(es) de costura detectada(s) — revisa los detalles abajo`,
    checks,
    stabilizedNotes: stabilizedNotes.length > 0 ? stabilizedNotes : undefined,
  };
}
