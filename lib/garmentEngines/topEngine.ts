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
  buildNecklineCommand,
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

  const isTailoredGarment =
    subStyle === "jacket" || necklineStyle === "tailored_lapel";
  const isWrapFront = Boolean(extras?.wrapFront);
  const useTailoredLapel =
    isTailoredGarment && !isWrapFront && necklineStyle !== "shirt_collar";
  const useShirtCollar =
    !isWrapFront && !useTailoredLapel && necklineStyle === "shirt_collar";

  // Jacket / tailored blazer gets +4 cm extra outer ease
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

  const quarterBust = effBust / 4;
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;
  const baseWaistX = computeTorsoWaistHalfWidth({
    quarterBust,
    quarterWaist,
    quarterHip,
    torsoFit,
  });
  // Compensate waist width for the 2.8 cm vertical shaping dart when tailored
  const torsoWaistX =
    isTailoredGarment && torsoFit === "fitted" ? baseWaistX + 2.8 : baseWaistX;
  const halfBack = effBack / 2;

  const bodiceLen = measurements.bodiceLength * lengthMultiplier;
  const hipExt = (isTailoredGarment ? 18 : 14) * lengthMultiplier;
  const totalLen = bodiceLen + hipExt;

  const isKimono = sleeveStyle === "kimono";
  const isPeasant = styleVariant === "peasant_offshoulder";
  const isOfficeDart =
    styleVariant === "office_dart" && torsoFit === "fitted";

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
    ? Math.max(4.0, bodiceLen * necklineDropRatio)
    : baseNeckDrop;
  const backNeckDrop = 2.5;
  const shoulderSlope = 2.8;
  const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
  const armholeDepth = Math.max(16, effBust * 0.215 * armholeDepthMultiplier);

  // Shared Kimono wing OR separate front/back armhole lengths
  const kimonoWing = isKimono
    ? buildKimonoWingSegment({
        neckW,
        shoulderX,
        shoulderSlope,
        sleeveLengthCm: measurements.sleeveLength,
        armholeDepth,
        quarterBust,
        sideWaistX: torsoWaistX,
        sideWaistY: bodiceLen,
        torsoFit,
        flaredSleeve: extras?.flaredSleeve,
      })
    : null;

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

  const wrapOverlap = Math.round(quarterWaist * 0.6);
  const pocketNotches = extras?.sidePockets
    ? createSidePocketNotches({
        waistX: torsoWaistX,
        waistY: Math.max(armholeDepth + 4, bodiceLen - 6),
        hipX: quarterHip,
        hipY: totalLen,
      })
    : [];

  const frontUpperSide: PathCommand[] = kimonoWing
    ? [...kimonoWing.commands, { type: "L", x: torsoWaistX, y: bodiceLen }]
    : [
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
        { type: "L", x: torsoWaistX, y: bodiceLen },
      ];

  const lapelGeom = useTailoredLapel
    ? buildTailoredLapelFrontGeometry({
        neckW,
        frontNeckDrop,
        armholeDepth,
        bodiceLen,
        totalLen,
      })
    : null;

  const frontInternalLines: PatternInternalLine[] = [
    ...(lapelGeom ? lapelGeom.internalLines : []),
    ...(isTailoredGarment
      ? [
          buildVerticalWaistDart({
            centerX: Math.max(6.5, quarterBust * 0.48),
            topY: armholeDepth + 3.5,
            waistY: bodiceLen,
            botY: Math.min(totalLen - 3, bodiceLen + hipExt * 0.68),
            halfWidthCm: 1.4,
            label: "Pinza de entalle",
          }),
        ]
      : []),
    ...(extras?.flapPockets
      ? [
          createFlapPocketMarkLine({
            xStart: Math.max(3.5, quarterWaist * 0.22),
            yTop: Math.min(totalLen - 5, bodiceLen + 4.5),
            widthCm: Math.min(14.5, Math.max(10.5, quarterHip * 0.52)),
          }),
        ]
      : []),
  ];

  // 1. DELANTERO (simétrico al doblez, Frente Cruzado o Solapa Sastre)
  const frontSeam: PathCommand[] = isWrapFront
    ? [
        { type: "M", x: neckW, y: 0 },
        ...frontUpperSide,
        {
          type: "C",
          cp1x: torsoWaistX + (quarterHip - torsoWaistX) * 0.45,
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
    : lapelGeom
      ? [
          { type: "M", x: neckW, y: 0 },
          ...frontUpperSide,
          {
            type: "C",
            cp1x: torsoWaistX + (quarterHip - torsoWaistX) * 0.45,
            cp1y: bodiceLen + hipExt * 0.35,
            cp2x: quarterHip,
            cp2y: bodiceLen + hipExt * 0.75,
            x: quarterHip,
            y: totalLen,
          },
          ...lapelGeom.closingCommands,
          { type: "Z" },
        ]
      : [
          { type: "M", x: 0, y: frontNeckDrop },
          ...buildNecklineCommand(neckW, frontNeckDrop, necklineStyle),
          ...frontUpperSide,
          {
            type: "C",
            cp1x: torsoWaistX + (quarterHip - torsoWaistX) * 0.45,
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
          : useTailoredLapel
            ? "DELANTERO CHAQUETA / BLAZER (x2)"
            : subStyle === "jacket" || useShirtCollar
              ? "DELANTERO CHAQUETA (x2)"
              : "DELANTERO (x1 al doblez)",
        subtitle: isWrapFront
          ? kimonoWing
            ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Cortar 2 piezas`
            : "Cortar 2 piezas (Izquierda y Derecha)"
          : useTailoredLapel
            ? "Con cruce, solapa y pinza | Cortar 2 piezas"
            : kimonoWing
              ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoWing.underarmCurveLenCm} cm`
              : `Sisa: ${frontArmholeLen.toFixed(1)} cm`,
        tabLabel: isWrapFront
          ? "Delantero Cruzado"
          : useTailoredLapel
            ? "Delantero Solapa"
            : "Delantero",
        seamPath: frontSeam,
        grainline: {
          x1: Math.max(4, quarterWaist * 0.45),
          y1: Math.max(frontNeckDrop + 3, 12),
          x2: Math.max(4, quarterWaist * 0.45),
          y2: totalLen - 6,
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
            : [{ x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" }]),
          {
            x: torsoWaistX,
            y: bodiceLen,
            angle: 0,
            label: torsoFit === "loose" ? "Cintura holgada" : "Cintura",
          },
          ...(lapelGeom ? lapelGeom.notches : []),
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
        internalLines: frontInternalLines.length > 0 ? frontInternalLines : undefined,
        labelPos: { x: quarterWaist * 0.48, y: bodiceLen * 0.68 },
        foldLine:
          subStyle === "jacket" || isWrapFront || useTailoredLapel || useShirtCollar
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
  const backUpperSide: PathCommand[] = kimonoWing
    ? [...kimonoWing.commands, { type: "L", x: torsoWaistX, y: bodiceLen }]
    : [
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
        { type: "L", x: torsoWaistX, y: bodiceLen },
      ];

  const backSeam: PathCommand[] = [
    { type: "M", x: 0, y: backNeckDrop },
    ...buildNecklineCommand(neckW, backNeckDrop, "round"),
    ...backUpperSide,
    {
      type: "C",
      cp1x: torsoWaistX + (quarterHip - torsoWaistX) * 0.45,
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
        subtitle: kimonoWing
          ? `Manga Kimono (${kimonoWing.shoulderSleeveLenCm} cm) | Axila: ${kimonoWing.underarmCurveLenCm} cm`
          : `Sisa: ${backArmholeLen.toFixed(1)} cm`,
        tabLabel: "Trasero",
        seamPath: backSeam,
        grainline: {
          x1: Math.max(4, quarterWaist * 0.45),
          y1: 10,
          x2: Math.max(4, quarterWaist * 0.45),
          y2: totalLen - 6,
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
            : [{ x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" }]),
          {
            x: torsoWaistX,
            y: bodiceLen,
            angle: 0,
            label: torsoFit === "loose" ? "Cintura holgada" : "Cintura",
          },
        ],
        labelPos: { x: quarterWaist * 0.48, y: bodiceLen * 0.7 },
        internalLines: isTailoredGarment
          ? [
              buildVerticalWaistDart({
                centerX: Math.max(6.0, quarterBust * 0.44),
                topY: armholeDepth + 3.0,
                waistY: bodiceLen,
                botY: Math.min(totalLen - 3, bodiceLen + hipExt * 0.68),
                halfWidthCm: 1.4,
                label: "Pinza espalda",
              }),
            ]
          : undefined,
        foldLine: { x1: 0, y1: backNeckDrop, x2: 0, y2: totalLen },
      },
      seamAllowance
    )
  );

  // 3. MANGA (estándar o acampanada; omitida en Kimono/Murciélago)
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

  // 4. CUELLOS / VISTAS (Solapa Sastre, Cuello Camisero o Vista simple)
  if (!isWrapFront) {
    if (useTailoredLapel) {
      pieces.push(
        ...buildTailoredCollarAndFacingPieces({
          neckW,
          shoulderX,
          shoulderSlope,
          frontNeckDrop,
          armholeDepth,
          bodiceLen,
          totalLen,
          seamAllowance,
        })
      );
    } else if (useShirtCollar) {
      pieces.push(
        ...buildShirtDressDetailPieces({
          neckW,
          frontLengthCm: totalLen - frontNeckDrop,
          seamAllowance,
        })
      );
    } else {
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
            labelAngle: 0,
            labelMaxSpanCm: collarLen - 4,
            labelBandWidthCm: collarH,
          },
          seamAllowance
        )
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
          ? "Blusa / Camisa con Cuello"
          : "Blusa / Camisa",
    jacket: "Chaqueta / Blazer",
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
