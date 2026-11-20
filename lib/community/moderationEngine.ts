import type { PreguntaComunidad } from "./types";

const PALABRAS_OFENSIVAS_ES: ReadonlyArray<string> = [
  "idiota",
  "estupida",
  "estupido",
  "imbecil",
  "ridicula",
  "ridiculo",
  "horrible cuerpo",
  "cuerpo feo",
  "das asco",
  "fea costura",
  "porqueria",
  "basura",
  "spam gratis",
  "gana dinero facil",
  "casino",
  "cripto",
];

const FRASES_CONSEJO_MEDICO: ReadonlyArray<string> = [
  "diagnostico medico",
  "receta medica",
  "toma este medicamento",
  "pastillas para adelgazar",
];

const STOPWORDS_ES = new Set([
  "como",
  "para",
  "con",
  "sin",
  "una",
  "uno",
  "unos",
  "unas",
  "los",
  "las",
  "del",
  "por",
  "que",
  "cual",
  "cuando",
  "donde",
  "sobre",
  "esta",
  "este",
  "esto",
  "pero",
  "porque",
  "puedo",
  "hacer",
  "tengo",
  "hago",
  "siento",
]);

export function normalizarTextoEspanol(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extraerMencionesUsuario(texto: string): string[] {
  const encontrados = texto.match(/@([a-z0-9_]{3,30})/g) ?? [];
  return Array.from(
    new Set(encontrados.map((m) => m.slice(1).toLowerCase()))
  );
}

/**
 * Filtro amable preventivo contra spam (múltiples enlaces), lenguaje ofensivo o críticas corporales.
 */
export function evaluarTextoModeracion(texto: string): {
  aprobado: boolean;
  motivo?: string;
  palabrasDetectadas: string[];
} {
  const norm = normalizarTextoEspanol(texto);
  const enlaces = texto.match(/https?:\/\/\S+/gi) ?? [];
  if (enlaces.length > 2) {
    return {
      aprobado: false,
      motivo:
        "Para evitar spam solo se permiten hasta 2 enlaces externos por publicación o comentario.",
      palabrasDetectadas: ["exceso_de_enlaces"],
    };
  }

  const detectadas: string[] = [];
  for (const termino of PALABRAS_OFENSIVAS_ES) {
    if (norm.includes(termino)) {
      detectadas.push(termino);
    }
  }
  if (detectadas.length > 0) {
    return {
      aprobado: false,
      motivo:
        "Queremos mantener un taller seguro y amable. Por favor reformula el texto sin descalificaciones ni spam.",
      palabrasDetectadas: detectadas,
    };
  }

  for (const med of FRASES_CONSEJO_MEDICO) {
    if (norm.includes(med)) {
      return {
        aprobado: false,
        motivo:
          "En esta comunidad compartimos tips de costura y patronaje; evita dar indicaciones o recetas médicas.",
        palabrasDetectadas: [med],
      };
    }
  }

  return { aprobado: true, palabrasDetectadas: [] };
}

function tokensSignificativos(texto: string): Set<string> {
  const norm = normalizarTextoEspanol(texto);
  const tokens = norm.split(" ").filter((t) => t.length >= 3 && !STOPWORDS_ES.has(t));
  return new Set(tokens);
}

/**
 * Busca preguntas parecidas existentes antes de publicar una nueva duda
 * para reducir duplicados en "Pregúntale a la modista".
 */
export function buscarPreguntasSimilares(
  titulo: string,
  detalle: string,
  preguntas: readonly PreguntaComunidad[],
  limite = 3
): PreguntaComunidad[] {
  const consultaTokens = tokensSignificativos(`${titulo} ${detalle}`);
  if (consultaTokens.size === 0) return [];

  const puntuadas: Array<{ pregunta: PreguntaComunidad; score: number }> = [];

  for (const p of preguntas) {
    if (p.oculto) continue;
    const targetTokens = tokensSignificativos(`${p.titulo} ${p.detalle}`);
    if (targetTokens.size === 0) continue;

    let interseccion = 0;
    consultaTokens.forEach((tok) => {
      if (targetTokens.has(tok)) interseccion++;
    });

    if (interseccion === 0) continue;
    const union = consultaTokens.size + targetTokens.size - interseccion;
    const jaccard = interseccion / Math.max(1, union);
    const boostResuelta = p.resuelta ? 0.08 : 0;
    const score = jaccard + boostResuelta;
    if (jaccard >= 0.14 || interseccion >= 2) {
      puntuadas.push({ pregunta: p, score });
    }
  }

  return puntuadas
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map((x) => x.pregunta);
}

export type AccionRateLimit =
  | "publicar"
  | "comentar"
  | "reaccionar"
  | "preguntar"
  | "reportar";

const LIMITES_POR_ACCION: Record<
  AccionRateLimit,
  { maxEventos: number; ventanaMs: number }
> = {
  publicar: { maxEventos: 4, ventanaMs: 10 * 60_000 },
  comentar: { maxEventos: 12, ventanaMs: 5 * 60_000 },
  reaccionar: { maxEventos: 40, ventanaMs: 60_000 },
  preguntar: { maxEventos: 3, ventanaMs: 10 * 60_000 },
  reportar: { maxEventos: 5, ventanaMs: 10 * 60_000 },
};

/**
 * Control de frecuencia (rate limit) para evitar abuso o bots.
 */
export function verificarRateLimitUsuaria(
  accion: AccionRateLimit,
  historialMs: readonly number[],
  ahoraMs: number = Date.now()
): { permitido: boolean; segundosRestantes: number } {
  const regla = LIMITES_POR_ACCION[accion];
  const recientes = historialMs.filter((t) => ahoraMs - t <= regla.ventanaMs);
  if (recientes.length < regla.maxEventos) {
    return { permitido: true, segundosRestantes: 0 };
  }
  const masAntiguo = Math.min(...recientes);
  const faltanMs = Math.max(1000, regla.ventanaMs - (ahoraMs - masAntiguo));
  return {
    permitido: false,
    segundosRestantes: Math.ceil(faltanMs / 1000),
  };
}

export const PLANTILLAS_MENSAJES_MODERACION = {
  aprobar:
    "¡Tu prenda ya está publicada en la galería de MoldeFácil! Gracias por compartir tus avances con el taller.",
  ocultar:
    "Tu publicación o comentario fue ocultado temporalmente porque incumple nuestras normas de convivencia o privacidad. Puedes editarlo o escribirnos si fue un error.",
  advertir:
    "Recordatorio amable del equipo: cuidamos un ambiente de respeto hacia todos los cuerpos y procesos de aprendizaje, además de confirmar permisos antes de mostrar rostros.",
  suspender:
    "Tu cuenta ha sido pausada temporalmente por reportes reiterados o spam. Contáctanos si consideras que hubo un malentendido.",
} as const;