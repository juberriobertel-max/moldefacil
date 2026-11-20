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
import type { AcabadoManiqui3D, TipoEstampado, TipoTela } from "../3d/types";

export type RolUsuaria = "usuaria" | "moderadora" | "admin";

export type NivelModista = "aprendiz" | "intermedia" | "profesional";

export type VisibilidadPerfil = "publico" | "solo_registradas";

export type PermisoComentarios = "todas" | "seguidoras" | "nadie";

export type EstadoPublicacion =
  | "borrador"
  | "en_revision"
  | "publicada"
  | "oculta";

export type TipoReaccion = "me_encanta" | "me_sirvio" | "inspirador";

export type ObjetoReaccion = "publicacion" | "respuesta";

export type CategoriaPregunta =
  | "medidas"
  | "ajustes_molde"
  | "telas"
  | "costura_acabados"
  | "imprimir_armar"
  | "negocio_precios";

export type GrupoSelectorEtiqueta =
  | "escote"
  | "manga"
  | "pinzas"
  | "tela"
  | "ajuste"
  | "general";

export type ObjetoReporte =
  | "publicacion"
  | "comentario"
  | "pregunta"
  | "respuesta";

export type MotivoReporte =
  | "spam"
  | "falta_respeto"
  | "fotos_sin_permiso"
  | "contenido_sexual"
  | "menores_identificables"
  | "derechos_autor"
  | "otro";

export type EstadoReporte =
  | "pendiente"
  | "en_revision"
  | "resuelto"
  | "descartado";

export type InsigniaId =
  | "primera_prenda"
  | "fundadora"
  | "ayudo_10_modistas"
  | "participo_reto"
  | "modista_del_mes";

export interface AparienciaMoldePublico3D {
  tela: TipoTela;
  color: string;
  estampado: TipoEstampado;
  colorSecundario?: string;
  acabadoManiqui?: AcabadoManiqui3D;
}

/**
 * Configuración serializada del molde para compartir o remezclar ("Hacer este molde").
 * Nunca incluye medidas corporales (`Measurements`), garantizando privacidad por defecto.
 */
export interface ConfigMoldeSerializado {
  version_config: 1;
  category: GarmentCategory;
  topSubStyle?: TopSubStyle;
  pantsSubStyle?: PantsSubStyle;
  skirtSubStyle?: SkirtSubStyle;
  dressSubStyle?: DressSubStyle;
  twoPieceTopStyle?: TwoPieceTopStyle;
  twoPieceBottomStyle?: TwoPieceBottomStyle;
  jumpsuitSubStyle?: JumpsuitSubStyle;
  kidsSubStyle?: KidsSubStyle;
  loungewearSubStyle?: LoungewearSubStyle;
  accessorySubStyle?: AccessorySubStyle;
  necklineStyle: NecklineStyle;
  sleeveStyle: SleeveStyle;
  torsoFit: TorsoFit;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
  extras: GarmentExtras;
  quickLength: QuickLengthPreset;
  styleVariant: StyleVariant;
  apariencia3D?: AparienciaMoldePublico3D;
}

export interface PerfilModista {
  id: string;
  nombre_publico: string;
  usuario_unico: string;
  rol: RolUsuaria;
  foto?: string;
  ciudad_pais?: string;
  bio: string;
  especialidades: string[];
  nivel: NivelModista;
  vende_por_encargo: boolean;
  mostrar_contacto: boolean;
  enlace_whatsapp?: string;
  enlace_instagram?: string;
  visibilidad_perfil: VisibilidadPerfil;
  permiso_comentarios: PermisoComentarios;
  resumen_semanal_correo: boolean;
  publicaciones_aprobadas_count: number;
  suspendida: boolean;
  es_demo: boolean;
  creado_en: string;
}

export interface FotoPublicacion {
  id: string;
  publicacion_id: string;
  url: string;
  alt: string;
  orden: number;
  ancho: number;
  alto: number;
  hash_perceptual?: string;
  exif_limpio: boolean;
}

export type TipoPublicacion = "molde_plataforma" | "moda_real";

export interface PublicacionComunidad {
  id: string;
  slug: string;
  autora_id: string;
  tipo_publicacion?: TipoPublicacion;
  titulo: string;
  descripcion: string;
  aprendizaje_nota: string;
  prenda: string;
  tela: string;
  dificultad: 1 | 2 | 3 | 4 | 5;
  tiempo_horas: number;
  costo_aprox?: string;
  config_molde?: ConfigMoldeSerializado;
  referencia_inspiracion?: string;
  version_config: number;
  captura_3d_url?: string;
  permiso_fotos_confirmado: true;
  reto_id?: string;
  estado: EstadoPublicacion;
  conteo_reacciones: number;
  conteo_comentarios: number;
  conteo_guardados: number;
  conteo_remixes: number;
  es_demo: boolean;
  creado_en: string;
  fotos: FotoPublicacion[];
}

export interface ComentarioPublicacion {
  id: string;
  publicacion_id: string;
  autora_id: string;
  padre_id?: string | null;
  contenido: string;
  menciones: string[];
  oculto: boolean;
  editado_en?: string;
  creado_en: string;
}

export interface ReaccionRegistro {
  id: string;
  usuaria_id: string;
  objeto_tipo: ObjetoReaccion;
  objeto_id: string;
  tipo: TipoReaccion;
  creado_en: string;
}

export interface GuardadoRegistro {
  id: string;
  usuaria_id: string;
  publicacion_id: string;
  coleccion: string;
  creado_en: string;
}

export interface SeguidorRegistro {
  seguidora_id: string;
  seguida_id: string;
  creado_en: string;
}

export interface EtiquetaSelector {
  id: string;
  nombre: string;
  grupo_selector: GrupoSelectorEtiqueta;
  valor_selector?: string;
}

export interface PreguntaComunidad {
  id: string;
  slug: string;
  autora_id: string;
  titulo: string;
  detalle: string;
  categoria: CategoriaPregunta;
  foto_url?: string;
  foto_alt?: string;
  molde_referencia?: string;
  config_molde?: ConfigMoldeSerializado;
  etiquetas: string[];
  respuesta_aceptada_id?: string;
  resuelta: boolean;
  destacada_semana: boolean;
  articulo_blog_slug?: string;
  conteo_respuestas: number;
  oculto: boolean;
  es_demo: boolean;
  creado_en: string;
}

export interface RespuestaComunidad {
  id: string;
  pregunta_id: string;
  autora_id: string;
  contenido: string;
  foto_url?: string;
  foto_alt?: string;
  es_aceptada: boolean;
  conteo_me_sirvio: number;
  oculto: boolean;
  creado_en: string;
}

export interface RetoMensual {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  reglas: string;
  etiqueta_reto: string;
  guia_blog_slug?: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface ParticipacionReto {
  id: string;
  reto_id: string;
  publicacion_id: string;
  autora_id: string;
  destacada_moderacion: boolean;
  conteo_votos: number;
  creado_en: string;
}

export interface InsigniaCatalogo {
  id: InsigniaId;
  nombre: string;
  descripcion: string;
  icono: string;
}

export interface ReporteModeracion {
  id: string;
  reportante_id: string;
  objeto_tipo: ObjetoReporte;
  objeto_id: string;
  motivo: MotivoReporte;
  detalle?: string;
  estado: EstadoReporte;
  resuelto_por?: string;
  nota_moderacion?: string;
  creado_en: string;
}

export interface BloqueoUsuaria {
  bloqueadora_id: string;
  bloqueada_id: string;
  creado_en: string;
}

export interface NotificacionComunidad {
  id: string;
  usuaria_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace?: string;
  leida: boolean;
  creado_en: string;
}

export interface DescargableComunidad {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  version: string;
  fecha_actualizacion: string;
  url_archivo: string;
  conteo_descargas: number;
}