import type { TipoEstampado, TipoTela } from "../3d/types";

export const PRIMARY_VISION_MODEL = "Xenova/siglip-base-patch16-224";
export const FALLBACK_VISION_MODEL = "Xenova/clip-vit-base-patch16";
export const SECONDARY_FALLBACK_VISION_MODEL = "Xenova/clip-vit-base-patch32";

export const HIGH_CONFIDENCE_THRESHOLD = 0.6;
export const DEFAULT_HYPOTHESIS_TEMPLATE = "a fashion photo of {}";

export interface PromptOption<T extends string = string> {
  id: T;
  labelEs: string;
  prompts: readonly [string, string, string];
}

export interface RankedPromptCandidate<T extends string = string> {
  id: T;
  labelEs: string;
  confidence: number;
  rawMeanScore: number;
}

export interface EvaluatedPromptGroup<T extends string = string> {
  top1: RankedPromptCandidate<T>;
  top2: RankedPromptCandidate<T> | null;
  top3: RankedPromptCandidate<T>[];
  all: RankedPromptCandidate<T>[];
  esAltaConfianza: boolean;
}

export type ValidityPromptId = "valid_garment" | "non_garment";

export type CategoryPromptId =
  | "vestido"
  | "blusa"
  | "chaqueta"
  | "falda"
  | "pantalon"
  | "conjunto"
  | "enterizo"
  | "bucketHat";

export type NecklinePromptId =
  | "wrap"
  | "v_neck"
  | "round"
  | "square"
  | "tailored_lapel"
  | "shirt_collar"
  | "high";

export type SleevePromptId =
  | "kimono"
  | "farol"
  | "acampanada"
  | "short"
  | "long"
  | "sleeveless";

export type FitPromptId = "fitted" | "loose";
export type LengthPromptId = "short" | "midi" | "long";
export type SkirtCutPromptId = "straight" | "a_line" | "semicircular";
export type PantsCutPromptId = "straight" | "wide" | "shorts";
export type WaistTiePromptId = "with_belt" | "no_belt";
export type RufflePromptId = "with_ruffle" | "no_ruffle";

export const VALIDITY_PROMPT_GROUP: readonly PromptOption<ValidityPromptId>[] = [
  {
    id: "valid_garment",
    labelEs: "Prenda o accesorio textil",
    prompts: [
      "clothing outfit garment dress blouse skirt pants or fabric hat worn or displayed",
      "fashion apparel studio or street style photo showing wearable clothing",
      "textile sewing garment flat lay or mannequin outfit photo",
    ],
  },
  {
    id: "non_garment",
    labelEs: "Imagen ajena a moda",
    prompts: [
      "nature landscape scenery mountains sky buildings or street with no clothing focus",
      "text meme screenshot document receipt cartoon illustration without garment",
      "food dish animal car electronics furniture or abstract background with no clothing",
    ],
  },
];

export const CATEGORY_PROMPT_GROUP: readonly PromptOption<CategoryPromptId>[] = [
  {
    id: "vestido",
    labelEs: "Vestido",
    prompts: [
      "a full one-piece women dress garment worn or on mannequin",
      "summer midi or maxi single-piece dress with connected bodice and skirt",
      "tailored or wrap dress in one continuous garment piece",
    ],
  },
  {
    id: "blusa",
    labelEs: "Blusa / Camisa",
    prompts: [
      "a standalone upper body blouse shirt or casual top",
      "women feminine top or buttoned blouse paired separately with bottoms",
      "t-shirt camisole or fitted top ending at waist or hip",
    ],
  },
  {
    id: "chaqueta",
    labelEs: "Chaqueta / Blazer",
    prompts: [
      "a tailored suit blazer jacket or structured outer coat",
      "front buttoned blazer garment with notched lapels and structured shoulders",
      "casual cardigan utility jacket or cropped outerwear layer",
    ],
  },
  {
    id: "falda",
    labelEs: "Falda",
    prompts: [
      "a standalone lower body skirt isolated from waist to hem",
      "pleated A-line pencil or midi skirt without top bodice",
      "wrap skirt or flared skirt worn at the waistline",
    ],
  },
  {
    id: "pantalon",
    labelEs: "Pantalón",
    prompts: [
      "a pair of tailored trousers wide leg palazzo pants or jeans",
      "high waisted long pants with two separate trouser legs",
      "casual cropped pants culottes or tailored shorts",
    ],
  },
  {
    id: "conjunto",
    labelEs: "Conjunto 2 Piezas",
    prompts: [
      "a matching two-piece co-ord outfit with separate crop top and skirt or pants showing midriff",
      "coordinated set consisting of two separate garments top and bottom",
      "two-piece fashion ensemble blazer or blouse set with matching skirt",
    ],
  },
  {
    id: "enterizo",
    labelEs: "Enterizo / Overol",
    prompts: [
      "a one-piece jumpsuit romper or playsuit combining bodice and pant legs",
      "women wide leg jumpsuit belted at the waist",
      "denim bib overall or utility coveralls garment",
    ],
  },
  {
    id: "bucketHat",
    labelEs: "Sombrero Bucket Hat",
    prompts: [
      "a fabric bucket hat fisherman hat with downward sloping brim",
      "cotton or canvas sun hat bucket cap worn on head or product photo",
      "wide stitched brim reversible cloth bucket hat accessory",
    ],
  },
];

export const NECKLINE_PROMPT_GROUP: readonly PromptOption<NecklinePromptId>[] = [
  {
    id: "wrap",
    labelEs: "Escote Cruzado",
    prompts: [
      "a wrap dress with overlapping V-neck front",
      "surplice crossover V neckline garment",
      "crossed front bodice tied at waist",
    ],
  },
  {
    id: "v_neck",
    labelEs: "Escote en V",
    prompts: [
      "clean symmetrical pointed V-neck neckline without crossover panels",
      "plunging or modest V-shaped front neck opening sewn down center",
      "open V neckline top or dress bodice",
    ],
  },
  {
    id: "round",
    labelEs: "Escote Redondo",
    prompts: [
      "classic round crew neckline curving smoothly around collarbone",
      "scoop U-shaped open round front neckline",
      "boat or soft rounded jewel neckline",
    ],
  },
  {
    id: "square",
    labelEs: "Escote Cuadrado",
    prompts: [
      "geometric square neckline with straight horizontal front edge",
      "rectangular sharp cornered square cut bodice neckline",
      "straight across bandeau or corset square neckline",
    ],
  },
  {
    id: "tailored_lapel",
    labelEs: "Solapa Sastre",
    prompts: [
      "tailored blazer notched lapel collar",
      "structured suit jacket collar with lapels",
      "folded peaked or notched blazer lapel opening down the chest",
    ],
  },
  {
    id: "shirt_collar",
    labelEs: "Cuello Camisero",
    prompts: [
      "classic pointed button-down shirt collar on stand",
      "folded collared shirt neck with front button placket",
      "crisp tailored blouse shirt collar around neck",
    ],
  },
  {
    id: "high",
    labelEs: "Cuello Alto",
    prompts: [
      "high turtleneck roll neck collar covering neck",
      "raised mock neck funnel neckline close to throat",
      "mandarin or stand collar closed high up to neck",
    ],
  },
];

export const SLEEVE_PROMPT_GROUP: readonly PromptOption<SleevePromptId>[] = [
  {
    id: "kimono",
    labelEs: "Manga Kimono",
    prompts: [
      "wide loose kimono batwing sleeves without armhole seam",
      "dolman draped wide sleeves",
      "kaftan style flowing wide sleeves",
    ],
  },
  {
    id: "farol",
    labelEs: "Manga Farol",
    prompts: [
      "puffed voluminous lantern bishop sleeves",
      "gathered puff sleeves at shoulder and cuff",
      "rounded balloon puff sleeves cinched tightly at wrist or mid-arm",
    ],
  },
  {
    id: "acampanada",
    labelEs: "Manga Acampanada",
    prompts: [
      "wide bell flared sleeves opening dramatically toward the cuff",
      "flowing trumpet flutter sleeves with ruffled wide hem",
      "dramatic flared angel sleeves widening below elbow",
    ],
  },
  {
    id: "short",
    labelEs: "Manga Corta",
    prompts: [
      "short fitted set-in sleeves ending mid upper arm",
      "classic t-shirt short sleeves with shoulder armhole seam",
      "neat tailored short cap sleeves covering shoulders",
    ],
  },
  {
    id: "long",
    labelEs: "Manga Larga",
    prompts: [
      "fitted full-length long sleeves extending down to the wrist",
      "tailored jacket or blouse straight long sleeves",
      "slim long set-in sleeves with standard shoulder seam",
    ],
  },
  {
    id: "sleeveless",
    labelEs: "Sin Mangas",
    prompts: [
      "sleeveless garment showing bare shoulders and arms",
      "thin spaghetti straps halter or tank straps without sleeves",
      "strapless or sleeveless clean armhole bodice",
    ],
  },
];

export const FIT_PROMPT_GROUP: readonly PromptOption<FitPromptId>[] = [
  {
    id: "fitted",
    labelEs: "Torso Entallado",
    prompts: [
      "tailored close-fitting bodice sculpted tightly at the waist with darts",
      "form-fitting contoured silhouette hugging chest and waistline",
      "structured fitted waist silhouette without excess blousing fabric",
    ],
  },
  {
    id: "loose",
    labelEs: "Torso Holgado",
    prompts: [
      "loose relaxed oversized fit with abundant draped fabric folds",
      "flowy bloused relaxed bodice with generous wearing ease",
      "wide airy kaftan or tunic drape hanging loosely from shoulders",
    ],
  },
];

export const LENGTH_PROMPT_GROUP: readonly PromptOption<LengthPromptId>[] = [
  {
    id: "short",
    labelEs: "Largo Corto / Mini",
    prompts: [
      "short mini hemline ending well above the knees",
      "cropped waist garment or high-thigh mini dress or skirt",
      "above-the-knee short length garment silhouette",
    ],
  },
  {
    id: "midi",
    labelEs: "Largo Midi / Rodilla",
    prompts: [
      "knee-length or mid-calf midi dress skirt or blouse below hips",
      "classic tea-length midi silhouette falling between knee and ankle",
      "medium balanced garment hem ending around the shins or knees",
    ],
  },
  {
    id: "long",
    labelEs: "Largo Maxi",
    prompts: [
      "full-length maxi hemline reaching the ankles or floor",
      "long flowing evening gown maxi skirt or full length trousers",
      "floor-grazing ankle-length long silhouette",
    ],
  },
];

export const SKIRT_CUT_PROMPT_GROUP: readonly PromptOption<SkirtCutPromptId>[] = [
  {
    id: "straight",
    labelEs: "Corte Recto / Tubo",
    prompts: [
      "straight slim pencil column skirt falling vertically from hips",
      "narrow fitted sheath skirt silhouette without bottom flare",
      "vertical straight cut skirt panel with minimal hem flare",
    ],
  },
  {
    id: "a_line",
    labelEs: "Corte Evasé (En A)",
    prompts: [
      "classic A-line skirt flaring gently outward from waist to hem",
      "subtle trapezoidal flared skirt silhouette with moderate swing",
      "slightly flared structured A-line skirt hem",
    ],
  },
  {
    id: "semicircular",
    labelEs: "Corte Circular / Amplio",
    prompts: [
      "wide voluminous full circle skater skirt with deep rippling folds",
      "heavily gathered flared swirling skirt with abundant hem volume",
      "abundant semicircular draped skirt cascading in soft waves",
    ],
  },
];

export const PANTS_CUT_PROMPT_GROUP: readonly PromptOption<PantsCutPromptId>[] = [
  {
    id: "straight",
    labelEs: "Pantalón Recto",
    prompts: [
      "classic straight-leg tailored trousers or slim ankle pants",
      "narrow cigarette or tapered trousers hugging hips and thighs",
      "regular straight cut denim jeans or office trousers",
    ],
  },
  {
    id: "wide",
    labelEs: "Pantalón Palazzo / Ancho",
    prompts: [
      "wide-leg flowing palazzo trousers draping generously down to the floor",
      "high-waisted wide culotte pants with voluminous leg width",
      "loose wide baggy trousers billowing gracefully around ankles",
    ],
  },
  {
    id: "shorts",
    labelEs: "Short / Bermuda",
    prompts: [
      "short summer pants or tailored bermuda shorts above the knee",
      "high-waisted denim or linen shorts with short hem",
      "cropped shorts exposing knees and lower legs",
    ],
  },
];

export const WAIST_TIE_PROMPT_GROUP: readonly PromptOption<WaistTiePromptId>[] = [
  {
    id: "with_belt",
    labelEs: "Con Cinturón / Lazo",
    prompts: [
      "garment cinched at the waist with a tied fabric sash belt or bow",
      "self-tie fabric waist strap knotted around the middle",
      "visible buckled belt or wrap tie ribbon around waistline",
    ],
  },
  {
    id: "no_belt",
    labelEs: "Sin Cinturón",
    prompts: [
      "plain uninterrupted waistline with no belt sash bow or strap",
      "clean smooth bodice waist seam without tie strings",
      "beltless dress top or trousers with plain front waist",
    ],
  },
];

export const RUFFLE_PROMPT_GROUP: readonly PromptOption<RufflePromptId>[] = [
  {
    id: "with_ruffle",
    labelEs: "Con Bolero / Volante",
    prompts: [
      "tiered skirt or dress featuring a gathered ruffled flounce at the bottom hem",
      "wavy frilled peplum or pleated bottom ruffle trim",
      "layered flounce ruffle panel sewn onto the garment hem",
    ],
  },
  {
    id: "no_ruffle",
    labelEs: "Ruedo Limpio",
    prompts: [
      "smooth clean straight hem edge with no ruffles tiers or frills",
      "plain flat topstitched bottom hem without gathered flounce",
      "minimalist sleek bottom edge free of ruffles",
    ],
  },
];

export const FABRIC_PROMPT_GROUP: readonly PromptOption<TipoTela>[] = [
  {
    id: "seda",
    labelEs: "Seda / Satín",
    prompts: [
      "glossy lustrous silk satin charmeuse fabric reflecting soft specular sheen",
      "liquid slippery silky satin cloth draping smoothly over body",
      "shiny lightweight silk woven textile with luminous folds",
    ],
  },
  {
    id: "crepe",
    labelEs: "Crepé Fluido",
    prompts: [
      "matte fluid draped crepe chiffon or georgette fabric with soft flow",
      "lightweight non-shiny matte woven dress fabric with fine grain",
      "softly billowing matte crepe blouse or skirt textile",
    ],
  },
  {
    id: "lino",
    labelEs: "Lino / Algodón",
    prompts: [
      "crisp structured matte linen or woven cotton poplin textile with natural texture",
      "breathable slightly stiff summer linen tailoring fabric with subtle creases",
      "structured cotton twill canvas or suiting wool matte woven cloth",
    ],
  },
  {
    id: "licra",
    labelEs: "Licra / Punto Elástico",
    prompts: [
      "stretchy smooth jersey lycra spandex or rib knit clingy fabric",
      "form-hugging elastic knitwear or athletic stretch spandex fabric",
      "bodycon stretchy knitted cotton-elastane fabric molding to curves",
    ],
  },
];

export const PRINT_PROMPT_GROUP: readonly PromptOption<TipoEstampado>[] = [
  {
    id: "liso",
    labelEs: "Liso (Unicolor)",
    prompts: [
      "solid plain single-color fabric with zero printed motifs stripes or dots",
      "monochrome solid dyed cloth without any pattern",
      "uniform clean plain solid textile surface",
    ],
  },
  {
    id: "lunares",
    labelEs: "Lunares",
    prompts: [
      "polka dot patterned fabric covered in repeated circular spots",
      "spotted dotted textile print across the garment",
      "classic white or dark polka dots printed over cloth",
    ],
  },
  {
    id: "rayas",
    labelEs: "Rayas",
    prompts: [
      "striped garment fabric featuring repeating vertical or horizontal parallel stripes",
      "pinstripe or Breton sailor striped woven pattern cloth",
      "bold linear banded stripes printed or woven onto fabric",
    ],
  },
  {
    id: "vichy",
    labelEs: "Cuadros Vichy",
    prompts: [
      "gingham plaid vichy checkered two-tone square check fabric pattern",
      "tartan tartan-check or grid checkerboard woven cloth pattern",
      "crisscross gingham check print covering the garment",
    ],
  },
];

/**
 * Convierte cada puntaje crudo de sigmoide/softmax en log-odds, promedia los
 * 3 prompts descriptivos por clase y aplica Softmax con temperatura calibrada
 * (T = 0.65) para que la escala 0..1 sea coherente tanto en SigLIP como en CLIP.
 */
export function evaluarGrupoPrompts<T extends string>(
  grupo: readonly PromptOption<T>[],
  resultadosCrudos: ReadonlyArray<{ label: string; score: number }>,
  temperatura = 0.65
): EvaluatedPromptGroup<T> {
  const mapaPuntaje = new Map<string, number>();
  for (const r of resultadosCrudos) {
    mapaPuntaje.set(r.label, Number(r.score));
  }

  const intermedios = grupo.map((opcion) => {
    let sumaCruda = 0;
    let sumaLogits = 0;

    for (const p of opcion.prompts) {
      const raw = mapaPuntaje.get(p) ?? 1e-4;
      const clamped = Math.min(1 - 1e-5, Math.max(1e-5, raw));
      sumaCruda += clamped;
      sumaLogits += Math.log(clamped / (1 - clamped));
    }

    const n = opcion.prompts.length;
    return {
      id: opcion.id,
      labelEs: opcion.labelEs,
      rawMeanScore: sumaCruda / n,
      meanLogit: sumaLogits / n,
    };
  });

  const maxLogit = Math.max(...intermedios.map((x) => x.meanLogit));
  const safeTemp = Math.max(0.15, temperatura);

  const exps = intermedios.map((x) => Math.exp((x.meanLogit - maxLogit) / safeTemp));
  const sumExp = exps.reduce((acc, v) => acc + v, 0) || 1;

  const all: RankedPromptCandidate<T>[] = intermedios
    .map((x, idx) => ({
      id: x.id,
      labelEs: x.labelEs,
      confidence: Number((exps[idx] / sumExp).toFixed(4)),
      rawMeanScore: Number(x.rawMeanScore.toFixed(4)),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const top1 = all[0];
  const top2 = all[1] ?? null;
  const top3 = all.slice(0, 3);

  return {
    top1,
    top2,
    top3,
    all,
    esAltaConfianza: top1.confidence >= HIGH_CONFIDENCE_THRESHOLD,
  };
}

/**
 * Extrae todos los strings de prompt planos de un grupo.
 */
export function obtenerEtiquetasGrupo<T extends string>(
  grupo: readonly PromptOption<T>[]
): string[] {
  return grupo.flatMap((o) => [...o.prompts]);
}
