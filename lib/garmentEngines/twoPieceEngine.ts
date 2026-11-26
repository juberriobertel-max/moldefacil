import {
  FabricType,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PantsSubStyle,
  PathCommand,
  PatternInternalLine,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  TorsoFit,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
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
import { generateSkirtPattern } from "./skirtEngine";
import { generatePantsPattern } from "./pantsEngine";
import {
  buildFlapPocketPieces,
  buildKimonoWingSegment,
  buildRibNeckbandPiece,
  buildShirtCuffPiece,
  buildShirtDressDetailPieces,
  buildSleevePiece,
  buildTailoredCollarAndFacingPieces,
  buildTailoredLapelFrontGeometry,
  buildTwoPieceTailoredSleevePieces,
  buildVerticalWaistDart,
  buildWaistbandPiece,
  buildWaistTiePiece,
  buildWrapFacingPiece,
  computeTorsoWaistHalfWidth,
  createFlapPocketMarkLine,
} from "./extrasEngine";
import { buildAnatomicalNeckFacing, buildTruedSideBustDart } from "./dartUtils";
import { resolveProMeasurements } from "../seamValidator";

export interface TwoPieceEngineInput {
  measurements: Measurements;
  topStyle: TwoPieceTopStyle;
  bottomStyle: TwoPieceBottomStyle;
  pantsSubStyle?: PantsSubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  torsoFit?: TorsoFit;
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
    torsoFit = "fitted",
    seamAllowance,
    fabricType,
    necklineDropRatio,
    topLengthMultiplier = 1,
    bottomLengthMultiplier = 1,
    flareRatio,
    extras,
  } = input;

  const pro = resolveProMeasurements(measurements);
  const isJacketTop = topStyle === "jacket_blazer";
  const isTailoredTop = isJacketTop || necklineStyle === "tailored_lapel";
  const isWrapFront = Boolean(extras?.wrapFront);
  const useTailoredLapel =
    isTailoredTop && !isWrapFront && necklineStyle !== "shirt_collar";
  const useShirtCollar =
    !isWrapFront && !useTailoredLapel && necklineStyle === "shirt_collar";

  const { easeFactor, flatEase, label } = computeEase(
    fabricType,
    isJacketTop ? 4 : isTailoredTop ? 2 : 0,
    torsoFit
  );

  const effBust = measurements.bust * easeFactor + flatEase;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;

  const bustSplit = fabricType === "woven" ? 1.0 : 0.4;
  const quarterBust = effBust / 4;
  const frontQuarterBust = quarterBust + bustSplit;
  const backQuarterBust = Math.max(frontQuarterBust - 2.0, quarterBust - bustSplit);
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;
  const halfBack = effBack / 2;

  const baseTopRatio =
    topStyle === "crop_top" ? 0.72 : isJacketTop ? 1.28 : 1.0;
  const bottomHemAllowance = 2.0;
  const bodiceRefY = Math.max(
    24,
    pro.backBodiceLength * (topStyle === "crop_top" ? 0.72 : 1.0) * topLengthMultiplier
  );
  const backTopLen =
    Math.max(24, pro.backBodiceLength * baseTopRatio * topLengthMultiplier) +
    bottomHemAllowance;

  const fittedBottomHalfW =
    topStyle === "crop_top"
      ? quarterWaist + (quarterBust - quarterWaist) * 0.35
      : isJacketTop
        ? Math.max(quarterWaist + 2.5, quarterHip * 0.94)
        : quarterWaist + 1;
  const baseTopBottomHalfW =
    torsoFit === "loose"
      ? computeTorsoWaistHalfWidth({
          quarterBust,
          quarterWaist,
          quarterHip,
          torsoFit: "loose",
        })
      : fittedBottomHalfW;

  const useWaistDart =
    fabricType === "woven" &&
    torsoFit === "fitted" &&
    (isTailoredTop || topStyle === "waist_blouse");
  const waistDartIntake = isTailoredTop ? 2.6 : 2.0;
  const frontBottomHalfW =
    baseTopBottomHalfW + bustSplit * 0.5 + (useWaistDart ? waistDartIntake : 0);
  const backBottomHalfW =
    Math.max(12, baseTopBottomHalfW - bustSplit * 0.5) +
    (useWaistDart ? waistDartIntake : 0);

  const isKimono = sleeveStyle === "kimono";
  const neckW = Math.max(6.2, effBust * 0.075);
  const baseNeckDrop =
    necklineStyle === "v_neck" || necklineStyle === "tailored_lapel"
      ? 14
      : necklineStyle === "square"
        ? 10.5
        : necklineStyle === "high" || necklineStyle === "shirt_collar"
          ? 4.2
          : 9;
  const frontNeckDrop = necklineDropRatio
    ? Math.max(4.0, Math.min(backTopLen - 8, measurements.bodiceLength * necklineDropRatio))
    : baseNeckDrop;
  const backNeckDrop = 2.5;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const armholeDepth = Math.min(backTopLen - 6, Math.max(17, effBust * 0.215));

  const frontArmholeCmd: PathCommand = {
    type: "C",
    cp1x: shoulderX - 2.1,
    cp1y: armholeDepth * 0.54,
    cp2x: frontQuarterBust * 0.82,
    cp2y: armholeDepth,
    x: frontQuarterBust,
    y: armholeDepth,
  };
  const backArmholeCmd: PathCommand = {
    type: "C",
    cp1x: shoulderX - 0.4,
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
    { x: shoulderX, y: shoulderSlope },
    { x: backArmholeCmd.cp1x, y: backArmholeCmd.cp1y },
    { x: backArmholeCmd.cp2x, y: backArmholeCmd.cp2y },
    { x: backQuarterBust, y: armholeDepth }
  );
  const totalArmhole = frontArmholeLen + backArmholeLen;

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

  const useSideBustDart =
    fabricType === "woven" &&
    torsoFit === "fitted" &&
    !isKimono &&
    topStyle !== "crop_top";
  const bustDartIntake = useSideBustDart
    ? Math.max(2.0, Math.min(4.0, pro.frontBodiceLength - pro.backBodiceLength || 2.3))
    : 0;
  const backSideLen = Math.hypot(
    backBottomHalfW - backQuarterBust,
    backTopLen - armholeDepth
  );

  let truedBustDart: ReturnType<typeof buildTruedSideBustDart> | null = null;
  let frontTopLen = useSideBustDart ? backTopLen + bustDartIntake : backTopLen;
  if (useSideBustDart && backTopLen - armholeDepth >= 8) {
    for (let iter = 0; iter < 3; iter++) {
      truedBustDart = buildTruedSideBustDart({
        topPoint: { x: frontQuarterBust, y: armholeDepth },
        botPoint: { x: frontBottomHalfW, y: frontTopLen },
        apex: {
          x: pro.bustSeparation / 2,
          y: Math.min(frontTopLen - 4, pro.bustHeight * topLengthMultiplier),
        },
        intakeCm: bustDartIntake,
        label: "Pinza de busto",
      });
      const err = backSideLen - truedBustDart.closedSideLengthCm;
      if (Math.abs(err) < 0.04) break;
      frontTopLen = Number((frontTopLen + err).toFixed(2));
    }
  } else {
    frontTopLen = backTopLen;
  }

  const kimonoWing = isKimono
    ? buildKimonoWingSegment({
        neckW,
        shoulderX,
        shoulderSlope,
        sleeveLengthCm: measurements.sleeveLength,
        armholeDepth,
        quarterBust: frontQuarterBust,
        sideWaistX: frontBottomHalfW,
        sideWaistY: frontTopLen,
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
        sideWaistX: backBottomHalfW,
        sideWaistY: backTopLen,
        torsoFit,
        flaredSleeve: extras?.flaredSleeve,
      })
    : null;

  const pieces: PatternPiece[] = [];
  const wrapOverlap = Math.round(quarterWaist * 0.58);

  const frontUpperCommands: PathCommand[] = kimonoWing
    ? [...kimonoWing.commands, { type: "L", x: frontBottomHalfW, y: frontTopLen }]
    : [
        { type: "L", x: shoulderX, y: shoulderSlope },
        frontArmholeCmd,
        ...(truedBustDart
          ? truedBustDart.sideCommands
          : [{ type: "L" as const, x: frontBottomHalfW, y: frontTopLen }]),
      ];

  const dartWaistY = Math.min(frontTopLen - 4, Math.max(armholeDepth + 6, bodiceRefY));
  const dartBotY = Math.min(frontTopLen - 2, dartWaistY + 10);
  const dartTopY = Math.min(dartWaistY - 3, armholeDepth + 3.5);

  const lapelGeom = useTailoredLapel
    ? buildTailoredLapelFrontGeometry({
        neckW,
        frontNeckDrop,
        armholeDepth,
        bodiceLen: dartWaistY,
        totalLen: frontTopLen,
      })
    : null;

  const frontInternalLines: PatternInternalLine[] = [
    ...(lapelGeom ? lapelGeom.internalLines : []),
    ...(truedBustDart ? [truedBustDart.internalLine] : []),
    ...(useWaistDart && dartBotY - dartTopY >= 6
      ? [
          buildVerticalWaistDart({
            centerX: Math.max(6.5, pro.bustSeparation / 2),
            topY: dartTopY,
            waistY: dartWaistY,
            botY: dartBotY,
            halfWidthCm: Number((waistDartIntake / 2).toFixed(2)),
            label: "Pinza de entalle",
          }),
        ]
      : []),
    ...(extras?.flapPockets
      ? [
          createFlapPocketMarkLine({
            xStart: Math.max(3.5, quarterWaist * 0.22),
            yTop: Math.max(dartWaistY, frontTopLen - 11),
            widthCm: Math.min(13.5, Math.max(10, frontBottomHalfW * 0.52)),
          }),
        ]
      : []),
  ];

  // 1. TOP DELANTERO
  const shirtExt = useShirtCollar ? 1.8 : 0;
  const topFrontSeam: PathCommand[] = isWrapFront
    ? [
        { type: "M", x: neckW, y: 0 },
        ...frontUpperCommands,
        { type: "L", x: -wrapOverlap, y: frontTopLen },
        {
          type: "C",
          cp1x: -wrapOverlap * 0.35,
          cp1y: frontTopLen * 0.62,
          cp2x: neckW * 0.55,
          cp2y: frontTopLen * 0.25,
          x: neckW,
          y: 0,
        },
        { type: "Z" },
      ]
    : lapelGeom
      ? [
          { type: "M", x: neckW, y: 0 },
          ...frontUpperCommands,
          ...lapelGeom.closingCommands,
          { type: "Z" },
        ]
      : shirtExt > 0
        ? [
            { type: "M", x: -shirtExt, y: frontNeckDrop },
            { type: "L", x: 0, y: frontNeckDrop },
            ...frontNeckCmds,
            ...frontUpperCommands,
            { type: "L", x: -shirtExt, y: frontTopLen },
            { type: "Z" },
          ]
        : [
            { type: "M", x: 0, y: frontNeckDrop },
            ...frontNeckCmds,
            ...frontUpperCommands,
            { type: "L", x: 0, y: frontTopLen },
            { type: "Z" },
          ];

  const isTopOpenFront =
    isWrapFront || useTailoredLapel || isJacketTop || useShirtCollar;

  pieces.push(
    normalizePiece(
      {
        id: "top_front",
        name: isWrapFront
          ? "TOP DELANTERO CRUZADO (x2)"
          : useTailoredLapel
            ? "BLAZER DELANTERO (x2)"
            : isJacketTop || useShirtCollar
              ? "CHAQUETA / CAMISA DEL. (x2)"
              : "TOP DELANTERO (x1 doblez)",
        subtitle: kimonoWing
          ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoWing.underarmCurveLenCm} cm`
          : isWrapFront
            ? "Cortar 2 piezas (Izquierda y Derecha)"
            : useTailoredLapel
              ? "Con cruce, solapa y pinzas | Cortar 2 piezas"
              : truedBustDart
                ? "Pinza lateral busto afinada + 2 cm dobladillo"
                : "Incluye 2 cm dobladillo",
        tabLabel: isWrapFront
          ? "Top Cruzado"
          : useTailoredLapel
            ? "Blazer Delantero"
            : isJacketTop
              ? "Chaqueta Del."
              : "Top Delantero",
        seamPath: topFrontSeam,
        grainline: {
          x1: Math.max(4, frontBottomHalfW * 0.45),
          y1: Math.max(frontNeckDrop + 3, 11),
          x2: Math.max(4, frontBottomHalfW * 0.45),
          y2: frontTopLen - 4,
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
            x: frontBottomHalfW,
            y: frontTopLen - bottomHemAllowance,
            angle: 0,
            label: "Dobladillo",
          },
          ...(lapelGeom ? lapelGeom.notches : []),
          ...(isWrapFront
            ? [
                { x: 0, y: frontTopLen, angle: 90, label: "Centro Delantero" },
                { x: -wrapOverlap, y: frontTopLen, angle: 180, label: "Cruce cintura" },
              ]
            : []),
        ],
        internalLines: frontInternalLines.length > 0 ? frontInternalLines : undefined,
        labelPos: { x: frontBottomHalfW * 0.5, y: frontTopLen * 0.65 },
        foldLine: isTopOpenFront
          ? undefined
          : { x1: 0, y1: frontNeckDrop, x2: 0, y2: frontTopLen },
        cutQuantity: isTopOpenFront ? 2 : 1,
        cutOnFold: !isTopOpenFront,
        seamAnchors: {
          shoulder: Number(Math.hypot(shoulderX - neckW, shoulderSlope).toFixed(2)),
          sideSeam: Number(
            (
              truedBustDart
                ? truedBustDart.closedSideLengthCm
                : Math.hypot(frontBottomHalfW - frontQuarterBust, frontTopLen - armholeDepth)
            ).toFixed(2)
          ),
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
        wrapWaistY: frontTopLen,
        seamAllowance,
      })
    );
  }

  // 2. TOP TRASERO
  const backUpperCommands: PathCommand[] = kimonoBackWing
    ? [...kimonoBackWing.commands, { type: "L", x: backBottomHalfW, y: backTopLen }]
    : [
        { type: "L", x: shoulderX, y: shoulderSlope },
        backArmholeCmd,
        { type: "L", x: backBottomHalfW, y: backTopLen },
      ];

  const topBackSeam: PathCommand[] = [
    { type: "M", x: 0, y: backNeckDrop },
    ...backNeckCmds,
    ...backUpperCommands,
    { type: "L", x: 0, y: backTopLen },
    { type: "Z" },
  ];

  const backDartWaistY = Math.min(backTopLen - 4, dartWaistY);
  const backDartBotY = Math.min(backTopLen - 2, backDartWaistY + 9);

  pieces.push(
    normalizePiece(
      {
        id: "top_back",
        name: "TOP TRASERO (x1 doblez)",
        subtitle: kimonoBackWing
          ? `Manga Kimono (${kimonoBackWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoBackWing.underarmCurveLenCm} cm`
          : "Incluye 2 cm dobladillo",
        tabLabel: "Top Trasero",
        seamPath: topBackSeam,
        grainline: {
          x1: Math.max(4, backBottomHalfW * 0.45),
          y1: 9,
          x2: Math.max(4, backBottomHalfW * 0.45),
          y2: backTopLen - 4,
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
                  x: Number((shoulderX - (shoulderX - backQuarterBust) * 0.25).toFixed(2)),
                  y: Number((armholeDepth * 0.65).toFixed(2)),
                  angle: 0,
                  label: "Sisa tras.",
                  count: 2 as const,
                },
              ]),
          {
            x: backBottomHalfW,
            y: backTopLen - bottomHemAllowance,
            angle: 0,
            label: "Dobladillo",
          },
        ],
        labelPos: { x: backBottomHalfW * 0.5, y: backTopLen * 0.65 },
        internalLines:
          useWaistDart && backDartBotY - dartTopY >= 6
            ? [
                buildVerticalWaistDart({
                  centerX: Math.max(6.0, backQuarterBust * 0.44),
                  topY: dartTopY,
                  waistY: backDartWaistY,
                  botY: backDartBotY,
                  halfWidthCm: Number((waistDartIntake / 2).toFixed(2)),
                  label: "Pinza espalda",
                }),
              ]
            : undefined,
        foldLine: { x1: 0, y1: backNeckDrop, x2: 0, y2: backTopLen },
        cutQuantity: 1,
        cutOnFold: true,
        seamAnchors: {
          shoulder: Number(Math.hypot(shoulderX - neckW, shoulderSlope).toFixed(2)),
          sideSeam: Number(backSideLen.toFixed(2)),
          armhole: Number(backArmholeLen.toFixed(2)),
          neckline: Number(backNeckArc.toFixed(2)),
        },
      },
      seamAllowance
    )
  );

  // 3. MANGA
  const useTwoPieceSleeve =
    isJacketTop &&
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
        totalArmholePerimeter: totalArmhole,
        sleeveLengthCm: measurements.sleeveLength,
        bicepCm: pro.bicep,
        wristCm: pro.wrist,
        seamAllowance,
      })
    );
  } else {
    const sleevePiece = buildSleevePiece({
      armholeDepth,
      totalArmholePerimeter: totalArmhole,
      sleeveLengthCm: measurements.sleeveLength,
      sleeveStyle,
      flaredSleeve: extras?.flaredSleeve,
      seamAllowance,
      fabricType,
      garmentKind: isJacketTop ? "jacket" : "blouse",
      bicepCm: pro.bicep,
      wristCm: pro.wrist,
      withShirtCuff,
    });
    if (sleevePiece) {
      pieces.push(sleevePiece);
      if (withShirtCuff) {
        pieces.push(buildShirtCuffPiece({ wristCm: pro.wrist, seamAllowance }));
      }
    }
  }

  // Cuellos o vistas anatómicas
  if (!isWrapFront) {
    if (useTailoredLapel) {
      pieces.push(
        ...buildTailoredCollarAndFacingPieces({
          neckW,
          shoulderX,
          shoulderSlope,
          frontNeckDrop,
          armholeDepth,
          bodiceLen: dartWaistY,
          totalLen: frontTopLen,
          seamAllowance,
        })
      );
    } else if (useShirtCollar) {
      pieces.push(
        ...buildShirtDressDetailPieces({
          neckW,
          frontLengthCm: frontTopLen - frontNeckDrop,
          seamAllowance,
          totalHalfNeckPerimeter: frontNeckArc + backNeckArc,
        })
      );
    } else if (fabricType === "stretch" && topStyle === "crop_top") {
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
          name: isJacketTop
            ? "VISTA ESCOTE DELANTERO (x2 + Entretela)"
            : "VISTA ESCOTE DELANTERO (x1 doblez)",
          tabLabel: "Vista Delantera",
          neckWidth: neckW,
          neckDrop: frontNeckDrop,
          style: necklineStyle,
          widthCm: 4.5,
          isFront: true,
          seamAllowance,
          openFront: isJacketTop,
        }),
        buildAnatomicalNeckFacing({
          id: "back_neck_facing",
          name: "VISTA ESCOTE TRASERO (x1 doblez)",
          tabLabel: "Vista Trasera",
          neckWidth: neckW,
          neckDrop: backNeckDrop,
          style: "round",
          widthCm: 4.5,
          isFront: false,
          seamAllowance,
          openFront: false,
        })
      );
    }
  }

  if (extras?.flapPockets) {
    pieces.push(...buildFlapPocketPieces(seamAllowance));
  }

  // 4. BOTTOM PIECES
  const bottomExtras: GarmentExtras | undefined = extras
    ? {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: extras.hemRuffle,
        sidePockets: extras.sidePockets,
        flapPockets: false,
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

  const bottomEase = computeEase(
    fabricType,
    bottomStyle === "pants" && pantsSubStyle === "wide" ? 3 : 0
  );
  const bottomEffWaist =
    measurements.waist * bottomEase.easeFactor + bottomEase.flatEase;

  pieces.push(
    buildWaistbandPiece(bottomEffWaist, seamAllowance, {
      contoured: fabricType === "woven",
    })
  );

  const topText =
    topStyle === "crop_top"
      ? "Crop Top"
      : topStyle === "jacket_blazer"
        ? "Chaqueta / Blazer"
        : "Blusa";
  const bottomTextMap: Record<TwoPieceBottomStyle, string> = {
    straight_skirt: "Falda Recta",
    aline_skirt: "Falda en A",
    long_skirt: "Falda Larga Semicircular",
    pants: "Pantalón",
  };

  const finishedMeasurements = buildFinishedMeasurements([
    { label: "Contorno de Busto (Top)", bodyCm: measurements.bust, finishedCm: effBust },
    { label: "Contorno de Cintura", bodyCm: measurements.waist, finishedCm: effWaist },
    { label: "Contorno de Cadera", bodyCm: measurements.hip, finishedCm: effHip },
  ]);

  const cuttingLayout = computeCuttingLayout(pieces, 140);

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
    finishedMeasurements,
    cuttingLayout,
  };
}
