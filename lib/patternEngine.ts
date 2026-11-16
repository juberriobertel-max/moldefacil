import {
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PantsSubStyle,
  PatternResult,
  QuickLengthPreset,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  SolvedTracingProportions,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "./types";
import { commandsToSvgPath } from "./garmentEngines/geometry";
import { resolveQuickLength } from "./garmentEngines/extrasEngine";
import { generateTopPattern } from "./garmentEngines/topEngine";
import { generatePantsPattern } from "./garmentEngines/pantsEngine";
import { generateSkirtPattern } from "./garmentEngines/skirtEngine";
import { generateDressPattern } from "./garmentEngines/dressEngine";
import { generateTwoPiecePattern } from "./garmentEngines/twoPieceEngine";

export { commandsToSvgPath };

export interface GenerateUniversalPatternInput {
  category: GarmentCategory;
  topSubStyle: TopSubStyle;
  pantsSubStyle: PantsSubStyle;
  skirtSubStyle: SkirtSubStyle;
  dressSubStyle: DressSubStyle;
  twoPieceTopStyle: TwoPieceTopStyle;
  twoPieceBottomStyle: TwoPieceBottomStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  torsoFit?: TorsoFit;
  measurements: Measurements;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  tracingProportions?: SolvedTracingProportions | null;
  extras?: GarmentExtras;
  quickLength?: QuickLengthPreset;
  styleVariant?: StyleVariant;
}

export function generateUniversalPattern(
  input: GenerateUniversalPatternInput
): PatternResult {
  const {
    category,
    topSubStyle,
    pantsSubStyle,
    skirtSubStyle,
    dressSubStyle,
    twoPieceTopStyle,
    twoPieceBottomStyle,
    necklineStyle,
    sleeveStyle,
    torsoFit = "fitted",
    measurements,
    seamAllowance,
    fabricType,
    tracingProportions,
    extras,
    quickLength = "photo",
    styleVariant = "default",
  } = input;

  const {
    measurements: effectiveMeasurements,
    overrideBottomLength,
    topScaleForLength,
  } = resolveQuickLength(measurements, quickLength, category);

  const lengthMult = overrideBottomLength
    ? 1
    : (tracingProportions?.lengthMultiplier ?? 1) * topScaleForLength;
  const bottomLengthMult = overrideBottomLength
    ? 1
    : tracingProportions?.bottomLengthMultiplier;

  switch (category) {
    case "top":
      return generateTopPattern({
        measurements: effectiveMeasurements,
        subStyle: topSubStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        seamAllowance,
        fabricType,
        necklineDropRatio: tracingProportions?.necklineDropRatio,
        lengthMultiplier: lengthMult,
        extras,
        styleVariant,
      });
    case "pants":
      return generatePantsPattern({
        measurements: effectiveMeasurements,
        subStyle: pantsSubStyle,
        seamAllowance,
        fabricType,
        lengthMultiplier: lengthMult,
        extras,
      });
    case "skirt":
      return generateSkirtPattern({
        measurements: effectiveMeasurements,
        subStyle: skirtSubStyle,
        seamAllowance,
        fabricType,
        flareRatio: tracingProportions?.flareRatio,
        lengthMultiplier: lengthMult,
        extras,
      });
    case "dress":
      return generateDressPattern({
        measurements: effectiveMeasurements,
        subStyle: dressSubStyle,
        necklineStyle,
        skirtFlareStyle: skirtSubStyle,
        sleeveStyle,
        torsoFit,
        seamAllowance,
        fabricType,
        necklineDropRatio: tracingProportions?.necklineDropRatio,
        bodiceToTotalRatio: tracingProportions?.bodiceToTotalRatio,
        flareRatio: tracingProportions?.flareRatio,
        lengthMultiplier: lengthMult,
        extras,
        styleVariant,
      });
    case "two_piece":
      return generateTwoPiecePattern({
        measurements: effectiveMeasurements,
        topStyle: twoPieceTopStyle,
        bottomStyle: twoPieceBottomStyle,
        pantsSubStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        seamAllowance,
        fabricType,
        necklineDropRatio: tracingProportions?.necklineDropRatio,
        topLengthMultiplier: tracingProportions?.topLengthMultiplier,
        bottomLengthMultiplier: bottomLengthMult,
        flareRatio: tracingProportions?.flareRatio,
        extras,
      });
  }
}
