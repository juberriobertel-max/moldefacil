import {
  FabricType,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PantsSubStyle,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "../types";
import {
  buildNecklineCommand,
  computeEase,
  cubicBezierLength,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import { generateSkirtPattern } from "./skirtEngine";
import { generatePantsPattern } from "./pantsEngine";
import {
  buildSleevePiece,
  buildWaistbandPiece,
  buildWaistTiePiece,
  buildWrapFacingPiece,
} from "./extrasEngine";

export interface TwoPieceEngineInput {
  measurements: Measurements;
  topStyle: TwoPieceTopStyle;
  bottomStyle: TwoPieceBottomStyle;
  pantsSubStyle?: PantsSubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  necklineDropRatio?: number;
  topLengthMultiplier?: number;
  bottomLengthMultiplier?: number;
  flareRatio?: number;
  extras?: GarmentExtras;
}

export function generateTwoPiecePattern(
  input: TwoPieceEngineInput
): PatternResult {
  const {
    measurements,
    topStyle,
    bottomStyle,
    pantsSubStyle = "straight",
    necklineStyle,
    sleeveStyle,
    seamAllowance,
    fabricType,
    necklineDropRatio,
    topLengthMultiplier = 1,
    bottomLengthMultiplier = 1,
    flareRatio,
    extras,
  } = input;

  const { easeFactor, flatEase, label } = computeEase(fabricType, 0);

  const effBust = measurements.bust * easeFactor + flatEase;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;

  const quarterBust = effBust / 4;
  const quarterWaist = effWaist / 4;
  const halfBack = effBack / 2;

  // Separate top length (crop top vs waist blouse) + 2 cm bottom hem allowance
  const baseTopRatio = topStyle === "crop_top" ? 0.72 : 1.0;
  const bottomHemAllowance = 2.0;
  const topBodyLen =
    Math.max(24, measurements.bodiceLength * baseTopRatio * topLengthMultiplier) +
    bottomHemAllowance;

  const topBottomHalfW =
    topStyle === "crop_top"
      ? quarterWaist + (quarterBust - quarterWaist) * 0.35
      : quarterWaist + 1;

  const neckW = Math.max(6.2, effBust * 0.075);
  const baseNeckDrop =
    necklineStyle === "v_neck"
      ? 14
      : necklineStyle === "square"
        ? 10.5
        : necklineStyle === "high"
          ? 4.2
          : 9;
  const frontNeckDrop = necklineDropRatio
    ? Math.max(4.0, Math.min(topBodyLen - 8, measurements.bodiceLength * necklineDropRatio))
    : baseNeckDrop;
  const backNeckDrop = 2.5;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const armholeDepth = Math.min(topBodyLen - 6, Math.max(17, effBust * 0.215));

  const frontArmholeLen = cubicBezierLength(
    { x: shoulderX, y: shoulderSlope },
    { x: shoulderX - 1.5, y: armholeDepth * 0.55 },
    { x: quarterBust * 0.84, y: armholeDepth },
    { x: quarterBust, y: armholeDepth }
  );
  const backArmholeLen = cubicBezierLength(
    { x: shoulderX, y: shoulderSlope },
    { x: shoulderX - 0.5, y: armholeDepth * 0.58 },
    { x: quarterBust * 0.87, y: armholeDepth },
    { x: quarterBust, y: armholeDepth }
  );
  const totalArmhole = frontArmholeLen + backArmholeLen;

  const pieces: PatternPiece[] = [];

  const isWrapFront = Boolean(extras?.wrapFront);
  const wrapOverlap = Math.round(quarterWaist * 0.58);

  // 1. TOP DELANTERO (simétrico o Frente Cruzado)
  const topFrontSeam: PathCommand[] = isWrapFront
    ? [
        { type: "M", x: neckW, y: 0 },
        { type: "L", x: shoulderX, y: shoulderSlope },
        {
          type: "C",
          cp1x: shoulderX - 1.5,
          cp1y: armholeDepth * 0.55,
          cp2x: quarterBust * 0.84,
          cp2y: armholeDepth,
          x: quarterBust,
          y: armholeDepth,
        },
        { type: "L", x: topBottomHalfW, y: topBodyLen },
        { type: "L", x: -wrapOverlap, y: topBodyLen },
        {
          type: "C",
          cp1x: -wrapOverlap * 0.35,
          cp1y: topBodyLen * 0.62,
          cp2x: neckW * 0.55,
          cp2y: topBodyLen * 0.25,
          x: neckW,
          y: 0,
        },
        { type: "Z" },
      ]
    : [
        { type: "M", x: 0, y: frontNeckDrop },
        ...buildNecklineCommand(neckW, frontNeckDrop, necklineStyle),
        { type: "L", x: shoulderX, y: shoulderSlope },
        {
          type: "C",
          cp1x: shoulderX - 1.5,
          cp1y: armholeDepth * 0.55,
          cp2x: quarterBust * 0.84,
          cp2y: armholeDepth,
          x: quarterBust,
          y: armholeDepth,
        },
        { type: "L", x: topBottomHalfW, y: topBodyLen },
        { type: "L", x: 0, y: topBodyLen },
        { type: "Z" },
      ];

  pieces.push(
    normalizePiece(
      {
        id: "top_front",
        name: isWrapFront
          ? "TOP DELANTERO CRUZADO (x2)"
          : "TOP DELANTERO (x1 doblez)",
        subtitle: isWrapFront
          ? "Cortar 2 piezas (Izquierda y Derecha)"
          : "Incluye 2 cm dobladillo",
        tabLabel: isWrapFront ? "Top Cruzado" : "Top Delantero",
        seamPath: topFrontSeam,
        grainline: {
          x1: Math.max(4, topBottomHalfW * 0.45),
          y1: Math.max(frontNeckDrop + 3, 11),
          x2: Math.max(4, topBottomHalfW * 0.45),
          y2: topBodyLen - 4,
        },
        notches: [
          { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
          {
            x: topBottomHalfW,
            y: topBodyLen - bottomHemAllowance,
            angle: 0,
            label: "Dobladillo",
          },
          ...(isWrapFront
            ? [
                {
                  x: 0,
                  y: topBodyLen,
                  angle: 90,
                  label: "Centro Delantero",
                },
                {
                  x: -wrapOverlap,
                  y: topBodyLen,
                  angle: 180,
                  label: "Cruce cintura",
                },
              ]
            : []),
        ],
        labelPos: { x: topBottomHalfW * 0.5, y: topBodyLen * 0.65 },
        foldLine: isWrapFront
          ? undefined
          : { x1: 0, y1: frontNeckDrop, x2: 0, y2: topBodyLen },
      },
      seamAllowance
    )
  );

  if (isWrapFront) {
    pieces.push(
      buildWrapFacingPiece({
        neckW,
        shoulderX,
        shoulderSlope,
        wrapOverlap,
        wrapWaistY: topBodyLen,
        seamAllowance,
      })
    );
  }

  // 2. TOP TRASERO
  const topBackSeam: PathCommand[] = [
    { type: "M", x: 0, y: backNeckDrop },
    ...buildNecklineCommand(neckW, backNeckDrop, "round"),
    { type: "L", x: shoulderX, y: shoulderSlope },
    {
      type: "C",
      cp1x: shoulderX - 0.5,
      cp1y: armholeDepth * 0.58,
      cp2x: quarterBust * 0.87,
      cp2y: armholeDepth,
      x: quarterBust,
      y: armholeDepth,
    },
    { type: "L", x: topBottomHalfW, y: topBodyLen },
    { type: "L", x: 0, y: topBodyLen },
    { type: "Z" },
  ];

  pieces.push(
    normalizePiece(
      {
        id: "top_back",
        name: "TOP TRASERO (x1 doblez)",
        subtitle: "Incluye 2 cm dobladillo",
        tabLabel: "Top Trasero",
        seamPath: topBackSeam,
        grainline: {
          x1: Math.max(4, topBottomHalfW * 0.45),
          y1: 9,
          x2: Math.max(4, topBottomHalfW * 0.45),
          y2: topBodyLen - 4,
        },
        notches: [
          { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
          { x: topBottomHalfW, y: topBodyLen - bottomHemAllowance, angle: 0, label: "Dobladillo" },
        ],
        labelPos: { x: topBottomHalfW * 0.5, y: topBodyLen * 0.65 },
        foldLine: { x1: 0, y1: backNeckDrop, x2: 0, y2: topBodyLen },
      },
      seamAllowance
    )
  );

  // 3. MANGA (estándar o acampanada)
  const sleevePiece = buildSleevePiece({
    armholeDepth,
    totalArmholePerimeter: totalArmhole,
    sleeveLengthCm: measurements.sleeveLength,
    sleeveStyle,
    flaredSleeve: extras?.flaredSleeve,
    seamAllowance,
  });
  if (sleevePiece) {
    pieces.push(sleevePiece);
  }

  // 4. BOTTOM PIECES (Falda/Pantalón + Bolero/Bolsillos si aplica)
  const bottomExtras: GarmentExtras | undefined = extras
    ? {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: extras.hemRuffle,
        sidePockets: extras.sidePockets,
      }
    : undefined;

  if (bottomStyle === "pants") {
    const pantsResult = generatePantsPattern({
      measurements,
      subStyle: pantsSubStyle === "wide" ? "wide" : "straight",
      seamAllowance,
      fabricType,
      lengthMultiplier: bottomLengthMultiplier,
      extras: bottomExtras,
      includeWaistband: false,
    });
    for (const p of pantsResult.pieces) {
      const labelOverride =
        p.id === "front_leg"
          ? "Pantalón Delantero"
          : p.id === "back_leg"
            ? "Pantalón Trasero"
            : p.tabLabel;
      pieces.push({
        ...p,
        id: p.id === "front_leg" || p.id === "back_leg" ? `bottom_${p.id}` : p.id,
        tabLabel: labelOverride,
      });
    }
  } else {
    const skirtStyleMap: Record<
      Exclude<TwoPieceBottomStyle, "pants">,
      SkirtSubStyle
    > = {
      straight_skirt: "straight",
      aline_skirt: "a_line",
      long_skirt: "semicircular",
    };
    const effectiveSkirtMeasurements: Measurements =
      bottomStyle === "long_skirt"
        ? { ...measurements, skirtLength: Math.max(85, measurements.skirtLength) }
        : measurements;

    const skirtResult = generateSkirtPattern({
      measurements: effectiveSkirtMeasurements,
      subStyle: skirtStyleMap[bottomStyle],
      seamAllowance,
      fabricType,
      flareRatio,
      lengthMultiplier: bottomLengthMultiplier,
      extras: bottomExtras,
      includeWaistband: false,
    });

    for (const p of skirtResult.pieces) {
      const isMainSkirt = p.id === "front" || p.id === "back";
      pieces.push({
        ...p,
        id: isMainSkirt ? `bottom_${p.id}` : p.id,
        name:
          p.id === "front"
            ? "FALDA DELANTERO (x1 doblez)"
            : p.id === "back"
              ? "FALDA TRASERO (x2)"
              : p.name,
        tabLabel:
          p.id === "front"
            ? "Falda Delantero"
            : p.id === "back"
              ? "Falda Trasero"
              : p.tabLabel,
      });
    }
  }

  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  // 5. PRETINA (Waistband shared builder)
  pieces.push(buildWaistbandPiece(effWaist, seamAllowance));

  const topText = topStyle === "crop_top" ? "Crop Top" : "Blusa";
  const bottomTextMap: Record<TwoPieceBottomStyle, string> = {
    straight_skirt: "Falda Recta",
    aline_skirt: "Falda en A",
    long_skirt: "Falda Larga Fluida",
    pants: "Pantalón",
  };

  return {
    category: "two_piece",
    subStyleLabel: `Conjunto: ${topText} + ${bottomTextMap[bottomStyle]}`,
    pieces,
    fabricConsumption: {
      width140m: estimateFabricMeters(pieces, 140),
      width150m: estimateFabricMeters(pieces, 150),
    },
    totalBoundsCm: packPiecesOnSheet(pieces, 5),
    appliedEaseLabel: label,
  };
}
