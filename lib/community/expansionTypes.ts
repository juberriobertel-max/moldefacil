import type { ConfigMoldeSerializado } from "./types";
import type { MapaFeatureFlags } from "./featureFlags";

export type PercepcionZonaCalce = "pequeno" | "perfecto" | "grande";
export type ZonaAjusteMolde =
  | "sisa"
  | "espalda"
  | "tiro"
  | "busto"
  | "cintura"
  | "cadera"
  | "largo";

export interface RetroalimentacionCalce {
  id: string;
  autora_id: string;
  molde_categoria: string;
  version_config: number;
  rango_busto_5cm: string;
  rango_cintura_5cm: string;
  rango_cadera_5cm: string;
  tela_usada: string;
  ajuste_talle: PercepcionZonaCalce;
  ajuste_busto: PercepcionZonaCalce;
  ajuste_cintura: PercepcionZonaCalce;
  ajuste_cadera: PercepcionZonaCalce;
  ajuste_hombros: PercepcionZonaCalce;
  ajuste_manga: PercepcionZonaCalce;
  volveria_hacer: boolean;
  es_probadora_beta: boolean;
  es_demo: boolean;
  creado_en: string;
}

export interface NovedadMolde {
  id: string;
  molde_categoria: string;
  version_nueva: number;
  titulo: string;
  resumen: string;
  es_demo: boolean;
  creado_en: string;
}

export interface AjusteMoldeComunidad {
  id: string;
  autora_id: string;
  molde_categoria: string;
  version_config: number;
  rango_busto_5cm: string;
  zona: ZonaAjusteMolde;
  cm_delta: number;
  descripcion_corta: string;
  conteo_me_funciono: number;
  usuarios_que_confirmaron: string[];
  estado_editorial: "pendiente" | "destacado" | "en_blog";
  slug_blog?: string;
  es_demo: boolean;
  creado_en: string;
}

export type EtapaBitacoraNombre =
  | "molde"
  | "corte"
  | "prueba"
  | "costura"
  | "terminada";

export interface EtapaBitacora {
  id: string;
  nombre: EtapaBitacoraNombre;
  nota: string;
  fotoUrl?: string;
  altFoto?: string;
  creado_en: string;
}

export interface BitacoraProyecto {
  id: string;
  autora_id: string;
  titulo: string;
  prenda: string;
  tela: string;
  molde_categoria: string;
  etapa_actual: EtapaBitacoraNombre;
  etapas: EtapaBitacora[];
  publicacion_graduada_id?: string;
  pregunta_ayuda_id?: string;
  es_demo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface ObraPortafolioModista {
  id: string;
  titulo: string;
  prenda: string;
  tela: string;
  fotoUrl: string;
  alt: string;
  tiempo_entrega_dias: number;
}

export interface PerfilProfesionalExtra {
  usuaria_id: string;
  portafolio: ObraPortafolioModista[];
  servicios: string[];
  tiempo_respuesta_horas: number;
  ciudad_pais: string;
  verificada_manual: boolean;
  nota_verificacion: string;
  acepta_mentoria: boolean;
  max_aprendices: number;
}

export type EstadoEncargo =
  | "enviada"
  | "aceptada"
  | "rechazada"
  | "en_proceso"
  | "entregada"
  | "cancelada";

export interface MensajeEncargo {
  id: string;
  autora_id: string;
  contenido: string;
  creado_en: string;
}

export interface RegistroAuditoriaMedida {
  id: string;
  encargo_id: string;
  visor_id: string;
  accion: string;
  creado_en: string;
}

export interface EncargoModista {
  id: string;
  clienta_id: string;
  modista_id: string;
  titulo_prenda: string;
  config_molde: ConfigMoldeSerializado;
  captura_3d_url?: string;
  tela_color_deseado: string;
  notas_clienta: string;
  estado: EstadoEncargo;
  medidas_compartidas: boolean;
  medidas_snapshot?: Record<string, number>;
  consentimiento_expira_en?: string;
  consentimiento_revocado_en?: string;
  mensajes: MensajeEncargo[];
  resena?: {
    calificacion: 1 | 2 | 3 | 4 | 5;
    comentario: string;
    creado_en: string;
  };
  es_demo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface CirculoCostura {
  id: string;
  nombre: string;
  tema_o_ciudad: string;
  nivel_sugerido: "aprendiz" | "intermedia" | "profesional" | "todas";
  tipo_acceso: "abierto" | "con_solicitud";
  anfitriona_id: string;
  miembros_ids: string[];
  pendientes_ids: string[];
  publicaciones_privadas: Array<{
    id: string;
    autora_id: string;
    contenido: string;
    creado_en: string;
  }>;
  archivado_por_inactividad: boolean;
  ultima_actividad_en: string;
  es_demo: boolean;
  creado_en: string;
}

export interface SolicitudMentoria {
  id: string;
  aprendiz_id: string;
  mentora_id: string | null;
  tema_concreto: string;
  estado: "abierta" | "asignada" | "reenviada" | "cerrada";
  mensajes: Array<{
    id: string;
    autora_id: string;
    contenido: string;
    creado_en: string;
  }>;
  agradecimiento_me_ayudo: boolean;
  vence_sin_respuesta_en: string;
  es_demo: boolean;
  creado_en: string;
}

export interface RutaAprendizaje {
  id: string;
  titulo: string;
  descripcion: string;
  duracion_estimada: string;
  molde_recomendado: string;
  insignia_completada: string;
  pasos: Array<{
    id: string;
    titulo: string;
    detalle: string;
    enlace?: string;
  }>;
}

export interface EntradaGlosario {
  id: string;
  termino_base: string;
  definicion_clara: string;
  variantes: Record<string, string>;
  aprobado: boolean;
  sugerido_por?: string;
  es_demo: boolean;
}

export interface ResenaProveedor {
  id: string;
  proveedor_id: string;
  autora_id: string;
  calificacion: 1 | 2 | 3 | 4 | 5;
  comentario: string;
  tiene_relacion_negocio: boolean;
  respuesta_dueno?: string;
  marcada_revision: boolean;
  razon_revision?: string;
  es_demo: boolean;
  creado_en: string;
}

export interface ProveedorTela {
  id: string;
  nombre: string;
  ciudad_pais: string;
  categoria: string;
  descripcion: string;
  es_demo: boolean;
}

export interface EstadoAmpliacionComunidad {
  featureFlags: MapaFeatureFlags;
  retroalimentaciones: RetroalimentacionCalce[];
  novedadesMolde: NovedadMolde[];
  probadorasBetaIds: string[];
  ajustesMolde: AjusteMoldeComunidad[];
  bitacoras: BitacoraProyecto[];
  perfilesPro: PerfilProfesionalExtra[];
  encargos: EncargoModista[];
  auditoriaMedidas: RegistroAuditoriaMedida[];
  circulos: CirculoCostura[];
  mentorias: SolicitudMentoria[];
  rutas: RutaAprendizaje[];
  progresoRutasPorUsuaria: Record<string, Record<string, string[]>>;
  paisGlosarioPreferido: string;
  glosario: EntradaGlosario[];
  proveedores: ProveedorTela[];
  resenasProveedores: ResenaProveedor[];
  modoAhorroDatosManual: boolean;
}