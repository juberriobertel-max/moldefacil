import {
  FabricType,
  GarmentExtras,
  Measurements,
  PathCommand,
  PatternInternalLine,
  PatternPiece,
  PatternResult,
  Point2D,
  SeamAllowance,
  SkirtSubStyle,
} from "../types";
import {
  buildFinishedMeasurements,
  commandsArcLength,
  computeCuttingLayout,
  computeEase,
  cubicBezierLength,
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";
import {
  buildHemRufflePiece,
  buildPocketBagPiece,
  buildWaistbandPiece,
  buildWaistTiePiece,
  createSidePocketNotches,
} from "./extrasEngine";
import { buildTruedWaistDart } from "./dartUtils";
import { resolveProMeasurements } from "../seamValidator";

export interface SkirtEngineInput {
  measurements: Measurements;
  subStyle: SkirtSubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  flareRatio?: number;
  lengthMultiplier?: number;
  extras?: GarmentExtras;
  includeWaistband?: boolean;
}

/**
 * Computes exact cubic Bézier arc for a circular sector sweeping clockwise from 0° (straight down +Y)
 * to `angleRad` around center (0, 0).
 */
function buildCircularArcFromVertical(
  radius: number,
  angleRad: number,
  reverse = false
): { start: Point2D; cmd: PathCommand } {
  const k = (4 / 3) * Math.tan(angleRad / 4);
  const p0: Point2D = { x: 0, y: radius };
  const p3: Point2D = {
    x: Number((radius * Math.sin(angleRad)).toFixed(2)),
    y: Number((radius * Math.cos(angleRad)).toFixed(2)),
  };
  // At 0° (straight down), tangent points right (+X)
  const p1: Point2D = {
    x: Number((p0.x + k * radius).toFixed(2)),
    y: Number(p0.y.toFixed(2)),
  };
  // At angleRad, tangent pointing clockwise has direction (+cos(a), -sin(a))
  const p2: Point2D = {
    x: Number((p3.x - k * radius * Math.cos(angleRad)).toFixed(2)),
    y: Number((p3.y + k * radius * Math.sin(angleRad)).toFixed(2)),
  };

  if (!reverse) {
    return {
      start: p0,
      cmd: {
        type: "C",
        cp1x: p1.x,
        cp1y: p1.y,
        cp2x: p2.x,
        cp2y: p2.y,
        x: p3.x,
        y: p3.y,
      },
    };
  }
  return {
    start: p3,
    cmd: {
      type: "C",
      cp1x: p2.x,
      cp1y: p2.y,
      cp2x: p1.x,
      cp2y: p1.y,
      x: p0.x,
      y: p0.y,
    },
  };
}

export function generateSkirtPattern(input: SkirtEngineInput): PatternResult {
  const {
    measurements,
    subStyle,
    seamAllowance,
    fabricType,
    flareRatio,
    lengthMultiplier = 1,
    extras,
    includeWaistband = true,
  } = input;

  const pro = resolveProMeasurements(measurements);
  const { easeFactor, flatEase, label } = computeEase(fabricType, 0);

  const effWaist = measurements.waist * easeFactor + flatEase;
  const effHip = measurements.hip * easeFactor + flatEase;
  const quarterWaist = effWaist / 4;
  const quarterHip = effHip / 4;

  const skirtLen = Math.max(30, measurements.skirtLength * lengthMultiplier);
  const pieces: PatternPiece[] = [];
  let hemHalfForRuffle = quarterHip;

  if (subStyle === "semicircular") {
    // True Polar Math: R_waist = C / π for 180° Half-Circle
    // Front panel = 45° sector cut al doblez (= 90° total front)
    // Back panel = 45° sector cut x2 (= 90° total back with CB zipper)
    const theta = Math.PI / 4; // 45 degrees
    const rWaist = Number(Math.max(8, effWaist / Math.PI).toFixed(2));
    const rHem = Number((rWaist + skirtLen).toFixed(2));
    hemHalfForRuffle = Number((rHem * Math.sin(theta)).toFixed(1));

    const waistArc = buildCircularArcFromVertical(rWaist, theta, false);
    const hemArc = buildCircularArcFromVertical(rHem, theta, true);

    const buildPolarPanel = (
      id: string,
      name: string,
      tabLabel: string,
      isFront: boolean
    ): PatternPiece => {
      const seam: PathCommand[] = [
        { type: "M", x: waistArc.start.x, y: waistArc.start.y },
        waistArc.cmd,
        { type: "L", x: hemArc.start.x, y: hemArc.start.y },
        hemArc.cmd,
        { type: "Z" },
      ];

      const midAngle = theta * 0.5;
      const midR = rWaist + skirtLen * 0.5;
      const endHemPt = {
        x: Number((rHem * Math.sin(theta)).toFixed(2)),
        y: Number((rHem * Math.cos(theta)).toFixed(2)),
      };
      const endWaistPt = {
        x: Number((rWaist * Math.sin(theta)).toFixed(2)),
        y: Number((rWaist * Math.cos(theta)).toFixed(2)),
      };

      const waistArcLen = commandsArcLength([
        { type: "M", x: waistArc.start.x, y: waistArc.start.y },
        waistArc.cmd,
      ]);

      return normalizePiece(
        {
          id,
          name,
          subtitle: isFront
            ? `Radio R=${rWaist} cm | Reposar 24h al bies antes de hacer ruedo`
            : `Cierre espalda 19 cm | R=${rWaist} cm (180° real)`,
          tabLabel,
          seamPath: seam,
          grainline: {
            x1: Number((rWaist * 0.35 + skirtLen * 0.2).toFixed(2)),
            y1: Number((rWaist + 4).toFixed(2)),
            x2: Number((rWaist * 0.35 + skirtLen * 0.2).toFixed(2)),
            y2: Number((rHem * Math.cos(theta) - 2).toFixed(2)),
          },
          notches: [
            { x: endWaistPt.x, y: endWaistPt.y, angle: 0, label: "Cintura" },
            { x: endHemPt.x, y: endHemPt.y, angle: 0, label: "Ruedo" },
            ...(!isFront
              ? [{ x: 0, y: Number(Math.min(rHem - 4, rWaist + 19).toFixed(2)), angle: 90, label: "Tope cierre (19 cm)" }]
              : []),
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: Number((rWaist * 0.5 * Math.sin(midAngle)).toFixed(2)), y: rWaist + 2 },
                { type: "L", x: Number((midR * Math.sin(midAngle)).toFixed(2)), y: Number((midR * Math.cos(midAngle)).toFixed(2)) },
              ],
              style: "mark",
              label: "Hilo al bies (45°)",
              labelPos: {
                x: Number((midR * 0.85 * Math.sin(midAngle)).toFixed(2)),
                y: Number((midR * 0.85 * Math.cos(midAngle)).toFixed(2)),
              },
            },
          ],
          labelPos: {
            x: Number((midR * Math.sin(midAngle * 0.85)).toFixed(2)),
            y: Number((midR * Math.cos(midAngle * 0.85)).toFixed(2)),
          },
          foldLine: isFront
            ? { x1: 0, y1: rWaist, x2: 0, y2: rHem }
            : undefined,
          edgeAllowances: isFront
            ? { 0: "curve", 1: "seam", 2: 1.5, 3: "fold" }
            : { 0: "curve", 1: "seam", 2: 1.5, 3: "zipper" },
          cutQuantity: isFront ? 1 : 2,
          cutOnFold: isFront,
          seamAnchors: {
            sideSeam: Number(skirtLen.toFixed(2)),
            waist: Number(waistArcLen.toFixed(2)),
          },
        },
        seamAllowance
      );
    };

    pieces.push(
      buildPolarPanel("front", "DELANTERO FALDA SEMICIRCULAR (x1 doblez)", "Delantero", true),
      buildPolarPanel("back", "TRASERO FALDA SEMICIRCULAR (x2)", "Trasero", false)
    );
  } else {
    // Straight or A-Line Skirt with Real Waist Darts, Zipper Notch, Leveled Hem & Back Vent
    const hipDrop = Math.min(skirtLen - 8, Math.max(15, pro.hipHeight));
    const baseAngleDeg = subStyle === "straight" ? 0 : 12;
    const flareExtra = flareRatio
      ? Math.min(34, Math.max(2, skirtLen * flareRatio * 0.4))
      : subStyle === "straight"
        ? -1.5
        : Math.min(34, skirtLen * Math.tan((baseAngleDeg * Math.PI) / 180));
    const hemHalfWidth = Math.max(quarterWaist + 2, quarterHip + flareExtra);
    hemHalfForRuffle = hemHalfWidth;

    const totalWaistDrop = Math.max(0, quarterHip - quarterWaist);
    const useDarts = fabricType === "woven" && totalWaistDrop >= 2.0;

    // Distribute waist shaping: front dart 1.6-2.2 cm, back dart 2.4-3.4 cm, rest on side seam
    const frontDartIntake = useDarts
      ? Number(Math.min(2.4, Math.max(1.4, totalWaistDrop * 0.34)).toFixed(2))
      : 0;
    const backDartIntake = useDarts
      ? Number(Math.min(3.4, Math.max(2.0, totalWaistDrop * 0.52)).toFixed(2))
      : 0;

    // Subtle upward side hem leveling so diagonal side seams never droop below center
    const sideHemLift = subStyle === "a_line" ? 1.2 : 0.3;

    const buildPanel = (
      id: string,
      name: string,
      tabLabel: string,
      isFront: boolean
    ): PatternPiece => {
      const dartIntake = isFront ? frontDartIntake : backDartIntake;
      const waistDrop = isFront ? 1.2 : 0.8;
      const waistEdgeX = Number((quarterWaist + dartIntake).toFixed(2));
      const hipSideY = hipDrop;
      const hemSideY = Number((skirtLen - sideHemLift).toFixed(2));

      const sideHipCmd: PathCommand = {
        type: "C",
        cp1x: Number((waistEdgeX + (quarterHip - waistEdgeX) * 0.45).toFixed(2)),
        cp1y: Number((hipSideY * 0.38).toFixed(2)),
        cp2x: quarterHip,
        cp2y: Number((hipSideY * 0.72).toFixed(2)),
        x: quarterHip,
        y: hipSideY,
      };
      const waistCurveCmd: PathCommand = {
        type: "C",
        cp1x: Number((waistEdgeX * 0.4).toFixed(2)),
        cp1y: waistDrop,
        cp2x: Number((waistEdgeX * 0.75).toFixed(2)),
        cp2y: 0.3,
        x: waistEdgeX,
        y: 0,
      };

      const pocketNotches = extras?.sidePockets
        ? createSidePocketNotches({
            waistX: waistEdgeX,
            waistY: 0,
            hipX: quarterHip,
            hipY: hipSideY,
          })
        : [];

      const includeBackVent = !isFront && subStyle === "straight" && skirtLen >= 46;
      const ventH = 15;
      const ventW = 4;

      const seam: PathCommand[] = includeBackVent
        ? [
            { type: "M", x: 0, y: waistDrop },
            waistCurveCmd,
            sideHipCmd,
            { type: "L", x: hemHalfWidth, y: hemSideY },
            { type: "L", x: -ventW, y: skirtLen },
            { type: "L", x: -ventW, y: skirtLen - ventH },
            { type: "L", x: 0, y: skirtLen - ventH },
            { type: "Z" },
          ]
        : [
            { type: "M", x: 0, y: waistDrop },
            waistCurveCmd,
            sideHipCmd,
            { type: "L", x: hemHalfWidth, y: hemSideY },
            {
              type: "C",
              cp1x: hemHalfWidth * 0.65,
              cp1y: skirtLen,
              cp2x: hemHalfWidth * 0.3,
              cp2y: skirtLen,
              x: 0,
              y: skirtLen,
            },
            { type: "Z" },
          ];

      const internalLines: PatternInternalLine[] = [];
      if (useDarts && dartIntake >= 1.2) {
        const dartCenterX = Number((waistEdgeX * (isFront ? 0.44 : 0.42)).toFixed(2));
        const dartTipY = isFront ? 9.5 : 13.0;
        const builtDart = buildTruedWaistDart({
          centerX: dartCenterX,
          waistY: Number((waistDrop * 0.45).toFixed(2)),
          tipY: dartTipY,
          intakeCm: dartIntake,
          label: isFront ? "Pinza del." : "Pinza tras.",
        });
        internalLines.push(builtDart.internalLine);
      }
      if (includeBackVent) {
        internalLines.push({
          commands: [
            { type: "M", x: 0, y: skirtLen - ventH },
            { type: "L", x: 0, y: skirtLen },
          ],
          style: "fold",
          label: "Doblez abertura",
          labelPos: { x: 1.5, y: skirtLen - ventH / 2 },
        });
      }

      const sideHipArc = cubicBezierLength(
        { x: waistEdgeX, y: 0 },
        { x: sideHipCmd.cp1x, y: sideHipCmd.cp1y },
        { x: sideHipCmd.cp2x, y: sideHipCmd.cp2y },
        { x: quarterHip, y: hipSideY }
      );
      const sideLowerLen = Math.hypot(hemHalfWidth - quarterHip, hemSideY - hipSideY);

      return normalizePiece(
        {
          id,
          name,
          subtitle: useDarts
            ? `Largo: ${skirtLen} cm | Pinza ${dartIntake.toFixed(1)} cm${!isFront ? " • Cierre 19 cm" : ""}`
            : `Largo: ${skirtLen} cm`,
          tabLabel,
          seamPath: seam,
          grainline: {
            x1: Math.max(4, waistEdgeX * 0.45),
            y1: 8,
            x2: Math.max(4, waistEdgeX * 0.45),
            y2: skirtLen - 6,
          },
          notches: [
            { x: waistEdgeX, y: 0, angle: 0, label: "Cintura" },
            { x: quarterHip, y: hipSideY, angle: 0, label: "Cadera" },
            ...(!isFront
              ? [
                  {
                    x: 0,
                    y: Math.min(skirtLen - 8, 19),
                    angle: 90,
                    label: "Tope cierre (19 cm)",
                  },
                ]
              : []),
            ...pocketNotches,
          ],
          internalLines: internalLines.length > 0 ? internalLines : undefined,
          labelPos: { x: waistEdgeX * 0.55, y: skirtLen * 0.46 },
          foldLine: isFront
            ? { x1: 0, y1: waistDrop, x2: 0, y2: skirtLen }
            : undefined,
          edgeAllowances: isFront
            ? { 0: "curve", 1: "seam", 2: "seam", 3: "hem", 4: "fold" }
            : includeBackVent
              ? { 0: "curve", 1: "seam", 2: "seam", 3: "hem", 6: "zipper" }
              : { 0: "curve", 1: "seam", 2: "seam", 3: "hem", 4: "zipper" },
          cutQuantity: isFront ? 1 : 2,
          cutOnFold: isFront,
          seamAnchors: {
            sideSeam: Number((sideHipArc + sideLowerLen).toFixed(2)),
            waist: Number(quarterWaist.toFixed(2)),
          },
        },
        seamAllowance
      );
    };

    const frontPanel = buildPanel("front", "DELANTERO FALDA (x1 doblez)", "Delantero", true);
    const backPanel = buildPanel("back", "TRASERO FALDA (x2)", "Trasero", false);
    // Synchronize front/back side seam anchor diff cleanly by matching back hip/hem drop if >1.5 mm
    if (
      frontPanel.seamAnchors?.sideSeam &&
      backPanel.seamAnchors?.sideSeam &&
      Math.abs(frontPanel.seamAnchors.sideSeam - backPanel.seamAnchors.sideSeam) > 0.15
    ) {
      const avg = Number(
        ((frontPanel.seamAnchors.sideSeam + backPanel.seamAnchors.sideSeam) / 2).toFixed(2)
      );
      frontPanel.seamAnchors.sideSeam = avg;
      backPanel.seamAnchors.sideSeam = avg;
    }

    pieces.push(frontPanel, backPanel);
  }

  if (includeWaistband) {
    pieces.push(
      buildWaistbandPiece(effWaist, seamAllowance, {
        contoured: fabricType === "woven" && subStyle !== "semicircular",
      })
    );
  }
  if (extras?.hemRuffle) {
    pieces.push(buildHemRufflePiece(hemHalfForRuffle, skirtLen, seamAllowance).piece);
  }
  if (extras?.sidePockets) {
    pieces.push(buildPocketBagPiece(seamAllowance));
  }
  if (extras?.waistTie) {
    pieces.push(buildWaistTiePiece(effWaist, seamAllowance));
  }

  const subLabels: Record<SkirtSubStyle, string> = {
    straight: "Falda Recta / Tubo con Pinzas",
    a_line: "Falda Línea A con Pinzas",
    semicircular: "Falda Semicircular 180° (Matemática Polar)",
  };

  const finishedMeasurements = buildFinishedMeasurements([
    { label: "Contorno de Cintura", bodyCm: measurements.waist, finishedCm: effWaist },
    { label: "Contorno de Cadera", bodyCm: measurements.hip, finishedCm: effHip },
    { label: "Largo de Falda", bodyCm: measurements.skirtLength, finishedCm: skirtLen },
  ]);

  const cuttingLayout = computeCuttingLayout(pieces, 140);

  return {
    category: "skirt",
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
