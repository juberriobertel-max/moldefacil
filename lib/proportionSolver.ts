import { GarmentCategory, SolvedTracingProportions, TracingPins } from "./types";

export const DEFAULT_TRACING_PINS: TracingPins = {
  shoulder: { x: 0.36, y: 0.14 },
  neckline: { x: 0.52, y: 0.2 },
  armhole: { x: 0.35, y: 0.3 },
  waist: { x: 0.42, y: 0.43 },
  crotch: { x: 0.5, y: 0.44 },
  topEnd: { x: 0.41, y: 0.37 },
  bottomStart: { x: 0.41, y: 0.46 },
  hip: { x: 0.37, y: 0.61 },
  hem: { x: 0.35, y: 0.86 },
};

export function getDefaultPinsForCategory(
  category: GarmentCategory
): TracingPins {
  switch (category) {
    case "pants":
    case "loungewear":
      return {
        ...DEFAULT_TRACING_PINS,
        waist: { x: 0.34, y: 0.14 },
        hip: { x: 0.3, y: 0.35 },
        crotch: { x: 0.5, y: 0.44 },
        hem: { x: 0.33, y: 0.88 },
      };
    case "skirt":
    case "accessories":
      return {
        ...DEFAULT_TRACING_PINS,
        waist: { x: 0.36, y: 0.18 },
        hip: { x: 0.31, y: 0.38 },
        hem: { x: 0.25, y: 0.86 },
      };
    case "top":
      return {
        ...DEFAULT_TRACING_PINS,
        shoulder: { x: 0.33, y: 0.15 },
        neckline: { x: 0.5, y: 0.22 },
        armhole: { x: 0.34, y: 0.33 },
        hem: { x: 0.36, y: 0.68 },
      };
    case "jumpsuit":
    case "kids":
    case "two_piece":
    case "dress":
    default:
      return { ...DEFAULT_TRACING_PINS };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Computes relative proportions from the active visual tracing pins for each garment:
 * - pants: waist -> hip -> crotch -> hem (computes real crotchDepthMultiplier)
 * - skirt: waist -> hip -> hem (uses garment centerline 0.5 for flare)
 * - top: shoulder -> neckline -> armhole -> hem (computes armholeDepthMultiplier)
 * - dress: shoulder -> neckline -> waist -> hip -> hem
 * - two_piece: separate top (shoulder -> topEnd) and bottom (bottomStart -> hem) multipliers
 */
export function solveTracingProportions(
  pins: TracingPins,
  category: GarmentCategory = "dress"
): SolvedTracingProportions {
  const bodiceVertical = Math.max(0.06, Math.abs(pins.waist.y - pins.shoulder.y));
  const lowerVertical = Math.max(0.06, Math.abs(pins.hem.y - pins.waist.y));
  const dressTotalY = Math.max(0.15, Math.abs(pins.hem.y - pins.shoulder.y));

  const bodiceToTotalRatio = clamp(
    bodiceVertical / (bodiceVertical + lowerVertical),
    0.25,
    0.68
  );

  // For standalone tops, measure neck drop against full top height
  const neckRefSpan =
    category === "top"
      ? Math.max(0.12, Math.abs(pins.hem.y - pins.shoulder.y) * 0.72)
      : bodiceVertical;
  const neckDrop = Math.max(0.01, pins.neckline.y - pins.shoulder.y);
  const necklineDropRatio = clamp(neckDrop / neckRefSpan, 0.08, 0.52);

  // Pants & Skirt have no neckline pin, so measure flare from garment midline x=0.5
  const centerX =
    category === "pants" || category === "skirt" ? 0.5 : pins.neckline.x;
  const hipHalf = Math.abs(pins.hip.x - centerX);
  const hemHalf = Math.abs(pins.hem.x - centerX);
  const hipToHemY = Math.max(0.05, Math.abs(pins.hem.y - pins.hip.y));
  const flareRatio = clamp(Math.max(0, hemHalf - hipHalf) / hipToHemY, 0, 0.65);

  let lengthMultiplier = clamp(dressTotalY / 0.72, 0.75, 1.35);
  let crotchDepthMultiplier = 1;
  let armholeDepthMultiplier = 1;

  if (category === "pants") {
    const pantsTotalY = Math.max(0.14, Math.abs(pins.hem.y - pins.waist.y));
    const crotchSpanY = Math.max(0.06, Math.abs(pins.crotch.y - pins.waist.y));
    crotchDepthMultiplier = clamp(crotchSpanY / 0.3, 0.72, 1.38);
    lengthMultiplier = clamp(pantsTotalY / 0.74, 0.45, 1.35);
  } else if (category === "skirt") {
    const skirtSpanY = Math.max(0.1, Math.abs(pins.hem.y - pins.waist.y));
    lengthMultiplier = clamp(skirtSpanY / 0.68, 0.55, 1.4);
  } else if (category === "top") {
    const topVertical = Math.max(0.12, Math.abs(pins.hem.y - pins.shoulder.y));
    const armholeSpan = Math.max(0.05, Math.abs(pins.armhole.y - pins.shoulder.y));
    armholeDepthMultiplier = clamp(armholeSpan / 0.18, 0.78, 1.28);
    lengthMultiplier = clamp(topVertical / 0.53, 0.68, 1.35);
  }

  // Separate 2-piece distances (unjoined gap between topEnd and bottomStart)
  const topSpan = Math.max(
    0.05,
    Math.hypot(pins.topEnd.x - pins.shoulder.x, pins.topEnd.y - pins.shoulder.y)
  );
  const bottomSpan = Math.max(
    0.08,
    Math.hypot(pins.hem.x - pins.bottomStart.x, pins.hem.y - pins.bottomStart.y)
  );

  // Baseline spans on default placement (~0.235 top, ~0.405 bottom)
  const topLengthMultiplier = clamp(topSpan / 0.24, 0.55, 1.35);
  const bottomLengthMultiplier = clamp(bottomSpan / 0.4, 0.55, 1.45);

  return {
    bodiceToTotalRatio: Number(bodiceToTotalRatio.toFixed(3)),
    necklineDropRatio: Number(necklineDropRatio.toFixed(3)),
    flareRatio: Number(flareRatio.toFixed(3)),
    lengthMultiplier: Number(lengthMultiplier.toFixed(3)),
    topLengthMultiplier: Number(topLengthMultiplier.toFixed(3)),
    bottomLengthMultiplier: Number(bottomLengthMultiplier.toFixed(3)),
    crotchDepthMultiplier: Number(crotchDepthMultiplier.toFixed(3)),
    armholeDepthMultiplier: Number(armholeDepthMultiplier.toFixed(3)),
  };
}
