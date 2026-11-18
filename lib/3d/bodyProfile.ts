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

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Resuelve los semiejes `a` (ancho) y `b` (profundidad) de una elipse dado su perímetro `P`
 * y relación `ratio = b / a` mediante la aproximación de Ramanujan.
 */
export function resolverSemiejesElipse(
  perimetroM: number,
  relacionBA: number
): { a: number; b: number } {
  const ratio = clamp(relacionBA, 0.25, 1.2);
  const factorRamanujan =
    Math.PI *
    (3 * (1 + ratio) - Math.sqrt((3 + ratio) * (1 + 3 * ratio)));
  const a = Math.max(0.015, perimetroM) / Math.max(0.0001, factorRamanujan);
  return { a, b: a * ratio };
}

/**
 * Calcula el perímetro real aproximado de una elipse con la fórmula de Ramanujan.
 */
export function calcularPerimetroElipseM(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/**
 * Tangentes Fritsch-Carlson para interpolación cúbica monótona sin rebotes ni invertidos.
 */
function calcularTangentesMonotonas(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const tangentes = new Array<number>(n).fill(0);
  if (n < 2) return tangentes;

  const deltas: number[] = [];
  const hs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i];
    const safeH = Math.abs(h) < 1e-6 ? (h < 0 ? -1e-6 : 1e-6) : h;
    hs.push(safeH);
    deltas.push((ys[i + 1] - ys[i]) / safeH);
  }

  tangentes[0] = deltas[0];
  tangentes[n - 1] = deltas[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      tangentes[i] = 0;
    } else {
      const w1 = 2 * hs[i] + hs[i - 1];
      const w2 = hs[i] + 2 * hs[i - 1];
      tangentes[i] =
        (w1 + w2) / (w1 / deltas[i - 1] + w2 / deltas[i]);
    }
  }

  return tangentes;
}

function evaluarHermiteMonotono(
  xs: number[],
  ys: number[],
  tangentes: number[],
  x: number
): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (n === 1) return ys[0];

  // Soportamos arrays ordenados ascendente o descendente en X (= Y anatómica)
  const asc = xs[n - 1] >= xs[0];
  if (asc) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
  } else {
    if (x >= xs[0]) return ys[0];
    if (x <= xs[n - 1]) return ys[n - 1];
  }

  let idx = n - 2;
  for (let i = 0; i < n - 1; i++) {
    if (asc ? x <= xs[i + 1] : x >= xs[i + 1]) {
      idx = i;
      break;
    }
  }

  const h = xs[idx + 1] - xs[idx];
  if (Math.abs(h) < 1e-7) return ys[idx];
  const t = clamp((x - xs[idx]) / h, 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return (
    h00 * ys[idx] +
    h10 * h * tangentes[idx] +
    h01 * ys[idx + 1] +
    h11 * h * tangentes[idx + 1]
  );
}

/**
 * Evalúa un anillo interpolado continuamente a cualquier altura `y` dentro del perfil corporal.
 */
export function evaluarPerfilEnY(
  anillosOrdenadosDesc: AnilloPerfil[],
  y: number
): AnilloPerfil {
  if (anillosOrdenadosDesc.length === 0) {
    return {
      y,
      a: 0.14,
      b: 0.1,
      desplazamientoZ: 0,
      perimetroObjetivoCm: 76,
    };
  }
  const ys = anillosOrdenadosDesc.map((r) => r.y);
  const as = anillosOrdenadosDesc.map((r) => r.a);
  const bs = anillosOrdenadosDesc.map((r) => r.b);
  const dzs = anillosOrdenadosDesc.map((r) => r.desplazamientoZ);

  const tA = calcularTangentesMonotonas(ys, as);
  const tB = calcularTangentesMonotonas(ys, bs);
  const tDz = calcularTangentesMonotonas(ys, dzs);

  const a = Math.max(0.03, evaluarHermiteMonotono(ys, as, tA, y));
  const b = Math.max(0.025, evaluarHermiteMonotono(ys, bs, tB, y));
  const desplazamientoZ = evaluarHermiteMonotono(ys, dzs, tDz, y);

  return {
    y,
    a,
    b,
    desplazamientoZ,
    perimetroObjetivoCm: Number((calcularPerimetroElipseM(a, b) * 100).toFixed(2)),
  };
}

/**
 * Genera el perfil anatómico único del cuerpo (`getBodyProfile`) con anillos calibrados
 * de cuello a muslo superior (~40 anillos interpolados, 64 segmentos radiales).
 */
export function getBodyProfile(medidas: Medidas): PerfilCuerpo {
  const bustoCm = clamp(medidas.busto || 92, 46, 150);
  const cinturaCm = clamp(medidas.cintura || 72, 42, 140);
  const caderaCm = clamp(medidas.cadera || 98, 48, 160);
  const anchoEspaldaCm = clamp(medidas.anchoEspalda || 37, 20, 58);
  const largoTalleCm = clamp(medidas.largoTalle || 42, 18, 58);
  const alturaTiroCm = clamp(medidas.alturaTiro || 27, 14, 42);
  const alturaTotalCm = clamp(medidas.alturaTotal ?? 165, 80, 195);

  const alturaTotalM = cmAMetros(alturaTotalCm);
  const largoTalleM = cmAMetros(largoTalleCm);
  const alturaTiroM = cmAMetros(alturaTiroCm);

  // Alturas clave coherentes con la estatura y el largo de talle real
  const cinturaYM = clamp(alturaTotalM * 0.62, 0.48, 1.24);
  const cuelloYM = Math.min(alturaTotalM - cmAMetros(16), cinturaYM + largoTalleM);
  const hombroYM = cuelloYM - clamp(largoTalleM * 0.088, cmAMetros(2.2), cmAMetros(4.2));
  const bustoYM = cinturaYM + largoTalleM * 0.44;
  const bajoBustoYM = cinturaYM + largoTalleM * 0.21;

  const caderaAltaYM = cinturaYM - clamp(alturaTiroM * 0.37, cmAMetros(5), cmAMetros(12));
  const caderaYM = cinturaYM - clamp(alturaTiroM * 0.74, cmAMetros(11), cmAMetros(24));
  const musloYM = Math.max(
    alturaTotalM * 0.36,
    cinturaYM - alturaTiroM - clamp(alturaTiroM * 0.14, cmAMetros(2.5), cmAMetros(5))
  );

  const crearAnilloPorPerimetro = (
    seccion: NombreSeccionAnatomica,
    y: number,
    perimetroCm: number,
    desplazamientoZCm: number
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

  // Cuello proporcional al busto/espalda
  const cuelloCm = clamp(bustoCm * 0.365, 28, 45);
  const cuello = crearAnilloPorPerimetro("cuello", cuelloYM, cuelloCm, 0.6);

  // Hombros: ancho transversal derivado directamente de `anchoEspalda` y relación b/a = 0.50
  const aHombrosM = cmAMetros(
    Math.max(anchoEspaldaCm * 0.525, (bustoCm / Math.PI) * 0.58)
  );
  const bHombrosM = aHombrosM * RELACIONES_ELIPSE_CUERPO.hombros;
  const hombros: AnilloPerfil = {
    y: hombroYM,
    a: aHombrosM,
    b: bHombrosM,
    desplazamientoZ: cmAMetros(0.1),
    perimetroObjetivoCm: Number(
      (calcularPerimetroElipseM(aHombrosM, bHombrosM) * 100).toFixed(2)
    ),
    seccion: "hombros",
  };

  // Busto, bajo busto, cintura, cadera alta, cadera completa y muslo superior
  const busto = crearAnilloPorPerimetro("busto", bustoYM, bustoCm, 2.5);
  const bajoBustoCm = bustoCm * 0.72 + cinturaCm * 0.28;
  const bajoBusto = crearAnilloPorPerimetro(
    "bajoBusto",
    bajoBustoYM,
    bajoBustoCm,
    0.7
  );
  const cintura = crearAnilloPorPerimetro("cintura", cinturaYM, cinturaCm, 0);
  const caderaAltaCm = cinturaCm * 0.28 + caderaCm * 0.72;
  const caderaAlta = crearAnilloPorPerimetro(
    "caderaAlta",
    caderaAltaYM,
    caderaAltaCm,
    -1.1
  );
  const cadera = crearAnilloPorPerimetro("cadera", caderaYM, caderaCm, -2.3);

  const musloTorsoCm = clamp(caderaCm * 0.91, 46, 146);
  const muslo = crearAnilloPorPerimetro("muslo", musloYM, musloTorsoCm, -1.2);

  const listaClaveDesc: AnilloPerfil[] = [
    cuello,
    hombros,
    busto,
    bajoBusto,
    cintura,
    caderaAlta,
    cadera,
    muslo,
  ];

  // Precomputar tangentes monótonas para muestrear ~40 anillos uniformes garantizando paso por los clave
  const ysClave = listaClaveDesc.map((r) => r.y);
  const asClave = listaClaveDesc.map((r) => r.a);
  const bsClave = listaClaveDesc.map((r) => r.b);
  const dzsClave = listaClaveDesc.map((r) => r.desplazamientoZ);

  const tA = calcularTangentesMonotonas(ysClave, asClave);
  const tB = calcularTangentesMonotonas(ysClave, bsClave);
  const tDz = calcularTangentesMonotonas(ysClave, dzsClave);

  const anillosInterpolados: AnilloPerfil[] = [];
  const muestrasPorTramo = [4, 7, 5, 5, 6, 6, 6]; // Sum = 39 intervalos -> 40 anillos incluyendo extremos

  for (let i = 0; i < listaClaveDesc.length - 1; i++) {
    const inicio = listaClaveDesc[i];
    const fin = listaClaveDesc[i + 1];
    const pasos = muestrasPorTramo[i] ?? 5;

    for (let s = 0; s < pasos; s++) {
      if (s === 0) {
        anillosInterpolados.push(inicio);
      } else {
        const frac = s / pasos;
        const y = inicio.y + (fin.y - inicio.y) * frac;
        const a = Math.max(0.03, evaluarHermiteMonotono(ysClave, asClave, tA, y));
        const b = Math.max(0.025, evaluarHermiteMonotono(ysClave, bsClave, tB, y));
        const dz = evaluarHermiteMonotono(ysClave, dzsClave, tDz, y);
        anillosInterpolados.push({
          y,
          a,
          b,
          desplazamientoZ: dz,
          perimetroObjetivoCm: Number(
            (calcularPerimetroElipseM(a, b) * 100).toFixed(2)
          ),
        });
      }
    }
  }
  anillosInterpolados.push(muslo);

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

  const alturaRodillaM = Math.max(
    alturaTotalM * 0.24,
    musloYM - cmAMetros((medidas.largoEntrepierna ?? 76) * 0.42)
  );
  const alturaTobilloM = Math.max(
    0.04,
    cinturaYM - alturaTiroM - cmAMetros(medidas.largoEntrepierna ?? 76)
  );

  return {
    anillosClave,
    anillosInterpolados,
    segmentosRadiales: 64,
    alturaTotalM,
    alturaTiroM,
    alturaRodillaM,
    alturaTobilloM,
    hombroYM,
    cuelloYM,
    bustoYM,
    cinturaYM,
    caderaYM,
    musloYM,
    contornoCabezaM: cmAMetros(clamp(medidas.contornoCabeza ?? 57, 46, 65)),
    largoMangaM: cmAMetros(clamp(medidas.largoManga ?? 58, 16, 72)),
    contornoMusloM: cmAMetros(clamp(medidas.contornoMuslo ?? 58, 28, 92)),
    anchoBotaM: cmAMetros(clamp(medidas.anchoBota ?? 38, 18, 80)),
  };
}
