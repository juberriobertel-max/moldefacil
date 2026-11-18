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
  QuickLengthPreset,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "../types";
import { resolveQuickLength } from "../garmentEngines/extrasEngine";

/** Factor único de conversión métrica para toda la escena 3D (1 unidad 3D = 1 metro). */
export const CM_POR_METRO = 100;

/** Convierte centímetros a unidades 3D (metros). Único punto de conversión del estudio 3D. */
export function cmAMetros(cm: number): number {
  return cm / CM_POR_METRO;
}

export type Medidas = {
  busto: number;
  cintura: number;
  cadera: number;
  anchoEspalda: number;
  largoTalle: number;
  alturaTiro: number;
  alturaTotal?: number;
  contornoCabeza?: number;
  largoManga?: number;
  contornoMuslo?: number;
  largoEntrepierna?: number;
  anchoBota?: number;
};

export type TipoPrenda =
  | "vestido"
  | "blusa"
  | "falda"
  | "pantalon"
  | "chaqueta"
  | "enterizo"
  | "bucketHat";

export type TipoEscote =
  | "wrap"
  | "v"
  | "redondo"
  | "cuadrado"
  | "corazon"
  | "barco"
  | "halter"
  | "solapaSastre"
  | "camisero";

export type TipoManga =
  | "ninguna"
  | "kimono"
  | "cortaPegada"
  | "largaPegada"
  | "acampanada"
  | "farol";

export type TipoSilueta = "entallado" | "holgado";
export type TipoVuelo = "recta" | "evase" | "circular";
export type TipoPantalon = "recto" | "palazzo" | "legging";

export type ConfigPrenda = {
  prenda: TipoPrenda;
  escote: TipoEscote;
  manga: TipoManga;
  silueta: TipoSilueta;
  cinturon: boolean;
  vuelo: TipoVuelo;
  bolero: boolean;
  pantalon: TipoPantalon;
  largoDeseado: number; // cm
  /** Metadata adicional para fidelidad 2D -> 3D sin romper el contrato base */
  esDosPiezas?: boolean;
  dosPiezasArriba?: TwoPieceTopStyle;
  dosPiezasAbajo?: TwoPieceBottomStyle;
  escoteCerrado?: boolean;
  corteImperio?: boolean;
  esShort?: boolean;
  esInfantil?: boolean;
};

export type TipoTela = "seda" | "crepe" | "lino" | "licra";
export type TipoEstampado = "liso" | "lunares" | "rayas" | "vichy";

export type Apariencia = {
  tela: TipoTela;
  color: string;
  estampado: TipoEstampado;
  mostrarCosturas: boolean;
};

export interface ColorRapido {
  nombre: string;
  hex: string;
}

export const COLORES_RAPIDOS: readonly ColorRapido[] = [
  { nombre: "Azul Marino", hex: "#1F2A44" },
  { nombre: "Terracota", hex: "#C85A32" },
  { nombre: "Verde Esmeralda", hex: "#0F7B5F" },
  { nombre: "Negro", hex: "#1A1A1A" },
  { nombre: "Marfil", hex: "#F3EBDD" },
  { nombre: "Vino", hex: "#6E1F34" },
  { nombre: "Rosa Palo", hex: "#E8C4C0" },
] as const;

export const PALETA_UI_3D = {
  crema: "#FAF6F0",
  terracota: "#C85A32",
  salvia: "#3B7A57",
} as const;

export const APARIENCIA_POR_DEFECTO: Apariencia = {
  tela: "crepe",
  color: "#C85A32",
  estampado: "liso",
  mostrarCosturas: false,
};

export type NombreSeccionAnatomica =
  | "cuello"
  | "hombros"
  | "busto"
  | "bajoBusto"
  | "cintura"
  | "caderaAlta"
  | "cadera"
  | "muslo";

export interface AnilloPerfil {
  /** Altura vertical desde el suelo en unidades 3D (metros). */
  y: number;
  /** Semieje horizontal X (medio ancho) en unidades 3D (metros). */
  a: number;
  /** Semieje de profundidad Z (media profundidad) en unidades 3D (metros). */
  b: number;
  /** Desplazamiento anteroposterior en Z (+ adelante busto, - atrás glúteo) en metros. */
  desplazamientoZ: number;
  /** Perímetro objetivo teórico en cm (trazabilidad / pruebas). */
  perimetroObjetivoCm: number;
  /** Etiqueta de sección clave si coincide exactamente con un nivel anatómico. */
  seccion?: NombreSeccionAnatomica;
}

export interface PerfilCuerpo {
  anillosClave: Record<NombreSeccionAnatomica, AnilloPerfil>;
  anillosInterpolados: AnilloPerfil[];
  segmentosRadiales: number;
  alturaTotalM: number;
  alturaTiroM: number;
  alturaRodillaM: number;
  alturaTobilloM: number;
  hombroYM: number;
  cuelloYM: number;
  bustoYM: number;
  cinturaYM: number;
  caderaYM: number;
  musloYM: number;
  contornoCabezaM: number;
  largoMangaM: number;
  contornoMusloM: number;
  anchoBotaM: number;
}

export type NivelDetalle3D = "movil" | "escritorio";

export interface Etiqueta3DAncla {
  id: string;
  texto: "Delantero" | "Trasero" | "Vista 4 cm" | "Pinza" | "Cinturón";
  posicionLocalM: [number, number, number];
  normalLocal: [number, number, number];
}

export interface EstadoDelMoldePara3D {
  category: GarmentCategory;
  topSubStyle: TopSubStyle;
  pantsSubStyle: PantsSubStyle;
  skirtSubStyle: SkirtSubStyle;
  dressSubStyle: DressSubStyle;
  twoPieceTopStyle: TwoPieceTopStyle;
  twoPieceBottomStyle: TwoPieceBottomStyle;
  jumpsuitSubStyle: JumpsuitSubStyle;
  kidsSubStyle: KidsSubStyle;
  loungewearSubStyle: LoungewearSubStyle;
  accessorySubStyle: AccessorySubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  torsoFit: TorsoFit;
  extras: GarmentExtras;
  quickLength: QuickLengthPreset;
  styleVariant: StyleVariant;
  measurements: Measurements;
  fabricType: FabricType;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Deriva la estatura total estándar cuando no existe en `Measurements`
 * (adulta estándar: 165 cm; infantil proporcional al largo de talle / busto).
 */
export function derivarAlturaTotalCm(
  measurements: Measurements,
  category?: GarmentCategory
): number {
  const esInfantil = category === "kids" || measurements.bust < 72;
  if (esInfantil) {
    return clamp(Math.round(measurements.bodiceLength * 3.9), 85, 148);
  }
  return 165;
}

/**
 * Convierte las medidas reales del repositorio (`Measurements`) al contrato 3D (`Medidas`).
 */
export function toMedidas3D(
  measurements: Measurements,
  category?: GarmentCategory
): Medidas {
  return {
    busto: measurements.bust,
    cintura: measurements.waist,
    cadera: measurements.hip,
    anchoEspalda: measurements.backWidth,
    largoTalle: measurements.bodiceLength,
    alturaTiro: measurements.crotchDepth,
    alturaTotal: derivarAlturaTotalCm(measurements, category),
    contornoCabeza: measurements.headCircumference ?? 57,
    largoManga: measurements.sleeveLength,
    contornoMuslo: measurements.thigh,
    largoEntrepierna: measurements.inseam,
    anchoBota: measurements.hemWidth,
  };
}

function mapearEscote(
  necklineStyle: NecklineStyle,
  extras: GarmentExtras,
  styleVariant: StyleVariant
): { escote: TipoEscote; cerrado: boolean } {
  if (extras.wrapFront) {
    return { escote: "wrap", cerrado: false };
  }
  if (styleVariant === "shirt_dress") {
    return { escote: "camisero", cerrado: false };
  }
  if (styleVariant === "peasant_offshoulder") {
    return { escote: "barco", cerrado: false };
  }
  switch (necklineStyle) {
    case "v_neck":
      return { escote: "v", cerrado: false };
    case "square":
      return { escote: "cuadrado", cerrado: false };
    case "tailored_lapel":
      return { escote: "solapaSastre", cerrado: false };
    case "shirt_collar":
      return { escote: "camisero", cerrado: false };
    case "high":
      return { escote: "redondo", cerrado: true };
    case "round":
    default:
      return { escote: "redondo", cerrado: false };
  }
}

function mapearManga(
  sleeveStyle: SleeveStyle,
  extras: GarmentExtras
): TipoManga {
  if (sleeveStyle === "sleeveless") return "ninguna";
  if (sleeveStyle === "kimono") return "kimono";
  if (extras.flaredSleeve) return "acampanada";
  if (sleeveStyle === "long") return "largaPegada";
  return "cortaPegada";
}

function mapearPrenda(estado: EstadoDelMoldePara3D): TipoPrenda {
  switch (estado.category) {
    case "top":
      return estado.topSubStyle === "jacket" ? "chaqueta" : "blusa";
    case "skirt":
      return "falda";
    case "pants":
      return "pantalon";
    case "dress":
      return estado.dressSubStyle === "jumpsuit" ? "enterizo" : "vestido";
    case "jumpsuit":
      return "enterizo";
    case "two_piece":
      return estado.twoPieceTopStyle === "jacket_blazer"
        ? "chaqueta"
        : "vestido";
    case "kids":
      if (estado.kidsSubStyle === "kids_pants") return "pantalon";
      return "vestido";
    case "loungewear":
      return estado.loungewearSubStyle === "leggings"
        ? "pantalon"
        : "enterizo";
    case "accessories":
      return estado.accessorySubStyle === "bucket_hat"
        ? "bucketHat"
        : "falda";
  }
}

function mapearVuelo(estado: EstadoDelMoldePara3D): TipoVuelo {
  if (estado.category === "skirt") {
    if (estado.skirtSubStyle === "semicircular") return "circular";
    if (estado.skirtSubStyle === "a_line") return "evase";
    return "recta";
  }
  if (estado.category === "two_piece") {
    if (estado.twoPieceBottomStyle === "long_skirt") return "circular";
    if (estado.twoPieceBottomStyle === "aline_skirt") return "evase";
    return "recta";
  }
  if (estado.category === "dress" || estado.category === "kids") {
    return "evase";
  }
  return "recta";
}

function mapearPantalon(estado: EstadoDelMoldePara3D): TipoPantalon {
  if (
    estado.category === "loungewear" &&
    estado.loungewearSubStyle === "leggings"
  ) {
    return "legging";
  }
  if (estado.category === "pants" && estado.pantsSubStyle === "wide") {
    return "palazzo";
  }
  if (estado.fabricType === "stretch" && estado.measurements.hemWidth <= 30) {
    return "legging";
  }
  return "recto";
}

/**
 * Adapta el estado real del generador 2D (`app/page.tsx`) al contrato `ConfigPrenda`.
 */
export function toConfigPrenda(estado: EstadoDelMoldePara3D): ConfigPrenda {
  const prenda = mapearPrenda(estado);
  const { escote, cerrado } = mapearEscote(
    estado.necklineStyle,
    estado.extras,
    estado.styleVariant
  );
  const manga = mapearManga(estado.sleeveStyle, estado.extras);
  const vuelo = mapearVuelo(estado);
  const pantalon = mapearPantalon(estado);

  const largoResuelto = resolveQuickLength(
    estado.measurements,
    estado.quickLength,
    estado.category
  );

  const esShort =
    (estado.category === "pants" && estado.pantsSubStyle === "shorts") ||
    (estado.category === "jumpsuit" &&
      estado.jumpsuitSubStyle === "romper_short");

  let largoDeseado = largoResuelto.measurements.skirtLength;
  if (prenda === "pantalon" || prenda === "enterizo") {
    largoDeseado = esShort
      ? Math.min(34, Math.max(12, largoResuelto.measurements.inseam * 0.45))
      : largoResuelto.measurements.inseam;
  } else if (prenda === "blusa" || prenda === "chaqueta") {
    const baseTop =
      estado.measurements.bodiceLength +
      (prenda === "chaqueta" ? 20 : 16);
    largoDeseado = Math.round(baseTop * largoResuelto.topScaleForLength);
  } else if (
    estado.category === "two_piece" &&
    estado.twoPieceBottomStyle === "long_skirt" &&
    estado.quickLength === "photo"
  ) {
    largoDeseado = Math.max(largoDeseado, 88);
  }

  return {
    prenda,
    escote,
    manga,
    silueta: estado.torsoFit === "loose" ? "holgado" : "entallado",
    cinturon: estado.extras.waistTie,
    vuelo,
    bolero: estado.extras.hemRuffle,
    pantalon,
    largoDeseado,
    esDosPiezas:
      estado.category === "two_piece" ||
      (estado.category === "loungewear" &&
        estado.loungewearSubStyle === "classic_pajama"),
    dosPiezasArriba:
      estado.category === "two_piece" ? estado.twoPieceTopStyle : undefined,
    dosPiezasAbajo:
      estado.category === "two_piece" ? estado.twoPieceBottomStyle : undefined,
    escoteCerrado: cerrado,
    corteImperio: estado.styleVariant === "empire_cut",
    esShort,
    esInfantil:
      estado.category === "kids" || estado.measurements.bust < 72,
  };
}

export function aparienciaInicialPorTela(
  fabricType: FabricType,
  previa?: Apariencia
): Apariencia {
  if (previa) return previa;
  return {
    ...APARIENCIA_POR_DEFECTO,
    tela: fabricType === "stretch" ? "licra" : "crepe",
  };
}
