import {
  EdgeAllowanceKind,
  NecklineStyle,
  PathCommand,
  PatternInternalLine,
  PatternPiece,
  Point2D,
  SeamAllowance,
} from "../types";
import {
  buildNecklineCommand,
  normalizePiece,
  sampleCubicBezier,
} from "./geometry";

/**
 * Generates a geometrically trued side bust dart ("Pinza lateral de busto con afinado")
 * pointing toward the bust apex, with equal dart leg lengths, downward dart cap, and
 * exact closed side-seam length matching the back side seam.
 */
export function buildTruedSideBustDart(params: {
  topPoint: Point2D; // Armhole underarm corner
  botPoint: Point2D; // Waist side corner
  apex: Point2D; // Bust apex (bustSeparation/2, bustHeight)
  intakeCm: number; // Vertical dart opening at side seam (cm)
  label?: string;
}): {
  sideCommands: PathCommand[];
  internalLine: PatternInternalLine;
  closedSideLengthCm: number;
  dartCapPoint: Point2D;
} {
  const {
    topPoint,
    botPoint,
    apex,
    intakeCm,
    label = "Pinza de busto",
  } = params;

  const sideSpanY = Math.max(8, botPoint.y - topPoint.y);
  const clampedIntake = Math.min(Math.max(1.5, intakeCm), sideSpanY * 0.45);
  const targetMidY = Math.max(
    topPoint.y + clampedIntake * 0.5 + 2.5,
    Math.min(botPoint.y - clampedIntake * 0.5 - 2.5, apex.y + 2.0)
  );

  const upperY = targetMidY - clampedIntake / 2;
  const lowerY = targetMidY + clampedIntake / 2;

  const interpX = (y: number) => {
    const t = (y - topPoint.y) / sideSpanY;
    return topPoint.x + (botPoint.x - topPoint.x) * t;
  };

  const upperMouth: Point2D = {
    x: Number(interpX(upperY).toFixed(2)),
    y: Number(upperY.toFixed(2)),
  };
  const rawLowerMouth: Point2D = {
    x: Number(interpX(lowerY).toFixed(2)),
    y: Number(lowerY.toFixed(2)),
  };

  // Stop dart 2.5 cm short of true bust apex (tailoring standard)
  const apexStop: Point2D = {
    x: Number(Math.max(4.5, apex.x + 2.2).toFixed(2)),
    y: Number(apex.y.toFixed(2)),
  };

  // Equalize lower leg length to match upper leg length from apexStop
  const upperLegLen = Math.hypot(
    upperMouth.x - apexStop.x,
    upperMouth.y - apexStop.y
  );
  const rawLowVecX = rawLowerMouth.x - apexStop.x;
  const rawLowVecY = rawLowerMouth.y - apexStop.y;
  const rawLowLen = Math.hypot(rawLowVecX, rawLowVecY) || 1;
  const lowerMouth: Point2D = {
    x: Number((apexStop.x + (rawLowVecX / rawLowLen) * upperLegLen).toFixed(2)),
    y: Number((apexStop.y + (rawLowVecY / rawLowLen) * upperLegLen).toFixed(2)),
  };

  // Outward trued dart cap so folded dart lies flat along side seam
  const midMouthX = (upperMouth.x + lowerMouth.x) / 2;
  const midMouthY = (upperMouth.y + lowerMouth.y) / 2;
  const capOffset = Math.min(0.65, clampedIntake * 0.16);
  const dartCapPoint: Point2D = {
    x: Number((midMouthX + capOffset).toFixed(2)),
    y: Number(midMouthY.toFixed(2)),
  };

  const sideCommands: PathCommand[] = [
    { type: "L", x: upperMouth.x, y: upperMouth.y },
    { type: "L", x: dartCapPoint.x, y: dartCapPoint.y },
    { type: "L", x: lowerMouth.x, y: lowerMouth.y },
    { type: "L", x: botPoint.x, y: botPoint.y },
  ];

  const internalLine: PatternInternalLine = {
    commands: [
      { type: "M", x: upperMouth.x, y: upperMouth.y },
      { type: "L", x: apexStop.x, y: apexStop.y },
      { type: "L", x: lowerMouth.x, y: lowerMouth.y },
    ],
    style: "dart",
    label,
    labelPos: {
      x: Number(((apexStop.x + midMouthX) / 2).toFixed(2)),
      y: Number(((apexStop.y + midMouthY) / 2 - 0.8).toFixed(2)),
    },
  };

  const closedSideLengthCm =
    Math.hypot(upperMouth.x - topPoint.x, upperMouth.y - topPoint.y) +
    Math.hypot(botPoint.x - lowerMouth.x, botPoint.y - lowerMouth.y);

  return {
    sideCommands,
    internalLine,
    closedSideLengthCm: Number(closedSideLengthCm.toFixed(2)),
    dartCapPoint,
  };
}

/**
 * Generates a single-ended trued waist dart (opening along the top waist edge)
 * for skirts and trousers, or a double-ended diamond dart for bodices/dresses.
 */
export function buildTruedWaistDart(params: {
  centerX: number;
  waistY: number;
  tipY: number;
  intakeCm: number;
  topY?: number; // Provide for double-ended bodice diamond dart
  label?: string;
}): {
  internalLine: PatternInternalLine;
  waistIntakeCm: number;
  capPoint: Point2D;
} {
  const { centerX, waistY, tipY, intakeCm, topY, label = "Pinza cintura" } = params;
  const halfW = Number((intakeCm / 2).toFixed(2));
  const capLift = Math.min(0.45, intakeCm * 0.14);

  if (typeof topY === "number") {
    const commands: PathCommand[] = [
      { type: "M", x: centerX, y: topY },
      { type: "L", x: centerX + halfW, y: waistY },
      { type: "L", x: centerX, y: tipY },
      { type: "L", x: centerX - halfW, y: waistY },
      { type: "Z" },
    ];
    return {
      internalLine: {
        commands,
        style: "dart",
        label,
        labelPos: { x: centerX, y: waistY },
      },
      waistIntakeCm: Number((halfW * 2).toFixed(2)),
      capPoint: { x: centerX, y: waistY },
    };
  }

  // Single-ended skirt/trouser waist dart with subtle upward trued cap
  const leftLegX = Number((centerX - halfW).toFixed(2));
  const rightLegX = Number((centerX + halfW).toFixed(2));
  const capPoint = {
    x: Number(centerX.toFixed(2)),
    y: Number((waistY - capLift).toFixed(2)),
  };

  return {
    internalLine: {
      commands: [
        { type: "M", x: leftLegX, y: waistY },
        { type: "L", x: centerX, y: tipY },
        { type: "L", x: rightLegX, y: waistY },
        { type: "L", x: capPoint.x, y: capPoint.y },
        { type: "Z" },
      ],
      style: "dart",
      label,
      labelPos: { x: centerX, y: waistY + (tipY - waistY) * 0.48 },
    },
    waistIntakeCm: Number((halfW * 2).toFixed(2)),
    capPoint,
  };
}

/**
 * Generates a real curved anatomical neckline facing ("Vista Escote Delantero/Trasero")
 * by tracing and offsetting the exact neckline Bézier/polyline inward by `widthCm`.
 */
export function buildAnatomicalNeckFacing(params: {
  id: string;
  name: string;
  tabLabel: string;
  neckWidth: number;
  neckDrop: number;
  style: NecklineStyle;
  widthCm?: number;
  isFront: boolean;
  seamAllowance: SeamAllowance;
  openFront?: boolean;
}): PatternPiece {
  const {
    id,
    name,
    tabLabel,
    neckWidth,
    neckDrop,
    style,
    widthCm = 4.8,
    isFront,
    seamAllowance,
    openFront = false,
  } = params;

  const startPt: Point2D = { x: 0, y: neckDrop };
  const neckCmds = buildNecklineCommand(neckWidth, neckDrop, isFront ? style : "round");

  const sampled: Point2D[] = [startPt];
  let curr = startPt;
  for (const cmd of neckCmds) {
    if (cmd.type === "L") {
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        sampled.push({
          x: curr.x + (cmd.x - curr.x) * t,
          y: curr.y + (cmd.y - curr.y) * t,
        });
      }
      curr = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "C") {
      sampled.push(
        ...sampleCubicBezier(
          curr,
          { x: cmd.cp1x, y: cmd.cp1y },
          { x: cmd.cp2x, y: cmd.cp2y },
          { x: cmd.x, y: cmd.y },
          14
        )
      );
      curr = { x: cmd.x, y: cmd.y };
    }
  }

  // Offset downward/outward into the garment interior (normal toward +x/+y away from neck hole)
  const outerPts: Point2D[] = sampled.map((p, idx) => {
    const prev = sampled[Math.max(0, idx - 1)];
    const next = sampled[Math.min(sampled.length - 1, idx + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // Neck curve proceeds from (0, neckDrop) up-right toward (neckWidth, 0), so interior normal is (-dy, +dx) -> Wait:
    // dx > 0, dy < 0 => (-dy, dx) = (+, +) which goes into the bodice!
    let nx = -dy / len;
    let ny = dx / len;
    if (idx === 0) {
      nx = 0;
      ny = 1;
    } else if (idx === sampled.length - 1) {
      nx = 1;
      ny = 0;
    }
    return {
      x: Number((p.x + nx * widthCm).toFixed(2)),
      y: Number((p.y + ny * widthCm).toFixed(2)),
    };
  });

  // Clamp center-edge x back to 0 so fold edge stays vertical
  outerPts[0] = { x: 0, y: Number((neckDrop + widthCm).toFixed(2)) };
  // Clamp shoulder-join outer y cleanly along slight shoulder slope
  const shoulderOuter: Point2D = {
    x: Number((neckWidth + widthCm).toFixed(2)),
    y: Number((widthCm * 0.28).toFixed(2)),
  };
  outerPts[outerPts.length - 1] = shoulderOuter;

  const seam: PathCommand[] = [
    { type: "M", x: 0, y: neckDrop },
    ...neckCmds,
    { type: "L", x: shoulderOuter.x, y: shoulderOuter.y },
    ...outerPts
      .slice(0, -1)
      .reverse()
      .map((p): PathCommand => ({ type: "L", x: p.x, y: p.y })),
    { type: "Z" },
  ];

  // Segment count: neckCmds.length (curve/edges), shoulder join (+1), outerPts.length-1 (outer curve), closing Z (fold)
  const edgeAllowances: Record<number, number | EdgeAllowanceKind> = {};
  for (let i = 0; i < neckCmds.length; i++) {
    edgeAllowances[i] = "curve";
  }
  const closingIdx = neckCmds.length + 1 + (outerPts.length - 1);
  if (!openFront) {
    edgeAllowances[closingIdx] = "fold";
  }

  return normalizePiece(
    {
      id,
      name,
      subtitle: `Vista anatómica ${widthCm.toFixed(1)} cm + Entretela x1`,
      tabLabel,
      seamPath: seam,
      grainline: {
        x1: Number(Math.max(1.8, neckWidth * 0.35).toFixed(2)),
        y1: Number((neckDrop + 0.6).toFixed(2)),
        x2: Number(Math.max(1.8, neckWidth * 0.35).toFixed(2)),
        y2: Number((neckDrop + widthCm - 0.6).toFixed(2)),
      },
      notches: [
        { x: neckWidth, y: 0, angle: -45, label: "Hombro" },
        { x: 0, y: neckDrop, angle: 90, label: isFront ? "Centro del." : "Centro esp.", count: isFront ? 1 : 2 },
      ],
      labelPos: {
        x: Number((neckWidth * 0.52).toFixed(2)),
        y: Number((neckDrop * 0.55 + widthCm * 0.5).toFixed(2)),
      },
      labelAngle: 0,
      labelMaxSpanCm: neckWidth + widthCm,
      labelBandWidthCm: widthCm * 1.4,
      foldLine: openFront
        ? undefined
        : { x1: 0, y1: neckDrop, x2: 0, y2: neckDrop + widthCm },
      edgeAllowances,
      cutQuantity: openFront ? 2 : 1,
      cutOnFold: !openFront,
      interfacingQuantity: openFront ? 2 : 1,
    },
    seamAllowance
  );
}
