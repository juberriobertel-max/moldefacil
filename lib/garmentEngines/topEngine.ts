import {
  FabricType,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
} from "../types";
import {
  buildNecklineCommand,
  computeEase,
  cubicBezierLength,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import {
  buildHemRufflePiece,
  buildPocketBagPiece,
  buildSleevePiece,
  buildWaistTiePiece,
  buildWrapFacingPiece,
  createSidePocketNotches,
} from "./extrasEngine";

export interface TopEngineInput {
  measurements: Measurements;
  subStyle: TopSubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle?: SleeveStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  necklineDropRatio?: number;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
  styleVariant?: StyleVariant;
}

export function generateTopPattern(input: TopEngineInput): PatternResult {
  const {
    measurements,
    subStyle,
    necklineStyle,
    sleeveStyle = "short",
    seamAllowance,
    fabricType,
    necklineDropRatio,
    lengthMultiplier = 1,
    extras,
    styleVariant = "default",
  } = input;

  // Jacket gets +4 cm extra outer ease
  const extraEase = subStyle === "jacket" ? 4 : subStyle === "blouse" ? 1 : 0;
  const { easeFactor, flatEase, label } = computeEase(fabricType, extraEase);

  const effBust = measurements.bust * easeFactor + flatEase;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;

  const quarterBust = effBust / 4;
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;
  const halfBack = effBack / 2;

  const bodiceLen = measurements.bodiceLength * lengthMultiplier;
  const hipExt = (subStyle === "jacket" ? 18 : 14) * lengthMultiplier;
  const totalLen = bodiceLen + hipExt;

  const isPeasant = styleVariant === "peasant_offshoulder";
  const isOfficeDart = styleVariant === "office_dart";

  const neckW = Math.max(6.2, effBust * (isPeasant ? 0.115 : 0.075));
  const baseNeckDrop =
    necklineStyle === "v_neck"
      ? 14
      : necklineStyle === "square"
        ? 10.5
        : necklineStyle === "high"
          ? 4.2
          : 9;
  const frontNeckDrop = necklineDropRatio
    ? Math.max(4.0, bodiceLen * necklineDropRatio)
    : baseNeckDrop;
  const backNeckDrop = 2.5;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const armholeDepth = Math.max(17, effBust * 0.215);

  // Compute exact armhole arc lengths (front & back) for sleeve cap matching
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
  const totalArmholePerimeter = frontArmholeLen + backArmholeLen;

  const pieces: PatternPiece[] = [];

  const isWrapFront = Boolean(extras?.wrapFront);
  const wrapOverlap = Math.round(quarterWaist * 0.6);
  const pocketNotches = extras?.sidePockets
    ? createSidePocketNotches({
        waistX: quarterWaist,
        waistY: Math.max(armholeDepth + 4, bodiceLen - 6),
        hipX: quarterHip,
        hipY: totalLen,
      })
    : [];

  // 1. DELANTERO (simétrico al doblez o Frente Cruzado)
  const frontSeam: PathCommand[] = isWrapFront
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
        { type: "L", x: quarterWaist, y: bodiceLen },
        {
          type: "C",
          cp1x: quarterWaist + (quarterHip - quarterWaist) * 0.45,
          cp1y: bodiceLen + hipExt * 0.35,
          cp2x: quarterHip,
          cp2y: bodiceLen + hipExt * 0.75,
          x: quarterHip,
          y: totalLen,
        },
        { type: "L", x: -wrapOverlap, y: totalLen },
        { type: "L", x: -wrapOverlap, y: bodiceLen },
        {
          type: "C",
          cp1x: -wrapOverlap * 0.35,
          cp1y: bodiceLen * 0.62,
          cp2x: neckW * 0.55,
          cp2y: bodiceLen * 0.25,
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
        { type: "L", x: quarterWaist, y: bodiceLen },
        {
          type: "C",
          cp1x: quarterWaist + (quarterHip - quarterWaist) * 0.45,
          cp1y: bodiceLen + hipExt * 0.35,
          cp2x: quarterHip,
          cp2y: bodiceLen + hipExt * 0.75,
          x: quarterHip,
          y: totalLen,
        },
        { type: "L", x: 0, y: totalLen },
        { type: "Z" },
      ];

  pieces.push(
    normalizePiece(
      {
        id: "front",
        name: isWrapFront
          ? "DELANTERO CRUZADO (x2)"
          : subStyle === "jacket"
            ? "DELANTERO CHAQUETA (x2)"
            : "DELANTERO (x1 al doblez)",
        subtitle: isWrapFront
          ? "Cortar 2 piezas (Izquierda y Derecha)"
          : `Sisa: ${frontArmholeLen.toFixed(1)} cm`,
        tabLabel: isWrapFront ? "Delantero Cruzado" : "Delantero",
        seamPath: frontSeam,
        grainline: {
          x1: Math.max(4, quarterWaist * 0.45),
          y1: Math.max(frontNeckDrop + 3, 12),
          x2: Math.max(4, quarterWaist * 0.45),
          y2: totalLen - 6,
        },
        notches: [
          { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
          { x: quarterWaist, y: bodiceLen, angle: 0, label: "Cintura" },
          ...(isWrapFront
            ? [
                {
                  x: 0,
                  y: bodiceLen,
                  angle: 90,
                  label: "Centro Delantero",
                },
                {
                  x: -wrapOverlap,
                  y: bodiceLen,
                  angle: 180,
                  label: "Cruce cintura",
                },
              ]
            : []),
          ...(isOfficeDart
            ? [
                {
                  x: quarterBust - 0.5,
                  y: armholeDepth + 6.5,
                  angle: 0,
                  label: "Pinza de busto",
                },
              ]
            : []),
          ...pocketNotches,
        ],
        labelPos: { x: quarterWaist * 0.48, y: bodiceLen * 0.7 },
        foldLine:
          subStyle === "jacket" || isWrapFront
            ? undefined
            : { x1: 0, y1: frontNeckDrop, x2: 0, y2: totalLen },
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
        wrapWaistY: bodiceLen,
        seamAllowance,
      })
    );
  }

  // 2. TRASERO
  const backSeam: PathCommand[] = [
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
    { type: "L", x: quarterWaist, y: bodiceLen },
    {
      type: "C",
      cp1x: quarterWaist + (quarterHip - quarterWaist) * 0.45,
      cp1y: bodiceLen + hipExt * 0.35,
      cp2x: quarterHip,
      cp2y: bodiceLen + hipExt * 0.75,
      x: quarterHip,
      y: totalLen,
    },
    { type: "L", x: 0, y: totalLen },
    { type: "Z" },
  ];

  pieces.push(
    normalizePiece(
      {
        id: "back",
        name: "TRASERO (x1 al doblez)",
        subtitle: `Sisa: ${backArmholeLen.toFixed(1)} cm`,
        tabLabel: "Trasero",
        seamPath: backSeam,
        grainline: {
          x1: Math.max(4, quarterWaist * 0.45),
          y1: 10,
          x2: Math.max(4, quarterWaist * 0.45),
          y2: totalLen - 6,
        },
        notches: [
          { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
          { x: quarterWaist, y: bodiceLen, angle: 0, label: "Cintura" },
        ],
        labelPos: { x: quarterWaist * 0.48, y: bodiceLen * 0.7 },
        foldLine: { x1: 0, y1: backNeckDrop, x2: 0, y2: totalLen },
      },
      seamAllowance
    )
  );

  // 3. MANGA (estándar o acampanada)
  const sleevePiece = buildSleevePiece({
    armholeDepth,
    totalArmholePerimeter,
    sleeveLengthCm: measurements.sleeveLength,
    sleeveStyle,
    flaredSleeve: extras?.flaredSleeve,
    seamAllowance,
  });
  if (sleevePiece) {
    pieces.push(sleevePiece);
  }

  // 4. CUELLO / VISTA (omitido si hay vista de escote cruzado, o incluido si aplica)
  if (!isWrapFront) {
    const collarLen = Number(
      ((neckW * 2 + frontNeckDrop * 0.5 + backNeckDrop * 0.5) * 1.1).toFixed(1)
    );
    const collarH = subStyle === "jacket" ? 7.5 : 4.5;
    const collarSeam: PathCommand[] = [
      { type: "M", x: 0, y: 0 },
      { type: "L", x: collarLen, y: 0 },
      { type: "L", x: collarLen, y: collarH },
      { type: "L", x: 0, y: collarH },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "collar",
          name: "CUELLO / VISTA (x1)",
          subtitle: `${collarLen} × ${collarH} cm`,
          tabLabel: "Cuello/Vista",
          seamPath: collarSeam,
          grainline: { x1: 3, y1: collarH / 2, x2: collarLen - 3, y2: collarH / 2 },
          notches: [{ x: collarLen / 2, y: 0, angle: -90, label: "Centro" }],
          labelPos: { x: collarLen / 2, y: collarH * 0.55 },
        },
        seamAllowance
      )
    );
  }

  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }
  if (extras?.hemRuffle) {
    pieces.push(buildHemRufflePiece(quarterHip, 48, seamAllowance).piece);
  }
  if (extras?.sidePockets) {
    pieces.push(buildPocketBagPiece(seamAllowance));
  }

  const subLabels: Record<TopSubStyle, string> = {
    tshirt: isWrapFront ? "Top Cruzado" : "Camiseta Base",
    blouse: isWrapFront ? "Blusa Cruzada (Envolvente)" : "Blusa / Camisa",
    jacket: "Chaqueta Base",
  };

  return {
    category: "top",
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
