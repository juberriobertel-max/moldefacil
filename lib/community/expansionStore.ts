import {
  agruparEnRango5Cm,
  agregarConKAnonimato,
  MIN_K_ANONIMATO,
} from "./privacyAggregation";
import { ESTADO_INICIAL_AMPLIACION } from "./expansionSeed";
import type {
  AjusteMoldeComunidad,
  BitacoraProyecto,
  CirculoCostura,
  EncargoModista,
  EstadoAmpliacionComunidad,
  EstadoEncargo,
  EtapaBitacoraNombre,
  PercepcionZonaCalce,
  ResenaProveedor,
  RetroalimentacionCalce,
  SolicitudMentoria,
  ZonaAjusteMolde,
} from "./expansionTypes";
import type { ActorSesion } from "./rlsPolicyEngine";
import { esModeradoraOAdmin } from "./rlsPolicyEngine";
import type { ConfigMoldeSerializado } from "./types";
import type { FlagModuloComunidad } from "./featureFlags";

export const EXPANSION_STORAGE_KEY = "moldefacil_comunidad_ampliacion_v1";

const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheParsed: EstadoAmpliacionComunidad = ESTADO_INICIAL_AMPLIACION;

export function getAmpliacionServerSnapshot(): EstadoAmpliacionComunidad {
  return ESTADO_INICIAL_AMPLIACION;
}

export function subscribeAmpliacion(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key === EXPANSION_STORAGE_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => listeners.delete(listener);
}

export function loadAmpliacionEstado(): EstadoAmpliacionComunidad {
  if (typeof window === "undefined") return ESTADO_INICIAL_AMPLIACION;
  try {
    const raw = window.localStorage.getItem(EXPANSION_STORAGE_KEY);
    if (!raw) return ESTADO_INICIAL_AMPLIACION;
    if (raw === cacheRaw) return cacheParsed;
    const parsed = JSON.parse(raw) as Partial<EstadoAmpliacionComunidad>;
    cacheRaw = raw;
    cacheParsed = {
      ...ESTADO_INICIAL_AMPLIACION,
      ...parsed,
      featureFlags: {
        ...ESTADO_INICIAL_AMPLIACION.featureFlags,
        ...(parsed.featureFlags ?? {}),
        aiAssistant: false,
      },
    };
    return cacheParsed;
  } catch {
    return ESTADO_INICIAL_AMPLIACION;
  }
}

export function saveAmpliacionEstado(estado: EstadoAmpliacionComunidad): void {
  const safe: EstadoAmpliacionComunidad = {
    ...estado,
    featureFlags: { ...estado.featureFlags, aiAssistant: false },
  };
  cacheParsed = safe;
  if (typeof window !== "undefined") {
    const raw = JSON.stringify(safe);
    cacheRaw = raw;
    window.localStorage.setItem(EXPANSION_STORAGE_KEY, raw);
  }
  for (const l of listeners) l();
}

export function toggleFeatureFlagComunidad(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  flag: FlagModuloComunidad,
  valor: boolean
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!esModeradoraOAdmin(actor)) {
    return { ok: false, error: "Solo administración puede cambiar módulos.", estado };
  }
  if (flag === "aiAssistant") {
    return {
      ok: false,
      error: "Fase 24 (IA) se encuentra desactivada por decisión del producto.",
      estado,
    };
  }
  return {
    ok: true,
    estado: {
      ...estado,
      featureFlags: { ...estado.featureFlags, [flag]: valor },
    },
  };
}

// ---------- FASE 13: Retroalimentación rápida de calce ----------
export function registrarRetroalimentacionCalce(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  input: {
    molde_categoria: string;
    version_config: number;
    bustoCm: number;
    cinturaCm: number;
    caderaCm: number;
    tela_usada: string;
    ajuste_talle: PercepcionZonaCalce;
    ajuste_busto: PercepcionZonaCalce;
    ajuste_cintura: PercepcionZonaCalce;
    ajuste_cadera: PercepcionZonaCalce;
    ajuste_hombros: PercepcionZonaCalce;
    ajuste_manga: PercepcionZonaCalce;
    volveria_hacer: boolean;
  }
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) {
    return { ok: false, error: "Inicia sesión para compartir cómo te quedó el molde.", estado };
  }
  const nuevo: RetroalimentacionCalce = {
    id: `calce-${Date.now()}`,
    autora_id: actor.id,
    molde_categoria: input.molde_categoria,
    version_config: input.version_config,
    // Privacidad: nunca guardamos el cm exacto, solo el rango de 5 cm
    rango_busto_5cm: agruparEnRango5Cm(input.bustoCm),
    rango_cintura_5cm: agruparEnRango5Cm(input.cinturaCm),
    rango_cadera_5cm: agruparEnRango5Cm(input.caderaCm),
    tela_usada: input.tela_usada.trim() || "Popelina / Algodón",
    ajuste_talle: input.ajuste_talle,
    ajuste_busto: input.ajuste_busto,
    ajuste_cintura: input.ajuste_cintura,
    ajuste_cadera: input.ajuste_cadera,
    ajuste_hombros: input.ajuste_hombros,
    ajuste_manga: input.ajuste_manga,
    volveria_hacer: input.volveria_hacer,
    es_probadora_beta: estado.probadorasBetaIds.includes(actor.id),
    es_demo: false,
    creado_en: new Date().toISOString(),
  };

  return {
    ok: true,
    estado: {
      ...estado,
      retroalimentaciones: [nuevo, ...estado.retroalimentaciones],
    },
  };
}

export function alternarProbadoraBeta(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null
): EstadoAmpliacionComunidad {
  if (!actor) return estado;
  const existe = estado.probadorasBetaIds.includes(actor.id);
  return {
    ...estado,
    probadorasBetaIds: existe
      ? estado.probadorasBetaIds.filter((id) => id !== actor.id)
      : [...estado.probadorasBetaIds, actor.id],
  };
}

// ---------- FASE 14: Biblioteca de ajustes que funcionaron (k >= 5) ----------
export function crearAjusteMolde(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  input: {
    molde_categoria: string;
    version_config: number;
    bustoCm: number;
    zona: ZonaAjusteMolde;
    cm_delta: number;
    descripcion_corta: string;
  }
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) {
    return { ok: false, error: "Inicia sesión para aportar un ajuste.", estado };
  }
  if (input.descripcion_corta.trim().length < 10) {
    return {
      ok: false,
      error: "Describe el ajuste en al menos 10 caracteres claros.",
      estado,
    };
  }
  const nuevo: AjusteMoldeComunidad = {
    id: `ajuste-${Date.now()}`,
    autora_id: actor.id,
    molde_categoria: input.molde_categoria,
    version_config: input.version_config,
    rango_busto_5cm: agruparEnRango5Cm(input.bustoCm),
    zona: input.zona,
    cm_delta: Math.max(-15, Math.min(15, Number(input.cm_delta) || 0)),
    descripcion_corta: input.descripcion_corta.trim(),
    conteo_me_funciono: 1,
    usuarios_que_confirmaron: [actor.id],
    estado_editorial: "pendiente",
    es_demo: false,
    creado_en: new Date().toISOString(),
  };

  return {
    ok: true,
    estado: {
      ...estado,
      ajustesMolde: [nuevo, ...estado.ajustesMolde],
    },
  };
}

export function marcarMeFuncionoAjuste(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  ajusteId: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) {
    return { ok: false, error: "Inicia sesión para confirmar si te funcionó.", estado };
  }
  return {
    ok: true,
    estado: {
      ...estado,
      ajustesMolde: estado.ajustesMolde.map((a) => {
        if (a.id !== ajusteId) return a;
        const ya = a.usuarios_que_confirmaron.includes(actor.id);
        return {
          ...a,
          conteo_me_funciono: ya
            ? Math.max(0, a.conteo_me_funciono - 1)
            : a.conteo_me_funciono + 1,
          usuarios_que_confirmaron: ya
            ? a.usuarios_que_confirmaron.filter((id) => id !== actor.id)
            : [...a.usuarios_que_confirmaron, actor.id],
        };
      }),
    },
  };
}

export function obtenerAjustesAgrupadosConKAnonimato(
  estado: EstadoAmpliacionComunidad,
  moldeCategoria?: string
) {
  const filtrados = moldeCategoria
    ? estado.ajustesMolde.filter((a) => a.molde_categoria === moldeCategoria)
    : estado.ajustesMolde;

  return agregarConKAnonimato(
    filtrados,
    (a) => `${a.molde_categoria} · Busto ${a.rango_busto_5cm}`,
    (a) => a.autora_id,
    MIN_K_ANONIMATO
  );
}

// ---------- FASE 15: Bitácora por etapas ----------
export function crearBitacoraProyecto(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  input: {
    titulo: string;
    prenda: string;
    tela: string;
    molde_categoria: string;
    notaInicial: string;
  }
): { ok: boolean; error?: string; bitacoraId?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) {
    return { ok: false, error: "Inicia sesión para iniciar una bitácora.", estado };
  }
  if (input.titulo.trim().length < 4) {
    return { ok: false, error: "Escribe un título de proyecto claro.", estado };
  }
  const id = `bit-${Date.now()}`;
  const ahora = new Date().toISOString();
  const nueva: BitacoraProyecto = {
    id,
    autora_id: actor.id,
    titulo: input.titulo.trim(),
    prenda: input.prenda.trim() || "Vestido",
    tela: input.tela.trim() || "Lino",
    molde_categoria: input.molde_categoria || "dress",
    etapa_actual: "molde",
    etapas: [
      {
        id: `et-${Date.now()}`,
        nombre: "molde",
        nota: input.notaInicial.trim() || "Trazo e impresión del molde base.",
        creado_en: ahora,
      },
    ],
    es_demo: false,
    creado_en: ahora,
    actualizado_en: ahora,
  };
  return {
    ok: true,
    bitacoraId: id,
    estado: {
      ...estado,
      bitacoras: [nueva, ...estado.bitacoras],
    },
  };
}

export function agregarEtapaBitacora(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  input: {
    bitacoraId: string;
    nombre: EtapaBitacoraNombre;
    nota: string;
    fotoUrl?: string;
    altFoto?: string;
  }
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para actualizar tu bitácora.", estado };
  const target = estado.bitacoras.find((b) => b.id === input.bitacoraId);
  if (!target || target.autora_id !== actor.id) {
    return { ok: false, error: "Solo la autora puede editar su bitácora.", estado };
  }
  const ahora = new Date().toISOString();
  return {
    ok: true,
    estado: {
      ...estado,
      bitacoras: estado.bitacoras.map((b) =>
        b.id === input.bitacoraId
          ? {
              ...b,
              etapa_actual: input.nombre,
              actualizado_en: ahora,
              etapas: [
                ...b.etapas,
                {
                  id: `et-${Date.now()}`,
                  nombre: input.nombre,
                  nota: input.nota.trim(),
                  fotoUrl: input.fotoUrl,
                  altFoto: input.altFoto,
                  creado_en: ahora,
                },
              ],
            }
          : b
      ),
    },
  };
}

// ---------- FASE 18: Encargos y consentimiento temporal revocable (30 días) ----------
export function crearSolicitudEncargo(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  input: {
    modistaId: string;
    titulo_prenda: string;
    config_molde: ConfigMoldeSerializado;
    captura_3d_url?: string;
    tela_color_deseado: string;
    notas_clienta: string;
    compartirMedidasAhora?: boolean;
    medidasSnapshot?: Record<string, number>;
  }
): { ok: boolean; error?: string; encargoId?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) {
    return { ok: false, error: "Inicia sesión para enviar un encargo.", estado };
  }
  if (actor.id === input.modistaId) {
    return { ok: false, error: "No puedes enviarte un encargo a ti misma.", estado };
  }
  const abiertas = estado.encargos.filter(
    (e) =>
      e.clienta_id === actor.id &&
      (e.estado === "enviada" || e.estado === "aceptada" || e.estado === "en_proceso")
  );
  if (abiertas.length >= 3) {
    return {
      ok: false,
      error: "Límite alcanzado: máximo 3 solicitudes abiertas al mismo tiempo.",
      estado,
    };
  }
  const ahora = Date.now();
  const id = `enc-${ahora}`;
  const comparte = Boolean(input.compartirMedidasAhora && input.medidasSnapshot);
  const nuevo: EncargoModista = {
    id,
    clienta_id: actor.id,
    modista_id: input.modistaId,
    titulo_prenda: input.titulo_prenda.trim(),
    config_molde: input.config_molde,
    captura_3d_url: input.captura_3d_url,
    tela_color_deseado: input.tela_color_deseado.trim(),
    notas_clienta: input.notas_clienta.trim(),
    estado: "enviada",
    medidas_compartidas: comparte,
    medidas_snapshot: comparte ? input.medidasSnapshot : undefined,
    consentimiento_expira_en: comparte
      ? new Date(ahora + 30 * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    mensajes: [
      {
        id: `msg-${ahora}`,
        autora_id: actor.id,
        contenido: `Solicitud enviada (${input.tela_color_deseado}). ${input.notas_clienta}`,
        creado_en: new Date(ahora).toISOString(),
      },
    ],
    es_demo: false,
    creado_en: new Date(ahora).toISOString(),
    actualizado_en: new Date(ahora).toISOString(),
  };

  return {
    ok: true,
    encargoId: id,
    estado: {
      ...estado,
      encargos: [nuevo, ...estado.encargos],
      auditoriaMedidas: comparte
        ? [
            {
              id: `aud-${ahora}`,
              encargo_id: id,
              visor_id: actor.id,
              accion: "Clienta compartió medidas de forma temporal (30 días)",
              creado_en: new Date(ahora).toISOString(),
            },
            ...estado.auditoriaMedidas,
          ]
        : estado.auditoriaMedidas,
    },
  };
}

export function alternarConsentimientoMedidasEncargo(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  encargoId: string,
  compartir: boolean,
  medidasSnapshot?: Record<string, number>
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para gestionar permisos.", estado };
  const enc = estado.encargos.find((e) => e.id === encargoId);
  if (!enc || enc.clienta_id !== actor.id) {
    return {
      ok: false,
      error: "Solo la clienta dueña de sus medidas puede autorizar o revocar este acceso.",
      estado,
    };
  }
  const ahora = Date.now();
  return {
    ok: true,
    estado: {
      ...estado,
      encargos: estado.encargos.map((e) =>
        e.id === encargoId
          ? {
              ...e,
              medidas_compartidas: compartir,
              medidas_snapshot: compartir
                ? medidasSnapshot ?? e.medidas_snapshot ?? { bust: 92, waist: 72, hip: 98 }
                : undefined,
              consentimiento_expira_en: compartir
                ? new Date(ahora + 30 * 24 * 60 * 60 * 1000).toISOString()
                : undefined,
              consentimiento_revocado_en: compartir ? undefined : new Date(ahora).toISOString(),
            }
          : e
      ),
      auditoriaMedidas: [
        {
          id: `aud-${ahora}`,
          encargo_id: encargoId,
          visor_id: actor.id,
          accion: compartir
            ? "Clienta activó acceso temporal (30 días) a medidas"
            : "Clienta revocó acceso a medidas",
          creado_en: new Date(ahora).toISOString(),
        },
        ...estado.auditoriaMedidas,
      ],
    },
  };
}

export function registrarLecturaMedidasModista(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  encargoId: string,
  ahoraMs = Date.now()
): { permitido: boolean; medidas?: Record<string, number>; motivo?: string; estado: EstadoAmpliacionComunidad } {
  const enc = estado.encargos.find((e) => e.id === encargoId);
  if (!actor || !enc) {
    return { permitido: false, motivo: "Encargo no encontrado.", estado };
  }
  if (actor.id !== enc.clienta_id && actor.id !== enc.modista_id) {
    return { permitido: false, motivo: "No eres parte de este encargo.", estado };
  }
  if (!enc.medidas_compartidas || enc.consentimiento_revocado_en || !enc.medidas_snapshot) {
    return {
      permitido: false,
      motivo: "La clienta no ha compartido medidas o ya revocó el permiso.",
      estado,
    };
  }
  if (enc.consentimiento_expira_en && new Date(enc.consentimiento_expira_en).getTime() < ahoraMs) {
    return {
      permitido: false,
      motivo: "El permiso temporal de 30 días venció automáticamente.",
      estado,
    };
  }

  return {
    permitido: true,
    medidas: enc.medidas_snapshot,
    estado: {
      ...estado,
      auditoriaMedidas: [
        {
          id: `aud-read-${ahoraMs}`,
          encargo_id: encargoId,
          visor_id: actor.id,
          accion: `Consulta autorizada de ficha de medidas por ${actor.id}`,
          creado_en: new Date(ahoraMs).toISOString(),
        },
        ...estado.auditoriaMedidas,
      ],
    },
  };
}

export function actualizarEstadoEncargo(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  encargoId: string,
  nuevoEstado: EstadoEncargo,
  mensajeOpcional?: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para continuar.", estado };
  const enc = estado.encargos.find((e) => e.id === encargoId);
  if (!enc) return { ok: false, error: "Encargo no encontrado.", estado };
  if (actor.id !== enc.modista_id && actor.id !== enc.clienta_id) {
    return { ok: false, error: "Sin permiso sobre este encargo.", estado };
  }
  const ahora = new Date().toISOString();
  return {
    ok: true,
    estado: {
      ...estado,
      encargos: estado.encargos.map((e) =>
        e.id === encargoId
          ? {
              ...e,
              estado: nuevoEstado,
              actualizado_en: ahora,
              mensajes: mensajeOpcional?.trim()
                ? [
                    ...e.mensajes,
                    {
                      id: `msg-${Date.now()}`,
                      autora_id: actor.id,
                      contenido: mensajeOpcional.trim(),
                      creado_en: ahora,
                    },
                  ]
                : e.mensajes,
            }
          : e
      ),
    },
  };
}

export function publicarResenaEncargo(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  encargoId: string,
  calificacion: 1 | 2 | 3 | 4 | 5,
  comentario: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para dejar reseña.", estado };
  const enc = estado.encargos.find((e) => e.id === encargoId);
  if (!enc || enc.clienta_id !== actor.id) {
    return { ok: false, error: "Solo la clienta puede reseñar su encargo.", estado };
  }
  if (enc.estado !== "aceptada" && enc.estado !== "en_proceso" && enc.estado !== "entregada") {
    return {
      ok: false,
      error: "Solo puedes dejar una reseña cuando el encargo fue aceptado o entregado.",
      estado,
    };
  }
  if (enc.resena) {
    return { ok: false, error: "Ya dejaste la única reseña permitida para este encargo.", estado };
  }
  return {
    ok: true,
    estado: {
      ...estado,
      encargos: estado.encargos.map((e) =>
        e.id === encargoId
          ? {
              ...e,
              resena: { calificacion, comentario: comentario.trim(), creado_en: new Date().toISOString() },
            }
          : e
      ),
    },
  };
}

// ---------- FASE 19: Círculos de costura ----------
export function unirseACirculo(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  circuloId: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para unirte al círculo.", estado };
  return {
    ok: true,
    estado: {
      ...estado,
      circulos: estado.circulos.map((c) => {
        if (c.id !== circuloId) return c;
        if (c.miembros_ids.includes(actor.id)) return c;
        if (c.tipo_acceso === "con_solicitud") {
          return c.pendientes_ids.includes(actor.id)
            ? c
            : { ...c, pendientes_ids: [...c.pendientes_ids, actor.id] };
        }
        return {
          ...c,
          miembros_ids: [...c.miembros_ids, actor.id],
          ultima_actividad_en: new Date().toISOString(),
        };
      }),
    },
  };
}

export function publicarEnCirculo(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  circuloId: string,
  contenido: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para escribir.", estado };
  const circ = estado.circulos.find((c) => c.id === circuloId);
  if (!circ || !circ.miembros_ids.includes(actor.id)) {
    return { ok: false, error: "Debes ser miembro activo de este círculo.", estado };
  }
  const ahora = new Date().toISOString();
  return {
    ok: true,
    estado: {
      ...estado,
      circulos: estado.circulos.map((c) =>
        c.id === circuloId
          ? {
              ...c,
              ultima_actividad_en: ahora,
              publicaciones_privadas: [
                {
                  id: `cpub-${Date.now()}`,
                  autora_id: actor.id,
                  contenido: contenido.trim(),
                  creado_en: ahora,
                },
                ...c.publicaciones_privadas,
              ],
            }
          : c
      ),
    },
  };
}

export function puedeLeerPublicacionesCirculo(
  circulo: CirculoCostura,
  actor: ActorSesion | null
): boolean {
  if (!actor) return false;
  if (esModeradoraOAdmin(actor)) return true;
  return circulo.miembros_ids.includes(actor.id);
}

// ---------- FASE 20: Mentoría 1 a 1 ----------
export function crearSolicitudMentoria(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  temaConcreto: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para pedir una mentoría.", estado };
  if (temaConcreto.trim().length < 12) {
    return {
      ok: false,
      error: "Describe tu duda puntual en al menos 12 caracteres.",
      estado,
    };
  }
  const ahora = Date.now();
  const nueva: SolicitudMentoria = {
    id: `ment-${ahora}`,
    aprendiz_id: actor.id,
    mentora_id: null,
    tema_concreto: temaConcreto.trim(),
    estado: "abierta",
    mensajes: [],
    agradecimiento_me_ayudo: false,
    vence_sin_respuesta_en: new Date(ahora + 7 * 24 * 60 * 60 * 1000).toISOString(),
    es_demo: false,
    creado_en: new Date(ahora).toISOString(),
  };
  return { ok: true, estado: { ...estado, mentorias: [nueva, ...estado.mentorias] } };
}

export function aceptarMentoriaComoMentora(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  mentoriaId: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para acompañar.", estado };
  const perfilPro = estado.perfilesPro.find((p) => p.usuaria_id === actor.id);
  const limite = perfilPro?.max_aprendices ?? 2;
  const activas = estado.mentorias.filter(
    (m) => m.mentora_id === actor.id && m.estado === "asignada"
  );
  if (activas.length >= limite) {
    return {
      ok: false,
      error: `Ya alcanzaste tu cupo máximo simultáneo de ${limite} aprendices.`,
      estado,
    };
  }
  return {
    ok: true,
    estado: {
      ...estado,
      mentorias: estado.mentorias.map((m) =>
        m.id === mentoriaId ? { ...m, mentora_id: actor.id, estado: "asignada" } : m
      ),
    },
  };
}

// ---------- FASE 22: Rutas de aprendizaje + Glosario ----------
export function alternarPasoRuta(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  rutaId: string,
  pasoId: string
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para guardar tu avance.", estado };
  const mapaUsuaria = estado.progresoRutasPorUsuaria[actor.id] ?? {};
  const pasos = mapaUsuaria[rutaId] ?? [];
  const nextPasos = pasos.includes(pasoId)
    ? pasos.filter((p) => p !== pasoId)
    : [...pasos, pasoId];

  return {
    ok: true,
    estado: {
      ...estado,
      progresoRutasPorUsuaria: {
        ...estado.progresoRutasPorUsuaria,
        [actor.id]: {
          ...mapaUsuaria,
          [rutaId]: nextPasos,
        },
      },
    },
  };
}

// ---------- FASE 23: Reseñas de proveedores anti-fraude ----------
export function publicarResenaProveedor(
  estado: EstadoAmpliacionComunidad,
  actor: ActorSesion | null,
  fechaCreacionCuentaIso: string,
  interaccionesPrevias: number,
  input: {
    proveedor_id: string;
    calificacion: 1 | 2 | 3 | 4 | 5;
    comentario: string;
    tiene_relacion_negocio: boolean;
  },
  ahoraMs = Date.now()
): { ok: boolean; error?: string; estado: EstadoAmpliacionComunidad } {
  if (!actor) return { ok: false, error: "Inicia sesión para opinar sobre una tienda.", estado };

  const edadDias =
    (ahoraMs - new Date(fechaCreacionCuentaIso).getTime()) / (1000 * 60 * 60 * 24);
  if (edadDias < 30 || interaccionesPrevias < 1) {
    return {
      ok: false,
      error:
        "Para proteger el directorio contra reseñas falsas, tu cuenta debe tener más de 30 días y al menos 1 participación previa en la comunidad.",
      estado,
    };
  }

  const yaReseno = estado.resenasProveedores.some(
    (r) => r.proveedor_id === input.proveedor_id && r.autora_id === actor.id
  );
  if (yaReseno) {
    return {
      ok: false,
      error: "Solo se permite 1 reseña por usuaria en cada tienda.",
      estado,
    };
  }

  // Detección de picos sospechosos: >= 3 reseñas en últimas 24 h al mismo negocio
  const ultimas24h = estado.resenasProveedores.filter(
    (r) =>
      r.proveedor_id === input.proveedor_id &&
      ahoraMs - new Date(r.creado_en).getTime() <= 24 * 60 * 60 * 1000
  );
  const textoPromocional = /(descuento|cupon|codigo promocional|compra ya|100% recomendado)/i.test(
    input.comentario
  );
  const marcadaRevision = ultimas24h.length >= 3 || textoPromocional;

  const nueva: ResenaProveedor = {
    id: `resprov-${ahoraMs}`,
    proveedor_id: input.proveedor_id,
    autora_id: actor.id,
    calificacion: input.calificacion,
    comentario: input.comentario.trim(),
    tiene_relacion_negocio: input.tiene_relacion_negocio,
    marcada_revision: marcadaRevision,
    razon_revision: marcadaRevision
      ? textoPromocional
        ? "Posible contenido promocional"
        : "Pico inusual de reseñas en 24 h"
      : undefined,
    es_demo: false,
    creado_en: new Date(ahoraMs).toISOString(),
  };

  return {
    ok: true,
    estado: {
      ...estado,
      resenasProveedores: [nueva, ...estado.resenasProveedores],
    },
  };
}