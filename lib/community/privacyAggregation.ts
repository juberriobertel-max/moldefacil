/**
 * Reglas matemáticas de privacidad para agregación de calce y ajustes:
 * - Ninguna medida exacta se almacena ni se muestra públicamente: se agrupa en rangos de 5 cm.
 * - Umbral estricto de anonimato k >= 5 para desagregaciones públicas.
 */

export const MIN_K_ANONIMATO = 5;
export const MIN_RESPUESTAS_ESTADISTICA_ADMIN = 10;

export function agruparEnRango5Cm(valorCm: number): string {
  const limpio = Number.isFinite(valorCm) ? Math.max(40, Math.min(200, valorCm)) : 90;
  const inicio = Math.floor(limpio / 5) * 5;
  const fin = inicio + 4;
  return `${inicio}–${fin} cm`;
}

export interface GrupoAnonimo<T> {
  etiquetaRango: string;
  total: number;
  cumpleKAnonimato: boolean;
  etiquetaConfianza: "consolidado" | "poco_probado" | "oculto_por_privacidad";
  items: readonly T[];
}

/**
 * Agrupa registros por rango de 5 cm y oculta o marca la confianza cuando hay menos de k=5 personas.
 */
export function agregarConKAnonimato<T>(
  registros: readonly T[],
  obtenerRango: (item: T) => string,
  obtenerAutoraId: (item: T) => string,
  minK = MIN_K_ANONIMATO
): GrupoAnonimo<T>[] {
  const grupos = new Map<string, { items: T[]; autoras: Set<string> }>();

  for (const r of registros) {
    const rango = obtenerRango(r);
    const actual = grupos.get(rango) ?? { items: [], autoras: new Set<string>() };
    actual.items.push(r);
    actual.autoras.add(obtenerAutoraId(r));
    grupos.set(rango, actual);
  }

  return Array.from(grupos.entries())
    .map(([rango, data]) => {
      const autorasUnicas = data.autoras.size;
      const cumple = autorasUnicas >= minK;
      return {
        etiquetaRango: rango,
        total: data.items.length,
        cumpleKAnonimato: cumple,
        etiquetaConfianza: (cumple
          ? autorasUnicas >= MIN_RESPUESTAS_ESTADISTICA_ADMIN
            ? "consolidado"
            : "poco_probado"
          : "oculto_por_privacidad") as GrupoAnonimo<T>["etiquetaConfianza"],
        items: cumple ? data.items : [],
      };
    })
    .sort((a, b) => b.total - a.total);
}