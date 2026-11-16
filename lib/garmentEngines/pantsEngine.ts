import {
  FabricType,
  GarmentExtras,
  Measurements,
  PantsSubStyle,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
} from "../types";
import {
  computeEase,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import {
  buildPocketBagPiece,
  buildWaistbandPiece,
  buildWaistTiePiece,
  createSidePocketNotches,
} from "./extrasEngine";

export interface PantsEngineInput {
  measurements: Measurements;
  subStyle: PantsSubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
  includeWaistband?: boolean;
}

export function generatePantsPattern(input: PantsEngineInput): PatternResult {
  const {
    measurements,
    subStyle,
    seamAllowance,
    fabricType,
    lengthMultiplier = 1,
    extras,
    includeWaistband = true,
  } = input;

  const extraEase = subStyle === "wide" ? 3 : 0;
  const { easeFactor, flatEase, label } = computeEase(fabricType, extraEase);

  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effThigh = measurements.thigh * easeFactor + flatEase * 0.5;

  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;

  const crotchDepth = Math.max(20, measurements.crotchDepth);
  const legLength =
    (subStyle === "shorts"
      ? Math.min(26, Math.max(12, measurements.inseam * 0.25))
      : Math.max(50, measurements.inseam)) * lengthMultiplier;
  const totalLen = crotchDepth + legLength;
  const kneeY = crotchDepth + legLength * 0.52;

  // Crotch extensions proportional to hip circumference
  const frontCrotchExt = Math.max(4.5, effHip * 0.055);
  const backCrotchExt = Math.max(8.5, effHip * 0.11);

  const halfHem =
    subStyle === "wide"
      ? Math.max(measurements.hemWidth / 2, quarterHip * 0.92)
      : Math.max(14, measurements.hemWidth / 2);
  const frontHemHalf = halfHem - 1;
  const backHemHalf = halfHem + 1;

  const frontKneeHalf = Math.max(frontHemHalf + 1.5, effThigh * 0.36);
  const backKneeHalf = Math.max(backHemHalf + 2.5, effThigh * 0.42);

  const pieces: PatternPiece[] = [];

  // =========================================================================
  // 1. PIERNA DELANTERA
  // Center crease line at x = frontCenterX
  // =========================================================================
  const frontCenterX = quarterHip / 2 + frontCrotchExt + 2;
  const frontOutWaistX = frontCenterX - quarterWaist / 2 - 1;
  const frontInWaistX = frontCenterX + quarterWaist / 2;
  const frontOutHipX = frontCenterX - quarterHip / 2 - 1.5;
  const frontCrotchTipX = frontCenterX + quarterHip / 2 + frontCrotchExt;

  const frontSeam: PathCommand[] = [
    { type: "M", x: frontOutWaistX, y: 1.0 },
    { type: "L", x: frontInWaistX, y: 0 },
    // Front fly / crotch curve
    { type: "L", x: frontInWaistX, y: crotchDepth * 0.58 },
    {
      type: "C",
      cp1x: frontInWaistX,
      cp1y: crotchDepth * 0.88,
      cp2x: frontInWaistX + frontCrotchExt * 0.55,
      cp2y: crotchDepth,
      x: frontCrotchTipX,
      y: crotchDepth,
    },
    // Inseam to knee & hem
    ...(subStyle === "shorts"
      ? [{ type: "L" as const, x: frontCenterX + frontHemHalf, y: totalLen }]
      : [
          {
            type: "C" as const,
            cp1x: frontCrotchTipX - 1.2,
            cp1y: crotchDepth + (kneeY - crotchDepth) * 0.45,
            cp2x: frontCenterX + frontKneeHalf,
            cp2y: kneeY - 6,
            x: frontCenterX + frontKneeHalf,
            y: kneeY,
          },
          { type: "L" as const, x: frontCenterX + frontHemHalf, y: totalLen },
        ]),
    // Hem
    { type: "L", x: frontCenterX - frontHemHalf, y: totalLen },
    // Outseam
    ...(subStyle === "shorts"
      ? [{ type: "L" as const, x: frontOutHipX, y: crotchDepth }]
      : [
          { type: "L" as const, x: frontCenterX - frontKneeHalf, y: kneeY },
          {
            type: "C" as const,
            cp1x: frontCenterX - frontKneeHalf,
            cp1y: kneeY - 8,
            cp2x: frontOutHipX,
            cp2y: crotchDepth + 8,
            x: frontOutHipX,
            y: crotchDepth,
          },
        ]),
    {
      type: "C",
      cp1x: frontOutHipX,
      cp1y: crotchDepth * 0.5,
      cp2x: frontOutWaistX,
      cp2y: crotchDepth * 0.25,
      x: frontOutWaistX,
      y: 1.0,
    },
    { type: "Z" },
  ];

  pieces.push(
    normalizePiece(
      {
        id: "front_leg",
        name: "PIERNA DELANTERA (x2)",
        subtitle: `Tiro del: ${crotchDepth} cm | Bota: ${(frontHemHalf * 2).toFixed(0)} cm`,
        tabLabel: "Pierna Delantera",
        seamPath: frontSeam,
        grainline: {
          x1: frontCenterX,
          y1: 5,
          x2: frontCenterX,
          y2: totalLen - 5,
        },
        notches: [
          { x: frontOutHipX, y: crotchDepth, angle: 180, label: "Cadera" },
          ...(subStyle !== "shorts"
            ? [{ x: frontCenterX - frontKneeHalf, y: kneeY, angle: 180, label: "Rodilla" }]
            : []),
          ...(extras?.sidePockets
            ? createSidePocketNotches({
                waistX: frontOutWaistX,
                waistY: 1.0,
                hipX: frontOutHipX,
                hipY: crotchDepth,
                angle: 180,
              })
            : []),
        ],
        labelPos: { x: frontCenterX, y: crotchDepth * 1.15 },
      },
      seamAllowance
    )
  );

  // =========================================================================
  // 2. PIERNA TRASERA (Higher back rise + deeper crotch curve)
  // =========================================================================
  const backCenterX = quarterHip / 2 + backCrotchExt + 2;
  const backOutWaistX = backCenterX - quarterWaist / 2 - 2;
  const backInWaistX = backCenterX + quarterWaist / 2 - 2.5;
  const backOutHipX = backCenterX - quarterHip / 2 - 2;
  const backCrotchTipX = backCenterX + quarterHip / 2 + backCrotchExt;
  const backRiseLift = 3.0; // Extra height at back center waist

  const backSeam: PathCommand[] = [
    { type: "M", x: backOutWaistX, y: backRiseLift },
    { type: "L", x: backInWaistX, y: 0 },
    { type: "L", x: backInWaistX + 1.5, y: crotchDepth * 0.62 + backRiseLift },
    {
      type: "C",
      cp1x: backInWaistX + 2.2,
      cp1y: crotchDepth + backRiseLift * 0.6,
      cp2x: backInWaistX + backCrotchExt * 0.65,
      cp2y: crotchDepth + backRiseLift + 1.2,
      x: backCrotchTipX,
      y: crotchDepth + backRiseLift + 0.8,
    },
    ...(subStyle === "shorts"
      ? [
          {
            type: "L" as const,
            x: backCenterX + backHemHalf,
            y: totalLen + backRiseLift,
          },
        ]
      : [
          {
            type: "C" as const,
            cp1x: backCrotchTipX - 1.5,
            cp1y: crotchDepth + backRiseLift + (kneeY - crotchDepth) * 0.45,
            cp2x: backCenterX + backKneeHalf,
            cp2y: kneeY + backRiseLift - 6,
            x: backCenterX + backKneeHalf,
            y: kneeY + backRiseLift,
          },
          {
            type: "L" as const,
            x: backCenterX + backHemHalf,
            y: totalLen + backRiseLift,
          },
        ]),
    {
      type: "L",
      x: backCenterX - backHemHalf,
      y: totalLen + backRiseLift,
    },
    ...(subStyle === "shorts"
      ? [
          {
            type: "L" as const,
            x: backOutHipX,
            y: crotchDepth + backRiseLift,
          },
        ]
      : [
          {
            type: "L" as const,
            x: backCenterX - backKneeHalf,
            y: kneeY + backRiseLift,
          },
          {
            type: "C" as const,
            cp1x: backCenterX - backKneeHalf,
            cp1y: kneeY + backRiseLift - 8,
            cp2x: backOutHipX,
            cp2y: crotchDepth + backRiseLift + 8,
            x: backOutHipX,
            y: crotchDepth + backRiseLift,
          },
        ]),
    {
      type: "C",
      cp1x: backOutHipX,
      cp1y: (crotchDepth + backRiseLift) * 0.5,
      cp2x: backOutWaistX,
      cp2y: backRiseLift + crotchDepth * 0.25,
      x: backOutWaistX,
      y: backRiseLift,
    },
    { type: "Z" },
  ];

  pieces.push(
    normalizePiece(
      {
        id: "back_leg",
        name: "PIERNA TRASERA (x2)",
        subtitle: `Tiro tras: ${(crotchDepth + backRiseLift).toFixed(1)} cm | Bota: ${(backHemHalf * 2).toFixed(0)} cm`,
        tabLabel: "Pierna Trasera",
        seamPath: backSeam,
        grainline: {
          x1: backCenterX,
          y1: 6,
          x2: backCenterX,
          y2: totalLen + backRiseLift - 5,
        },
        notches: [
          {
            x: backOutHipX,
            y: crotchDepth + backRiseLift,
            angle: 180,
            label: "Cadera",
          },
          ...(subStyle !== "shorts"
            ? [
                {
                  x: backCenterX - backKneeHalf,
                  y: kneeY + backRiseLift,
                  angle: 180,
                  label: "Rodilla",
                },
              ]
            : []),
          ...(extras?.sidePockets
            ? createSidePocketNotches({
                waistX: backOutWaistX,
                waistY: backRiseLift,
                hipX: backOutHipX,
                hipY: crotchDepth + backRiseLift,
                angle: 180,
              })
            : []),
        ],
        labelPos: { x: backCenterX, y: (crotchDepth + backRiseLift) * 1.15 },
      },
      seamAllowance
    )
  );

  if (includeWaistband) {
    pieces.push(buildWaistbandPiece(effWaist, seamAllowance));
  }
  if (extras?.sidePockets) {
    pieces.push(buildPocketBagPiece(seamAllowance));
  }
  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  const subLabels: Record<PantsSubStyle, string> = {
    straight: "Pantalón Recto",
    wide: "Pantalón Ancho / Palazzo",
    shorts: "Short / Bermuda",
  };

  return {
    category: "pants",
    subStyleLabel: subLabels[subStyle],
    pieces,
    fabricConsumption: {
      width140m: estimateFabricMeters(pieces, 140),
      width150m: estimateFabricMeters(pieces, 150),
    },
    totalBoundsCm: packPiecesOnSheet(pieces, 5),
    appliedEaseLabel: label,
  };
}
