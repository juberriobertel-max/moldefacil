import {
  AnilloPerfil,
  Medidas,
  NombreSeccionAnatomica,
  PerfilCuerpo,
  cmAMetros,
} from "./types";

/**
 * Relaciones iniciales profundidad/ancho (`b / a`) por sección anatómica.
 */
export const RELACIONES_ELIPSE_CUERPO: Readonly<
  Record<NombreSeccionAnatomica, number>
> = {
  cuello: 0.95,
  hombros: 0.5,
  busto: 0.78,
  bajoBusto: 0.72,
  cintura: 0.72,
  caderaAlta: 0.75,
  cadera: 0.8,
  muslo: 0.95,
};

/**
 * Resuelve los semiejes `a` (ancho) y `b` (profundidad) de una elipse dado su perímetro `P`
 * y relación `ratio = b / a` mediante la aproximación de Ramanujan.
 */
export function resolverSemiejesElipse(
  perimetroM: number,
  relacionBA: number
): { a: number; b: number } {
  const ratio = Math.max(0.25, Math.min(1.2, relacionBA));
  const factorRamanujan =
    Math.PI *
    (3 * (1 + ratio) - Math.sqrt((3 + ratio) * (1 + 3 * ratio)));
  const a = perimetroM / Math.max(0.0001, factorRamanujan);
  return { a, b: a * ratio };
}

/**
 * Calcula el perímetro real aproximado de una elipse con fórmula de Ramanujan.
 */
export function calcularPerimetroElipseM(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/**
 * Contrato puro Fase 1 (se implementa con Catmull-Rom completo y calibración en Fase 2).
 * Único punto de verdad geométrica del cuerpo para maniquí y prendas.
 */
export function getBodyProfile(medidas: Medidas): PerfilCuerpo {
  const alturaTotalM = cmAMetros(medidas.alturaTotal ?? 165);
  const largoTalleM = cmAMetros(medidas.largoTalle);
  const cinturaYM = alturaTotalM * 0.625;
  const cuelloYM = cinturaYM + largoTalleM;
  const hombroYM = cuelloYM - cmAMetros(3.5);
  const bustoYM = cinturaYM + largoTalleM * 0.48;
  const caderaYM = cinturaYM - cmAMetros(20);
  const alturaTiroM = cmAMetros(medidas.alturaTiro);
  const musloYM = Math.max(0.42, cinturaYM - alturaTiroM - cmAMetros(6));

  const crearAnilloBase = (
    seccion: NombreSeccionAnatomica,
    y: number,
    perimetroCm: number,
    desplazamientoZCm = 0
  ): AnilloPerfil => {
    const { a, b } = resolverSemiejesElipse(
      cmAMetros(perimetroCm),
      RELACIONES_ELIPSE_CUERPO[seccion]
    );
    return {
      y,
      a,
      b,
      desplazamientoZ: cmAMetros(desplazamientoZCm),
      perimetroObjetivoCm: perimetroCm,
      seccion,
    };
  };

  const cuello = crearAnilloBase("cuello", cuelloYM, 34);
  const hombros = crearAnilloBase(
    "hombros",
    hombroYM,
    Math.max(medidas.anchoEspalda * 2.55, medidas.busto * 0.98)
  );
  const busto = crearAnilloBase("busto", bustoYM, medidas.busto, 2.2);
  const bajoBusto = crearAnilloBase(
    "bajoBusto",
    bustoYM - cmAMetros(6),
    medidas.busto * 0.88 + medidas.cintura * 0.12,
    0.8
  );
  const cintura = crearAnilloBase("cintura", cinturaYM, medidas.cintura, 0);
  const caderaAlta = crearAnilloBase(
    "caderaAlta",
    cinturaYM - cmAMetros(10),
    medidas.cintura * 0.35 + medidas.cadera * 0.65,
    -1.0
  );
  const cadera = crearAnilloBase("cadera", caderaYM, medidas.cadera, -2.2);
  const muslo = crearAnilloBase(
    "muslo",
    musloYM,
    medidas.cadera * 0.94,
    -1.2
  );

  const anillosClave: Record<NombreSeccionAnatomica, AnilloPerfil> = {
    cuello,
    hombros,
    busto,
    bajoBusto,
    cintura,
    caderaAlta,
    cadera,
    muslo,
  };

  return {
    anillosClave,
    anillosInterpolados: [
      cuello,
      hombros,
      busto,
      bajoBusto,
      cintura,
      caderaAlta,
      cadera,
      muslo,
    ],
    segmentosRadiales: 64,
    alturaTotalM,
    alturaTiroM,
    alturaRodillaM: alturaTotalM * 0.285,
    alturaTobilloM: alturaTotalM * 0.055,
    hombroYM,
    cuelloYM,
    bustoYM,
    cinturaYM,
    caderaYM,
    musloYM,
    contornoCabezaM: cmAMetros(medidas.contornoCabeza ?? 57),
    largoMangaM: cmAMetros(medidas.largoManga ?? 58),
    contornoMusloM: cmAMetros(medidas.contornoMuslo ?? 58),
    anchoBotaM: cmAMetros(medidas.anchoBota ?? 38),
  };
}
