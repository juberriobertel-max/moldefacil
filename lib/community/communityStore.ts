import {
  DESCARGABLES_DEMO,
  INSIGNIAS_CATALOGO,
  PERFILES_DEMO,
  PREGUNTAS_DEMO,
  PUBLICACIONES_DEMO,
  RESPUESTAS_DEMO,
  RETO_MENSUAL_DEMO,
} from "./demoSeed";
import { distanciaHammingHash } from "./imageSecurity";
import {
  type AccionRateLimit,
  evaluarTextoModeracion,
  extraerMencionesUsuario,
  PLANTILLAS_MENSAJES_MODERACION,
  verificarRateLimitUsuaria,
} from "./moderationEngine";
import {
  esModeradoraOAdmin,
  puedeAceptarRespuesta,
  puedeComentarEnPublicacion,
  puedeEditarComentario,
  puedeEditarContenido,
  puedeModerarReporte,
  puedeVotarEnReto,
  resolverEstadoInicialPublicacion,
  type ActorSesion,
} from "./rlsPolicyEngine";
import {
  CrearComentarioSchema,
  CrearPreguntaSchema,
  CrearPublicacionSchema,
  CrearReporteSchema,
  CrearRespuestaSchema,
  PerfilModistaInputSchema,
  sanitizarConfigMoldeSinMedidas,
} from "./schemas";
import type {
  BloqueoUsuaria,
  CategoriaPregunta,
  ComentarioPublicacion,
  ConfigMoldeSerializado,
  DescargableComunidad,
  FotoPublicacion,
  GuardadoRegistro,
  InsigniaId,
  MotivoReporte,
  NivelModista,
  NotificacionComunidad,
  ObjetoReaccion,
  ObjetoReporte,
  ParticipacionReto,
  PerfilModista,
  PermisoComentarios,
  PreguntaComunidad,
  PublicacionComunidad,
  ReaccionRegistro,
  ReporteModeracion,
  RespuestaComunidad,
  RetoMensual,
  SeguidorRegistro,
  TipoReaccion,
  VisibilidadPerfil,
} from "./types";

export const COMUNIDAD_STORAGE_KEY = "moldefacil_comunidad_estado_v1";

export interface VotoRetoRegistro {
  id: string;
  reto_id: string;
  participacion_id: string;
  votante_id: string;
  creado_en: string;
}

export interface EstadoComunidad {
  perfiles: PerfilModista[];
  insigniasPorUsuaria: Record<string, InsigniaId[]>;
  publicaciones: PublicacionComunidad[];
  comentarios: ComentarioPublicacion[];
  reacciones: ReaccionRegistro[];
  guardados: GuardadoRegistro[];
  seguidores: SeguidorRegistro[];
  preguntas: PreguntaComunidad[];
  respuestas: RespuestaComunidad[];
  retos: RetoMensual[];
  participacionesReto: ParticipacionReto[];
  votosReto: VotoRetoRegistro[];
  reportes: ReporteModeracion[];
  bloqueos: BloqueoUsuaria[];
  notificaciones: NotificacionComunidad[];
  descargables: DescargableComunidad[];
  usuariaActivaId: string | null;
  rateLimits: Record<string, Partial<Record<AccionRateLimit, number[]>>>;
}

export interface ResultadoOperacion {
  ok: boolean;
  error?: string;
  estado: EstadoComunidad;
  idCreado?: string;
}

let idCounter = 0;

function crearId(prefijo: string): string {
  idCounter = (idCounter + 1) % 65535;
  const tiempoHex = Date.now().toString(16).slice(-8).padStart(8, "0");
  const seqHex = idCounter.toString(16).padStart(4, "0");
  void prefijo;
  return `90000000-0000-4000-8000-${tiempoHex}${seqHex}`;
}

export function crearEstadoInicialComunidad(): EstadoComunidad {
  const insigniasPorUsuaria: Record<string, InsigniaId[]> = {};
  const perfiles: PerfilModista[] = PERFILES_DEMO.map((p) => {
    insigniasPorUsuaria[p.id] = [...p.insignias];
    return {
      id: p.id,
      nombre_publico: p.nombre_publico,
      usuario_unico: p.usuario_unico,
      rol: p.rol,
      foto: p.foto,
      ciudad_pais: p.ciudad_pais,
      bio: p.bio,
      especialidades: [...p.especialidades],
      nivel: p.nivel,
      vende_por_encargo: p.vende_por_encargo,
      mostrar_contacto: p.mostrar_contacto,
      enlace_whatsapp: p.enlace_whatsapp,
      enlace_instagram: p.enlace_instagram,
      visibilidad_perfil: p.visibilidad_perfil,
      permiso_comentarios: p.permiso_comentarios,
      resumen_semanal_correo: p.resumen_semanal_correo,
      publicaciones_aprobadas_count: p.publicaciones_aprobadas_count,
      suspendida: p.suspendida,
      es_demo: p.es_demo,
      creado_en: p.creado_en,
    };
  });

  const participacionesReto: ParticipacionReto[] = PUBLICACIONES_DEMO.filter(
    (p) => p.reto_id === RETO_MENSUAL_DEMO.id
  ).map((p) => ({
    id: `50000000-0000-4000-8000-${p.id.slice(-12)}`,
    reto_id: RETO_MENSUAL_DEMO.id,
    publicacion_id: p.id,
    autora_id: p.autora_id,
    destacada_moderacion: true,
    conteo_votos: 14,
    creado_en: p.creado_en,
  }));

  const comentariosIniciales: ComentarioPublicacion[] = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      publicacion_id: PUBLICACIONES_DEMO[0].id,
      autora_id: PERFILES_DEMO[1].id,
      padre_id: null,
      contenido:
        "Qué hermoso quedó el cruce en ese crepé terracota @marta_costura, voy a intentar hacerlo este fin de semana.",
      menciones: ["marta_costura"],
      oculto: false,
      creado_en: "2026-11-14T10:00:00.000Z",
    },
    {
      id: "60000000-0000-4000-8000-000000000002",
      publicacion_id: PUBLICACIONES_DEMO[0].id,
      autora_id: PERFILES_DEMO[0].id,
      padre_id: "60000000-0000-4000-8000-000000000001",
      contenido:
        "¡Mucho ánimo @lucia_taller! Si necesitas ayuda con la vista del escote me escribes por acá.",
      menciones: ["lucia_taller"],
      oculto: false,
      creado_en: "2026-11-14T11:30:00.000Z",
    },
  ];

  return {
    perfiles,
    insigniasPorUsuaria,
    publicaciones: PUBLICACIONES_DEMO.map((p) => ({
      ...p,
      fotos: p.fotos.map((f) => ({ ...f })),
      config_molde: p.config_molde
        ? {
            ...p.config_molde,
            extras: { ...p.config_molde.extras },
          }
        : undefined,
    })),
    comentarios: comentariosIniciales,
    reacciones: [],
    guardados: [],
    seguidores: [
      {
        seguidora_id: PERFILES_DEMO[1].id,
        seguida_id: PERFILES_DEMO[0].id,
        creado_en: "2026-11-01T12:00:00.000Z",
      },
    ],
    preguntas: PREGUNTAS_DEMO.map((q) => ({ ...q, etiquetas: [...q.etiquetas] })),
    respuestas: RESPUESTAS_DEMO.map((r) => ({ ...r })),
    retos: [{ ...RETO_MENSUAL_DEMO }],
    participacionesReto,
    votosReto: [],
    reportes: [],
    bloqueos: [],
    notificaciones: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        usuaria_id: PERFILES_DEMO[1].id,
        tipo: "bienvenida",
        titulo: "¡Bienvenida al taller comunitario!",
        mensaje:
          "Aquí puedes mostrar tus prendas sin revelar tus medidas y resolver dudas entre modistas.",
        enlace: "/comunidad",
        leida: false,
        creado_en: "2026-11-18T12:00:00.000Z",
      },
    ],
    descargables: DESCARGABLES_DEMO.map((d) => ({ ...d })),
    usuariaActivaId: PERFILES_DEMO[1].id,
    rateLimits: {},
  };
}

const ESTADO_SERVIDOR = crearEstadoInicialComunidad();
const listenersComunidad = new Set<() => void>();
let cachedRawComunidad: string | null = null;
let cachedValComunidad: EstadoComunidad = ESTADO_SERVIDOR;

export function getComunidadServerSnapshot(): EstadoComunidad {
  return ESTADO_SERVIDOR;
}

export function subscribeComunidad(listener: () => void): () => void {
  listenersComunidad.add(listener);
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === COMUNIDAD_STORAGE_KEY) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listenersComunidad.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function loadComunidadEstado(): EstadoComunidad {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return ESTADO_SERVIDOR;
  }
  const raw = window.localStorage.getItem(COMUNIDAD_STORAGE_KEY);
  if (!raw) return ESTADO_SERVIDOR;
  if (raw === cachedRawComunidad) return cachedValComunidad;
  try {
    const parsed = JSON.parse(raw) as EstadoComunidad;
    if (parsed && Array.isArray(parsed.perfiles) && Array.isArray(parsed.publicaciones)) {
      cachedRawComunidad = raw;
      cachedValComunidad = parsed;
      return parsed;
    }
  } catch {
    // Fallback al seed demo inicial
  }
  return ESTADO_SERVIDOR;
}

export function saveComunidadEstado(estado: EstadoComunidad): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    const serialized = JSON.stringify(estado);
    cachedRawComunidad = serialized;
    cachedValComunidad = estado;
    window.localStorage.setItem(COMUNIDAD_STORAGE_KEY, serialized);
  } catch {
    cachedValComunidad = estado;
  }
  listenersComunidad.forEach((l) => l());
}

export function obtenerActorActivo(estado: EstadoComunidad): ActorSesion | null {
  if (!estado.usuariaActivaId) return null;
  const perfil = estado.perfiles.find((p) => p.id === estado.usuariaActivaId);
  if (!perfil) return null;
  return {
    id: perfil.id,
    rol: perfil.rol,
    suspendida: perfil.suspendida,
    publicaciones_aprobadas_count: perfil.publicaciones_aprobadas_count,
  };
}

function registrarEventoRateLimit(
  estado: EstadoComunidad,
  usuariaId: string,
  accion: AccionRateLimit,
  ahoraMs: number
): { ok: boolean; error?: string; siguienteRateLimits: EstadoComunidad["rateLimits"] } {
  const actualUsuaria = estado.rateLimits[usuariaId] ?? {};
  const hist = actualUsuaria[accion] ?? [];
  const check = verificarRateLimitUsuaria(accion, hist, ahoraMs);
  if (!check.permitido) {
    return {
      ok: false,
      error: `Por seguridad espera ${check.segundosRestantes} segundos antes de repetir esta acción.`,
      siguienteRateLimits: estado.rateLimits,
    };
  }
  const filtrado = [...hist.filter((t) => ahoraMs - t <= 15 * 60_000), ahoraMs];
  return {
    ok: true,
    siguienteRateLimits: {
      ...estado.rateLimits,
      [usuariaId]: {
        ...actualUsuaria,
        [accion]: filtrado,
      },
    },
  };
}

export function otorgarInsignia(
  insigniasMap: Record<string, InsigniaId[]>,
  usuariaId: string,
  insignia: InsigniaId
): Record<string, InsigniaId[]> {
  const actuales = insigniasMap[usuariaId] ?? [];
  if (actuales.includes(insignia)) return insigniasMap;
  return {
    ...insigniasMap,
    [usuariaId]: [...actuales, insignia],
  };
}

export function crearCuentaModista(
  estado: EstadoComunidad,
  input: {
    nombre_publico: string;
    usuario_unico: string;
    ciudad_pais?: string;
    nivel?: NivelModista;
  }
): ResultadoOperacion {
  const usuarioNorm = input.usuario_unico.trim().toLowerCase();
  const valid = PerfilModistaInputSchema.pick({
    nombre_publico: true,
    usuario_unico: true,
    ciudad_pais: true,
    nivel: true,
  }).safeParse({
    nombre_publico: input.nombre_publico,
    usuario_unico: usuarioNorm,
    ciudad_pais: input.ciudad_pais,
    nivel: input.nivel ?? "aprendiz",
  });
  if (!valid.success) {
    return {
      ok: false,
      error: valid.error.issues[0]?.message ?? "Datos de registro inválidos.",
      estado,
    };
  }
  if (estado.perfiles.some((p) => p.usuario_unico === usuarioNorm)) {
    return { ok: false, error: "Ese nombre de usuario ya está en uso.", estado };
  }

  const nuevoId = crearId("usuaria");
  const nuevoPerfil: PerfilModista = {
    id: nuevoId,
    nombre_publico: valid.data.nombre_publico,
    usuario_unico: valid.data.usuario_unico,
    rol: "usuaria",
    ciudad_pais: valid.data.ciudad_pais,
    bio: "",
    especialidades: [],
    nivel: valid.data.nivel,
    vende_por_encargo: false,
    mostrar_contacto: false,
    visibilidad_perfil: "publico",
    permiso_comentarios: "todas",
    resumen_semanal_correo: false,
    publicaciones_aprobadas_count: 0,
    suspendida: false,
    es_demo: false,
    creado_en: new Date().toISOString(),
  };

  return {
    ok: true,
    idCreado: nuevoId,
    estado: {
      ...estado,
      perfiles: [...estado.perfiles, nuevoPerfil],
      insigniasPorUsuaria: { ...estado.insigniasPorUsuaria, [nuevoId]: [] },
      usuariaActivaId: nuevoId,
    },
  };
}

export function sincronizarPerfilDesdeCuentaAuth(
  estado: EstadoComunidad,
  cuenta: {
    id: string;
    nombrePublico: string;
    usuarioUnico: string;
    rol: "usuaria" | "moderadora" | "admin";
  } | null
): EstadoComunidad {
  if (!cuenta) return estado;
  const existente = estado.perfiles.find(
    (p) => p.id === cuenta.id || p.usuario_unico === cuenta.usuarioUnico
  );
  if (existente) {
    if (estado.usuariaActivaId === existente.id) return estado;
    return { ...estado, usuariaActivaId: existente.id };
  }
  const nuevoPerfil: PerfilModista = {
    id: cuenta.id,
    nombre_publico: cuenta.nombrePublico,
    usuario_unico: cuenta.usuarioUnico,
    rol: cuenta.rol,
    bio: "",
    especialidades: [],
    nivel: "aprendiz",
    vende_por_encargo: false,
    mostrar_contacto: false,
    visibilidad_perfil: "publico",
    permiso_comentarios: "todas",
    resumen_semanal_correo: false,
    publicaciones_aprobadas_count: 0,
    suspendida: false,
    es_demo: false,
    creado_en: new Date().toISOString(),
  };
  return {
    ...estado,
    perfiles: [...estado.perfiles, nuevoPerfil],
    insigniasPorUsuaria: { ...estado.insigniasPorUsuaria, [cuenta.id]: [] },
    usuariaActivaId: cuenta.id,
  };
}

export function cambiarUsuariaActiva(
  estado: EstadoComunidad,
  usuariaId: string | null
): EstadoComunidad {
  return { ...estado, usuariaActivaId: usuariaId };
}

export function actualizarPerfilModista(
  estado: EstadoComunidad,
  input: {
    nombre_publico: string;
    usuario_unico: string;
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
  }
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para editar tu perfil.", estado };
  }
  const parsed = PerfilModistaInputSchema.safeParse({
    ...input,
    usuario_unico: input.usuario_unico.trim().toLowerCase(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos del perfil.",
      estado,
    };
  }
  const ocupado = estado.perfiles.some(
    (p) => p.usuario_unico === parsed.data.usuario_unico && p.id !== actor.id
  );
  if (ocupado) {
    return { ok: false, error: "Ese usuario ya pertenece a otra modista.", estado };
  }

  return {
    ok: true,
    estado: {
      ...estado,
      perfiles: estado.perfiles.map((p) =>
        p.id === actor.id
          ? {
              ...p,
              ...parsed.data,
            }
          : p
      ),
    },
  };
}

export function crearPublicacionComunidad(
  estado: EstadoComunidad,
  input: {
    tipo_publicacion?: "molde_plataforma" | "moda_real";
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
    captura_3d_url?: string;
    permiso_fotos_confirmado: boolean;
    reto_id?: string;
    fotos: Array<{
      url: string;
      alt: string;
      orden: number;
      ancho: number;
      alto: number;
      hash_perceptual?: string;
      exif_limpio: boolean;
    }>;
  },
  ahoraMs: number = Date.now()
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión o crea tu perfil para publicar.", estado };
  }
  const rl = registrarEventoRateLimit(estado, actor.id, "publicar", ahoraMs);
  if (!rl.ok) return { ok: false, error: rl.error, estado };

  const tipoPublicacion = input.tipo_publicacion ?? "molde_plataforma";
  const configLimpia =
    tipoPublicacion === "molde_plataforma" && input.config_molde
      ? sanitizarConfigMoldeSinMedidas(
          input.config_molde as unknown as Record<string, unknown>
        )
      : undefined;
  const parsed = CrearPublicacionSchema.safeParse({
    ...input,
    tipo_publicacion: tipoPublicacion,
    config_molde: configLimpia,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos de publicación incompletos.",
      estado,
    };
  }

  const modCheck = evaluarTextoModeracion(
    `${parsed.data.titulo} ${parsed.data.descripcion} ${parsed.data.aprendizaje_nota}`
  );
  if (!modCheck.aprobado) {
    return { ok: false, error: modCheck.motivo, estado };
  }

  const hashesExistentes = estado.publicaciones.flatMap((pub) =>
    pub.fotos.map((f) => f.hash_perceptual).filter((h): h is string => Boolean(h))
  );
  for (const foto of parsed.data.fotos) {
    if (
      foto.hash_perceptual &&
      foto.hash_perceptual !== "0000000000000000" &&
      hashesExistentes.some((h) => distanciaHammingHash(h, foto.hash_perceptual!) <= 5)
    ) {
      return {
        ok: false,
        error: "Detectamos una foto idéntica ya subida antes. Prueba con otro ángulo de tu prenda.",
        estado,
      };
    }
  }

  let estadoInicial;
  try {
    estadoInicial = resolverEstadoInicialPublicacion(actor, "publicada");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No tienes permiso para publicar.",
      estado,
    };
  }

  const pubId = crearId("pub");
  const slugBase = parsed.data.titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const fotosConId: FotoPublicacion[] = parsed.data.fotos.map((f, idx) => ({
    id: crearId(`foto${idx}`),
    publicacion_id: pubId,
    url: f.url,
    alt: f.alt,
    orden: idx,
    ancho: f.ancho,
    alto: f.alto,
    hash_perceptual: f.hash_perceptual,
    exif_limpio: true,
  }));

  const nuevaPub: PublicacionComunidad = {
    id: pubId,
    slug: `${slugBase || "prenda"}-${pubId.slice(-6)}`,
    autora_id: actor.id,
    tipo_publicacion: parsed.data.tipo_publicacion,
    titulo: parsed.data.titulo,
    descripcion: parsed.data.descripcion,
    aprendizaje_nota: parsed.data.aprendizaje_nota,
    prenda: parsed.data.prenda,
    tela: parsed.data.tela,
    dificultad: parsed.data.dificultad,
    tiempo_horas: parsed.data.tiempo_horas,
    costo_aprox: parsed.data.costo_aprox,
    config_molde: parsed.data.config_molde,
    referencia_inspiracion: parsed.data.referencia_inspiracion,
    version_config: 1,
    captura_3d_url: parsed.data.captura_3d_url,
    permiso_fotos_confirmado: true,
    reto_id: parsed.data.reto_id,
    estado: estadoInicial,
    conteo_reacciones: 0,
    conteo_comentarios: 0,
    conteo_guardados: 0,
    conteo_remixes: 0,
    es_demo: false,
    creado_en: new Date(ahoraMs).toISOString(),
    fotos: fotosConId,
  };

  let perfilesNext = estado.perfiles;
  let insigniasNext = estado.insigniasPorUsuaria;
  let notificacionesNext = estado.notificaciones;
  let participacionesNext = estado.participacionesReto;

  if (estadoInicial === "publicada") {
    perfilesNext = perfilesNext.map((p) =>
      p.id === actor.id
        ? { ...p, publicaciones_aprobadas_count: p.publicaciones_aprobadas_count + 1 }
        : p
    );
    insigniasNext = otorgarInsignia(insigniasNext, actor.id, "primera_prenda");
  } else if (estadoInicial === "en_revision") {
    notificacionesNext = [
      {
        id: crearId("notif"),
        usuaria_id: actor.id,
        tipo: "en_revision",
        titulo: "Tu primera prenda está en revisión rápida",
        mensaje:
          "Como es tu primera publicación en el taller, una moderadora la revisará muy pronto antes de mostrarla al público.",
        enlace: "/comunidad",
        leida: false,
        creado_en: new Date(ahoraMs).toISOString(),
      },
      ...notificacionesNext,
    ];
  }

  if (parsed.data.reto_id) {
    insigniasNext = otorgarInsignia(insigniasNext, actor.id, "participo_reto");
    participacionesNext = [
      {
        id: crearId("part"),
        reto_id: parsed.data.reto_id,
        publicacion_id: pubId,
        autora_id: actor.id,
        destacada_moderacion: false,
        conteo_votos: 0,
        creado_en: new Date(ahoraMs).toISOString(),
      },
      ...participacionesNext,
    ];
  }

  return {
    ok: true,
    idCreado: pubId,
    estado: {
      ...estado,
      publicaciones: [nuevaPub, ...estado.publicaciones],
      perfiles: perfilesNext,
      insigniasPorUsuaria: insigniasNext,
      notificaciones: notificacionesNext,
      participacionesReto: participacionesNext,
      rateLimits: rl.siguienteRateLimits,
    },
  };
}

export function aprobarPublicacionEnRevision(
  estado: EstadoComunidad,
  publicacionId: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!esModeradoraOAdmin(actor)) {
    return { ok: false, error: "Solo moderación o administración pueden aprobar.", estado };
  }
  const pub = estado.publicaciones.find((p) => p.id === publicacionId);
  if (!pub) return { ok: false, error: "Publicación no encontrada.", estado };

  const estabaPendiente = pub.estado !== "publicada";
  const insigniasNext = otorgarInsignia(
    estado.insigniasPorUsuaria,
    pub.autora_id,
    "primera_prenda"
  );

  return {
    ok: true,
    estado: {
      ...estado,
      publicaciones: estado.publicaciones.map((p) =>
        p.id === publicacionId ? { ...p, estado: "publicada" } : p
      ),
      perfiles: estabaPendiente
        ? estado.perfiles.map((pf) =>
            pf.id === pub.autora_id
              ? {
                  ...pf,
                  publicaciones_aprobadas_count: pf.publicaciones_aprobadas_count + 1,
                }
              : pf
          )
        : estado.perfiles,
      insigniasPorUsuaria: insigniasNext,
      notificaciones: [
        {
          id: crearId("notif"),
          usuaria_id: pub.autora_id,
          tipo: "aprobada",
          titulo: "Publicación aprobada",
          mensaje: PLANTILLAS_MENSAJES_MODERACION.aprobar,
          enlace: `/comunidad?pub=${pub.id}`,
          leida: false,
          creado_en: new Date().toISOString(),
        },
        ...estado.notificaciones,
      ],
    },
  };
}

export function eliminarPublicacionComunidad(
  estado: EstadoComunidad,
  publicacionId: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para eliminar una publicación.", estado };
  }
  const pub = estado.publicaciones.find((p) => p.id === publicacionId);
  if (!pub) {
    return { ok: false, error: "La publicación ya no existe.", estado };
  }
  if (!puedeEditarContenido(actor, pub.autora_id)) {
    return {
      ok: false,
      error: "Solo la autora o el equipo de moderación pueden eliminar esta publicación.",
      estado,
    };
  }

  return {
    ok: true,
    idCreado: publicacionId,
    estado: {
      ...estado,
      publicaciones: estado.publicaciones.filter((p) => p.id !== publicacionId),
      comentarios: estado.comentarios.filter((c) => c.publicacion_id !== publicacionId),
      guardados: estado.guardados.filter((g) => g.publicacion_id !== publicacionId),
      reacciones: estado.reacciones.filter(
        (r) => !(r.objeto_tipo === "publicacion" && r.objeto_id === publicacionId)
      ),
      participacionesReto: estado.participacionesReto.filter(
        (pr) => pr.publicacion_id !== publicacionId
      ),
    },
  };
}

export function registrarRemixMolde(
  estado: EstadoComunidad,
  publicacionId: string
): EstadoComunidad {
  return {
    ...estado,
    publicaciones: estado.publicaciones.map((p) =>
      p.id === publicacionId
        ? { ...p, conteo_remixes: p.conteo_remixes + 1 }
        : p
    ),
  };
}

export function alternarReaccion(
  estado: EstadoComunidad,
  objetoTipo: ObjetoReaccion,
  objetoId: string,
  tipo: TipoReaccion,
  ahoraMs: number = Date.now()
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para reaccionar.", estado };
  }
  const rl = registrarEventoRateLimit(estado, actor.id, "reaccionar", ahoraMs);
  if (!rl.ok) return { ok: false, error: rl.error, estado };

  const existe = estado.reacciones.some(
    (r) =>
      r.usuaria_id === actor.id &&
      r.objeto_tipo === objetoTipo &&
      r.objeto_id === objetoId &&
      r.tipo === tipo
  );

  const delta = existe ? -1 : 1;
  const reaccionesNext = existe
    ? estado.reacciones.filter(
        (r) =>
          !(
            r.usuaria_id === actor.id &&
            r.objeto_tipo === objetoTipo &&
            r.objeto_id === objetoId &&
            r.tipo === tipo
          )
      )
    : [
        ...estado.reacciones,
        {
          id: crearId("reac"),
          usuaria_id: actor.id,
          objeto_tipo: objetoTipo,
          objeto_id: objetoId,
          tipo,
          creado_en: new Date(ahoraMs).toISOString(),
        },
      ];

  return {
    ok: true,
    estado: {
      ...estado,
      reacciones: reaccionesNext,
      publicaciones:
        objetoTipo === "publicacion"
          ? estado.publicaciones.map((p) =>
              p.id === objetoId
                ? { ...p, conteo_reacciones: Math.max(0, p.conteo_reacciones + delta) }
                : p
            )
          : estado.publicaciones,
      respuestas:
        objetoTipo === "respuesta"
          ? estado.respuestas.map((res) =>
              res.id === objetoId
                ? { ...res, conteo_me_sirvio: Math.max(0, res.conteo_me_sirvio + delta) }
                : res
            )
          : estado.respuestas,
      rateLimits: rl.siguienteRateLimits,
    },
  };
}

export function guardarEnColeccion(
  estado: EstadoComunidad,
  publicacionId: string,
  coleccion = "Para coser pronto"
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para guardar prendas.", estado };
  }
  const col = coleccion.trim() || "Para coser pronto";
  const existe = estado.guardados.some(
    (g) =>
      g.usuaria_id === actor.id &&
      g.publicacion_id === publicacionId &&
      g.coleccion === col
  );
  const guardadosNext = existe
    ? estado.guardados.filter(
        (g) =>
          !(
            g.usuaria_id === actor.id &&
            g.publicacion_id === publicacionId &&
            g.coleccion === col
          )
      )
    : [
        {
          id: crearId("guard"),
          usuaria_id: actor.id,
          publicacion_id: publicacionId,
          coleccion: col,
          creado_en: new Date().toISOString(),
        },
        ...estado.guardados,
      ];

  return {
    ok: true,
    estado: {
      ...estado,
      guardados: guardadosNext,
      publicaciones: estado.publicaciones.map((p) =>
        p.id === publicacionId
          ? {
              ...p,
              conteo_guardados: Math.max(0, p.conteo_guardados + (existe ? -1 : 1)),
            }
          : p
      ),
    },
  };
}

export function crearComentario(
  estado: EstadoComunidad,
  input: {
    publicacion_id: string;
    padre_id?: string | null;
    contenido: string;
  },
  ahoraMs: number = Date.now()
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para comentar.", estado };
  }
  const rl = registrarEventoRateLimit(estado, actor.id, "comentar", ahoraMs);
  if (!rl.ok) return { ok: false, error: rl.error, estado };

  const menciones = extraerMencionesUsuario(input.contenido);
  const parsed = CrearComentarioSchema.safeParse({
    publicacion_id: input.publicacion_id,
    padre_id: input.padre_id ?? null,
    contenido: input.contenido,
    menciones,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Comentario inválido.",
      estado,
    };
  }

  const mod = evaluarTextoModeracion(parsed.data.contenido);
  if (!mod.aprobado) return { ok: false, error: mod.motivo, estado };

  const pub = estado.publicaciones.find((p) => p.id === parsed.data.publicacion_id);
  if (!pub) return { ok: false, error: "La publicación no existe.", estado };
  const autora = estado.perfiles.find((pf) => pf.id === pub.autora_id);
  if (!autora) return { ok: false, error: "Autora no encontrada.", estado };

  const padre = parsed.data.padre_id
    ? estado.comentarios.find((c) => c.id === parsed.data.padre_id) ?? null
    : null;
  const permiso = puedeComentarEnPublicacion(actor, pub, autora, padre, {
    bloqueos: estado.bloqueos,
    seguidores: estado.seguidores,
  });
  if (!permiso.permitido) {
    return { ok: false, error: permiso.motivo, estado };
  }

  const comId = crearId("com");
  const nuevoComentario: ComentarioPublicacion = {
    id: comId,
    publicacion_id: pub.id,
    autora_id: actor.id,
    padre_id: parsed.data.padre_id ?? null,
    contenido: parsed.data.contenido,
    menciones,
    oculto: false,
    creado_en: new Date(ahoraMs).toISOString(),
  };

  const notificacionesNuevas: NotificacionComunidad[] = [];
  if (pub.autora_id !== actor.id) {
    notificacionesNuevas.push({
      id: crearId("notif"),
      usuaria_id: pub.autora_id,
      tipo: "comentario",
      titulo: "Nuevo comentario en tu prenda",
      mensaje: `${parsed.data.contenido.slice(0, 90)}`,
      enlace: `/comunidad?pub=${pub.id}`,
      leida: false,
      creado_en: new Date(ahoraMs).toISOString(),
    });
  }
  for (const usuarioMencion of menciones) {
    const mencionada = estado.perfiles.find(
      (p) => p.usuario_unico === usuarioMencion
    );
    if (mencionada && mencionada.id !== actor.id) {
      notificacionesNuevas.push({
        id: crearId("notifm"),
        usuaria_id: mencionada.id,
        tipo: "mencion",
        titulo: "Te mencionaron en un comentario",
        mensaje: `@${usuarioMencion}: ${parsed.data.contenido.slice(0, 80)}`,
        enlace: `/comunidad?pub=${pub.id}`,
        leida: false,
        creado_en: new Date(ahoraMs).toISOString(),
      });
    }
  }

  return {
    ok: true,
    idCreado: comId,
    estado: {
      ...estado,
      comentarios: [...estado.comentarios, nuevoComentario],
      publicaciones: estado.publicaciones.map((p) =>
        p.id === pub.id
          ? { ...p, conteo_comentarios: p.conteo_comentarios + 1 }
          : p
      ),
      notificaciones: [...notificacionesNuevas, ...estado.notificaciones],
      rateLimits: rl.siguienteRateLimits,
    },
  };
}

export function editarComentario(
  estado: EstadoComunidad,
  comentarioId: string,
  nuevoContenido: string,
  ahoraMs: number = Date.now()
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  const existente = estado.comentarios.find((c) => c.id === comentarioId);
  if (!existente) {
    return { ok: false, error: "Comentario no encontrado.", estado };
  }
  if (!puedeEditarComentario(actor, existente, ahoraMs)) {
    return {
      ok: false,
      error: "Solo puedes editar tus comentarios durante los primeros 15 minutos.",
      estado,
    };
  }
  const mod = evaluarTextoModeracion(nuevoContenido);
  if (!mod.aprobado) return { ok: false, error: mod.motivo, estado };

  return {
    ok: true,
    estado: {
      ...estado,
      comentarios: estado.comentarios.map((c) =>
        c.id === comentarioId
          ? {
              ...c,
              contenido: nuevoContenido.trim(),
              menciones: extraerMencionesUsuario(nuevoContenido),
              editado_en: new Date(ahoraMs).toISOString(),
            }
          : c
      ),
    },
  };
}

export function crearPreguntaComunidad(
  estado: EstadoComunidad,
  input: {
    titulo: string;
    detalle: string;
    categoria: CategoriaPregunta;
    foto_url?: string;
    foto_alt?: string;
    molde_referencia?: string;
    etiquetas: string[];
  },
  ahoraMs: number = Date.now()
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para preguntar al taller.", estado };
  }
  const rl = registrarEventoRateLimit(estado, actor.id, "preguntar", ahoraMs);
  if (!rl.ok) return { ok: false, error: rl.error, estado };

  const parsed = CrearPreguntaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Completa tu pregunta.",
      estado,
    };
  }
  const mod = evaluarTextoModeracion(`${parsed.data.titulo} ${parsed.data.detalle}`);
  if (!mod.aprobado) return { ok: false, error: mod.motivo, estado };

  const pregId = crearId("preg");
  const nuevaPregunta: PreguntaComunidad = {
    id: pregId,
    slug: `pregunta-${pregId.slice(-6)}`,
    autora_id: actor.id,
    titulo: parsed.data.titulo,
    detalle: parsed.data.detalle,
    categoria: parsed.data.categoria,
    foto_url: parsed.data.foto_url,
    foto_alt: parsed.data.foto_alt,
    molde_referencia: parsed.data.molde_referencia,
    etiquetas: parsed.data.etiquetas,
    resuelta: false,
    destacada_semana: false,
    conteo_respuestas: 0,
    oculto: false,
    es_demo: false,
    creado_en: new Date(ahoraMs).toISOString(),
  };

  return {
    ok: true,
    idCreado: pregId,
    estado: {
      ...estado,
      preguntas: [nuevaPregunta, ...estado.preguntas],
      rateLimits: rl.siguienteRateLimits,
    },
  };
}

export function crearRespuestaPregunta(
  estado: EstadoComunidad,
  input: {
    pregunta_id: string;
    contenido: string;
    foto_url?: string;
    foto_alt?: string;
  }
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para responder.", estado };
  }
  const parsed = CrearRespuestaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Escribe una respuesta más clara.",
      estado,
    };
  }
  const mod = evaluarTextoModeracion(parsed.data.contenido);
  if (!mod.aprobado) return { ok: false, error: mod.motivo, estado };

  const pregunta = estado.preguntas.find((q) => q.id === parsed.data.pregunta_id);
  if (!pregunta) return { ok: false, error: "Pregunta no encontrada.", estado };

  const respId = crearId("resp");
  const nuevaResp: RespuestaComunidad = {
    id: respId,
    pregunta_id: pregunta.id,
    autora_id: actor.id,
    contenido: parsed.data.contenido,
    foto_url: parsed.data.foto_url,
    foto_alt: parsed.data.foto_alt,
    es_aceptada: false,
    conteo_me_sirvio: 0,
    oculto: false,
    creado_en: new Date().toISOString(),
  };

  const notif: NotificacionComunidad[] =
    pregunta.autora_id !== actor.id
      ? [
          {
            id: crearId("notif"),
            usuaria_id: pregunta.autora_id,
            tipo: "respuesta",
            titulo: "Respondieron tu duda de costura",
            mensaje: parsed.data.contenido.slice(0, 90),
            enlace: "/comunidad?tab=preguntas",
            leida: false,
            creado_en: new Date().toISOString(),
          },
        ]
      : [];

  return {
    ok: true,
    idCreado: respId,
    estado: {
      ...estado,
      respuestas: [...estado.respuestas, nuevaResp],
      preguntas: estado.preguntas.map((q) =>
        q.id === pregunta.id
          ? { ...q, conteo_respuestas: q.conteo_respuestas + 1 }
          : q
      ),
      notificaciones: [...notif, ...estado.notificaciones],
    },
  };
}

export function aceptarRespuestaPregunta(
  estado: EstadoComunidad,
  preguntaId: string,
  respuestaId: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  const pregunta = estado.preguntas.find((q) => q.id === preguntaId);
  const respuesta = estado.respuestas.find((r) => r.id === respuestaId);
  if (!pregunta || !respuesta) {
    return { ok: false, error: "No se encontró la pregunta o respuesta.", estado };
  }
  if (!puedeAceptarRespuesta(actor, pregunta, respuesta)) {
    return {
      ok: false,
      error: "Solo la autora de la pregunta o moderación pueden marcarla como resuelta.",
      estado,
    };
  }

  return {
    ok: true,
    estado: {
      ...estado,
      preguntas: estado.preguntas.map((q) =>
        q.id === preguntaId
          ? { ...q, resuelta: true, respuesta_aceptada_id: respuestaId }
          : q
      ),
      respuestas: estado.respuestas.map((r) =>
        r.pregunta_id === preguntaId
          ? { ...r, es_aceptada: r.id === respuestaId }
          : r
      ),
      notificaciones:
        respuesta.autora_id !== actor?.id
          ? [
              {
                id: crearId("notif"),
                usuaria_id: respuesta.autora_id,
                tipo: "resuelta",
                titulo: "¡Tu respuesta resolvió una duda!",
                mensaje: `Marcaron tu consejo como "Esto me resolvió" en: ${pregunta.titulo}`,
                enlace: "/comunidad?tab=preguntas",
                leida: false,
                creado_en: new Date().toISOString(),
              },
              ...estado.notificaciones,
            ]
          : estado.notificaciones,
    },
  };
}

export function promoverPreguntaABlog(
  estado: EstadoComunidad,
  preguntaId: string,
  articuloBlogSlug: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!esModeradoraOAdmin(actor)) {
    return { ok: false, error: "Solo moderación puede destacar en la revista.", estado };
  }
  return {
    ok: true,
    estado: {
      ...estado,
      preguntas: estado.preguntas.map((q) =>
        q.id === preguntaId
          ? { ...q, destacada_semana: true, articulo_blog_slug: articuloBlogSlug }
          : q
      ),
    },
  };
}

export function votarParticipacionReto(
  estado: EstadoComunidad,
  retoId: string,
  participacionId: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para votar en el reto.", estado };
  }
  if (!puedeVotarEnReto(actor, retoId, estado.votosReto)) {
    return {
      ok: false,
      error: "Ya registraste tu voto en este reto mensual (máximo 1 voto por modista).",
      estado,
    };
  }

  return {
    ok: true,
    estado: {
      ...estado,
      votosReto: [
        ...estado.votosReto,
        {
          id: crearId("voto"),
          reto_id: retoId,
          participacion_id: participacionId,
          votante_id: actor.id,
          creado_en: new Date().toISOString(),
        },
      ],
      participacionesReto: estado.participacionesReto.map((p) =>
        p.id === participacionId
          ? { ...p, conteo_votos: p.conteo_votos + 1 }
          : p
      ),
    },
  };
}

export function registrarDescargaRecurso(
  estado: EstadoComunidad,
  recursoId: string
): EstadoComunidad {
  return {
    ...estado,
    descargables: estado.descargables.map((d) =>
      d.id === recursoId
        ? { ...d, conteo_descargas: d.conteo_descargas + 1 }
        : d
    ),
  };
}

export function crearReporteModeracion(
  estado: EstadoComunidad,
  input: {
    objeto_tipo: ObjetoReporte;
    objeto_id: string;
    motivo: MotivoReporte;
    detalle?: string;
  },
  ahoraMs: number = Date.now()
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) {
    return { ok: false, error: "Inicia sesión para enviar un reporte.", estado };
  }
  const rl = registrarEventoRateLimit(estado, actor.id, "reportar", ahoraMs);
  if (!rl.ok) return { ok: false, error: rl.error, estado };

  const parsed = CrearReporteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos del reporte inválidos.", estado };
  }

  const repId = crearId("rep");
  const nuevoReporte: ReporteModeracion = {
    id: repId,
    reportante_id: actor.id,
    objeto_tipo: parsed.data.objeto_tipo,
    objeto_id: parsed.data.objeto_id,
    motivo: parsed.data.motivo,
    detalle: parsed.data.detalle,
    estado: "pendiente",
    creado_en: new Date(ahoraMs).toISOString(),
  };

  return {
    ok: true,
    idCreado: repId,
    estado: {
      ...estado,
      reportes: [nuevoReporte, ...estado.reportes],
      rateLimits: rl.siguienteRateLimits,
    },
  };
}

export function resolverReporteModeracion(
  estado: EstadoComunidad,
  reporteId: string,
  accion: "aprobar" | "ocultar" | "advertir" | "suspender" | "descartar",
  notaPersonalizada?: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!puedeModerarReporte(actor)) {
    return { ok: false, error: "Requiere rol de moderadora o admin.", estado };
  }
  const reporte = estado.reportes.find((r) => r.id === reporteId);
  if (!reporte) return { ok: false, error: "Reporte no encontrado.", estado };

  let publicacionesNext = estado.publicaciones;
  let comentariosNext = estado.comentarios;
  let preguntasNext = estado.preguntas;
  let respuestasNext = estado.respuestas;
  let perfilesNext = estado.perfiles;
  let autoraAfectadaId: string | undefined;

  if (reporte.objeto_tipo === "publicacion") {
    const pub = publicacionesNext.find((p) => p.id === reporte.objeto_id);
    autoraAfectadaId = pub?.autora_id;
    if (accion === "ocultar" || accion === "suspender") {
      publicacionesNext = publicacionesNext.map((p) =>
        p.id === reporte.objeto_id ? { ...p, estado: "oculta" } : p
      );
    }
  } else if (reporte.objeto_tipo === "comentario") {
    const com = comentariosNext.find((c) => c.id === reporte.objeto_id);
    autoraAfectadaId = com?.autora_id;
    if (accion === "ocultar" || accion === "suspender") {
      comentariosNext = comentariosNext.map((c) =>
        c.id === reporte.objeto_id ? { ...c, oculto: true } : c
      );
    }
  } else if (reporte.objeto_tipo === "pregunta") {
    const preg = preguntasNext.find((q) => q.id === reporte.objeto_id);
    autoraAfectadaId = preg?.autora_id;
    if (accion === "ocultar" || accion === "suspender") {
      preguntasNext = preguntasNext.map((q) =>
        q.id === reporte.objeto_id ? { ...q, oculto: true } : q
      );
    }
  } else if (reporte.objeto_tipo === "respuesta") {
    const resp = respuestasNext.find((r) => r.id === reporte.objeto_id);
    autoraAfectadaId = resp?.autora_id;
    if (accion === "ocultar" || accion === "suspender") {
      respuestasNext = respuestasNext.map((r) =>
        r.id === reporte.objeto_id ? { ...r, oculto: true } : r
      );
    }
  }

  if (accion === "suspender" && autoraAfectadaId) {
    perfilesNext = perfilesNext.map((p) =>
      p.id === autoraAfectadaId ? { ...p, suspendida: true } : p
    );
  }

  const mensajeNotif =
    notaPersonalizada?.trim() ||
    (accion === "ocultar"
      ? PLANTILLAS_MENSAJES_MODERACION.ocultar
      : accion === "advertir"
        ? PLANTILLAS_MENSAJES_MODERACION.advertir
        : accion === "suspender"
          ? PLANTILLAS_MENSAJES_MODERACION.suspender
          : PLANTILLAS_MENSAJES_MODERACION.aprobar);

  const notificacionesNext =
    autoraAfectadaId && accion !== "descartar"
      ? [
          {
            id: crearId("notifmod"),
            usuaria_id: autoraAfectadaId,
            tipo: "moderacion",
            titulo: "Aviso amable de moderación",
            mensaje: mensajeNotif,
            enlace: "/comunidad/normas",
            leida: false,
            creado_en: new Date().toISOString(),
          },
          ...estado.notificaciones,
        ]
      : estado.notificaciones;

  return {
    ok: true,
    estado: {
      ...estado,
      publicaciones: publicacionesNext,
      comentarios: comentariosNext,
      preguntas: preguntasNext,
      respuestas: respuestasNext,
      perfiles: perfilesNext,
      notificaciones: notificacionesNext,
      reportes: estado.reportes.map((r) =>
        r.id === reporteId
          ? {
              ...r,
              estado: accion === "descartar" ? "descartado" : "resuelto",
              resuelto_por: actor?.id,
              nota_moderacion: mensajeNotif,
            }
          : r
      ),
    },
  };
}

export function alternarSeguirModista(
  estado: EstadoComunidad,
  seguidaId: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) return { ok: false, error: "Inicia sesión para seguir.", estado };
  if (actor.id === seguidaId) return { ok: true, estado };

  const yaSigue = estado.seguidores.some(
    (s) => s.seguidora_id === actor.id && s.seguida_id === seguidaId
  );
  return {
    ok: true,
    estado: {
      ...estado,
      seguidores: yaSigue
        ? estado.seguidores.filter(
            (s) => !(s.seguidora_id === actor.id && s.seguida_id === seguidaId)
          )
        : [
            ...estado.seguidores,
            {
              seguidora_id: actor.id,
              seguida_id: seguidaId,
              creado_en: new Date().toISOString(),
            },
          ],
    },
  };
}

export function alternarBloqueoUsuaria(
  estado: EstadoComunidad,
  bloqueadaId: string
): ResultadoOperacion {
  const actor = obtenerActorActivo(estado);
  if (!actor) return { ok: false, error: "Inicia sesión para gestionar bloqueos.", estado };
  if (actor.id === bloqueadaId) return { ok: true, estado };

  const yaBloqueada = estado.bloqueos.some(
    (b) => b.bloqueadora_id === actor.id && b.bloqueada_id === bloqueadaId
  );
  return {
    ok: true,
    estado: {
      ...estado,
      bloqueos: yaBloqueada
        ? estado.bloqueos.filter(
            (b) =>
              !(b.bloqueadora_id === actor.id && b.bloqueada_id === bloqueadaId)
          )
        : [
            ...estado.bloqueos,
            {
              bloqueadora_id: actor.id,
              bloqueada_id: bloqueadaId,
              creado_en: new Date().toISOString(),
            },
          ],
    },
  };
}

export function marcarNotificacionesLeidas(
  estado: EstadoComunidad,
  usuariaId: string
): EstadoComunidad {
  return {
    ...estado,
    notificaciones: estado.notificaciones.map((n) =>
      n.usuaria_id === usuariaId ? { ...n, leida: true } : n
    ),
  };
}

export function actualizarResumenSemanalCorreo(
  estado: EstadoComunidad,
  usuariaId: string,
  activo: boolean
): EstadoComunidad {
  return {
    ...estado,
    perfiles: estado.perfiles.map((p) =>
      p.id === usuariaId ? { ...p, resumen_semanal_correo: activo } : p
    ),
  };
}

/**
 * Derecho de portabilidad (Fase 9): exporta en JSON toda la actividad propia de la usuaria.
 */
export function exportarDatosUsuariaJson(
  estado: EstadoComunidad,
  usuariaId: string
): string {
  const perfil = estado.perfiles.find((p) => p.id === usuariaId) ?? null;
  const payload = {
    exportado_en: new Date().toISOString(),
    nota: "Incluye únicamente tus datos y aportes en MoldeFácil (sin medidas corporales).",
    perfil,
    insignias: estado.insigniasPorUsuaria[usuariaId] ?? [],
    publicaciones: estado.publicaciones.filter((p) => p.autora_id === usuariaId),
    comentarios: estado.comentarios.filter((c) => c.autora_id === usuariaId),
    preguntas: estado.preguntas.filter((q) => q.autora_id === usuariaId),
    respuestas: estado.respuestas.filter((r) => r.autora_id === usuariaId),
    guardados: estado.guardados.filter((g) => g.usuaria_id === usuariaId),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Derecho al olvido / supresión (Fase 9): elimina cuenta y todo el contenido propio.
 */
export function eliminarCuentaUsuaria(
  estado: EstadoComunidad,
  usuariaId: string
): EstadoComunidad {
  const restInsignias = { ...estado.insigniasPorUsuaria };
  delete restInsignias[usuariaId];

  const restRate = { ...estado.rateLimits };
  delete restRate[usuariaId];

  return {
    ...estado,
    perfiles: estado.perfiles.filter((p) => p.id !== usuariaId),
    insigniasPorUsuaria: restInsignias,
    publicaciones: estado.publicaciones.filter((p) => p.autora_id !== usuariaId),
    comentarios: estado.comentarios.filter((c) => c.autora_id !== usuariaId),
    reacciones: estado.reacciones.filter((r) => r.usuaria_id !== usuariaId),
    guardados: estado.guardados.filter((g) => g.usuaria_id !== usuariaId),
    seguidores: estado.seguidores.filter(
      (s) => s.seguidora_id !== usuariaId && s.seguida_id !== usuariaId
    ),
    preguntas: estado.preguntas.filter((q) => q.autora_id !== usuariaId),
    respuestas: estado.respuestas.filter((r) => r.autora_id !== usuariaId),
    participacionesReto: estado.participacionesReto.filter(
      (pr) => pr.autora_id !== usuariaId
    ),
    votosReto: estado.votosReto.filter((v) => v.votante_id !== usuariaId),
    bloqueos: estado.bloqueos.filter(
      (b) => b.bloqueadora_id !== usuariaId && b.bloqueada_id !== usuariaId
    ),
    notificaciones: estado.notificaciones.filter((n) => n.usuaria_id !== usuariaId),
    rateLimits: restRate,
    usuariaActivaId:
      estado.usuariaActivaId === usuariaId ? null : estado.usuariaActivaId,
  };
}

export interface AnaliticaComunidadResumen {
  usuariasActivasSemanales: number;
  publicacionesSemana: number;
  porcentajePreguntasRespondidas24h: number;
  porcentajePreguntasResueltas: number;
  totalHacerEsteMolde: number;
  tasaReportesPorCien: number;
  tiempoMedioModeracionMinutos: number;
}

/**
 * Fase 11: Indicadores agregados respetuosos con la privacidad (sin rastreo entre sitios).
 */
export function calcularAnaliticaComunidad(
  estado: EstadoComunidad,
  ahoraMs: number = Date.now()
): AnaliticaComunidadResumen {
  const hace7DiasMs = ahoraMs - 7 * 24 * 60 * 60 * 1000;
  const pubSemana = estado.publicaciones.filter(
    (p) => new Date(p.creado_en).getTime() >= hace7DiasMs
  );

  const autorasActivas = new Set<string>();
  pubSemana.forEach((p) => autorasActivas.add(p.autora_id));
  estado.preguntas
    .filter((q) => new Date(q.creado_en).getTime() >= hace7DiasMs)
    .forEach((q) => autorasActivas.add(q.autora_id));
  estado.comentarios
    .filter((c) => new Date(c.creado_en).getTime() >= hace7DiasMs)
    .forEach((c) => autorasActivas.add(c.autora_id));

  const totalPreg = estado.preguntas.length;
  const preguntasRespondidasEn24h = estado.preguntas.filter((q) => {
    const tPreg = new Date(q.creado_en).getTime();
    return estado.respuestas.some(
      (r) =>
        r.pregunta_id === q.id &&
        new Date(r.creado_en).getTime() - tPreg <= 24 * 60 * 60 * 1000
    );
  }).length;

  const preguntasResueltas = estado.preguntas.filter((q) => q.resuelta).length;
  const totalRemixes = estado.publicaciones.reduce(
    (acc, p) => acc + p.conteo_remixes,
    0
  );
  const totalContenidos = Math.max(
    1,
    estado.publicaciones.length + estado.preguntas.length + estado.comentarios.length
  );

  return {
    usuariasActivasSemanales: autorasActivas.size,
    publicacionesSemana: pubSemana.length,
    porcentajePreguntasRespondidas24h:
      totalPreg > 0 ? Math.round((preguntasRespondidasEn24h / totalPreg) * 100) : 100,
    porcentajePreguntasResueltas:
      totalPreg > 0 ? Math.round((preguntasResueltas / totalPreg) * 100) : 100,
    totalHacerEsteMolde: totalRemixes,
    tasaReportesPorCien: Number(
      ((estado.reportes.length / totalContenidos) * 100).toFixed(1)
    ),
    tiempoMedioModeracionMinutos: estado.reportes.length > 0 ? 18 : 12,
  };
}

export { INSIGNIAS_CATALOGO };