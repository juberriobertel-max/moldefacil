import { z } from "zod";
import type { ConfigMoldeSerializado } from "./types";

/**
 * Claves de medidas corporales sensibles que JAMÁS deben almacenarse o publicarse
 * dentro de `config_molde` por defecto.
 */
export const CLAVES_MEDIDAS_PROHIBIDAS = [
  "bust",
  "waist",
  "hip",
  "backWidth",
  "bodiceLength",
  "sleeveLength",
  "skirtLength",
  "crotchDepth",
  "thigh",
  "inseam",
  "hemWidth",
  "headCircumference",
  "measurements",
  "medidas",
  "busto",
  "cintura",
  "cadera",
] as const;

const SET_CLAVES_PROHIBIDAS = new Set<string>(CLAVES_MEDIDAS_PROHIBIDAS);

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Revisa recursivamente si un objeto o arreglo contiene claves de medidas corporales prohibidas.
 */
export function tieneClavesDeMedidasProhibidas(valor: unknown): boolean {
  if (Array.isArray(valor)) {
    return valor.some((item) => tieneClavesDeMedidasProhibidas(item));
  }
  if (!esObjetoPlano(valor)) {
    return false;
  }

  for (const [clave, hijo] of Object.entries(valor)) {
    if (SET_CLAVES_PROHIBIDAS.has(clave)) {
      return true;
    }
    if (tieneClavesDeMedidasProhibidas(hijo)) {
      return true;
    }
  }
  return false;
}

/**
 * Elimina de manera recursiva cualquier clave de medidas corporales de un objeto JSON
 * recibido del cliente antes de validarlo con `ConfigMoldeSerializadoSchema`.
 */
export function sanitizarConfigMoldeSinMedidas(
  input: Record<string, unknown>
): Record<string, unknown> {
  const limpiar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) {
      return valor.map((item) => limpiar(item));
    }
    if (!esObjetoPlano(valor)) {
      return valor;
    }
    const limpio: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (SET_CLAVES_PROHIBIDAS.has(k)) continue;
      limpio[k] = limpiar(v);
    }
    return limpio;
  };

  const resultado = limpiar(input);
  return esObjetoPlano(resultado) ? resultado : {};
}

export const GarmentExtrasSchema = z.strictObject({
  wrapFront: z.boolean(),
  flaredSleeve: z.boolean(),
  waistTie: z.boolean(),
  hemRuffle: z.boolean(),
  sidePockets: z.boolean(),
  flapPockets: z.boolean(),
});

export const AparienciaMoldePublico3DSchema = z.strictObject({
  tela: z.enum(["seda", "crepe", "lino", "licra"]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido"),
  estampado: z.enum(["liso", "lunares", "rayas", "vichy"]),
  colorSecundario: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color secundario hexadecimal inválido")
    .optional(),
  acabadoManiqui: z.enum(["lino", "grafito", "madera"]).optional(),
});

export const ConfigMoldeSerializadoSchema = z
  .strictObject({
    version_config: z.literal(1),
    category: z.enum([
      "top",
      "pants",
      "skirt",
      "dress",
      "two_piece",
      "jumpsuit",
      "kids",
      "loungewear",
      "accessories",
    ]),
    topSubStyle: z.enum(["tshirt", "blouse", "jacket"]).optional(),
    pantsSubStyle: z.enum(["straight", "wide", "shorts"]).optional(),
    skirtSubStyle: z.enum(["straight", "a_line", "semicircular"]).optional(),
    dressSubStyle: z.enum(["dress", "jumpsuit"]).optional(),
    twoPieceTopStyle: z
      .enum(["crop_top", "waist_blouse", "jacket_blazer"])
      .optional(),
    twoPieceBottomStyle: z
      .enum(["straight_skirt", "aline_skirt", "long_skirt", "pants"])
      .optional(),
    jumpsuitSubStyle: z
      .enum(["romper_long", "romper_short", "overall"])
      .optional(),
    kidsSubStyle: z
      .enum(["baby_bodysuit", "kids_dress", "kids_pants"])
      .optional(),
    loungewearSubStyle: z.enum(["leggings", "classic_pajama"]).optional(),
    accessorySubStyle: z
      .enum(["bucket_hat", "apron", "zipper_pouch"])
      .optional(),
    necklineStyle: z.enum([
      "round",
      "v_neck",
      "square",
      "high",
      "tailored_lapel",
      "shirt_collar",
    ]),
    sleeveStyle: z.enum(["sleeveless", "short", "long", "kimono"]),
    torsoFit: z.enum(["fitted", "loose"]),
    seamAllowance: z.union([z.literal(0), z.literal(1), z.literal(1.5)]),
    fabricType: z.enum(["woven", "stretch"]),
    extras: GarmentExtrasSchema,
    quickLength: z.enum(["photo", "mini", "knee", "midi", "maxi"]),
    styleVariant: z.enum([
      "default",
      "empire_cut",
      "shirt_dress",
      "peasant_offshoulder",
      "office_dart",
    ]),
    apariencia3D: AparienciaMoldePublico3DSchema.optional(),
  })
  .refine((cfg) => !tieneClavesDeMedidasProhibidas(cfg), {
    message:
      "La configuración del molde público no puede contener medidas corporales.",
  });

export type ConfigMoldeValidada = z.infer<typeof ConfigMoldeSerializadoSchema> &
  ConfigMoldeSerializado;

export const PerfilModistaInputSchema = z.object({
  nombre_publico: z
    .string()
    .trim()
    .min(2, "Escribe un nombre de al menos 2 caracteres.")
    .max(80, "El nombre no debe superar los 80 caracteres."),
  usuario_unico: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "El usuario solo admite minúsculas, números y guion bajo (3 a 30 caracteres)."
    ),
  ciudad_pais: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(320).default(""),
  especialidades: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
  nivel: z.enum(["aprendiz", "intermedia", "profesional"]),
  vende_por_encargo: z.boolean().default(false),
  mostrar_contacto: z.boolean().default(false),
  enlace_whatsapp: z.string().trim().max(200).optional(),
  enlace_instagram: z.string().trim().max(200).optional(),
  visibilidad_perfil: z.enum(["publico", "solo_registradas"]).default("publico"),
  permiso_comentarios: z.enum(["todas", "seguidoras", "nadie"]).default("todas"),
  resumen_semanal_correo: z.boolean().default(false),
});

export const FotoPublicacionInputSchema = z.object({
  url: z.string().trim().min(1, "La URL de la foto es obligatoria."),
  alt: z
    .string()
    .trim()
    .min(5, "Describe la imagen brevemente (mínimo 5 caracteres) para accesibilidad.")
    .max(220, "El texto alternativo no debe superar 220 caracteres."),
  orden: z.number().int().min(0).max(5),
  ancho: z.number().int().min(100).max(4000),
  alto: z.number().int().min(100).max(4000),
  hash_perceptual: z.string().trim().max(128).optional(),
  exif_limpio: z.literal(true, {
    error: "La foto debe haber pasado por limpieza de metadatos EXIF/GPS.",
  }),
});

export const CrearPublicacionSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(4, "Escribe un título claro de al menos 4 caracteres.")
    .max(140, "El título es demasiado largo (máximo 140 caracteres)."),
  descripcion: z.string().trim().max(2000).default(""),
  aprendizaje_nota: z
    .string()
    .trim()
    .min(5, "Cuéntanos qué aprendiste o qué cambiarías (mínimo 5 caracteres).")
    .max(1000),
  prenda: z.string().trim().min(2).max(60),
  tela: z.string().trim().min(2).max(80),
  dificultad: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  tiempo_horas: z.number().positive().max(500),
  costo_aprox: z.string().trim().max(60).optional(),
  config_molde: ConfigMoldeSerializadoSchema,
  captura_3d_url: z.string().trim().max(500).optional(),
  permiso_fotos_confirmado: z.literal(true, {
    error: "Debes confirmar que tienes permiso para compartir las fotos.",
  }),
  reto_id: z.string().uuid().optional(),
  fotos: z
    .array(FotoPublicacionInputSchema)
    .min(1, "Sube al menos 1 foto de tu prenda.")
    .max(6, "Máximo 6 fotos por publicación."),
});

export const CrearComentarioSchema = z.object({
  publicacion_id: z.string().uuid(),
  padre_id: z.string().uuid().nullable().optional(),
  contenido: z
    .string()
    .trim()
    .min(2, "Escribe un comentario válido.")
    .max(1000, "Máximo 1000 caracteres."),
  menciones: z.array(z.string().trim().min(3).max(30)).max(10).default([]),
});

export const CrearPreguntaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(8, "Resume tu duda en al menos 8 caracteres.")
    .max(160),
  detalle: z
    .string()
    .trim()
    .min(15, "Da un poco más de detalle sobre tela o paso donde tienes la duda.")
    .max(3000),
  categoria: z.enum([
    "medidas",
    "ajustes_molde",
    "telas",
    "costura_acabados",
    "imprimir_armar",
    "negocio_precios",
  ]),
  foto_url: z.string().trim().max(500).optional(),
  foto_alt: z.string().trim().min(5).max(220).optional(),
  molde_referencia: z.string().trim().max(120).optional(),
  config_molde: ConfigMoldeSerializadoSchema.optional(),
  etiquetas: z.array(z.string().trim().min(2).max(40)).max(6).default([]),
});

export const CrearRespuestaSchema = z.object({
  pregunta_id: z.string().uuid(),
  contenido: z.string().trim().min(10).max(3000),
  foto_url: z.string().trim().max(500).optional(),
  foto_alt: z.string().trim().min(5).max(220).optional(),
});

export const CrearReporteSchema = z.object({
  objeto_tipo: z.enum(["publicacion", "comentario", "pregunta", "respuesta"]),
  objeto_id: z.string().uuid(),
  motivo: z.enum([
    "spam",
    "falta_respeto",
    "fotos_sin_permiso",
    "contenido_sexual",
    "menores_identificables",
    "derechos_autor",
    "otro",
  ]),
  detalle: z.string().trim().max(600).optional(),
});
