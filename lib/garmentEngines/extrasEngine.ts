import {
  FabricType,
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
import {
  buildNecklineCommand,
  commandsArcLength,
  cubicBezierLength,
  findCubicBezierTForY,
  normalizePiece,
  splitCubicBezier,
} from "./geometry";
import {
  computeAsymmetricSleeveCapArcLengthCm,
  getTargetCapEaseRange,
  solveSleeveCapDimensions,
} from "../seamValidator";

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
 * Shared sleeve builder supporting asymmetric ergonomic caps, bell/flared sleeves,
 * shirt cuffs & sleeve plackets, and fabric-aware sleeve cap ease.
 */
export function buildSleevePiece(params: {
  armholeDepth: number;
  totalArmholePerimeter: number;
  sleeveLengthCm: number;
  sleeveStyle: SleeveStyle;
  flaredSleeve?: boolean;
  seamAllowance: SeamAllowance;
  fabricType?: FabricType;
  garmentKind?: "tshirt" | "blouse" | "jacket";
  bicepCm?: number;
  wristCm?: number;
  withShirtCuff?: boolean;
}): PatternPiece | null {
  const {
    armholeDepth,
    totalArmholePerimeter,
    sleeveLengthCm,
    sleeveStyle,
    flaredSleeve = false,
    seamAllowance,
    fabricType = "woven",
    garmentKind = "blouse",
    bicepCm,
    wristCm,
    withShirtCuff = false,
  } = params;

  if (sleeveStyle === "kimono") {
    return null;
  }
  if (sleeveStyle === "sleeveless" && !flaredSleeve) {
    return null;
  }

  const effectiveStyle: "short" | "long" =
    sleeveStyle === "sleeveless"
      ? "short"
      : sleeveStyle === "raglan"
        ? "long"
        : sleeveStyle;

  const easeSpec = getTargetCapEaseRange(fabricType, garmentKind);
  const minBicepW = bicepCm ? bicepCm + (fabricType === "stretch" ? 1.5 : 4.5) : 0;
  const { capHeight, sleeveWidth, capArcLengthCm, easeCm, apexX } =
    solveSleeveCapDimensions(
      totalArmholePerimeter,
      armholeDepth,
      easeSpec.target,
      [easeSpec.min, easeSpec.max],
      minBicepW
    );
  const halfSleeve = sleeveWidth / 2;
  const cuffAllowanceDrop = withShirtCuff && effectiveStyle === "long" && !flaredSleeve ? 5.0 : 0;
  const sleeveLen =
    effectiveStyle === "short"
      ? Math.min(32, Math.max(20, sleeveLengthCm * 0.42))
      : Math.max(42, sleeveLengthCm - cuffAllowanceDrop);

  // Sample front (left) and back (right) cap notches accurately on asymmetric curves
  const backLowerNotchX = Number((apexX + (sleeveWidth - apexX) * 0.52).toFixed(2));
  const backLowerNotchY = Number((capHeight * 0.56).toFixed(2));
  const frontLowerNotchX = Number((apexX * 0.45).toFixed(2));
  const frontLowerNotchY = Number((capHeight * 0.6).toFixed(2));

  let sleeveSeam: PathCommand[];
  const internalLines: PatternInternalLine[] = [];
  const extraNotches: PatternNotch[] = [];

  if (flaredSleeve) {
    const cuffHalf = Math.max(
      halfSleeve + 5,
      halfSleeve * (effectiveStyle === "long" ? 1.52 : 1.44)
    );
    const bodySpan = Math.max(8, sleeveLen - capHeight);

    sleeveSeam = [
      { type: "M", x: apexX, y: 0 },
      {
        type: "C",
        cp1x: apexX + (sleeveWidth - apexX) * 0.48,
        cp1y: 0,
        cp2x: sleeveWidth - (sleeveWidth - apexX) * 0.3,
        cp2y: capHeight,
        x: sleeveWidth,
        y: capHeight,
      },
      {
        type: "C",
        cp1x: sleeveWidth + 1.4,
        cp1y: capHeight + bodySpan * 0.45,
        cp2x: halfSleeve + cuffHalf - 1.2,
        cp2y: sleeveLen - bodySpan * 0.18,
        x: halfSleeve + cuffHalf,
        y: sleeveLen,
      },
      {
        type: "C",
        cp1x: halfSleeve + cuffHalf * 0.42,
        cp1y: sleeveLen + 2.2,
        cp2x: halfSleeve - cuffHalf * 0.42,
        cp2y: sleeveLen + 2.2,
        x: halfSleeve - cuffHalf,
        y: sleeveLen,
      },
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
        cp1x: apexX * 0.38,
        cp1y: capHeight * 1.04,
        cp2x: apexX - apexX * 0.4,
        cp2y: 0,
        x: apexX,
        y: 0,
      },
      { type: "Z" },
    ];
  } else {
    const baseWristHalf = wristCm
      ? (wristCm + (withShirtCuff ? 5.5 : 3.5)) / 2
      : halfSleeve * (effectiveStyle === "long" ? 0.58 : 0.78);
    const cuffHalf = Math.max(9.5, Math.min(halfSleeve - 1, baseWristHalf));
    const rightHemX = Number((halfSleeve + cuffHalf).toFixed(2));
    const leftHemX = Number((halfSleeve - cuffHalf).toFixed(2));

    sleeveSeam = [
      { type: "M", x: apexX, y: 0 },
      {
        type: "C",
        cp1x: apexX + (sleeveWidth - apexX) * 0.48,
        cp1y: 0,
        cp2x: sleeveWidth - (sleeveWidth - apexX) * 0.3,
        cp2y: capHeight,
        x: sleeveWidth,
        y: capHeight,
      },
      { type: "L", x: rightHemX, y: sleeveLen },
      { type: "L", x: leftHemX, y: sleeveLen },
      { type: "L", x: 0, y: capHeight },
      {
        type: "C",
        cp1x: apexX * 0.38,
        cp1y: capHeight * 1.04,
        cp2x: apexX - apexX * 0.4,
        cp2y: 0,
        x: apexX,
        y: 0,
      },
      { type: "Z" },
    ];

    if (withShirtCuff && effectiveStyle === "long") {
      // Back-quarter placket slit + pleat tuck marks on wrist
      const placketX = Number((halfSleeve + cuffHalf * 0.5).toFixed(2));
      internalLines.push({
        commands: [
          { type: "M", x: placketX, y: sleeveLen },
          { type: "L", x: placketX, y: sleeveLen - 10 },
        ],
        style: "mark",
        label: "Abertura portañuela",
        labelPos: { x: placketX, y: sleeveLen - 5.5 },
      });
      extraNotches.push(
        { x: Number((placketX - 2.2).toFixed(2)), y: sleeveLen, angle: 90, label: "Pliegue" },
        { x: Number((placketX - 4.0).toFixed(2)), y: sleeveLen, angle: 90 }
      );
    }
  }

  return normalizePiece(
    {
      id: "sleeve",
      name: flaredSleeve
        ? `MANGA ${effectiveStyle === "long" ? "LARGA" : "CORTA"} ACAMPANADA (x2)`
        : `MANGA ${effectiveStyle === "long" ? "LARGA" : "CORTA"} (x2)`,
      subtitle: flaredSleeve
        ? `Copa asimétrica | Sisa: ${totalArmholePerimeter.toFixed(1)} cm → Copa: ${capArcLengthCm.toFixed(1)} cm (+${easeCm.toFixed(2)} cm)`
        : `Sisa: ${totalArmholePerimeter.toFixed(1)} cm → Copa: ${capArcLengthCm.toFixed(1)} cm (+${easeCm.toFixed(2)} cm embebido)`,
      tabLabel: flaredSleeve ? "Manga Acampanada" : "Manga",
      seamPath: sleeveSeam,
      grainline: { x1: apexX, y1: 4, x2: apexX, y2: sleeveLen - 4 },
      notches: [
        { x: apexX, y: 0, angle: -90, label: "Hombro" },
        { x: frontLowerNotchX, y: frontLowerNotchY, angle: 135, label: "Del.", count: 1 },
        { x: backLowerNotchX, y: backLowerNotchY, angle: -45, label: "Esp.", count: 2 },
        ...extraNotches,
      ],
      internalLines: internalLines.length > 0 ? internalLines : undefined,
      labelPos: { x: halfSleeve, y: sleeveLen * 0.55 },
      edgeAllowances: {
        0: "curve",
        1: "seam",
        2: withShirtCuff || flaredSleeve ? "seam" : "hem",
        3: "seam",
        4: "curve",
      },
      cutQuantity: 2,
      seamAnchors: {
        sleeveCap: capArcLengthCm,
        sleeveCapTargetEase: [easeSpec.min, easeSpec.max],
      },
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
 * Shared waistband ("Pretina") piece scaled to waist circumference + 4 cm overlap,
 * including fold line, button/buttonhole marks, interfacing note, and optional contoured shape.
 */
export function buildWaistbandPiece(
  effWaist: number,
  seamAllowance: SeamAllowance,
  options?: { contoured?: boolean; id?: string }
): PatternPiece {
  const waistbandLength = Number((effWaist + 4).toFixed(1));
  const waistbandHeight = 8;
  const contoured = Boolean(options?.contoured);
  const archDrop = contoured ? 2.4 : 0;

  const waistbandSeam: PathCommand[] = contoured
    ? [
        { type: "M", x: 0, y: archDrop },
        {
          type: "C",
          cp1x: waistbandLength * 0.33,
          cp1y: 0,
          cp2x: waistbandLength * 0.67,
          cp2y: 0,
          x: waistbandLength,
          y: archDrop,
        },
        { type: "L", x: waistbandLength, y: waistbandHeight + archDrop },
        {
          type: "C",
          cp1x: waistbandLength * 0.67,
          cp1y: waistbandHeight,
          cp2x: waistbandLength * 0.33,
          cp2y: waistbandHeight,
          x: 0,
          y: waistbandHeight + archDrop,
        },
        { type: "Z" },
      ]
    : [
        { type: "M", x: 0, y: 0 },
        { type: "L", x: waistbandLength, y: 0 },
        { type: "L", x: waistbandLength, y: waistbandHeight },
        { type: "L", x: 0, y: waistbandHeight },
        { type: "Z" },
      ];

  const midFoldY = Number((waistbandHeight / 2 + archDrop * 0.35).toFixed(2));

  return normalizePiece(
    {
      id: options?.id ?? "waistband",
      name: contoured ? "PRETINA ANATÓMICA (x2 + Entretela)" : "PRETINA RECTA (x1 + Entretela)",
      subtitle: `${effWaist.toFixed(1)} cm útiles + 4 cm cruce | Cortar ${contoured ? "2" : "1"} + Entretela`,
      tabLabel: contoured ? "Pretina Anatómica" : "Pretina",
      seamPath: waistbandSeam,
      grainline: {
        x1: 5,
        y1: midFoldY,
        x2: waistbandLength - 5,
        y2: midFoldY,
      },
      notches: [
        { x: 4, y: archDrop, angle: -90, label: "Fin cruce" },
        { x: waistbandLength / 2, y: 0, angle: -90, label: "Centro esp." },
      ],
      internalLines: [
        {
          commands: [
            { type: "M", x: 0, y: midFoldY },
            { type: "L", x: waistbandLength, y: midFoldY },
          ],
          style: "fold",
          label: "Doblez central",
          labelPos: { x: waistbandLength * 0.32, y: midFoldY - 0.6 },
        },
        {
          commands: [
            { type: "M", x: 2.0, y: midFoldY * 0.5 },
            { type: "L", x: 2.0, y: midFoldY * 0.5 + 0.1 },
          ],
          style: "button",
        },
        {
          commands: [
            { type: "M", x: waistbandLength - 2.6, y: midFoldY * 0.5 },
            { type: "L", x: waistbandLength - 1.2, y: midFoldY * 0.5 },
          ],
          style: "buttonhole",
        },
      ],
      labelPos: { x: waistbandLength / 2, y: midFoldY + 1.8 },
      labelAngle: 0,
      labelMaxSpanCm: waistbandLength - 8,
      labelBandWidthCm: waistbandHeight,
      cutQuantity: contoured ? 2 : 1,
      interfacingQuantity: 1,
      seamAnchors: { waistband: Number(effWaist.toFixed(2)) },
    },
    seamAllowance
  );
}

/**
 * Generates real 2-piece shirt collar (Stand/Tirilla + Upper Collar Leaf) synced to exact neckline
 * perimeter plus front button placket ("Vista de Botones").
 */
export function buildShirtDressDetailPieces(params: {
  neckW: number;
  frontLengthCm: number;
  seamAllowance: SeamAllowance;
  totalHalfNeckPerimeter?: number;
}): PatternPiece[] {
  const { neckW, frontLengthCm, seamAllowance, totalHalfNeckPerimeter } = params;
  const halfNeck = Number((totalHalfNeckPerimeter ?? neckW * 2.95).toFixed(2));
  const buttonExt = 1.8;
  const standW = Number((halfNeck + buttonExt).toFixed(2));
  const standH = 3.2;

  const standSeam: PathCommand[] = [
    { type: "M", x: 0, y: 1.4 },
    {
      type: "C",
      cp1x: halfNeck * 0.45,
      cp1y: 1.2,
      cp2x: halfNeck * 0.85,
      cp2y: 0.4,
      x: standW,
      y: 0,
    },
    {
      type: "C",
      cp1x: standW + 0.9,
      cp1y: standH * 0.35,
      cp2x: standW + 0.6,
      cp2y: standH,
      x: standW - 0.5,
      y: standH,
    },
    {
      type: "C",
      cp1x: halfNeck * 0.75,
      cp1y: standH + 0.5,
      cp2x: halfNeck * 0.35,
      cp2y: standH + 1.0,
      x: 0,
      y: standH + 1.1,
    },
    { type: "Z" },
  ];

  // Calibrate base edge to exact halfNeck * 2
  const standPiece = normalizePiece(
    {
      id: "collar_stand",
      name: "PIE DE CUELLO / TIRILLA (x2 + Entretela)",
      subtitle: `Base escote: ${(halfNeck * 2).toFixed(1)} cm + cruce | Cortar 2 + Entretela x2`,
      tabLabel: "Pie de Cuello",
      seamPath: standSeam,
      grainline: { x1: 2.5, y1: standH * 0.72, x2: halfNeck - 1.5, y2: standH * 0.72 },
      notches: [
        { x: halfNeck, y: 0.2, angle: -90, label: "Centro del." },
        { x: Number((halfNeck * 0.46).toFixed(2)), y: 1.0, angle: -90, label: "Hombro" },
      ],
      internalLines: [
        {
          commands: [
            { type: "M", x: standW - 0.9, y: standH * 0.5 },
            { type: "L", x: standW - 0.9, y: standH * 0.5 + 0.1 },
          ],
          style: "button",
        },
      ],
      labelPos: { x: standW * 0.48, y: standH * 0.68 },
      labelAngle: 0,
      labelMaxSpanCm: standW - 2,
      labelBandWidthCm: standH + 0.8,
      foldLine: { x1: 0, y1: 1.4, x2: 0, y2: standH + 1.1 },
      edgeAllowances: { 0: "curve", 1: "curve", 2: "curve", 3: "fold" },
      cutQuantity: 2,
      cutOnFold: true,
      interfacingQuantity: 2,
      seamAnchors: { collarBase: Number((halfNeck * 2).toFixed(2)) },
    },
    seamAllowance
  );

  const collarLeafH = 5.2;
  const collarSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0.9 },
    {
      type: "C",
      cp1x: halfNeck * 0.4,
      cp1y: 0.8,
      cp2x: halfNeck * 0.78,
      cp2y: 0.3,
      x: halfNeck,
      y: 0,
    },
    { type: "L", x: halfNeck + 2.2, y: collarLeafH + 0.9 },
    {
      type: "C",
      cp1x: halfNeck * 0.68,
      cp1y: collarLeafH + 0.4,
      cp2x: halfNeck * 0.3,
      cp2y: collarLeafH + 0.1,
      x: 0,
      y: collarLeafH,
    },
    { type: "Z" },
  ];

  const collarPiece = normalizePiece(
    {
      id: "shirt_collar",
      name: "CUELLO SUPERIOR CAMISERO (x2 + Entretela)",
      subtitle: "Cortar 2 piezas al doblez + Entretela x2",
      tabLabel: "Cuello Superior",
      seamPath: collarSeam,
      grainline: { x1: 3, y1: collarLeafH * 0.55, x2: halfNeck - 2, y2: collarLeafH * 0.55 },
      notches: [{ x: 0, y: collarLeafH, angle: 90, label: "Centro espalda" }],
      labelPos: { x: halfNeck * 0.48, y: collarLeafH * 0.56 },
      labelAngle: 0,
      labelMaxSpanCm: halfNeck - 2,
      labelBandWidthCm: collarLeafH,
      foldLine: { x1: 0, y1: 0.9, x2: 0, y2: collarLeafH },
      edgeAllowances: { 0: "curve", 1: "seam", 2: "seam", 3: "fold" },
      cutQuantity: 2,
      cutOnFold: true,
      interfacingQuantity: 2,
    },
    seamAllowance
  );

  const placketW = 4.2;
  const placketLen = Math.max(18, Math.round(frontLengthCm));
  const placketSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: placketW, y: 0 },
    { type: "L", x: placketW, y: placketLen },
    { type: "L", x: 0, y: placketLen },
    { type: "Z" },
  ];

  const buttonSteps = Math.max(3, Math.min(7, Math.floor((placketLen - 6) / 8.5)));
  const buttonLines: PatternInternalLine[] = [];
  for (let i = 0; i < buttonSteps; i++) {
    const by = Number((5 + i * ((placketLen - 10) / Math.max(1, buttonSteps - 1))).toFixed(1));
    buttonLines.push({
      commands: [
        { type: "M", x: placketW / 2 - 0.7, y: by },
        { type: "L", x: placketW / 2 + 0.7, y: by },
      ],
      style: "buttonhole",
    });
  }

  const placketPiece = normalizePiece(
    {
      id: "button_placket",
      name: "VISTA / CARTERA DE BOTONES (x2 + Entretela)",
      subtitle: `Cortar 2 piezas (${placketW} × ${placketLen} cm) + Entretela`,
      tabLabel: "Vista Botones",
      seamPath: placketSeam,
      grainline: { x1: placketW / 2, y1: 4, x2: placketW / 2, y2: placketLen - 4 },
      notches: [
        { x: placketW / 2, y: 5, angle: 0, label: "Ojal 1" },
        { x: placketW / 2, y: Math.round(placketLen * 0.5), angle: 0, label: "Centro" },
      ],
      internalLines: buttonLines,
      labelPos: { x: placketW / 2, y: placketLen * 0.48 },
      labelAngle: -90,
      labelMaxSpanCm: placketLen - 8,
      labelBandWidthCm: placketW,
      cutQuantity: 2,
      interfacingQuantity: 2,
    },
    seamAllowance
  );

  return [standPiece, collarPiece, placketPiece];
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

/**
 * Generates shirt cuff ("Puño de Manga x2 + Entretela") for long-sleeve collared shirts.
 */
export function buildShirtCuffPiece(params: {
  wristCm: number;
  seamAllowance: SeamAllowance;
}): PatternPiece {
  const { wristCm, seamAllowance } = params;
  const cuffLen = Number((wristCm + 5.0).toFixed(1));
  const cuffH = 12.5; // Folded to 6.25 cm height

  const seam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: cuffLen, y: 0 },
    { type: "L", x: cuffLen, y: cuffH },
    { type: "L", x: 0, y: cuffH },
    { type: "Z" },
  ];

  return normalizePiece(
    {
      id: "shirt_cuff",
      name: "PUÑO DE MANGA (x2 + Entretela)",
      subtitle: `${cuffLen} × ${cuffH} cm (dobla a 6.2 cm) | Entretela x2`,
      tabLabel: "Puño Manga",
      seamPath: seam,
      grainline: { x1: 3, y1: cuffH / 2, x2: cuffLen - 3, y2: cuffH / 2 },
      notches: [{ x: cuffLen / 2, y: 0, angle: -90, label: "Centro puño" }],
      internalLines: [
        {
          commands: [
            { type: "M", x: 0, y: cuffH / 2 },
            { type: "L", x: cuffLen, y: cuffH / 2 },
          ],
          style: "fold",
          label: "Doblez puño",
          labelPos: { x: cuffLen * 0.45, y: cuffH / 2 - 0.6 },
        },
        {
          commands: [
            { type: "M", x: 1.8, y: cuffH * 0.26 },
            { type: "L", x: 1.8, y: cuffH * 0.26 + 0.1 },
          ],
          style: "button",
        },
        {
          commands: [
            { type: "M", x: cuffLen - 2.6, y: cuffH * 0.26 },
            { type: "L", x: cuffLen - 1.2, y: cuffH * 0.26 },
          ],
          style: "buttonhole",
        },
      ],
      labelPos: { x: cuffLen / 2, y: cuffH * 0.72 },
      labelAngle: 0,
      labelMaxSpanCm: cuffLen - 4,
      labelBandWidthCm: cuffH * 0.5,
      cutQuantity: 2,
      interfacingQuantity: 2,
    },
    seamAllowance
  );
}

/**
 * Generates stretch rib neckband ("Cuello Rib / Bies Elástico") scaled to 85% of total neckline.
 */
export function buildRibNeckbandPiece(params: {
  totalNeckPerimeterCm: number;
  seamAllowance: SeamAllowance;
}): PatternPiece {
  const { totalNeckPerimeterCm, seamAllowance } = params;
  const halfRib = Number(((totalNeckPerimeterCm * 0.85) / 2).toFixed(1));
  const ribH = 4.6; // Folded to 2.3 cm band

  const seam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: halfRib, y: 0 },
    { type: "L", x: halfRib, y: ribH },
    { type: "L", x: 0, y: ribH },
    { type: "Z" },
  ];

  return normalizePiece(
    {
      id: "rib_neckband",
      name: "CUELLO RIB ELÁSTICO (x1 al doblez)",
      subtitle: `85% del escote (${(halfRib * 2).toFixed(1)} × ${ribH} cm)`,
      tabLabel: "Cuello Rib",
      seamPath: seam,
      grainline: { x1: 2.5, y1: ribH * 0.5, x2: halfRib - 2, y2: ribH * 0.5 },
      notches: [
        { x: halfRib, y: 0, angle: -90, label: "Centro del." },
        { x: 0, y: 0, angle: -90, label: "Centro esp.", count: 2 },
      ],
      internalLines: [
        {
          commands: [
            { type: "M", x: 0, y: ribH / 2 },
            { type: "L", x: halfRib, y: ribH / 2 },
          ],
          style: "fold",
          label: "Doblez",
          labelPos: { x: halfRib * 0.5, y: ribH / 2 - 0.5 },
        },
      ],
      labelPos: { x: halfRib * 0.5, y: ribH * 0.72 },
      labelAngle: 0,
      labelMaxSpanCm: halfRib - 2,
      labelBandWidthCm: ribH,
      foldLine: { x1: 0, y1: 0, x2: 0, y2: ribH },
      edgeAllowances: { 0: "seam", 1: "seam", 2: "seam", 3: "fold" },
      cutQuantity: 1,
      cutOnFold: true,
    },
    seamAllowance
  );
}

/**
 * Generates Two-Piece Tailored Jacket Sleeve ("Manga Sastre: Hoja Superior + Hoja Inferior")
 * with forward ergonomic elbow curve and combined cap matching `totalArmholePerimeter + 2.9 cm`.
 */
export function buildTwoPieceTailoredSleevePieces(params: {
  armholeDepth: number;
  totalArmholePerimeter: number;
  sleeveLengthCm: number;
  bicepCm?: number;
  wristCm?: number;
  seamAllowance: SeamAllowance;
}): PatternPiece[] {
  const {
    armholeDepth,
    totalArmholePerimeter,
    sleeveLengthCm,
    bicepCm,
    wristCm,
    seamAllowance,
  } = params;

  const easeSpec = getTargetCapEaseRange("woven", "jacket");
  const sleeveLen = Math.max(48, sleeveLengthCm);
  const elbowY = Number((sleeveLen * 0.58).toFixed(2));
  const minBicepW = bicepCm ? bicepCm + 6.5 : 0;

  const solved = solveSleeveCapDimensions(
    totalArmholePerimeter,
    armholeDepth,
    easeSpec.target,
    [easeSpec.min, easeSpec.max],
    minBicepW
  );

  const capH = solved.capHeight;
  const targetTotalCap = totalArmholePerimeter + easeSpec.target;

  // Scale both upperW and underW width+cap height until upperCap + underCap matches targetTotalCap within 0.1 cm
  let fullW = solved.sleeveWidth;
  let upperW = Number((fullW * 0.66).toFixed(2));
  let underW = Number((fullW * 0.34).toFixed(2));
  let solvedCapH = capH;

  const evalTwoPieceCap = (wFull: number, hCap: number) => {
    const uW = Number((wFull * 0.66).toFixed(2));
    const nW = Number((wFull * 0.34).toFixed(2));
    const uApex = Number((uW * 0.44).toFixed(2));
    const uCurves: PathCommand[] = [
      {
        type: "C",
        cp1x: uApex * 0.36,
        cp1y: hCap * 1.02,
        cp2x: uApex - uApex * 0.42,
        cp2y: 0,
        x: uApex,
        y: 0,
      },
      {
        type: "C",
        cp1x: uApex + (uW - uApex) * 0.48,
        cp1y: 0,
        cp2x: uW - (uW - uApex) * 0.3,
        cp2y: hCap,
        x: uW,
        y: hCap,
      },
    ];
    const uArc = commandsArcLength([{ type: "M", x: 0, y: hCap }, ...uCurves]);
    const nCurve: PathCommand = {
      type: "C",
      cp1x: nW * 0.32,
      cp1y: hCap + 1.4,
      cp2x: nW * 0.72,
      cp2y: hCap + 0.8,
      x: nW,
      y: hCap,
    };
    const nArc = commandsArcLength([{ type: "M", x: 0, y: hCap }, nCurve]);
    return { uW, nW, uApex, uCurves, uArc, nCurve, nArc, total: uArc + nArc };
  };

  let loScale = 0.65;
  let hiScale = 1.25;
  for (let i = 0; i < 24; i++) {
    const midS = (loScale + hiScale) / 2;
    const trial = evalTwoPieceCap(solved.sleeveWidth * midS, capH * Math.min(1, midS + 0.08));
    if (trial.total < targetTotalCap) {
      loScale = midS;
    } else {
      hiScale = midS;
    }
  }
  const finalScale = (loScale + hiScale) / 2;
  fullW = Number((solved.sleeveWidth * finalScale).toFixed(2));
  solvedCapH = Number((capH * Math.min(1, finalScale + 0.08)).toFixed(2));
  const finalCap = evalTwoPieceCap(fullW, solvedCapH);

  upperW = finalCap.uW;
  underW = finalCap.nW;
  const upperApexX = finalCap.uApex;
  const upperCapCurves = finalCap.uCurves;
  const upperCapArc = Number(finalCap.uArc.toFixed(2));
  const underCapArc = Number(finalCap.nArc.toFixed(2));
  const totalCombinedCap = Number(finalCap.total.toFixed(2));

  const wristTotal = wristCm ? wristCm + 7.5 : Math.max(24, fullW * 0.68);
  const upperWristW = Number((wristTotal * 0.64).toFixed(2));
  const underWristW = Number((wristTotal * 0.36).toFixed(2));
  const elbowShift = 2.2;

  const upperSeam: PathCommand[] = [
    { type: "M", x: 0, y: solvedCapH },
    ...upperCapCurves,
    {
      type: "C",
      cp1x: upperW + 0.8,
      cp1y: elbowY - 8,
      cp2x: upperW + elbowShift,
      cp2y: elbowY + 4,
      x: upperWristW + 1.4,
      y: sleeveLen,
    },
    { type: "L", x: 1.4, y: sleeveLen },
    {
      type: "C",
      cp1x: elbowShift * 0.8,
      cp1y: elbowY + 4,
      cp2x: elbowShift * 0.5,
      cp2y: elbowY - 8,
      x: 0,
      y: solvedCapH,
    },
    { type: "Z" },
  ];

  const underSeam: PathCommand[] = [
    { type: "M", x: 0, y: solvedCapH },
    finalCap.nCurve,
    {
      type: "C",
      cp1x: underW + elbowShift * 0.5,
      cp1y: elbowY - 6,
      cp2x: underWristW + elbowShift,
      cp2y: elbowY + 6,
      x: underWristW + 1.0,
      y: sleeveLen,
    },
    { type: "L", x: 1.0, y: sleeveLen },
    {
      type: "C",
      cp1x: elbowShift * 0.6,
      cp1y: elbowY + 4,
      cp2x: elbowShift * 0.35,
      cp2y: elbowY - 8,
      x: 0,
      y: solvedCapH,
    },
    { type: "Z" },
  ];

  void computeAsymmetricSleeveCapArcLengthCm;

  const upperPiece = normalizePiece(
    {
      id: "upper_sleeve",
      name: "MANGA SASTRE — HOJA SUPERIOR (x2)",
      subtitle: `Sisa: ${totalArmholePerimeter.toFixed(1)} cm → Copa total: ${totalCombinedCap.toFixed(1)} cm`,
      tabLabel: "Manga Hoja Sup.",
      seamPath: upperSeam,
      grainline: { x1: upperW * 0.48, y1: solvedCapH * 0.5, x2: upperW * 0.48, y2: sleeveLen - 5 },
      notches: [
        { x: upperApexX, y: 0, angle: -90, label: "Hombro" },
        { x: Number((upperApexX * 0.4).toFixed(2)), y: Number((solvedCapH * 0.62).toFixed(2)), angle: 135, label: "Del.", count: 1 },
        { x: Number((upperW - 0.8).toFixed(2)), y: elbowY, angle: 0, label: "Codo", count: 2 },
      ],
      labelPos: { x: upperW * 0.52, y: sleeveLen * 0.54 },
      edgeAllowances: { 0: "curve", 1: "curve", 2: "seam", 3: "hem", 4: "seam" },
      cutQuantity: 2,
      seamAnchors: {
        sleeveCap: upperCapArc,
        sleeveCapTargetEase: [easeSpec.min, easeSpec.max],
      },
    },
    seamAllowance
  );

  const underPiece = normalizePiece(
    {
      id: "under_sleeve",
      name: "MANGA SASTRE — HOJA INFERIOR (x2)",
      subtitle: `Complemento axila + codo | Cortar 2 piezas`,
      tabLabel: "Manga Hoja Inf.",
      seamPath: underSeam,
      grainline: { x1: underW * 0.5, y1: solvedCapH + 3, x2: underW * 0.5, y2: sleeveLen - 5 },
      notches: [
        { x: Number((underW * 0.5).toFixed(2)), y: solvedCapH + 1, angle: -90, label: "Axila" },
        { x: Number((underW * 0.92).toFixed(2)), y: elbowY, angle: 0, label: "Codo", count: 2 },
      ],
      labelPos: { x: underW * 0.52, y: sleeveLen * 0.62 },
      edgeAllowances: { 0: "curve", 1: "seam", 2: "hem", 3: "seam" },
      cutQuantity: 2,
      seamAnchors: {
        sleeveCap: underCapArc,
        sleeveCapTargetEase: [easeSpec.min, easeSpec.max],
      },
    },
    seamAllowance
  );

  return [upperPiece, underPiece];
}

/**
 * Generates trouser Fly Facing ("Aleta de Cierre") and Fly Shield ("Aletilla / Guardacierre").
 */
export function buildTrouserFlyPieces(params: {
  flyLengthCm: number;
  seamAllowance: SeamAllowance;
}): PatternPiece[] {
  const { flyLengthCm, seamAllowance } = params;
  const flyH = Math.max(15, Math.min(22, Number(flyLengthCm.toFixed(1))));
  const aletaW = 4.5;

  const aletaSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: aletaW, y: 0 },
    { type: "L", x: aletaW, y: flyH - 3.5 },
    {
      type: "C",
      cp1x: aletaW,
      cp1y: flyH - 0.5,
      cp2x: aletaW * 0.4,
      cp2y: flyH,
      x: 0,
      y: flyH,
    },
    { type: "Z" },
  ];

  const aletaPiece = normalizePiece(
    {
      id: "fly_facing",
      name: "ALETA DE CIERRE (x1 + Entretela)",
      subtitle: `Bragueta izquierda (${aletaW} × ${flyH} cm) + Entretela`,
      tabLabel: "Aleta Cierre",
      seamPath: aletaSeam,
      grainline: { x1: aletaW * 0.45, y1: 2, x2: aletaW * 0.45, y2: flyH - 2 },
      notches: [{ x: 0, y: flyH - 1.5, angle: 180, label: "Tope cierre" }],
      labelPos: { x: aletaW * 0.52, y: flyH * 0.48 },
      labelAngle: -90,
      labelMaxSpanCm: flyH - 4,
      labelBandWidthCm: aletaW,
      cutQuantity: 1,
      interfacingQuantity: 1,
    },
    seamAllowance
  );

  const aletillaW = 5.0;
  const aletillaSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: aletillaW, y: 0 },
    {
      type: "C",
      cp1x: aletillaW,
      cp1y: flyH - 1,
      cp2x: aletillaW * 0.45,
      cp2y: flyH,
      x: 0,
      y: flyH,
    },
    { type: "Z" },
  ];

  const aletillaPiece = normalizePiece(
    {
      id: "fly_shield",
      name: "ALETILLA / GUARDACIERRE (x1 doblez)",
      subtitle: `Tapeta interior cierre (${aletillaW} × ${flyH} cm al doblez)`,
      tabLabel: "Aletilla",
      seamPath: aletillaSeam,
      grainline: { x1: aletillaW * 0.4, y1: 2, x2: aletillaW * 0.4, y2: flyH - 2 },
      notches: [{ x: 0, y: 0, angle: -90, label: "Cintura" }],
      labelPos: { x: aletillaW * 0.48, y: flyH * 0.46 },
      labelAngle: -90,
      labelMaxSpanCm: flyH - 4,
      labelBandWidthCm: aletillaW,
      foldLine: { x1: 0, y1: 0, x2: 0, y2: flyH },
      edgeAllowances: { 0: "seam", 1: "curve", 2: "fold" },
      cutQuantity: 1,
      cutOnFold: true,
    },
    seamAllowance
  );

  return [aletaPiece, aletillaPiece];
}

export interface ShirtBackYokeData {
  yokePiece: PatternPiece;
  splitYCm: number;
  yokeJoinXCm: number;
  forwardShoulderCm: number;
  pleatHalfCm: number;
  upperArmholeLenCm: number;
  lowerArmholeCmd: Extract<PathCommand, { type: "C" }>;
  lowerArmholeLenCm: number;
  backNeckArcCm: number;
}

/**
 * Generates real Shirt Back Yoke ("Canesú Trasero x2 al doblez") with:
 * - 1.5 cm forward shoulder transfer onto the yoke,
 * - exact de Casteljau armhole split matching lower back panel,
 * - 3.0 cm half-pleat (6 cm full CB box pleat) when lower back is cut on fold.
 */
export function buildShirtBackYokeGeometry(params: {
  neckW: number;
  backNeckDrop: number;
  backShoulderX: number;
  shoulderSlope: number;
  armholeDepth: number;
  backQuarterBust: number;
  backArmholeCmd: Extract<PathCommand, { type: "C" }>;
  cutLowerBackOnFold?: boolean;
  forwardShoulderCm?: number;
  boxPleatHalfCm?: number;
  seamAllowance: SeamAllowance;
}): ShirtBackYokeData {
  const {
    neckW,
    backNeckDrop,
    backShoulderX,
    shoulderSlope,
    armholeDepth,
    backQuarterBust,
    backArmholeCmd,
    cutLowerBackOnFold = true,
    forwardShoulderCm = 1.5,
    boxPleatHalfCm = 3.0,
    seamAllowance,
  } = params;

  const fwd = forwardShoulderCm;
  // Shifted back armhole starts fwd cm higher than original shoulder line
  const shiftedP0 = { x: backShoulderX, y: shoulderSlope - fwd };
  const shiftedCp1 = { x: backArmholeCmd.cp1x, y: backArmholeCmd.cp1y - fwd * 0.65 };
  const shiftedCp2 = { x: backArmholeCmd.cp2x, y: backArmholeCmd.cp2y };
  const shiftedP3 = { x: backQuarterBust, y: armholeDepth };

  const targetSplitY = Number(
    Math.min(armholeDepth - 3.5, Math.max(shoulderSlope + 5.5, backNeckDrop + 9.5)).toFixed(2)
  );
  const tSplit = findCubicBezierTForY(
    shiftedP0,
    shiftedCp1,
    shiftedCp2,
    shiftedP3,
    targetSplitY
  );
  const splitArm = splitCubicBezier(shiftedP0, shiftedCp1, shiftedCp2, shiftedP3, tSplit);
  const splitPt = splitArm.first[3];
  const splitYCm = Number(splitPt.y.toFixed(2));
  const yokeJoinXCm = Number(splitPt.x.toFixed(2));

  const upperArmholeLenCm = Number(
    cubicBezierLength(
      splitArm.first[0],
      splitArm.first[1],
      splitArm.first[2],
      splitArm.first[3],
      28
    ).toFixed(2)
  );
  const lowerArmholeCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number(splitArm.second[1].x.toFixed(2)),
    cp1y: Number(splitArm.second[1].y.toFixed(2)),
    cp2x: Number(splitArm.second[2].x.toFixed(2)),
    cp2y: Number(splitArm.second[2].y.toFixed(2)),
    x: Number(splitArm.second[3].x.toFixed(2)),
    y: Number(splitArm.second[3].y.toFixed(2)),
  };
  const lowerArmholeLenCm = Number(
    cubicBezierLength(
      splitArm.second[0],
      splitArm.second[1],
      splitArm.second[2],
      splitArm.second[3],
      28
    ).toFixed(2)
  );

  // Build yoke piece shifted down by +fwd so all local Y >= 0
  const cbNeckY = Number((backNeckDrop + fwd * 0.45).toFixed(2));
  const neckCmds = buildNecklineCommand(neckW, cbNeckY, "round");
  const backNeckArcCm = Number(
    commandsArcLength([{ type: "M", x: 0, y: cbNeckY }, ...neckCmds]).toFixed(2)
  );
  const yokeBottomY = Number((splitYCm + fwd).toFixed(2));
  const yokeSeam: PathCommand[] = [
    { type: "M", x: 0, y: cbNeckY },
    ...neckCmds,
    { type: "L", x: backShoulderX, y: shoulderSlope },
    {
      type: "C",
      cp1x: Number(splitArm.first[1].x.toFixed(2)),
      cp1y: Number((splitArm.first[1].y + fwd).toFixed(2)),
      cp2x: Number(splitArm.first[2].x.toFixed(2)),
      cp2y: Number((splitArm.first[2].y + fwd).toFixed(2)),
      x: yokeJoinXCm,
      y: yokeBottomY,
    },
    { type: "L", x: 0, y: yokeBottomY },
    { type: "Z" },
  ];

  const backShoulderLen = Number(Math.hypot(backShoulderX - neckW, shoulderSlope).toFixed(2));
  const pleatHalfCm = cutLowerBackOnFold ? boxPleatHalfCm : 0;

  const yokePiece = normalizePiece(
    {
      id: "back_yoke",
      name: "CANESÚ TRASERO CAMISERO (x2 al doblez)",
      subtitle: `Hombro adelantado ${fwd} cm | Costura canesú: ${yokeJoinXCm.toFixed(1)} cm${pleatHalfCm > 0 ? ` | Tabla +${(pleatHalfCm * 2).toFixed(0)} cm` : ""}`,
      tabLabel: "Canesú Trasero",
      seamPath: yokeSeam,
      grainline: {
        x1: Math.max(3, yokeJoinXCm * 0.35),
        y1: yokeBottomY - 1.8,
        x2: Math.max(6, yokeJoinXCm * 0.72),
        y2: yokeBottomY - 1.8,
      },
      notches: [
        {
          x: Number((yokeJoinXCm * 0.5).toFixed(2)),
          y: yokeBottomY,
          angle: 90,
          label: "Encuentro canesú",
          count: 2,
        },
        {
          x: Number((backShoulderX - (backShoulderX - yokeJoinXCm) * 0.35).toFixed(2)),
          y: Number((yokeBottomY * 0.58).toFixed(2)),
          angle: 0,
          label: "Sisa tras.",
          count: 2,
        },
      ],
      labelPos: { x: yokeJoinXCm * 0.45, y: yokeBottomY * 0.62 },
      labelMaxSpanCm: Math.max(8, yokeJoinXCm - 2),
      labelBandWidthCm: Math.max(4, yokeBottomY - cbNeckY),
      foldLine: { x1: 0, y1: cbNeckY, x2: 0, y2: yokeBottomY },
      edgeAllowances: { 0: "curve", 1: "seam", 2: "curve", 3: "seam", 4: "fold" },
      cutQuantity: 2,
      cutOnFold: true,
      seamAnchors: {
        shoulder: backShoulderLen,
        armhole: upperArmholeLenCm,
        neckline: backNeckArcCm,
        yokeSeam: yokeJoinXCm,
      },
    },
    seamAllowance
  );

  return {
    yokePiece,
    splitYCm,
    yokeJoinXCm,
    forwardShoulderCm: fwd,
    pleatHalfCm,
    upperArmholeLenCm,
    lowerArmholeCmd,
    lowerArmholeLenCm,
    backNeckArcCm,
  };
}

/**
 * Generates parametric 2-piece Italian slanted trouser pocket pieces synchronized
 * with the front leg mouth geometry:
 * 1) `italian_pocket_upperbag`: upper bag cut along the exact slanted pocket mouth.
 * 2) `italian_pocket_underbag`: under bag with integrated side/waist corner & self-facing line.
 */
export function buildItalianPocketPieces(
  seamAllowance: SeamAllowance,
  geometry?: {
    mouthTopDx?: number;
    mouthTopDy?: number;
    mouthBotDx?: number;
    mouthBotDy?: number;
    mouthLengthCm?: number;
    bagDepthCm?: number;
  }
): PatternPiece[] {
  const mouthTopDx = geometry?.mouthTopDx ?? 4.2;
  const mouthTopDy = geometry?.mouthTopDy ?? 0;
  const mouthBotDx = geometry?.mouthBotDx ?? -1.2;
  const mouthBotDy = geometry?.mouthBotDy ?? 15.5;
  const mouthLengthCm = Number(
    (
      geometry?.mouthLengthCm ??
      Math.hypot(mouthTopDx - mouthBotDx, mouthTopDy - mouthBotDy)
    ).toFixed(2)
  );

  const bagW = Math.max(15.5, mouthTopDx + 11.5);
  const bagH = Math.max(25, Math.round(geometry?.bagDepthCm ?? Math.max(25, mouthBotDy + 10)));
  const minX = Math.min(0, mouthBotDx);

  // 1. Upper pocket bag — starts at pocket mouth top (follows slanted opening directly)
  const upperBagSeam: PathCommand[] = [
    { type: "M", x: mouthTopDx, y: mouthTopDy },
    { type: "L", x: bagW, y: 0 },
    { type: "L", x: bagW, y: bagH * 0.68 },
    {
      type: "C",
      cp1x: bagW,
      cp1y: bagH,
      cp2x: bagW * 0.42,
      cp2y: bagH + 0.5,
      x: minX,
      y: bagH - 2,
    },
    { type: "L", x: mouthBotDx, y: mouthBotDy },
    { type: "L", x: mouthTopDx, y: mouthTopDy },
    { type: "Z" },
  ];

  const upperBagPiece = normalizePiece(
    {
      id: "italian_pocket_upperbag",
      name: "BOLSA SUP. BOLSILLO ITALIANO (x2)",
      subtitle: `Boca inclinada ${mouthLengthCm.toFixed(1)} cm | Cortar 2 en forro/popelina`,
      tabLabel: "Bolsa Sup.",
      seamPath: upperBagSeam,
      grainline: { x1: bagW * 0.52, y1: 3, x2: bagW * 0.52, y2: bagH - 4 },
      notches: [
        { x: mouthTopDx, y: mouthTopDy, angle: -90, label: "Boca sup.", count: 1 },
        { x: mouthBotDx, y: mouthBotDy, angle: 180, label: "Boca inf.", count: 2 },
      ],
      labelPos: { x: bagW * 0.54, y: bagH * 0.52 },
      edgeAllowances: { 0: "seam", 4: "seam" },
      cutQuantity: 2,
      seamAnchors: {
        pocketMouth: mouthLengthCm,
      },
    },
    seamAllowance
  );

  // 2. Under bag with integrated side/waist corner + self-fabric facing boundary line
  const facingInnerTopX = Number((mouthTopDx + 4.5).toFixed(2));
  const facingInnerBotX = Number((Math.max(facingInnerTopX, mouthBotDx + 7.5)).toFixed(2));

  const underBagSeam: PathCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: bagW, y: 0 },
    { type: "L", x: bagW, y: bagH * 0.68 },
    {
      type: "C",
      cp1x: bagW,
      cp1y: bagH,
      cp2x: bagW * 0.42,
      cp2y: bagH + 0.5,
      x: minX,
      y: bagH - 2,
    },
    { type: "L", x: mouthBotDx, y: mouthBotDy },
    {
      type: "C",
      cp1x: mouthBotDx * 0.6,
      cp1y: mouthBotDy * 0.58,
      cp2x: mouthBotDx * 0.25,
      cp2y: mouthBotDy * 0.25,
      x: 0,
      y: 0,
    },
    { type: "Z" },
  ];

  const underBagPiece = normalizePiece(
    {
      id: "italian_pocket_underbag",
      name: "BOLSA INF. + VISTA INTEGRADA (x2)",
      subtitle: `Reconstruye costado/cintura | Boca ${mouthLengthCm.toFixed(1)} cm (Cortar 2)`,
      tabLabel: "Bolsa Inf. + Vista",
      seamPath: underBagSeam,
      grainline: { x1: bagW * 0.5, y1: 3, x2: bagW * 0.5, y2: bagH - 4 },
      notches: [
        { x: mouthTopDx, y: mouthTopDy, angle: -90, label: "Cintura / boca", count: 1 },
        { x: mouthBotDx, y: mouthBotDy, angle: 180, label: "Tope costado", count: 2 },
      ],
      internalLines: [
        {
          commands: [
            { type: "M", x: mouthTopDx, y: mouthTopDy },
            { type: "L", x: mouthBotDx, y: mouthBotDy },
          ],
          style: "mark",
          label: "Borde boca",
          labelPos: { x: (mouthTopDx + mouthBotDx) * 0.5, y: mouthBotDy * 0.45 },
        },
        {
          commands: [
            { type: "M", x: facingInnerTopX, y: 0 },
            { type: "L", x: facingInnerBotX, y: mouthBotDy + 2.5 },
            { type: "L", x: minX, y: mouthBotDy + 2.5 },
          ],
          style: "mark",
          label: "Vista tela principal",
          labelPos: { x: facingInnerBotX * 0.55, y: mouthBotDy + 1.2 },
        },
      ],
      labelPos: { x: bagW * 0.5, y: bagH * 0.52 },
      cutQuantity: 2,
      interfacingQuantity: 2,
      seamAnchors: {
        pocketMouth: mouthLengthCm,
      },
    },
    seamAllowance
  );

  return [upperBagPiece, underBagPiece];
}
