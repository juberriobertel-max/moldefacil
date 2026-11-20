import type {
  AccessorySubStyle,
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  JumpsuitSubStyle,
  KidsSubStyle,
  LoungewearSubStyle,
  NecklineStyle,
  PantsSubStyle,
  QuickLengthPreset,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "../types";
import type { Apariencia } from "../3d/types";
import {
  ConfigMoldeSerializadoSchema,
  sanitizarConfigMoldeSinMedidas,
} from "./schemas";
import type { ConfigMoldeSerializado } from "./types";

export const VERSION_CONFIG_ACTUAL = 1 as const;
const SESSION_DRAFT_KEY = "moldefacil_compartir_creacion_v1";

export interface BorradorCompartirCreacion {
  tituloSugerido: string;
  prendaLabel: string;
  telaLabel: string;
  captura3dUrl?: string;
  config_molde: ConfigMoldeSerializado;
  creadoEn: string;
}

const ETIQUETAS_CATEGORIA: Record<GarmentCategory, string> = {
  dress: "Vestido",
  top: "Blusa / Top",
  skirt: "Falda",
  pants: "Pantalón",
  two_piece: "Conjunto 2 Piezas",
  jumpsuit: "Enterizos y Overoles",
  kids: "Infantil y Bebé",
  loungewear: "Deportivo y Pijamas",
  accessories: "Accesorios Textiles",
};

const ETIQUETAS_TELA_3D: Record<Apariencia["tela"], string> = {
  crepe: "Crepé / Viscosa",
  lino: "Lino / Gabardina",
  seda: "Seda / Satén",
  licra: "Licra / Punto",
};

export interface EntradaGeneradorParaConfig {
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
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  extras: GarmentExtras;
  quickLength: QuickLengthPreset;
  styleVariant: StyleVariant;
  apariencia3D?: Apariencia;
}

/**
 * Empaqueta la configuración del generador y la apariencia 3D excluyendo
 * por construcción cualquier medida corporal sensible.
 */
export function construirConfigMoldeDesdeGenerador(
  input: EntradaGeneradorParaConfig
): ConfigMoldeSerializado {
  const crudo: Record<string, unknown> = {
    version_config: VERSION_CONFIG_ACTUAL,
    category: input.category,
    topSubStyle: input.category === "top" ? input.topSubStyle : undefined,
    pantsSubStyle:
      input.category === "pants" ||
      (input.category === "two_piece" && input.twoPieceBottomStyle === "pants")
        ? input.pantsSubStyle
        : undefined,
    skirtSubStyle:
      input.category === "skirt" || input.category === "dress"
        ? input.skirtSubStyle
        : undefined,
    dressSubStyle: input.category === "dress" ? input.dressSubStyle : undefined,
    twoPieceTopStyle:
      input.category === "two_piece" ? input.twoPieceTopStyle : undefined,
    twoPieceBottomStyle:
      input.category === "two_piece" ? input.twoPieceBottomStyle : undefined,
    jumpsuitSubStyle:
      input.category === "jumpsuit" ? input.jumpsuitSubStyle : undefined,
    kidsSubStyle: input.category === "kids" ? input.kidsSubStyle : undefined,
    loungewearSubStyle:
      input.category === "loungewear" ? input.loungewearSubStyle : undefined,
    accessorySubStyle:
      input.category === "accessories" ? input.accessorySubStyle : undefined,
    necklineStyle: input.necklineStyle,
    sleeveStyle: input.sleeveStyle,
    torsoFit: input.torsoFit,
    seamAllowance: input.seamAllowance,
    fabricType: input.fabricType,
    extras: { ...input.extras },
    quickLength: input.quickLength,
    styleVariant: input.styleVariant,
    apariencia3D: input.apariencia3D
      ? {
          tela: input.apariencia3D.tela,
          color: input.apariencia3D.color,
          estampado: input.apariencia3D.estampado,
          ...(input.apariencia3D.colorSecundario
            ? { colorSecundario: input.apariencia3D.colorSecundario }
            : {}),
          ...(input.apariencia3D.acabadoManiqui
            ? { acabadoManiqui: input.apariencia3D.acabadoManiqui }
            : {}),
        }
      : undefined,
  };

  const sinMedidas = sanitizarConfigMoldeSinMedidas(crudo);
  return ConfigMoldeSerializadoSchema.parse(sinMedidas);
}

function bytesABase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binario)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlABytes(token: string): Uint8Array {
  const norm = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  if (typeof atob === "function") {
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(pad, "base64"));
}

/**
 * Serializa una configuración de molde validada (sin medidas) en un token compacto URL-safe.
 */
export function codificarConfigMoldeParaUrl(
  cfg: ConfigMoldeSerializado
): string {
  const validada = ConfigMoldeSerializadoSchema.parse(cfg);
  const json = JSON.stringify(validada);
  const bytes = new TextEncoder().encode(json);
  return bytesABase64Url(bytes);
}

/**
 * Decodifica un token `?molde_comunidad=...`, verifica versión compatible
 * y bloquea cualquier clave de medidas corporales que pudiera venir inyectada.
 */
export function decodificarConfigMoldeDesdeUrl(token: string): {
  ok: boolean;
  config?: ConfigMoldeSerializado;
  avisoVersion?: string;
} {
  try {
    const bytes = base64UrlABytes(token);
    const texto = new TextDecoder().decode(bytes);
    const parsedJson = JSON.parse(texto) as unknown;
    if (
      typeof parsedJson !== "object" ||
      parsedJson === null ||
      Array.isArray(parsedJson)
    ) {
      return {
        ok: false,
        avisoVersion: "El enlace de molde no tiene un formato válido.",
      };
    }

    const record = parsedJson as Record<string, unknown>;
    const version = Number(record.version_config ?? 1);
    if (version !== VERSION_CONFIG_ACTUAL) {
      return {
        ok: false,
        avisoVersion: `Este molde pertenece a una versión anterior o futura (v${version}) y requiere ajuste manual.`,
      };
    }

    const limpio = sanitizarConfigMoldeSinMedidas(record);
    const res = ConfigMoldeSerializadoSchema.safeParse(limpio);
    if (!res.success) {
      return {
        ok: false,
        avisoVersion:
          "Algunos parámetros del molde compartido ya no son compatibles.",
      };
    }
    return { ok: true, config: res.data };
  } catch {
    return {
      ok: false,
      avisoVersion: "No se pudo leer la configuración del molde compartido.",
    };
  }
}

export function generarEtiquetasDesdeConfig(cfg: ConfigMoldeSerializado): {
  prendaLabel: string;
  telaLabel: string;
  tituloSugerido: string;
} {
  const prendaLabel =
    cfg.category === "top" && cfg.topSubStyle === "jacket"
      ? "Chaqueta / Blazer"
      : ETIQUETAS_CATEGORIA[cfg.category];
  const telaLabel = cfg.apariencia3D
    ? ETIQUETAS_TELA_3D[cfg.apariencia3D.tela]
    : cfg.fabricType === "stretch"
      ? "Licra / Punto"
      : "Lino / Gabardina";
  const tituloSugerido = `Mi ${prendaLabel.toLowerCase()} confeccionada en ${telaLabel.toLowerCase()}`;
  return { prendaLabel, telaLabel, tituloSugerido };
}

export function guardarBorradorCompartirCreacion(
  borrador: BorradorCompartirCreacion
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(borrador));
  } catch {
    try {
      const compacto: BorradorCompartirCreacion = {
        ...borrador,
        captura3dUrl: undefined,
      };
      window.sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(compacto));
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }
}

export function leerBorradorCompartirCreacion(): BorradorCompartirCreacion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BorradorCompartirCreacion;
    if (!parsed || !parsed.config_molde) return null;
    const limpio = sanitizarConfigMoldeSinMedidas(
      parsed.config_molde as unknown as Record<string, unknown>
    );
    const val = ConfigMoldeSerializadoSchema.safeParse(limpio);
    if (!val.success) return null;
    return { ...parsed, config_molde: val.data };
  } catch {
    return null;
  }
}

export function limpiarBorradorCompartirCreacion(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
  } catch {
    // Ignorar
  }
}