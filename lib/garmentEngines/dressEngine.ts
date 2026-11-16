import {
  DressSubStyle,
  FabricType,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
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
  buildShirtDressDetailPieces,
  buildSleevePiece,
  buildWaistTiePiece,
  buildWrapFacingPiece,
  createSidePocketNotches,
} from "./extrasEngine";

export interface DressEngineInput {
  measurements: Measurements;
  subStyle: DressSubStyle;
  necklineStyle: NecklineStyle;
  skirtFlareStyle: SkirtSubStyle;
  sleeveStyle?: SleeveStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  necklineDropRatio?: number;
  bodiceToTotalRatio?: number;
  flareRatio?: number;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
  styleVariant?: StyleVariant;
}

export function generateDressPattern(input: DressEngineInput): PatternResult {
  const {
    measurements,
    subStyle,
    necklineStyle,
    skirtFlareStyle,
    sleeveStyle = "short",
    seamAllowance,
    fabricType,
    necklineDropRatio,
    bodiceToTotalRatio,
    flareRatio,
    lengthMultiplier = 1,
    extras,
    styleVariant = "default",
  } = input;

  const { easeFactor, flatEase, label } = computeEase(fabricType, 0);

  const effBust = measurements.bust * easeFactor + flatEase;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;

  const quarterBust = effBust / 4;
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;
  const halfBack = effBack / 2;

  const combinedLen =
    (subStyle === "jumpsuit"
      ? measurements.bodiceLength + measurements.crotchDepth + measurements.inseam
      : measurements.bodiceLength + measurements.skirtLength) * lengthMultiplier;

  const isEmpireCut = subStyle === "dress" && styleVariant === "empire_cut";
  const isShirtDress = subStyle === "dress" && styleVariant === "shirt_dress";

  const bodiceLen = isEmpireCut
    ? Math.max(25, Math.round(measurements.bodiceLength * 0.68))
    : bodiceToTotalRatio
      ? Math.max(32, Math.min(54, combinedLen * bodiceToTotalRatio))
      : measurements.bodiceLength;
  const lowerLen = Math.max(35, combinedLen - bodiceLen);

  const neckW = Math.max(6.2, effBust * 0.075);
  const baseNeckDrop =
    necklineStyle === "v_neck"
      ? 14
      : necklineStyle === "square"
        ? 10.5
        : necklineStyle === "high"
          ? 4.2
          : 9.5;
  const frontNeckDrop = necklineDropRatio
    ? Math.max(4.0, bodiceLen * necklineDropRatio)
    : baseNeckDrop;
  const backNeckDrop = 2.6;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const armholeDepth = Math.max(17, effBust * 0.215);

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

  const pieces: PatternPiece[] = [];

  if (subStyle === "dress") {
    const hipDrop = Math.min(20, lowerLen * 0.35);
    const flareDeg =
      skirtFlareStyle === "straight"
        ? 2
        : skirtFlareStyle === "a_line"
          ? 13
          : 24;
    const baseFlare = lowerLen * Math.tan((flareDeg * Math.PI) / 180);
    const flareExtra = Math.min(
      40,
      flareRatio ? baseFlare * 0.5 + lowerLen * flareRatio * 0.35 : baseFlare
    );
    const hemHalfWidth = quarterHip + flareExtra;
    const totalLen = bodiceLen + lowerLen;
    const isWrapFront = Boolean(extras?.wrapFront);
    const wrapOverlap = Math.round(quarterWaist * 0.62);

    const sidePocketNotches = extras?.sidePockets
      ? createSidePocketNotches({
          waistX: quarterWaist,
          waistY: bodiceLen,
          hipX: quarterHip,
          hipY: bodiceLen + hipDrop,
        })
      : [];

    const buildDressPanel = (
      id: string,
      name: string,
      tabLabel: string,
      isFront: boolean
    ) => {
      const neckDrop = isFront ? frontNeckDrop : backNeckDrop;
      const neckStyle = isFront ? necklineStyle : "round";
      const useWrap = isFront && isWrapFront;

      const seam: PathCommand[] = useWrap
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
              cp1y: bodiceLen + hipDrop * 0.35,
              cp2x: quarterHip,
              cp2y: bodiceLen + hipDrop * 0.72,
              x: quarterHip,
              y: bodiceLen + hipDrop,
            },
            { type: "L", x: hemHalfWidth, y: totalLen },
            {
              type: "C",
              cp1x: hemHalfWidth * 0.45,
              cp1y: totalLen + 1.1,
              cp2x: -wrapOverlap * 0.4,
              cp2y: totalLen + 0.6,
              x: -wrapOverlap,
              y: totalLen,
            },
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
            { type: "M", x: 0, y: neckDrop },
            ...buildNecklineCommand(neckW, neckDrop, neckStyle),
            { type: "L", x: shoulderX, y: shoulderSlope },
            {
              type: "C",
              cp1x: shoulderX - (isFront ? 1.5 : 0.6),
              cp1y: armholeDepth * (isFront ? 0.55 : 0.58),
              cp2x: quarterBust * (isFront ? 0.84 : 0.87),
              cp2y: armholeDepth,
              x: quarterBust,
              y: armholeDepth,
            },
            // Exact waist assembly
            { type: "L", x: quarterWaist, y: bodiceLen },
            {
              type: "C",
              cp1x: quarterWaist + (quarterHip - quarterWaist) * 0.45,
              cp1y: bodiceLen + hipDrop * 0.35,
              cp2x: quarterHip,
              cp2y: bodiceLen + hipDrop * 0.72,
              x: quarterHip,
              y: bodiceLen + hipDrop,
            },
            { type: "L", x: hemHalfWidth, y: totalLen },
            {
              type: "C",
              cp1x: hemHalfWidth * 0.65,
              cp1y: totalLen + 1.2,
              cp2x: hemHalfWidth * 0.3,
              cp2y: totalLen + 0.4,
              x: 0,
              y: totalLen,
            },
            { type: "Z" },
          ];

      return normalizePiece(
        {
          id,
          name,
          subtitle: useWrap
            ? "Cortar 2 piezas (Izquierda y Derecha)"
            : "Corpiño + Falda ensamblados",
          tabLabel,
          seamPath: seam,
          grainline: {
            x1: Math.max(4, quarterWaist * 0.45),
            y1: Math.max(neckDrop + 4, 14),
            x2: Math.max(4, quarterWaist * 0.45),
            y2: totalLen - 8,
          },
          notches: [
            {
              x: quarterWaist,
              y: bodiceLen,
              angle: 0,
              label: isEmpireCut ? "Corte bajo busto" : "Cintura",
            },
            { x: quarterHip, y: bodiceLen + hipDrop, angle: 0, label: "Cadera" },
            ...(useWrap
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
            ...sidePocketNotches,
          ],
          labelPos: { x: quarterWaist * 0.48, y: bodiceLen * 0.7 },
          foldLine:
            isFront && !useWrap && !isShirtDress
              ? { x1: 0, y1: neckDrop, x2: 0, y2: totalLen }
              : undefined,
        },
        seamAllowance
      );
    };

    pieces.push(
      buildDressPanel(
        "front",
        isWrapFront
          ? "DELANTERO CRUZADO VESTIDO (x2)"
          : isShirtDress
            ? "DELANTERO CAMISERO (x2)"
            : isEmpireCut
              ? "DELANTERO CORTE IMPERIO (x1 doblez)"
              : "DELANTERO VESTIDO (x1 doblez)",
        isWrapFront ? "Delantero Cruzado" : "Delantero",
        true
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

    if (isShirtDress) {
      pieces.push(
        ...buildShirtDressDetailPieces({
          neckW,
          frontLengthCm: totalLen - frontNeckDrop,
          seamAllowance,
        })
      );
    }

    pieces.push(buildDressPanel("back", "TRASERO VESTIDO (x2)", "Trasero", false));

    if (extras?.hemRuffle) {
      pieces.push(buildHemRufflePiece(hemHalfWidth, lowerLen, seamAllowance).piece);
    }
    if (extras?.sidePockets) {
      pieces.push(buildPocketBagPiece(seamAllowance));
    }
  } else {
    // JUMPSUIT (Enterizo): Corpiño ensamblado con tiro y pierna
    const crotchY = bodiceLen + measurements.crotchDepth;
    const totalLen = crotchY + measurements.inseam;
    const frontCrotchExt = Math.max(4.5, effHip * 0.055);
    const backCrotchExt = Math.max(8.5, effHip * 0.11);
    const halfHem = Math.max(14, measurements.hemWidth / 2);

    const buildJumpsuitPanel = (
      id: string,
      name: string,
      tabLabel: string,
      isFront: boolean
    ) => {
      const neckDrop = isFront ? frontNeckDrop : backNeckDrop;
      const crotchExt = isFront ? frontCrotchExt : backCrotchExt;
      // Center front/back at x = 0; side seam at +x, crotch extension goes to -x
      const seam: PathCommand[] = [
        { type: "M", x: 0, y: neckDrop },
        ...buildNecklineCommand(neckW, neckDrop, isFront ? necklineStyle : "round"),
        { type: "L", x: shoulderX, y: shoulderSlope },
        {
          type: "C",
          cp1x: shoulderX - (isFront ? 1.5 : 0.6),
          cp1y: armholeDepth * 0.56,
          cp2x: quarterBust * 0.85,
          cp2y: armholeDepth,
          x: quarterBust,
          y: armholeDepth,
        },
        { type: "L", x: quarterWaist, y: bodiceLen },
        {
          type: "C",
          cp1x: quarterWaist + (quarterHip - quarterWaist) * 0.5,
          cp1y: bodiceLen + measurements.crotchDepth * 0.4,
          cp2x: quarterHip,
          cp2y: bodiceLen + measurements.crotchDepth * 0.8,
          x: quarterHip,
          y: crotchY,
        },
        { type: "L", x: halfHem, y: totalLen },
        { type: "L", x: -crotchExt * 0.4, y: totalLen },
        { type: "L", x: -crotchExt, y: crotchY },
        {
          type: "C",
          cp1x: -crotchExt * 0.35,
          cp1y: crotchY,
          cp2x: 0,
          cp2y: crotchY - measurements.crotchDepth * 0.3,
          x: 0,
          y: bodiceLen,
        },
        { type: "Z" },
      ];

      return normalizePiece(
        {
          id,
          name,
          subtitle: "Enterizo (Corpiño + Tiro)",
          tabLabel,
          seamPath: seam,
          grainline: {
            x1: quarterWaist * 0.45,
            y1: Math.max(neckDrop + 4, 14),
            x2: quarterWaist * 0.45,
            y2: totalLen - 8,
          },
          notches: [
            { x: quarterWaist, y: bodiceLen, angle: 0, label: "Cintura" },
            { x: quarterHip, y: crotchY, angle: 0, label: "Cadera/Tiro" },
          ],
          labelPos: { x: quarterWaist * 0.48, y: bodiceLen * 0.72 },
        },
        seamAllowance
      );
    };

    pieces.push(
      buildJumpsuitPanel("front", "DELANTERO ENTERIZO (x2)", "Delantero", true),
      buildJumpsuitPanel("back", "TRASERO ENTERIZO (x2)", "Trasero", false)
    );
  }

  // Sleeve matched to armhole perimeter (supports standard or flared sleeve)
  const totalArmhole = frontArmholeLen + backArmholeLen;
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

  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  const subLabels: Record<DressSubStyle, string> = {
    dress: extras?.wrapFront ? "Vestido Cruzado (Envolvente)" : "Vestido Modular",
    jumpsuit: "Enterizo / Mono",
  };

  return {
    category: "dress",
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
