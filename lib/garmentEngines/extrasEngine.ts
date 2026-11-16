import {
  GarmentCategory,
  Measurements,
  PathCommand,
  PatternInternalLine,
  PatternNotch,
  PatternPiece,
  QuickLengthPreset,
  SeamAllowance,
  SleeveStyle,
  TorsoFit,
} from "../types";
import { cubicBezierLength, normalizePiece } from "./geometry";
import { solveSleeveCapDimensions } from "../seamValidator";

export const QUICK_LENGTH_LABELS: Record<QuickLengthPreset, string> = {
  photo: "Según medida / foto",
  mini: "Corto (Mini)",
  knee: "A la rodilla",
  midi: "Midi (Media pierna)",
  maxi: "Largo (Tobillo)",
};

export const QUICK_LENGTH_SKIRT_CM: Record<
  Exclude<QuickLengthPreset, "photo">,
  number
> = {
  mini: 42,
  knee: 58,
  midi: 76,
  maxi: 98,
};

export const QUICK_LENGTH_INSEAM_CM: Record<
  Exclude<QuickLengthPreset, "photo">,
  number
> = {
  mini: 16,
  knee: 44,
  midi: 60,
  maxi: 76,
};

/**
 * Resolves effective measurements and whether photo hem truncation should be
 * overridden when a quick garment length preset is active.
 */
export function resolveQuickLength(
  measurements: Measurements,
  preset: QuickLengthPreset,
  category: GarmentCategory
): {
  measurements: Measurements;
  overrideBottomLength: boolean;
  topScaleForLength: number;
} {
  if (preset === "photo") {
    return {
      measurements,
      overrideBottomLength: false,
      topScaleForLength: 1,
    };
  }

  const nextSkirt = QUICK_LENGTH_SKIRT_CM[preset];
  const nextInseam = QUICK_LENGTH_INSEAM_CM[preset];

  const topScaleMap: Record<Exclude<QuickLengthPreset, "photo">, number> = {
    mini: 0.78,
    knee: 1.0,
    midi: 1.12,
    maxi: 1.24,
  };

  return {
    measurements: {
      ...measurements,
      skirtLength: nextSkirt,
      inseam: nextInseam,
    },
    overrideBottomLength: category !== "top",
    topScaleForLength: category === "top" ? topScaleMap[preset] : 1,
  };
}

/**
 * Resolves torso waist half-width based on fitted vs. bloused/loose silhouette.
 * Loose silhouette eliminates inward waist shaping so the side seam runs wide & continuous.
 */
export function computeTorsoWaistHalfWidth(params: {
  quarterBust: number;
  quarterWaist: number;
  quarterHip: number;
  torsoFit?: TorsoFit;
  minExtraOverWaist?: number;
}): number {
  const {
    quarterBust,
    quarterWaist,
    quarterHip,
    torsoFit = "fitted",
    minExtraOverWaist = 0,
  } = params;
  if (torsoFit === "loose") {
    return Math.max(
      quarterBust,
      quarterWaist + 2.5,
      (quarterBust + quarterHip) * 0.49
    );
  }
  return quarterWaist + minExtraOverWaist;
}

/**
 * Shared integrated Kimono / Batwing sleeve geometry (no armhole cutout).
 * Returns identical upper shoulder+sleeve and underarm dolman commands for Front & Back
 * so seam lengths match 100% when sewn together.
 */
export function buildKimonoWingSegment(params: {
  neckW: number;
  shoulderX: number;
  shoulderSlope: number;
  sleeveLengthCm: number;
  armholeDepth: number;
  quarterBust: number;
  sideWaistX: number;
  sideWaistY: number;
  torsoFit?: TorsoFit;
  flaredSleeve?: boolean;
}): {
  commands: PathCommand[];
  outerX: number;
  outerDropY: number;
  outerBotY: number;
  joinX: number;
  joinY: number;
  shoulderSleeveLenCm: number;
  underarmCurveLenCm: number;
} {
  const {
    neckW,
    shoulderX,
    shoulderSlope,
    sleeveLengthCm,
    armholeDepth,
    quarterBust,
    sideWaistX,
    sideWaistY,
    torsoFit = "fitted",
    flaredSleeve = false,
  } = params;

  const shoulderExt = Math.min(34, Math.max(18, sleeveLengthCm * 0.48));
  const outerX = Number((shoulderX + shoulderExt).toFixed(2));
  const shoulderSpan = Math.max(4, outerX - neckW);
  const outerDropY = Number((shoulderSlope + shoulderExt * 0.25).toFixed(2));

  const maxAvail = Math.max(15, sideWaistY - outerDropY - 3);
  const rawOpening =
    Math.max(18, armholeDepth * 0.92) +
    (torsoFit === "loose" ? 2.5 : 0) +
    (flaredSleeve ? 4.0 : 0);
  const cuffOpening = Math.min(maxAvail, rawOpening);
  const outerBotY = Number((outerDropY + cuffOpening).toFixed(2));

  const joinY = Number(
    Math.min(
      sideWaistY - 1,
      Math.max(
        outerBotY + 2,
        armholeDepth + Math.min(13, Math.max(4, (sideWaistY - armholeDepth) * 0.65))
      )
    ).toFixed(2)
  );
  const tJoin = Math.min(
    1,
    Math.max(0, (joinY - armholeDepth) / Math.max(4, sideWaistY - armholeDepth))
  );
  const joinX = Number(
    (quarterBust + (sideWaistX - quarterBust) * tJoin).toFixed(2)
  );

  const shoulderCp1 = {
    x: neckW + shoulderSpan * 0.42,
    y: shoulderSlope * 0.65,
  };
  const shoulderCp2 = {
    x: shoulderX + shoulderExt * 0.35,
    y: shoulderSlope + shoulderExt * 0.1,
  };

  const spanX = Math.max(6, outerX - joinX);
  const spanY = Math.max(2, joinY - outerBotY);
  const underCp1 = {
    x: outerX - spanX * 0.52,
    y: outerBotY + spanY * 0.08,
  };
  const underCp2 = {
    x: joinX + spanX * 0.08,
    y: outerBotY + spanY * 0.45,
  };

  const commands: PathCommand[] = [
    {
      type: "C",
      cp1x: shoulderCp1.x,
      cp1y: shoulderCp1.y,
      cp2x: shoulderCp2.x,
      cp2y: shoulderCp2.y,
      x: outerX,
      y: outerDropY,
    },
    { type: "L", x: outerX, y: outerBotY },
    {
      type: "C",
      cp1x: underCp1.x,
      cp1y: underCp1.y,
      cp2x: underCp2.x,
      cp2y: underCp2.y,
      x: joinX,
      y: joinY,
    },
  ];

  const shoulderSleeveLenCm = Number(
    cubicBezierLength(
      { x: neckW, y: 0 },
      shoulderCp1,
      shoulderCp2,
      { x: outerX, y: outerDropY }
    ).toFixed(1)
  );
  const underarmCurveLenCm = Number(
    cubicBezierLength(
      { x: outerX, y: outerBotY },
      underCp1,
      underCp2,
      { x: joinX, y: joinY }
    ).toFixed(1)
  );

  return {
    commands,
    outerX,
    outerDropY,
    outerBotY,
    joinX,
    joinY,
    shoulderSleeveLenCm,
    underarmCurveLenCm,
  };
}

/**
 * Shared sleeve builder supporting standard sleeves and bell/flared sleeves.
 * Returns null when sleeveless or integrated kimono/batwing is active.
 */
export function buildSleevePiece(params: {
  armholeDepth: number;
  totalArmholePerimeter: number;
  sleeveLengthCm: number;
  sleeveStyle: SleeveStyle;
  flaredSleeve?: boolean;
  seamAllowance: SeamAllowance;
}): PatternPiece | null {
  const {
    armholeDepth,
    totalArmholePerimeter,
    sleeveLengthCm,
    sleeveStyle,
    flaredSleeve = false,
    seamAllowance,
  } = params;

  if (sleeveStyle === "kimono") {
    return null;
  }
  if (sleeveStyle === "sleeveless" && !flaredSleeve) {
    return null;
  }

  const effectiveStyle: Exclude<SleeveStyle, "sleeveless" | "kimono"> =
    sleeveStyle === "sleeveless" ? "short" : sleeveStyle;

  const { capHeight, sleeveWidth, capArcLengthCm, easeCm } =
    solveSleeveCapDimensions(totalArmholePerimeter, armholeDepth, 1.25);
  const halfSleeve = sleeveWidth / 2;
  const sleeveLen =
    effectiveStyle === "short"
      ? Math.min(32, Math.max(20, sleeveLengthCm * 0.42))
      : Math.max(46, sleeveLengthCm);

  let sleeveSeam: PathCommand[];

  if (flaredSleeve) {
    const cuffHalf = Math.max(
      halfSleeve + 5,
      halfSleeve * (effectiveStyle === "long" ? 1.52 : 1.44)
    );
    const bodySpan = Math.max(8, sleeveLen - capHeight);

    sleeveSeam = [
      { type: "M", x: halfSleeve, y: 0 },
      {
        type: "C",
        cp1x: halfSleeve + halfSleeve * 0.44,
        cp1y: 0,
        cp2x: sleeveWidth - halfSleeve * 0.34,
        cp2y: capHeight,
        x: sleeveWidth,
        y: capHeight,
      },
      // Flared outward bell curve on right side
      {
        type: "C",
        cp1x: sleeveWidth + 1.4,
        cp1y: capHeight + bodySpan * 0.45,
        cp2x: halfSleeve + cuffHalf - 1.2,
        cp2y: sleeveLen - bodySpan * 0.18,
        x: halfSleeve + cuffHalf,
        y: sleeveLen,
      },
      // Gently curved bell cuff hem
      {
        type: "C",
        cp1x: halfSleeve + cuffHalf * 0.42,
        cp1y: sleeveLen + 2.2,
        cp2x: halfSleeve - cuffHalf * 0.42,
        cp2y: sleeveLen + 2.2,
        x: halfSleeve - cuffHalf,
        y: sleeveLen,
      },
      // Flared outward bell curve on left side
      {
        type: "C",
        cp1x: halfSleeve - cuffHalf + 1.2,
        cp1y: sleeveLen - bodySpan * 0.18,
        cp2x: -1.4,
        cp2y: capHeight + bodySpan * 0.45,
        x: 0,
        y: capHeight,
      },
      {
        type: "C",
        cp1x: halfSleeve * 0.34,
        cp1y: capHeight,
        cp2x: halfSleeve - halfSleeve * 0.44,
        cp2y: 0,
        x: halfSleeve,
        y: 0,
      },
      { type: "Z" },
    ];
  } else {
    const cuffHalf = Math.max(
      9.5,
      halfSleeve * (effectiveStyle === "long" ? 0.56 : 0.78)
    );
    sleeveSeam = [
      { type: "M", x: halfSleeve, y: 0 },
      {
        type: "C",
        cp1x: halfSleeve + halfSleeve * 0.44,
        cp1y: 0,
        cp2x: sleeveWidth - halfSleeve * 0.34,
        cp2y: capHeight,
        x: sleeveWidth,
        y: capHeight,
      },
      { type: "L", x: halfSleeve + cuffHalf, y: sleeveLen },
      { type: "L", x: halfSleeve - cuffHalf, y: sleeveLen },
      { type: "L", x: 0, y: capHeight },
      {
        type: "C",
        cp1x: halfSleeve * 0.34,
        cp1y: capHeight,
        cp2x: halfSleeve - halfSleeve * 0.44,
        cp2y: 0,
        x: halfSleeve,
        y: 0,
      },
      { type: "Z" },
    ];
  }

  return normalizePiece(
    {
      id: "sleeve",
      name: flaredSleeve
        ? `MANGA ${effectiveStyle === "long" ? "LARGA" : "CORTA"} ACAMPANADA (x2)`
        : `MANGA ${effectiveStyle === "long" ? "LARGA" : "CORTA"} (x2)`,
      subtitle: flaredSleeve
        ? `Caída acampanada | Sisa: ${totalArmholePerimeter.toFixed(1)} cm → Copa: ${capArcLengthCm.toFixed(1)} cm (+${easeCm.toFixed(2)} cm)`
        : `Sisa: ${totalArmholePerimeter.toFixed(1)} cm → Copa: ${capArcLengthCm.toFixed(1)} cm (+${easeCm.toFixed(2)} cm embebido)`,
      tabLabel: flaredSleeve ? "Manga Acampanada" : "Manga",
      seamPath: sleeveSeam,
      grainline: { x1: halfSleeve, y1: 4, x2: halfSleeve, y2: sleeveLen - 4 },
      notches: [{ x: halfSleeve, y: 0, angle: -90, label: "Hombro" }],
      labelPos: { x: halfSleeve, y: sleeveLen * 0.55 },
    },
    seamAllowance
  );
}

/**
 * Generates the matching wrap neckline facing ("Vista de Escote Cruzado")
 * with a clean 4.0 cm finished perpendicular width along the exact crossover V-curve.
 */
export function buildWrapFacingPiece(params: {
  neckW: number;
  shoulderX: number;
  shoulderSlope: number;
  wrapOverlap: number;
  wrapWaistY: number;
  seamAllowance: SeamAllowance;
}): PatternPiece {
  const {
    neckW,
    shoulderX,
    shoulderSlope,
    wrapOverlap,
    wrapWaistY,
    seamAllowance,
  } = params;

  // True perpendicular width of 4.0 cm (+ seamAllowance added by normalizePiece)
  const facingPerpW = 4.0;
  const vx = neckW + wrapOverlap;
  const vy = -wrapWaistY;
  const diagLen = Math.hypot(vx, vy) || 1;
  // Inward unit normal pointing from wrap edge into the body (+x, +y)
  const nx = -vy / diagLen;
  const ny = vx / diagLen;

  const shoulderLen = Math.max(0.1, shoulderX - neckW);
  const shoulderTan = shoulderSlope / shoulderLen;
  const shDeltaX = facingPerpW / Math.max(0.35, nx + shoulderTan * ny);
  const shOutX = Number((neckW + shDeltaX).toFixed(2));
  const shOutY = Number((shDeltaX * shoulderTan).toFixed(2));

  const cp1xOut = -wrapOverlap * 0.35;
  const cp1yOut = wrapWaistY * 0.62;
  const cp2xOut = neckW * 0.55;
  const cp2yOut = wrapWaistY * 0.25;

  const botInX = Number((-wrapOverlap + facingPerpW / Math.max(0.4, nx)).toFixed(2));

  // Outer diagonal matches wrap front edge from (neckW, 0) -> (-wrapOverlap, wrapWaistY)
  const facingSeam: PathCommand[] = [
    { type: "M", x: neckW, y: 0 },
    { type: "L", x: shOutX, y: shOutY },
    // Inner facing edge shifted by +4.0 cm perpendicularly along normal (nx, ny)
    {
      type: "C",
      cp1x: cp2xOut + nx * facingPerpW,
      cp1y: cp2yOut + ny * facingPerpW,
      cp2x: cp1xOut + nx * facingPerpW,
      cp2y: cp1yOut + ny * facingPerpW,
      x: botInX,
      y: wrapWaistY,
    },
    { type: "L", x: -wrapOverlap, y: wrapWaistY },
    // Exact wrap front edge curve back up to shoulder-neck
    {
      type: "C",
      cp1x: cp1xOut,
      cp1y: cp1yOut,
      cp2x: cp2xOut,
      cp2y: cp2yOut,
      x: neckW,
      y: 0,
    },
    { type: "Z" },
  ];

  // Evaluate exact cubic midpoint t=0.5 along outer wrap edge and shift by half of 4.0 cm normal
  const midOutX =
    0.125 * -wrapOverlap + 0.375 * cp1xOut + 0.375 * cp2xOut + 0.125 * neckW;
  const midOutY =
    0.125 * wrapWaistY + 0.375 * cp1yOut + 0.375 * cp2yOut + 0.125 * 0;
  const midX = Number((midOutX + nx * (facingPerpW * 0.5)).toFixed(2));
  const midY = Number((midOutY + ny * (facingPerpW * 0.5)).toFixed(2));
  const labelAngle = Number(((Math.atan2(vy, vx) * 180) / Math.PI).toFixed(1));

  return normalizePiece(
    {
      id: "wrap_facing",
      name: "VISTA DE ESCOTE CRUZADO (x2)",
      subtitle: "Ancho 4 cm | Cortar 2 piezas (Izq. y Der.)",
      tabLabel: "Vista Escote",
      seamPath: facingSeam,
      grainline: {
        x1: midX,
        y1: Math.max(6, midY - 7),
        x2: midX,
        y2: Math.min(wrapWaistY - 3, midY + 7),
      },
      notches: [
        { x: neckW, y: 0, angle: -90, label: "Hombro" },
        { x: -wrapOverlap, y: wrapWaistY, angle: 180, label: "Cruce cintura" },
      ],
      labelPos: { x: midX, y: midY },
      labelAngle,
      labelMaxSpanCm: Number((diagLen * 0.78).toFixed(1)),
      labelBandWidthCm: facingPerpW,
    },
    seamAllowance
  );
}

/**
 * Generates "Tira de Amarre / Cinturón" scaled to waist circumference.
 */
export function buildWaistTiePiece(
  effWaist: number,
  seamAllowance: SeamAllowance
): PatternPiece {
  const tieLength = Math.min(92, Math.max(64, Math.round(effWaist * 0.78 + 24)));
  const tieHeight = 7.0; // Finished folded width ~3.5 cm
  const bevel = 4.0;

  const tieSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: tieLength, y: 0 },
    { type: "L", x: tieLength - bevel, y: tieHeight },
    { type: "L", x: 0, y: tieHeight },
    { type: "Z" },
  ];

  return normalizePiece(
    {
      id: "waist_tie",
      name: "TIRA DE AMARRE / CINTURÓN (x2)",
      subtitle: `Cortar 2 tiras (${tieLength} × ${tieHeight} cm)`,
      tabLabel: "Tira / Cinturón",
      seamPath: tieSeam,
      grainline: {
        x1: 6,
        y1: tieHeight / 2,
        x2: tieLength - 8,
        y2: tieHeight / 2,
      },
      notches: [{ x: 0, y: tieHeight / 2, angle: 180, label: "Unión costado" }],
      labelPos: { x: tieLength * 0.48, y: tieHeight * 0.52 },
      labelAngle: 0,
      labelMaxSpanCm: tieLength - 10,
      labelBandWidthCm: tieHeight,
    },
    seamAllowance
  );
}

/**
 * Generates curved/flounced "Bolero Inferior" that adds to the skirt or dress length.
 */
export function buildHemRufflePiece(
  hemHalfWidth: number,
  lowerGarmentLenCm: number,
  seamAllowance: SeamAllowance
): { piece: PatternPiece; addedLengthCm: number } {
  const ruffleHeight = Math.max(14, Math.min(24, Math.round(lowerGarmentLenCm * 0.24)));
  const halfSpan = Math.min(43, Math.max(26, Math.round(hemHalfWidth * 1.08)));
  const archDrop = 7.5;

  const ruffleSeam: PathCommand[] = [
    { type: "M", x: -halfSpan, y: archDrop },
    {
      type: "C",
      cp1x: -halfSpan * 0.45,
      cp1y: -archDrop * 0.3,
      cp2x: halfSpan * 0.45,
      cp2y: -archDrop * 0.3,
      x: halfSpan,
      y: archDrop,
    },
    { type: "L", x: halfSpan + 3.5, y: archDrop + ruffleHeight },
    {
      type: "C",
      cp1x: halfSpan * 0.45,
      cp1y: archDrop * 0.25 + ruffleHeight,
      cp2x: -halfSpan * 0.45,
      cp2y: archDrop * 0.25 + ruffleHeight,
      x: -halfSpan - 3.5,
      y: archDrop + ruffleHeight,
    },
    { type: "Z" },
  ];

  const piece = normalizePiece(
    {
      id: "hem_ruffle",
      name: "BOLERO INFERIOR (x2)",
      subtitle: `Cortar 2 piezas fruncidas (+${ruffleHeight} cm al largo)`,
      tabLabel: "Bolero Inferior",
      seamPath: ruffleSeam,
      grainline: {
        x1: 0,
        y1: 2.5,
        x2: 0,
        y2: ruffleHeight + 1.5,
      },
      notches: [
        { x: 0, y: 0.4, angle: -90, label: "Centro (fruncir)" },
        { x: 0, y: ruffleHeight + 2.8, angle: 90, label: "Ruedo" },
      ],
      labelPos: { x: 0, y: archDrop + ruffleHeight * 0.42 },
    },
    seamAllowance
  );

  return { piece, addedLengthCm: ruffleHeight };
}

/**
 * Generates ergonomic side-seam "Bolsa de Bolsillo" ("Cortar 4 piezas").
 */
export function buildPocketBagPiece(seamAllowance: SeamAllowance): PatternPiece {
  const bagW = 18;
  const openingH = 14.5;
  const totalH = 26;

  const pocketSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: bagW * 0.65, y: 0 },
    {
      type: "C",
      cp1x: bagW * 0.95,
      cp1y: 1.5,
      cp2x: bagW,
      cp2y: 6,
      x: bagW,
      y: openingH + 2,
    },
    {
      type: "C",
      cp1x: bagW,
      cp1y: totalH - 2,
      cp2x: bagW * 0.55,
      cp2y: totalH,
      x: bagW * 0.32,
      y: totalH,
    },
    {
      type: "C",
      cp1x: 1.5,
      cp1y: totalH,
      cp2x: 0,
      cp2y: openingH + 5,
      x: 0,
      y: openingH,
    },
    { type: "L", x: 0, y: 0 },
    { type: "Z" },
  ];

  return normalizePiece(
    {
      id: "pocket_bag",
      name: "BOLSA DE BOLSILLO (x4)",
      subtitle: "Cortar 4 piezas",
      tabLabel: "Bolsa de Bolsillo",
      seamPath: pocketSeam,
      grainline: {
        x1: bagW * 0.48,
        y1: 3,
        x2: bagW * 0.48,
        y2: totalH - 4,
      },
      notches: [
        { x: 0, y: 0.5, angle: 180, label: "Bolsillo sup." },
        { x: 0, y: openingH, angle: 180, label: "Bolsillo inf." },
      ],
      labelPos: { x: bagW * 0.52, y: totalH * 0.46 },
    },
    seamAllowance
  );
}

/**
 * Computes two side-seam pocket notches interpolated between waist and hip.
 */
export function createSidePocketNotches(params: {
  waistX: number;
  waistY: number;
  hipX: number;
  hipY: number;
  angle?: number;
}): PatternNotch[] {
  const { waistX, waistY, hipX, hipY, angle = 0 } = params;
  const spanY = Math.max(12, hipY - waistY);
  const topT = Math.min(0.32, 4 / spanY);
  const botT = Math.min(0.92, (4 + 14) / spanY);
  const lerpX = (t: number) => Number((waistX + (hipX - waistX) * t).toFixed(2));
  const lerpY = (t: number) => Number((waistY + (hipY - waistY) * t).toFixed(2));

  return [
    { x: lerpX(topT), y: lerpY(topT), angle, label: "Bolsillo sup." },
    { x: lerpX(botT), y: lerpY(botT), angle, label: "Bolsillo inf." },
  ];
}

/**
 * Shared waistband ("Pretina") piece scaled to waist circumference + 4 cm overlap.
 */
export function buildWaistbandPiece(
  effWaist: number,
  seamAllowance: SeamAllowance
): PatternPiece {
  const waistbandLength = Number((effWaist + 4).toFixed(1));
  const waistbandHeight = 8;
  const waistbandSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: waistbandLength, y: 0 },
    { type: "L", x: waistbandLength, y: waistbandHeight },
    { type: "L", x: 0, y: waistbandHeight },
    { type: "Z" },
  ];

  return normalizePiece(
    {
      id: "waistband",
      name: "PRETINA (x1)",
      subtitle: `${waistbandLength} × ${waistbandHeight} cm (incluye 4 cm cruce)`,
      tabLabel: "Pretina",
      seamPath: waistbandSeam,
      grainline: {
        x1: 4,
        y1: waistbandHeight / 2,
        x2: waistbandLength - 4,
        y2: waistbandHeight / 2,
      },
      notches: [
        { x: 4, y: 0, angle: -90, label: "Cruce" },
        { x: waistbandLength / 2, y: 0, angle: -90, label: "Centro" },
      ],
      labelPos: { x: waistbandLength / 2, y: waistbandHeight * 0.52 },
      labelAngle: 0,
      labelMaxSpanCm: waistbandLength - 8,
      labelBandWidthCm: waistbandHeight,
    },
    seamAllowance
  );
}

/**
 * Generates shirt collar ("Cuello Camisero") and front button placket ("Vista de Botones")
 * for shirt dresses and collared button-down garments.
 */
export function buildShirtDressDetailPieces(params: {
  neckW: number;
  frontLengthCm: number;
  seamAllowance: SeamAllowance;
}): PatternPiece[] {
  const { neckW, frontLengthCm, seamAllowance } = params;
  const halfCollar = Math.round(neckW * 2.95);
  const collarH = 7.5;
  const collarSeam: PathCommand[] = [
    { type: "M", x: 0, y: 1.8 },
    {
      type: "C",
      cp1x: halfCollar * 0.4,
      cp1y: 1.5,
      cp2x: halfCollar * 0.75,
      cp2y: 0.6,
      x: halfCollar,
      y: 0,
    },
    { type: "L", x: halfCollar + 2.5, y: collarH + 1.2 },
    {
      type: "C",
      cp1x: halfCollar * 0.65,
      cp1y: collarH + 0.5,
      cp2x: halfCollar * 0.3,
      cp2y: collarH + 0.2,
      x: 0,
      y: collarH,
    },
    { type: "Z" },
  ];

  const collarPiece = normalizePiece(
    {
      id: "shirt_collar",
      name: "CUELLO CAMISERO (x2)",
      subtitle: "Cortar 2 piezas (entretela x1)",
      tabLabel: "Cuello Camisero",
      seamPath: collarSeam,
      grainline: { x1: 3, y1: collarH * 0.55, x2: halfCollar - 2, y2: collarH * 0.55 },
      notches: [{ x: 0, y: collarH, angle: 90, label: "Centro cuello" }],
      labelPos: { x: halfCollar * 0.48, y: collarH * 0.58 },
      labelAngle: 0,
      labelMaxSpanCm: halfCollar - 3,
      labelBandWidthCm: collarH,
      foldLine: { x1: 0, y1: 1.8, x2: 0, y2: collarH },
    },
    seamAllowance
  );

  const placketW = 4.5;
  const placketLen = Math.round(frontLengthCm);
  const placketSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: placketW, y: 0 },
    { type: "L", x: placketW, y: placketLen },
    { type: "L", x: 0, y: placketLen },
    { type: "Z" },
  ];

  const placketPiece = normalizePiece(
    {
      id: "button_placket",
      name: "VISTA DE BOTONES (x2)",
      subtitle: `Cortar 2 piezas (${placketW} × ${placketLen} cm)`,
      tabLabel: "Vista Botones",
      seamPath: placketSeam,
      grainline: { x1: placketW / 2, y1: 6, x2: placketW / 2, y2: placketLen - 6 },
      notches: [
        { x: placketW / 2, y: 12, angle: 0, label: "Botón 1" },
        { x: placketW / 2, y: Math.round(placketLen * 0.35), angle: 0, label: "Botón 2" },
        { x: placketW / 2, y: Math.round(placketLen * 0.58), angle: 0, label: "Botón 3" },
      ],
      labelPos: { x: placketW / 2, y: placketLen * 0.48 },
      labelAngle: -90,
      labelMaxSpanCm: placketLen - 8,
      labelBandWidthCm: placketW,
    },
    seamAllowance
  );

  return [collarPiece, placketPiece];
}

/**
 * Generates an elongated diamond vertical waist dart ("pinza vertical de entalle")
 * inside Front and Back tailored pieces for structured shaping.
 */
export function buildVerticalWaistDart(params: {
  centerX: number;
  topY: number;
  waistY: number;
  botY: number;
  halfWidthCm?: number;
  label?: string;
}): PatternInternalLine {
  const {
    centerX,
    topY,
    waistY,
    botY,
    halfWidthCm = 1.4,
    label = "Pinza entalle",
  } = params;
  const cx = Number(centerX.toFixed(2));
  const ty = Number(topY.toFixed(2));
  const wy = Number(waistY.toFixed(2));
  const by = Number(botY.toFixed(2));

  return {
    commands: [
      { type: "M", x: cx, y: ty },
      { type: "L", x: cx + halfWidthCm, y: wy },
      { type: "L", x: cx, y: by },
      { type: "L", x: cx - halfWidthCm, y: wy },
      { type: "Z" },
      { type: "M", x: cx, y: ty },
      { type: "L", x: cx, y: by },
    ],
    style: "dart",
    label,
    labelPos: { x: cx, y: wy },
  };
}

/**
 * Builds notched lapel & button-overlap front contour + break line + button notches
 * for Blazer / Chaqueta / Solapa Sastre patterns.
 */
export function buildTailoredLapelFrontGeometry(params: {
  neckW: number;
  frontNeckDrop: number;
  armholeDepth: number;
  bodiceLen: number;
  totalLen: number;
}): {
  buttonOverlap: number;
  breakY: number;
  gorgeX: number;
  gorgeY: number;
  lapelPeakX: number;
  lapelPeakY: number;
  lapelNotchInX: number;
  lapelNotchInY: number;
  closingCommands: PathCommand[];
  internalLines: PatternInternalLine[];
  notches: PatternNotch[];
} {
  const { neckW, frontNeckDrop, armholeDepth, bodiceLen, totalLen } = params;
  const buttonOverlap = 2.8;
  const breakY = Number(
    Math.min(totalLen - 10, Math.max(armholeDepth + 4, bodiceLen * 0.84)).toFixed(2)
  );
  const gorgeX = Number((neckW * 0.45).toFixed(2));
  const gorgeY = Number(Math.max(4.5, frontNeckDrop * 0.48).toFixed(2));
  const lapelPeakX = Number((-(buttonOverlap + 5.6)).toFixed(2));
  const lapelPeakY = Number((gorgeY + 2.4).toFixed(2));
  const lapelNotchInX = Number((-(buttonOverlap + 1.8)).toFixed(2));
  const lapelNotchInY = Number((gorgeY + 0.8).toFixed(2));
  const collarNotchOutX = Number((-(buttonOverlap + 3.4)).toFixed(2));
  const collarNotchOutY = Number((Math.max(1.2, gorgeY - 1.2)).toFixed(2));

  // Goes from hem -> front overlap edge -> break point -> notched lapel -> neck point (neckW, 0)
  const closingCommands: PathCommand[] = [
    { type: "L", x: -buttonOverlap, y: totalLen },
    { type: "L", x: -buttonOverlap, y: breakY },
    { type: "L", x: lapelPeakX, y: lapelPeakY },
    { type: "L", x: lapelNotchInX, y: lapelNotchInY },
    { type: "L", x: collarNotchOutX, y: collarNotchOutY },
    { type: "L", x: gorgeX, y: gorgeY },
    { type: "L", x: neckW, y: 0 },
  ];

  const internalLines: PatternInternalLine[] = [
    {
      commands: [
        { type: "M", x: Number((neckW - 1.2).toFixed(2)), y: 0.4 },
        { type: "L", x: -buttonOverlap, y: breakY },
      ],
      style: "fold",
      label: "Línea de quiebre",
      labelPos: {
        x: Number(((neckW - buttonOverlap) * 0.45).toFixed(2)),
        y: Number((breakY * 0.5).toFixed(2)),
      },
    },
    {
      commands: [
        { type: "M", x: 0, y: breakY },
        { type: "L", x: 0, y: totalLen },
      ],
      style: "mark",
      label: "Centro",
      labelPos: { x: 0.8, y: Number(((breakY + totalLen) * 0.5).toFixed(2)) },
    },
  ];

  const button2Y = Number(
    Math.min(totalLen - 5, breakY + Math.max(8, (totalLen - breakY) * 0.42)).toFixed(1)
  );
  const notches: PatternNotch[] = [
    { x: 0, y: breakY, angle: 180, label: "Quiebre / Botón 1" },
    { x: 0, y: button2Y, angle: 180, label: "Botón 2" },
  ];

  return {
    buttonOverlap,
    breakY,
    gorgeX,
    gorgeY,
    lapelPeakX,
    lapelPeakY,
    lapelNotchInX,
    lapelNotchInY,
    closingCommands,
    internalLines,
    notches,
  };
}

/**
 * Builds Upper Tailored Collar, Under Tailored Collar, and Lapel Facing pieces
 * for Chaqueta / Blazer and Solapa Sastre garments.
 */
export function buildTailoredCollarAndFacingPieces(params: {
  neckW: number;
  shoulderX: number;
  shoulderSlope: number;
  frontNeckDrop: number;
  armholeDepth: number;
  bodiceLen: number;
  totalLen: number;
  seamAllowance: SeamAllowance;
}): PatternPiece[] {
  const {
    neckW,
    shoulderX,
    shoulderSlope,
    frontNeckDrop,
    armholeDepth,
    bodiceLen,
    totalLen,
    seamAllowance,
  } = params;

  const halfCollar = Number(Math.max(18, neckW * 3.1).toFixed(1));
  const collarH = 7.8;

  const buildCollar = (isUpper: boolean): PatternPiece => {
    const scaleDelta = isUpper ? 0 : -0.35;
    const h = Number((collarH + scaleDelta).toFixed(2));
    const tipX = Number((halfCollar + 2.8 + scaleDelta).toFixed(2));
    const seam: PathCommand[] = [
      { type: "M", x: 0, y: 1.6 },
      {
        type: "C",
        cp1x: halfCollar * 0.42,
        cp1y: 1.4,
        cp2x: halfCollar * 0.78,
        cp2y: 0.6,
        x: halfCollar,
        y: 0,
      },
      { type: "L", x: tipX, y: h + 1.1 },
      {
        type: "C",
        cp1x: halfCollar * 0.68,
        cp1y: h + 0.5,
        cp2x: halfCollar * 0.32,
        cp2y: h + 0.15,
        x: 0,
        y: h,
      },
      { type: "Z" },
    ];

    return normalizePiece(
      {
        id: isUpper ? "tailored_collar_top" : "tailored_collar_under",
        name: isUpper
          ? "CUELLO SASTRE SUPERIOR (x1 doblez)"
          : "CUELLO SASTRE INFERIOR (x1 doblez)",
        subtitle: isUpper
          ? "Cortar 1 pieza al doblez (tela exterior)"
          : "Cortar 1 pieza al doblez (bajo cuello / entretela)",
        tabLabel: isUpper ? "Cuello Sup." : "Cuello Inf.",
        seamPath: seam,
        grainline: { x1: 3, y1: h * 0.56, x2: halfCollar - 2, y2: h * 0.56 },
        notches: [
          { x: 0, y: h, angle: 90, label: "Centro espalda" },
          { x: halfCollar * 0.52, y: 1.0, angle: -90, label: "Hombro" },
        ],
        internalLines: [
          {
            commands: [
              { type: "M", x: 0, y: 3.1 },
              { type: "L", x: halfCollar + 0.8, y: 2.3 },
            ],
            style: "fold",
            label: "Quiebre cuello",
            labelPos: { x: halfCollar * 0.5, y: 2.7 },
          },
        ],
        labelPos: { x: halfCollar * 0.5, y: h * 0.58 },
        labelAngle: 0,
        labelMaxSpanCm: halfCollar - 3,
        labelBandWidthCm: h,
        foldLine: { x1: 0, y1: 1.6, x2: 0, y2: h },
      },
      seamAllowance
    );
  };

  // Vista de Solapa matching exact lapel contour + 5.5 cm interior facing width
  const lapel = buildTailoredLapelFrontGeometry({
    neckW,
    frontNeckDrop,
    armholeDepth,
    bodiceLen,
    totalLen,
  });
  const facingInnerW = 5.5;
  const shDist = Math.max(4, shoulderX - neckW);
  const shFaceT = Math.min(0.65, 4.5 / shDist);
  const shFaceX = Number((neckW + shDist * shFaceT).toFixed(2));
  const shFaceY = Number((shoulderSlope * shFaceT).toFixed(2));

  const facingSeam: PathCommand[] = [
    { type: "M", x: neckW, y: 0 },
    { type: "L", x: shFaceX, y: shFaceY },
    {
      type: "C",
      cp1x: facingInnerW + 2.5,
      cp1y: armholeDepth * 0.55,
      cp2x: facingInnerW,
      cp2y: bodiceLen * 0.72,
      x: facingInnerW,
      y: totalLen,
    },
    ...lapel.closingCommands,
    { type: "Z" },
  ];

  const lapelFacingPiece = normalizePiece(
    {
      id: "lapel_facing",
      name: "VISTA DE SOLAPA (x2)",
      subtitle: "Cortar 2 piezas (aplicar entretela)",
      tabLabel: "Vista de Solapa",
      seamPath: facingSeam,
      grainline: {
        x1: 1.2,
        y1: Math.max(8, lapel.gorgeY + 5),
        x2: 1.2,
        y2: totalLen - 6,
      },
      notches: [
        { x: neckW, y: 0, angle: -90, label: "Hombro" },
        { x: -lapel.buttonOverlap, y: lapel.breakY, angle: 180, label: "Quiebre" },
      ],
      labelPos: { x: 1.2, y: totalLen * 0.56 },
      labelAngle: -90,
      labelMaxSpanCm: Math.max(16, totalLen - 14),
      labelBandWidthCm: facingInnerW + lapel.buttonOverlap,
    },
    seamAllowance
  );

  return [buildCollar(true), buildCollar(false), lapelFacingPiece];
}

/**
 * Generates rectangular flap pocket placement outline for front pattern pieces.
 */
export function createFlapPocketMarkLine(params: {
  xStart: number;
  yTop: number;
  widthCm?: number;
}): PatternInternalLine {
  const { xStart, yTop, widthCm = 13.5 } = params;
  const x1 = Number(xStart.toFixed(2));
  const x2 = Number((xStart + widthCm).toFixed(2));
  const y1 = Number(yTop.toFixed(2));
  const y2 = Number((yTop + 2.0).toFixed(2));

  return {
    commands: [
      { type: "M", x: x1, y: y1 },
      { type: "L", x: x2, y: y1 },
      { type: "L", x: x2, y: y2 },
      { type: "L", x: x1, y: y2 },
      { type: "Z" },
    ],
    style: "mark",
    label: "Bolsillo con solapa",
    labelPos: { x: Number(((x1 + x2) / 2).toFixed(2)), y: y2 + 1.8 },
  };
}

/**
 * Generates Tapeta/Solapa de Bolsillo (x2) and Bolsa de Bolsillo Sastre (x4).
 */
export function buildFlapPocketPieces(
  seamAllowance: SeamAllowance
): PatternPiece[] {
  const pocketW = 14.5;
  const flapH = 5.2;
  const bevel = 0.8;

  const flapSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: pocketW, y: 0 },
    { type: "L", x: pocketW, y: flapH - bevel },
    { type: "L", x: pocketW - bevel, y: flapH },
    { type: "L", x: bevel, y: flapH },
    { type: "L", x: 0, y: flapH - bevel },
    { type: "Z" },
  ];

  const flapPiece = normalizePiece(
    {
      id: "pocket_flap",
      name: "SOLAPA DE BOLSILLO (x2)",
      subtitle: `Cortar 4 telas (2 pares) | ${pocketW} × ${flapH} cm`,
      tabLabel: "Solapa Bolsillo",
      seamPath: flapSeam,
      grainline: { x1: 2, y1: flapH * 0.5, x2: pocketW - 2, y2: flapH * 0.5 },
      notches: [{ x: pocketW / 2, y: 0, angle: -90, label: "Centro tapeta" }],
      labelPos: { x: pocketW / 2, y: flapH * 0.54 },
      labelAngle: 0,
      labelMaxSpanCm: pocketW - 2,
      labelBandWidthCm: flapH,
    },
    seamAllowance
  );

  const bagH = 16.5;
  const bagSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: pocketW, y: 0 },
    { type: "L", x: pocketW, y: bagH - 2.5 },
    {
      type: "C",
      cp1x: pocketW,
      cp1y: bagH,
      cp2x: pocketW * 0.72,
      cp2y: bagH,
      x: pocketW * 0.5,
      y: bagH,
    },
    {
      type: "C",
      cp1x: pocketW * 0.28,
      cp1y: bagH,
      cp2x: 0,
      cp2y: bagH,
      x: 0,
      y: bagH - 2.5,
    },
    { type: "Z" },
  ];

  const bagPiece = normalizePiece(
    {
      id: "flap_pocket_bag",
      name: "BOLSA BOLSILLO SASTRE (x4)",
      subtitle: `Cortar 4 piezas | ${pocketW} × ${bagH} cm`,
      tabLabel: "Bolsa Solapa",
      seamPath: bagSeam,
      grainline: { x1: pocketW / 2, y1: 2.5, x2: pocketW / 2, y2: bagH - 2.5 },
      notches: [{ x: pocketW / 2, y: 0, angle: -90, label: "Boca bolsillo" }],
      labelPos: { x: pocketW / 2, y: bagH * 0.5 },
      labelAngle: 0,
      labelMaxSpanCm: pocketW - 2,
      labelBandWidthCm: bagH,
    },
    seamAllowance
  );

  return [flapPiece, bagPiece];
}
