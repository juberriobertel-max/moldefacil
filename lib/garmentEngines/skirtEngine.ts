import {
  FabricType,
  GarmentExtras,
  Measurements,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SkirtSubStyle,
} from "../types";
import {
  computeEase,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import {
  buildHemRufflePiece,
  buildPocketBagPiece,
  buildWaistbandPiece,
  buildWaistTiePiece,
  createSidePocketNotches,
} from "./extrasEngine";

export interface SkirtEngineInput {
  measurements: Measurements;
  subStyle: SkirtSubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  flareRatio?: number;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
  includeWaistband?: boolean;
}

export function generateSkirtPattern(input: SkirtEngineInput): PatternResult {
  const {
    measurements,
    subStyle,
    seamAllowance,
    fabricType,
    flareRatio,
    lengthMultiplier = 1,
    extras,
    includeWaistband = true,
  } = input;
  const { easeFactor, flatEase, label } = computeEase(fabricType, 0);

  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;

  const skirtLen = Math.max(30, measurements.skirtLength * lengthMultiplier);
  const hipDrop = Math.min(20, skirtLen * 0.35);

  const baseAngleDeg =
    subStyle === "straight" ? 1 : subStyle === "a_line" ? 13 : 24;
  const flareExtra = flareRatio
    ? Math.min(42, Math.max(2, skirtLen * flareRatio * 0.45))
    : Math.min(42, skirtLen * Math.tan((baseAngleDeg * Math.PI) / 180));
  const hemHalfWidth =
    subStyle === "straight" ? quarterHip - 1.5 : quarterHip + flareExtra;

  const pocketNotches = extras?.sidePockets
    ? createSidePocketNotches({
        waistX: quarterWaist,
        waistY: 0,
        hipX: quarterHip,
        hipY: hipDrop,
      })
    : [];

  const buildPanel = (
    id: string,
    name: string,
    tabLabel: string,
    isFront: boolean
  ): PatternPiece => {
    const waistDrop = isFront ? 1.5 : 1.0;
    const seam: PathCommand[] = [
      { type: "M", x: 0, y: waistDrop },
      {
        type: "C",
        cp1x: quarterWaist * 0.4,
        cp1y: waistDrop,
        cp2x: quarterWaist * 0.75,
        cp2y: 0.4,
        x: quarterWaist,
        y: 0,
      },
      {
        type: "C",
        cp1x: quarterWaist + (quarterHip - quarterWaist) * 0.45,
        cp1y: hipDrop * 0.35,
        cp2x: quarterHip,
        cp2y: hipDrop * 0.72,
        x: quarterHip,
        y: hipDrop,
      },
      { type: "L", x: hemHalfWidth, y: skirtLen },
      {
        type: "C",
        cp1x: hemHalfWidth * 0.65,
        cp1y: skirtLen + 1.5,
        cp2x: hemHalfWidth * 0.3,
        cp2y: skirtLen + 0.5,
        x: 0,
        y: skirtLen,
      },
      { type: "Z" },
    ];

    return normalizePiece(
      {
        id,
        name,
        subtitle: `Largo: ${skirtLen} cm`,
        tabLabel,
        seamPath: seam,
        grainline: {
          x1: Math.max(4, quarterWaist * 0.45),
          y1: 6,
          x2: Math.max(4, quarterWaist * 0.45),
          y2: skirtLen - 6,
        },
        notches: [
          { x: quarterWaist, y: 0, angle: 0, label: "Cintura" },
          { x: quarterHip, y: hipDrop, angle: 0, label: "Cadera" },
          ...pocketNotches,
        ],
        labelPos: { x: quarterWaist * 0.55, y: skirtLen * 0.45 },
        foldLine: isFront
          ? { x1: 0, y1: waistDrop, x2: 0, y2: skirtLen }
          : undefined,
      },
      seamAllowance
    );
  };

  const pieces = [
    buildPanel("front", "DELANTERO FALDA (x1 doblez)", "Delantero", true),
    buildPanel("back", "TRASERO FALDA (x2)", "Trasero", false),
  ];

  if (includeWaistband) {
    pieces.push(buildWaistbandPiece(effWaist, seamAllowance));
  }
  if (extras?.hemRuffle) {
    pieces.push(buildHemRufflePiece(hemHalfWidth, skirtLen, seamAllowance).piece);
  }
  if (extras?.sidePockets) {
    pieces.push(buildPocketBagPiece(seamAllowance));
  }
  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  const subLabels: Record<SkirtSubStyle, string> = {
    straight: "Falda Recta / Tubo",
    a_line: "Falda Línea A",
    semicircular: "Falda Semicircular / Acampanada",
  };

  return {
    category: "skirt",
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
