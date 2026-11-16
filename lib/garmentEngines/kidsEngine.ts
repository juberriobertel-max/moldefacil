import {
  FabricType,
  GarmentExtras,
  KidsSubStyle,
  Measurements,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
} from "../types";
import {
  cubicBezierLength,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import { buildHemRufflePiece, buildPocketBagPiece } from "./extrasEngine";
import { solveSleeveCapDimensions } from "../seamValidator";

export interface KidsSizePreset {
  id: string;
  label: string;
  measurements: Partial<Measurements>;
}

export const KIDS_SIZE_PRESETS: KidsSizePreset[] = [
  {
    id: "baby_9m",
    label: "Bebé (6–12 meses)",
    measurements: {
      bust: 48,
      waist: 47,
      hip: 50,
      backWidth: 21,
      bodiceLength: 20,
      sleeveLength: 23,
      skirtLength: 24,
      crotchDepth: 16,
      thigh: 29,
      inseam: 24,
      hemWidth: 20,
    },
  },
  {
    id: "kids_2y",
    label: "Talla 2 años",
    measurements: {
      bust: 53,
      waist: 51,
      hip: 55,
      backWidth: 23,
      bodiceLength: 23,
      sleeveLength: 30,
      skirtLength: 30,
      crotchDepth: 18,
      thigh: 32,
      inseam: 34,
      hemWidth: 22,
    },
  },
  {
    id: "kids_4y",
    label: "Talla 4 años",
    measurements: {
      bust: 57,
      waist: 54,
      hip: 60,
      backWidth: 25,
      bodiceLength: 26,
      sleeveLength: 36,
      skirtLength: 36,
      crotchDepth: 19,
      thigh: 35,
      inseam: 43,
      hemWidth: 24,
    },
  },
  {
    id: "kids_6y",
    label: "Talla 6 años",
    measurements: {
      bust: 61,
      waist: 56,
      hip: 65,
      backWidth: 27,
      bodiceLength: 29,
      sleeveLength: 41,
      skirtLength: 42,
      crotchDepth: 20,
      thigh: 38,
      inseam: 51,
      hemWidth: 26,
    },
  },
  {
    id: "kids_8y",
    label: "Talla 8 años",
    measurements: {
      bust: 66,
      waist: 59,
      hip: 71,
      backWidth: 29,
      bodiceLength: 32,
      sleeveLength: 46,
      skirtLength: 47,
      crotchDepth: 21,
      thigh: 41,
      inseam: 58,
      hemWidth: 28,
    },
  },
  {
    id: "kids_10y",
    label: "Talla 10 años",
    measurements: {
      bust: 71,
      waist: 62,
      hip: 76,
      backWidth: 31,
      bodiceLength: 35,
      sleeveLength: 50,
      skirtLength: 52,
      crotchDepth: 22,
      thigh: 44,
      inseam: 64,
      hemWidth: 30,
    },
  },
];

export interface KidsEngineInput {
  measurements: Measurements;
  subStyle: KidsSubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
}

export function generateKidsPattern(input: KidsEngineInput): PatternResult {
  const {
    measurements,
    subStyle,
    seamAllowance,
    fabricType,
    lengthMultiplier = 1,
    extras,
  } = input;

  // If adult defaults are still active (>78 cm bust), scale down automatically to a comfortable kids/baby base
  const isAdultDefault = measurements.bust > 78;
  const effBust = isAdultDefault
    ? subStyle === "baby_bodysuit"
      ? 50
      : 60
    : Math.min(78, Math.max(44, measurements.bust));
  const effHip = isAdultDefault
    ? subStyle === "baby_bodysuit"
      ? 52
      : 64
    : Math.min(82, Math.max(46, measurements.hip));
  const effBodice = isAdultDefault
    ? subStyle === "baby_bodysuit"
      ? 22
      : 28
    : Math.min(38, Math.max(18, measurements.bodiceLength));

  const quarterBust = effBust / 4 + 1.2;
  const quarterHip = effHip / 4 + 1.2;

  const pieces: PatternPiece[] = [];

  if (subStyle === "baby_bodysuit") {
    // =========================================================================
    // 1. PELELE / BODY DE BEBÉ (Con curva inferior para pañal y vistas de broches)
    // =========================================================================
    const neckW = Math.max(4.5, effBust * 0.095);
    const shoulderX = Math.max(neckW + 4.2, effBust * 0.21);
    const shoulderSlope = 1.6;
    const armholeDepth = Math.max(10.5, effBust * 0.22);
    const hipLegTopY = Math.max(24, effBodice * 1.12) * lengthMultiplier;
    const crotchSnapW = 3.2; // Half-width of bottom snap tab (6.4 cm total for 3 snaps)
    const frontTotalY = hipLegTopY + 11.5;
    const backTotalY = hipLegTopY + 13.0; // Slightly longer back diaper curve for room

    const buildBodyPanel = (isFront: boolean): PatternPiece => {
      const neckDrop = isFront ? 4.2 : 1.8;
      const totalY = isFront ? frontTotalY : backTotalY;
      const legCurveCp1X = quarterHip * (isFront ? 0.86 : 0.92);
      const legCurveCp1Y = hipLegTopY + (totalY - hipLegTopY) * (isFront ? 0.18 : 0.45);
      const legCurveCp2X = crotchSnapW + (isFront ? 1.0 : 2.2);
      const legCurveCp2Y = totalY - (isFront ? 3.5 : 2.2);

      const seam: PathCommand[] = [
        { type: "M", x: 0, y: neckDrop },
        {
          type: "C",
          cp1x: neckW * 0.55,
          cp1y: neckDrop,
          cp2x: neckW,
          cp2y: neckDrop * 0.5,
          x: neckW,
          y: 0,
        },
        { type: "L", x: shoulderX, y: shoulderSlope },
        {
          type: "C",
          cp1x: shoulderX - 0.8,
          cp1y: armholeDepth * 0.55,
          cp2x: quarterBust * 0.86,
          cp2y: armholeDepth,
          x: quarterBust,
          y: armholeDepth,
        },
        { type: "L", x: quarterHip, y: hipLegTopY },
        // Diaper leg opening curve
        {
          type: "C",
          cp1x: legCurveCp1X,
          cp1y: legCurveCp1Y,
          cp2x: legCurveCp2X,
          cp2y: legCurveCp2Y,
          x: crotchSnapW,
          y: totalY,
        },
        { type: "L", x: 0, y: totalY },
        { type: "Z" },
      ];

      return normalizePiece(
        {
          id: isFront ? "kids_front" : "kids_back",
          name: isFront
            ? "DELANTERO BODY BEBÉ (x1 al doblez)"
            : "TRASERO BODY BEBÉ (x1 al doblez)",
          subtitle: isFront
            ? "Curva anatómica de pañal + lengüeta inferior"
            : "Espalda con espacio extra para pañal",
          tabLabel: isFront ? "Body Delantero" : "Body Trasero",
          seamPath: seam,
          grainline: {
            x1: quarterBust * 0.42,
            y1: neckDrop + 4,
            x2: quarterBust * 0.42,
            y2: totalY - 5,
          },
          notches: [
            { x: neckW + 1.5, y: 0.4, angle: -90, label: "Cruce hombro" },
            { x: quarterHip, y: hipLegTopY, angle: 0, label: "Inicio pierna pañal" },
            { x: crotchSnapW * 0.5, y: totalY, angle: 90, label: "3 Broches" },
          ],
          labelPos: { x: quarterBust * 0.48, y: hipLegTopY * 0.62 },
          foldLine: { x1: 0, y1: neckDrop, x2: 0, y2: totalY },
        },
        seamAllowance
      );
    };

    pieces.push(buildBodyPanel(true), buildBodyPanel(false));

    // Sleeve for baby bodysuit
    const singleArmholeLen = cubicBezierLength(
      { x: shoulderX, y: shoulderSlope },
      { x: shoulderX - 0.8, y: armholeDepth * 0.55 },
      { x: quarterBust * 0.86, y: armholeDepth },
      { x: quarterBust, y: armholeDepth }
    );
    const totalArmhole = singleArmholeLen * 2;
    const { capHeight, sleeveWidth, capArcLengthCm, easeCm } =
      solveSleeveCapDimensions(totalArmhole, armholeDepth, 1.1);
    const halfSl = sleeveWidth / 2;
    const slLen = 11.5;
    const cuffHalf = halfSl * 0.82;

    pieces.push(
      normalizePiece(
        {
          id: "kids_sleeve",
          name: "MANGA CORTA BEBÉ (x2)",
          subtitle: `Sisa: ${totalArmhole.toFixed(1)} cm → Copa: ${capArcLengthCm.toFixed(1)} cm (+${easeCm.toFixed(2)} cm)`,
          tabLabel: "Manga Bebé",
          seamPath: [
            { type: "M", x: halfSl, y: 0 },
            {
              type: "C",
              cp1x: halfSl + halfSl * 0.44,
              cp1y: 0,
              cp2x: sleeveWidth - halfSl * 0.34,
              cp2y: capHeight,
              x: sleeveWidth,
              y: capHeight,
            },
            { type: "L", x: halfSl + cuffHalf, y: slLen },
            { type: "L", x: halfSl - cuffHalf, y: slLen },
            { type: "L", x: 0, y: capHeight },
            {
              type: "C",
              cp1x: halfSl * 0.34,
              cp1y: capHeight,
              cp2x: halfSl - halfSl * 0.44,
              cp2y: 0,
              x: halfSl,
              y: 0,
            },
            { type: "Z" },
          ],
          grainline: { x1: halfSl, y1: 2.5, x2: halfSl, y2: slLen - 2 },
          notches: [{ x: halfSl, y: 0, angle: -90, label: "Hombro" }],
          labelPos: { x: halfSl, y: slLen * 0.56 },
        },
        seamAllowance
      )
    );

    // Vista de entrepierna para broches (Snap reinforce facing)
    const snapFacingW = crotchSnapW * 2;
    const snapFacingH = 5.5;
    pieces.push(
      normalizePiece(
        {
          id: "snap_facing",
          name: "VISTA DE ENTREPIERNA PARA BROCHES (x2)",
          subtitle: `Refuerzo para 3 broches metálicos (${snapFacingW.toFixed(1)} × ${snapFacingH} cm)`,
          tabLabel: "Vista Broches",
          seamPath: [
            { type: "M", x: 0, y: 0 },
            { type: "L", x: snapFacingW, y: 0 },
            { type: "L", x: snapFacingW, y: snapFacingH },
            { type: "L", x: 0, y: snapFacingH },
            { type: "Z" },
          ],
          grainline: { x1: 1.2, y1: snapFacingH / 2, x2: snapFacingW - 1.2, y2: snapFacingH / 2 },
          notches: [
            { x: snapFacingW * 0.25, y: snapFacingH / 2, angle: 0, label: "Broche 1" },
            { x: snapFacingW * 0.5, y: snapFacingH / 2, angle: 0, label: "Broche 2" },
            { x: snapFacingW * 0.75, y: snapFacingH / 2, angle: 0, label: "Broche 3" },
          ],
          labelPos: { x: snapFacingW / 2, y: snapFacingH * 0.52 },
          labelAngle: 0,
          labelMaxSpanCm: snapFacingW - 1,
          labelBandWidthCm: snapFacingH,
        },
        seamAllowance
      )
    );
  } else if (subStyle === "kids_dress") {
    // =========================================================================
    // 2. VESTIDO INFANTIL EVASÉ (Tallas 1 a 10 años: Corpiño corto + Falda amplia)
    // =========================================================================
    const shortBodiceLen = Math.max(17, Math.round(effBodice * 0.78));
    const skirtLen = Math.max(
      26,
      Math.round(
        (isAdultDefault ? 38 : Math.min(68, measurements.skirtLength)) *
          lengthMultiplier
      )
    );
    const neckW = Math.max(5.0, effBust * 0.088);
    const shoulderX = Math.max(neckW + 4.8, effBust * 0.215);
    const shoulderSlope = 2.0;
    const armholeDepth = Math.max(12, effBust * 0.215);
    const backButtonOverlap = 2.2;

    const frontBodiceSeam: PathCommand[] = [
      { type: "M", x: 0, y: 5.2 },
      {
        type: "C",
        cp1x: neckW * 0.55,
        cp1y: 5.2,
        cp2x: neckW,
        cp2y: 2.5,
        x: neckW,
        y: 0,
      },
      { type: "L", x: shoulderX, y: shoulderSlope },
      {
        type: "C",
        cp1x: shoulderX - 1.0,
        cp1y: armholeDepth * 0.55,
        cp2x: quarterBust * 0.85,
        cp2y: armholeDepth,
        x: quarterBust,
        y: armholeDepth,
      },
      { type: "L", x: quarterBust + 0.5, y: shortBodiceLen },
      { type: "L", x: 0, y: shortBodiceLen },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "kids_front",
          name: "CORPIÑO DELANTERO INFANTIL (x1 doblez)",
          subtitle: `Talle corto infantil (${shortBodiceLen} cm)`,
          tabLabel: "Corpiño Del.",
          seamPath: frontBodiceSeam,
          grainline: {
            x1: quarterBust * 0.45,
            y1: 7,
            x2: quarterBust * 0.45,
            y2: shortBodiceLen - 3,
          },
          notches: [
            { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
            { x: quarterBust * 0.5, y: shortBodiceLen, angle: 90, label: "Unión falda" },
          ],
          labelPos: { x: quarterBust * 0.48, y: shortBodiceLen * 0.62 },
          foldLine: { x1: 0, y1: 5.2, x2: 0, y2: shortBodiceLen },
        },
        seamAllowance
      )
    );

    const backBodiceSeam: PathCommand[] = [
      { type: "M", x: -backButtonOverlap, y: 2.2 },
      { type: "L", x: 0, y: 2.2 },
      {
        type: "C",
        cp1x: neckW * 0.55,
        cp1y: 2.2,
        cp2x: neckW,
        cp2y: 1.0,
        x: neckW,
        y: 0,
      },
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
      { type: "L", x: quarterBust + 0.5, y: shortBodiceLen },
      { type: "L", x: -backButtonOverlap, y: shortBodiceLen },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "kids_back",
          name: "CORPIÑO TRASERO INFANTIL (x2 con cruce botones)",
          subtitle: `Incluye +${backButtonOverlap} cm cruce trasero para botones`,
          tabLabel: "Corpiño Tras.",
          seamPath: backBodiceSeam,
          grainline: {
            x1: quarterBust * 0.45,
            y1: 5,
            x2: quarterBust * 0.45,
            y2: shortBodiceLen - 3,
          },
          notches: [
            { x: 0, y: 2.2, angle: -90, label: "Centro espalda" },
            { x: quarterBust, y: armholeDepth, angle: 0, label: "Sisa" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: 2.2 },
                { type: "L", x: 0, y: shortBodiceLen },
              ],
              style: "fold",
              label: "Cruce botones",
              labelPos: { x: 0.6, y: shortBodiceLen * 0.55 },
            },
          ],
          labelPos: { x: quarterBust * 0.52, y: shortBodiceLen * 0.62 },
        },
        seamAllowance
      )
    );

    // Falda Infantil Amplia Evasé / Fruncida (1.55x gather ratio + A-line flare)
    const gatherTopHalfW = Number(((quarterBust + 0.5) * 1.52).toFixed(1));
    const skirtHemHalfW = Number((gatherTopHalfW + skirtLen * 0.28).toFixed(1));

    const skirtSeam: PathCommand[] = [
      { type: "M", x: 0, y: 1.0 },
      {
        type: "C",
        cp1x: gatherTopHalfW * 0.45,
        cp1y: 1.0,
        cp2x: gatherTopHalfW * 0.78,
        cp2y: 0.3,
        x: gatherTopHalfW,
        y: 0,
      },
      { type: "L", x: skirtHemHalfW, y: skirtLen },
      {
        type: "C",
        cp1x: skirtHemHalfW * 0.65,
        cp1y: skirtLen + 1.5,
        cp2x: skirtHemHalfW * 0.3,
        cp2y: skirtLen + 0.4,
        x: 0,
        y: skirtLen,
      },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "kids_skirt",
          name: "FALDA EVASÉ FRUNCIDA INFANTIL (x2 al doblez)",
          subtitle: `Largo: ${skirtLen} cm | Fruncir cintura hasta ${(quarterBust + 0.5).toFixed(1)} cm`,
          tabLabel: "Falda Infantil",
          seamPath: skirtSeam,
          grainline: { x1: gatherTopHalfW * 0.45, y1: 5, x2: gatherTopHalfW * 0.45, y2: skirtLen - 5 },
          notches: [
            { x: gatherTopHalfW * 0.35, y: 0.5, angle: -90, label: "Fruncir" },
            { x: gatherTopHalfW * 0.7, y: 0.2, angle: -90, label: "Fruncir" },
          ],
          labelPos: { x: gatherTopHalfW * 0.52, y: skirtLen * 0.5 },
          foldLine: { x1: 0, y1: 1.0, x2: 0, y2: skirtLen },
        },
        seamAllowance
      )
    );

    if (extras?.hemRuffle) {
      pieces.push(
        buildHemRufflePiece(skirtHemHalfW, skirtLen, seamAllowance).piece
      );
    }
  } else {
    // =========================================================================
    // 3. PANTALÓN INFANTIL CON ELÁSTICO (Cintura recta amplia para doblar y meter banda)
    // =========================================================================
    const elasticCasingCm = 4.0; // Fold-down tunnel at top for 2.5 cm elastic band
    const crotchDepth =
      (isAdultDefault ? 19.5 : Math.min(26, Math.max(15, measurements.crotchDepth))) +
      elasticCasingCm;
    const legLength =
      (isAdultDefault ? 44 : Math.min(68, Math.max(20, measurements.inseam))) *
      lengthMultiplier;
    const totalLen = crotchDepth + legLength;

    // Waist is cut straight at full hip width so it pulls on easily without zipper!
    const pullOnHalfWidth = quarterHip + 1.5;
    const frontCrotchExt = Math.max(3.6, effHip * 0.06);
    const backCrotchExt = Math.max(6.2, effHip * 0.105);
    const hemHalf = Math.max(11, pullOnHalfWidth * 0.78);

    const buildKidsPantLeg = (isFront: boolean): PatternPiece => {
      const crotchExt = isFront ? frontCrotchExt : backCrotchExt;
      const centerX = pullOnHalfWidth / 2 + crotchExt + 1.5;
      const outX = centerX - pullOnHalfWidth / 2;
      const inX = centerX + pullOnHalfWidth / 2;
      const tipX = inX + crotchExt;

      const seam: PathCommand[] = [
        // Straight top waist edge ready to fold down for elastic casing
        { type: "M", x: outX, y: 0 },
        { type: "L", x: inX, y: 0 },
        { type: "L", x: inX, y: crotchDepth * 0.64 },
        {
          type: "C",
          cp1x: inX,
          cp1y: crotchDepth * 0.9,
          cp2x: inX + crotchExt * 0.55,
          cp2y: crotchDepth,
          x: tipX,
          y: crotchDepth,
        },
        { type: "L", x: centerX + hemHalf, y: totalLen },
        { type: "L", x: centerX - hemHalf, y: totalLen },
        { type: "L", x: outX, y: crotchDepth },
        { type: "L", x: outX, y: 0 },
        { type: "Z" },
      ];

      return normalizePiece(
        {
          id: isFront ? "front_leg" : "back_leg",
          name: isFront
            ? "PIERNA DELANTERA INFANTIL CON ELÁSTICO (x2)"
            : "PIERNA TRASERA INFANTIL CON ELÁSTICO (x2)",
          subtitle: `Incluye +${elasticCasingCm} cm arriba para doblar túnel de elástico`,
          tabLabel: isFront ? "Pierna Del." : "Pierna Tras.",
          seamPath: seam,
          grainline: { x1: centerX, y1: 6, x2: centerX, y2: totalLen - 5 },
          notches: [
            { x: outX, y: elasticCasingCm, angle: 180, label: "Doblez elástico" },
            { x: inX, y: elasticCasingCm, angle: 0, label: "Doblez elástico" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: outX, y: elasticCasingCm },
                { type: "L", x: inX, y: elasticCasingCm },
              ],
              style: "fold",
              label: "Doblar aquí para elástico",
              labelPos: { x: centerX, y: elasticCasingCm + 1.6 },
            },
          ],
          labelPos: { x: centerX, y: crotchDepth * 1.15 },
        },
        seamAllowance
      );
    };

    pieces.push(buildKidsPantLeg(true), buildKidsPantLeg(false));

    if (extras?.sidePockets) {
      pieces.push(buildPocketBagPiece(seamAllowance));
    }
  }

  const subLabels: Record<KidsSubStyle, string> = {
    baby_bodysuit: "Pelele / Body de Bebé (con curva pañal)",
    kids_dress: "Vestido Infantil Evasé (1 a 10 años)",
    kids_pants: "Pantalón Infantil con Cintura Elástica",
  };

  return {
    category: "kids",
    subStyleLabel: subLabels[subStyle],
    pieces,
    fabricConsumption: {
      width140m: estimateFabricMeters(pieces, 140),
      width150m: estimateFabricMeters(pieces, 150),
    },
    totalBoundsCm: packPiecesOnSheet(pieces, 5),
    appliedEaseLabel:
      fabricType === "stretch"
        ? "Tejido infantil de punto / algodón suave"
        : "Tejido infantil cómodo (+holgura de juego)",
  };
}
