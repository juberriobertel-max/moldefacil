import {
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
  normalizePiece,
  splitCubicBezier,
} from "./geometry";

export interface PrincessBodiceSideParams {
  panelPrefix: "front" | "back";
  neckW: number;
  neckDrop: number;
  necklineStyle: NecklineStyle;
  shoulderX: number;
  shoulderSlope: number;
  armholeDepth: number;
  armholeCmd: Extract<PathCommand, { type: "C" }>;
  quarterBust: number;
  apexX: number;
  apexY: number;
  waistY: number;
  totalLen: number;
  hipDrop: number;
  torsoWaistX: number;
  quarterHip: number;
  hemHalfW: number;
  waistDartIntake: number;
  bustProjectionCm: number;
  isOpenCenter: boolean;
  centerExtCm?: number; // button placket extension on front_center (e.g. shirt_collar)
  hasCenterZipper?: boolean;
  extraCenterInternalLines?: PatternInternalLine[];
  extraCenterNotches?: PatternNotch[];
  extraSideNotches?: PatternNotch[];
  seamAllowance: SeamAllowance;
  labelPrefix?: string;
  targetSideSeamLenCm?: number;
}

export interface PrincessBodiceSideResult {
  centerPiece: PatternPiece;
  sidePiece: PatternPiece;
  princessLengthCm: number;
  upperArmholeLenCm: number;
  lowerArmholeLenCm: number;
  sideSeamLenCm: number;
}

/**
 * Generates an anatomically trued Armhole Princess Seam panel pair (`*_center` + `*_side`).
 * Splits the armhole Bézier curve cleanly using de Casteljau subdivision, routes the
 * contour through the bust/blade apex down to waist/hip/hem, absorbs all waist & bust
 * dart intake inside the princess seam, and iteratively trues Center vs Side seam lengths.
 */
export function buildPrincessBodicePanels(
  params: PrincessBodiceSideParams
): PrincessBodiceSideResult {
  const {
    panelPrefix,
    neckW,
    neckDrop,
    necklineStyle,
    shoulderX,
    shoulderSlope,
    armholeDepth,
    armholeCmd,
    quarterBust,
    apexX,
    apexY,
    waistY,
    totalLen,
    hipDrop,
    torsoWaistX,
    quarterHip,
    hemHalfW,
    waistDartIntake,
    bustProjectionCm,
    isOpenCenter,
    centerExtCm = 0,
    hasCenterZipper = false,
    extraCenterInternalLines = [],
    extraCenterNotches = [],
    extraSideNotches = [],
    seamAllowance,
    labelPrefix,
    targetSideSeamLenCm,
  } = params;

  const isFront = panelPrefix === "front";
  const splitT = isFront ? 0.48 : 0.45;
  const splitArm = splitCubicBezier(
    { x: shoulderX, y: shoulderSlope },
    { x: armholeCmd.cp1x, y: armholeCmd.cp1y },
    { x: armholeCmd.cp2x, y: armholeCmd.cp2y },
    { x: quarterBust, y: armholeDepth },
    splitT
  );

  const armUpperEnd = splitArm.first[3];
  const armUpperCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number(splitArm.first[1].x.toFixed(2)),
    cp1y: Number(splitArm.first[1].y.toFixed(2)),
    cp2x: Number(splitArm.first[2].x.toFixed(2)),
    cp2y: Number(splitArm.first[2].y.toFixed(2)),
    x: Number(armUpperEnd.x.toFixed(2)),
    y: Number(armUpperEnd.y.toFixed(2)),
  };
  const armLowerCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number(splitArm.second[1].x.toFixed(2)),
    cp1y: Number(splitArm.second[1].y.toFixed(2)),
    cp2x: Number(splitArm.second[2].x.toFixed(2)),
    cp2y: Number(splitArm.second[2].y.toFixed(2)),
    x: Number(splitArm.second[3].x.toFixed(2)),
    y: Number(splitArm.second[3].y.toFixed(2)),
  };

  const upperArmholeLenCm = Number(
    cubicBezierLength(
      { x: shoulderX, y: shoulderSlope },
      { x: armUpperCmd.cp1x, y: armUpperCmd.cp1y },
      { x: armUpperCmd.cp2x, y: armUpperCmd.cp2y },
      armUpperEnd,
      28
    ).toFixed(2)
  );
  const lowerArmholeLenCm = Number(
    cubicBezierLength(
      armUpperEnd,
      { x: armLowerCmd.cp1x, y: armLowerCmd.cp1y },
      { x: armLowerCmd.cp2x, y: armLowerCmd.cp2y },
      { x: quarterBust, y: armholeDepth },
      28
    ).toFixed(2)
  );

  const safeApexX = Math.max(5.5, Math.min(armUpperEnd.x - 1.5, apexX));
  const safeApexY = Math.max(armUpperEnd.y + 3.5, Math.min(waistY - 5.5, apexY));

  const centerWaistX = Number(
    Math.max(4.5, safeApexX - waistDartIntake * 0.42).toFixed(2)
  );
  const sideWaistInnerX = Number(
    (safeApexX + waistDartIntake * 0.58).toFixed(2)
  );
  // Hip / hem seam split maintains smooth continuous line below hip drop
  const hipY = Math.min(totalLen, waistY + hipDrop);
  const flareSpread = Math.max(0, hemHalfW - quarterHip) * 0.28;
  const centerHipX = Number(Math.max(4.8, safeApexX + flareSpread * 0.35).toFixed(2));
  const sideHipInnerX = Number(
    Math.max(centerHipX, safeApexX + waistDartIntake * 0.12 + flareSpread * 0.35).toFixed(2)
  );
  const centerHemX = Number((centerHipX + flareSpread * 0.65).toFixed(2));
  const sideHemInnerX = centerHemX;

  // Center Panel princess seam curves (from armUpperEnd -> apex -> waist -> hip -> hem)
  const centerUpperCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number((armUpperEnd.x - (armUpperEnd.x - safeApexX) * 0.65).toFixed(2)),
    cp1y: Number((armUpperEnd.y + (safeApexY - armUpperEnd.y) * 0.42).toFixed(2)),
    cp2x: Number(safeApexX.toFixed(2)),
    cp2y: Number((safeApexY - 2.4).toFixed(2)),
    x: Number(safeApexX.toFixed(2)),
    y: Number(safeApexY.toFixed(2)),
  };
  const centerWaistCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: Number(safeApexX.toFixed(2)),
    cp1y: Number((safeApexY + (waistY - safeApexY) * 0.45).toFixed(2)),
    cp2x: centerWaistX,
    cp2y: Number((waistY - 2.5).toFixed(2)),
    x: centerWaistX,
    y: waistY,
  };
  const centerLowerCommands: PathCommand[] =
    totalLen - waistY > 1
      ? [
          {
            type: "C",
            cp1x: centerWaistX,
            cp1y: Number((waistY + (hipY - waistY) * 0.45).toFixed(2)),
            cp2x: centerHipX,
            cp2y: Number((hipY - 2).toFixed(2)),
            x: centerHipX,
            y: hipY,
          },
          ...(totalLen > hipY + 0.5
            ? [{ type: "L" as const, x: centerHemX, y: totalLen }]
            : []),
        ]
      : [];

  const centerPrincessArcCm = Number(
    commandsArcLength([
      { type: "M", x: armUpperEnd.x, y: armUpperEnd.y },
      centerUpperCmd,
      centerWaistCmd,
      ...centerLowerCommands,
    ]).toFixed(2)
  );

  // Side Panel inner princess seam — includes breast cup projection (for front) and
  // iterative truing of the bust apex/curve bulge so Side === Center princess seam length.
  let cupCurveOutCm = isFront ? Math.min(2.8, Math.max(0.4, bustProjectionCm * 0.45)) : 0.2;
  let sideInnerCommands: PathCommand[] = [];
  let sidePrincessArcCm = centerPrincessArcCm;

  for (let iter = 0; iter < 5; iter++) {
    const midSideApexX = Number(Math.max(3.5, safeApexX - cupCurveOutCm).toFixed(2));
    const sideUpperCmd: Extract<PathCommand, { type: "C" }> = {
      type: "C",
      cp1x: Number((armUpperEnd.x - (armUpperEnd.x - midSideApexX) * 0.62).toFixed(2)),
      cp1y: Number((armUpperEnd.y + (safeApexY - armUpperEnd.y) * 0.45).toFixed(2)),
      cp2x: midSideApexX,
      cp2y: Number((safeApexY - 2.5).toFixed(2)),
      x: midSideApexX,
      y: Number(safeApexY.toFixed(2)),
    };
    const sideWaistCmd: Extract<PathCommand, { type: "C" }> = {
      type: "C",
      cp1x: midSideApexX,
      cp1y: Number((safeApexY + (waistY - safeApexY) * 0.45).toFixed(2)),
      cp2x: sideWaistInnerX,
      cp2y: Number((waistY - 2.5).toFixed(2)),
      x: sideWaistInnerX,
      y: waistY,
    };
    const sideLowerCmds: PathCommand[] =
      totalLen - waistY > 1
        ? [
            {
              type: "C",
              cp1x: sideWaistInnerX,
              cp1y: Number((waistY + (hipY - waistY) * 0.45).toFixed(2)),
              cp2x: sideHipInnerX,
              cp2y: Number((hipY - 2).toFixed(2)),
              x: sideHipInnerX,
              y: hipY,
            },
            ...(totalLen > hipY + 0.5
              ? [{ type: "L" as const, x: sideHemInnerX, y: totalLen }]
              : []),
          ]
        : [];

    sideInnerCommands = [sideUpperCmd, sideWaistCmd, ...sideLowerCmds];
    sidePrincessArcCm = Number(
      commandsArcLength([
        { type: "M", x: armUpperEnd.x, y: armUpperEnd.y },
        ...sideInnerCommands,
      ]).toFixed(2)
    );
    const err = centerPrincessArcCm - sidePrincessArcCm;
    if (Math.abs(err) < 0.05) break;
    cupCurveOutCm = Math.max(-1.0, Math.min(4.2, cupCurveOutCm + err * 0.65));
  }

  // Build Center Panel path
  const neckCmds = buildNecklineCommand(neckW, neckDrop, necklineStyle);
  const neckArcCm = Number(
    commandsArcLength([{ type: "M", x: 0, y: neckDrop }, ...neckCmds]).toFixed(2)
  );
  const shoulderLenCm = Number(Math.hypot(shoulderX - neckW, shoulderSlope).toFixed(2));

  const centerSeam: PathCommand[] = [
    ...(centerExtCm > 0
      ? [
          { type: "M" as const, x: -centerExtCm, y: neckDrop },
          { type: "L" as const, x: 0, y: neckDrop },
        ]
      : [{ type: "M" as const, x: 0, y: neckDrop }]),
    ...neckCmds,
    { type: "L", x: shoulderX, y: shoulderSlope },
    armUpperCmd,
    centerUpperCmd,
    centerWaistCmd,
    ...centerLowerCommands,
    { type: "L", x: -centerExtCm, y: totalLen },
    { type: "Z" },
  ];

  const isCutOnFold = !isOpenCenter && centerExtCm === 0;
  const centerEdgeAllowances: Record<number, "curve" | "seam" | "hem" | "fold" | "zipper"> =
    isFront
      ? {
          [centerExtCm > 0 ? 1 : 0]: "curve",
          [centerSeam.length - 3]: "hem",
          ...(isCutOnFold ? { [centerSeam.length - 2]: "fold" } : {}),
        }
      : {
          0: "curve",
          [centerSeam.length - 3]: "hem",
          [centerSeam.length - 2]: hasCenterZipper ? "zipper" : isCutOnFold ? "fold" : "seam",
        };

  const tagEs = labelPrefix ?? (isFront ? "Delantero" : "Espalda");
  const centerPiece = normalizePiece(
    {
      id: `${panelPrefix}_center`,
      name: isCutOnFold
        ? `CENTRO ${tagEs.toUpperCase()} PRINCESA (x1 doblez)`
        : `CENTRO ${tagEs.toUpperCase()} PRINCESA (x2)`,
      subtitle: `Corte princesa | Costura princesa: ${centerPrincessArcCm.toFixed(1)} cm`,
      tabLabel: `Centro ${tagEs}`,
      seamPath: centerSeam,
      grainline: {
        x1: Math.max(2.5, safeApexX * 0.42),
        y1: Math.max(neckDrop + 4, 12),
        x2: Math.max(2.5, safeApexX * 0.42),
        y2: totalLen - 6,
      },
      notches: [
        {
          x: Number(safeApexX.toFixed(2)),
          y: Number(safeApexY.toFixed(2)),
          angle: 0,
          label: isFront ? "Piquete busto" : "Piquete omóplato",
          count: isFront ? 1 : 2,
        },
        {
          x: centerWaistX,
          y: waistY,
          angle: 0,
          label: "Cintura princesa",
        },
        ...extraCenterNotches,
      ],
      internalLines:
        extraCenterInternalLines.length > 0 ? extraCenterInternalLines : undefined,
      labelPos: { x: Math.max(3, safeApexX * 0.48), y: waistY * 0.65 },
      labelMaxSpanCm: Math.max(8, centerWaistX - 1),
      foldLine: isCutOnFold ? { x1: 0, y1: neckDrop, x2: 0, y2: totalLen } : undefined,
      edgeAllowances: centerEdgeAllowances,
      cutQuantity: isCutOnFold ? 1 : 2,
      cutOnFold: isCutOnFold,
      seamAnchors: {
        shoulder: shoulderLenCm,
        armhole: upperArmholeLenCm,
        neckline: neckArcCm,
        princessSeam: centerPrincessArcCm,
      },
    },
    seamAllowance
  );

  // Build Side Panel path (outer armhole + smooth outer side seam -> hem -> inner princess seam)
  let outerBottomY = totalLen;
  let outerHipY = hipY;
  let sideLowerCommands: PathCommand[] = [];
  let sideSeamLenCm = 0;

  for (let iter = 0; iter < 5; iter++) {
    const sideSeamUpperLen = Math.hypot(
      torsoWaistX - quarterBust,
      waistY - armholeDepth
    );
    outerHipY = Math.min(outerBottomY, waistY + hipDrop);
    sideLowerCommands =
      outerBottomY - waistY > 1
        ? [
            {
              type: "C",
              cp1x: Number((torsoWaistX + (quarterHip - torsoWaistX) * 0.45).toFixed(2)),
              cp1y: Number((waistY + (outerHipY - waistY) * 0.35).toFixed(2)),
              cp2x: quarterHip,
              cp2y: Number((waistY + (outerHipY - waistY) * 0.72).toFixed(2)),
              x: quarterHip,
              y: outerHipY,
            },
            ...(outerBottomY > outerHipY + 0.5
              ? [{ type: "L" as const, x: hemHalfW, y: Number(outerBottomY.toFixed(2)) }]
              : []),
          ]
        : [];
    sideSeamLenCm = Number(
      (
        sideSeamUpperLen +
        commandsArcLength([{ type: "M", x: torsoWaistX, y: waistY }, ...sideLowerCommands])
      ).toFixed(2)
    );
    if (typeof targetSideSeamLenCm !== "number") break;
    const err = targetSideSeamLenCm - sideSeamLenCm;
    if (Math.abs(err) < 0.04) break;
    outerBottomY = Number(
      Math.max(waistY + 4, outerBottomY + err).toFixed(2)
    );
  }

  // Reverse inner princess seam to close side panel cleanly (start at armUpperEnd, trace lower armhole -> side -> hem -> reverse inner)
  const innerPolyCommandsReverse: PathCommand[] = buildReverseCommandsFrom(
    armUpperEnd,
    sideInnerCommands
  );

  const sideSeam: PathCommand[] = [
    { type: "M", x: armUpperEnd.x, y: armUpperEnd.y },
    armLowerCmd,
    { type: "L", x: torsoWaistX, y: waistY },
    ...sideLowerCommands,
    { type: "L", x: sideHemInnerX, y: totalLen },
    ...innerPolyCommandsReverse,
    { type: "Z" },
  ];

  const sideApexPtX = Number(Math.max(3.5, safeApexX - cupCurveOutCm).toFixed(2));
  const sideMidX = Number(
    ((sideWaistInnerX + torsoWaistX) * 0.5).toFixed(2)
  );

  const sidePiece = normalizePiece(
    {
      id: `${panelPrefix}_side`,
      name: `COSTADILLO ${tagEs.toUpperCase()} PRINCESA (x2)`,
      subtitle: `Sisa inf: ${lowerArmholeLenCm.toFixed(1)} cm | Princesa: ${sidePrincessArcCm.toFixed(1)} cm`,
      tabLabel: `Costadillo ${tagEs}`,
      seamPath: sideSeam,
      grainline: {
        x1: sideMidX,
        y1: armholeDepth + 3,
        x2: sideMidX,
        y2: totalLen - 6,
      },
      notches: [
        {
          x: sideApexPtX,
          y: Number(safeApexY.toFixed(2)),
          angle: 180,
          label: isFront ? "Piquete busto" : "Piquete omóplato",
          count: isFront ? 1 : 2,
        },
        {
          x: sideWaistInnerX,
          y: waistY,
          angle: 180,
          label: "Cintura princesa",
        },
        {
          x: torsoWaistX,
          y: waistY,
          angle: 0,
          label: "Costado cintura",
        },
        ...extraSideNotches,
      ],
      labelPos: { x: sideMidX, y: waistY * 0.72 },
      labelMaxSpanCm: Math.max(6, Math.abs(torsoWaistX - sideWaistInnerX) + 4),
      edgeAllowances: {
        0: "curve",
        [sideSeam.length - innerPolyCommandsReverse.length - 2]: "hem",
      },
      cutQuantity: 2,
      cutOnFold: false,
      seamAnchors: {
        armhole: lowerArmholeLenCm,
        sideSeam: sideSeamLenCm,
        princessSeam: sidePrincessArcCm,
      },
    },
    seamAllowance
  );

  return {
    centerPiece,
    sidePiece,
    princessLengthCm: centerPrincessArcCm,
    upperArmholeLenCm,
    lowerArmholeLenCm,
    sideSeamLenCm,
  };
}

/**
 * Reverses a continuous sequence of L / C commands starting from `startPt`
 * so the returned commands trace backward from the final point back to `startPt`.
 */
function buildReverseCommandsFrom(
  startPt: { x: number; y: number },
  commands: PathCommand[]
): PathCommand[] {
  const segs: { from: { x: number; y: number }; cmd: PathCommand }[] = [];
  let cur = { ...startPt };
  for (const cmd of commands) {
    if (cmd.type === "L" || cmd.type === "C") {
      segs.push({ from: cur, cmd });
      cur = { x: cmd.x, y: cmd.y };
    }
  }
  const rev: PathCommand[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const { from, cmd } = segs[i];
    if (cmd.type === "L") {
      rev.push({ type: "L", x: from.x, y: from.y });
    } else if (cmd.type === "C") {
      rev.push({
        type: "C",
        cp1x: cmd.cp2x,
        cp1y: cmd.cp2y,
        cp2x: cmd.cp1x,
        cp2y: cmd.cp1y,
        x: from.x,
        y: from.y,
      });
    }
  }
  return rev;
}
