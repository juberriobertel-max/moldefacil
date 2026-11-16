import {
  FabricType,
  GarmentExtras,
  JumpsuitSubStyle,
  Measurements,
  NecklineStyle,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
  SleeveStyle,
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
  buildKimonoWingSegment,
  buildPocketBagPiece,
  buildSleevePiece,
  buildWaistbandPiece,
  buildWaistTiePiece,
  computeTorsoWaistHalfWidth,
  createSidePocketNotches,
} from "./extrasEngine";

export interface JumpsuitEngineInput {
  measurements: Measurements;
  subStyle: JumpsuitSubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle?: SleeveStyle;
  torsoFit?: TorsoFit;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
}

export function generateJumpsuitPattern(
  input: JumpsuitEngineInput
): PatternResult {
  const {
    measurements,
    subStyle,
    necklineStyle,
    sleeveStyle = "short",
    torsoFit = "fitted",
    seamAllowance,
    fabricType,
    lengthMultiplier = 1,
    extras,
  } = input;

  const { easeFactor, flatEase, label } = computeEase(fabricType, 2, torsoFit);

  const effBust = measurements.bust * easeFactor + flatEase;
  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const effBack = measurements.backWidth * easeFactor + flatEase * 0.4;
  const effThigh = measurements.thigh * easeFactor + flatEase * 0.5;

  const quarterBust = effBust / 4;
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;
  const halfBack = effBack / 2;

  const torsoWaistX = computeTorsoWaistHalfWidth({
    quarterBust,
    quarterWaist,
    quarterHip,
    torsoFit,
    minExtraOverWaist: 1.0,
  });

  // +3 cm vertical ease in crotch depth for sitting/movement comfort in jumpsuits & overalls
  const verticalCrotchEaseCm = 3.0;
  const crotchDepth = Number(
    (measurements.crotchDepth + verticalCrotchEaseCm).toFixed(1)
  );
  const isShortRomper = subStyle === "romper_short";
  const legLength =
    (isShortRomper
      ? Math.min(24, Math.max(11, measurements.inseam * 0.24))
      : Math.max(52, measurements.inseam)) * lengthMultiplier;
  const lowerTotalLen = crotchDepth + legLength;
  const kneeY = crotchDepth + legLength * 0.52;

  const frontCrotchExt = Math.max(4.8, effHip * 0.058);
  const backCrotchExt = Math.max(8.8, effHip * 0.112);
  const halfHem = isShortRomper
    ? Math.max(15, effThigh * 0.48)
    : Math.max(14.5, measurements.hemWidth / 2);

  const pieces: PatternPiece[] = [];

  if (subStyle === "overall") {
    // =========================================================================
    // OVEROL / JARDINERA (Pechera Delantera + Pechera Trasera + Tirantes + Pantalón)
    // =========================================================================
    const bibHeight = Math.max(22, Math.round(measurements.bodiceLength * 0.62));
    const bibTopHalfW = Math.max(10.5, Number((quarterBust * 0.56).toFixed(1)));
    const bibBottomHalfW = Number((torsoWaistX * 0.92).toFixed(1));
    const sCurveDrop = 5.5;

    const frontBibSeam: PathCommand[] = [
      { type: "M", x: 0, y: 0 },
      { type: "L", x: bibTopHalfW, y: 0 },
      {
        type: "C",
        cp1x: bibTopHalfW,
        cp1y: bibHeight * 0.42,
        cp2x: bibBottomHalfW,
        cp2y: bibHeight * 0.65,
        x: bibBottomHalfW,
        y: bibHeight,
      },
      { type: "L", x: 0, y: bibHeight },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "overall_bib_front",
          name: "PECHERA DELANTERA OVEROL (x2 tela + forro)",
          subtitle: `Alto: ${bibHeight} cm | Cortar al doblez`,
          tabLabel: "Pechera Del.",
          seamPath: frontBibSeam,
          grainline: { x1: bibTopHalfW * 0.48, y1: 3, x2: bibTopHalfW * 0.48, y2: bibHeight - 3 },
          notches: [
            { x: bibTopHalfW - 2, y: 0, angle: -90, label: "Broche tirante" },
            { x: bibBottomHalfW, y: bibHeight, angle: 0, label: "Unión cintura" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: 5 },
                { type: "L", x: bibTopHalfW * 0.72, y: 5 },
                { type: "L", x: bibTopHalfW * 0.72, y: 15 },
                { type: "L", x: 0, y: 15 },
              ],
              style: "mark",
              label: "Bolsillo pechera",
              labelPos: { x: bibTopHalfW * 0.36, y: 10 },
            },
          ],
          labelPos: { x: bibBottomHalfW * 0.48, y: bibHeight * 0.72 },
          foldLine: { x1: 0, y1: 0, x2: 0, y2: bibHeight },
        },
        seamAllowance
      )
    );

    const backBibTopHalfW = Math.max(8.5, Number((quarterBust * 0.44).toFixed(1)));
    const backBibSeam: PathCommand[] = [
      { type: "M", x: 0, y: sCurveDrop },
      { type: "L", x: backBibTopHalfW, y: 0 },
      {
        type: "C",
        cp1x: backBibTopHalfW + 1.2,
        cp1y: bibHeight * 0.45,
        cp2x: bibBottomHalfW,
        cp2y: bibHeight * 0.72,
        x: bibBottomHalfW,
        y: bibHeight,
      },
      { type: "L", x: 0, y: bibHeight },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "overall_bib_back",
          name: "PECHERA TRASERA OVEROL (x2)",
          subtitle: `Espalda alta con salida a tirantes`,
          tabLabel: "Pechera Tras.",
          seamPath: backBibSeam,
          grainline: { x1: backBibTopHalfW * 0.48, y1: 6, x2: backBibTopHalfW * 0.48, y2: bibHeight - 3 },
          notches: [
            { x: backBibTopHalfW * 0.65, y: 1.2, angle: -90, label: "Unión tirante" },
            { x: bibBottomHalfW, y: bibHeight, angle: 0, label: "Cintura espalda" },
          ],
          labelPos: { x: bibBottomHalfW * 0.48, y: bibHeight * 0.62 },
          foldLine: { x1: 0, y1: sCurveDrop, x2: 0, y2: bibHeight },
        },
        seamAllowance
      )
    );

    const strapLen = Math.max(48, Math.round(measurements.bodiceLength * 1.28));
    const strapW = 8.0; // 4 cm finished folded width
    const strapSeam: PathCommand[] = [
      { type: "M", x: 0, y: 0 },
      { type: "L", x: strapLen, y: 0 },
      { type: "L", x: strapLen, y: strapW },
      { type: "L", x: 0, y: strapW },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "overall_straps",
          name: "TIRANTES AJUSTABLES OVEROL (x2)",
          subtitle: `Cortar 2 tiras (${strapLen} × ${strapW} cm, ancho final 4 cm)`,
          tabLabel: "Tirantes",
          seamPath: strapSeam,
          grainline: { x1: 5, y1: strapW / 2, x2: strapLen - 5, y2: strapW / 2 },
          notches: [
            { x: 4, y: 0, angle: -90, label: "Ojal / Hebilla" },
            { x: strapLen - 4, y: 0, angle: -90, label: "Espalda" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: strapW / 2 },
                { type: "L", x: strapLen, y: strapW / 2 },
              ],
              style: "fold",
              label: "Doblez central",
              labelPos: { x: strapLen * 0.5, y: strapW * 0.32 },
            },
          ],
          labelPos: { x: strapLen * 0.5, y: strapW * 0.68 },
          labelAngle: 0,
          labelMaxSpanCm: strapLen - 8,
          labelBandWidthCm: strapW,
        },
        seamAllowance
      )
    );
  } else {
    // =========================================================================
    // ENTERIZO LARGO / CORTO (ROMPER): Corpiño Superior + Mangas
    // =========================================================================
    const bodiceLen = measurements.bodiceLength * lengthMultiplier;
    const isKimono = sleeveStyle === "kimono";
    const neckW = Math.max(6.2, effBust * 0.075);
    const frontNeckDrop =
      necklineStyle === "v_neck" || necklineStyle === "tailored_lapel"
        ? 14
        : necklineStyle === "square"
          ? 10.5
          : necklineStyle === "high" || necklineStyle === "shirt_collar"
            ? 4.2
            : 9;
    const backNeckDrop = 2.6;
    const shoulderSlope = 2.8;
    const shoulderX = Math.max(neckW + 6, halfBack + 1.5);
    const armholeDepth = Math.max(17, effBust * 0.215);

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

    const buildBodicePanel = (isFront: boolean): PatternPiece => {
      const neckDrop = isFront ? frontNeckDrop : backNeckDrop;
      const upperSide: PathCommand[] = kimonoWing
        ? [...kimonoWing.commands, { type: "L", x: torsoWaistX, y: bodiceLen }]
        : [
            { type: "L", x: shoulderX, y: shoulderSlope },
            {
              type: "C",
              cp1x: shoulderX - (isFront ? 1.5 : 0.5),
              cp1y: armholeDepth * 0.56,
              cp2x: quarterBust * 0.85,
              cp2y: armholeDepth,
              x: quarterBust,
              y: armholeDepth,
            },
            { type: "L", x: torsoWaistX, y: bodiceLen },
          ];

      const seam: PathCommand[] = [
        { type: "M", x: 0, y: neckDrop },
        ...buildNecklineCommand(
          neckW,
          neckDrop,
          isFront ? necklineStyle : "round"
        ),
        ...upperSide,
        { type: "L", x: 0, y: bodiceLen },
        { type: "Z" },
      ];

      return normalizePiece(
        {
          id: isFront ? "romper_top_front" : "romper_top_back",
          name: isFront
            ? "CORPIÑO DELANTERO ENTERIZO (x1 doblez)"
            : "CORPIÑO TRASERO ENTERIZO (x2 cierre)",
          subtitle: `Sisa: ${(isFront ? frontArmholeLen : backArmholeLen).toFixed(1)} cm | Unión cintura`,
          tabLabel: isFront ? "Corpiño Del." : "Corpiño Tras.",
          seamPath: seam,
          grainline: {
            x1: torsoWaistX * 0.45,
            y1: Math.max(neckDrop + 3, 10),
            x2: torsoWaistX * 0.45,
            y2: bodiceLen - 4,
          },
          notches: [
            { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
            { x: torsoWaistX, y: bodiceLen, angle: 0, label: "Cintura" },
          ],
          labelPos: { x: torsoWaistX * 0.48, y: bodiceLen * 0.65 },
          foldLine: isFront
            ? { x1: 0, y1: neckDrop, x2: 0, y2: bodiceLen }
            : undefined,
        },
        seamAllowance
      );
    };

    pieces.push(buildBodicePanel(true), buildBodicePanel(false));

    const sleevePiece = buildSleevePiece({
      armholeDepth,
      totalArmholePerimeter: frontArmholeLen + backArmholeLen,
      sleeveLengthCm: measurements.sleeveLength,
      sleeveStyle,
      flaredSleeve: extras?.flaredSleeve,
      seamAllowance,
    });
    if (sleevePiece) {
      pieces.push(sleevePiece);
    }
  }

  // =========================================================================
  // PANTALÓN / SHORT INFERIOR CON +3 CM DE HOLGURA VERTICAL EN EL TIRO
  // =========================================================================
  const frontCenterX = quarterHip / 2 + frontCrotchExt + 2;
  const frontOutWaistX = frontCenterX - torsoWaistX / 2;
  const frontInWaistX = frontCenterX + torsoWaistX / 2;
  const frontOutHipX = frontCenterX - quarterHip / 2 - 1.2;
  const frontCrotchTipX = frontCenterX + quarterHip / 2 + frontCrotchExt;

  const frontLegSeam: PathCommand[] = [
    { type: "M", x: frontOutWaistX, y: 0.8 },
    { type: "L", x: frontInWaistX, y: 0 },
    { type: "L", x: frontInWaistX, y: crotchDepth * 0.58 },
    {
      type: "C",
      cp1x: frontInWaistX,
      cp1y: crotchDepth * 0.88,
      cp2x: frontInWaistX + frontCrotchExt * 0.55,
      cp2y: crotchDepth,
      x: frontCrotchTipX,
      y: crotchDepth,
    },
    ...(isShortRomper
      ? [{ type: "L" as const, x: frontCenterX + halfHem, y: lowerTotalLen }]
      : [
          {
            type: "C" as const,
            cp1x: frontCrotchTipX - 1.2,
            cp1y: crotchDepth + (kneeY - crotchDepth) * 0.45,
            cp2x: frontCenterX + halfHem + 1.5,
            cp2y: kneeY - 5,
            x: frontCenterX + halfHem + 1.2,
            y: kneeY,
          },
          { type: "L" as const, x: frontCenterX + halfHem, y: lowerTotalLen },
        ]),
    { type: "L", x: frontCenterX - halfHem, y: lowerTotalLen },
    { type: "L", x: frontOutHipX, y: crotchDepth },
    {
      type: "C",
      cp1x: frontOutHipX,
      cp1y: crotchDepth * 0.5,
      cp2x: frontOutWaistX,
      cp2y: crotchDepth * 0.25,
      x: frontOutWaistX,
      y: 0.8,
    },
    { type: "Z" },
  ];

  pieces.push(
    normalizePiece(
      {
        id: "front_leg",
        name: isShortRomper
          ? "SHORT DELANTERO ENTERIZO (x2)"
          : "PANTALÓN DELANTERO ENTERIZO (x2)",
        subtitle: `Tiro: ${crotchDepth} cm (incluye +3 cm holgura movimiento)`,
        tabLabel: isShortRomper ? "Short Del." : "Pantalón Del.",
        seamPath: frontLegSeam,
        grainline: { x1: frontCenterX, y1: 5, x2: frontCenterX, y2: lowerTotalLen - 5 },
        notches: [
          { x: frontOutHipX, y: crotchDepth, angle: 180, label: "Cadera / Tiro (+3 cm)" },
          ...(extras?.sidePockets
            ? createSidePocketNotches({
                waistX: frontOutWaistX,
                waistY: 0.8,
                hipX: frontOutHipX,
                hipY: crotchDepth,
                angle: 180,
              })
            : []),
        ],
        labelPos: { x: frontCenterX, y: crotchDepth * 1.08 },
      },
      seamAllowance
    )
  );

  const backRiseLift = 3.2;
  const backCenterX = quarterHip / 2 + backCrotchExt + 2;
  const backOutWaistX = backCenterX - torsoWaistX / 2 - 0.8;
  const backInWaistX = backCenterX + torsoWaistX / 2 - 0.8;
  const backOutHipX = backCenterX - quarterHip / 2 - 1.8;
  const backCrotchTipX = backCenterX + quarterHip / 2 + backCrotchExt;

  const backLegSeam: PathCommand[] = [
    { type: "M", x: backOutWaistX, y: backRiseLift },
    { type: "L", x: backInWaistX, y: 0 },
    { type: "L", x: backInWaistX + 1.4, y: crotchDepth * 0.62 + backRiseLift },
    {
      type: "C",
      cp1x: backInWaistX + 2.2,
      cp1y: crotchDepth + backRiseLift * 0.6,
      cp2x: backInWaistX + backCrotchExt * 0.65,
      cp2y: crotchDepth + backRiseLift + 1.0,
      x: backCrotchTipX,
      y: crotchDepth + backRiseLift + 0.6,
    },
    { type: "L", x: backCenterX + halfHem + 1, y: lowerTotalLen + backRiseLift },
    { type: "L", x: backCenterX - halfHem - 1, y: lowerTotalLen + backRiseLift },
    { type: "L", x: backOutHipX, y: crotchDepth + backRiseLift },
    {
      type: "C",
      cp1x: backOutHipX,
      cp1y: (crotchDepth + backRiseLift) * 0.5,
      cp2x: backOutWaistX,
      cp2y: backRiseLift + crotchDepth * 0.25,
      x: backOutWaistX,
      y: backRiseLift,
    },
    { type: "Z" },
  ];

  pieces.push(
    normalizePiece(
      {
        id: "back_leg",
        name: isShortRomper
          ? "SHORT TRASERO ENTERIZO (x2)"
          : "PANTALÓN TRASERO ENTERIZO (x2)",
        subtitle: `Tiro tras: ${(crotchDepth + backRiseLift).toFixed(1)} cm (+3 cm holgura)`,
        tabLabel: isShortRomper ? "Short Tras." : "Pantalón Tras.",
        seamPath: backLegSeam,
        grainline: {
          x1: backCenterX,
          y1: 6,
          x2: backCenterX,
          y2: lowerTotalLen + backRiseLift - 5,
        },
        notches: [
          {
            x: backOutHipX,
            y: crotchDepth + backRiseLift,
            angle: 180,
            label: "Cadera / Tiro",
          },
        ],
        labelPos: { x: backCenterX, y: (crotchDepth + backRiseLift) * 1.08 },
      },
      seamAllowance
    )
  );

  pieces.push(buildWaistbandPiece(torsoWaistX * 4, seamAllowance));

  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }
  if (extras?.sidePockets) {
    pieces.push(buildPocketBagPiece(seamAllowance));
  }
  if (extras?.flapPockets) {
    pieces.push(...buildFlapPocketPieces(seamAllowance));
  }

  const subLabels: Record<JumpsuitSubStyle, string> = {
    romper_long: "Enterizo Largo (+3 cm holgura tiro)",
    romper_short: "Enterizo Corto / Romper (+3 cm tiro)",
    overall: "Overol / Jardinera con Pechera y Tirantes",
  };

  return {
    category: "jumpsuit",
    subStyleLabel: subLabels[subStyle],
    pieces,
    fabricConsumption: {
      width140m: estimateFabricMeters(pieces, 140),
      width150m: estimateFabricMeters(pieces, 150),
    },
    totalBoundsCm: packPiecesOnSheet(pieces, 5),
    appliedEaseLabel: `${label} • +3 cm holgura vertical de tiro`,
  };
}
