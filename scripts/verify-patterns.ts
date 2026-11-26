import { generateUniversalPattern } from "../lib/patternEngine";
import { flattenPathToPoints } from "../lib/garmentEngines/geometry";
import { computeTilingGrid } from "../lib/pdfExporter";
import { resolveProMeasurements } from "../lib/seamValidator";
import {
  FabricType,
  Measurements,
  NecklineStyle,
  PaperFormat,
  SeamAllowance,
  SleeveStyle,
} from "../lib/types";

const SIZE_PRESETS: Record<string, Measurements> = {
  XS: {
    bust: 82,
    waist: 64,
    hip: 88,
    backWidth: 34,
    bodiceLength: 40,
    sleeveLength: 55,
    skirtLength: 54,
    crotchDepth: 25,
    thigh: 52,
    inseam: 74,
    hemWidth: 34,
    headCircumference: 54,
  },
  S: {
    bust: 88,
    waist: 68,
    hip: 94,
    backWidth: 36,
    bodiceLength: 41,
    sleeveLength: 57,
    skirtLength: 56,
    crotchDepth: 26,
    thigh: 55,
    inseam: 75,
    hemWidth: 36,
    headCircumference: 55,
  },
  M: {
    bust: 94,
    waist: 74,
    hip: 100,
    backWidth: 38,
    bodiceLength: 42,
    sleeveLength: 58,
    skirtLength: 58,
    crotchDepth: 27,
    thigh: 58,
    inseam: 76,
    hemWidth: 38,
    headCircumference: 56,
  },
  L: {
    bust: 104,
    waist: 84,
    hip: 110,
    backWidth: 40,
    bodiceLength: 44,
    sleeveLength: 60,
    skirtLength: 62,
    crotchDepth: 29,
    thigh: 64,
    inseam: 77,
    hemWidth: 42,
    headCircumference: 57,
  },
  "3XL": {
    bust: 126,
    waist: 108,
    hip: 132,
    backWidth: 45,
    bodiceLength: 47,
    sleeveLength: 62,
    skirtLength: 66,
    crotchDepth: 33,
    thigh: 76,
    inseam: 78,
    hemWidth: 48,
    headCircumference: 59,
  },
};

function assertFiniteCoords(res: ReturnType<typeof generateUniversalPattern>, label: string) {
  for (const p of res.pieces) {
    if (!Number.isFinite(p.widthCm) || !Number.isFinite(p.heightCm) || p.widthCm <= 1 || p.heightCm <= 1) {
      throw new Error(`[${label}] Invalid dimensions on piece ${p.id}: ${p.widthCm}x${p.heightCm}`);
    }
    const pts = [...flattenPathToPoints(p.seamPath), ...flattenPathToPoints(p.cutPath)];
    for (const pt of pts) {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
        throw new Error(`[${label}] Non-finite point on ${p.id}`);
      }
    }
    if (!Number.isFinite(p.grainline.x1) || !Number.isFinite(p.grainline.y2)) {
      throw new Error(`[${label}] Non-finite grainline on ${p.id}`);
    }
  }
}

let totalCases = 0;
let passedCases = 0;
const failures: string[] = [];

const fabrics: FabricType[] = ["woven", "stretch"];
const allowances: SeamAllowance[] = [0, 1, 1.5];

for (const [sizeName, measurements] of Object.entries(SIZE_PRESETS)) {
  const pro = resolveProMeasurements(measurements);
  if (pro.frontBodiceLength < pro.backBodiceLength) {
    failures.push(`[${sizeName}] Pro frontBodiceLength < backBodiceLength`);
  }

  for (const fabricType of fabrics) {
    for (const seamAllowance of allowances) {
      const testMatrix: Array<{
        label: string;
        input: Parameters<typeof generateUniversalPattern>[0];
      }> = [
        {
          label: `top-blouse-round-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "top",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "aline_skirt",
            necklineStyle: "round",
            sleeveStyle: "short",
            torsoFit: "fitted",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `top-shirt-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "top",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "aline_skirt",
            necklineStyle: "shirt_collar" as NecklineStyle,
            sleeveStyle: "long" as SleeveStyle,
            torsoFit: "fitted",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `top-jacket-2psleeve-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "top",
            topSubStyle: "jacket",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "jacket_blazer",
            twoPieceBottomStyle: "pants",
            necklineStyle: "tailored_lapel",
            sleeveStyle: "long",
            torsoFit: "fitted",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `top-tshirt-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "top",
            topSubStyle: "tshirt",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "crop_top",
            twoPieceBottomStyle: "aline_skirt",
            necklineStyle: "round",
            sleeveStyle: "short",
            torsoFit: "fitted",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `skirt-straight-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "skirt",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "straight",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "straight_skirt",
            necklineStyle: "round",
            sleeveStyle: "sleeveless",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `skirt-semicircular-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "skirt",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "semicircular",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "long_skirt",
            necklineStyle: "round",
            sleeveStyle: "sleeveless",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `pants-straight-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "pants",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "pants",
            necklineStyle: "round",
            sleeveStyle: "sleeveless",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `dress-shirt-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "dress",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "aline_skirt",
            necklineStyle: "shirt_collar",
            sleeveStyle: "long",
            styleVariant: "shirt_dress",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `twopiece-blazer-pants-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "two_piece",
            topSubStyle: "jacket",
            pantsSubStyle: "wide",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "jacket_blazer",
            twoPieceBottomStyle: "pants",
            necklineStyle: "tailored_lapel",
            sleeveStyle: "long",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `jumpsuit-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "jumpsuit",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "pants",
            jumpsuitSubStyle: "romper_long",
            necklineStyle: "v_neck",
            sleeveStyle: "short",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `kids-dress-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "kids",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "aline_skirt",
            kidsSubStyle: "kids_dress",
            necklineStyle: "round",
            sleeveStyle: "short",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `loungewear-pajama-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "loungewear",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "pants",
            loungewearSubStyle: "classic_pajama",
            necklineStyle: "round",
            sleeveStyle: "long",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
        {
          label: `accessories-hat-${sizeName}-${fabricType}-sa${seamAllowance}`,
          input: {
            category: "accessories",
            topSubStyle: "blouse",
            pantsSubStyle: "straight",
            skirtSubStyle: "a_line",
            dressSubStyle: "dress",
            twoPieceTopStyle: "waist_blouse",
            twoPieceBottomStyle: "aline_skirt",
            accessorySubStyle: "bucket_hat",
            necklineStyle: "round",
            sleeveStyle: "sleeveless",
            measurements,
            seamAllowance,
            fabricType,
          },
        },
      ];

      for (const tc of testMatrix) {
        totalCases++;
        try {
          const res = generateUniversalPattern(tc.input);
          assertFiniteCoords(res, tc.label);

          if (!res.seamValidation?.verified) {
            const failedChecks = res.seamValidation?.checks
              .filter((c) => !c.passed)
              .map((c) => `${c.id}: ${c.detail}`)
              .join(" | ");
            throw new Error(`Seam validation failed: ${failedChecks}`);
          }

          if (res.fabricConsumption.width140m <= 0 || res.fabricConsumption.width150m <= 0) {
            throw new Error(`Invalid fabric consumption: ${JSON.stringify(res.fabricConsumption)}`);
          }

          if (sizeName === "M" && seamAllowance === 1 && fabricType === "woven") {
            const formats: PaperFormat[] = ["letter", "a4", "a0", "projector"];
            for (const fmt of formats) {
              const grid = computeTilingGrid(
                res.totalBoundsCm.width,
                res.totalBoundsCm.height,
                fmt,
                res.pieces
              );
              if (grid.printableCount < 1) {
                throw new Error(`Invalid grid count for ${fmt}`);
              }
            }
          }
          passedCases++;
        } catch (err) {
          failures.push(`[${tc.label}] ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
}

console.log(`MoldeFácil Regression Suite: ${passedCases}/${totalCases} cases passed.`);
if (failures.length > 0) {
  console.error(`Failures (${failures.length}):`);
  for (const f of failures.slice(0, 25)) {
    console.error("  - " + f);
  }
  process.exit(1);
}
