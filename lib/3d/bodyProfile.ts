import {
  AnilloPerfil,
  Medidas,
  NombreSeccionAnatomica,
  POSE_RELAJADA_POR_DEFECTO,
  PerfilCuerpo,
  PoseManiquiArticulado,
  TrayectoriaBrazo3D,
  TrayectoriaPierna3D,
  TrayectoriasCuerpo,
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

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Resuelve los semiejes `a` (ancho) y `b` (profundidad) de una elipse dado su perímetro `P`
 * y relación `ratio = b / a` mediante la aproximación de Ramanujan.
 */
export function resolverSemiejesElipse(
  perimetroM: number,
  relacionBA: number
): { a: number; b: number } {
  const ratio = clamp(relacionBA, 0.25, 1.35);
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
 * Calcula las trayectorias 3D reales de cabeza, cuello, brazos y piernas en Pose A relajada
 * como fuente única de verdad para el maniquí articulado y todas las prendas.
 */
function calcularTrayectoriasCuerpo(params: {
  alturaTotalM: number;
  bustoCm: number;
  caderaCm: number;
  contornoCabezaM: number;
  contornoMusloM: number;
  cuello: AnilloPerfil;
  hombros: AnilloPerfil;
  cadera: AnilloPerfil;
  muslo: AnilloPerfil;
  alturaRodillaM: number;
  alturaTobilloM: number;
  pose: PoseManiquiArticulado;
}): TrayectoriasCuerpo {
  const {
    alturaTotalM,
    bustoCm,
    caderaCm,
    contornoCabezaM,
    contornoMusloM,
    cuello,
    hombros,
    cadera,
    muslo,
    alturaRodillaM,
    alturaTobilloM,
    pose,
  } = params;

  const escEst = clamp(alturaTotalM / 1.65, 0.52, 1.25);

  // Cabeza ovoide: altura ≈ 1 / 7.5 de la altura total
  const alturaCabezaM = alturaTotalM / 7.5;
  const radioCabezaY = alturaCabezaM * 0.5;
  const cabezaElipse = resolverSemiejesElipse(contornoCabezaM, 1.14);
  const radioCabezaX = clamp(
    cabezaElipse.a,
    alturaCabezaM * 0.31,
    alturaCabezaM * 0.48
  );
  const radioCabezaZ = clamp(
    cabezaElipse.b,
    radioCabezaX * 1.06,
    alturaCabezaM * 0.54
  );

  // Cuello conecta la parte superior del torso (`cuello.y`) con la base craneal
  const largoCuelloM = clamp(alturaTotalM * 0.044, 0.036, 0.088);
  const centroCabezaY = Math.min(
    alturaTotalM - radioCabezaY,
    cuello.y + largoCuelloM * 0.84 + radioCabezaY * 0.88
  );
  const centroCabezaZ = cuello.desplazamientoZ * 0.72;
  const radioCuelloM = clamp((cuello.a + cuello.b) * 0.49, 0.028 * escEst, 0.072);

  // Radios de brazo derivados de busto con mínimos proporcionales a la estatura
  const factorBusto = clamp(bustoCm / 92, 0.78, 1.48);
  const radioHombroM = clamp(0.0355 * escEst * Math.sqrt(factorBusto), 0.024 * escEst, 0.058 * escEst);
  const radioCodoM = clamp(radioHombroM * 0.77, 0.019 * escEst, 0.045 * escEst);
  const radioMunecaM = clamp(radioHombroM * 0.56, 0.014 * escEst, 0.033 * escEst);

  // Longitudes de brazo proporcionales a altura total
  const largoBrazoSupM = alturaTotalM * 0.175;
  const largoAntebrazoM = alturaTotalM * 0.156;
  const largoManoM = alturaTotalM * 0.098;

  const angSepRad = deg2rad(clamp(pose.anguloBrazoDeg, 16, 30));
  const flexCodoRad = deg2rad(clamp(pose.flexionCodoDeg, 4, 24));
  const angAntSepRad = angSepRad * 0.62;

  const crearTrayectoriaBrazo = (lado: -1 | 1): TrayectoriaBrazo3D => {
    // Articulación del hombro incrustada ligeramente en el remate del anillo de hombros
    const hombroX = lado * (hombros.a + radioHombroM * 0.28);
    const hombroY = hombros.y - radioHombroM * 0.14;
    const hombroZ = hombros.desplazamientoZ - 0.004 * escEst;

    // Codo separado lateralmente (`anguloBrazoDeg`) y ligeramente hacia atrás (-3°)
    const codoX = hombroX + lado * Math.sin(angSepRad) * largoBrazoSupM;
    const codoY = hombroY - Math.cos(angSepRad) * largoBrazoSupM;
    const codoZ = hombroZ - largoBrazoSupM * 0.04;

    // Antebrazo continúa ligeramente flexionado hacia adelante (`flexionCodoDeg`) y palma hacia muslo
    const anteCosFlex = Math.cos(flexCodoRad);
    const anteSinFlex = Math.sin(flexCodoRad);
    const munecaX = codoX + lado * Math.sin(angAntSepRad) * largoAntebrazoM;
    const munecaY =
      codoY - Math.cos(angAntSepRad) * anteCosFlex * largoAntebrazoM;
    const munecaZ = codoZ + anteSinFlex * largoAntebrazoM;

    const manoX = munecaX + lado * Math.sin(angAntSepRad * 0.42) * largoManoM;
    const manoY = munecaY - Math.cos(flexCodoRad * 1.1) * largoManoM;
    const manoZ = munecaZ + Math.sin(flexCodoRad * 0.7) * largoManoM;

    return {
      lado,
      hombro: [hombroX, hombroY, hombroZ],
      codo: [codoX, codoY, codoZ],
      muneca: [munecaX, munecaY, munecaZ],
      manoFin: [manoX, manoY, manoZ],
      radioHombroM,
      radioCodoM,
      radioMunecaM,
      largoManoM,
    };
  };

  // Radios de pierna derivados de cadera + contornoMuslo con mínimos proporcionales
  const radioMusloDesdeCadera = cadera.a * 0.39;
  const radioMusloDesdeMedida = (contornoMusloM / (2 * Math.PI)) * 0.92;
  const radioMusloBruto = radioMusloDesdeCadera * 0.65 + radioMusloDesdeMedida * 0.35;
  const minMusloM = 0.041 * escEst * clamp(caderaCm / 92, 0.85, 1.35);
  const maxMusloM = Math.max(minMusloM + 0.01, cadera.a * 0.435);
  const radioMusloM = clamp(radioMusloBruto, minMusloM, maxMusloM);

  const radioCaderaM = clamp(radioMusloM * 0.96, 0.036 * escEst, maxMusloM);
  const radioRodillaM = clamp(radioMusloM * 0.65, 0.027 * escEst, radioMusloM * 0.74);
  const radioTobilloM = clamp(radioMusloM * 0.44, 0.019 * escEst, radioRodillaM * 0.72);
  const largoPieM = clamp(alturaTotalM * 0.132, 0.13, 0.24);

  // Separación lateral de caderas/piernas asegurando holgura real entre muslos incluso en cadera 150
  const hipBaseX = Math.max(
    cadera.a * clamp(pose.factorSeparacionPiesCadera, 0.4, 0.62),
    radioMusloM + 0.014 * escEst
  );
  const kneeX = hipBaseX * 0.94;
  const ankleX = hipBaseX * 0.91;

  const hipY = Math.max(
    muslo.y + radioCaderaM * 0.25,
    (cadera.y + muslo.y) * 0.5
  );
  const thighY = muslo.y - (hipY - muslo.y) * 0.65 - 0.02 * escEst;

  const hipZ = cadera.desplazamientoZ * 0.55 + muslo.desplazamientoZ * 0.45;
  const kneeZ = hipZ + 0.011 * escEst;
  const ankleZ = hipZ + 0.002 * escEst;

  const tMusloAxis = clamp(
    (hipY - thighY) / Math.max(0.05, hipY - alturaRodillaM),
    0,
    1
  );
  const thighX = hipBaseX + (kneeX - hipBaseX) * tMusloAxis;
  const thighZ = hipZ + (kneeZ - hipZ) * tMusloAxis;

  const rotPieRad = deg2rad(pose.rotacionPieDeg);
  const crearTrayectoriaPierna = (lado: -1 | 1): TrayectoriaPierna3D => ({
    lado,
    cadera: [lado * hipBaseX, hipY, hipZ],
    musloAlto: [lado * thighX, thighY, thighZ],
    rodilla: [lado * kneeX, alturaRodillaM, kneeZ],
    tobillo: [lado * ankleX, alturaTobilloM, ankleZ],
    piePunta: [
      lado * (ankleX + Math.sin(rotPieRad) * largoPieM * 0.72),
      0.012 * escEst,
      ankleZ + Math.cos(rotPieRad) * largoPieM * 0.78,
    ],
    radioCaderaM,
    radioMusloM,
    radioRodillaM,
    radioTobilloM,
    largoPieM,
  });

  return {
    alturaCabezaM,
    centroCabeza: [0, centroCabezaY, centroCabezaZ],
    radioCabezaX,
    radioCabezaY,
    radioCabezaZ,
    largoCuelloM,
    radioCuelloM,
    brazoIzq: crearTrayectoriaBrazo(-1),
    brazoDer: crearTrayectoriaBrazo(1),
    piernaIzq: crearTrayectoriaPierna(-1),
    piernaDer: crearTrayectoriaPierna(1),
    pose,
  };
}

/**
 * Genera el perfil anatómico único del cuerpo (`getBodyProfile`) con figura completa de pie
 * apoyada en el piso (`y = 0`), ~40 anillos interpolados de torso y trayectorias paramétricas reales.
 */
export function getBodyProfile(
  medidas: Medidas,
  pose: PoseManiquiArticulado = POSE_RELAJADA_POR_DEFECTO
): PerfilCuerpo {
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
  const alturaCabezaM = alturaTotalM / 7.5;

  // Estatura real desde piso y = 0: cintura ~58.5 % de altura total para alojar cabeza 1/7.5 + cuello + piernas
  const cinturaYM = clamp(alturaTotalM * 0.585, 0.44, 1.18);
  const neckTopLimit = alturaTotalM - alturaCabezaM * 0.94 - cmAMetros(2.6);
  const cuelloYM = clamp(
    cinturaYM + largoTalleM,
    cinturaYM + cmAMetros(15),
    Math.max(cinturaYM + cmAMetros(18), neckTopLimit)
  );
  const talleEfectivoM = Math.max(0.14, cuelloYM - cinturaYM);

  const hombroYM =
    cuelloYM - clamp(talleEfectivoM * 0.088, cmAMetros(2.0), cmAMetros(4.0));
  const bustoYM = cinturaYM + talleEfectivoM * 0.44;
  const bajoBustoYM = cinturaYM + talleEfectivoM * 0.21;

  const caderaAltaYM =
    cinturaYM - clamp(alturaTiroM * 0.37, cmAMetros(4.5), cmAMetros(12));
  const caderaYM =
    cinturaYM - clamp(alturaTiroM * 0.74, cmAMetros(10), cmAMetros(23));
  const musloYM = Math.max(
    alturaTotalM * 0.37,
    cinturaYM -
      alturaTiroM -
      clamp(alturaTiroM * 0.11, cmAMetros(2.0), cmAMetros(4.0))
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
  const cuelloCm = clamp(bustoCm * 0.365, 26, 46);
  const cuello = crearAnilloPorPerimetro("cuello", cuelloYM, cuelloCm, 0.5);

  // Hombros: ancho transversal derivado de `anchoEspalda` y relación b/a = 0.50
  const aHombrosM = cmAMetros(
    Math.max(anchoEspaldaCm * 0.525, (bustoCm / Math.PI) * 0.56)
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
  const busto = crearAnilloPorPerimetro("busto", bustoYM, bustoCm, 2.3);
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
    -1.0
  );
  const cadera = crearAnilloPorPerimetro("cadera", caderaYM, caderaCm, -2.1);

  const musloTorsoCm = clamp(caderaCm * 0.89, 44, 142);
  const muslo = crearAnilloPorPerimetro("muslo", musloYM, musloTorsoCm, -1.1);

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

  // Tangentes monótonas para muestrear ~40 anillos garantizando paso exacto por los clave
  const ysClave = listaClaveDesc.map((r) => r.y);
  const asClave = listaClaveDesc.map((r) => r.a);
  const bsClave = listaClaveDesc.map((r) => r.b);
  const dzsClave = listaClaveDesc.map((r) => r.desplazamientoZ);

  const tA = calcularTangentesMonotonas(ysClave, asClave);
  const tB = calcularTangentesMonotonas(ysClave, bsClave);
  const tDz = calcularTangentesMonotonas(ysClave, dzsClave);

  const anillosInterpolados: AnilloPerfil[] = [];
  const muestrasPorTramo = [4, 7, 5, 5, 6, 6, 6]; // 40 anillos en total

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

  // Alturas reales de tobillo y rodilla medidas desde el piso y = 0
  const escEst = clamp(alturaTotalM / 1.65, 0.52, 1.25);
  const factorEntrepierna = clamp(
    (medidas.largoEntrepierna ?? 76) / (alturaTotalCm * 0.46),
    0.84,
    1.12
  );
  const alturaTobilloM = clamp(alturaTotalM * 0.048, 0.042 * escEst, 0.095);
  const rodillaBaseM =
    alturaTobilloM + (musloYM - alturaTobilloM) * 0.51 * factorEntrepierna;
  const alturaRodillaM = clamp(
    rodillaBaseM,
    alturaTobilloM + (musloYM - alturaTobilloM) * 0.42,
    musloYM - 0.10 * escEst
  );

  const contornoCabezaM = cmAMetros(clamp(medidas.contornoCabeza ?? 57, 46, 65));
  const contornoMusloM = cmAMetros(clamp(medidas.contornoMuslo ?? 58, 28, 92));
  const largoMangaM = cmAMetros(clamp(medidas.largoManga ?? 58, 16, 72));
  const anchoBotaM = cmAMetros(clamp(medidas.anchoBota ?? 38, 18, 80));

  const trayectorias = calcularTrayectoriasCuerpo({
    alturaTotalM,
    bustoCm,
    caderaCm,
    contornoCabezaM,
    contornoMusloM,
    cuello,
    hombros,
    cadera,
    muslo,
    alturaRodillaM,
    alturaTobilloM,
    pose,
  });

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
    contornoCabezaM,
    largoMangaM,
    contornoMusloM,
    anchoBotaM,
    trayectorias,
  };
}