import {
  FabricType,
  GarmentExtras,
  Measurements,
  PantsSubStyle,
  PathCommand,
  PatternInternalLine,
  PatternPiece,
  PatternResult,
  SeamAllowance,
} from "../types";
import {
  buildFinishedMeasurements,
  computeCuttingLayout,
  computeEase,
  cubicBezierLength,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import {
  buildFlapPocketPieces,
  buildItalianPocketPieces,
  buildPocketBagPiece,
  buildTrouserFlyPieces,
  buildWaistbandPiece,
  buildWaistTiePiece,
  createFlapPocketMarkLine,
  createSidePocketNotches,
} from "./extrasEngine";
import { buildTruedWaistDart } from "./dartUtils";
import { resolveProMeasurements } from "../seamValidator";

export interface PantsEngineInput {
  measurements: Measurements;
  subStyle: PantsSubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  lengthMultiplier?: number;
  crotchDepthMultiplier?: number;
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
    crotchDepthMultiplier = 1,
    extras,
    includeWaistband = true,
  } = input;

  const pro = resolveProMeasurements(measurements);
  const extraEase = subStyle === "wide" ? 3 : 0;
  const { easeFactor, flatEase, label } = computeEase(fabricType, extraEase);

  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effThigh = measurements.thigh * easeFactor + flatEase * 0.5;

  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;

  const crotchDepth = Number(
    Math.min(42, Math.max(18, measurements.crotchDepth * crotchDepthMultiplier)).toFixed(1)
  );
  const hipLineY = Math.min(crotchDepth - 3, Math.max(12, pro.hipHeight));
  const legLength =
    (subStyle === "shorts"
      ? Math.min(26, Math.max(12, measurements.inseam * 0.25))
      : Math.max(50, measurements.inseam)) * lengthMultiplier;
  const totalLen = crotchDepth + legLength;
  const kneeY = crotchDepth + legLength * 0.52;

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

  // Waist darts on woven trousers (back dart eliminates lower-back gaping; subtle front dart on tailored)
  const useWovenDarts = fabricType === "woven";
  const frontDartIntake = useWovenDarts && subStyle !== "shorts" ? 1.4 : 0;
  const backDartIntake = useWovenDarts
    ? Number(Math.min(3.2, Math.max(2.0, (quarterHip - quarterWaist) * 0.42)).toFixed(2))
    : 0;

  const pieces: PatternPiece[] = [];

  // =========================================================================
  // 1. PIERNA DELANTERA
  // =========================================================================
  const frontCenterX = quarterHip / 2 + frontCrotchExt + 2;
  const frontWaistTotal = quarterWaist + frontDartIntake;
  const frontOutWaistX = Number((frontCenterX - frontWaistTotal / 2 - 1.2).toFixed(2));
  const frontInWaistX = Number((frontCenterX + frontWaistTotal / 2 - 0.5).toFixed(2));
  const frontOutHipX = Number((frontCenterX - quarterHip / 2 - 1.5).toFixed(2));
  const frontCrotchTipX = Number((frontCenterX + quarterHip / 2 + frontCrotchExt).toFixed(2));
  const flyLengthCm = Number(Math.min(20, Math.max(15, crotchDepth * 0.68)).toFixed(1));

  const frontInseamUpper =
    subStyle === "shorts"
      ? {
          type: "L" as const,
          x: frontCenterX + frontHemHalf,
          y: totalLen,
        }
      : {
          type: "C" as const,
          cp1x: frontCrotchTipX - 1.2,
          cp1y: crotchDepth + (kneeY - crotchDepth) * 0.45,
          cp2x: frontCenterX + frontKneeHalf,
          cp2y: kneeY - 6,
          x: frontCenterX + frontKneeHalf,
          y: kneeY,
        };

  const frontOutseamMid =
    subStyle === "shorts"
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
        ];

  const frontOutUpperCurve: PathCommand = {
    type: "C",
    cp1x: frontOutHipX,
    cp1y: crotchDepth * 0.5,
    cp2x: frontOutWaistX,
    cp2y: crotchDepth * 0.25,
    x: frontOutWaistX,
    y: 1.0,
  };

  const frontSeam: PathCommand[] = [
    { type: "M", x: frontOutWaistX, y: 1.0 },
    { type: "L", x: frontInWaistX, y: 0 },
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
    frontInseamUpper,
    ...(subStyle === "shorts"
      ? []
      : [{ type: "L" as const, x: frontCenterX + frontHemHalf, y: totalLen }]),
    { type: "L", x: frontCenterX - frontHemHalf, y: totalLen },
    ...frontOutseamMid,
    frontOutUpperCurve,
    { type: "Z" },
  ];

  // Exact front inseam & outseam arc lengths
  const frontInseamLen =
    subStyle === "shorts"
      ? Math.hypot(frontCenterX + frontHemHalf - frontCrotchTipX, totalLen - crotchDepth)
      : cubicBezierLength(
          { x: frontCrotchTipX, y: crotchDepth },
          { x: frontCrotchTipX - 1.2, y: crotchDepth + (kneeY - crotchDepth) * 0.45 },
          { x: frontCenterX + frontKneeHalf, y: kneeY - 6 },
          { x: frontCenterX + frontKneeHalf, y: kneeY }
        ) +
        Math.hypot(
          frontHemHalf - frontKneeHalf,
          totalLen - kneeY
        );

  const frontOutseamLen =
    (subStyle === "shorts"
      ? Math.hypot(frontOutHipX - (frontCenterX - frontHemHalf), totalLen - crotchDepth)
      : Math.hypot(frontKneeHalf - frontHemHalf, totalLen - kneeY) +
        cubicBezierLength(
          { x: frontCenterX - frontKneeHalf, y: kneeY },
          { x: frontCenterX - frontKneeHalf, y: kneeY - 8 },
          { x: frontOutHipX, y: crotchDepth + 8 },
          { x: frontOutHipX, y: crotchDepth }
        )) +
    cubicBezierLength(
      { x: frontOutHipX, y: crotchDepth },
      { x: frontOutHipX, y: crotchDepth * 0.5 },
      { x: frontOutWaistX, y: crotchDepth * 0.25 },
      { x: frontOutWaistX, y: 1.0 }
    );

  const frontInternals: PatternInternalLine[] = [];
  if (frontDartIntake >= 1.0) {
    const fDart = buildTruedWaistDart({
      centerX: frontCenterX,
      waistY: 0.5,
      tipY: 9.0,
      intakeCm: frontDartIntake,
      label: "Pinza del.",
    });
    frontInternals.push(fDart.internalLine);
  }
  if (useWovenDarts) {
    // J-stitch fly guide at center front
    frontInternals.push({
      commands: [
        { type: "M", x: frontInWaistX - 3.5, y: 0.3 },
        { type: "L", x: frontInWaistX - 3.5, y: flyLengthCm - 3 },
        {
          type: "C",
          cp1x: frontInWaistX - 3.5,
          cp1y: flyLengthCm,
          cp2x: frontInWaistX - 1.0,
          cp2y: flyLengthCm,
          x: frontInWaistX,
          y: flyLengthCm,
        },
      ],
      style: "mark",
      label: "Pespunte J",
      labelPos: { x: frontInWaistX - 2.2, y: flyLengthCm * 0.5 },
    });
  }
  if (extras?.flapPockets) {
    frontInternals.push(
      createFlapPocketMarkLine({
        xStart: frontCenterX - quarterHip * 0.25,
        yTop: Math.max(5, crotchDepth * 0.28),
        widthCm: 13.5,
      })
    );
  }

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
          { x: frontOutHipX, y: crotchDepth, angle: 180, label: "Tiro", count: 1 },
          { x: frontInWaistX, y: flyLengthCm, angle: 0, label: "Tope cierre" },
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
        internalLines: frontInternals.length > 0 ? frontInternals : undefined,
        labelPos: { x: frontCenterX, y: crotchDepth * 1.15 },
        edgeAllowances: {
          1: useWovenDarts ? "zipper" : "seam",
          [subStyle === "shorts" ? 4 : 5]: "hem",
        },
        cutQuantity: 2,
        seamAnchors: {
          waist: Number(quarterWaist.toFixed(2)),
          inseam: Number(frontInseamLen.toFixed(2)),
          outseam: Number(frontOutseamLen.toFixed(2)),
        },
      },
      seamAllowance
    )
  );

  // =========================================================================
  // 2. PIERNA TRASERA (Müller/Aldrich seat tilt + matched inseam & outseam)
  // =========================================================================
  const backCenterX = quarterHip / 2 + backCrotchExt + 2;
  const backWaistTotal = quarterWaist + backDartIntake;
  const backTilt = 2.8;
  const backOutWaistX = Number((backCenterX - backWaistTotal / 2 - backTilt * 0.65).toFixed(2));
  const backInWaistX = Number((backCenterX + backWaistTotal / 2 - backTilt).toFixed(2));
  const backOutHipX = Number((backCenterX - quarterHip / 2 - 2.0).toFixed(2));
  const backCrotchTipX = Number((backCenterX + quarterHip / 2 + backCrotchExt).toFixed(2));
  const backRiseLift = 3.0;

  // Match back inseam and back outseam to front within <= 1 mm
  let backCrotchDropOffset = 0.8;
  let backInseamLen = 0;
  for (let i = 0; i < 4; i++) {
    const startY = crotchDepth + backRiseLift + backCrotchDropOffset;
    backInseamLen =
      subStyle === "shorts"
        ? Math.hypot(backCenterX + backHemHalf - backCrotchTipX, totalLen + backRiseLift - startY)
        : cubicBezierLength(
            { x: backCrotchTipX, y: startY },
            { x: backCrotchTipX - 1.5, y: startY + (kneeY + backRiseLift - startY) * 0.45 },
            { x: backCenterX + backKneeHalf, y: kneeY + backRiseLift - 6 },
            { x: backCenterX + backKneeHalf, y: kneeY + backRiseLift }
          ) + Math.hypot(backHemHalf - backKneeHalf, totalLen - kneeY);
    const err = backInseamLen - frontInseamLen;
    if (Math.abs(err) < 0.05) break;
    backCrotchDropOffset = Number((backCrotchDropOffset + err * 0.9).toFixed(2));
  }
  const backCrotchY = Number((crotchDepth + backRiseLift + backCrotchDropOffset).toFixed(2));

  let backSideWaistY = backRiseLift;
  let backOutseamLen = 0;
  for (let i = 0; i < 4; i++) {
    backOutseamLen =
      (subStyle === "shorts"
        ? Math.hypot(backOutHipX - (backCenterX - backHemHalf), totalLen - crotchDepth)
        : Math.hypot(backKneeHalf - backHemHalf, totalLen - kneeY) +
          cubicBezierLength(
            { x: backCenterX - backKneeHalf, y: kneeY + backRiseLift },
            { x: backCenterX - backKneeHalf, y: kneeY + backRiseLift - 8 },
            { x: backOutHipX, y: crotchDepth + backRiseLift + 8 },
            { x: backOutHipX, y: crotchDepth + backRiseLift }
          )) +
      cubicBezierLength(
        { x: backOutHipX, y: crotchDepth + backRiseLift },
        { x: backOutHipX, y: (crotchDepth + backRiseLift) * 0.5 },
        { x: backOutWaistX, y: backSideWaistY + (crotchDepth + backRiseLift) * 0.25 },
        { x: backOutWaistX, y: backSideWaistY }
      );
    const err = backOutseamLen - frontOutseamLen;
    if (Math.abs(err) < 0.05) break;
    backSideWaistY = Number((backSideWaistY + err * 0.9).toFixed(2));
  }

  const backSeam: PathCommand[] = [
    { type: "M", x: backOutWaistX, y: backSideWaistY },
    { type: "L", x: backInWaistX, y: 0 },
    { type: "L", x: backInWaistX + 1.5, y: hipLineY + backRiseLift },
    {
      type: "C",
      cp1x: backInWaistX + 2.2,
      cp1y: crotchDepth + backRiseLift * 0.6,
      cp2x: backInWaistX + backCrotchExt * 0.65,
      cp2y: backCrotchY + 0.4,
      x: backCrotchTipX,
      y: backCrotchY,
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
            cp1y: backCrotchY + (kneeY + backRiseLift - backCrotchY) * 0.45,
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
      cp2y: backSideWaistY + (crotchDepth + backRiseLift) * 0.25,
      x: backOutWaistX,
      y: backSideWaistY,
    },
    { type: "Z" },
  ];

  const backInternals: PatternInternalLine[] = [];
  if (backDartIntake >= 1.2) {
    const bDartCenterX = Number(((backOutWaistX + backInWaistX) / 2).toFixed(2));
    const bDartWaistY = Number((backSideWaistY * 0.5).toFixed(2));
    const bDart = buildTruedWaistDart({
      centerX: bDartCenterX,
      waistY: bDartWaistY,
      tipY: bDartWaistY + 12.5,
      intakeCm: backDartIntake,
      label: "Pinza tras.",
    });
    backInternals.push(bDart.internalLine);
  }

  pieces.push(
    normalizePiece(
      {
        id: "back_leg",
        name: "PIERNA TRASERA (x2)",
        subtitle: `Tiro tras: ${(crotchDepth + backRiseLift).toFixed(1)} cm | ${useWovenDarts ? `Pinza ${backDartIntake.toFixed(1)} cm | ` : ""}Bota: ${(backHemHalf * 2).toFixed(0)} cm`,
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
            label: "Tiro",
            count: 2,
          },
          ...(subStyle !== "shorts"
            ? [
                {
                  x: backCenterX - backKneeHalf,
                  y: kneeY + backRiseLift,
                  angle: 180,
                  label: "Rodilla",
                  count: 2 as const,
                },
              ]
            : []),
          ...(extras?.sidePockets
            ? createSidePocketNotches({
                waistX: backOutWaistX,
                waistY: backSideWaistY,
                hipX: backOutHipX,
                hipY: crotchDepth + backRiseLift,
                angle: 180,
              })
            : []),
        ],
        internalLines: backInternals.length > 0 ? backInternals : undefined,
        labelPos: { x: backCenterX, y: (crotchDepth + backRiseLift) * 1.15 },
        edgeAllowances: {
          [subStyle === "shorts" ? 4 : 5]: "hem",
        },
        cutQuantity: 2,
        seamAnchors: {
          waist: Number(quarterWaist.toFixed(2)),
          inseam: Number(backInseamLen.toFixed(2)),
          outseam: Number(backOutseamLen.toFixed(2)),
        },
      },
      seamAllowance
    )
  );

  if (includeWaistband) {
    pieces.push(
      buildWaistbandPiece(effWaist, seamAllowance, {
        contoured: fabricType === "woven",
      })
    );
  }
  if (useWovenDarts) {
    pieces.push(...buildTrouserFlyPieces({ flyLengthCm, seamAllowance }));
  }
  if (extras?.sidePockets || (useWovenDarts && subStyle !== "shorts")) {
    pieces.push(
      ...(useWovenDarts
        ? buildItalianPocketPieces(seamAllowance)
        : [buildPocketBagPiece(seamAllowance)])
    );
  }
  if (extras?.flapPockets) {
    pieces.push(...buildFlapPocketPieces(seamAllowance));
  }
  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  const subLabels: Record<PantsSubStyle, string> = {
    straight: "Pantalón Recto con Pinza y Bragueta",
    wide: "Pantalón Ancho / Palazzo con Pinzas",
    shorts: "Short / Bermuda con Pinzas",
  };

  const finishedMeasurements = buildFinishedMeasurements([
    { label: "Contorno de Cintura", bodyCm: measurements.waist, finishedCm: effWaist },
    { label: "Contorno de Cadera", bodyCm: measurements.hip, finishedCm: effHip },
    { label: "Contorno de Muslo", bodyCm: measurements.thigh, finishedCm: effThigh },
    { label: "Ancho de Bota", bodyCm: measurements.hemWidth, finishedCm: halfHem * 2 },
    { label: "Largo Total", bodyCm: crotchDepth + measurements.inseam, finishedCm: totalLen },
  ]);

  const cuttingLayout = computeCuttingLayout(pieces, 140);

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
    finishedMeasurements,
    cuttingLayout,
  };
}
