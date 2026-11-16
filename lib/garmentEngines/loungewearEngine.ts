import {
  FabricType,
  GarmentExtras,
  LoungewearSubStyle,
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
import { buildPocketBagPiece, buildSleevePiece } from "./extrasEngine";

export interface LoungewearEngineInput {
  measurements: Measurements;
  subStyle: LoungewearSubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
}

export function generateLoungewearPattern(
  input: LoungewearEngineInput
): PatternResult {
  const {
    measurements,
    subStyle,
    seamAllowance,
    lengthMultiplier = 1,
    extras,
  } = input;

  const pieces: PatternPiece[] = [];

  if (subStyle === "leggings") {
    // =========================================================================
    // 1. LEGGINGS / LICRA DEPORTIVA (1 sola pieza envolvente sin costura lateral + reducción negativa)
    // =========================================================================
    const negativeEaseFactor = 0.87; // -13% negative ease for high-stretch athletic lycra/suplex
    const effWaist = Number((measurements.waist * negativeEaseFactor).toFixed(1));
    const effHip = Number((measurements.hip * negativeEaseFactor).toFixed(1));
    const effThigh = Number((measurements.thigh * negativeEaseFactor).toFixed(1));

    const quarterWaist = effWaist / 4;
    const quarterHip = effHip / 4;

    const crotchDepth = Number(
      Math.max(19, measurements.crotchDepth * 0.92).toFixed(1)
    );
    const legLength = Math.max(52, measurements.inseam * 0.96 * lengthMultiplier);
    const totalLen = crotchDepth + legLength;
    const kneeY = crotchDepth + legLength * 0.52;

    const frontCrotchExt = Math.max(3.6, effHip * 0.048);
    const backCrotchExt = Math.max(7.2, effHip * 0.095);
    const backRiseLift = 3.2; // High ergonomic back rise

    // Seamless outer side line at x = 0; Front half goes to -x, Back half goes to +x
    const frontWaistX = -quarterWaist;
    const backWaistX = quarterWaist + 0.8;
    const frontHipX = -quarterHip;
    const backHipX = quarterHip + 1.0;
    const frontCrotchTipX = -(quarterHip + frontCrotchExt);
    const backCrotchTipX = quarterHip + 1.0 + backCrotchExt;

    const ankleTotalW = Math.max(18.5, effThigh * 0.44);
    const frontAnkleX = -(ankleTotalW * 0.47);
    const backAnkleX = ankleTotalW * 0.53;
    const frontKneeX = -(effThigh * 0.46);
    const backKneeX = effThigh * 0.52;

    const wrapLegSeam: PathCommand[] = [
      // Start at Front Center Waist (x = frontWaistX, y = backRiseLift + 1.2)
      { type: "M", x: frontWaistX, y: backRiseLift + 1.2 },
      // Curve gently across seamless outer side (x = 0) up to Back Center Waist
      {
        type: "C",
        cp1x: frontWaistX * 0.45,
        cp1y: backRiseLift + 0.8,
        cp2x: backWaistX * 0.45,
        cp2y: 0.4,
        x: backWaistX,
        y: 0,
      },
      // Back center seam + deep back crotch curve
      { type: "L", x: backHipX, y: backRiseLift + crotchDepth * 0.58 },
      {
        type: "C",
        cp1x: backHipX + 0.8,
        cp1y: backRiseLift + crotchDepth * 0.9,
        cp2x: backHipX + backCrotchExt * 0.58,
        cp2y: backRiseLift + crotchDepth,
        x: backCrotchTipX,
        y: backRiseLift + crotchDepth,
      },
      // Back inseam to knee and ankle
      {
        type: "C",
        cp1x: backCrotchTipX - 1.5,
        cp1y: backRiseLift + crotchDepth + (kneeY - crotchDepth) * 0.45,
        cp2x: backKneeX + 0.6,
        cp2y: backRiseLift + kneeY - 5,
        x: backKneeX,
        y: backRiseLift + kneeY,
      },
      { type: "L", x: backAnkleX, y: backRiseLift + totalLen },
      // Ankle hem across seamless outer side
      { type: "L", x: frontAnkleX, y: backRiseLift + totalLen },
      // Front inseam up to knee and front crotch tip
      { type: "L", x: frontKneeX, y: backRiseLift + kneeY },
      {
        type: "C",
        cp1x: frontKneeX - 0.5,
        cp1y: backRiseLift + kneeY - 5,
        cp2x: frontCrotchTipX + 1.2,
        cp2y: backRiseLift + crotchDepth + (kneeY - crotchDepth) * 0.45,
        x: frontCrotchTipX,
        y: backRiseLift + crotchDepth,
      },
      // Front crotch curve up to front center waist
      {
        type: "C",
        cp1x: frontHipX - frontCrotchExt * 0.55,
        cp1y: backRiseLift + crotchDepth,
        cp2x: frontHipX,
        cp2y: backRiseLift + crotchDepth * 0.88,
        x: frontHipX,
        y: backRiseLift + crotchDepth * 0.58,
      },
      { type: "L", x: frontWaistX, y: backRiseLift + 1.2 },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "leggings_wrap_leg",
          name: "PIERNA ENVOLVENTE LEGGINGS (x2 — Sin costura lateral)",
          subtitle: `1 sola pieza por pierna | Reducción negativa -13% (Cadera activa: ${effHip} cm)`,
          tabLabel: "Pierna Envolvente",
          seamPath: wrapLegSeam,
          grainline: {
            x1: 0,
            y1: backRiseLift + 6,
            x2: 0,
            y2: backRiseLift + totalLen - 6,
          },
          notches: [
            { x: 0, y: backRiseLift + 0.6, angle: -90, label: "Costado (Sin costura)" },
            { x: frontCrotchTipX, y: backRiseLift + crotchDepth, angle: 180, label: "Tiro Del." },
            { x: backCrotchTipX, y: backRiseLift + crotchDepth, angle: 0, label: "Tiro Tras." },
            { x: frontKneeX, y: backRiseLift + kneeY, angle: 180, label: "Rodilla" },
            { x: backKneeX, y: backRiseLift + kneeY, angle: 0, label: "Rodilla" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: backRiseLift + 0.6 },
                { type: "L", x: 0, y: backRiseLift + totalLen },
              ],
              style: "fold",
              label: "Línea lateral (Sin costura)",
              labelPos: { x: 0.9, y: backRiseLift + totalLen * 0.42 },
            },
          ],
          labelPos: { x: 1.5, y: backRiseLift + crotchDepth * 1.15 },
        },
        seamAllowance
      )
    );

    // High-support athletic folded waistband
    const wbHalfLen = Number(((effWaist * 0.96) / 2).toFixed(1));
    const wbHeight = 18.0; // 9 cm finished high-rise waistband folded in half
    pieces.push(
      normalizePiece(
        {
          id: "leggings_waistband",
          name: "FAJÓN / PRETINA ANATÓMICA DEPORTIVA (x1 al doblez)",
          subtitle: `Pretina alta doble (${wbHalfLen * 2} × ${wbHeight} cm, alto final 9 cm)`,
          tabLabel: "Fajón Deportivo",
          seamPath: [
            { type: "M", x: 0, y: 0 },
            { type: "L", x: wbHalfLen, y: 0 },
            { type: "L", x: wbHalfLen, y: wbHeight },
            { type: "L", x: 0, y: wbHeight },
            { type: "Z" },
          ],
          grainline: { x1: 4, y1: wbHeight / 2, x2: wbHalfLen - 4, y2: wbHeight / 2 },
          notches: [
            { x: wbHalfLen / 2, y: wbHeight, angle: 90, label: "Costado" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: wbHeight / 2 },
                { type: "L", x: wbHalfLen, y: wbHeight / 2 },
              ],
              style: "fold",
              label: "Doblar por la mitad",
              labelPos: { x: wbHalfLen * 0.5, y: wbHeight * 0.35 },
            },
          ],
          labelPos: { x: wbHalfLen * 0.5, y: wbHeight * 0.68 },
          labelAngle: 0,
          labelMaxSpanCm: wbHalfLen - 4,
          labelBandWidthCm: wbHeight,
          foldLine: { x1: 0, y1: 0, x2: 0, y2: wbHeight },
        },
        seamAllowance
      )
    );
  } else {
    // =========================================================================
    // 2. PIJAMA CLÁSICA (Camisa holgada + Pantalón cómodo con cintura elástica)
    // =========================================================================
    const pajamaEase = 8; // Generous +8 cm sleepwear comfort ease
    const effBust = measurements.bust + pajamaEase;
    const effHip = measurements.hip + pajamaEase;
    const effBack = measurements.backWidth + 2.5;

    const quarterBust = effBust / 4;
    const quarterHip = effHip / 4;
    const halfBack = effBack / 2;

    const shirtLen = Math.max(58, (measurements.bodiceLength + 18) * lengthMultiplier);
    const neckW = Math.max(6.5, effBust * 0.076);
    const shoulderX = Math.max(neckW + 6.5, halfBack + 1.8);
    const shoulderSlope = 2.6;
    const armholeDepth = Math.max(19, effBust * 0.22);
    const buttonOverlap = 2.5;
    const straightBodyHalfW = Math.max(quarterBust, quarterHip);

    // Camisa Pijama Delantero (caída recta holgada + bolsillo)
    const frontShirtSeam: PathCommand[] = [
      { type: "M", x: -buttonOverlap, y: 11.5 },
      { type: "L", x: 0, y: 11.5 },
      {
        type: "C",
        cp1x: neckW * 0.4,
        cp1y: 9.0,
        cp2x: neckW * 0.75,
        cp2y: 4.5,
        x: neckW,
        y: 0,
      },
      { type: "L", x: shoulderX, y: shoulderSlope },
      {
        type: "C",
        cp1x: shoulderX - 1.2,
        cp1y: armholeDepth * 0.55,
        cp2x: straightBodyHalfW * 0.85,
        cp2y: armholeDepth,
        x: straightBodyHalfW,
        y: armholeDepth,
      },
      // Relaxed straight side seam
      { type: "L", x: straightBodyHalfW, y: shirtLen },
      { type: "L", x: -buttonOverlap, y: shirtLen },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "pajama_top_front",
          name: "CAMISA PIJAMA DELANTERO (x2)",
          subtitle: `Caída recta holgada (+${pajamaEase} cm soltura) con cruce de botones`,
          tabLabel: "Camisa Del.",
          seamPath: frontShirtSeam,
          grainline: { x1: straightBodyHalfW * 0.45, y1: 14, x2: straightBodyHalfW * 0.45, y2: shirtLen - 6 },
          notches: [
            { x: 0, y: 11.5, angle: 180, label: "Primer botón" },
            { x: straightBodyHalfW, y: armholeDepth, angle: 0, label: "Sisa" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: 11.5 },
                { type: "L", x: 0, y: shirtLen },
              ],
              style: "fold",
              label: "Centro botones",
              labelPos: { x: 0.8, y: shirtLen * 0.55 },
            },
            {
              commands: [
                { type: "M", x: straightBodyHalfW * 0.32, y: armholeDepth + 2 },
                { type: "L", x: straightBodyHalfW * 0.32 + 11, y: armholeDepth + 2 },
                { type: "L", x: straightBodyHalfW * 0.32 + 11, y: armholeDepth + 14 },
                { type: "L", x: straightBodyHalfW * 0.32, y: armholeDepth + 14 },
                { type: "Z" },
              ],
              style: "mark",
              label: "Bolsillo",
              labelPos: { x: straightBodyHalfW * 0.32 + 5.5, y: armholeDepth + 8 },
            },
          ],
          labelPos: { x: straightBodyHalfW * 0.52, y: shirtLen * 0.65 },
        },
        seamAllowance
      )
    );

    // Camisa Pijama Trasero
    const backShirtSeam: PathCommand[] = [
      { type: "M", x: 0, y: 2.5 },
      {
        type: "C",
        cp1x: neckW * 0.55,
        cp1y: 2.5,
        cp2x: neckW,
        cp2y: 1.2,
        x: neckW,
        y: 0,
      },
      { type: "L", x: shoulderX, y: shoulderSlope },
      {
        type: "C",
        cp1x: shoulderX - 0.5,
        cp1y: armholeDepth * 0.58,
        cp2x: straightBodyHalfW * 0.87,
        cp2y: armholeDepth,
        x: straightBodyHalfW,
        y: armholeDepth,
      },
      { type: "L", x: straightBodyHalfW, y: shirtLen },
      { type: "L", x: 0, y: shirtLen },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "pajama_top_back",
          name: "CAMISA PIJAMA TRASERO (x1 al doblez)",
          subtitle: `Espalda holgada sin entalle`,
          tabLabel: "Camisa Tras.",
          seamPath: backShirtSeam,
          grainline: { x1: straightBodyHalfW * 0.45, y1: 8, x2: straightBodyHalfW * 0.45, y2: shirtLen - 6 },
          notches: [{ x: straightBodyHalfW, y: armholeDepth, angle: 0, label: "Sisa" }],
          labelPos: { x: straightBodyHalfW * 0.5, y: shirtLen * 0.62 },
          foldLine: { x1: 0, y1: 2.5, x2: 0, y2: shirtLen },
        },
        seamAllowance
      )
    );

    // Manga Pijama
    const armholeSingle = cubicBezierLength(
      { x: shoulderX, y: shoulderSlope },
      { x: shoulderX - 0.8, y: armholeDepth * 0.56 },
      { x: straightBodyHalfW * 0.86, y: armholeDepth },
      { x: straightBodyHalfW, y: armholeDepth }
    );
    const sleevePiece = buildSleevePiece({
      armholeDepth,
      totalArmholePerimeter: armholeSingle * 2,
      sleeveLengthCm: measurements.sleeveLength,
      sleeveStyle: "long",
      seamAllowance,
    });
    if (sleevePiece) {
      pieces.push({
        ...sleevePiece,
        id: "pajama_sleeve",
        name: "MANGA CÓMODA PIJAMA (x2)",
        tabLabel: "Manga Pijama",
      });
    }

    // Pantalón Pijama Cómodo (con túnel de elástico en cintura y caída recta)
    const elasticFoldCm = 4.5;
    const crotchDepth = measurements.crotchDepth + 2.5 + elasticFoldCm;
    const legLength = Math.max(54, measurements.inseam * lengthMultiplier);
    const pantTotalLen = crotchDepth + legLength;
    const pullOnHalfW = quarterHip + 1.5;
    const crotchExt = Math.max(6.5, effHip * 0.085);
    const centerX = pullOnHalfW / 2 + crotchExt + 2;
    const outX = centerX - pullOnHalfW / 2;
    const inX = centerX + pullOnHalfW / 2;
    const hemHalf = Math.max(21, pullOnHalfW * 0.88);

    const pajamaPantSeam: PathCommand[] = [
      { type: "M", x: outX, y: 0 },
      { type: "L", x: inX, y: 0 },
      { type: "L", x: inX, y: crotchDepth * 0.62 },
      {
        type: "C",
        cp1x: inX,
        cp1y: crotchDepth * 0.9,
        cp2x: inX + crotchExt * 0.55,
        cp2y: crotchDepth,
        x: inX + crotchExt,
        y: crotchDepth,
      },
      { type: "L", x: centerX + hemHalf, y: pantTotalLen },
      { type: "L", x: centerX - hemHalf, y: pantTotalLen },
      { type: "L", x: outX, y: crotchDepth },
      { type: "L", x: outX, y: 0 },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "pajama_pants",
          name: "PANTALÓN PIJAMA CÓMODO (x4 — 2 Del. y 2 Tras.)",
          subtitle: `Caída recta + ${elasticFoldCm} cm túnel superior para elástico`,
          tabLabel: "Pantalón Pijama",
          seamPath: pajamaPantSeam,
          grainline: { x1: centerX, y1: 8, x2: centerX, y2: pantTotalLen - 6 },
          notches: [
            { x: outX, y: elasticFoldCm, angle: 180, label: "Doblez elástico" },
            { x: inX, y: elasticFoldCm, angle: 0, label: "Doblez elástico" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: outX, y: elasticFoldCm },
                { type: "L", x: inX, y: elasticFoldCm },
              ],
              style: "fold",
              label: "Doblez túnel elástico",
              labelPos: { x: centerX, y: elasticFoldCm + 1.8 },
            },
          ],
          labelPos: { x: centerX, y: crotchDepth * 1.15 },
        },
        seamAllowance
      )
    );

    if (extras?.sidePockets) {
      pieces.push(buildPocketBagPiece(seamAllowance));
    }
  }

  const subLabels: Record<LoungewearSubStyle, string> = {
    leggings: "Leggings / Licra Deportiva (1 Pieza Envolvente)",
    classic_pajama: "Pijama Clásica (Camisa Holgada + Pantalón Elástico)",
  };

  return {
    category: "loungewear",
    subStyleLabel: subLabels[subStyle],
    pieces,
    fabricConsumption: {
      width140m: estimateFabricMeters(pieces, 140),
      width150m: estimateFabricMeters(pieces, 150),
    },
    totalBoundsCm: packPiecesOnSheet(pieces, 5),
    appliedEaseLabel:
      subStyle === "leggings"
        ? "Reducción negativa -13% (para licra/suplex de alta elongación)"
        : "Holgura amplia de descanso (+8 cm confort)",
  };
}
