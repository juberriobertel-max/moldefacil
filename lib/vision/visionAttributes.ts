import {
  CATEGORY_PROMPT_GROUP,
  EvaluatedPromptGroup,
  FABRIC_PROMPT_GROUP,
  FIT_PROMPT_GROUP,
  LENGTH_PROMPT_GROUP,
  NECKLINE_PROMPT_GROUP,
  PANTS_CUT_PROMPT_GROUP,
  PRINT_PROMPT_GROUP,
  PromptOption,
  RUFFLE_PROMPT_GROUP,
  SKIRT_CUT_PROMPT_GROUP,
  SLEEVE_PROMPT_GROUP,
  WAIST_TIE_PROMPT_GROUP,
} from "./garmentPrompts";
import type { VisionCropKey } from "./imagePreprocessor";
import type { RawVisionEvaluation } from "./tailoringRules";

export type AtributoVision =
  | "category"
  | "neckline"
  | "sleeve"
  | "fit"
  | "length"
  | "skirtCut"
  | "pantsCut"
  | "waistTie"
  | "ruffle"
  | "fabric"
  | "print";

export const ATRIBUTOS_VISION: readonly AtributoVision[] = [
  "category",
  "neckline",
  "sleeve",
  "fit",
  "length",
  "skirtCut",
  "pantsCut",
  "waistTie",
  "ruffle",
  "fabric",
  "print",
];

export const ATRIBUTO_A_RECORTE: Record<AtributoVision, VisionCropKey> = {
  category: "full",
  neckline: "neckline",
  sleeve: "sleeves",
  fit: "full",
  length: "full",
  skirtCut: "waistLower",
  pantsCut: "waistLower",
  waistTie: "waistLower",
  ruffle: "waistLower",
  fabric: "full",
  print: "full",
};

export const TITULOS_ATRIBUTO_ES: Record<AtributoVision, string> = {
  category: "Categoría",
  neckline: "Escote",
  sleeve: "Manga",
  fit: "Silueta / Entalle",
  length: "Largo",
  skirtCut: "Corte de falda",
  pantsCut: "Corte de pantalón",
  waistTie: "Cinturón / Lazo",
  ruffle: "Volante / Bolero",
  fabric: "Tela",
  print: "Estampado",
};

function extraerIds<T extends string>(grupo: readonly PromptOption<T>[]): readonly T[] {
  return grupo.map((item) => item.id);
}

export const IDS_VALIDOS: Record<AtributoVision, readonly string[]> = {
  category: extraerIds(CATEGORY_PROMPT_GROUP),
  neckline: extraerIds(NECKLINE_PROMPT_GROUP),
  sleeve: extraerIds(SLEEVE_PROMPT_GROUP),
  fit: extraerIds(FIT_PROMPT_GROUP),
  length: extraerIds(LENGTH_PROMPT_GROUP),
  skirtCut: extraerIds(SKIRT_CUT_PROMPT_GROUP),
  pantsCut: extraerIds(PANTS_CUT_PROMPT_GROUP),
  waistTie: extraerIds(WAIST_TIE_PROMPT_GROUP),
  ruffle: extraerIds(RUFFLE_PROMPT_GROUP),
  fabric: extraerIds(FABRIC_PROMPT_GROUP),
  print: extraerIds(PRINT_PROMPT_GROUP),
};

export function grupoDesdeEvaluacion(
  raw: Pick<
    RawVisionEvaluation,
    | "category"
    | "neckline"
    | "sleeves"
    | "fit"
    | "length"
    | "skirtCut"
    | "pantsCut"
    | "waistTie"
    | "ruffle"
    | "fabric"
    | "print"
  >,
  attr: AtributoVision
): EvaluatedPromptGroup<string> | undefined {
  switch (attr) {
    case "category":
      return raw.category;
    case "neckline":
      return raw.neckline;
    case "sleeve":
      return raw.sleeves;
    case "fit":
      return raw.fit;
    case "length":
      return raw.length;
    case "skirtCut":
      return raw.skirtCut;
    case "pantsCut":
      return raw.pantsCut;
    case "waistTie":
      return raw.waistTie;
    case "ruffle":
      return raw.ruffle;
    case "fabric":
      return raw.fabric;
    case "print":
      return raw.print;
  }
}
