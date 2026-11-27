import {
  FabricType,
  NecklineStyle,
  PathCommand,
  PatternInternalLine,
  PatternNotch,
  PatternPiece,
  SeamAllowance,
} from "../types";
import {
  buildNecklineCommand,
  commandsArcLength,
  cubicBezierLength,
  evalCubicBezier,
  normalizePiece,
  splitCubicBezier,
} from "./geometry";

export interface RaglanGeometryInput {
  neckW: number;
  frontNeckDrop: number;
  backNeckDrop: number;
  necklineStyle: NecklineStyle;
  shoulderX: number;
  shoulderSlope: number;
  armholeDepth: number;
  frontQuarterBust: number;
  backQuarterBust: number;
  sleeveLengthCm: number;
  fabricType: FabricType;
  flaredSleeve?: boolean;
  bicepCm?: number;
  wristCm?: number;
  withShirtCuff?: boolean;
  seamAllowance: SeamAllowance;
}

export interface RaglanGeometryResult {
  frontNeckCmds: PathCommand[];
  backNeckCmds: PathCommand[];
  frontNeckRemainArcCm: number;
  backNeckRemainArcCm: number;
  totalNeckArcCm: number;
  raglanUnderarmY: number;
  frontRaglanStart: { x: number; y: number };
  backRaglanStart: { x: number; y: number };
  frontBodyRaglanCmd: Extract<PathCommand, { type: "C" }>;
  backBodyRaglanCmd: Extract<PathCommand, { type: "C" }>;
  frontRaglanSeamCm: number;
  backRaglanSeamCm: number;
  frontNotches: PatternNotch[];
  backNotches: PatternNotch[];
  sleevePiece: PatternPiece;
}

function splitNeckForRaglan(
  neckW: number,
  neckDrop: number,
  style: NecklineStyle,
  splitFraction: number
): {
  remainCmds: PathCommand[];
  splitPt: { x: number; y: number };
  remainArcCm: number;
  wingArcCm: number;
} {
  const cmds = buildNecklineCommand(neckW, neckDrop, style);
  // Square neckline has 2 straight lines (0,drop)->(neckW,drop)->(neckW,0)
  if (cmds.length === 2 && cmds[0].type === "L" && cmds[1].type === "L") {
    const corner = { x: cmds[0].x, y: cmds[0].y };
    const splitPt = {
      x: corner.x,
      y: Number((corner.y * (1 - splitFraction * 0.45)).toFixed(2)),
    };
    const remainCmds: PathCommand[] = [
      { type: "L", x: corner.x, y: corner.y },
      { type: "L", x: splitPt.x, y: splitPt.y },
    ];
    const remainArcCm = Number(
      commandsArcLength([{ type: "M", x: 0, y: neckDrop }, ...remainCmds]).toFixed(2)
    );
    const wingArcCm = Number(Math.hypot(neckW - splitPt.x, splitPt.y).toFixed(2));
    return { remainCmds, splitPt, remainArcCm, wingArcCm };
  }

  const c = cmds[0];
  if (c && c.type === "C") {
    const split = splitCubicBezier(
      { x: 0, y: neckDrop },
      { x: c.cp1x, y: c.cp1y },
      { x: c.cp2x, y: c.cp2y },
      { x: c.x, y: c.y },
      splitFraction
    );
    const remainCmds: PathCommand[] = [
      {
        type: "C",
        cp1x: Number(split.first[1].x.toFixed(2)),
        cp1y: Number(split.first[1].y.toFixed(2)),
        cp2x: Number(split.first[2].x.toFixed(2)),
        cp2y: Number(split.first[2].y.toFixed(2)),
        x: Number(split.first[3].x.toFixed(2)),
        y: Number(split.first[3].y.toFixed(2)),
      },
    ];
    const remainArcCm = Number(
      cubicBezierLength(
        split.first[0],
        split.first[1],
        split.first[2],
        split.first[3],
        24
      ).toFixed(2)
    );
    const wingArcCm = Number(
      cubicBezierLength(
        split.second[0],
        split.second[1],
        split.second[2],
        split.second[3],
        24
      ).toFixed(2)
    );
    return {
      remainCmds,
      splitPt: {
        x: Number(split.first[3].x.toFixed(2)),
        y: Number(split.first[3].y.toFixed(2)),
      },
      remainArcCm,
      wingArcCm,
    };
  }

  const fallbackSplit = {
    x: Number((neckW * splitFraction).toFixed(2)),
    y: Number((neckDrop * (1 - splitFraction)).toFixed(2)),
  };
  return {
    remainCmds: [{ type: "L", x: fallbackSplit.x, y: fallbackSplit.y }],
    splitPt: fallbackSplit,
    remainArcCm: Number(
      Math.hypot(fallbackSplit.x, neckDrop - fallbackSplit.y).toFixed(2)
    ),
    wingArcCm: Number(
      Math.hypot(neckW - fallbackSplit.x, fallbackSplit.y).toFixed(2)
    ),
  };
}

/**
 * Generates synchronized Raglan Body-to-Sleeve seam geometry and a 1-piece contoured
 * Raglan Sleeve ("Manga Raglán") with iterative front/back diagonal arc matching and
 * crown shoulder dart on woven fabrics.
 */
export function buildRaglanGeometry(
  input: RaglanGeometryInput
): RaglanGeometryResult {
  const {
    neckW,
    frontNeckDrop,
    backNeckDrop,
    necklineStyle,
    shoulderX,
    shoulderSlope,
    armholeDepth,
    frontQuarterBust,
    backQuarterBust,
    sleeveLengthCm,
    fabricType,
    flaredSleeve = false,
    bicepCm,
    wristCm,
    withShirtCuff = false,
    seamAllowance,
  } = input;

  // 1. Split necklines cleanly into bodice center neckline + sleeve neck wings
  const frontSplit = splitNeckForRaglan(neckW, frontNeckDrop, necklineStyle, 0.68);
  const backSplit = splitNeckForRaglan(neckW, backNeckDrop, "round", 0.62);

  // Lower underarm slightly for smooth under-sleeve mobility (Aldrich standard)
  const underarmDropCm = fabricType === "woven" ? 2.0 : 1.4;
  const raglanUnderarmY = Number((armholeDepth + underarmDropCm).toFixed(2));

  // 2. Concave-convex S-curve raglan armhole lines on Front & Back bodies
  const frontRaglanStart = frontSplit.splitPt;
  const backRaglanStart = backSplit.splitPt;

  const frontMidX = (frontRaglanStart.x + frontQuarterBust) * 0.5;
  const frontMidY = (frontRaglanStart.y + raglanUnderarmY) * 0.5;
  const frontBodyRaglanCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number((frontMidX - 1.8).toFixed(2)),
    cp1y: Number((frontRaglanStart.y + (raglanUnderarmY - frontRaglanStart.y) * 0.42).toFixed(2)),
    cp2x: Number((frontQuarterBust - 2.4).toFixed(2)),
    cp2y: Number((raglanUnderarmY - 0.6).toFixed(2)),
    x: Number(frontQuarterBust.toFixed(2)),
    y: raglanUnderarmY,
  };

  const backMidX = (backRaglanStart.x + backQuarterBust) * 0.5;
  const backBodyRaglanCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number((backMidX - 1.0).toFixed(2)),
    cp1y: Number((backRaglanStart.y + (raglanUnderarmY - backRaglanStart.y) * 0.36).toFixed(2)),
    cp2x: Number((backQuarterBust - 2.0).toFixed(2)),
    cp2y: Number((raglanUnderarmY - 0.5).toFixed(2)),
    x: Number(backQuarterBust.toFixed(2)),
    y: raglanUnderarmY,
  };

  const frontRaglanSeamCm = Number(
    cubicBezierLength(
      frontRaglanStart,
      { x: frontBodyRaglanCmd.cp1x, y: frontBodyRaglanCmd.cp1y },
      { x: frontBodyRaglanCmd.cp2x, y: frontBodyRaglanCmd.cp2y },
      { x: frontQuarterBust, y: raglanUnderarmY },
      32
    ).toFixed(2)
  );
  const backRaglanSeamCm = Number(
    cubicBezierLength(
      backRaglanStart,
      { x: backBodyRaglanCmd.cp1x, y: backBodyRaglanCmd.cp1y },
      { x: backBodyRaglanCmd.cp2x, y: backBodyRaglanCmd.cp2y },
      { x: backQuarterBust, y: raglanUnderarmY },
      32
    ).toFixed(2)
  );

  const frontMidSample = evalCubicBezier(
    frontRaglanStart,
    { x: frontBodyRaglanCmd.cp1x, y: frontBodyRaglanCmd.cp1y },
    { x: frontBodyRaglanCmd.cp2x, y: frontBodyRaglanCmd.cp2y },
    { x: frontQuarterBust, y: raglanUnderarmY },
    0.52
  );
  const backMidSample = evalCubicBezier(
    backRaglanStart,
    { x: backBodyRaglanCmd.cp1x, y: backBodyRaglanCmd.cp1y },
    { x: backBodyRaglanCmd.cp2x, y: backBodyRaglanCmd.cp2y },
    { x: backQuarterBust, y: raglanUnderarmY },
    0.52
  );

  const frontNotches: PatternNotch[] = [
    {
      x: Number(frontMidSample.x.toFixed(2)),
      y: Number(frontMidSample.y.toFixed(2)),
      angle: 0,
      label: "Raglán del.",
      count: 1,
    },
  ];
  const backNotches: PatternNotch[] = [
    {
      x: Number(backMidSample.x.toFixed(2)),
      y: Number(backMidSample.y.toFixed(2)),
      angle: 0,
      label: "Raglán tras.",
      count: 2,
    },
  ];

  // 3. Build 1-piece Raglan Sleeve (spans from shoulder center apex + neck wings down to wrist/bicep)
  const shoulderSpan = Math.max(8, shoulderX - neckW);
  const crownDropH = Number((armholeDepth * 0.78 + underarmDropCm + shoulderSlope * 0.5).toFixed(2));
  const cuffAllowDrop = withShirtCuff && !flaredSleeve ? 4.5 : 0;
  // Raglan sleeve includes the shoulder extension from neck to shoulder tip
  const sleeveOverarmLen = Math.max(22, sleeveLengthCm + shoulderSpan * 0.85 - cuffAllowDrop);
  const wristBase = wristCm ? wristCm + (fabricType === "stretch" ? 1.5 : 4.5) : 22;
  const minBicepHalf = bicepCm
    ? (bicepCm + (fabricType === "stretch" ? 2.0 : 4.5)) / 2
    : Math.max(14, shoulderSpan * 1.35);

  const dartHalfGap = fabricType === "woven" ? 1.35 : 0;
  const dartTipY = fabricType === "woven" ? Number(Math.min(crownDropH - 2, shoulderSpan * 0.92).toFixed(2)) : 0;

  let frontHalfW = Math.max(minBicepHalf, frontRaglanSeamCm * 0.68);
  let backHalfW = Math.max(minBicepHalf, backRaglanSeamCm * 0.68);

  const frontNeckWingW = Math.max(2.2, frontSplit.wingArcCm * 0.95);
  const backNeckWingW = Math.max(2.2, backSplit.wingArcCm * 0.95);

  // Center X in local sleeve space (so apex sits near the middle)
  const apexX = Number((frontHalfW + 2).toFixed(2));
  const leftPeakX = Number((apexX - dartHalfGap).toFixed(2));
  const rightPeakX = Number((apexX + dartHalfGap).toFixed(2));
  const leftNeckX = Number((leftPeakX - frontNeckWingW).toFixed(2));
  const rightNeckX = Number((rightPeakX + backNeckWingW).toFixed(2));
  const neckWingY = 1.4;

  // Iteratively calibrate leftUnderarmX (front) and rightUnderarmX (back) so both sleeve raglan arcs
  // match `frontRaglanSeamCm` and `backRaglanSeamCm` (+ slight 0..0.4 cm ease on woven).
  const targetFrontEase = fabricType === "woven" ? 0.35 : 0;
  const targetBackEase = fabricType === "woven" ? 0.45 : 0;
  let frontSleeveArcCm = frontRaglanSeamCm;
  let backSleeveArcCm = backRaglanSeamCm;
  let frontSleeveCp1 = { x: 0, y: 0 };
  let frontSleeveCp2 = { x: 0, y: 0 };
  let backSleeveCp1 = { x: 0, y: 0 };
  let backSleeveCp2 = { x: 0, y: 0 };

  for (let iter = 0; iter < 5; iter++) {
    const leftUAX = apexX - frontHalfW;
    const rightUAX = apexX + backHalfW;

    frontSleeveCp1 = {
      x: Number((leftNeckX - (leftNeckX - leftUAX) * 0.35).toFixed(2)),
      y: Number((neckWingY + (crownDropH - neckWingY) * 0.48).toFixed(2)),
    };
    frontSleeveCp2 = {
      x: Number((leftUAX + (leftNeckX - leftUAX) * 0.22).toFixed(2)),
      y: Number((crownDropH - 0.8).toFixed(2)),
    };
    frontSleeveArcCm = Number(
      cubicBezierLength(
        { x: leftNeckX, y: neckWingY },
        frontSleeveCp1,
        frontSleeveCp2,
        { x: leftUAX, y: crownDropH },
        32
      ).toFixed(2)
    );

    backSleeveCp1 = {
      x: Number((rightNeckX + (rightUAX - rightNeckX) * 0.38).toFixed(2)),
      y: Number((neckWingY + (crownDropH - neckWingY) * 0.42).toFixed(2)),
    };
    backSleeveCp2 = {
      x: Number((rightUAX - (rightUAX - rightNeckX) * 0.2).toFixed(2)),
      y: Number((crownDropH - 0.6).toFixed(2)),
    };
    backSleeveArcCm = Number(
      cubicBezierLength(
        { x: rightNeckX, y: neckWingY },
        backSleeveCp1,
        backSleeveCp2,
        { x: rightUAX, y: crownDropH },
        32
      ).toFixed(2)
    );

    const errFront = frontRaglanSeamCm + targetFrontEase - frontSleeveArcCm;
    const errBack = backRaglanSeamCm + targetBackEase - backSleeveArcCm;
    if (Math.abs(errFront) < 0.06 && Math.abs(errBack) < 0.06) break;
    frontHalfW = Math.max(minBicepHalf * 0.9, Math.min(34, frontHalfW + errFront * 0.85));
    backHalfW = Math.max(minBicepHalf * 0.9, Math.min(34, backHalfW + errBack * 0.85));
  }

  const leftUAX = Number((apexX - frontHalfW).toFixed(2));
  const rightUAX = Number((apexX + backHalfW).toFixed(2));
  const cuffHalf = flaredSleeve
    ? Math.max(frontHalfW, backHalfW) * 1.25
    : Math.max(10.5, wristBase / 2);
  const leftCuffX = Number((apexX - cuffHalf).toFixed(2));
  const rightCuffX = Number((apexX + cuffHalf).toFixed(2));

  const sleeveSeam: PathCommand[] = [
    { type: "M", x: leftNeckX, y: neckWingY },
    {
      type: "C",
      cp1x: Number((leftNeckX + (leftPeakX - leftNeckX) * 0.4).toFixed(2)),
      cp1y: Number((neckWingY * 0.5).toFixed(2)),
      cp2x: Number((leftPeakX - 0.6).toFixed(2)),
      cp2y: 0,
      x: leftPeakX,
      y: 0,
    },
    ...(dartHalfGap > 0
      ? [
          { type: "L" as const, x: apexX, y: dartTipY },
          { type: "L" as const, x: rightPeakX, y: 0 },
        ]
      : []),
    {
      type: "C",
      cp1x: Number((rightPeakX + 0.6).toFixed(2)),
      cp1y: 0,
      cp2x: Number((rightNeckX - (rightNeckX - rightPeakX) * 0.4).toFixed(2)),
      cp2y: Number((neckWingY * 0.5).toFixed(2)),
      x: rightNeckX,
      y: neckWingY,
    },
    {
      type: "C",
      cp1x: backSleeveCp1.x,
      cp1y: backSleeveCp1.y,
      cp2x: backSleeveCp2.x,
      cp2y: backSleeveCp2.y,
      x: rightUAX,
      y: crownDropH,
    },
    { type: "L", x: rightCuffX, y: sleeveOverarmLen },
    {
      type: "C",
      cp1x: Number((apexX + cuffHalf * 0.45).toFixed(2)),
      cp1y: Number((sleeveOverarmLen + (flaredSleeve ? 1.5 : 0.6)).toFixed(2)),
      cp2x: Number((apexX - cuffHalf * 0.45).toFixed(2)),
      cp2y: Number((sleeveOverarmLen + (flaredSleeve ? 1.5 : 0.6)).toFixed(2)),
      x: leftCuffX,
      y: sleeveOverarmLen,
    },
    {
      type: "L",
      x: leftUAX,
      y: crownDropH,
    },
    {
      type: "C",
      cp1x: frontSleeveCp2.x,
      cp1y: frontSleeveCp2.y,
      cp2x: frontSleeveCp1.x,
      cp2y: frontSleeveCp1.y,
      x: leftNeckX,
      y: neckWingY,
    },
    { type: "Z" },
  ];

  const sleeveFrontMid = evalCubicBezier(
    { x: leftNeckX, y: neckWingY },
    frontSleeveCp1,
    frontSleeveCp2,
    { x: leftUAX, y: crownDropH },
    0.52
  );
  const sleeveBackMid = evalCubicBezier(
    { x: rightNeckX, y: neckWingY },
    backSleeveCp1,
    backSleeveCp2,
    { x: rightUAX, y: crownDropH },
    0.52
  );

  const sleeveInternals: PatternInternalLine[] = [
    {
      commands: [
        { type: "M", x: apexX, y: dartHalfGap > 0 ? dartTipY : 0 },
        { type: "L", x: apexX, y: sleeveOverarmLen - 4 },
      ],
      style: "mark",
      label: "Línea hombro",
      labelPos: { x: apexX + 0.6, y: (crownDropH + sleeveOverarmLen) * 0.48 },
    },
  ];
  if (dartHalfGap > 0) {
    sleeveInternals.push({
      commands: [
        { type: "M", x: leftPeakX, y: 0 },
        { type: "L", x: apexX, y: dartTipY },
        { type: "L", x: rightPeakX, y: 0 },
      ],
      style: "dart",
      label: "Pinza hombro",
    });
  }

  const totalRaglanSleeveArcCm = Number(
    (frontSleeveArcCm + backSleeveArcCm).toFixed(2)
  );

  const sleevePiece = normalizePiece(
    {
      id: "sleeve",
      name: flaredSleeve
        ? "MANGA RAGLÁN ACAMPANADA (x2)"
        : "MANGA RAGLÁN ENTERIZA (x2)",
      subtitle: `Sisa raglán del ${frontSleeveArcCm.toFixed(1)} cm / tras ${backSleeveArcCm.toFixed(1)} cm${dartHalfGap > 0 ? " + pinza hombro" : ""}`,
      tabLabel: "Manga Raglán",
      seamPath: sleeveSeam,
      grainline: {
        x1: apexX,
        y1: Math.max(8, dartTipY + 4),
        x2: apexX,
        y2: sleeveOverarmLen - 6,
      },
      notches: [
        {
          x: Number(sleeveFrontMid.x.toFixed(2)),
          y: Number(sleeveFrontMid.y.toFixed(2)),
          angle: 180,
          label: "Raglán del.",
          count: 1,
        },
        {
          x: Number(sleeveBackMid.x.toFixed(2)),
          y: Number(sleeveBackMid.y.toFixed(2)),
          angle: 0,
          label: "Raglán tras.",
          count: 2,
        },
      ],
      internalLines: sleeveInternals,
      labelPos: { x: apexX, y: crownDropH + (sleeveOverarmLen - crownDropH) * 0.42 },
      edgeAllowances: {
        [dartHalfGap > 0 ? 6 : 4]: "hem",
      },
      cutQuantity: 2,
      seamAnchors: {
        raglanSeam: totalRaglanSleeveArcCm,
        sleeveCap: totalRaglanSleeveArcCm,
        armhole: totalRaglanSleeveArcCm,
      },
    },
    seamAllowance
  );

  return {
    frontNeckCmds: frontSplit.remainCmds,
    backNeckCmds: backSplit.remainCmds,
    frontNeckRemainArcCm: frontSplit.remainArcCm,
    backNeckRemainArcCm: backSplit.remainArcCm,
    totalNeckArcCm: Number((frontSplit.remainArcCm + backSplit.remainArcCm + frontSplit.wingArcCm + backSplit.wingArcCm).toFixed(2)),
    raglanUnderarmY,
    frontRaglanStart,
    backRaglanStart,
    frontBodyRaglanCmd,
    backBodyRaglanCmd,
    frontRaglanSeamCm,
    backRaglanSeamCm,
    frontNotches,
    backNotches,
    sleevePiece,
  };
}
