import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { evaluarPerfilEnY } from "./bodyProfile";
import {
  AnilloPerfil,
  ConfigPrenda,
  Etiqueta3DAncla,
  NivelDetalle3D,
  PerfilCuerpo,
  TipoEscote,
  cmAMetros,
} from "./types";

export const TILE_ESTAMPADO_M = 0.08;
export const OFFSET_COSTURA_M = 0.0024;

export interface Etiqueta3DProyectada {
  id: string;
  texto: Etiqueta3DAncla["texto"];
  xPx: number;
  yPx: number;
  visible: boolean;
}

export interface DatosCaidaAnimada {
  posicionesBase: Float32Array;
  pesos: Float32Array;
}

export interface OpcionesMallaPrenda {
  nivelDetalle: NivelDetalle3D;
  materialPrincipal: THREE.MeshPhysicalMaterial;
  materialForroOVista?: THREE.MeshPhysicalMaterial;
  mostrarCosturas: boolean;
  /** Factor extra de ceñido para telas elásticas como licra (mantiene r >= r_cuerpo). */
  ajusteTelaStretchM?: number;
}

export interface ResultadoMallaPrenda {
  grupo: THREE.Group;
  grupoCosturas: THREE.Group;
  etiquetas: Etiqueta3DAncla[];
  triangulosTotales: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Distancia radial de holgura Δr = ΔP / (2π) garantizando siempre radio prenda >= cuerpo + holgura mínima.
 */
function calcularDeltaRadioM(
  config: ConfigPrenda,
  y: number,
  perfil: PerfilCuerpo,
  ajusteStretchM = 0
): number {
  const esHolgado = config.silueta === "holgado";
  const holguraBaseCm =
    config.prenda === "chaqueta"
      ? esHolgado
        ? 9.5
        : 4.5
      : esHolgado
        ? 8.5
        : 2.2;

  const tCintura =
    1 - clamp(Math.abs(y - perfil.cinturaYM) / Math.max(0.1, perfil.hombroYM - perfil.cinturaYM), 0, 1);
  const ajusteCinturaCm = esHolgado ? 2.5 * tCintura : -1.2 * tCintura;
  const totalCm = holguraBaseCm + ajusteCinturaCm;

  const deltaM = cmAMetros(totalCm) / (2 * Math.PI) + ajusteStretchM;
  return Math.max(0.0022, deltaM);
}

/**
 * Altura superior del corpiño `h(θ)` en metros según el tipo de escote (`θ ∈ [-π, π]`, `0 = delantero centro`).
 */
export function calcularAlturaBordeSuperiorM(
  escote: TipoEscote,
  theta: number,
  perfil: PerfilCuerpo,
  escoteCerrado = false
): number {
  const absT = Math.abs(theta);
  const tFrente = clamp(1 - absT / (Math.PI * 0.5), 0, 1);
  const tEspalda = clamp((absT - Math.PI * 0.5) / (Math.PI * 0.5), 0, 1);

  const caidaBaseHombro = perfil.cuelloYM - cmAMetros(1.4);
  const alturaNuca = perfil.cuelloYM - cmAMetros(1.8);
  const pesoHombro = smoothstep(0.35, 1.15, absT) * (1 - tEspalda * 0.7);
  const lineaBase =
    caidaBaseHombro * pesoHombro +
    (perfil.cuelloYM - cmAMetros(2.0)) * (1 - pesoHombro) -
    tEspalda * cmAMetros(0.8);

  if (absT >= Math.PI * 0.52) {
    // Trasero suave
    return alturaNuca - tEspalda * cmAMetros(2.2) + pesoHombro * cmAMetros(0.6);
  }

  let dropDelanteroM = cmAMetros(7.5);
  switch (escote) {
    case "redondo":
      dropDelanteroM = escoteCerrado
        ? cmAMetros(2.8) * Math.pow(tFrente, 1.6)
        : cmAMetros(8.5) * Math.pow(tFrente, 1.85);
      break;
    case "v":
      dropDelanteroM = cmAMetros(14.5) * tFrente;
      break;
    case "wrap":
      dropDelanteroM = cmAMetros(15.0) * tFrente;
      break;
    case "cuadrado":
      dropDelanteroM = cmAMetros(10.5) * smoothstep(0.22, 0.42, tFrente);
      break;
    case "corazon": {
      const senoCentro = cmAMetros(12.2) * Math.pow(tFrente, 2.5);
      const arcoLobulo =
        cmAMetros(11.0) * Math.sin(clamp(tFrente * 1.4, 0, 1) * Math.PI * 0.65);
      dropDelanteroM = Math.max(senoCentro, arcoLobulo * 0.88);
      break;
    }
    case "barco":
      dropDelanteroM = cmAMetros(4.4) * smoothstep(0.05, 0.75, tFrente + 0.25);
      break;
    case "halter": {
      const caidaSisaHalter =
        cmAMetros(11.5) * Math.sin(clamp(absT / (Math.PI * 0.5), 0, 1) * Math.PI);
      dropDelanteroM = caidaSisaHalter + cmAMetros(2.4) * tFrente;
      break;
    }
    case "solapaSastre":
    case "camisero":
      dropDelanteroM = cmAMetros(14.0) * Math.pow(tFrente, 1.25);
      break;
  }

  return Math.max(
    perfil.bustoYM - cmAMetros(3.5),
    lineaBase - dropDelanteroM
  );
}

/**
 * Registra metadatos de caída animada y cuenta triángulos reales de una malla.
 */
function registrarMalla(
  mesh: THREE.Mesh,
  pesos?: Float32Array
): number {
  const posAttr = mesh.geometry.getAttribute("position");
  if (pesos && posAttr instanceof THREE.BufferAttribute) {
    const datos: DatosCaidaAnimada = {
      posicionesBase: new Float32Array(posAttr.array as ArrayLike<number>),
      pesos,
    };
    mesh.userData.datosCaida = datos;
  }
  const index = mesh.geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  return posAttr ? Math.floor(posAttr.count / 3) : 0;
}

/**
 * Normaliza los vértices garantizando suavizado continuo en costuras y 0 NaNs.
 */
function finalizarGeometria(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position");
  if (pos) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        pos.setXYZ(i, 0, 0, 0);
      }
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

interface LimiteSisa {
  yMin: number;
  yMax: number;
  thetaCentro: number;
  anchoRad: number;
}

const SISA_ESTANDAR: Omit<LimiteSisa, "yMin" | "yMax"> = {
  thetaCentro: Math.PI * 0.5,
  anchoRad: 0.44,
};

/**
 * Garantiza que un punto `(x, y, z)` en la zona del torso permanezca estrictamente fuera
 * de la elipse anatómica del maniquí a su altura real `y` con al menos `holguraMinM`.
 */
function proyectarFueraDelTorso(
  x: number,
  y: number,
  z: number,
  perfil: PerfilCuerpo,
  holguraMinM = 0.0025
): { x: number; y: number; z: number } {
  const yRef = clamp(y, perfil.musloYM, perfil.cuelloYM);
  const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, yRef);
  const aMin = anillo.a + holguraMinM;
  const bMin = anillo.b + holguraMinM;
  const dx = x / Math.max(1e-4, aMin);
  const dz = (z - anillo.desplazamientoZ) / Math.max(1e-4, bMin);
  const norm = Math.hypot(dx, dz);
  if (norm >= 1) return { x, y, z };
  if (norm < 1e-6) {
    return { x: 0, y, z: anillo.desplazamientoZ + bMin };
  }
  return {
    x: (dx / norm) * aMin,
    y,
    z: anillo.desplazamientoZ + (dz / norm) * bMin,
  };
}

/**
 * Calcula normal radial horizontal saliente del torso elíptico en `(y, theta)`.
 */
function calcularNormalTorso(anillo: AnilloPerfil, theta: number): THREE.Vector3 {
  const nx = Math.sin(theta) / Math.max(1e-4, anillo.a);
  const nz = Math.cos(theta) / Math.max(1e-4, anillo.b);
  return new THREE.Vector3(nx, 0, nz).normalize();
}

/**
 * Única fuente de verdad para la altura superior del corpiño incluyendo recorte de sisa sin mangas.
 */
function calcularAlturaTopEscoteYSisa(
  config: ConfigPrenda,
  theta: number,
  perfil: PerfilCuerpo
): number {
  const yMaxAbs = perfil.cuelloYM - cmAMetros(1.2);
  let yTopFinal = clamp(
    calcularAlturaBordeSuperiorM(
      config.escote,
      theta,
      perfil,
      config.escoteCerrado
    ),
    perfil.bustoYM - cmAMetros(4),
    yMaxAbs
  );

  if (config.manga === "ninguna") {
    const distSisa = Math.abs(Math.abs(theta) - SISA_ESTANDAR.thetaCentro);
    if (distSisa < SISA_ESTANDAR.anchoRad) {
      const factor = smoothstep(SISA_ESTANDAR.anchoRad, 0, distSisa);
      yTopFinal = Math.min(yTopFinal, perfil.hombroYM - cmAMetros(11) * factor);
    }
  }
  return yTopFinal;
}

interface MuestraTiraTorso {
  pos: THREE.Vector3;
  normalOut: THREE.Vector3;
}

/**
 * Construye una tira con relieve 3D real (`anchoM` tangencial a la superficie y `espesorM` radial)
 * sin deformaciones de marcos Frenet ni penetración en el maniquí.
 */
function construirTiraConRelieveSobreTorso(
  muestras: MuestraTiraTorso[],
  anchoM: number,
  espesorM: number,
  cerrado: boolean,
  perfil: PerfilCuerpo,
  holguraBaseM: number,
  material: THREE.MeshPhysicalMaterial,
  nombre: string,
  sesgoAncho = 0.5
): THREE.Mesh {
  const n = muestras.length;
  const pasos = cerrado ? n + 1 : n;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  let arcLen = 0;
  const corners = [
    { u: -(1 - sesgoAncho) * anchoM, v: espesorM, extraMin: holguraBaseM + espesorM * 0.85 },
    { u: sesgoAncho * anchoM, v: espesorM, extraMin: holguraBaseM + espesorM * 0.85 },
    { u: sesgoAncho * anchoM, v: 0, extraMin: holguraBaseM },
    { u: -(1 - sesgoAncho) * anchoM, v: 0, extraMin: holguraBaseM },
  ];

  // Emitimos 5 vértices por anillo (cerrando costura UV de perímetro) para caras con normales limpias
  for (let i = 0; i < pasos; i++) {
    const idxCur = i % n;
    const idxPrev = cerrado ? (i - 1 + n) % n : Math.max(0, i - 1);
    const idxNext = cerrado ? (i + 1) % n : Math.min(n - 1, i + 1);

    const pCur = muestras[idxCur].pos;
    if (i > 0) {
      arcLen += pCur.distanceTo(muestras[(i - 1) % n].pos);
    }

    const nOut = muestras[idxCur].normalOut.clone().normalize();
    const tangente = muestras[idxNext].pos
      .clone()
      .sub(muestras[idxPrev].pos);
    if (tangente.lengthSq() < 1e-10) {
      tangente.set(1, 0, 0);
    } else {
      tangente.normalize();
    }

    // Vector ancho W = N × T (strictly tangent to garment wall, never points radially inward)
    const dirAncho = new THREE.Vector3().crossVectors(nOut, tangente);
    if (dirAncho.lengthSq() < 1e-8) {
      dirAncho.set(0, 1, 0);
    } else {
      dirAncho.normalize();
    }

    for (let c = 0; c <= 4; c++) {
      const corner = corners[c % 4];
      const worldPt = pCur
        .clone()
        .addScaledVector(dirAncho, corner.u)
        .addScaledVector(nOut, corner.v);
      const seguro = proyectarFueraDelTorso(
        worldPt.x,
        worldPt.y,
        worldPt.z,
        perfil,
        corner.extraMin
      );
      pos.push(seguro.x, seguro.y, seguro.z);
      uvs.push(arcLen, (c / 4) * anchoM * 2);
    }
  }

  const cols = 5;
  for (let i = 0; i < pasos - 1; i++) {
    for (let c = 0; c < 4; c++) {
      const a = i * cols + c;
      const b = (i + 1) * cols + c;
      const cNext = i * cols + (c + 1);
      const d = (i + 1) * cols + (c + 1);
      idx.push(a, cNext, b, cNext, d, b);
    }
  }

  // Tapas inicial y final si la tira es abierta
  if (!cerrado && pasos >= 2) {
    idx.push(0, 2, 1, 0, 3, 2);
    const last = (pasos - 1) * cols;
    idx.push(last + 0, last + 1, last + 2, last + 0, last + 2, last + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  finalizarGeometria(geo);

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = nombre;
  registrarMalla(mesh);
  return mesh;
}

/**
 * Evalúa la coordenada 3D sobre el cuerpo desplazado con holgura, frunces holgados,
 * abultamiento sobre cinturón y opcionalmente extensión lateral continua tipo kimono.
 */
function muestrearPuntoTorsoPrenda(
  anillo: AnilloPerfil,
  theta: number,
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  ajusteStretchM: number
): { x: number; y: number; z: number; extKimono: number; pesoCaida: number } {
  const deltaR = calcularDeltaRadioM(config, anillo.y, perfil, ajusteStretchM);
  let rExtra = deltaR;

  // Silueta holgada / blusada: pliegues verticales y abultamiento bajo busto/sobre cinturón
  if (config.silueta === "holgado") {
    const esZonaPliegue = smoothstep(
      perfil.hombroYM - cmAMetros(5),
      perfil.cinturaYM,
      anillo.y
    );
    const amplitudPliegue = cmAMetros(0.7) * (0.35 + 0.65 * esZonaPliegue);
    // Oscilación estrictamente positiva sobre el mínimo para nunca perforar el maniquí
    rExtra += amplitudPliegue * (1 + Math.sin(16 * theta + 0.3)) * 0.55;

    if (config.cinturon) {
      const distCint = (anillo.y - (perfil.cinturaYM + cmAMetros(4))) / cmAMetros(6.5);
      const blusado = Math.exp(-distCint * distCint) * cmAMetros(2.4);
      rExtra += blusado;
    }
  } else if (config.cinturon) {
    // Cintura ligeramente recogida bajo el cinturón (mantiene >= r_cuerpo)
    const distCint = (anillo.y - perfil.cinturaYM) / cmAMetros(4.5);
    rExtra -= Math.exp(-distCint * distCint) * cmAMetros(0.4);
    rExtra = Math.max(0.002, rExtra);
  }

  const aTotal = anillo.a + rExtra;
  const bTotal = anillo.b + rExtra;

  let x = aTotal * Math.sin(theta);
  let y = anillo.y;
  let z = anillo.desplazamientoZ + bTotal * Math.cos(theta);
  let extKimono = 0;

  // Manga kimono continua: extensión lateral suave desde los anillos superiores/sisa
  if (
    config.manga === "kimono" &&
    config.prenda !== "falda" &&
    config.prenda !== "pantalon"
  ) {
    const axilaY = perfil.bustoYM - cmAMetros(5.5);
    const hombroTopeY = perfil.hombroYM - cmAMetros(1.0);
    if (anillo.y >= axilaY - cmAMetros(6) && anillo.y <= perfil.cuelloYM) {
      const yFactor = smoothstep(
        axilaY - cmAMetros(5.5),
        hombroTopeY - cmAMetros(2.0),
        anillo.y
      );
      const ladoSign = theta >= 0 ? 1 : -1;
      const distCostado = Math.abs(Math.abs(theta) - Math.PI * 0.5);
      const thetaFactor = Math.pow(clamp(1 - distCostado / 0.85, 0, 1), 1.45);
      extKimono = yFactor * thetaFactor;

      if (extKimono > 0.001) {
        const alcanceMangaM = Math.min(perfil.largoMangaM * 0.56, cmAMetros(31));
        const extLat = alcanceMangaM * extKimono;
        // Arco curvo suave bajo axila hacia brazo caído ~22°
        x += ladoSign * extLat * 0.92;
        y -= extLat * 0.38 * (1 - 0.35 * yFactor);
        z += cmAMetros(0.8) * extKimono;

        // Proyectamos fuera del anillo real a la nueva altura `y` para evitar perforar clavícula/hombro
        const seguro = proyectarFueraDelTorso(x, y, z, perfil, Math.max(0.0025, deltaR * 0.85));
        x = seguro.x;
        z = seguro.z;
      }
    }
  }

  const rangoY = Math.max(0.15, perfil.cuelloYM - (perfil.cinturaYM - cmAMetros(24)));
  const pesoCaida =
    clamp((perfil.cuelloYM - y) / rangoY, 0, 1) *
    (config.silueta === "holgado" ? 0.55 : 0.2);

  return { x, y, z, extKimono, pesoCaida };
}

/**
 * Construye la malla superior del corpiño (blusa, chaqueta, top de vestido o enterizo)
 * con recorte anatómico `h(θ)` en el escote.
 */
function construirCorpino(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInferiorM: number,
  opciones: OpcionesMallaPrenda
): { mesh: THREE.Mesh; etiquetaFrente?: Etiqueta3DAncla } {
  const segsRad = opciones.nivelDetalle === "movil" ? 40 : 64;
  const rows = opciones.nivelDetalle === "movil" ? 20 : 30;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  const yMinAbs = clamp(
    yInferiorM,
    perfil.caderaYM - cmAMetros(4),
    perfil.bustoYM - cmAMetros(2)
  );

  // Para envolvente (wrap), cortamos abertura delantera entre -0.24 y +0.24 rad en V profunda
  const esWrap = config.escote === "wrap";

  const positions: number[] = [];
  const uvs: number[] = [];
  const weights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const tRow = r / (rows - 1); // 0 arriba, 1 abajo
    for (let s = 0; s <= segsRad; s++) {
      const fracS = s / segsRad;
      const theta = (fracS - 0.5) * Math.PI * 2; // -π (atrás) -> 0 (frente) -> +π (atrás)
      const yTopFinal = calcularAlturaTopEscoteYSisa(config, theta, perfil);

      const y = yTopFinal + (yMinAbs - yTopFinal) * tRow;
      const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
      const pt = muestrearPuntoTorsoPrenda(
        anillo,
        theta,
        perfil,
        config,
        ajusteStretch
      );

      positions.push(pt.x, pt.y, pt.z);
      const circEstimado = Math.PI * (anillo.a + anillo.b);
      uvs.push((theta / (Math.PI * 2)) * circEstimado, y);
      weights.push(pt.pesoCaida);
    }
  }

  const cols = segsRad + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < segsRad; s++) {
      const fracMid = (s + 0.5) / segsRad;
      const thetaMid = (fracMid - 0.5) * Math.PI * 2;

      // Para escote wrap/solapa/camisero dejamos la V delantera abierta para superponer las vistas 3D
      if (
        (esWrap || config.escote === "solapaSastre" || config.escote === "camisero") &&
        r < Math.floor(rows * 0.55) &&
        Math.abs(thetaMid) < 0.24
      ) {
        continue;
      }

      const a = r * cols + s;
      const b = (r + 1) * cols + s;
      const c = r * cols + (s + 1);
      const d = (r + 1) * cols + (s + 1);
      indices.push(a, b, c, c, b, d);
    }
  }

  let geo: THREE.BufferGeometry = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  if (config.manga === "kimono") {
    // Plan A: soldar vértices coincidentes tras calcular el manto continuo kimono
    geo = mergeVertices(geo, 1e-4);
  }
  finalizarGeometria(geo);

  const mesh = new THREE.Mesh(geo, opciones.materialPrincipal);
  mesh.name = "garment-corpino";

  const bustoAnillo = perfil.anillosClave.busto;
  const etiquetaFrente: Etiqueta3DAncla = {
    id: "lbl-delantero",
    texto: "Delantero",
    posicionLocalM: [
      0,
      bustoAnillo.y - cmAMetros(2),
      bustoAnillo.desplazamientoZ + bustoAnillo.b + cmAMetros(2),
    ],
    normalLocal: [0, 0, 1],
  };

  registrarMalla(mesh, new Float32Array(weights));
  return { mesh, etiquetaFrente };
}

/**
 * Construye los dos paneles delanteros cruzados (derecho sobre izquierdo, +8 mm)
 * y la vista de 4 cm con grosor real (~3 mm) en escote wrap.
 */
function construirEscoteWrapConVistas(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInferiorM: number,
  opciones: OpcionesMallaPrenda
): { meshes: THREE.Mesh[]; etiquetaVista: Etiqueta3DAncla } {
  const meshes: THREE.Mesh[] = [];
  const matPrincipal = opciones.materialPrincipal;
  const matVista = opciones.materialForroOVista ?? matPrincipal;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  // Panel izquierdo (debajo) y derecho (encima +8 mm en normal)
  const paneles = [
    { signo: -1, normalExtra: 0.001, tStart: -0.78, tEnd: 0.34, nombre: "wrap-panel-izq" },
    { signo: 1, normalExtra: 0.0085, tStart: -0.36, tEnd: 0.78, nombre: "wrap-panel-der" },
  ];

  const rows = 16;
  const cols = 14;

  for (const pan of paneles) {
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const yStart = perfil.hombroYM - cmAMetros(1.5);
    const yEnd = yInferiorM;

    for (let r = 0; r < rows; r++) {
      const tr = r / (rows - 1);
      const y = yStart + (yEnd - yStart) * tr;
      const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
      const baseR = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + pan.normalExtra;

      // Diagonal del cruce del panel desde hombro hacia costado contrario en cintura
      const tDiagonalMin =
        pan.signo === 1
          ? THREE.MathUtils.lerp(0.18, pan.tStart, tr)
          : pan.tStart;
      const tDiagonalMax =
        pan.signo === -1
          ? THREE.MathUtils.lerp(-0.18, pan.tEnd, tr)
          : pan.tEnd;

      for (let c = 0; c < cols; c++) {
        const tc = c / (cols - 1);
        const theta = tDiagonalMin + (tDiagonalMax - tDiagonalMin) * tc;
        const a = anillo.a + baseR;
        const b = anillo.b + baseR;
        const x = a * Math.sin(theta);
        const z = anillo.desplazamientoZ + b * Math.cos(theta);
        pos.push(x, y, z);
        uvs.push((theta / (Math.PI * 2)) * (Math.PI * (a + b)), y);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = (r + 1) * cols + c;
        const cIdx = r * cols + (c + 1);
        const d = (r + 1) * cols + (c + 1);
        idx.push(a, b, cIdx, cIdx, b, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    finalizarGeometria(geo);

    const mesh = new THREE.Mesh(geo, matPrincipal);
    mesh.name = pan.nombre;
    registrarMalla(mesh);
    meshes.push(mesh);
  }

  // Vista de 4 cm con grosor real (~3 mm) tangencial a la superficie en la diagonal derecha
  const muestrasVista: MuestraTiraTorso[] = [];
  const pasosVista = 16;
  for (let i = 0; i <= pasosVista; i++) {
    const t = i / pasosVista;
    const y = THREE.MathUtils.lerp(
      perfil.hombroYM - cmAMetros(1.6),
      yInferiorM + cmAMetros(1.5),
      t
    );
    const theta = THREE.MathUtils.lerp(0.28, -0.34, t);
    const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
    const r = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.011;
    muestrasVista.push({
      pos: new THREE.Vector3(
        (anillo.a + r) * Math.sin(theta),
        y,
        anillo.desplazamientoZ + (anillo.b + r) * Math.cos(theta)
      ),
      normalOut: calcularNormalTorso(anillo, theta),
    });
  }

  const vistaMesh = construirTiraConRelieveSobreTorso(
    muestrasVista,
    cmAMetros(4.0),
    0.003,
    false,
    perfil,
    0.009,
    matVista,
    "wrap-vista-4cm",
    0.5
  );
  meshes.push(vistaMesh);

  const puntoMedioVista = muestrasVista[Math.floor(muestrasVista.length * 0.45)].pos;
  const etiquetaVista: Etiqueta3DAncla = {
    id: "lbl-vista",
    texto: "Vista 4 cm",
    posicionLocalM: [
      puntoMedioVista.x + 0.01,
      puntoMedioVista.y,
      puntoMedioVista.z + 0.015,
    ],
    normalLocal: [0, 0, 1],
  };

  return { meshes, etiquetaVista };
}

/**
 * Construye banda de terminación para escotes abiertos o solapa sastre/camisero + botones InstancedMesh.
 */
function construirCuellosYBotones(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInferiorM: number,
  opciones: OpcionesMallaPrenda
): { meshes: THREE.Object3D[]; etiquetaVista?: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const mat = opciones.materialForroOVista ?? opciones.materialPrincipal;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  // Banda limpia de borde superior sincronizada con h(θ) y sisa sin mangas
  if (
    config.escote !== "wrap" &&
    config.escote !== "solapaSastre" &&
    config.escote !== "camisero"
  ) {
    const pasos = 48;
    const muestrasRibete: MuestraTiraTorso[] = [];
    for (let i = 0; i < pasos; i++) {
      const theta = ((i / pasos) - 0.5) * Math.PI * 2;
      const y = calcularAlturaTopEscoteYSisa(config, theta, perfil);
      const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
      const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.0015;
      muestrasRibete.push({
        pos: new THREE.Vector3(
          (anillo.a + dr) * Math.sin(theta),
          y,
          anillo.desplazamientoZ + (anillo.b + dr) * Math.cos(theta)
        ),
        normalOut: calcularNormalTorso(anillo, theta),
      });
    }
    const bandaMesh = construirTiraConRelieveSobreTorso(
      muestrasRibete,
      cmAMetros(1.1),
      0.003,
      true,
      perfil,
      0.003,
      mat,
      "escote-ribete",
      0.5
    );
    objetos.push(bandaMesh);
    return { meshes: objetos };
  }

  // Solapa Sastre o Cuello Camisero: cuello posterior continuo (sin cruzar theta = 0) + dos solapas frontales
  if (config.escote === "solapaSastre" || config.escote === "camisero") {
    const cuelloMuestras: MuestraTiraTorso[] = [];
    const pasosCuello = 28;
    const yBase = perfil.cuelloYM - cmAMetros(1.1);
    const anilloCuello = evaluarPerfilEnY(perfil.anillosInterpolados, yBase);
    const rCuello = calcularDeltaRadioM(config, yBase, perfil, ajusteStretch) + 0.008;

    for (let i = 0; i <= pasosCuello; i++) {
      const t = i / pasosCuello;
      // Recorre del frente-izq (0.36 rad) por la nuca (π) hasta el frente-der (2π - 0.36 rad)
      const theta = THREE.MathUtils.lerp(0.36, Math.PI * 2 - 0.36, t);
      cuelloMuestras.push({
        pos: new THREE.Vector3(
          (anilloCuello.a + rCuello) * Math.sin(theta),
          yBase + cmAMetros(1.0),
          anilloCuello.desplazamientoZ + (anilloCuello.b + rCuello) * Math.cos(theta)
        ),
        normalOut: calcularNormalTorso(anilloCuello, theta),
      });
    }

    objetos.push(
      construirTiraConRelieveSobreTorso(
        cuelloMuestras,
        cmAMetros(4.4),
        0.0035,
        false,
        perfil,
        0.005,
        mat,
        "cuello-superior",
        0.25
      )
    );

    // Dos solapas con línea de rolido dobladas tangencialmente en el pecho
    for (const lado of [-1, 1] as const) {
      const yTopSolapa = perfil.hombroYM - cmAMetros(2);
      const yFinSolapa =
        config.escote === "solapaSastre"
          ? perfil.bustoYM - cmAMetros(5)
          : perfil.bustoYM + cmAMetros(4);
      const anchoSolapa = config.escote === "solapaSastre" ? 0.055 : 0.036;

      const solapaMuestras: MuestraTiraTorso[] = [];
      for (let i = 0; i <= 10; i++) {
        const tf = i / 10;
        const y = THREE.MathUtils.lerp(yTopSolapa, yFinSolapa, tf);
        const theta = lado * THREE.MathUtils.lerp(0.32, 0.06, tf);
        const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
        const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.009;
        solapaMuestras.push({
          pos: new THREE.Vector3(
            (anillo.a + dr) * Math.sin(theta),
            y,
            anillo.desplazamientoZ + (anillo.b + dr) * Math.cos(theta)
          ),
          normalOut: calcularNormalTorso(anillo, theta),
        });
      }
      objetos.push(
        construirTiraConRelieveSobreTorso(
          solapaMuestras,
          anchoSolapa,
          0.0035,
          false,
          perfil,
          0.005,
          mat,
          `solapa-${lado > 0 ? "izq" : "der"}`,
          0.5
        )
      );
    }

    // Hilera central de botones con InstancedMesh
    const numBotones = config.escote === "camisero" ? 6 : 3;
    const btnGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 16);
    btnGeo.rotateX(Math.PI * 0.5);
    const btnMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2C2623"),
      roughness: 0.32,
      metalness: 0.25,
    });
    const instBotones = new THREE.InstancedMesh(btnGeo, btnMat, numBotones);
    instBotones.name = "botones-instanced";
    const dummy = new THREE.Object3D();

    const yInicioBtn =
      config.escote === "solapaSastre"
        ? perfil.bustoYM - cmAMetros(5)
        : perfil.bustoYM + cmAMetros(5);
    const yFinBtn = Math.max(yInferiorM + cmAMetros(4), perfil.cinturaYM - cmAMetros(2));

    const divisorBtn = Math.max(1, numBotones - 1);
    for (let i = 0; i < numBotones; i++) {
      const tf = i / divisorBtn;
      const yBtn = THREE.MathUtils.lerp(yInicioBtn, yFinBtn, tf);
      const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, yBtn);
      const dr = calcularDeltaRadioM(config, yBtn, perfil, ajusteStretch);
      dummy.position.set(
        0,
        yBtn,
        anillo.desplazamientoZ + anillo.b + dr + 0.004
      );
      dummy.updateMatrix();
      instBotones.setMatrixAt(i, dummy.matrix);
    }
    instBotones.instanceMatrix.needsUpdate = true;
    objetos.push(instBotones);

    const anilloRef = perfil.anillosClave.busto;
    return {
      meshes: objetos,
      etiquetaVista: {
        id: "lbl-solapa",
        texto: "Vista 4 cm",
        posicionLocalM: [
          cmAMetros(6),
          anilloRef.y + cmAMetros(3),
          anilloRef.desplazamientoZ + anilloRef.b + cmAMetros(3),
        ],
        normalLocal: [0, 0, 1],
      },
    };
  }

  return { meshes: objetos };
}

/**
 * Construye mangas pegadas (corta/larga), acampanadas y farol sobre la trayectoria real brazo guía.
 */
function construirMangas(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): THREE.Mesh[] {
  if (config.manga === "ninguna" || config.manga === "kimono") return [];

  const meshes: THREE.Mesh[] = [];
  const hombros = perfil.anillosClave.hombros;
  const busto = perfil.anillosClave.busto;
  const escalaHumana = clamp(perfil.alturaTotalM / 1.65, 0.55, 1.18);
  const angBrazoRad = (22 * Math.PI) / 180;

  const largoBrazoGuia = Math.max(perfil.largoMangaM, 0.46 * escalaHumana);
  const largoSup = largoBrazoGuia * 0.48;
  const largoAnt = largoBrazoGuia * 0.46;

  let tFinBrazo = 0.38;
  if (
    config.manga === "largaPegada" ||
    config.manga === "acampanada"
  ) {
    tFinBrazo = clamp(perfil.largoMangaM / largoBrazoGuia, 0.72, 1.0);
  } else if (config.manga === "farol") {
    tFinBrazo = 0.46;
  }

  const rings = opciones.nivelDetalle === "movil" ? 12 : 18;
  const segs = opciones.nivelDetalle === "movil" ? 20 : 28;
  const rBaseBrazo = clamp(busto.a * 0.28, 0.028, 0.056) + 0.011;

  for (const lado of [-1, 1] as const) {
    const pHombro = new THREE.Vector3(
      lado * hombros.a * 1.01,
      hombros.y - 0.014 * escalaHumana,
      hombros.desplazamientoZ
    );
    const dirSup = new THREE.Vector3(
      lado * Math.sin(angBrazoRad),
      -Math.cos(angBrazoRad),
      -0.05
    ).normalize();
    const pCodo = pHombro.clone().addScaledVector(dirSup, largoSup);
    const dirAnt = new THREE.Vector3(
      lado * Math.sin(angBrazoRad * 0.72),
      -Math.cos(angBrazoRad * 0.72),
      0.16
    ).normalize();
    const pMuneca = pCodo.clone().addScaledVector(dirAnt, largoAnt);

    const trayectoria = new THREE.CatmullRomCurve3([
      pHombro,
      pHombro.clone().lerp(pCodo, 0.5),
      pCodo,
      pCodo.clone().lerp(pMuneca, 0.5),
      pMuneca,
    ]);

    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const pesos = new Float32Array((rings + 1) * (segs + 1));

    for (let r = 0; r <= rings; r++) {
      const tr = r / rings;
      const uT = tr * tFinBrazo;
      const centro = trayectoria.getPoint(uT);
      const tangente = trayectoria.getTangent(uT).normalize();
      const refUp = Math.abs(tangente.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      const normalU = new THREE.Vector3().crossVectors(refUp, tangente).normalize();
      const binormalV = new THREE.Vector3().crossVectors(tangente, normalU).normalize();

      // Radio anatómico según tipo de manga
      let radio = THREE.MathUtils.lerp(rBaseBrazo, rBaseBrazo * 0.64, uT);
      if (config.manga === "acampanada" && uT > 0.42) {
        const fCamp = (uT - 0.42) / Math.max(0.1, tFinBrazo - 0.42);
        radio += Math.pow(fCamp, 1.35) * cmAMetros(7.5);
      } else if (config.manga === "farol") {
        // Copa abullonada con recogido hacia el puño
        const puff = Math.sin(tr * Math.PI);
        radio += puff * cmAMetros(4.2);
        if (tr > 0.85) radio *= 0.86;
      }

      const vPos = uT * largoBrazoGuia;
      const circ = Math.PI * 2 * radio;

      for (let s = 0; s <= segs; s++) {
        const theta = ((s / segs) - 0.5) * Math.PI * 2;
        let rOnda = radio;
        if (config.manga === "acampanada" && uT > 0.48) {
          const fCamp = smoothstep(0.48, tFinBrazo, uT);
          rOnda += Math.sin(6 * theta) * cmAMetros(1.4) * fCamp;
        } else if (config.manga === "farol") {
          rOnda += Math.sin(10 * theta) * cmAMetros(0.45) * Math.sin(tr * Math.PI);
        }

        const p = centro
          .clone()
          .addScaledVector(normalU, Math.cos(theta) * rOnda)
          .addScaledVector(binormalV, Math.sin(theta) * rOnda);

        pos.push(p.x, p.y, p.z);
        uvs.push((theta / (Math.PI * 2)) * circ, -vPos);
        pesos[r * (segs + 1) + s] = config.manga === "acampanada" ? Math.pow(tr, 1.6) * 0.65 : tr * 0.25;
      }
    }

    const cols = segs + 1;
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * cols + s;
        const b = (r + 1) * cols + s;
        const c = r * cols + (s + 1);
        const d = (r + 1) * cols + (s + 1);
        idx.push(a, b, c, c, b, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    finalizarGeometria(geo);

    const mesh = new THREE.Mesh(geo, opciones.materialPrincipal);
    mesh.name = `manga-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(mesh, pesos);
    meshes.push(mesh);
  }

  return meshes;
}

interface AnilloFaldaEvaluado {
  y: number;
  anillo: AnilloPerfil;
  aBase: number;
  bBase: number;
  zCentro: number;
  circRef: number;
}

function calcularAlturasFalda(
  config: ConfigPrenda,
  yCinturaInicioM: number
): { largoTotalFaldaM: number; boleroAltoM: number; yRuedoPrincipalM: number } {
  const largoTotalFaldaM = clamp(cmAMetros(config.largoDeseado), 0.22, yCinturaInicioM - 0.04);
  const boleroAltoM = config.bolero ? Math.min(cmAMetros(15), largoTotalFaldaM * 0.28) : 0;
  const yRuedoPrincipalM = Math.max(0.04, yCinturaInicioM - (largoTotalFaldaM - boleroAltoM * 0.7));
  return { largoTotalFaldaM, boleroAltoM, yRuedoPrincipalM };
}

function evaluarAnilloFaldaEnTr(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yCinturaInicioM: number,
  yRuedoPrincipalM: number,
  largoTotalFaldaM: number,
  drBase: number,
  tr: number
): AnilloFaldaEvaluado {
  const caderaAnillo = perfil.anillosClave.cadera;
  const y = THREE.MathUtils.lerp(yCinturaInicioM, yRuedoPrincipalM, tr);
  const anillo = evaluarPerfilEnY(
    perfil.anillosInterpolados,
    Math.max(y, perfil.caderaYM)
  );
  const circRef = Math.PI * (anillo.a + anillo.b);
  const tPostCadera = smoothstep(yCinturaInicioM, perfil.caderaYM, y);
  let extraA = drBase;
  let extraB = drBase;

  if (config.vuelo === "recta") {
    const aMin = caderaAnillo.a + drBase;
    const bMin = caderaAnillo.b + drBase;
    extraA = Math.max(drBase, aMin - anillo.a) * (0.2 + 0.8 * tPostCadera);
    extraB = Math.max(drBase, bMin - anillo.b) * (0.2 + 0.8 * tPostCadera);
  } else if (config.vuelo === "evase") {
    const apertura = Math.pow(tr, 1.15) * largoTotalFaldaM * 0.28;
    extraA = drBase + apertura * 1.1;
    extraB = drBase + apertura * 0.95;
  } else {
    const apertura = Math.pow(tr, 1.05) * largoTotalFaldaM * 0.56;
    extraA = drBase + apertura * 1.08;
    extraB = drBase + apertura * 1.02;
  }

  return {
    y,
    anillo,
    aBase: Math.max(anillo.a + drBase, anillo.a + extraA),
    bBase: Math.max(anillo.b + drBase, anillo.b + extraB),
    zCentro: anillo.desplazamientoZ,
    circRef,
  };
}

function evaluarOndaFaldaEnTheta(
  config: ConfigPrenda,
  tr: number,
  theta: number
): number {
  if (config.vuelo === "circular") {
    return Math.sin(8 * theta) * cmAMetros(5.2) * Math.pow(tr, 1.5);
  }
  if (config.vuelo === "evase") {
    return Math.sin(8 * theta) * cmAMetros(1.4) * Math.pow(tr, 1.6);
  }
  if (config.silueta === "holgado") {
    return (1 + Math.sin(16 * theta)) * cmAMetros(0.6) * tr;
  }
  return 0;
}

/**
 * Construye falda (recta, evasé o circular con ondas sinusoidales) + bolero opcional en el ruedo.
 */
function construirFaldaYBolero(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yCinturaInicioM: number,
  opciones: OpcionesMallaPrenda
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const segs = opciones.nivelDetalle === "movil" ? 48 : 72;
  const rows = opciones.nivelDetalle === "movil" ? 16 : 24;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  const { largoTotalFaldaM, boleroAltoM, yRuedoPrincipalM } = calcularAlturasFalda(
    config,
    yCinturaInicioM
  );
  const caderaAnillo = perfil.anillosClave.cadera;
  const drBase = calcularDeltaRadioM(config, yCinturaInicioM, perfil, ajusteStretch);

  // Pretina de 3.2 cm si la falda es pieza separada
  if (config.prenda === "falda" || config.esDosPiezas) {
    const pretinaGeo = construirPretina(perfil, config, yCinturaInicioM, opciones);
    meshes.push(pretinaGeo);
  }

  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const pesos = new Float32Array(rows * (segs + 1));

  for (let r = 0; r < rows; r++) {
    const tr = r / (rows - 1);
    const { y, anillo, aBase, bBase, zCentro, circRef } = evaluarAnilloFaldaEnTr(
      perfil,
      config,
      yCinturaInicioM,
      yRuedoPrincipalM,
      largoTotalFaldaM,
      drBase,
      tr
    );

    for (let s = 0; s <= segs; s++) {
      const theta = ((s / segs) - 0.5) * Math.PI * 2;
      const onda = evaluarOndaFaldaEnTheta(config, tr, theta);
      const rA = Math.max(anillo.a + 0.003, aBase + onda);
      const rB = Math.max(anillo.b + 0.003, bBase + onda);

      pos.push(rA * Math.sin(theta), y, zCentro + rB * Math.cos(theta));
      uvs.push((theta / (Math.PI * 2)) * (circRef * (1 + tr * (config.vuelo === "circular" ? 1.1 : 0.3))), y);
      pesos[r * (segs + 1) + s] = Math.pow(tr, 1.45);
    }
  }

  const cols = segs + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * cols + s;
      const b = (r + 1) * cols + s;
      const c = r * cols + (s + 1);
      const d = (r + 1) * cols + (s + 1);
      idx.push(a, b, c, c, b, d);
    }
  }

  const faldaGeo = new THREE.BufferGeometry();
  faldaGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  faldaGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  faldaGeo.setIndex(idx);
  finalizarGeometria(faldaGeo);

  const faldaMesh = new THREE.Mesh(faldaGeo, opciones.materialPrincipal);
  faldaMesh.name = "falda-principal";
  registrarMalla(faldaMesh, pesos);
  meshes.push(faldaMesh);

  // Segundo ruedo ondulado (bolero / volante en el ruedo)
  if (config.bolero) {
    const boleroRows = 8;
    const yBoleroTop = yRuedoPrincipalM + cmAMetros(2);
    const yBoleroBot = Math.max(0.03, yBoleroTop - boleroAltoM);
    const bPos: number[] = [];
    const bUvs: number[] = [];
    const bIdx: number[] = [];
    const bPesos = new Float32Array(boleroRows * (segs + 1));

    const ultRowOffset = (rows - 1) * (segs + 1);
    for (let r = 0; r < boleroRows; r++) {
      const tr = r / (boleroRows - 1);
      const y = THREE.MathUtils.lerp(yBoleroTop, yBoleroBot, tr);
      for (let s = 0; s <= segs; s++) {
        const bx = pos[(ultRowOffset + s) * 3];
        const bz = pos[(ultRowOffset + s) * 3 + 2] - caderaAnillo.desplazamientoZ;
        const theta = ((s / segs) - 0.5) * Math.PI * 2;
        const radBase = Math.hypot(bx, bz);
        const exp = radBase + tr * cmAMetros(6.5) + Math.sin(16 * theta) * cmAMetros(2.2) * Math.pow(tr, 1.2);
        bPos.push(exp * Math.sin(theta), y, caderaAnillo.desplazamientoZ + exp * Math.cos(theta));
        bUvs.push((theta / (Math.PI * 2)) * (radBase * Math.PI * 2.3), y);
        bPesos[r * (segs + 1) + s] = 0.65 + 0.35 * tr;
      }
    }

    for (let r = 0; r < boleroRows - 1; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * cols + s;
        const b = (r + 1) * cols + s;
        const c = r * cols + (s + 1);
        const d = (r + 1) * cols + (s + 1);
        bIdx.push(a, b, c, c, b, d);
      }
    }

    const boleroGeo = new THREE.BufferGeometry();
    boleroGeo.setAttribute("position", new THREE.Float32BufferAttribute(bPos, 3));
    boleroGeo.setAttribute("uv", new THREE.Float32BufferAttribute(bUvs, 2));
    boleroGeo.setIndex(bIdx);
    finalizarGeometria(boleroGeo);

    const boleroMesh = new THREE.Mesh(boleroGeo, opciones.materialPrincipal);
    boleroMesh.name = "falda-bolero";
    registrarMalla(boleroMesh, bPesos);
    meshes.push(boleroMesh);
  }

  return meshes;
}

function construirPretina(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yCinturaM: number,
  opciones: OpcionesMallaPrenda
): THREE.Mesh {
  const segs = 40;
  const rows = 4;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;
  const altoPretina = cmAMetros(3.4);
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  for (let r = 0; r < rows; r++) {
    const tr = r / (rows - 1);
    const y = THREE.MathUtils.lerp(yCinturaM + altoPretina * 0.6, yCinturaM - altoPretina * 0.4, tr);
    const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
    const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.002;
    const circ = Math.PI * (anillo.a + anillo.b + 2 * dr);
    for (let s = 0; s <= segs; s++) {
      const theta = ((s / segs) - 0.5) * Math.PI * 2;
      pos.push(
        (anillo.a + dr) * Math.sin(theta),
        y,
        anillo.desplazamientoZ + (anillo.b + dr) * Math.cos(theta)
      );
      uvs.push((theta / (Math.PI * 2)) * circ, y);
    }
  }

  const cols = segs + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * cols + s;
      const b = (r + 1) * cols + s;
      const c = r * cols + (s + 1);
      const d = (r + 1) * cols + (s + 1);
      idx.push(a, b, c, c, b, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  finalizarGeometria(geo);
  const mesh = new THREE.Mesh(geo, opciones.materialForroOVista ?? opciones.materialPrincipal);
  mesh.name = "pretina-cintura";
  registrarMalla(mesh);
  return mesh;
}

interface InfoPiernasPantalon {
  tiroYM: number;
  xMuslo: number;
  zMuslo: number;
  yBotaM: number;
  rMusloPrenda: number;
  rRodillaPrenda: number;
  rBotaPrenda: number;
}

function calcularInfoPiernasPantalon(
  perfil: PerfilCuerpo,
  config: ConfigPrenda
): InfoPiernasPantalon {
  const tiroYM = clamp(
    perfil.cinturaYM - perfil.alturaTiroM,
    perfil.musloYM + 0.02,
    perfil.caderaYM - cmAMetros(2)
  );
  const cadera = perfil.anillosClave.cadera;
  const rMusloBase = clamp(
    perfil.contornoMusloM / (2 * Math.PI),
    0.045,
    cadera.a * 0.54
  );
  const xMuslo = Math.max(rMusloBase * 0.96, cadera.a * 0.46);
  const zMuslo = perfil.anillosClave.muslo.desplazamientoZ;
  const largoPiernaM = clamp(cmAMetros(config.largoDeseado), 0.14, tiroYM - 0.04);
  const yBotaM = Math.max(0.04, tiroYM - largoPiernaM);

  const rMusloPrenda =
    config.pantalon === "legging"
      ? rMusloBase + 0.0025
      : config.pantalon === "palazzo"
        ? rMusloBase * 1.24
        : rMusloBase * 1.1;
  const rRodillaPrenda =
    config.pantalon === "legging"
      ? rMusloBase * 0.72
      : config.pantalon === "palazzo"
        ? rMusloBase * 1.32
        : Math.max(rMusloBase * 0.85, cmAMetros(20) / (2 * Math.PI));
  const rBotaPrenda =
    config.pantalon === "legging"
      ? rMusloBase * 0.48
      : config.pantalon === "palazzo"
        ? Math.max(rMusloBase * 1.44, perfil.anchoBotaM / Math.PI)
        : clamp(perfil.anchoBotaM / Math.PI, rMusloBase * 0.68, rMusloBase * 1.18);

  return {
    tiroYM,
    xMuslo,
    zMuslo,
    yBotaM,
    rMusloPrenda,
    rRodillaPrenda,
    rBotaPrenda,
  };
}

function evaluarCentroYRadioPierna(
  info: InfoPiernasPantalon,
  perfil: PerfilCuerpo,
  lado: -1 | 1,
  tr: number
): { cx: number; y: number; cz: number; radio: number } {
  const y = THREE.MathUtils.lerp(info.tiroYM + 0.03, info.yBotaM, tr);
  const tRod = smoothstep(info.tiroYM, perfil.alturaRodillaM, y);
  const tTob = smoothstep(perfil.alturaRodillaM, perfil.alturaTobilloM, y);
  const cx = lado * (info.xMuslo * (1 - 0.14 * tRod - 0.08 * tTob));
  const cz = info.zMuslo + 0.008 * (tRod - tTob);

  let radio: number;
  if (y >= perfil.alturaRodillaM) {
    radio = THREE.MathUtils.lerp(info.rMusloPrenda, info.rRodillaPrenda, tRod);
  } else {
    const fBot = clamp(
      (perfil.alturaRodillaM - y) / Math.max(0.05, perfil.alturaRodillaM - perfil.alturaTobilloM),
      0,
      1
    );
    radio = THREE.MathUtils.lerp(info.rRodillaPrenda, info.rBotaPrenda, fBot);
  }
  return { cx, y, cz, radio };
}

/**
 * Construye pantalón o inferior de enterizo bifurcando en dos piernas desde `alturaTiro`.
 */
function construirPantalon(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const segsYugo = opciones.nivelDetalle === "movil" ? 36 : 52;
  const rowsYugo = 10;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  if (config.prenda === "pantalon" || config.esDosPiezas) {
    meshes.push(construirPretina(perfil, config, perfil.cinturaYM, opciones));
  }

  const infoPiernas = calcularInfoPiernasPantalon(perfil, config);
  const { tiroYM } = infoPiernas;

  // 1. Yugo pelvis/tiro (cintura -> tiro)
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  for (let r = 0; r < rowsYugo; r++) {
    const tr = r / (rowsYugo - 1);
    const y = THREE.MathUtils.lerp(perfil.cinturaYM, tiroYM, tr);
    const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
    const extraPalazzo = config.pantalon === "palazzo" ? tr * cmAMetros(2.8) : 0;
    const dr =
      (config.pantalon === "legging"
        ? 0.0022
        : calcularDeltaRadioM(config, y, perfil, ajusteStretch)) + extraPalazzo;

    const a = anillo.a + dr;
    const b = anillo.b + dr;
    const circ = Math.PI * (a + b);

    for (let s = 0; s <= segsYugo; s++) {
      const theta = ((s / segsYugo) - 0.5) * Math.PI * 2;
      pos.push(
        a * Math.sin(theta),
        y,
        anillo.desplazamientoZ + b * Math.cos(theta)
      );
      uvs.push((theta / (Math.PI * 2)) * circ, y);
    }
  }

  const colsYugo = segsYugo + 1;
  for (let r = 0; r < rowsYugo - 1; r++) {
    for (let s = 0; s < segsYugo; s++) {
      const a = r * colsYugo + s;
      const b = (r + 1) * colsYugo + s;
      const c = r * colsYugo + (s + 1);
      const d = (r + 1) * colsYugo + (s + 1);
      idx.push(a, b, c, c, b, d);
    }
  }

  const yugoGeo = new THREE.BufferGeometry();
  yugoGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  yugoGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  yugoGeo.setIndex(idx);
  finalizarGeometria(yugoGeo);
  const yugoMesh = new THREE.Mesh(yugoGeo, opciones.materialPrincipal);
  yugoMesh.name = "pantalon-yugo";
  registrarMalla(yugoMesh);
  meshes.push(yugoMesh);

  // 2. Bifurcación en pierna izquierda y derecha (tiro -> bota)
  const ringsLeg = opciones.nivelDetalle === "movil" ? 14 : 20;
  const segsLeg = opciones.nivelDetalle === "movil" ? 20 : 26;

  for (const lado of [-1, 1] as const) {
    const lPos: number[] = [];
    const lUvs: number[] = [];
    const lIdx: number[] = [];
    const lPesos = new Float32Array(ringsLeg * (segsLeg + 1));

    for (let r = 0; r < ringsLeg; r++) {
      const tr = r / (ringsLeg - 1);
      const { cx, y, cz, radio } = evaluarCentroYRadioPierna(infoPiernas, perfil, lado, tr);

      const circ = Math.PI * 2 * radio;
      for (let s = 0; s <= segsLeg; s++) {
        const theta = ((s / segsLeg) - 0.5) * Math.PI * 2;
        let rOnda = radio;
        if (config.pantalon === "palazzo") {
          rOnda += Math.sin(10 * theta) * cmAMetros(1.1) * Math.pow(tr, 1.4);
        }
        lPos.push(cx + rOnda * Math.sin(theta), y, cz + rOnda * Math.cos(theta));
        lUvs.push((theta / (Math.PI * 2)) * circ, y);
        lPesos[r * (segsLeg + 1) + s] =
          config.pantalon === "palazzo" ? Math.pow(tr, 1.5) * 0.85 : config.pantalon === "recto" ? tr * 0.25 : 0;
      }
    }

    const colsLeg = segsLeg + 1;
    for (let r = 0; r < ringsLeg - 1; r++) {
      for (let s = 0; s < segsLeg; s++) {
        const a = r * colsLeg + s;
        const b = (r + 1) * colsLeg + s;
        const c = r * colsLeg + (s + 1);
        const d = (r + 1) * colsLeg + (s + 1);
        lIdx.push(a, b, c, c, b, d);
      }
    }

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.Float32BufferAttribute(lPos, 3));
    lGeo.setAttribute("uv", new THREE.Float32BufferAttribute(lUvs, 2));
    lGeo.setIndex(lIdx);
    finalizarGeometria(lGeo);

    const lMesh = new THREE.Mesh(lGeo, opciones.materialPrincipal);
    lMesh.name = `pantalon-pierna-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(lMesh, lPesos);
    meshes.push(lMesh);
  }

  return meshes;
}

/**
 * Construye banda de cinturón de 3.5 cm + lazo 3D frontal (nudo central, dos lazadas y dos colas).
 */
function construirCinturonConLazo(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): { objetos: THREE.Object3D[]; etiqueta: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const mat = opciones.materialForroOVista ?? opciones.materialPrincipal;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  const cintura = perfil.anillosClave.cintura;
  const drCint = calcularDeltaRadioM(config, cintura.y, perfil, ajusteStretch) + 0.004;
  const aBelt = cintura.a + drCint;
  const bBelt = cintura.b + drCint;

  // Banda rodeando cintura
  const segs = 48;
  const rows = 4;
  const altoBelt = cmAMetros(3.5);
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const circ = Math.PI * (aBelt + bBelt);

  for (let r = 0; r < rows; r++) {
    const tr = r / (rows - 1);
    const y = THREE.MathUtils.lerp(
      cintura.y + altoBelt * 0.5,
      cintura.y - altoBelt * 0.5,
      tr
    );
    for (let s = 0; s <= segs; s++) {
      const theta = ((s / segs) - 0.5) * Math.PI * 2;
      pos.push(
        aBelt * Math.sin(theta),
        y,
        cintura.desplazamientoZ + bBelt * Math.cos(theta)
      );
      uvs.push((theta / (Math.PI * 2)) * circ, y);
    }
  }

  const cols = segs + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * cols + s;
      const b = (r + 1) * cols + s;
      const c = r * cols + (s + 1);
      const d = (r + 1) * cols + (s + 1);
      idx.push(a, b, c, c, b, d);
    }
  }

  const beltGeo = new THREE.BufferGeometry();
  beltGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  beltGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  beltGeo.setIndex(idx);
  finalizarGeometria(beltGeo);
  const beltMesh = new THREE.Mesh(beltGeo, mat);
  beltMesh.name = "cinturon-banda";
  registrarMalla(beltMesh);
  objetos.push(beltMesh);

  // Ancla frontal del lazo 3D
  const zFrente = cintura.desplazamientoZ + bBelt + 0.008;
  const yCint = cintura.y;

  // Nudo central
  const nudoGeo = new THREE.SphereGeometry(0.017, 16, 12);
  nudoGeo.scale(1.15, 1.0, 0.72);
  const nudoMesh = new THREE.Mesh(nudoGeo, mat);
  nudoMesh.position.set(0, yCint, zFrente);
  nudoMesh.name = "cinturon-nudo";
  objetos.push(nudoMesh);

  // Dos lazadas aplanadas izquierda y derecha
  for (const lado of [-1, 1] as const) {
    const loopCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(lado * 0.008, yCint + 0.004, zFrente),
        new THREE.Vector3(lado * 0.045, yCint + 0.025, zFrente + 0.018),
        new THREE.Vector3(lado * 0.068, yCint + 0.002, zFrente + 0.01),
        new THREE.Vector3(lado * 0.044, yCint - 0.018, zFrente + 0.016),
        new THREE.Vector3(lado * 0.008, yCint - 0.003, zFrente),
      ],
      false
    );
    const loopShape = new THREE.Shape();
    loopShape.moveTo(-0.012, -0.002);
    loopShape.lineTo(0.012, -0.002);
    loopShape.lineTo(0.012, 0.002);
    loopShape.lineTo(-0.012, 0.002);
    loopShape.closePath();

    const loopGeo = new THREE.ExtrudeGeometry(loopShape, {
      steps: 18,
      extrudePath: loopCurve,
      bevelEnabled: false,
    });
    finalizarGeometria(loopGeo);
    const loopMesh = new THREE.Mesh(loopGeo, mat);
    loopMesh.name = `cinturon-lazada-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(loopMesh);
    objetos.push(loopMesh);

    // Cola colgante hacia abajo con caída orgánica
    const colaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(lado * 0.009, yCint - 0.005, zFrente),
      new THREE.Vector3(lado * 0.024, yCint - 0.065, zFrente + 0.024),
      new THREE.Vector3(lado * 0.036, yCint - 0.135, zFrente + 0.018),
    ]);
    const colaShape = new THREE.Shape();
    colaShape.moveTo(-0.014, -0.0018);
    colaShape.lineTo(0.014, -0.0018);
    colaShape.lineTo(0.014, 0.0018);
    colaShape.lineTo(-0.014, 0.0018);
    colaShape.closePath();

    const colaGeo = new THREE.ExtrudeGeometry(colaShape, {
      steps: 14,
      extrudePath: colaCurve,
      bevelEnabled: false,
    });
    finalizarGeometria(colaGeo);
    const colaMesh = new THREE.Mesh(colaGeo, mat);
    colaMesh.name = `cinturon-cola-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(colaMesh);
    objetos.push(colaMesh);
  }

  return {
    objetos,
    etiqueta: {
      id: "lbl-cinturon",
      texto: "Cinturón",
      posicionLocalM: [0.06, yCint + 0.02, zFrente + 0.02],
      normalLocal: [0, 0, 1],
    },
  };
}

/**
 * Construye Sombrero Pescador (`bucketHat`) con corona + ala inclinada (`LatheGeometry`)
 * montado sobre una cabeza estilizada del contorno real (~57 cm).
 */
function construirBucketHat(
  perfil: PerfilCuerpo,
  opciones: OpcionesMallaPrenda
): { objetos: THREE.Object3D[]; etiquetaFrente: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const rCabeza = clamp(perfil.contornoCabezaM / (2 * Math.PI), 0.072, 0.105);
  const cuello = perfil.anillosClave.cuello;
  const centroCabezaY = perfil.cuelloYM + rCabeza * 1.38;
  const centroCabezaZ = cuello.desplazamientoZ + 0.008;

  // Cabeza estilizada guía translúcida
  const cabezaGeo = new THREE.SphereGeometry(rCabeza, 28, 22);
  cabezaGeo.scale(0.88, 1.15, 0.98);
  const cabezaMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#D8CEC0"),
    roughness: 0.72,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const cabezaMesh = new THREE.Mesh(cabezaGeo, cabezaMat);
  cabezaMesh.position.set(0, centroCabezaY, centroCabezaZ);
  cabezaMesh.name = "cabeza-guia-hat";
  objetos.push(cabezaMesh);

  // Sombrero con corona plana y ala inclinada (~6 cm) en LatheGeometry
  const rCopaTop = rCabeza * 0.92;
  const rBaseCopa = rCabeza * 1.04;
  const rAla = rBaseCopa + cmAMetros(6.0);

  const perfilHat = [
    new THREE.Vector2(0, cmAMetros(9.2)),
    new THREE.Vector2(rCopaTop, cmAMetros(9.0)),
    new THREE.Vector2(rCopaTop * 1.02, cmAMetros(8.6)),
    new THREE.Vector2(rBaseCopa, cmAMetros(1.2)),
    new THREE.Vector2(rBaseCopa + cmAMetros(0.4), cmAMetros(0.8)),
    new THREE.Vector2(rAla, -cmAMetros(3.4)),
  ];

  const hatGeo = new THREE.LatheGeometry(perfilHat, 44);
  // Escalar UVs al patrón de 8 cm reales
  const uv = hatGeo.getAttribute("uv");
  const circAla = Math.PI * 2 * rAla;
  if (uv instanceof THREE.BufferAttribute) {
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * circAla, uv.getY(i) * cmAMetros(18));
    }
    uv.needsUpdate = true;
  }
  finalizarGeometria(hatGeo);

  const hatMesh = new THREE.Mesh(hatGeo, opciones.materialPrincipal);
  hatMesh.position.set(0, centroCabezaY + rCabeza * 0.14, centroCabezaZ);
  hatMesh.name = "bucket-hat-3d";
  registrarMalla(hatMesh);
  objetos.push(hatMesh);

  return {
    objetos,
    etiquetaFrente: {
      id: "lbl-delantero",
      texto: "Delantero",
      posicionLocalM: [0, centroCabezaY + rCabeza * 0.45, centroCabezaZ + rBaseCopa + 0.02],
      normalLocal: [0, 0, 1],
    },
  };
}

/**
 * Crea material de pespunte discontinuo en terracota de marca para el modo educativo 2D -> 3D.
 */
function crearMaterialCosturaTerracota(): THREE.LineDashedMaterial {
  return new THREE.LineDashedMaterial({
    color: 0xc85a32,
    dashSize: 0.015,
    gapSize: 0.008,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
  });
}

/**
 * Construye una línea punteada 3D asegurando `computeLineDistances()` para renderizado discontinuo.
 */
function crearLineaPespunte(
  puntos: THREE.Vector3[],
  material: THREE.LineDashedMaterial,
  nombre: string
): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(puntos);
  const line = new THREE.Line(geo, material);
  line.name = nombre;
  line.computeLineDistances();
  return line;
}

/**
 * Evalúa punto 3D sobre la superficie real del torso de prenda desplazado `+offsetM` en su normal externa.
 */
function evaluarPuntoTorsoConOffset(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  y: number,
  theta: number,
  ajusteStretchM: number,
  offsetM = OFFSET_COSTURA_M
): THREE.Vector3 {
  const anillo = evaluarPerfilEnY(
    perfil.anillosInterpolados,
    clamp(y, perfil.musloYM, perfil.cuelloYM)
  );
  const pt = muestrearPuntoTorsoPrenda(
    anillo,
    theta,
    perfil,
    config,
    ajusteStretchM
  );
  const normal = calcularNormalTorso(anillo, theta);
  return new THREE.Vector3(pt.x, pt.y, pt.z).addScaledVector(normal, offsetM);
}

/**
 * Agrega costuras de copa/ala/laterales cuando la prenda es Sombrero Pescador (`bucketHat`).
 */
function poblarCosturasSombrero(
  perfil: PerfilCuerpo,
  grupoCosturas: THREE.Group,
  mat: THREE.LineDashedMaterial
): void {
  const rCabeza = clamp(perfil.contornoCabezaM / (2 * Math.PI), 0.072, 0.105);
  const cuello = perfil.anillosClave.cuello;
  const centroCabezaY = perfil.cuelloYM + rCabeza * 1.38;
  const centroCabezaZ = cuello.desplazamientoZ + 0.008;
  const hatYBase = centroCabezaY + rCabeza * 0.14;

  const rCopaTop = rCabeza * 0.92;
  const rBaseCopa = rCabeza * 1.04;
  const segs = 44;

  const anillosHat = [
    { nombre: "costura-copa-sombrero", radio: rCopaTop * 1.02 + OFFSET_COSTURA_M, y: hatYBase + cmAMetros(8.6) + 0.002 },
    { nombre: "costura-ala-sombrero", radio: rBaseCopa + cmAMetros(0.4) + OFFSET_COSTURA_M, y: hatYBase + cmAMetros(0.9) + 0.002 },
  ];

  for (const anillo of anillosHat) {
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          anillo.radio * Math.sin(th),
          anillo.y,
          centroCabezaZ + anillo.radio * Math.cos(th)
        )
      );
    }
    grupoCosturas.add(crearLineaPespunte(pts, mat, anillo.nombre));
  }

  for (const lado of [-1, 1] as const) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const r = THREE.MathUtils.lerp(rCopaTop, rBaseCopa, t) + OFFSET_COSTURA_M;
      const y = THREE.MathUtils.lerp(cmAMetros(8.6), cmAMetros(1.2), t) + hatYBase;
      pts.push(new THREE.Vector3(lado * r, y, centroCabezaZ));
    }
    grupoCosturas.add(
      crearLineaPespunte(pts, mat, `costura-lateral-copa-${lado > 0 ? "izq" : "der"}`)
    );
  }
}

/**
 * Pobla costuras de hombro, costados, sisa (omitida en `kimono`) y pinzas de busto/cintura
 * para partes superiores (+2.4 mm fuera de la superficie).
 */
function poblarCosturasParteSuperior(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInferiorTopM: number,
  ajusteStretchM: number,
  grupoCosturas: THREE.Group,
  mat: THREE.LineDashedMaterial
): { etiquetaPinza?: Etiqueta3DAncla } {
  let tienePinzas = false;

  // 1. Costuras de hombro (hombro -> cuello; en kimono continúa por la cresta de la manga)
  for (const lado of [-1, 1] as const) {
    const ptsHombro: THREE.Vector3[] = [];
    const pasos = 10;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      if (config.manga === "kimono" && t > 0.5) {
        const tf = (t - 0.5) / 0.5;
        const yRef = THREE.MathUtils.lerp(
          perfil.hombroYM - cmAMetros(1.4),
          perfil.hombroYM - cmAMetros(4.2),
          tf
        );
        const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, yRef);
        const pt = muestrearPuntoTorsoPrenda(
          anillo,
          lado * Math.PI * 0.5,
          perfil,
          config,
          ajusteStretchM
        );
        ptsHombro.push(
          new THREE.Vector3(pt.x, pt.y + OFFSET_COSTURA_M * 1.4, pt.z)
        );
      } else {
        const u = config.manga === "kimono" ? t / 0.5 : t;
        const theta = lado * THREE.MathUtils.lerp(0.42, Math.PI * 0.5, u);
        const yTop = calcularAlturaTopEscoteYSisa(config, theta, perfil);
        const pt = evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yTop,
          theta,
          ajusteStretchM,
          OFFSET_COSTURA_M
        );
        pt.y += 0.002;
        ptsHombro.push(pt);
      }
    }
    grupoCosturas.add(
      crearLineaPespunte(
        ptsHombro,
        mat,
        `costura-hombro-${lado > 0 ? "izq" : "der"}`
      )
    );
  }

  // 2. Costuras de costados (θ = ±90°, axila -> borde inferior top)
  const yInicioCostado =
    config.manga === "kimono"
      ? Math.max(yInferiorTopM + cmAMetros(2), perfil.bustoYM - cmAMetros(11.5))
      : perfil.bustoYM - cmAMetros(4.5);

  for (const lado of [-1, 1] as const) {
    const ptsCostado: THREE.Vector3[] = [];
    const theta = lado * Math.PI * 0.5;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = THREE.MathUtils.lerp(yInicioCostado, yInferiorTopM, t);
      ptsCostado.push(
        evaluarPuntoTorsoConOffset(perfil, config, y, theta, ajusteStretchM)
      );
    }
    grupoCosturas.add(
      crearLineaPespunte(
        ptsCostado,
        mat,
        `costura-costado-${lado > 0 ? "izq" : "der"}`
      )
    );
  }

  // 3. Costura de sisa (OMITIDA explícitamente cuando manga === 'kimono')
  if (config.manga !== "kimono") {
    const yTopSisa = perfil.hombroYM - cmAMetros(1.8);
    const yBotSisa = Math.max(yInferiorTopM + cmAMetros(2), perfil.bustoYM - cmAMetros(4.8));
    const yMidSisa = (yTopSisa + yBotSisa) * 0.5;
    const radYSisa = Math.max(cmAMetros(4), (yTopSisa - yBotSisa) * 0.5);
    const radThetaSisa = 0.34;
    const pasosSisa = 22;

    for (const lado of [-1, 1] as const) {
      const ptsSisa: THREE.Vector3[] = [];
      for (let i = 0; i <= pasosSisa; i++) {
        const ang = (i / pasosSisa) * Math.PI * 2;
        const theta = lado * Math.PI * 0.5 + Math.cos(ang) * radThetaSisa;
        const y = yMidSisa + Math.sin(ang) * radYSisa;
        ptsSisa.push(
          evaluarPuntoTorsoConOffset(
            perfil,
            config,
            y,
            theta,
            ajusteStretchM,
            OFFSET_COSTURA_M + 0.001
          )
        );
      }
      grupoCosturas.add(
        crearLineaPespunte(
          ptsSisa,
          mat,
          `costura-sisa-${lado > 0 ? "izq" : "der"}`
        )
      );
    }
  }

  // 4. Pinza de busto (costado -> ápice) en cuerpo adulto femenino
  if (!config.esInfantil) {
    tienePinzas = true;
    for (const lado of [-1, 1] as const) {
      const pSup = evaluarPuntoTorsoConOffset(
        perfil,
        config,
        perfil.bustoYM - cmAMetros(2.8),
        lado * 1.46,
        ajusteStretchM
      );
      const pApex = evaluarPuntoTorsoConOffset(
        perfil,
        config,
        perfil.bustoYM - cmAMetros(0.4),
        lado * 0.44,
        ajusteStretchM
      );
      const pInf = evaluarPuntoTorsoConOffset(
        perfil,
        config,
        perfil.bustoYM - cmAMetros(5.6),
        lado * 1.46,
        ajusteStretchM
      );
      grupoCosturas.add(
        crearLineaPespunte(
          [pSup, pApex, pInf],
          mat,
          `costura-pinza-busto-${lado > 0 ? "izq" : "der"}`
        )
      );
    }
  }

  // 5. Pinzas verticales de cintura (delantero y espalda en silueta entallada)
  if (
    config.silueta === "entallado" &&
    !config.esInfantil &&
    yInferiorTopM <= perfil.cinturaYM + cmAMetros(2)
  ) {
    tienePinzas = true;
    const yPinzaTop = perfil.bustoYM - cmAMetros(3.0);
    const yPinzaBot = Math.max(
      yInferiorTopM + cmAMetros(1.5),
      perfil.cinturaYM - cmAMetros(7.0)
    );
    const yPinzaMid = (yPinzaTop + yPinzaBot) * 0.5;

    const familias = [
      { nombre: "del", baseTheta: 0.36 },
      { nombre: "tra", baseTheta: Math.PI - 0.34 },
    ] as const;

    for (const fam of familias) {
      for (const lado of [-1, 1] as const) {
        const thC = lado * fam.baseTheta;
        const deltaTh = 0.055;
        const pTop = evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yPinzaTop,
          thC,
          ajusteStretchM
        );
        const pMidA = evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yPinzaMid,
          thC - deltaTh,
          ajusteStretchM
        );
        const pBot = evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yPinzaBot,
          thC,
          ajusteStretchM
        );
        const pMidB = evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yPinzaMid,
          thC + deltaTh,
          ajusteStretchM
        );
        grupoCosturas.add(
          crearLineaPespunte(
            [pTop, pMidA, pBot, pMidB, pTop],
            mat,
            `costura-pinza-cintura-${fam.nombre}-${lado > 0 ? "izq" : "der"}`
          )
        );
      }
    }
  }

  if (!tienePinzas) return {};

  const busto = perfil.anillosClave.busto;
  const thetaAncla = 0.52;
  const posAncla = evaluarPuntoTorsoConOffset(
    perfil,
    config,
    busto.y - cmAMetros(3.5),
    thetaAncla,
    ajusteStretchM,
    0.024
  );
  return {
    etiquetaPinza: {
      id: "lbl-pinza",
      texto: "Pinza",
      posicionLocalM: [posAncla.x, posAncla.y, posAncla.z],
      normalLocal: [0.48, 0.05, 0.88],
    },
  };
}

/**
 * Pobla costuras de costado de falda y pinzas superiores cuando aplica (`recta` sin top).
 */
function poblarCosturasFalda(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInicioFaldaM: number,
  ajusteStretchM: number,
  tieneSuperior: boolean,
  grupoCosturas: THREE.Group,
  mat: THREE.LineDashedMaterial
): { etiquetaPinza?: Etiqueta3DAncla } {
  const { largoTotalFaldaM, yRuedoPrincipalM } = calcularAlturasFalda(
    config,
    yInicioFaldaM
  );
  const drBase = calcularDeltaRadioM(config, yInicioFaldaM, perfil, ajusteStretchM);

  for (const lado of [-1, 1] as const) {
    const theta = lado * Math.PI * 0.5;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const tr = i / 12;
      const { y, anillo, aBase, bBase, zCentro } = evaluarAnilloFaldaEnTr(
        perfil,
        config,
        yInicioFaldaM,
        yRuedoPrincipalM,
        largoTotalFaldaM,
        drBase,
        tr
      );
      const onda = evaluarOndaFaldaEnTheta(config, tr, theta);
      const rA = Math.max(anillo.a + 0.003, aBase + onda) + OFFSET_COSTURA_M;
      const rB = Math.max(anillo.b + 0.003, bBase + onda) + OFFSET_COSTURA_M;
      pts.push(new THREE.Vector3(rA * Math.sin(theta), y, zCentro + rB * Math.cos(theta)));
    }
    grupoCosturas.add(
      crearLineaPespunte(pts, mat, `costura-costado-falda-${lado > 0 ? "izq" : "der"}`)
    );
  }

  if (!tieneSuperior && config.vuelo === "recta" && !config.esInfantil) {
    const yTop = yInicioFaldaM - cmAMetros(1.8);
    const yBot = Math.max(
      yRuedoPrincipalM + cmAMetros(2),
      perfil.anillosClave.caderaAlta.y
    );
    const yMid = (yTop + yBot) * 0.5;
    for (const fam of [
      { nombre: "del", baseTheta: 0.34 },
      { nombre: "tra", baseTheta: Math.PI - 0.32 },
    ] as const) {
      for (const lado of [-1, 1] as const) {
        const thC = lado * fam.baseTheta;
        const p1 = evaluarPuntoTorsoConOffset(perfil, config, yTop, thC - 0.04, ajusteStretchM);
        const p2 = evaluarPuntoTorsoConOffset(perfil, config, yBot, thC, ajusteStretchM);
        const p3 = evaluarPuntoTorsoConOffset(perfil, config, yTop, thC + 0.04, ajusteStretchM);
        const pMid = evaluarPuntoTorsoConOffset(perfil, config, yMid, thC, ajusteStretchM);
        grupoCosturas.add(
          crearLineaPespunte(
            [p1, p2, p3, pMid, p1],
            mat,
            `costura-pinza-falda-${fam.nombre}-${lado > 0 ? "izq" : "der"}`
          )
        );
      }
    }
    const pAnc = evaluarPuntoTorsoConOffset(perfil, config, yMid, 0.36, ajusteStretchM, 0.024);
    return {
      etiquetaPinza: {
        id: "lbl-pinza",
        texto: "Pinza",
        posicionLocalM: [pAnc.x, pAnc.y, pAnc.z],
        normalLocal: [0.35, 0, 0.94],
      },
    };
  }

  return {};
}

/**
 * Pobla costuras de costado de pierna, entrepierna, tiro y pinzas en pantalón.
 */
function poblarCosturasPantalon(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  ajusteStretchM: number,
  tieneSuperior: boolean,
  grupoCosturas: THREE.Group,
  mat: THREE.LineDashedMaterial
): { etiquetaPinza?: Etiqueta3DAncla } {
  const info = calcularInfoPiernasPantalon(perfil, config);

  // Costura de tiro delantero y trasero
  const ptsTiro: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const y = THREE.MathUtils.lerp(perfil.cinturaYM - cmAMetros(1.5), info.tiroYM + 0.01, i / 6);
    ptsTiro.push(evaluarPuntoTorsoConOffset(perfil, config, y, 0, ajusteStretchM, OFFSET_COSTURA_M + 0.001));
  }
  for (let i = 0; i <= 6; i++) {
    const y = THREE.MathUtils.lerp(info.tiroYM + 0.01, perfil.cinturaYM - cmAMetros(1.5), i / 6);
    ptsTiro.push(evaluarPuntoTorsoConOffset(perfil, config, y, Math.PI, ajusteStretchM, OFFSET_COSTURA_M + 0.001));
  }
  grupoCosturas.add(crearLineaPespunte(ptsTiro, mat, "costura-tiro"));

  // Costado externo y entrepierna interna de cada pierna
  for (const lado of [-1, 1] as const) {
    const ptsExt: THREE.Vector3[] = [];
    const ptsInt: THREE.Vector3[] = [];

    for (let i = 0; i <= 12; i++) {
      const tr = i / 12;
      const { cx, y, cz, radio } = evaluarCentroYRadioPierna(info, perfil, lado, tr);
      const ondaExt =
        config.pantalon === "palazzo"
          ? Math.sin(10 * (lado * Math.PI * 0.5)) * cmAMetros(1.1) * Math.pow(tr, 1.4)
          : 0;
      const ondaInt =
        config.pantalon === "palazzo"
          ? Math.sin(10 * (-lado * Math.PI * 0.5)) * cmAMetros(1.1) * Math.pow(tr, 1.4)
          : 0;
      ptsExt.push(new THREE.Vector3(cx + lado * (radio + ondaExt + OFFSET_COSTURA_M), y, cz));
      ptsInt.push(new THREE.Vector3(cx - lado * (radio + ondaInt + OFFSET_COSTURA_M), y, cz));
    }
    grupoCosturas.add(
      crearLineaPespunte(ptsExt, mat, `costura-costado-pierna-${lado > 0 ? "izq" : "der"}`)
    );
    grupoCosturas.add(
      crearLineaPespunte(ptsInt, mat, `costura-entrepierna-${lado > 0 ? "izq" : "der"}`)
    );
  }

  if (!tieneSuperior && config.pantalon !== "legging" && !config.esInfantil) {
    const yTop = perfil.cinturaYM - cmAMetros(1.8);
    const yBot = Math.max(info.tiroYM + cmAMetros(4), perfil.caderaYM + cmAMetros(4));
    for (const fam of [
      { nombre: "del", baseTheta: 0.34 },
      { nombre: "tra", baseTheta: Math.PI - 0.32 },
    ] as const) {
      for (const lado of [-1, 1] as const) {
        const thC = lado * fam.baseTheta;
        const p1 = evaluarPuntoTorsoConOffset(perfil, config, yTop, thC - 0.04, ajusteStretchM);
        const p2 = evaluarPuntoTorsoConOffset(perfil, config, yBot, thC, ajusteStretchM);
        const p3 = evaluarPuntoTorsoConOffset(perfil, config, yTop, thC + 0.04, ajusteStretchM);
        grupoCosturas.add(
          crearLineaPespunte(
            [p1, p2, p3, p1],
            mat,
            `costura-pinza-pantalon-${fam.nombre}-${lado > 0 ? "izq" : "der"}`
          )
        );
      }
    }
    const pAnc = evaluarPuntoTorsoConOffset(perfil, config, (yTop + yBot) * 0.5, 0.36, ajusteStretchM, 0.024);
    return {
      etiquetaPinza: {
        id: "lbl-pinza",
        texto: "Pinza",
        posicionLocalM: [pAnc.x, pAnc.y, pAnc.z],
        normalLocal: [0.35, 0, 0.94],
      },
    };
  }

  return {};
}

/**
 * Proyecta las anclas 3D al viewport HTML usando `vector.project(camera)` y oculta
 * automáticamente cualquier etiqueta que quede detrás del maniquí o fuera de pantalla.
 */
export function proyectarEtiquetas3D(
  etiquetas: readonly Etiqueta3DAncla[],
  grupoRaiz: THREE.Object3D,
  camera: THREE.Camera,
  anchoPx: number,
  altoPx: number
): Etiqueta3DProyectada[] {
  if (anchoPx <= 0 || altoPx <= 0) return [];

  grupoRaiz.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(grupoRaiz.matrixWorld);
  const worldPos = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const camWorldPos = new THREE.Vector3();
  camera.getWorldPosition(camWorldPos);

  return etiquetas.map((et) => {
    worldPos.set(et.posicionLocalM[0], et.posicionLocalM[1], et.posicionLocalM[2]);
    worldPos.applyMatrix4(grupoRaiz.matrixWorld);

    worldNormal.set(et.normalLocal[0], et.normalLocal[1], et.normalLocal[2]);
    worldNormal.applyMatrix3(normalMatrix).normalize();

    toCamera.copy(camWorldPos).sub(worldPos).normalize();
    const mirandoCamara = worldNormal.dot(toCamera) > 0.12;

    const ndc = worldPos.clone().project(camera);
    const enPantalla =
      ndc.z >= -1 &&
      ndc.z <= 1 &&
      Math.abs(ndc.x) <= 0.95 &&
      Math.abs(ndc.y) <= 0.95;

    return {
      id: et.id,
      texto: et.texto,
      xPx: (ndc.x * 0.5 + 0.5) * anchoPx,
      yPx: (-ndc.y * 0.5 + 0.5) * altoPx,
      visible: mirandoCamara && enPantalla,
    };
  });
}

/**
 * Orquestador principal de Fase 3 y Fase 5: construye cualquier prenda solicitada a partir del perfil
 * junto con su grupo educativo de costuras y pinzas (2D -> 3D).
 */
export function construirMallaPrenda(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): ResultadoMallaPrenda {
  const grupo = new THREE.Group();
  grupo.name = "prenda-3d";

  const grupoCosturas = new THREE.Group();
  grupoCosturas.name = "costuras-pinzas-3d";
  grupoCosturas.visible = opciones.mostrarCosturas;

  const matCostura = crearMaterialCosturaTerracota();
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  const etiquetas: Etiqueta3DAncla[] = [];
  let triangulosTotales = 0;

  const contarYAgregar = (obj: THREE.Object3D) => {
    grupo.add(obj);
    if (obj instanceof THREE.Mesh) {
      const idx = obj.geometry.getIndex();
      const pos = obj.geometry.getAttribute("position");
      const tris = idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
      triangulosTotales += tris;
    } else if (obj instanceof THREE.InstancedMesh) {
      const idx = obj.geometry.getIndex();
      const pos = obj.geometry.getAttribute("position");
      const perInst = idx ? Math.floor(idx.count / 3) : pos ? Math.floor(pos.count / 3) : 0;
      triangulosTotales += perInst * obj.count;
    }
  };

  if (config.prenda === "bucketHat") {
    const hat = construirBucketHat(perfil, opciones);
    hat.objetos.forEach(contarYAgregar);
    etiquetas.push(hat.etiquetaFrente);
    poblarCosturasSombrero(perfil, grupoCosturas, matCostura);
    grupo.add(grupoCosturas);
    return { grupo, grupoCosturas, etiquetas, triangulosTotales };
  }

  const requiereParteSuperior =
    config.prenda === "vestido" ||
    config.prenda === "blusa" ||
    config.prenda === "chaqueta" ||
    config.prenda === "enterizo" ||
    Boolean(config.esDosPiezas);

  const requiereFalda =
    config.prenda === "falda" ||
    config.prenda === "vestido" ||
    (Boolean(config.esDosPiezas) && config.dosPiezasAbajo !== "pants");

  const requierePantalon =
    config.prenda === "pantalon" ||
    config.prenda === "enterizo" ||
    (Boolean(config.esDosPiezas) && config.dosPiezasAbajo === "pants");

  let etiquetaPinza: Etiqueta3DAncla | undefined;

  if (requiereParteSuperior) {
    let yInferiorTopM = perfil.cinturaYM;
    if (config.prenda === "blusa" || config.prenda === "chaqueta") {
      const largoPrendaTopM = clamp(
        cmAMetros(config.largoDeseado),
        cmAMetros(30),
        perfil.cuelloYM - perfil.caderaYM + cmAMetros(5)
      );
      yInferiorTopM = Math.max(
        perfil.caderaYM - cmAMetros(4),
        perfil.cuelloYM - largoPrendaTopM
      );
    } else if (config.corteImperio) {
      yInferiorTopM = perfil.anillosClave.bajoBusto.y;
    }

    const corp = construirCorpino(perfil, config, yInferiorTopM, opciones);
    contarYAgregar(corp.mesh);
    if (corp.etiquetaFrente) etiquetas.push(corp.etiquetaFrente);

    if (config.escote === "wrap") {
      const wrap = construirEscoteWrapConVistas(
        perfil,
        config,
        yInferiorTopM,
        opciones
      );
      wrap.meshes.forEach(contarYAgregar);
      etiquetas.push(wrap.etiquetaVista);
    } else {
      const cuellos = construirCuellosYBotones(
        perfil,
        config,
        yInferiorTopM,
        opciones
      );
      cuellos.meshes.forEach(contarYAgregar);
      if (cuellos.etiquetaVista) etiquetas.push(cuellos.etiquetaVista);
    }

    const mangas = construirMangas(perfil, config, opciones);
    mangas.forEach(contarYAgregar);

    const resCostSup = poblarCosturasParteSuperior(
      perfil,
      config,
      yInferiorTopM,
      ajusteStretch,
      grupoCosturas,
      matCostura
    );
    if (resCostSup.etiquetaPinza) etiquetaPinza = resCostSup.etiquetaPinza;
  }

  // Costura de corte horizontal en cintura si la prenda lleva unión/pretina en cintura
  const llevaCorteCintura =
    config.prenda === "vestido" ||
    config.prenda === "enterizo" ||
    config.prenda === "falda" ||
    config.prenda === "pantalon" ||
    Boolean(config.esDosPiezas);

  if (llevaCorteCintura) {
    const yCorteCintura =
      config.corteImperio && config.prenda === "vestido"
        ? perfil.anillosClave.bajoBusto.y
        : perfil.cinturaYM;
    const ptsCint: THREE.Vector3[] = [];
    const offsetCint = config.cinturon ? 0.0072 : OFFSET_COSTURA_M + 0.0025;
    for (let s = 0; s <= 48; s++) {
      const theta = ((s / 48) - 0.5) * Math.PI * 2;
      ptsCint.push(
        evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yCorteCintura,
          theta,
          ajusteStretch,
          offsetCint
        )
      );
    }
    grupoCosturas.add(crearLineaPespunte(ptsCint, matCostura, "costura-cintura"));
  }

  if (requiereFalda) {
    const yInicioFaldaM =
      config.corteImperio && config.prenda === "vestido"
        ? perfil.anillosClave.bajoBusto.y
        : perfil.cinturaYM;
    const faldaMeshes = construirFaldaYBolero(
      perfil,
      config,
      yInicioFaldaM,
      opciones
    );
    faldaMeshes.forEach(contarYAgregar);

    const resCostFalda = poblarCosturasFalda(
      perfil,
      config,
      yInicioFaldaM,
      ajusteStretch,
      requiereParteSuperior,
      grupoCosturas,
      matCostura
    );
    if (!etiquetaPinza && resCostFalda.etiquetaPinza) {
      etiquetaPinza = resCostFalda.etiquetaPinza;
    }

    if (!requiereParteSuperior) {
      const cad = perfil.anillosClave.cadera;
      etiquetas.push({
        id: "lbl-delantero",
        texto: "Delantero",
        posicionLocalM: [0, cad.y, cad.desplazamientoZ + cad.b + cmAMetros(3)],
        normalLocal: [0, 0, 1],
      });
    }
  }

  if (requierePantalon) {
    const pantMeshes = construirPantalon(perfil, config, opciones);
    pantMeshes.forEach(contarYAgregar);

    const resCostPant = poblarCosturasPantalon(
      perfil,
      config,
      ajusteStretch,
      requiereParteSuperior,
      grupoCosturas,
      matCostura
    );
    if (!etiquetaPinza && resCostPant.etiquetaPinza) {
      etiquetaPinza = resCostPant.etiquetaPinza;
    }

    if (!requiereParteSuperior) {
      const cad = perfil.anillosClave.cadera;
      etiquetas.push({
        id: "lbl-delantero",
        texto: "Delantero",
        posicionLocalM: [0, cad.y, cad.desplazamientoZ + cad.b + cmAMetros(3)],
        normalLocal: [0, 0, 1],
      });
    }
  }

  if (etiquetaPinza) {
    etiquetas.push(etiquetaPinza);
  }

  // Etiqueta trasera de orientación general
  const espaldaRef = perfil.anillosClave.busto;
  etiquetas.push({
    id: "lbl-trasero",
    texto: "Trasero",
    posicionLocalM: [
      0,
      espaldaRef.y,
      espaldaRef.desplazamientoZ - espaldaRef.b - cmAMetros(3),
    ],
    normalLocal: [0, 0, -1],
  });

  if (config.cinturon) {
    const cint = construirCinturonConLazo(perfil, config, opciones);
    cint.objetos.forEach(contarYAgregar);
    etiquetas.push(cint.etiqueta);
  }

  grupo.add(grupoCosturas);

  return {
    grupo,
    grupoCosturas,
    etiquetas,
    triangulosTotales,
  };
}
