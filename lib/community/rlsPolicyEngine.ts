import type {
  BloqueoUsuaria,
  ComentarioPublicacion,
  EstadoPublicacion,
  PerfilModista,
  PreguntaComunidad,
  PublicacionComunidad,
  ReporteModeracion,
  RespuestaComunidad,
  RolUsuaria,
  SeguidorRegistro,
} from "./types";

export interface ActorSesion {
  id: string;
  rol: RolUsuaria;
  suspendida?: boolean;
  publicaciones_aprobadas_count?: number;
}

export interface ContextoRelaciones {
  bloqueos?: readonly BloqueoUsuaria[];
  seguidores?: readonly SeguidorRegistro[];
}

export function esModeradoraOAdmin(actor: ActorSesion | null): boolean {
  if (!actor || actor.suspendida) return false;
  return actor.rol === "moderadora" || actor.rol === "admin";
}

export function puedeEditarContenido(
  actor: ActorSesion | null,
  autoraId: string
): boolean {
  if (!actor || actor.suspendida) return false;
  if (esModeradoraOAdmin(actor)) return true;
  return actor.id === autoraId;
}

export function hayBloqueoEntre(
  actorId: string | undefined | null,
  otraUsuariaId: string,
  bloqueos: readonly BloqueoUsuaria[] = []
): boolean {
  if (!actorId) return false;
  return bloqueos.some(
    (b) =>
      (b.bloqueadora_id === actorId && b.bloqueada_id === otraUsuariaId) ||
      (b.bloqueadora_id === otraUsuariaId && b.bloqueada_id === actorId)
  );
}

/**
 * Políticas de lectura para perfiles: respeta `visibilidad_perfil === 'solo_registradas'`
 * y bloqueos activos.
 */
export function puedeLeerPerfil(
  actor: ActorSesion | null,
  perfil: PerfilModista,
  ctx: ContextoRelaciones = {}
): boolean {
  if (actor && actor.id === perfil.id) return true;
  if (esModeradoraOAdmin(actor)) return true;
  if (perfil.suspendida) return false;
  if (hayBloqueoEntre(actor?.id, perfil.id, ctx.bloqueos)) return false;
  if (perfil.visibilidad_perfil === "solo_registradas") {
    return actor !== null;
  }
  return true;
}

/**
 * Devuelve una vista segura del perfil: oculta enlaces de WhatsApp/Instagram
 * cuando `mostrar_contacto` está desactivado o el visor es anónimo si así lo requiere.
 */
export function sanitizarPerfilPublico(
  perfil: PerfilModista,
  actor: ActorSesion | null
): Omit<PerfilModista, "enlace_whatsapp" | "enlace_instagram"> & {
  enlace_whatsapp?: string;
  enlace_instagram?: string;
} {
  const esDuenaOMod =
    actor !== null && (actor.id === perfil.id || esModeradoraOAdmin(actor));
  if (esDuenaOMod || perfil.mostrar_contacto) {
    return { ...perfil };
  }
  return {
    ...perfil,
    enlace_whatsapp: undefined,
    enlace_instagram: undefined,
  };
}

/**
 * Regla de primera publicación segura: cuentas nuevas con 0 publicaciones aprobadas
 * pasan obligatoriamente por revisión previa (`en_revision`) salvo que sea `borrador`
 * o quien publica sea moderadora/admin.
 */
export function resolverEstadoInicialPublicacion(
  actor: ActorSesion,
  estadoSolicitado: EstadoPublicacion
): EstadoPublicacion {
  if (actor.suspendida) {
    throw new Error("Tu cuenta se encuentra suspendida temporalmente.");
  }
  if (estadoSolicitado === "borrador") return "borrador";
  if (esModeradoraOAdmin(actor)) {
    return estadoSolicitado === "oculta" ? "oculta" : "publicada";
  }
  if ((actor.publicaciones_aprobadas_count ?? 0) === 0) {
    return "en_revision";
  }
  return "publicada";
}

/**
 * Políticas de lectura para publicaciones:
 * las `oculta`, `borrador` y `en_revision` solo son visibles por su autora y moderación.
 */
export function puedeLeerPublicacion(
  actor: ActorSesion | null,
  pub: PublicacionComunidad,
  ctx: ContextoRelaciones = {}
): boolean {
  if (actor && actor.id === pub.autora_id) return true;
  if (esModeradoraOAdmin(actor)) return true;
  if (hayBloqueoEntre(actor?.id, pub.autora_id, ctx.bloqueos)) return false;
  return pub.estado === "publicada";
}

export function puedeEditarPublicacion(
  actor: ActorSesion | null,
  pub: PublicacionComunidad
): boolean {
  if (!actor || actor.suspendida) return false;
  return actor.id === pub.autora_id || esModeradoraOAdmin(actor);
}

export function puedeBorrarPublicacion(
  actor: ActorSesion | null,
  pub: PublicacionComunidad
): boolean {
  if (!actor) return false;
  return actor.id === pub.autora_id || actor.rol === "admin";
}

/**
 * Regla de comentarios: valida publicación publicada, bloqueos, permiso de comentarios
 * de la autora (`todas` / `seguidoras` / `nadie`) y tope de 1 nivel de anidación.
 */
export function puedeComentarEnPublicacion(
  actor: ActorSesion | null,
  pub: PublicacionComunidad,
  autoraPerfil: PerfilModista,
  padreComentario?: ComentarioPublicacion | null,
  ctx: ContextoRelaciones = {}
): { permitido: boolean; motivo?: string } {
  if (!actor) {
    return { permitido: false, motivo: "Inicia sesión para comentar." };
  }
  if (actor.suspendida) {
    return { permitido: false, motivo: "Cuenta suspendida." };
  }
  if (pub.estado !== "publicada") {
    return { permitido: false, motivo: "No puedes comentar en esta publicación." };
  }
  if (hayBloqueoEntre(actor.id, pub.autora_id, ctx.bloqueos)) {
    return { permitido: false, motivo: "No disponible por configuración de bloqueo." };
  }
  if (padreComentario && padreComentario.padre_id) {
    return {
      permitido: false,
      motivo: "Solo se permite un nivel de respuesta en comentarios.",
    };
  }
  if (actor.id !== pub.autora_id && !esModeradoraOAdmin(actor)) {
    if (autoraPerfil.permiso_comentarios === "nadie") {
      return {
        permitido: false,
        motivo: "La modista desactivó los comentarios en su perfil.",
      };
    }
    if (autoraPerfil.permiso_comentarios === "seguidoras") {
      const laSigue = (ctx.seguidores ?? []).some(
        (s) => s.seguidora_id === actor.id && s.seguida_id === pub.autora_id
      );
      if (!laSigue) {
        return {
          permitido: false,
          motivo: "Solo seguidoras pueden comentar en este perfil.",
        };
      }
    }
  }
  return { permitido: true };
}

/**
 * Edición de comentario permitida solo a su autora dentro de los primeros 15 minutos
 * (o a moderación para ocultar contenido).
 */
export function puedeEditarComentario(
  actor: ActorSesion | null,
  comentario: ComentarioPublicacion,
  ahoraMs: number = Date.now()
): boolean {
  if (!actor) return false;
  if (esModeradoraOAdmin(actor)) return true;
  if (actor.id !== comentario.autora_id || actor.suspendida) return false;

  const creadoMs = new Date(comentario.creado_en).getTime();
  const quinceMinMs = 15 * 60 * 1000;
  return ahoraMs - creadoMs <= quinceMinMs;
}

export function puedeLeerPregunta(
  actor: ActorSesion | null,
  pregunta: PreguntaComunidad,
  ctx: ContextoRelaciones = {}
): boolean {
  if (actor && actor.id === pregunta.autora_id) return true;
  if (esModeradoraOAdmin(actor)) return true;
  if (hayBloqueoEntre(actor?.id, pregunta.autora_id, ctx.bloqueos)) return false;
  return !pregunta.oculto;
}

export function puedeAceptarRespuesta(
  actor: ActorSesion | null,
  pregunta: PreguntaComunidad,
  respuesta: RespuestaComunidad
): boolean {
  if (!actor || actor.suspendida) return false;
  if (respuesta.pregunta_id !== pregunta.id || respuesta.oculto) return false;
  return actor.id === pregunta.autora_id || esModeradoraOAdmin(actor);
}

export function puedeLeerReporte(
  actor: ActorSesion | null,
  reporte: ReporteModeracion
): boolean {
  if (!actor) return false;
  return actor.id === reporte.reportante_id || esModeradoraOAdmin(actor);
}

export function puedeModerarReporte(actor: ActorSesion | null): boolean {
  return esModeradoraOAdmin(actor);
}

export function puedeVotarEnReto(
  actor: ActorSesion | null,
  retoId: string,
  votosExistentes: ReadonlyArray<{ reto_id: string; votante_id: string }>
): boolean {
  if (!actor || actor.suspendida) return false;
  return !votosExistentes.some(
    (v) => v.reto_id === retoId && v.votante_id === actor.id
  );
}