import {
  DressSubStyle,
  FabricType,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PathCommand,
  PatternInternalLine,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
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
  buildShirtBackYokeGeometry,
  buildShirtCuffPiece,
  buildShirtDressDetailPieces,
  buildSleevePiece,
  buildTailoredCollarAndFacingPieces,
  buildTailoredLapelFrontGeometry,
  buildVerticalWaistDart,
  buildWaistTiePiece,
  buildWrapFacingPiece,
  computeTorsoWaistHalfWidth,
  createFlapPocketMarkLine,
  createSidePocketNotches,
} from "./extrasEngine";
import { buildAnatomicalNeckFacing, buildTruedSideBustDart } from "./dartUtils";
import { buildPrincessBodicePanels } from "./princessEngine";
import { buildRaglanGeometry } from "./raglanEngine";
import { resolveProMeasurements } from "../seamValidator";

export interface DressEngineInput {
  measurements: Measurements;
  subStyle: DressSubStyle;
  necklineStyle: NecklineStyle;
  skirtFlareStyle: SkirtSubStyle;
  sleeveStyle?: SleeveStyle;
  torsoFit?: TorsoFit;
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
    torsoFit = "fitted",
    seamAllowance,
    fabricType,
    necklineDropRatio,
    bodiceToTotalRatio,
    flareRatio,
    lengthMultiplier = 1,
    extras,
    styleVariant = "default",
  } = input;

  const pro = resolveProMeasurements(measurements);
  const { easeFactor, flatEase, label } = computeEase(fabricType, 0, torsoFit);

  const effBust = measurements.bust * easeFactor + flatEase;
  const effFrameBust = pro.hasCustomHighBust
    ? pro.frameBust * easeFactor + flatEase
    : effBust;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;

  const bustSplit = fabricType === "woven" ? 1.0 : 0.4;
  const quarterBust = effBust / 4;
  const frameQuarterBust = effFrameBust / 4;
  const backQuarterBust = pro.hasCustomHighBust
    ? Math.max(12, frameQuarterBust - bustSplit)
    : Math.max(quarterBust + bustSplit - 2.0, quarterBust - bustSplit);
  const frontQuarterBust = pro.hasCustomHighBust
    ? Math.max(
        backQuarterBust * 0.85,
        frameQuarterBust + bustSplit + pro.fbaHalfFrontCm * easeFactor
      )
    : quarterBust + bustSplit;
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
  const halfBack = effBack / 2;

  const combinedLen =
    (subStyle === "jumpsuit"
      ? measurements.bodiceLength + measurements.crotchDepth + measurements.inseam
      : measurements.bodiceLength + measurements.skirtLength) * lengthMultiplier;

  const isEmpireCut = subStyle === "dress" && styleVariant === "empire_cut";
  const isTailoredLapelDress =
    subStyle === "dress" &&
    necklineStyle === "tailored_lapel" &&
    !extras?.wrapFront;
  const isShirtDress =
    subStyle === "dress" &&
    !extras?.wrapFront &&
    !isTailoredLapelDress &&
    (styleVariant === "shirt_dress" || necklineStyle === "shirt_collar");

  const useWaistDart =
    subStyle === "dress" &&
    fabricType === "woven" &&
    torsoFit === "fitted" &&
    !isEmpireCut;
  const baseWaistDartIntake = isTailoredLapelDress ? 2.7 : 2.2;

  const backBodiceLen = isEmpireCut
    ? Math.max(25, Math.round(pro.backBodiceLength * 0.68))
    : bodiceToTotalRatio
      ? Math.max(32, Math.min(54, combinedLen * bodiceToTotalRatio))
      : pro.backBodiceLength;
  const lowerLen = Math.max(35, combinedLen - backBodiceLen);

  const isKimono = sleeveStyle === "kimono";
  const isRaglan =
    subStyle === "dress" &&
    sleeveStyle === "raglan" &&
    !extras?.wrapFront &&
    !isTailoredLapelDress;
  const usePrincess =
    subStyle === "dress" &&
    Boolean(extras?.princessSeam) &&
    fabricType === "woven" &&
    !isKimono &&
    !isRaglan &&
    !extras?.wrapFront &&
    !isTailoredLapelDress &&
    !isEmpireCut;
  const useBackYoke =
    subStyle === "dress" &&
    fabricType === "woven" &&
    (isShirtDress || Boolean(extras?.backYoke)) &&
    !isKimono &&
    !isRaglan &&
    !usePrincess &&
    !extras?.wrapFront &&
    !isTailoredLapelDress;

  const rawCupBustDart = useWaistDart
    ? Math.max(1.4, pro.frontBodiceLength - pro.backBodiceLength || 2.4)
    : 2.4;
  const useSideBustDart =
    subStyle === "dress" &&
    fabricType === "woven" &&
    torsoFit === "fitted" &&
    !isKimono &&
    !usePrincess &&
    !isEmpireCut &&
    !(pro.hasCustomHighBust && pro.fbaHalfFrontCm <= -2.0 && !pro.hasCustomFrontBodiceLength);
  const bustDartExcessToWaist =
    useSideBustDart && rawCupBustDart > 4.8
      ? Math.min(2.6, Number((rawCupBustDart - 4.5).toFixed(2)))
      : 0;
  const bustDartIntake = useSideBustDart
    ? Math.max(1.4, Math.min(4.5, rawCupBustDart))
    : 0;
  const frontWaistDartIntake = useWaistDart
    ? Number((baseWaistDartIntake + bustDartExcessToWaist).toFixed(2))
    : bustDartExcessToWaist;
  const backWaistDartIntake = useWaistDart ? baseWaistDartIntake : 0;

  const frontTorsoWaistX =
    baseWaistX +
    bustSplit * 0.5 +
    (useWaistDart || bustDartExcessToWaist > 0 ? frontWaistDartIntake : 0);
  const backTorsoWaistX =
    Math.max(12, baseWaistX - bustSplit * 0.5) +
    (useWaistDart ? backWaistDartIntake : 0);

  const neckW = Math.max(6.2, effFrameBust * 0.075);
  const baseNeckDrop =
    necklineStyle === "v_neck" || necklineStyle === "tailored_lapel"
      ? 14
      : necklineStyle === "square"
        ? 10.5
        : necklineStyle === "high" || necklineStyle === "shirt_collar"
          ? 4.2
          : 9.5;
  const frontNeckDrop = necklineDropRatio
    ? Math.max(4.0, backBodiceLen * necklineDropRatio)
    : baseNeckDrop;
  const backNeckDrop = 2.6;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const armholeDepth = Math.max(17, effFrameBust * 0.215);
  const forwardShoulderDrop = useBackYoke ? 1.5 : 0;

  const withShirtCuff =
    isShirtDress &&
    (sleeveStyle === "long" || sleeveStyle === "raglan") &&
    fabricType === "woven" &&
    !extras?.flaredSleeve;

  const raglanData = isRaglan
    ? buildRaglanGeometry({
        neckW,
        frontNeckDrop,
        backNeckDrop,
        necklineStyle,
        shoulderX,
        shoulderSlope,
        armholeDepth,
        frontQuarterBust,
        backQuarterBust,
        sleeveLengthCm: measurements.sleeveLength,
        fabricType,
        flaredSleeve: extras?.flaredSleeve,
        bicepCm: pro.bicep,
        wristCm: pro.wrist,
        withShirtCuff,
        seamAllowance,
      })
    : null;

  const sideTopY = raglanData ? raglanData.raglanUnderarmY : armholeDepth;

  const frontArmholeCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: shoulderX - 2.1,
    cp1y: Number((forwardShoulderDrop + (armholeDepth - forwardShoulderDrop) * 0.54).toFixed(2)),
    cp2x: frontQuarterBust * 0.82,
    cp2y: armholeDepth,
    x: frontQuarterBust,
    y: armholeDepth,
  };
  const backArmholeCmd: Extract<PathCommand, { type: "C" }> = {
    type: "C",
    cp1x: shoulderX - 0.4,
    cp1y: armholeDepth * 0.58,
    cp2x: backQuarterBust * 0.88,
    cp2y: armholeDepth,
    x: backQuarterBust,
    y: armholeDepth,
  };

  const backYokeData = useBackYoke
    ? buildShirtBackYokeGeometry({
        neckW,
        backNeckDrop,
        backShoulderX: shoulderX,
        shoulderSlope,
        armholeDepth,
        backQuarterBust,
        backArmholeCmd,
        cutLowerBackOnFold: isShirtDress,
        forwardShoulderCm: forwardShoulderDrop,
        seamAllowance,
      })
    : null;

  const frontArmholeLen = cubicBezierLength(
    { x: shoulderX, y: shoulderSlope + forwardShoulderDrop },
    { x: frontArmholeCmd.cp1x, y: frontArmholeCmd.cp1y },
    { x: frontArmholeCmd.cp2x, y: frontArmholeCmd.cp2y },
    { x: frontQuarterBust, y: armholeDepth }
  );
  const backArmholeLen = backYokeData
    ? backYokeData.upperArmholeLenCm + backYokeData.lowerArmholeLenCm
    : cubicBezierLength(
        { x: shoulderX, y: shoulderSlope },
        { x: backArmholeCmd.cp1x, y: backArmholeCmd.cp1y },
        { x: backArmholeCmd.cp2x, y: backArmholeCmd.cp2y },
        { x: backQuarterBust, y: armholeDepth }
      );

  const rawFrontNeckCmds = buildNecklineCommand(neckW, frontNeckDrop, necklineStyle);
  const shiftedFrontNeckCmds: PathCommand[] = useBackYoke
    ? rawFrontNeckCmds.map((c) =>
        c.type === "L"
          ? { ...c, y: Number((c.y + forwardShoulderDrop).toFixed(2)) }
          : c.type === "C"
            ? {
                ...c,
                cp1y: Number((c.cp1y + forwardShoulderDrop).toFixed(2)),
                cp2y: Number((c.cp2y + forwardShoulderDrop).toFixed(2)),
                y: Number((c.y + forwardShoulderDrop).toFixed(2)),
              }
            : c
      )
    : rawFrontNeckCmds;
  const frontNeckStartY = useBackYoke ? frontNeckDrop + forwardShoulderDrop : frontNeckDrop;
  const frontNeckCmds = raglanData ? raglanData.frontNeckCmds : shiftedFrontNeckCmds;
  const backNeckCmds = raglanData
    ? raglanData.backNeckCmds
    : buildNecklineCommand(neckW, backNeckDrop, "round");
  const frontNeckArc = raglanData
    ? raglanData.frontNeckRemainArcCm
    : commandsArcLength([{ type: "M", x: 0, y: frontNeckStartY }, ...frontNeckCmds]);
  const backNeckArc = raglanData
    ? raglanData.backNeckRemainArcCm
    : backYokeData
      ? backYokeData.backNeckArcCm
      : commandsArcLength([{ type: "M", x: 0, y: backNeckDrop }, ...backNeckCmds]);

  const kimonoWing = isKimono
    ? buildKimonoWingSegment({
        neckW,
        shoulderX,
        shoulderSlope,
        sleeveLengthCm: measurements.sleeveLength,
        armholeDepth,
        quarterBust: frontQuarterBust,
        sideWaistX: frontTorsoWaistX,
        sideWaistY: backBodiceLen,
        torsoFit,
        flaredSleeve: extras?.flaredSleeve,
      })
    : null;

  const pieces: PatternPiece[] = [];
  let finishedHemHalfWidth = quarterHip;

  if (subStyle === "dress") {
    const hipDrop = Math.min(20, lowerLen * 0.35);
    const flareDeg =
      skirtFlareStyle === "straight"
        ? 2
        : skirtFlareStyle === "a_line"
          ? 13
          : 22;
    const baseFlare = lowerLen * Math.tan((flareDeg * Math.PI) / 180);
    const flareExtra = Math.min(
      40,
      flareRatio ? baseFlare * 0.5 + lowerLen * flareRatio * 0.35 : baseFlare
    );
    const frontHemHalfW = frontQuarterHip + flareExtra;
    const backHemHalfW = backQuarterHip + flareExtra;
    finishedHemHalfWidth = (frontHemHalfW + backHemHalfW) / 2;

    const backTotalLen = backBodiceLen + lowerLen;
    const backSideUpperLen = Math.hypot(
      backTorsoWaistX - backQuarterBust,
      backBodiceLen - sideTopY
    );

    let truedBustDart: ReturnType<typeof buildTruedSideBustDart> | null = null;
    let frontBodiceLen = useSideBustDart
      ? backBodiceLen + bustDartIntake
      : backBodiceLen;
    if (useSideBustDart) {
      for (let iter = 0; iter < 3; iter++) {
        truedBustDart = buildTruedSideBustDart({
          topPoint: { x: frontQuarterBust, y: sideTopY },
          botPoint: { x: frontTorsoWaistX, y: frontBodiceLen },
          apex: {
            x: pro.bustSeparation / 2,
            y: pro.bustHeight * lengthMultiplier,
          },
          intakeCm: bustDartIntake,
          label: "Pinza de busto",
        });
        const err = backSideUpperLen - truedBustDart.closedSideLengthCm;
        if (Math.abs(err) < 0.04) break;
        frontBodiceLen = Number((frontBodiceLen + err).toFixed(2));
      }
    }

    const frontTotalLen = frontBodiceLen + lowerLen;
    const isWrapFront = Boolean(extras?.wrapFront);
    const wrapOverlap = Math.round(quarterWaist * 0.62);

    const buildDressPanel = (
      id: string,
      name: string,
      tabLabel: string,
      isFront: boolean
    ) => {
      const qBust = isFront ? frontQuarterBust : backQuarterBust;
      const qHip = isFront ? frontQuarterHip : backQuarterHip;
      const tWaistX = isFront ? frontTorsoWaistX : backTorsoWaistX;
      const bLen = isFront ? frontBodiceLen : backBodiceLen;
      const tLen = isFront ? frontTotalLen : backTotalLen;
      const hHalfW = isFront ? frontHemHalfW : backHemHalfW;
      const neckDrop = isFront ? frontNeckStartY : backNeckDrop;
      const neckCmds = isFront ? frontNeckCmds : backNeckCmds;
      const useWrap = isFront && isWrapFront;
      const useLapel = isFront && isTailoredLapelDress;

      const panelLapel = useLapel
        ? buildTailoredLapelFrontGeometry({
            neckW,
            frontNeckDrop,
            armholeDepth,
            bodiceLen: bLen,
            totalLen: tLen,
          })
        : null;

      const sidePocketNotches = extras?.sidePockets
        ? createSidePocketNotches({
            waistX: tWaistX,
            waistY: bLen,
            hipX: qHip,
            hipY: bLen + hipDrop,
          })
        : [];

      const shirtButtons: PatternInternalLine[] = [];
      if (isFront && isShirtDress) {
        shirtButtons.push({
          commands: [
            { type: "M", x: 0, y: neckDrop },
            { type: "L", x: 0, y: tLen },
          ],
          style: "mark",
          label: "Centro",
        });
        const count = 8;
        const span = Math.max(30, tLen - neckDrop - 12);
        for (let i = 0; i < count; i++) {
          const by = Number((neckDrop + 3 + (i * span) / (count - 1)).toFixed(1));
          shirtButtons.push({
            commands: [
              { type: "M", x: -0.7, y: by },
              { type: "L", x: 0.7, y: by },
            ],
            style: "buttonhole",
          });
        }
      }

      const panelInternalLines: PatternInternalLine[] = [
        ...(panelLapel ? panelLapel.internalLines : []),
        ...shirtButtons,
        ...(isFront && truedBustDart ? [truedBustDart.internalLine] : []),
        ...(useWaistDart || (isFront && bustDartExcessToWaist > 0)
          ? [
              buildVerticalWaistDart({
                centerX: Number(
                  Math.max(6.2, isFront ? pro.bustSeparation / 2 : qBust * 0.44).toFixed(2)
                ),
                topY: isFront
                  ? Number((pro.bustHeight * lengthMultiplier + 2.5).toFixed(2))
                  : armholeDepth + 3.0,
                waistY: bLen,
                botY: Math.min(tLen - 4, bLen + hipDrop * 0.72),
                halfWidthCm: Number(
                  ((isFront ? frontWaistDartIntake : backWaistDartIntake) / 2).toFixed(2)
                ),
                label: isFront ? "Pinza de entalle" : "Pinza espalda",
              }),
            ]
          : []),
        ...(isFront && extras?.flapPockets
          ? [
              createFlapPocketMarkLine({
                xStart: Math.max(3.5, quarterWaist * 0.25),
                yTop: Math.min(tLen - 5, bLen + 5.5),
                widthCm: 13.5,
              }),
            ]
          : []),
      ];

      const upperSideCommands: PathCommand[] = raglanData
        ? [
            isFront ? raglanData.frontBodyRaglanCmd : raglanData.backBodyRaglanCmd,
            ...(isFront && truedBustDart
              ? truedBustDart.sideCommands
              : [{ type: "L" as const, x: tWaistX, y: bLen }]),
          ]
        : kimonoWing
          ? [...kimonoWing.commands, { type: "L", x: tWaistX, y: bLen }]
          : [
              { type: "L", x: shoulderX, y: shoulderSlope + (isFront ? forwardShoulderDrop : 0) },
              isFront ? frontArmholeCmd : backArmholeCmd,
              ...(isFront && truedBustDart
                ? truedBustDart.sideCommands
                : [{ type: "L" as const, x: tWaistX, y: bLen }]),
            ];

      const shirtExt = isFront && isShirtDress ? 1.8 : 0;

      const seam: PathCommand[] = useWrap
        ? [
            { type: "M", x: neckW, y: 0 },
            ...upperSideCommands,
            {
              type: "C",
              cp1x: tWaistX + (qHip - tWaistX) * 0.45,
              cp1y: bLen + hipDrop * 0.35,
              cp2x: qHip,
              cp2y: bLen + hipDrop * 0.72,
              x: qHip,
              y: bLen + hipDrop,
            },
            { type: "L", x: hHalfW, y: tLen },
            {
              type: "C",
              cp1x: hHalfW * 0.45,
              cp1y: tLen + 0.8,
              cp2x: -wrapOverlap * 0.4,
              cp2y: tLen + 0.5,
              x: -wrapOverlap,
              y: tLen,
            },
            { type: "L", x: -wrapOverlap, y: bLen },
            {
              type: "C",
              cp1x: -wrapOverlap * 0.35,
              cp1y: bLen * 0.62,
              cp2x: neckW * 0.55,
              cp2y: bLen * 0.25,
              x: neckW,
              y: 0,
            },
            { type: "Z" },
          ]
        : panelLapel
          ? [
              { type: "M", x: neckW, y: 0 },
              ...upperSideCommands,
              {
                type: "C",
                cp1x: tWaistX + (qHip - tWaistX) * 0.45,
                cp1y: bLen + hipDrop * 0.35,
                cp2x: qHip,
                cp2y: bLen + hipDrop * 0.72,
                x: qHip,
                y: bLen + hipDrop,
              },
              { type: "L", x: hHalfW, y: tLen },
              {
                type: "C",
                cp1x: hHalfW * 0.65,
                cp1y: tLen + 0.6,
                cp2x: 0,
                cp2y: tLen + 0.3,
                x: -panelLapel.buttonOverlap,
                y: tLen,
              },
              ...panelLapel.closingCommands.slice(1),
              { type: "Z" },
            ]
          : shirtExt > 0
            ? [
                { type: "M", x: -shirtExt, y: neckDrop },
                { type: "L", x: 0, y: neckDrop },
                ...neckCmds,
                ...upperSideCommands,
                {
                  type: "C",
                  cp1x: tWaistX + (qHip - tWaistX) * 0.45,
                  cp1y: bLen + hipDrop * 0.35,
                  cp2x: qHip,
                  cp2y: bLen + hipDrop * 0.72,
                  x: qHip,
                  y: bLen + hipDrop,
                },
                { type: "L", x: hHalfW, y: tLen },
                {
                  type: "C",
                  cp1x: hHalfW * 0.65,
                  cp1y: tLen - 0.6,
                  cp2x: hHalfW * 0.3,
                  cp2y: tLen,
                  x: -shirtExt,
                  y: tLen,
                },
                { type: "Z" },
              ]
            : [
                { type: "M", x: 0, y: neckDrop },
                ...neckCmds,
                ...upperSideCommands,
                {
                  type: "C",
                  cp1x: tWaistX + (qHip - tWaistX) * 0.45,
                  cp1y: bLen + hipDrop * 0.35,
                  cp2x: qHip,
                  cp2y: bLen + hipDrop * 0.72,
                  x: qHip,
                  y: bLen + hipDrop,
                },
                { type: "L", x: hHalfW, y: tLen },
                {
                  type: "C",
                  cp1x: hHalfW * 0.65,
                  cp1y: tLen - 0.6,
                  cp2x: hHalfW * 0.3,
                  cp2y: tLen,
                  x: 0,
                  y: tLen,
                },
                { type: "Z" },
              ];

      const isCutOnFold = isFront && !useWrap && !isShirtDress && !useLapel;
      const shoulderLen = Math.hypot(shoulderX - neckW, shoulderSlope);
      const upperSideMeasured =
        isFront && truedBustDart
          ? truedBustDart.closedSideLengthCm
          : Math.hypot(tWaistX - qBust, bLen - sideTopY);
      const lowerSideHip = cubicBezierLength(
        { x: tWaistX, y: bLen },
        { x: tWaistX + (qHip - tWaistX) * 0.45, y: bLen + hipDrop * 0.35 },
        { x: qHip, y: bLen + hipDrop * 0.72 },
        { x: qHip, y: bLen + hipDrop }
      );
      const lowerSkirtFlank = Math.hypot(hHalfW - qHip, tLen - (bLen + hipDrop));

      return normalizePiece(
        {
          id,
          name,
          subtitle: raglanData
            ? `Sisa Raglán ${isFront ? "Del" : "Tras"}: ${(isFront ? raglanData.frontRaglanSeamCm : raglanData.backRaglanSeamCm).toFixed(1)} cm`
            : kimonoWing
              ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoWing.underarmCurveLenCm} cm`
              : useWrap || useLapel
                ? "Cortar 2 piezas (Izquierda y Derecha)"
                : isFront && truedBustDart
                  ? "Corpiño c/ pinza busto + Falda"
                  : !isFront
                    ? "Cortar 2 piezas (cierre centro espalda)"
                    : "Corpiño + Falda al doblez",
          tabLabel,
          seamPath: seam,
          grainline: {
            x1: Math.max(4, baseWaistX * 0.45),
            y1: Math.max(neckDrop + 4, 14),
            x2: Math.max(4, baseWaistX * 0.45),
            y2: tLen - 8,
          },
          notches: [
            ...(raglanData
              ? isFront
                ? raglanData.frontNotches
                : raglanData.backNotches
              : kimonoWing
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
                      x: Number((shoulderX - (shoulderX - qBust) * 0.25).toFixed(2)),
                      y: Number((armholeDepth * 0.65).toFixed(2)),
                      angle: 0,
                      label: isFront ? "Sisa del." : "Sisa tras.",
                      count: (isFront ? 1 : 2) as 1 | 2,
                    },
                  ]),
            {
              x: tWaistX,
              y: bLen,
              angle: 0,
              label: isEmpireCut
                ? "Corte bajo busto"
                : torsoFit === "loose"
                  ? "Cintura holgada"
                  : "Cintura",
            },
            { x: qHip, y: bLen + hipDrop, angle: 0, label: "Cadera" },
            ...(!isFront
              ? [{ x: 0, y: Math.min(tLen - 6, bLen + 12), angle: 90, label: "Tope cierre (50 cm)" }]
              : []),
            ...(panelLapel ? panelLapel.notches : []),
            ...(useWrap
              ? [
                  { x: 0, y: bLen, angle: 90, label: "Centro Delantero" },
                  { x: -wrapOverlap, y: bLen, angle: 180, label: "Cruce cintura" },
                ]
              : []),
            ...sidePocketNotches,
          ],
          internalLines: panelInternalLines.length > 0 ? panelInternalLines : undefined,
          labelPos: { x: baseWaistX * 0.48, y: bLen * 0.7 },
          foldLine: isCutOnFold
            ? { x1: 0, y1: neckDrop, x2: 0, y2: tLen }
            : undefined,
          edgeAllowances: !isFront
            ? {
                [seam.length - 2]: "zipper",
              }
            : undefined,
          cutQuantity: isCutOnFold ? 1 : 2,
          cutOnFold: isCutOnFold,
          seamAnchors: {
            ...(raglanData
              ? {
                  raglanSeam: isFront
                    ? raglanData.frontRaglanSeamCm
                    : raglanData.backRaglanSeamCm,
                }
              : {
                  shoulder: Number(shoulderLen.toFixed(2)),
                  armhole: Number((isFront ? frontArmholeLen : backArmholeLen).toFixed(2)),
                }),
            sideSeam: Number((upperSideMeasured + lowerSideHip + lowerSkirtFlank).toFixed(2)),
            neckline: Number((isFront ? frontNeckArc : backNeckArc).toFixed(2)),
          },
        },
        seamAllowance
      );
    };

    if (usePrincess) {
      const shirtDressButtons: PatternInternalLine[] = [];
      if (isShirtDress) {
        shirtDressButtons.push({
          commands: [
            { type: "M", x: 0, y: frontNeckDrop },
            { type: "L", x: 0, y: backTotalLen },
          ],
          style: "mark",
          label: "Centro",
        });
        const count = 8;
        const span = Math.max(30, backTotalLen - frontNeckDrop - 12);
        for (let i = 0; i < count; i++) {
          const by = Number((frontNeckDrop + 3 + (i * span) / (count - 1)).toFixed(1));
          shirtDressButtons.push({
            commands: [
              { type: "M", x: -0.7, y: by },
              { type: "L", x: 0.7, y: by },
            ],
            style: "buttonhole",
          });
        }
      }
      const backPrincess = buildPrincessBodicePanels({
        panelPrefix: "back",
        neckW,
        neckDrop: backNeckDrop,
        necklineStyle: "round",
        shoulderX,
        shoulderSlope,
        armholeDepth,
        armholeCmd: backArmholeCmd,
        quarterBust: backQuarterBust,
        apexX: Math.max(6.0, backQuarterBust * 0.44),
        apexY: armholeDepth + 3.0,
        waistY: backBodiceLen,
        totalLen: backTotalLen,
        hipDrop,
        torsoWaistX: backTorsoWaistX,
        quarterHip: backQuarterHip,
        hemHalfW: backHemHalfW,
        waistDartIntake: backWaistDartIntake || 2.2,
        bustProjectionCm: 0,
        isOpenCenter: !isShirtDress,
        hasCenterZipper: !isShirtDress,
        seamAllowance,
        labelPrefix: "Espalda",
      });
      const frontPrincess = buildPrincessBodicePanels({
        panelPrefix: "front",
        neckW,
        neckDrop: frontNeckDrop,
        necklineStyle,
        shoulderX,
        shoulderSlope,
        armholeDepth,
        armholeCmd: frontArmholeCmd,
        quarterBust: frontQuarterBust,
        apexX: pro.bustSeparation / 2,
        apexY: pro.bustHeight * lengthMultiplier,
        waistY: backBodiceLen,
        totalLen: backTotalLen,
        hipDrop,
        torsoWaistX: frontTorsoWaistX,
        quarterHip: frontQuarterHip,
        hemHalfW: frontHemHalfW,
        waistDartIntake: frontWaistDartIntake || 2.2,
        bustProjectionCm: useSideBustDart ? bustDartIntake : 0,
        isOpenCenter: isShirtDress,
        centerExtCm: isShirtDress ? 1.8 : 0,
        extraCenterInternalLines: [
          ...shirtDressButtons,
          ...(extras?.flapPockets
            ? [
                createFlapPocketMarkLine({
                  xStart: 1.5,
                  yTop: Math.min(backTotalLen - 5, backBodiceLen + 5.5),
                  widthCm: 12.5,
                }),
              ]
            : []),
        ],
        extraSideNotches: extras?.sidePockets
          ? createSidePocketNotches({
              waistX: frontTorsoWaistX,
              waistY: backBodiceLen,
              hipX: frontQuarterHip,
              hipY: backBodiceLen + hipDrop,
            })
          : [],
        seamAllowance,
        labelPrefix: "Delantero",
        targetSideSeamLenCm: backPrincess.sideSeamLenCm,
      });
      pieces.push(
        frontPrincess.centerPiece,
        frontPrincess.sidePiece,
        backPrincess.centerPiece,
        backPrincess.sidePiece
      );
    } else {
      pieces.push(
        buildDressPanel(
          "front",
          isWrapFront
            ? "DELANTERO CRUZADO VESTIDO (x2)"
            : isTailoredLapelDress
              ? "DELANTERO BLAZER VESTIDO (x2)"
              : isShirtDress
                ? "DELANTERO CAMISERO (x2)"
                : isEmpireCut
                  ? "DELANTERO CORTE IMPERIO (x1 doblez)"
                  : "DELANTERO VESTIDO (x1 doblez)",
          isWrapFront
            ? "Delantero Cruzado"
            : isTailoredLapelDress
              ? "Delantero Solapa"
              : "Delantero",
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
            wrapWaistY: frontBodiceLen,
            seamAllowance,
          })
        );
      }

      if (backYokeData) {
        pieces.push(backYokeData.yokePiece);
        const splitY = backYokeData.splitYCm;
        const pleatX = -backYokeData.pleatHalfCm;
        const lowerBackDressSeam: PathCommand[] = [
          { type: "M", x: pleatX, y: splitY },
          { type: "L", x: backYokeData.yokeJoinXCm, y: splitY },
          backYokeData.lowerArmholeCmd,
          { type: "L", x: backTorsoWaistX, y: backBodiceLen },
          {
            type: "C",
            cp1x: backTorsoWaistX + (backQuarterHip - backTorsoWaistX) * 0.45,
            cp1y: backBodiceLen + hipDrop * 0.35,
            cp2x: backQuarterHip,
            cp2y: backBodiceLen + hipDrop * 0.72,
            x: backQuarterHip,
            y: backBodiceLen + hipDrop,
          },
          { type: "L", x: backHemHalfW, y: backTotalLen },
          {
            type: "C",
            cp1x: backHemHalfW * 0.65,
            cp1y: backTotalLen - 0.6,
            cp2x: backHemHalfW * 0.3,
            cp2y: backTotalLen,
            x: pleatX,
            y: backTotalLen,
          },
          { type: "Z" },
        ];
        const lowerSideUpper = Math.hypot(
          backTorsoWaistX - backQuarterBust,
          backBodiceLen - armholeDepth
        );
        const lowerSideHip = cubicBezierLength(
          { x: backTorsoWaistX, y: backBodiceLen },
          {
            x: backTorsoWaistX + (backQuarterHip - backTorsoWaistX) * 0.45,
            y: backBodiceLen + hipDrop * 0.35,
          },
          { x: backQuarterHip, y: backBodiceLen + hipDrop * 0.72 },
          { x: backQuarterHip, y: backBodiceLen + hipDrop }
        );
        const lowerSkirtFlankBack = Math.hypot(
          backHemHalfW - backQuarterHip,
          backTotalLen - (backBodiceLen + hipDrop)
        );
        pieces.push(
          normalizePiece(
            {
              id: "back",
              name: isShirtDress
                ? "TRASERO CAMISERO BAJO CANESÚ (x1 doblez)"
                : "TRASERO VESTIDO BAJO CANESÚ (x2)",
              subtitle: `Canesú: ${backYokeData.yokeJoinXCm.toFixed(1)} cm${backYokeData.pleatHalfCm > 0 ? ` + Tabla +${(backYokeData.pleatHalfCm * 2).toFixed(0)} cm` : ""}`,
              tabLabel: "Trasero",
              seamPath: lowerBackDressSeam,
              grainline: {
                x1: Math.max(4, baseWaistX * 0.45),
                y1: splitY + 3,
                x2: Math.max(4, baseWaistX * 0.45),
                y2: backTotalLen - 8,
              },
              notches: [
                ...(backYokeData.pleatHalfCm > 0
                  ? [{ x: 0, y: splitY, angle: -90, label: "Tabla centro" }]
                  : []),
                {
                  x: Number((backYokeData.yokeJoinXCm * 0.5).toFixed(2)),
                  y: splitY,
                  angle: -90,
                  label: "Encuentro canesú",
                  count: 2,
                },
                {
                  x: backTorsoWaistX,
                  y: backBodiceLen,
                  angle: 0,
                  label: torsoFit === "loose" ? "Cintura holgada" : "Cintura",
                },
                { x: backQuarterHip, y: backBodiceLen + hipDrop, angle: 0, label: "Cadera" },
                ...(!isShirtDress
                  ? [
                      {
                        x: 0,
                        y: Math.min(backTotalLen - 6, backBodiceLen + 12),
                        angle: 90,
                        label: "Tope cierre (50 cm)",
                      },
                    ]
                  : []),
              ],
              internalLines: [
                ...(backYokeData.pleatHalfCm > 0
                  ? [
                      {
                        commands: [
                          { type: "M" as const, x: 0, y: splitY },
                          { type: "L" as const, x: 0, y: backTotalLen },
                        ],
                        style: "mark" as const,
                        label: `Tabla centro (+${(backYokeData.pleatHalfCm * 2).toFixed(0)} cm)`,
                      },
                    ]
                  : []),
                ...(useWaistDart
                  ? [
                      buildVerticalWaistDart({
                        centerX: Number(Math.max(6.2, backQuarterBust * 0.44).toFixed(2)),
                        topY: armholeDepth + 3.0,
                        waistY: backBodiceLen,
                        botY: Math.min(backTotalLen - 4, backBodiceLen + hipDrop * 0.72),
                        halfWidthCm: Number((backWaistDartIntake / 2).toFixed(2)),
                        label: "Pinza espalda",
                      }),
                    ]
                  : []),
              ],
              labelPos: { x: baseWaistX * 0.48, y: backBodiceLen * 0.72 },
              foldLine: isShirtDress
                ? { x1: pleatX, y1: splitY, x2: pleatX, y2: backTotalLen }
                : undefined,
              edgeAllowances: isShirtDress
                ? {
                    0: "seam",
                    1: "curve",
                    5: "hem",
                    6: "fold",
                  }
                : {
                    6: "zipper",
                  },
              cutQuantity: isShirtDress ? 1 : 2,
              cutOnFold: isShirtDress,
              seamAnchors: {
                sideSeam: Number((lowerSideUpper + lowerSideHip + lowerSkirtFlankBack).toFixed(2)),
                armhole: backYokeData.lowerArmholeLenCm,
                yokeSeam: backYokeData.yokeJoinXCm,
              },
            },
            seamAllowance
          )
        );
      } else {
        pieces.push(buildDressPanel("back", "TRASERO VESTIDO (x2)", "Trasero", false));
      }
    }

    const totalHalfNeck = raglanData ? raglanData.totalNeckArcCm : frontNeckArc + backNeckArc;
    if (isTailoredLapelDress) {
      pieces.push(
        ...buildTailoredCollarAndFacingPieces({
          neckW,
          shoulderX,
          shoulderSlope,
          frontNeckDrop,
          armholeDepth,
          bodiceLen: frontBodiceLen,
          totalLen: frontTotalLen,
          seamAllowance,
        })
      );
    } else if (isShirtDress) {
      pieces.push(
        ...buildShirtDressDetailPieces({
          neckW,
          frontLengthCm: frontTotalLen - frontNeckStartY,
          seamAllowance,
          totalHalfNeckPerimeter: totalHalfNeck,
        })
      );
    } else if (!isWrapFront && !raglanData) {
      pieces.push(
        buildAnatomicalNeckFacing({
          id: "front_neck_facing",
          name: "VISTA ESCOTE DELANTERO (x1 doblez)",
          tabLabel: "Vista Delantera",
          neckWidth: neckW,
          neckDrop: frontNeckDrop,
          style: necklineStyle,
          widthCm: 4.5,
          isFront: true,
          seamAllowance,
          openFront: false,
        })
      );
      if (!backYokeData) {
        pieces.push(
          buildAnatomicalNeckFacing({
            id: "back_neck_facing",
            name: "VISTA ESCOTE TRASERO (x2)",
            tabLabel: "Vista Trasera",
            neckWidth: neckW,
            neckDrop: backNeckDrop,
            style: "round",
            widthCm: 4.5,
            isFront: false,
            seamAllowance,
            openFront: true,
          })
        );
      }
    }

    if (extras?.hemRuffle) {
      pieces.push(
        buildHemRufflePiece(finishedHemHalfWidth, lowerLen, seamAllowance).piece
      );
    }
    if (extras?.sidePockets) {
      pieces.push(buildPocketBagPiece(seamAllowance));
    }
    if (extras?.flapPockets) {
      pieces.push(...buildFlapPocketPieces(seamAllowance));
    }
  } else {
    // JUMPSUIT (Enterizo)
    const crotchY = backBodiceLen + measurements.crotchDepth;
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
      const upperSideJumpsuit: PathCommand[] = kimonoWing
        ? [...kimonoWing.commands, { type: "L", x: frontTorsoWaistX, y: backBodiceLen }]
        : [
            { type: "L", x: shoulderX, y: shoulderSlope },
            isFront ? frontArmholeCmd : backArmholeCmd,
            { type: "L", x: frontTorsoWaistX, y: backBodiceLen },
          ];
      const seam: PathCommand[] = [
        { type: "M", x: 0, y: neckDrop },
        ...buildNecklineCommand(neckW, neckDrop, isFront ? necklineStyle : "round"),
        ...upperSideJumpsuit,
        {
          type: "C",
          cp1x: frontTorsoWaistX + (quarterHip - frontTorsoWaistX) * 0.5,
          cp1y: backBodiceLen + measurements.crotchDepth * 0.4,
          cp2x: quarterHip,
          cp2y: backBodiceLen + measurements.crotchDepth * 0.8,
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
          y: backBodiceLen,
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
            { x: quarterWaist, y: backBodiceLen, angle: 0, label: "Cintura" },
            { x: quarterHip, y: crotchY, angle: 0, label: "Cadera/Tiro" },
          ],
          labelPos: { x: quarterWaist * 0.48, y: backBodiceLen * 0.72 },
          cutQuantity: 2,
          seamAnchors: {
            shoulder: Number(Math.hypot(shoulderX - neckW, shoulderSlope).toFixed(2)),
            armhole: Number((isFront ? frontArmholeLen : backArmholeLen).toFixed(2)),
          },
        },
        seamAllowance
      );
    };

    pieces.push(
      buildJumpsuitPanel("front", "DELANTERO ENTERIZO (x2)", "Delantero", true),
      buildJumpsuitPanel("back", "TRASERO ENTERIZO (x2)", "Trasero", false)
    );
  }

  // Sleeve matched to armhole perimeter (or synchronized 1-piece Raglan Sleeve)
  const totalArmhole = frontArmholeLen + backArmholeLen;
  if (raglanData) {
    pieces.push(raglanData.sleevePiece);
    if (withShirtCuff) {
      pieces.push(buildShirtCuffPiece({ wristCm: pro.wrist, seamAllowance }));
    }
  } else {
    const sleevePiece = buildSleevePiece({
      armholeDepth,
      totalArmholePerimeter: totalArmhole,
      sleeveLengthCm: measurements.sleeveLength,
      sleeveStyle,
      flaredSleeve: extras?.flaredSleeve,
      seamAllowance,
      fabricType,
      garmentKind: isTailoredLapelDress ? "jacket" : "blouse",
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

  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  const subLabels: Record<DressSubStyle, string> = {
    dress:
      extras?.wrapFront && isKimono
        ? "Vestido Cruzado Kimono"
        : extras?.wrapFront
          ? "Vestido Cruzado (Envolvente)"
          : isShirtDress
            ? "Vestido Camisero con Tirilla"
            : isKimono
              ? "Vestido Manga Kimono"
              : "Vestido Anatómico",
    jumpsuit: "Enterizo / Mono",
  };

  const finishedMeasurements = buildFinishedMeasurements([
    { label: "Contorno de Busto", bodyCm: measurements.bust, finishedCm: effBust },
    { label: "Contorno de Cintura", bodyCm: measurements.waist, finishedCm: effWaist },
    { label: "Contorno de Cadera", bodyCm: measurements.hip, finishedCm: effHip },
    { label: "Largo Total Prenda", bodyCm: measurements.bodiceLength + measurements.skirtLength, finishedCm: combinedLen },
  ]);

  const cuttingLayout = computeCuttingLayout(pieces, 140);

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
    finishedMeasurements,
    cuttingLayout,
  };
}
