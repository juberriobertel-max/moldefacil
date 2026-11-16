export type SeamAllowance = 0 | 1 | 1.5;

export type FabricType = "woven" | "stretch";

export type GarmentCategory =
  | "top"
  | "pants"
  | "skirt"
  | "dress"
  | "two_piece"
  | "jumpsuit"
  | "kids"
  | "loungewear"
  | "accessories";

export type TopSubStyle = "tshirt" | "blouse" | "jacket";
export type PantsSubStyle = "straight" | "wide" | "shorts";
export type SkirtSubStyle = "straight" | "a_line" | "semicircular";
export type DressSubStyle = "dress" | "jumpsuit";
export type JumpsuitSubStyle = "romper_long" | "romper_short" | "overall";
export type KidsSubStyle = "baby_bodysuit" | "kids_dress" | "kids_pants";
export type LoungewearSubStyle = "leggings" | "classic_pajama";
export type AccessorySubStyle = "bucket_hat" | "apron" | "zipper_pouch";

export type TwoPieceTopStyle = "crop_top" | "waist_blouse" | "jacket_blazer";
export type TwoPieceBottomStyle =
  | "straight_skirt"
  | "aline_skirt"
  | "long_skirt"
  | "pants";

export type NecklineStyle =
  | "round"
  | "v_neck"
  | "square"
  | "high"
  | "tailored_lapel"
  | "shirt_collar";
export type SleeveStyle = "sleeveless" | "short" | "long" | "kimono";
export type TorsoFit = "fitted" | "loose";

export type PaperFormat = "letter" | "a4";

export interface Point2D {
  x: number;
  y: number;
}

export interface Measurements {
  bust: number;
  waist: number;
  hip: number;
  backWidth: number;
  bodiceLength: number;
  sleeveLength: number;
  skirtLength: number;
  crotchDepth: number;
  thigh: number;
  inseam: number;
  hemWidth: number;
  headCircumference?: number;
}

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | {
      type: "C";
      cp1x: number;
      cp1y: number;
      cp2x: number;
      cp2y: number;
      x: number;
      y: number;
    }
  | { type: "Z" };

export interface PatternNotch {
  x: number;
  y: number;
  angle: number;
  label?: string;
}

export interface PatternInternalLine {
  commands: PathCommand[];
  style: "dart" | "fold" | "mark";
  label?: string;
  labelPos?: Point2D;
}

export interface PatternPiece {
  id: string;
  name: string;
  subtitle?: string;
  tabLabel: string;
  widthCm: number;
  heightCm: number;
  layoutX: number;
  layoutY: number;
  seamPath: PathCommand[];
  cutPath: PathCommand[];
  grainline: { x1: number; y1: number; x2: number; y2: number };
  notches: PatternNotch[];
  internalLines?: PatternInternalLine[];
  labelPos: Point2D;
  labelAngle?: number;
  labelMaxSpanCm?: number;
  labelBandWidthCm?: number;
  foldLine?: { x1: number; y1: number; x2: number; y2: number };
}

export interface SeamCheckItem {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  diffMm: number;
}

export interface SeamValidationReport {
  verified: boolean;
  badgeText: string;
  checks: SeamCheckItem[];
  stabilizedNotes?: string[];
}

export interface PatternResult {
  category: GarmentCategory;
  subStyleLabel: string;
  pieces: PatternPiece[];
  fabricConsumption: {
    width140m: number;
    width150m: number;
  };
  totalBoundsCm: {
    width: number;
    height: number;
  };
  appliedEaseLabel: string;
  seamValidation?: SeamValidationReport;
}

export interface TracingPins {
  shoulder: Point2D; // 1. Hombro
  neckline: Point2D; // 2. Cuello / Escote
  armhole: Point2D; // 3. Sisa (Blusa / Chaqueta)
  waist: Point2D; // Cintura (Vestido, Falda, Pantalón)
  crotch: Point2D; // 3. Tiro / Entrepierna (Pantalón)
  topEnd: Point2D; // 3. Fin del Top (2 piezas)
  bottomStart: Point2D; // 4. Inicio Falda/Pantalón (2 piezas)
  hip: Point2D; // Cadera
  hem: Point2D; // Largo (Bota / Ruedo)
}

export interface GarmentExtras {
  wrapFront: boolean;
  flaredSleeve: boolean;
  waistTie: boolean;
  hemRuffle: boolean;
  sidePockets: boolean;
  flapPockets: boolean;
}

export const DEFAULT_GARMENT_EXTRAS: GarmentExtras = {
  wrapFront: false,
  flaredSleeve: false,
  waistTie: false,
  hemRuffle: false,
  sidePockets: false,
  flapPockets: false,
};

export type QuickLengthPreset = "photo" | "mini" | "knee" | "midi" | "maxi";

export type StyleVariant =
  | "default"
  | "empire_cut"
  | "shirt_dress"
  | "peasant_offshoulder"
  | "office_dart";

export interface SolvedTracingProportions {
  bodiceToTotalRatio: number;
  necklineDropRatio: number;
  flareRatio: number;
  lengthMultiplier: number;
  topLengthMultiplier: number;
  bottomLengthMultiplier: number;
  crotchDepthMultiplier: number;
  armholeDepthMultiplier: number;
}
