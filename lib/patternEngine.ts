import {
  AccessorySubStyle,
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  JumpsuitSubStyle,
  KidsSubStyle,
  LoungewearSubStyle,
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
import { generateJumpsuitPattern } from "./garmentEngines/jumpsuitEngine";
import { generateKidsPattern } from "./garmentEngines/kidsEngine";
import { generateLoungewearPattern } from "./garmentEngines/loungewearEngine";
import { generateAccessoriesPattern } from "./garmentEngines/accessoriesEngine";
import { sanitizeMeasurements, validatePatternSeams } from "./seamValidator";

export { commandsToSvgPath };

export interface GenerateUniversalPatternInput {
  category: GarmentCategory;
  topSubStyle: TopSubStyle;
  pantsSubStyle: PantsSubStyle;
  skirtSubStyle: SkirtSubStyle;
  dressSubStyle: DressSubStyle;
  twoPieceTopStyle: TwoPieceTopStyle;
  twoPieceBottomStyle: TwoPieceBottomStyle;
  jumpsuitSubStyle?: JumpsuitSubStyle;
  kidsSubStyle?: KidsSubStyle;
  loungewearSubStyle?: LoungewearSubStyle;
  accessorySubStyle?: AccessorySubStyle;
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
    jumpsuitSubStyle = "romper_long",
    kidsSubStyle = "baby_bodysuit",
    loungewearSubStyle = "leggings",
    accessorySubStyle = "bucket_hat",
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

  // 1. Smart anatomical bounds & ratio stabilization to prevent Bézier inversions
  const { sanitized: safeMeasurements, warnings } =
    sanitizeMeasurements(measurements);

  const {
    measurements: effectiveMeasurements,
    overrideBottomLength,
    topScaleForLength,
  } = resolveQuickLength(safeMeasurements, quickLength, category);

  const lengthMult = overrideBottomLength
    ? 1
    : (tracingProportions?.lengthMultiplier ?? 1) * topScaleForLength;
  const bottomLengthMult = overrideBottomLength
    ? 1
    : tracingProportions?.bottomLengthMultiplier;

  let rawResult: PatternResult;

  switch (category) {
    case "top":
      rawResult = generateTopPattern({
        measurements: effectiveMeasurements,
        subStyle: topSubStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        seamAllowance,
        fabricType,
        necklineDropRatio: tracingProportions?.necklineDropRatio,
        armholeDepthMultiplier: tracingProportions?.armholeDepthMultiplier,
        lengthMultiplier: lengthMult,
        extras,
        styleVariant,
      });
      break;
    case "pants":
      rawResult = generatePantsPattern({
        measurements: effectiveMeasurements,
        subStyle: pantsSubStyle,
        seamAllowance,
        fabricType,
        lengthMultiplier: lengthMult,
        crotchDepthMultiplier: tracingProportions?.crotchDepthMultiplier,
        extras,
      });
      break;
    case "skirt":
      rawResult = generateSkirtPattern({
        measurements: effectiveMeasurements,
        subStyle: skirtSubStyle,
        seamAllowance,
        fabricType,
        flareRatio: tracingProportions?.flareRatio,
        lengthMultiplier: lengthMult,
        extras,
      });
      break;
    case "dress":
      rawResult = generateDressPattern({
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
      break;
    case "two_piece":
      rawResult = generateTwoPiecePattern({
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
      break;
    case "jumpsuit":
      rawResult = generateJumpsuitPattern({
        measurements: effectiveMeasurements,
        subStyle: jumpsuitSubStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        seamAllowance,
        fabricType,
        lengthMultiplier: lengthMult,
        extras,
      });
      break;
    case "kids":
      rawResult = generateKidsPattern({
        measurements: effectiveMeasurements,
        subStyle: kidsSubStyle,
        seamAllowance,
        fabricType,
        lengthMultiplier: lengthMult,
        extras,
      });
      break;
    case "loungewear":
      rawResult = generateLoungewearPattern({
        measurements: effectiveMeasurements,
        subStyle: loungewearSubStyle,
        seamAllowance,
        fabricType,
        lengthMultiplier: lengthMult,
        extras,
      });
      break;
    case "accessories":
      rawResult = generateAccessoriesPattern({
        measurements: effectiveMeasurements,
        subStyle: accessorySubStyle,
        seamAllowance,
        fabricType,
      });
      break;
  }

  return {
    ...rawResult,
    seamValidation: validatePatternSeams(rawResult, warnings),
  };
}
