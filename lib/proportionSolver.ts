import { SolvedTracingProportions, TracingPins } from "./types";

export const DEFAULT_TRACING_PINS: TracingPins = {
  shoulder: { x: 0.36, y: 0.14 },
  neckline: { x: 0.52, y: 0.2 },
  waist: { x: 0.42, y: 0.43 },
  topEnd: { x: 0.41, y: 0.37 },
  bottomStart: { x: 0.41, y: 0.46 },
  hip: { x: 0.37, y: 0.61 },
  hem: { x: 0.35, y: 0.86 },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Computes relative proportions from the visual tracing pins.
 * - For 1-piece garments: uses shoulder -> waist -> hip -> hem.
 * - For 2-piece sets: computes separate multipliers for top (shoulder -> topEnd)
 *   and bottom (bottomStart -> hem), leaving the gap between them unjoined.
 */
export function solveTracingProportions(
  pins: TracingPins
): SolvedTracingProportions {
  const bodiceVertical = Math.max(0.06, Math.abs(pins.waist.y - pins.shoulder.y));
  const lowerVertical = Math.max(0.06, Math.abs(pins.hem.y - pins.waist.y));
  const totalVertical = Math.max(0.15, Math.abs(pins.hem.y - pins.shoulder.y));

  const bodiceToTotalRatio = clamp(
    bodiceVertical / (bodiceVertical + lowerVertical),
    0.25,
    0.68
  );

  const neckDrop = Math.max(0.01, pins.neckline.y - pins.shoulder.y);
  const necklineDropRatio = clamp(neckDrop / bodiceVertical, 0.08, 0.52);

  const centerX = pins.neckline.x;
  const hipHalf = Math.abs(pins.hip.x - centerX);
  const hemHalf = Math.abs(pins.hem.x - centerX);
  const hipToHemY = Math.max(0.05, Math.abs(pins.hem.y - pins.hip.y));
  const flareRatio = clamp(Math.max(0, hemHalf - hipHalf) / hipToHemY, 0, 0.65);

  const lengthMultiplier = clamp(totalVertical / 0.72, 0.75, 1.35);

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
  };
}
