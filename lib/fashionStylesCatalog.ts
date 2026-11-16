import {
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  NecklineStyle,
  PantsSubStyle,
  QuickLengthPreset,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "./types";

export interface FashionStylePreset {
  id: string;
  name: string;
  shortTag: string;
  fabricTip: string;
  clipPrompt: string;
  config: {
    category: GarmentCategory;
    topSubStyle?: TopSubStyle;
    pantsSubStyle?: PantsSubStyle;
    skirtSubStyle?: SkirtSubStyle;
    dressSubStyle?: DressSubStyle;
    twoPieceTopStyle?: TwoPieceTopStyle;
    twoPieceBottomStyle?: TwoPieceBottomStyle;
    necklineStyle?: NecklineStyle;
    sleeveStyle?: SleeveStyle;
    extras: GarmentExtras;
    quickLength: QuickLengthPreset;
    styleVariant: StyleVariant;
    fabricType?: FabricType;
  };
}

export const FASHION_STYLES_CATALOG: FashionStylePreset[] = [
  {
    id: "wrap_dress",
    name: "Vestido Cruzado (Wrap Dress)",
    shortTag: "Escote en V • Lazo • Manga ancha",
    fabricTip: "Queda mejor en rayón, chalis, viscosa o tela con caída fluida",
    clipPrompt: "wrap dress with v-neck crossover front and tie waist belt",
    config: {
      category: "dress",
      dressSubStyle: "dress",
      skirtSubStyle: "a_line",
      necklineStyle: "v_neck",
      sleeveStyle: "short",
      extras: {
        wrapFront: true,
        flaredSleeve: true,
        waistTie: true,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "midi",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "empire_dress",
    name: "Corte Imperio (Estilo Bridgerton)",
    shortTag: "Corte bajo busto • Escote cuadrado",
    fabricTip: "Ideal en lino liviano, popelina de algodón, gasa o satén",
    clipPrompt: "empire waist regency dress with square neckline and puff sleeves",
    config: {
      category: "dress",
      dressSubStyle: "dress",
      skirtSubStyle: "semicircular",
      necklineStyle: "square",
      sleeveStyle: "short",
      extras: {
        wrapFront: false,
        flaredSleeve: true,
        waistTie: false,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "midi",
      styleVariant: "empire_cut",
      fabricType: "woven",
    },
  },
  {
    id: "shirt_dress",
    name: "Vestido Camisero",
    shortTag: "Cuello camisero • Botones • Lazo",
    fabricTip: "Perfecto en popelina, lino, chambray o algodón camisero",
    clipPrompt: "button down collared shirt dress with belt at the waist",
    config: {
      category: "dress",
      dressSubStyle: "dress",
      skirtSubStyle: "a_line",
      necklineStyle: "high",
      sleeveStyle: "short",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: true,
        hemRuffle: false,
        sidePockets: true,
      },
      quickLength: "knee",
      styleVariant: "shirt_dress",
      fabricType: "woven",
    },
  },
  {
    id: "boho_ruffle_dress",
    name: "Vestido Boho con Boleros",
    shortTag: "Escote V • Bolero inferior • Manga ancha",
    fabricTip: "Luce hermoso en viscosa estampada, bambula o chiffon",
    clipPrompt: "boho summer dress with ruffle hem flounce and wide flutter sleeves",
    config: {
      category: "dress",
      dressSubStyle: "dress",
      skirtSubStyle: "a_line",
      necklineStyle: "v_neck",
      sleeveStyle: "short",
      extras: {
        wrapFront: false,
        flaredSleeve: true,
        waistTie: false,
        hemRuffle: true,
        sidePockets: false,
      },
      quickLength: "midi",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "summer_two_piece",
    name: "Conjunto Veraniego (Crop Top + Falda)",
    shortTag: "Top corto • Falda larga • Pretina",
    fabricTip: "Genial en lino fresco, rayón, algodón o seda fría",
    clipPrompt: "two piece summer outfit with crop top and long flowing maxi skirt",
    config: {
      category: "two_piece",
      twoPieceTopStyle: "crop_top",
      twoPieceBottomStyle: "long_skirt",
      necklineStyle: "square",
      sleeveStyle: "sleeveless",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "maxi",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "tailored_two_piece",
    name: "Conjunto Sastre (Blusa + Palazzo)",
    shortTag: "Blusa cintura • Pantalón ancho • Pretina",
    fabricTip: "Recomendado en crepé, gabardina suave, lino sastre o drill",
    clipPrompt: "tailored two piece outfit with blouse and wide leg palazzo trousers",
    config: {
      category: "two_piece",
      twoPieceTopStyle: "waist_blouse",
      twoPieceBottomStyle: "pants",
      pantsSubStyle: "wide",
      necklineStyle: "v_neck",
      sleeveStyle: "short",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: true,
      },
      quickLength: "maxi",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "peasant_blouse",
    name: "Blusa Campesina / Hombros Descubiertos",
    shortTag: "Escote recto amplio • Manga con volumen",
    fabricTip: "Muy cómoda en popelina delgada, broderie, gasa o rayón",
    clipPrompt: "off shoulder peasant blouse top with wide neckline and puff sleeves",
    config: {
      category: "top",
      topSubStyle: "blouse",
      necklineStyle: "square",
      sleeveStyle: "short",
      extras: {
        wrapFront: false,
        flaredSleeve: true,
        waistTie: false,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "photo",
      styleVariant: "peasant_offshoulder",
      fabricType: "woven",
    },
  },
  {
    id: "office_blouse",
    name: "Blusa Básica de Oficina",
    shortTag: "Escote redondo • Pinza de busto",
    fabricTip: "Impecable en seda poliéster, crepé georgette o popelina elástica",
    clipPrompt: "classic office workwear blouse shirt with round neckline",
    config: {
      category: "top",
      topSubStyle: "blouse",
      necklineStyle: "round",
      sleeveStyle: "short",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "photo",
      styleVariant: "office_dart",
      fabricType: "woven",
    },
  },
  {
    id: "circle_skirt",
    name: "Falda Circular / Plato",
    shortTag: "Semicircular con vuelo • Pretina",
    fabricTip: "Hermosa caída en chalis, gabardina liviana, tafetán o tul forrado",
    clipPrompt: "flared pleated full circle skater midi skirt",
    config: {
      category: "skirt",
      skirtSubStyle: "semicircular",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "knee",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "pencil_skirt",
    name: "Falda Lápiz / Tubo",
    shortTag: "Recta entallada • Pretina",
    fabricTip: "Ideal en bengalina, punto roma, gabardina con elastano o paño",
    clipPrompt: "fitted straight knee length office pencil skirt",
    config: {
      category: "skirt",
      skirtSubStyle: "straight",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: false,
      },
      quickLength: "knee",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "palazzo_pants",
    name: "Pantalón Palazzo / Pierna Ancha",
    shortTag: "Tiro alto • Bota ancha • Bolsillos",
    fabricTip: "Espectacular en crepé fluido, lino pesado, viscosa o seda fría",
    clipPrompt: "high waisted wide leg palazzo dress pants trousers",
    config: {
      category: "pants",
      pantsSubStyle: "wide",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: true,
      },
      quickLength: "maxi",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
  {
    id: "high_waist_shorts",
    name: "Short Casual de Cintura Alta",
    shortTag: "Corto • Pretina • Bolsillos laterales",
    fabricTip: "Resistente y fresco en drill, denim liviano, lino o gabardina",
    clipPrompt: "casual high waisted denim or linen summer shorts",
    config: {
      category: "pants",
      pantsSubStyle: "shorts",
      extras: {
        wrapFront: false,
        flaredSleeve: false,
        waistTie: false,
        hemRuffle: false,
        sidePockets: true,
      },
      quickLength: "mini",
      styleVariant: "default",
      fabricType: "woven",
    },
  },
];
