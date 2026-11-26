import {
  FabricType,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PathCommand,
  PatternInternalLine,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
} from "../types";
import {
  buildFinishedMeasurements,
  buildNecklineCommand,
  commandsArcLength,
  computeCuttingLayout,
  computeEase,
  cubicBezierLength,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import {
  buildFlapPocketPieces,
  buildHemRufflePiece,
  buildKimonoWingSegment,
  buildPocketBagPiece,
  buildRibNeckbandPiece,
  buildShirtCuffPiece,
  buildShirtDressDetailPieces,
  buildSleevePiece,
  buildTailoredCollarAndFacingPieces,
  buildTailoredLapelFrontGeometry,
  buildTwoPieceTailoredSleevePieces,
  buildVerticalWaistDart,
  buildWaistTiePiece,
  buildWrapFacingPiece,
  computeTorsoWaistHalfWidth,
  createFlapPocketMarkLine,
  createSidePocketNotches,
} from "./extrasEngine";
import { buildAnatomicalNeckFacing, buildTruedSideBustDart } from "./dartUtils";
import { resolveProMeasurements } from "../seamValidator";

export interface TopEngineInput {
  measurements: Measurements;
  subStyle: TopSubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle?: SleeveStyle;
  torsoFit?: TorsoFit;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  necklineDropRatio?: number;
  armholeDepthMultiplier?: number;
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
    torsoFit = "fitted",
    seamAllowance,
    fabricType,
    necklineDropRatio,
    armholeDepthMultiplier = 1,
    lengthMultiplier = 1,
    extras,
    styleVariant = "default",
  } = input;

  const pro = resolveProMeasurements(measurements);
  const isTailoredGarment =
    subStyle === "jacket" || necklineStyle === "tailored_lapel";
  const isWrapFront = Boolean(extras?.wrapFront);
  const useTailoredLapel =
    isTailoredGarment && !isWrapFront && necklineStyle !== "shirt_collar";
  const useShirtCollar =
    !isWrapFront && !useTailoredLapel && necklineStyle === "shirt_collar";

  const extraEase =
    subStyle === "jacket"
      ? 4
      : isTailoredGarment
        ? 3
        : subStyle === "blouse"
          ? 1
          : 0;
  const { easeFactor, flatEase, label } = computeEase(
    fabricType,
    extraEase,
    torsoFit
  );

  const effBust = measurements.bust * easeFactor + flatEase;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;

  // Anatomical front/back balance: +1.0 cm front, -1.0 cm back on woven; +0.5/-0.5 on stretch
  const bustSplit = fabricType === "woven" ? 1.0 : 0.4;
  const quarterBust = effBust / 4;
  const frontQuarterBust = quarterBust + bustSplit;
  const backQuarterBust = Math.max(frontQuarterBust - 2.0, quarterBust - bustSplit);
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;
  const frontQuarterHip = quarterHip + bustSplit * 0.5;
  const backQuarterHip = quarterHip - bustSplit * 0.5;

  const baseWaistX = computeTorsoWaistHalfWidth({
    quarterBust,
    quarterWaist,
    quarterHip,
    torsoFit,
  });
  const frontBaseWaistX = baseWaistX + bustSplit * 0.5;
  const backBaseWaistX = Math.max(12, baseWaistX - bustSplit * 0.5);

  const useWaistDart =
    fabricType === "woven" &&
    torsoFit === "fitted" &&
    (isTailoredGarment || subStyle === "blouse");
  const waistDartIntake = isTailoredGarment ? 2.8 : 2.2;
  const frontTorsoWaistX = useWaistDart ? frontBaseWaistX + waistDartIntake : frontBaseWaistX;
  const backTorsoWaistX = useWaistDart ? backBaseWaistX + waistDartIntake : backBaseWaistX;

  const halfBack = effBack / 2;

  const backBodiceLen = pro.backBodiceLength * lengthMultiplier;
  const rawFrontBodiceLen = pro.frontBodiceLength * lengthMultiplier;
  const hipExt = (isTailoredGarment ? 18 : 14) * lengthMultiplier;
  const backTotalLen = backBodiceLen + hipExt;

  const isKimono = sleeveStyle === "kimono";
  const isPeasant = styleVariant === "peasant_offshoulder";
  const useSideBustDart =
    fabricType === "woven" &&
    torsoFit === "fitted" &&
    !isKimono &&
    (subStyle === "blouse" || subStyle === "jacket" || styleVariant === "office_dart");

  const bustDartIntake = useSideBustDart
    ? Math.max(2.0, Math.min(4.5, rawFrontBodiceLen - backBodiceLen || 2.4))
    : 0;
  const frontBodiceLen = useSideBustDart
    ? backBodiceLen + bustDartIntake
    : backBodiceLen;
  const frontTotalLen = frontBodiceLen + hipExt;

  const neckW = Math.max(6.2, effBust * (isPeasant ? 0.115 : 0.075));
  const baseNeckDrop =
    necklineStyle === "v_neck" || necklineStyle === "tailored_lapel"
      ? 14
      : necklineStyle === "square"
        ? 10.5
        : necklineStyle === "high" || necklineStyle === "shirt_collar"
          ? 4.2
          : 9;
  const frontNeckDrop = necklineDropRatio
    ? Math.max(4.0, backBodiceLen * necklineDropRatio)
    : baseNeckDrop;
  const backNeckDrop = 2.5;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const backShoulderEase = isTailoredGarment ? 0.6 : 0;
  const armholeDepth = Math.max(16, effBust * 0.215 * armholeDepthMultiplier);

  // Back side seam target length (armhole corner -> waist corner) for exact matching
  const backSideSeamUpperLen = Math.hypot(
    backTorsoWaistX - backQuarterBust,
    backBodiceLen - armholeDepth
  );
  const hipCurveLenFront = cubicBezierLength(
    { x: frontTorsoWaistX, y: frontBodiceLen },
    {
      x: frontTorsoWaistX + (frontQuarterHip - frontTorsoWaistX) * 0.45,
      y: frontBodiceLen + hipExt * 0.35,
    },
    { x: frontQuarterHip, y: frontBodiceLen + hipExt * 0.75 },
    { x: frontQuarterHip, y: frontTotalLen },
    24
  );
  const hipCurveLenBack = cubicBezierLength(
    { x: backTorsoWaistX, y: backBodiceLen },
    {
      x: backTorsoWaistX + (backQuarterHip - backTorsoWaistX) * 0.45,
      y: backBodiceLen + hipExt * 0.35,
    },
    { x: backQuarterHip, y: backBodiceLen + hipExt * 0.75 },
    { x: backQuarterHip, y: backTotalLen },
    24
  );

  // Solve front side dart so closed front upper side seam matches backSideSeamUpperLen
  let truedBustDart: ReturnType<typeof buildTruedSideBustDart> | null = null;
  let solvedFrontSideWaistY = frontBodiceLen;
  if (useSideBustDart) {
    for (let iter = 0; iter < 3; iter++) {
      truedBustDart = buildTruedSideBustDart({
        topPoint: { x: frontQuarterBust, y: armholeDepth },
        botPoint: { x: frontTorsoWaistX, y: solvedFrontSideWaistY },
        apex: {
          x: pro.bustSeparation / 2,
          y: pro.bustHeight * lengthMultiplier,
        },
        intakeCm: bustDartIntake,
        label: "Pinza de busto",
      });
      const err = backSideSeamUpperLen - truedBustDart.closedSideLengthCm;
      if (Math.abs(err) < 0.04) break;
      solvedFrontSideWaistY = Number((solvedFrontSideWaistY + err).toFixed(2));
    }
  }
  const frontWaistCornerY = useSideBustDart ? solvedFrontSideWaistY : frontBodiceLen;
  const frontTotalHemY = frontWaistCornerY + hipExt;

  const kimonoWing = isKimono
    ? buildKimonoWingSegment({
        neckW,
        shoulderX,
        shoulderSlope,
        sleeveLengthCm: measurements.sleeveLength,
        armholeDepth,
        quarterBust: frontQuarterBust,
        sideWaistX: frontTorsoWaistX,
        sideWaistY: frontBodiceLen,
        torsoFit,
        flaredSleeve: extras?.flaredSleeve,
      })
    : null;
  const kimonoBackWing = isKimono
    ? buildKimonoWingSegment({
        neckW,
        shoulderX,
        shoulderSlope,
        sleeveLengthCm: measurements.sleeveLength,
        armholeDepth,
        quarterBust: backQuarterBust,
        sideWaistX: backTorsoWaistX,
        sideWaistY: backBodiceLen,
        torsoFit,
        flaredSleeve: extras?.flaredSleeve,
      })
    : null;

  const frontArmholeCmd: PathCommand = {
    type: "C",
    cp1x: shoulderX - 2.2,
    cp1y: armholeDepth * 0.54,
    cp2x: frontQuarterBust * 0.82,
    cp2y: armholeDepth,
    x: frontQuarterBust,
    y: armholeDepth,
  };
  const backArmholeCmd: PathCommand = {
    type: "C",
    cp1x: shoulderX + backShoulderEase - 0.3,
    cp1y: armholeDepth * 0.58,
    cp2x: backQuarterBust * 0.88,
    cp2y: armholeDepth,
    x: backQuarterBust,
    y: armholeDepth,
  };

  const frontArmholeLen = cubicBezierLength(
    { x: shoulderX, y: shoulderSlope },
    { x: frontArmholeCmd.cp1x, y: frontArmholeCmd.cp1y },
    { x: frontArmholeCmd.cp2x, y: frontArmholeCmd.cp2y },
    { x: frontQuarterBust, y: armholeDepth }
  );
  const backArmholeLen = cubicBezierLength(
    { x: shoulderX + backShoulderEase, y: shoulderSlope },
    { x: backArmholeCmd.cp1x, y: backArmholeCmd.cp1y },
    { x: backArmholeCmd.cp2x, y: backArmholeCmd.cp2y },
    { x: backQuarterBust, y: armholeDepth }
  );
  const totalArmholePerimeter = frontArmholeLen + backArmholeLen;

  const frontNeckCmds = buildNecklineCommand(neckW, frontNeckDrop, necklineStyle);
  const backNeckCmds = buildNecklineCommand(neckW, backNeckDrop, "round");
  const frontNeckArc = commandsArcLength([
    { type: "M", x: 0, y: frontNeckDrop },
    ...frontNeckCmds,
  ]);
  const backNeckArc = commandsArcLength([
    { type: "M", x: 0, y: backNeckDrop },
    ...backNeckCmds,
  ]);

  const pieces: PatternPiece[] = [];
  const wrapOverlap = Math.round(quarterWaist * 0.6);
  const pocketNotches = extras?.sidePockets
    ? createSidePocketNotches({
        waistX: frontTorsoWaistX,
        waistY: Math.max(armholeDepth + 4, frontWaistCornerY - 6),
        hipX: frontQuarterHip,
        hipY: frontTotalHemY,
      })
    : [];

  const frontUpperSide: PathCommand[] = kimonoWing
    ? [...kimonoWing.commands, { type: "L", x: frontTorsoWaistX, y: frontWaistCornerY }]
    : [
        { type: "L", x: shoulderX, y: shoulderSlope },
        frontArmholeCmd,
        ...(truedBustDart
          ? truedBustDart.sideCommands
          : [{ type: "L" as const, x: frontTorsoWaistX, y: frontWaistCornerY }]),
      ];

  const lapelGeom = useTailoredLapel
    ? buildTailoredLapelFrontGeometry({
        neckW,
        frontNeckDrop,
        armholeDepth,
        bodiceLen: frontWaistCornerY,
        totalLen: frontTotalHemY,
      })
    : null;

  // Shirt button extension and buttonholes on front piece
  const shirtExt = 1.8;
  const shirtButtonLines: PatternInternalLine[] = [];
  if (useShirtCollar) {
    shirtButtonLines.push({
      commands: [
        { type: "M", x: 0, y: frontNeckDrop },
        { type: "L", x: 0, y: frontTotalHemY },
      ],
      style: "mark",
      label: "Centro",
    });
    const count = 6;
    const span = Math.max(20, frontTotalHemY - frontNeckDrop - 8);
    for (let i = 0; i < count; i++) {
      const by = Number((frontNeckDrop + 3 + (i * span) / (count - 1)).toFixed(1));
      shirtButtonLines.push({
        commands: [
          { type: "M", x: -0.7, y: by },
          { type: "L", x: 0.7, y: by },
        ],
        style: "buttonhole",
      });
    }
  }

  const frontInternalLines: PatternInternalLine[] = [
    ...(lapelGeom ? lapelGeom.internalLines : []),
    ...shirtButtonLines,
    ...(truedBustDart ? [truedBustDart.internalLine] : []),
    ...(useWaistDart
      ? [
          buildVerticalWaistDart({
            centerX: Number(Math.max(6.5, pro.bustSeparation / 2).toFixed(2)),
            topY: Number((pro.bustHeight * lengthMultiplier + 2.5).toFixed(2)),
            waistY: frontWaistCornerY,
            botY: Math.min(frontTotalHemY - 3, frontWaistCornerY + hipExt * 0.68),
            halfWidthCm: Number((waistDartIntake / 2).toFixed(2)),
            label: "Pinza de entalle",
          }),
        ]
      : []),
    ...(extras?.flapPockets
      ? [
          createFlapPocketMarkLine({
            xStart: Math.max(3.5, quarterWaist * 0.22),
            yTop: Math.min(frontTotalHemY - 5, frontWaistCornerY + 4.5),
            widthCm: Math.min(14.5, Math.max(10.5, quarterHip * 0.52)),
          }),
        ]
      : []),
  ];

  // 1. DELANTERO
  const frontSeam: PathCommand[] = isWrapFront
    ? [
        { type: "M", x: neckW, y: 0 },
        ...frontUpperSide,
        {
          type: "C",
          cp1x: frontTorsoWaistX + (frontQuarterHip - frontTorsoWaistX) * 0.45,
          cp1y: frontWaistCornerY + hipExt * 0.35,
          cp2x: frontQuarterHip,
          cp2y: frontWaistCornerY + hipExt * 0.75,
          x: frontQuarterHip,
          y: frontTotalHemY,
        },
        { type: "L", x: -wrapOverlap, y: frontTotalHemY },
        { type: "L", x: -wrapOverlap, y: frontWaistCornerY },
        {
          type: "C",
          cp1x: -wrapOverlap * 0.35,
          cp1y: frontWaistCornerY * 0.62,
          cp2x: neckW * 0.55,
          cp2y: frontWaistCornerY * 0.25,
          x: neckW,
          y: 0,
        },
        { type: "Z" },
      ]
    : lapelGeom
      ? [
          { type: "M", x: neckW, y: 0 },
          ...frontUpperSide,
          {
            type: "C",
            cp1x: frontTorsoWaistX + (frontQuarterHip - frontTorsoWaistX) * 0.45,
            cp1y: frontWaistCornerY + hipExt * 0.35,
            cp2x: frontQuarterHip,
            cp2y: frontWaistCornerY + hipExt * 0.75,
            x: frontQuarterHip,
            y: frontTotalHemY,
          },
          ...lapelGeom.closingCommands,
          { type: "Z" },
        ]
      : useShirtCollar
        ? [
            { type: "M", x: -shirtExt, y: frontNeckDrop },
            { type: "L", x: 0, y: frontNeckDrop },
            ...frontNeckCmds,
            ...frontUpperSide,
            {
              type: "C",
              cp1x: frontTorsoWaistX + (frontQuarterHip - frontTorsoWaistX) * 0.45,
              cp1y: frontWaistCornerY + hipExt * 0.35,
              cp2x: frontQuarterHip,
              cp2y: frontWaistCornerY + hipExt * 0.75,
              x: frontQuarterHip,
              y: frontTotalHemY,
            },
            { type: "L", x: -shirtExt, y: frontTotalHemY },
            { type: "Z" },
          ]
        : [
            { type: "M", x: 0, y: frontNeckDrop },
            ...frontNeckCmds,
            ...frontUpperSide,
            {
              type: "C",
              cp1x: frontTorsoWaistX + (frontQuarterHip - frontTorsoWaistX) * 0.45,
              cp1y: frontWaistCornerY + hipExt * 0.35,
              cp2x: frontQuarterHip,
              cp2y: frontWaistCornerY + hipExt * 0.75,
              x: frontQuarterHip,
              y: frontTotalHemY,
            },
            { type: "L", x: 0, y: frontTotalHemY },
            { type: "Z" },
          ];

  const isOpenFront =
    subStyle === "jacket" || isWrapFront || useTailoredLapel || useShirtCollar;
  const frontShoulderLen = Math.hypot(shoulderX - neckW, shoulderSlope);
  const frontUpperSideMeasured = truedBustDart
    ? truedBustDart.closedSideLengthCm
    : Math.hypot(frontTorsoWaistX - frontQuarterBust, frontWaistCornerY - armholeDepth);

  pieces.push(
    normalizePiece(
      {
        id: "front",
        name: isWrapFront
          ? "DELANTERO CRUZADO (x2)"
          : useTailoredLapel
            ? "DELANTERO CHAQUETA / BLAZER (x2)"
            : useShirtCollar
              ? "DELANTERO CAMISA C/ CRUCE (x2)"
              : subStyle === "jacket"
                ? "DELANTERO CHAQUETA (x2)"
                : "DELANTERO (x1 al doblez)",
        subtitle: isWrapFront
          ? kimonoWing
            ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Cortar 2 piezas`
            : "Cortar 2 piezas (Izquierda y Derecha)"
          : useTailoredLapel
            ? "Con cruce, solapa y pinzas | Cortar 2 piezas"
            : truedBustDart
              ? `Pinza busto afinada | Sisa del: ${frontArmholeLen.toFixed(1)} cm`
              : kimonoWing
                ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoWing.underarmCurveLenCm} cm`
                : `Sisa del: ${frontArmholeLen.toFixed(1)} cm`,
        tabLabel: isWrapFront
          ? "Delantero Cruzado"
          : useTailoredLapel
            ? "Delantero Solapa"
            : "Delantero",
        seamPath: frontSeam,
        grainline: {
          x1: Math.max(4, frontBaseWaistX * 0.45),
          y1: Math.max(frontNeckDrop + 3, 12),
          x2: Math.max(4, frontBaseWaistX * 0.45),
          y2: frontTotalHemY - 6,
        },
        notches: [
          ...(kimonoWing
            ? [
                {
                  x: kimonoWing.outerX,
                  y: kimonoWing.outerDropY,
                  angle: 0,
                  label: "Puño Kimono",
                },
                {
                  x: kimonoWing.joinX,
                  y: kimonoWing.joinY,
                  angle: 0,
                  label: "Axila",
                },
              ]
            : [
                {
                  x: Number((shoulderX - (shoulderX - frontQuarterBust) * 0.25).toFixed(2)),
                  y: Number((armholeDepth * 0.65).toFixed(2)),
                  angle: 0,
                  label: "Sisa del.",
                  count: 1 as const,
                },
              ]),
          {
            x: frontTorsoWaistX,
            y: frontWaistCornerY,
            angle: 0,
            label: torsoFit === "loose" ? "Cintura holgada" : "Cintura",
          },
          ...(lapelGeom ? lapelGeom.notches : []),
          ...(isWrapFront
            ? [
                { x: 0, y: frontWaistCornerY, angle: 90, label: "Centro Delantero" },
                { x: -wrapOverlap, y: frontWaistCornerY, angle: 180, label: "Cruce cintura" },
              ]
            : []),
          ...pocketNotches,
        ],
        internalLines: frontInternalLines.length > 0 ? frontInternalLines : undefined,
        labelPos: { x: frontBaseWaistX * 0.48, y: frontBodiceLen * 0.68 },
        foldLine: isOpenFront
          ? undefined
          : { x1: 0, y1: frontNeckDrop, x2: 0, y2: frontTotalHemY },
        edgeAllowances: isOpenFront
          ? { 0: "curve" }
          : {
              0: "curve",
              1: "seam",
              2: "curve",
            },
        cutQuantity: isOpenFront ? 2 : 1,
        cutOnFold: !isOpenFront,
        seamAnchors: {
          shoulder: Number(frontShoulderLen.toFixed(2)),
          sideSeam: Number((frontUpperSideMeasured + hipCurveLenFront).toFixed(2)),
          armhole: Number(frontArmholeLen.toFixed(2)),
          neckline: Number(frontNeckArc.toFixed(2)),
        },
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
        wrapWaistY: frontWaistCornerY,
        seamAllowance,
      })
    );
  }

  // 2. TRASERO
  const backShoulderX = shoulderX + backShoulderEase;
  const backUpperSide: PathCommand[] = kimonoBackWing
    ? [...kimonoBackWing.commands, { type: "L", x: backTorsoWaistX, y: backBodiceLen }]
    : [
        { type: "L", x: backShoulderX, y: shoulderSlope },
        backArmholeCmd,
        { type: "L", x: backTorsoWaistX, y: backBodiceLen },
      ];

  const backSeam: PathCommand[] = [
    { type: "M", x: 0, y: backNeckDrop },
    ...backNeckCmds,
    ...backUpperSide,
    {
      type: "C",
      cp1x: backTorsoWaistX + (backQuarterHip - backTorsoWaistX) * 0.45,
      cp1y: backBodiceLen + hipExt * 0.35,
      cp2x: backQuarterHip,
      cp2y: backBodiceLen + hipExt * 0.75,
      x: backQuarterHip,
      y: backTotalLen,
    },
    { type: "L", x: 0, y: backTotalLen },
    { type: "Z" },
  ];

  const backShoulderLen = Math.hypot(backShoulderX - neckW, shoulderSlope);

  pieces.push(
    normalizePiece(
      {
        id: "back",
        name: "TRASERO (x1 al doblez)",
        subtitle: kimonoBackWing
          ? `Manga Kimono (${kimonoBackWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoBackWing.underarmCurveLenCm} cm`
          : `Sisa tras: ${backArmholeLen.toFixed(1)} cm`,
        tabLabel: "Trasero",
        seamPath: backSeam,
        grainline: {
          x1: Math.max(4, backBaseWaistX * 0.45),
          y1: 10,
          x2: Math.max(4, backBaseWaistX * 0.45),
          y2: backTotalLen - 6,
        },
        notches: [
          ...(kimonoBackWing
            ? [
                {
                  x: kimonoBackWing.outerX,
                  y: kimonoBackWing.outerDropY,
                  angle: 0,
                  label: "Puño Kimono",
                },
                {
                  x: kimonoBackWing.joinX,
                  y: kimonoBackWing.joinY,
                  angle: 0,
                  label: "Axila",
                },
              ]
            : [
                {
                  x: Number((backShoulderX - (backShoulderX - backQuarterBust) * 0.25).toFixed(2)),
                  y: Number((armholeDepth * 0.65).toFixed(2)),
                  angle: 0,
                  label: "Sisa tras.",
                  count: 2 as const,
                },
              ]),
          {
            x: backTorsoWaistX,
            y: backBodiceLen,
            angle: 0,
            label: torsoFit === "loose" ? "Cintura holgada" : "Cintura",
          },
        ],
        labelPos: { x: backBaseWaistX * 0.48, y: backBodiceLen * 0.7 },
        internalLines: useWaistDart
          ? [
              buildVerticalWaistDart({
                centerX: Math.max(6.0, backQuarterBust * 0.44),
                topY: armholeDepth + 3.0,
                waistY: backBodiceLen,
                botY: Math.min(backTotalLen - 3, backBodiceLen + hipExt * 0.68),
                halfWidthCm: Number((waistDartIntake / 2).toFixed(2)),
                label: "Pinza espalda",
              }),
            ]
          : undefined,
        foldLine: { x1: 0, y1: backNeckDrop, x2: 0, y2: backTotalLen },
        edgeAllowances: {
          0: "curve",
          1: "seam",
          2: "curve",
          4: "hem",
          5: "fold",
        },
        cutQuantity: 1,
        cutOnFold: true,
        seamAnchors: {
          shoulder: Number(backShoulderLen.toFixed(2)),
          sideSeam: Number((backSideSeamUpperLen + hipCurveLenBack).toFixed(2)),
          armhole: Number(backArmholeLen.toFixed(2)),
          neckline: Number(backNeckArc.toFixed(2)),
        },
      },
      seamAllowance
    )
  );

  // 3. MANGA (Manga sastre de 2 hojas para Blazer woven largo; manga asimétrica con puño en camisa)
  const useTwoPieceSleeve =
    subStyle === "jacket" &&
    sleeveStyle === "long" &&
    fabricType === "woven" &&
    !extras?.flaredSleeve;
  const withShirtCuff =
    useShirtCollar &&
    sleeveStyle === "long" &&
    fabricType === "woven" &&
    !extras?.flaredSleeve;

  if (useTwoPieceSleeve) {
    pieces.push(
      ...buildTwoPieceTailoredSleevePieces({
        armholeDepth,
        totalArmholePerimeter,
        sleeveLengthCm: measurements.sleeveLength,
        bicepCm: pro.bicep,
        wristCm: pro.wrist,
        seamAllowance,
      })
    );
  } else {
    const sleevePiece = buildSleevePiece({
      armholeDepth,
      totalArmholePerimeter,
      sleeveLengthCm: measurements.sleeveLength,
      sleeveStyle,
      flaredSleeve: extras?.flaredSleeve,
      seamAllowance,
      fabricType,
      garmentKind:
        subStyle === "jacket" ? "jacket" : subStyle === "tshirt" ? "tshirt" : "blouse",
      bicepCm: pro.bicep,
      wristCm: pro.wrist,
      withShirtCuff,
    });
    if (sleevePiece) {
      pieces.push(sleevePiece);
      if (withShirtCuff) {
        pieces.push(
          buildShirtCuffPiece({
            wristCm: pro.wrist,
            seamAllowance,
          })
        );
      }
    }
  }

  // 4. CUELLOS / VISTAS ANATÓMICAS
  if (!isWrapFront) {
    if (useTailoredLapel) {
      pieces.push(
        ...buildTailoredCollarAndFacingPieces({
          neckW,
          shoulderX,
          shoulderSlope,
          frontNeckDrop,
          armholeDepth,
          bodiceLen: frontWaistCornerY,
          totalLen: frontTotalHemY,
          seamAllowance,
        })
      );
    } else if (useShirtCollar) {
      pieces.push(
        ...buildShirtDressDetailPieces({
          neckW,
          frontLengthCm: frontTotalHemY - frontNeckDrop,
          seamAllowance,
          totalHalfNeckPerimeter: frontNeckArc + backNeckArc,
        })
      );
    } else if (subStyle === "tshirt" && fabricType === "stretch") {
      pieces.push(
        buildRibNeckbandPiece({
          totalNeckPerimeterCm: (frontNeckArc + backNeckArc) * 2,
          seamAllowance,
        })
      );
    } else {
      pieces.push(
        buildAnatomicalNeckFacing({
          id: "front_neck_facing",
          name:
            subStyle === "jacket"
              ? "VISTA ESCOTE DELANTERO (x2 + Entretela)"
              : "VISTA ESCOTE DELANTERO (x1 doblez)",
          tabLabel: "Vista Delantera",
          neckWidth: neckW,
          neckDrop: frontNeckDrop,
          style: necklineStyle,
          widthCm: subStyle === "jacket" ? 5.5 : 4.5,
          isFront: true,
          seamAllowance,
          openFront: subStyle === "jacket",
        }),
        buildAnatomicalNeckFacing({
          id: "back_neck_facing",
          name: "VISTA ESCOTE TRASERO (x1 doblez)",
          tabLabel: "Vista Trasera",
          neckWidth: neckW,
          neckDrop: backNeckDrop,
          style: "round",
          widthCm: subStyle === "jacket" ? 5.5 : 4.5,
          isFront: false,
          seamAllowance,
          openFront: false,
        })
      );
    }
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
  if (extras?.flapPockets) {
    pieces.push(...buildFlapPocketPieces(seamAllowance));
  }

  const subLabels: Record<TopSubStyle, string> = {
    tshirt: isWrapFront ? "Top Cruzado" : "Camiseta Base",
    blouse: isWrapFront
      ? "Blusa Cruzada (Envolvente)"
      : useTailoredLapel
        ? "Blusa con Solapa Sastre"
        : useShirtCollar
          ? "Camisa Clásica con Puño y Tirilla"
          : "Blusa Anatómica",
    jacket: "Chaqueta / Blazer Sastre",
  };

  const finishedMeasurements = buildFinishedMeasurements([
    { label: "Contorno de Busto", bodyCm: measurements.bust, finishedCm: effBust },
    { label: "Contorno de Cintura", bodyCm: measurements.waist, finishedCm: effWaist },
    { label: "Contorno de Cadera", bodyCm: measurements.hip, finishedCm: effHip },
    { label: "Largo Talle Delantero", bodyCm: pro.frontBodiceLength, finishedCm: frontBodiceLen },
    { label: "Largo Talle Espalda", bodyCm: pro.backBodiceLength, finishedCm: backBodiceLen },
  ]);

  const cuttingLayout = computeCuttingLayout(pieces, 140);

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
    finishedMeasurements,
    cuttingLayout,
  };
}
