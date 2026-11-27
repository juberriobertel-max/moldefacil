import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { PatternPiece, SolvedTracingProportions } from "../types";
import { evaluarPerfilEnY } from "./bodyProfile";
import {
  CLOTH_DRAPE_PARAMS,
  applySkirtClothDrape,
  applySleeveClothDrape,
  applyTorsoAnatomicalSculptAndDrape,
  applyTrouserClothDrape,
  bakeClothCreviceAO,
} from "./clothDrapeEngine";
import {
  AnilloPerfil,
  ConfigPrenda,
  Etiqueta3DAncla,
  NivelDetalle3D,
  PerfilCuerpo,
  TipoEscote,
  TipoTela,
  cmAMetros,
} from "./types";

export const TILE_ESTAMPADO_M = 0.08;
export const OFFSET_COSTURA_M = 0.0024;

export type ZonaPieza3D =
  | "delantero"
  | "espalda"
  | "manga"
  | "falda_inferior"
  | "pantalon_inferior"
  | "cuello_vista"
  | "cinturon"
  | "bolsillo"
  | "bolero"
  | "sombrero"
  | "cartuchera";

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
  materialSecundario?: THREE.MeshPhysicalMaterial;
  materialForroOVista?: THREE.MeshPhysicalMaterial;
  mostrarCosturas: boolean;
  /** Factor extra de ceñido para telas elásticas como licra (mantiene r >= r_cuerpo). */
  ajusteTelaStretchM?: number;
  /** Tipo de tejido físico para calibrar pliegues, caída XPBD y oclusión ambiental. */
  tipoTela?: TipoTela;
}

export interface ResultadoMallaPrenda {
  grupo: THREE.Group;
  grupoCosturas: THREE.Group;
  grupoCintasMetricas: THREE.Group;
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
  escoteCerrado = false,
  proporcionesFoto?: SolvedTracingProportions
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

  if (proporcionesFoto?.necklineDropRatio) {
    const dropFotoM = clamp(
      cmAMetros(42 * proporcionesFoto.necklineDropRatio),
      cmAMetros(3.5),
      cmAMetros(22.0)
    );
    const factorMod = clamp(dropFotoM / cmAMetros(10.5), 0.48, 1.92);
    dropDelanteroM *= factorMod;
  }

  return Math.max(
    perfil.bustoYM - cmAMetros(6.8),
    lineaBase - dropDelanteroM
  );
}

/**
 * Registra metadatos de caída animada, sombra y zona semántica de una malla.
 */
function registrarMalla(
  mesh: THREE.Mesh,
  pesos?: Float32Array,
  zonaPieza?: ZonaPieza3D
): number {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.materialOriginal = mesh.material;
  if (zonaPieza) {
    mesh.userData.zonaPieza = zonaPieza;
  }
  const posAttr = mesh.geometry.getAttribute("position");
  if (posAttr instanceof THREE.BufferAttribute && !mesh.geometry.getAttribute("color")) {
    const white = new Float32Array(posAttr.count * 3);
    white.fill(1);
    mesh.geometry.setAttribute("color", new THREE.Float32BufferAttribute(white, 3));
  }
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
    // Guarantee vertex colors exist on every cloth/trim mesh when vertexColors: true is enabled
    if (!geo.getAttribute("color")) {
      const white = new Float32Array(pos.count * 3);
      white.fill(1);
      geo.setAttribute("color", new THREE.Float32BufferAttribute(white, 3));
    }
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
 * Evalúa el radio máximo real de la malla posada del maniquí en `(y, theta)` si existe `envolventeCuerpo`.
 */
function evaluarRadioEnvolventeCuerpoM(
  perfil: PerfilCuerpo,
  y: number,
  theta: number
): number {
  const env = perfil.envolventeCuerpo;
  if (!env) return 0;
  if (y < env.yMinM - 0.02 || y > env.yMaxM + 0.01) return 0;

  const tY = clamp((y - env.yMinM) / Math.max(1e-5, env.yMaxM - env.yMinM), 0, 1);
  const rowF = tY * (env.rows - 1);
  const r0 = Math.floor(rowF);
  const r1 = Math.min(env.rows - 1, r0 + 1);
  const fr = rowF - r0;

  let th = theta % (Math.PI * 2);
  if (th > Math.PI) th -= Math.PI * 2;
  if (th < -Math.PI) th += Math.PI * 2;
  const tTh = (th + Math.PI) / (Math.PI * 2);
  const colF = tTh * env.cols;
  const c0 = ((Math.floor(colF) % env.cols) + env.cols) % env.cols;
  const c1 = (c0 + 1) % env.cols;
  const fc = colF - Math.floor(colF);

  const v00 = env.radiosMaxM[r0 * env.cols + c0];
  const v10 = env.radiosMaxM[r0 * env.cols + c1];
  const v01 = env.radiosMaxM[r1 * env.cols + c0];
  const v11 = env.radiosMaxM[r1 * env.cols + c1];
  const top = v00 + (v10 - v00) * fc;
  const bot = v01 + (v11 - v01) * fc;
  return top + (bot - top) * fr;
}

/**
 * Garantiza que un punto `(x, y, z)` en la zona del torso/falda permanezca estrictamente fuera
 * tanto de la elipse anatómica como de la superficie real posada del maniquí con al menos `holguraMinM`.
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
  let px = x;
  let pz = z;

  if (y >= perfil.musloYM - 0.02) {
    const aMin = anillo.a + holguraMinM;
    const bMin = anillo.b + holguraMinM;
    const dx = px / Math.max(1e-4, aMin);
    const dz = (pz - anillo.desplazamientoZ) / Math.max(1e-4, bMin);
    const norm = Math.hypot(dx, dz);
    if (norm < 1) {
      if (norm < 1e-6) {
        px = 0;
        pz = anillo.desplazamientoZ + bMin;
      } else {
        px = (dx / norm) * aMin;
        pz = anillo.desplazamientoZ + (dz / norm) * bMin;
      }
    }
  }

  if (perfil.envolventeCuerpo) {
    const dz = pz - anillo.desplazamientoZ;
    const theta = Math.atan2(px, dz);
    const rEnv = evaluarRadioEnvolventeCuerpoM(perfil, y, theta);
    if (rEnv > 0.01) {
      const rMinEnv = rEnv + Math.max(holguraMinM + 0.0018, 0.0042);
      const rCur = Math.hypot(px, dz);
      if (rCur < rMinEnv) {
        if (rCur < 1e-6) {
          px = 0;
          pz = anillo.desplazamientoZ + rMinEnv;
        } else {
          const esc = rMinEnv / rCur;
          px *= esc;
          pz = anillo.desplazamientoZ + dz * esc;
        }
      }
    }
  }

  return { x: px, y, z: pz };
}

/**
 * Empuja un punto `(x, y, z)` fuera del brazo o pierna real (cápsula cónica entre A y B)
 * manteniendo al menos `holguraMinM` sobre la extremidad opaca del maniquí.
 */
function proyectarFueraDeSegmento(
  px: number,
  py: number,
  pz: number,
  inicio: readonly [number, number, number],
  fin: readonly [number, number, number],
  rInicio: number,
  rFin: number,
  holguraMinM: number
): { x: number; y: number; z: number } {
  const ax = fin[0] - inicio[0];
  const ay = fin[1] - inicio[1];
  const az = fin[2] - inicio[2];
  const lenSq = ax * ax + ay * ay + az * az;
  if (lenSq < 1e-8) return { x: px, y: py, z: pz };

  const t = clamp(
    ((px - inicio[0]) * ax + (py - inicio[1]) * ay + (pz - inicio[2]) * az) / lenSq,
    0,
    1
  );
  const qx = inicio[0] + ax * t;
  const qy = inicio[1] + ay * t;
  const qz = inicio[2] + az * t;

  const rObj = THREE.MathUtils.lerp(rInicio, rFin, t) + holguraMinM;
  const dx = px - qx;
  const dy = py - qy;
  const dz = pz - qz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= rObj) return { x: px, y: py, z: pz };
  if (dist < 1e-6) {
    return { x: qx, y: qy + rObj, z: qz };
  }
  const esc = rObj / dist;
  return {
    x: qx + dx * esc,
    y: qy + dy * esc,
    z: qz + dz * esc,
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
      config.escoteCerrado,
      config.proporcionesFoto
    ),
    perfil.bustoYM - cmAMetros(7.0),
    yMaxAbs
  );

  if (config.manga === "ninguna") {
    const distSisa = Math.abs(Math.abs(theta) - SISA_ESTANDAR.thetaCentro);
    if (distSisa < SISA_ESTANDAR.anchoRad) {
      const factor = smoothstep(SISA_ESTANDAR.anchoRad, 0, distSisa);
      const multSisa = clamp(
        config.proporcionesFoto?.armholeDepthMultiplier ?? 1,
        0.78,
        1.32
      );
      yTopFinal = Math.min(
        yTopFinal,
        perfil.hombroYM - cmAMetros(11) * multSisa * factor
      );
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
  sesgoAncho = 0.5,
  zonaPieza: ZonaPieza3D = "cuello_vista"
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
  registrarMalla(mesh, undefined, zonaPieza);
  return mesh;
}

/**
 * Construye un dobladillo tubular compacto de 3D (`anchoM × espesorM`) a lo largo de un anillo de borde
 * para dar grosor real a ruedos de falda, blusa, bocamangas y botas sin aspecto plano.
 */
function construirDobladilloDesdeAnillo(
  puntosAnillo: readonly THREE.Vector3[],
  material: THREE.MeshPhysicalMaterial,
  nombre: string,
  zonaPieza: ZonaPieza3D,
  espesorM = 0.0022,
  altoM = 0.0075
): THREE.Mesh {
  const n = puntosAnillo.length;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  if (n < 3) {
    const empty = new THREE.Mesh(new THREE.BufferGeometry(), material);
    empty.name = nombre;
    registrarMalla(empty, undefined, zonaPieza);
    return empty;
  }

  // Calcular centroide del anillo para extraer normales radiales hacia afuera del tubo
  const centro = new THREE.Vector3();
  for (let i = 0; i < n; i++) centro.add(puntosAnillo[i]);
  centro.divideScalar(n);

  let arcLen = 0;
  for (let i = 0; i <= n; i++) {
    const p = puntosAnillo[i % n];
    if (i > 0) {
      arcLen += p.distanceTo(puntosAnillo[(i - 1) % n]);
    }
    const radial = new THREE.Vector3(p.x - centro.x, 0, p.z - centro.z);
    if (radial.lengthSq() < 1e-8) radial.set(0, 0, 1);
    else radial.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    // 4 esquinas cerrando un canto suavemente redondeado alrededor del borde inferior
    const ptsPerimetro = [
      p.clone().addScaledVector(up, altoM).addScaledVector(radial, espesorM * 0.9),
      p.clone().addScaledVector(up, 0).addScaledVector(radial, espesorM),
      p.clone().addScaledVector(up, -espesorM * 0.55).addScaledVector(radial, 0.0),
      p.clone().addScaledVector(up, altoM * 0.7).addScaledVector(radial, -espesorM * 0.25),
    ];

    for (let c = 0; c <= 4; c++) {
      const cp = ptsPerimetro[c % 4];
      pos.push(cp.x, cp.y, cp.z);
      uvs.push(arcLen, (c / 4) * altoM * 2);
    }
  }

  const cols = 5;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) {
      const a = i * cols + c;
      const b = (i + 1) * cols + c;
      const cNext = i * cols + (c + 1);
      const d = (i + 1) * cols + (c + 1);
      idx.push(a, cNext, b, cNext, d, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  finalizarGeometria(geo);

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = nombre;
  registrarMalla(mesh, undefined, zonaPieza);
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
  ajusteStretchM: number,
  extraOffsetRadialM = 0
): { x: number; y: number; z: number; extKimono: number; pesoCaida: number } {
  const deltaR = calcularDeltaRadioM(config, anillo.y, perfil, ajusteStretchM);
  let rExtra = deltaR + extraOffsetRadialM;

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

  // Garantiza que el contorno inicial rodee también la malla real posada (senos, clavículas, trapecios)
  if (perfil.envolventeCuerpo) {
    const rEnv = evaluarRadioEnvolventeCuerpoM(perfil, y, theta);
    if (rEnv > 0.01) {
      const holguraEnv = Math.max(0.0048, deltaR * 0.65) + extraOffsetRadialM;
      const dzCur = z - anillo.desplazamientoZ;
      const rCur = Math.hypot(x, dzCur);
      if (rCur < rEnv + holguraEnv) {
        const esc = (rEnv + holguraEnv) / Math.max(1e-4, rCur);
        x *= esc;
        z = anillo.desplazamientoZ + dzCur * esc;
      }
    }
  }

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
        const brazo = ladoSign < 0 ? perfil.trayectorias.brazoIzq : perfil.trayectorias.brazoDer;
        const alcanceMangaM = Math.min(perfil.largoMangaM * 0.58, cmAMetros(30));
        const extLat = alcanceMangaM * extKimono;
        // Cae suavemente acompañando la pendiente natural del brazo superior sin perder forma kimono
        x += ladoSign * extLat * 0.86;
        y -= extLat * 0.56 * (1 - 0.35 * yFactor);
        z += cmAMetros(0.6) * extKimono;

        // Protegemos tanto el torso como el brazo opaco y codo contra cualquier penetración
        const trasBrazo = proyectarFueraDeSegmento(
          x,
          y,
          z,
          brazo.hombro,
          brazo.codo,
          brazo.radioHombroM,
          brazo.radioCodoM,
          Math.max(0.01, deltaR * 0.95)
        );
        x = trasBrazo.x;
        y = trasBrazo.y;
        z = trasBrazo.z;

        const seguro = proyectarFueraDelTorso(x, y, z, perfil, Math.max(0.004, deltaR * 0.85));
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
 * Construye la malla superior del corpiño (blusa, chaqueta, top de vestido, body o enterizo)
 * con recorte anatómico `h(θ)` en el escote, abertura opcional de chaqueta y dobladillo 3D inferior.
 */
function construirCorpino(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInferiorM: number,
  opciones: OpcionesMallaPrenda,
  extraOffsetRadialM = 0
): { mesh: THREE.Mesh; extras?: THREE.Object3D[]; etiquetaFrente?: Etiqueta3DAncla } {
  const segsRad = opciones.nivelDetalle === "movil" ? 44 : 72;
  const rows = opciones.nivelDetalle === "movil" ? 22 : 36;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;
  const tela: TipoTela = opciones.tipoTela ?? (ajusteStretch < 0 ? "licra" : "crepe");

  const esBodyInfantil = config.subEstiloEspecial === "baby_bodysuit";
  const yMinAbs = esBodyInfantil
    ? clamp(
        perfil.cinturaYM - perfil.alturaTiroM * 0.92,
        perfil.musloYM + 0.008,
        perfil.caderaYM
      )
    : clamp(
        yInferiorM,
        perfil.caderaYM - cmAMetros(8),
        perfil.bustoYM - cmAMetros(2)
      );

  const esWrap = config.escote === "wrap";
  const esChaquetaAbierta =
    (config.prenda === "chaqueta" || config.dosPiezasArriba === "jacket_blazer") &&
    config.escote === "solapaSastre";

  const positions: number[] = [];
  const uvs: number[] = [];
  const weights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const tRow = r / (rows - 1);
    for (let s = 0; s <= segsRad; s++) {
      const fracS = s / segsRad;
      const theta = (fracS - 0.5) * Math.PI * 2;
      const yTopFinal = calcularAlturaTopEscoteYSisa(config, theta, perfil);
      const yBotTheta = esBodyInfantil
        ? yMinAbs + cmAMetros(6.8) * Math.pow(Math.sin(theta), 2)
        : yMinAbs;

      const y = yTopFinal + (yBotTheta - yTopFinal) * tRow;
      const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
      const pt = muestrearPuntoTorsoPrenda(
        anillo,
        theta,
        perfil,
        config,
        ajusteStretch,
        extraOffsetRadialM
      );

      positions.push(pt.x, pt.y, pt.z);
      const circEstimado = Math.PI * (anillo.a + anillo.b);
      uvs.push((theta / (Math.PI * 2)) * circEstimado, y);
      weights.push(pt.pesoCaida);
    }
  }

  // Real cloth sculpt (sternum bridge, bust dart tucks, underarm creases) + XPBD drape relaxation
  if (!esBodyInfantil) {
    applyTorsoAnatomicalSculptAndDrape({
      positions,
      rows,
      cols: segsRad + 1,
      perfil,
      config,
      tela,
      projectTorsoSafe: (x, y, z) =>
        proyectarFueraDelTorso(x, y, z, perfil, Math.max(0.0022, extraOffsetRadialM + 0.0022)),
    });
  }

  const puntosRuedoInferior: THREE.Vector3[] = [];
  const lastRowOffset = (rows - 1) * (segsRad + 1);
  for (let s = 0; s < segsRad; s++) {
    const i3 = (lastRowOffset + s) * 3;
    puntosRuedoInferior.push(
      new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2])
    );
  }

  const cols = segsRad + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < segsRad; s++) {
      const fracMid = (s + 0.5) / segsRad;
      const thetaMid = (fracMid - 0.5) * Math.PI * 2;

      if (esWrap && r < Math.floor(rows * 0.55) && Math.abs(thetaMid) < 0.24) {
        continue;
      }
      if (
        config.escote === "solapaSastre" &&
        r < Math.floor(rows * 0.34) &&
        Math.abs(thetaMid) < (1 - r / Math.max(1, rows * 0.36)) * 0.16
      ) {
        continue;
      }
      if (esChaquetaAbierta && Math.abs(thetaMid) < 0.068) {
        continue;
      }
      if (
        config.escote === "camisero" &&
        r < Math.floor(rows * 0.12) &&
        Math.abs(thetaMid) < 0.08
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
    geo = mergeVertices(geo, 1e-4);
  }
  finalizarGeometria(geo);
  bakeClothCreviceAO(geo, CLOTH_DRAPE_PARAMS[tela].aoIntensity);

  const mesh = new THREE.Mesh(geo, opciones.materialPrincipal);
  mesh.name = "garment-corpino";

  const extras: THREE.Object3D[] = [];

  // Vistas delanteras verticales en chaqueta abierta
  if (esChaquetaAbierta) {
    const matVista = opciones.materialForroOVista ?? opciones.materialPrincipal;
    for (const lado of [-1, 1] as const) {
      const muestrasFrente: MuestraTiraTorso[] = [];
      const thetaEdge = lado * 0.085;
      const yTopEdge = perfil.bustoYM - cmAMetros(2.0);
      for (let i = 0; i <= 10; i++) {
        const y = THREE.MathUtils.lerp(yTopEdge, yMinAbs, i / 10);
        const an = evaluarPerfilEnY(perfil.anillosInterpolados, y);
        const pt = muestrearPuntoTorsoPrenda(
          an,
          thetaEdge,
          perfil,
          config,
          ajusteStretch,
          extraOffsetRadialM + 0.0025
        );
        muestrasFrente.push({
          pos: new THREE.Vector3(pt.x, pt.y, pt.z),
          normalOut: calcularNormalTorso(an, thetaEdge),
        });
      }
      extras.push(
        construirTiraConRelieveSobreTorso(
          muestrasFrente,
          cmAMetros(2.4),
          0.003,
          false,
          perfil,
          0.004,
          matVista,
          `chaqueta-frente-vista-${lado > 0 ? "izq" : "der"}`,
          0.5,
          "cuello_vista"
        )
      );
    }
  }

  // Dobladillo inferior con grosor 3D para prendas superiores separadas
  const llevaDobladilloInferior =
    config.prenda === "blusa" ||
    config.prenda === "chaqueta" ||
    (config.esDosPiezas && config.dosPiezasArriba === "crop_top") ||
    config.dosPiezasArriba === "waist_blouse" ||
    config.dosPiezasArriba === "jacket_blazer";
  if (llevaDobladilloInferior && !esChaquetaAbierta && puntosRuedoInferior.length >= 6) {
    extras.push(
      construirDobladilloDesdeAnillo(
        puntosRuedoInferior,
        opciones.materialPrincipal,
        "corpino-dobladillo-inferior",
        "delantero",
        0.0022,
        0.0075
      )
    );
  }

  // Broches inferiores en el tiro para body infantil
  if (esBodyInfantil) {
    const snapGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.003, 12);
    const snapMat = new THREE.MeshStandardMaterial({
      color: 0xd0d4da,
      roughness: 0.28,
      metalness: 0.72,
    });
    const instSnaps = new THREE.InstancedMesh(snapGeo, snapMat, 3);
    instSnaps.name = "body-infantil-broches";
    instSnaps.userData.esHerraje = true;
    instSnaps.userData.zonaPieza = "delantero";
    const dummy = new THREE.Object3D();
    const anSnap = evaluarPerfilEnY(perfil.anillosInterpolados, yMinAbs + 0.008);
    [-0.018, 0, 0.018].forEach((ox, i) => {
      dummy.position.set(ox, yMinAbs + 0.004, anSnap.desplazamientoZ + 0.01);
      dummy.rotation.x = Math.PI * 0.42;
      dummy.updateMatrix();
      instSnaps.setMatrixAt(i, dummy.matrix);
    });
    instSnaps.instanceMatrix.needsUpdate = true;
    extras.push(instSnaps);
  }

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

  registrarMalla(mesh, new Float32Array(weights), "delantero");
  return { mesh, extras: extras.length > 0 ? extras : undefined, etiquetaFrente };
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
        const seguro = proyectarFueraDelTorso(
          a * Math.sin(theta),
          y,
          anillo.desplazamientoZ + b * Math.cos(theta),
          perfil,
          pan.normalExtra + 0.0025
        );
        pos.push(seguro.x, y, seguro.z);
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
    registrarMalla(mesh, undefined, "delantero");
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
    0.5,
    "cuello_vista"
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

  // Solapa Sastre o Cuello Camisero: cuello posterior continuo pegado al escote + solapas articuladas + pechera central
  if (config.escote === "solapaSastre" || config.escote === "camisero") {
    const cuelloMuestras: MuestraTiraTorso[] = [];
    const pasosCuello = 28;
    const esCamisero = config.escote === "camisero";
    const thetaInicio = esCamisero ? 0.16 : 0.22;

    for (let i = 0; i <= pasosCuello; i++) {
      const t = i / pasosCuello;
      // Recorre del frente-izq por la nuca (π) hasta el frente-der siguiendo la curva real del escote
      const theta = THREE.MathUtils.lerp(thetaInicio, Math.PI * 2 - thetaInicio, t);
      const factorFrente = Math.exp(-Math.pow(Math.sin(theta * 0.5) / 0.28, 2));
      const yCurva =
        perfil.cuelloYM - cmAMetros(1.1) - (esCamisero ? cmAMetros(1.1) : cmAMetros(1.6)) * factorFrente;
      const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, yCurva);
      const rCuello = calcularDeltaRadioM(config, yCurva, perfil, ajusteStretch) + 0.0055;

      cuelloMuestras.push({
        pos: new THREE.Vector3(
          (anillo.a + rCuello) * Math.sin(theta),
          yCurva + cmAMetros(0.8),
          anillo.desplazamientoZ + (anillo.b + rCuello) * Math.cos(theta)
        ),
        normalOut: calcularNormalTorso(anillo, theta),
      });
    }

    objetos.push(
      construirTiraConRelieveSobreTorso(
        cuelloMuestras,
        esCamisero ? cmAMetros(3.8) : cmAMetros(4.4),
        0.0032,
        false,
        perfil,
        0.0045,
        mat,
        "cuello-superior",
        0.3
      )
    );

    // Solapas / picos de cuello doblados desde la unión del cuello sin dejar huecos
    for (const lado of [-1, 1] as const) {
      const yTopSolapa = perfil.cuelloYM - cmAMetros(1.9);
      const yFinSolapa = esCamisero
        ? perfil.bustoYM + cmAMetros(5.2)
        : perfil.bustoYM - cmAMetros(4.2);
      const anchoSolapa = esCamisero ? 0.032 : 0.056;

      const solapaMuestras: MuestraTiraTorso[] = [];
      for (let i = 0; i <= 10; i++) {
        const tf = i / 10;
        const y = THREE.MathUtils.lerp(yTopSolapa, yFinSolapa, tf);
        const theta =
          lado *
          (esCamisero
            ? THREE.MathUtils.lerp(0.24, 0.09, tf)
            : THREE.MathUtils.lerp(0.26, 0.06, tf));
        const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
        const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.0065;
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
          0.0032,
          false,
          perfil,
          0.005,
          mat,
          `solapa-${lado > 0 ? "izq" : "der"}`,
          0.5
        )
      );
    }

    // Pechera vertical centrada en camisero para alojar los botones con relieve limpio
    if (esCamisero) {
      const placketMuestras: MuestraTiraTorso[] = [];
      const yTopPlacket = perfil.bustoYM + cmAMetros(6.0);
      const yBotPlacket = Math.max(yInferiorM + cmAMetros(2.0), perfil.cinturaYM - cmAMetros(4.0));
      for (let i = 0; i <= 12; i++) {
        const y = THREE.MathUtils.lerp(yTopPlacket, yBotPlacket, i / 12);
        const anillo = evaluarPerfilEnY(perfil.anillosInterpolados, y);
        const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.0055;
        placketMuestras.push({
          pos: new THREE.Vector3(
            0,
            y,
            anillo.desplazamientoZ + anillo.b + dr
          ),
          normalOut: calcularNormalTorso(anillo, 0),
        });
      }
      objetos.push(
        construirTiraConRelieveSobreTorso(
          placketMuestras,
          cmAMetros(2.6),
          0.0028,
          false,
          perfil,
          0.0045,
          mat,
          "pechera-camisero",
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
    instBotones.castShadow = true;
    instBotones.userData.esHerraje = true;
    instBotones.userData.zonaPieza = "cuello_vista";
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
      const pBtn = evaluarPuntoTorsoConOffset(
        perfil,
        config,
        yBtn,
        0,
        ajusteStretch,
        esCamisero ? 0.0095 : 0.0045
      );
      dummy.position.set(pBtn.x, pBtn.y, pBtn.z);
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
 * Construye mangas pegadas (corta/larga), acampanadas y farol sobre la trayectoria real
 * del brazo exportada desde `bodyProfile.ts` (`rBrazo + holgura`), encajando la copa en la sisa.
 */
function construirMangas(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): THREE.Mesh[] {
  if (config.manga === "ninguna" || config.manga === "kimono") return [];

  const meshes: THREE.Mesh[] = [];
  const rings = opciones.nivelDetalle === "movil" ? 16 : 26;
  const segs = opciones.nivelDetalle === "movil" ? 22 : 32;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;
  const tela: TipoTela = opciones.tipoTela ?? (ajusteStretch < 0 ? "licra" : "crepe");

  const holguraBaseM =
    (config.silueta === "holgado" ? 0.015 : 0.01) +
    Math.max(0, ajusteStretch * 0.3);

  for (const lado of [-1, 1] as const) {
    const brazo = lado < 0 ? perfil.trayectorias.brazoIzq : perfil.trayectorias.brazoDer;
    const pHombroReal = new THREE.Vector3(...brazo.hombro);
    const pCodo = new THREE.Vector3(...brazo.codo);
    const pMuneca = new THREE.Vector3(...brazo.muneca);

    const largoBrazoReal = Math.max(
      0.24,
      pHombroReal.distanceTo(pCodo) + pCodo.distanceTo(pMuneca)
    );

    let tFinBrazo = 0.36;
    if (
      config.manga === "largaPegada" ||
      config.manga === "acampanada" ||
      config.manga === "raglan"
    ) {
      tFinBrazo = clamp(perfil.largoMangaM / largoBrazoReal, 0.72, 0.99);
    } else if (config.manga === "farol") {
      tFinBrazo = 0.45;
    }

    const pInicioCopa = pHombroReal
      .clone()
      .add(new THREE.Vector3(-lado * 0.013, 0.01, 0));

    const trayectoria = new THREE.CatmullRomCurve3([
      pInicioCopa,
      pHombroReal.clone().lerp(pCodo, 0.5),
      pCodo,
      pCodo.clone().lerp(pMuneca, 0.5),
      pMuneca,
    ]);

    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const pesos = new Float32Array((rings + 1) * (segs + 1));

    const evaluarRadioBrazoReal = (u: number): number => {
      if (u <= 0.52) {
        return THREE.MathUtils.lerp(
          brazo.radioHombroM,
          brazo.radioCodoM,
          u / 0.52
        );
      }
      const k = (u - 0.52) / 0.48;
      return THREE.MathUtils.lerp(brazo.radioCodoM * 1.03, brazo.radioMunecaM, k);
    };

    for (let r = 0; r <= rings; r++) {
      const tr = r / rings;
      const uT = tr * tFinBrazo;
      const centro = trayectoria.getPoint(uT);
      const tangente = trayectoria.getTangent(uT).normalize();
      const refUp =
        Math.abs(tangente.x) < 0.9
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 0, 1);
      const normalU = new THREE.Vector3().crossVectors(refUp, tangente).normalize();
      const binormalV = new THREE.Vector3().crossVectors(tangente, normalU).normalize();

      let radio = evaluarRadioBrazoReal(uT) + holguraBaseM;
      if (config.manga === "acampanada" && uT > 0.42) {
        const fCamp = (uT - 0.42) / Math.max(0.1, tFinBrazo - 0.42);
        radio += Math.pow(fCamp, 1.35) * cmAMetros(7.2);
      } else if (config.manga === "farol") {
        const puff = Math.sin(tr * Math.PI);
        radio += puff * cmAMetros(4.2);
        if (tr > 0.85) radio = Math.max(evaluarRadioBrazoReal(uT) + 0.008, radio * 0.88);
      }

      const fCopa = smoothstep(0.24, 0, tr);
      const vPos = uT * largoBrazoReal;
      const circ = Math.PI * 2 * radio;

      for (let s = 0; s <= segs; s++) {
        const theta = ((s / segs) - 0.5) * Math.PI * 2;
        const p = centro
          .clone()
          .addScaledVector(normalU, Math.cos(theta) * radio)
          .addScaledVector(binormalV, Math.sin(theta) * radio);

        if (fCopa > 0.001) {
          const dYNorm = clamp((p.y - centro.y) / Math.max(0.01, radio), -1, 1);
          const dInwardNorm = clamp((-lado * (p.x - centro.x)) / Math.max(0.01, radio), -1, 1);
          if (dYNorm > 0) {
            p.x -= lado * 0.016 * fCopa * dYNorm;
            p.y += 0.009 * fCopa * dYNorm;
          }
          if (dInwardNorm > 0) {
            p.x -= lado * 0.014 * fCopa * dInwardNorm;
          }
        }

        const envSup = proyectarFueraDeSegmento(
          p.x,
          p.y,
          p.z,
          brazo.hombro,
          brazo.codo,
          brazo.radioHombroM,
          brazo.radioCodoM,
          0.0065
        );
        const envAnt = proyectarFueraDeSegmento(
          envSup.x,
          envSup.y,
          envSup.z,
          brazo.codo,
          brazo.muneca,
          brazo.radioCodoM,
          brazo.radioMunecaM,
          0.0065
        );

        pos.push(envAnt.x, envAnt.y, envAnt.z);
        uvs.push((theta / (Math.PI * 2)) * circ, -vPos);
        pesos[r * (segs + 1) + s] =
          config.manga === "acampanada" ? Math.pow(tr, 1.6) * 0.65 : tr * 0.25;
      }
    }

    // Apply physical cloth drape (gravity underside hang, elbow creases, shoulder cap gathers)
    applySleeveClothDrape({
      positions: pos,
      rings,
      segs,
      lado,
      brazo,
      config,
      tela,
      projectArmSafe: (x, y, z) => {
        const s1 = proyectarFueraDeSegmento(
          x,
          y,
          z,
          brazo.hombro,
          brazo.codo,
          brazo.radioHombroM,
          brazo.radioCodoM,
          0.0065
        );
        return proyectarFueraDeSegmento(
          s1.x,
          s1.y,
          s1.z,
          brazo.codo,
          brazo.muneca,
          brazo.radioCodoM,
          brazo.radioMunecaM,
          0.0065
        );
      },
    });

    const puntosBocamanga: THREE.Vector3[] = [];
    const lastRingOffset = rings * (segs + 1);
    for (let s = 0; s < segs; s++) {
      const i3 = (lastRingOffset + s) * 3;
      puntosBocamanga.push(new THREE.Vector3(pos[i3], pos[i3 + 1], pos[i3 + 2]));
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
    bakeClothCreviceAO(geo, CLOTH_DRAPE_PARAMS[tela].aoIntensity);

    const mesh = new THREE.Mesh(geo, opciones.materialPrincipal);
    mesh.name = `manga-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(mesh, pesos, "manga");
    meshes.push(mesh);

    if (puntosBocamanga.length >= 6) {
      meshes.push(
        construirDobladilloDesdeAnillo(
          puntosBocamanga,
          opciones.materialPrincipal,
          `dobladillo-manga-${lado > 0 ? "izq" : "der"}`,
          "manga",
          0.0018,
          0.006
        )
      );
    }
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
  yCinturaInicioM: number,
  perfil: PerfilCuerpo
): { largoTotalFaldaM: number; boleroAltoM: number; yRuedoPrincipalM: number } {
  const yPisoSeguroM = Math.max(0.032, perfil.alturaTobilloM * 0.42);
  const largoTotalFaldaM = clamp(
    cmAMetros(config.largoDeseado),
    0.22,
    Math.max(0.24, yCinturaInicioM - yPisoSeguroM)
  );
  const boleroAltoM = config.bolero ? Math.min(cmAMetros(15), largoTotalFaldaM * 0.28) : 0;
  const yRuedoPrincipalM = Math.max(
    yPisoSeguroM,
    yCinturaInicioM - (largoTotalFaldaM - boleroAltoM * 0.7)
  );
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
  const pierna = perfil.trayectorias.piernaDer;
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

  if (config.proporcionesFoto?.flareRatio) {
    const modFlare =
      clamp(config.proporcionesFoto.flareRatio - 1, -0.35, 0.85) *
      largoTotalFaldaM *
      0.22 *
      Math.pow(tr, 1.1);
    extraA = Math.max(drBase, extraA + modFlare);
    extraB = Math.max(drBase, extraB + modFlare * 0.92);
  }

  // Verificar envolvente real de muslos/rodillas/tobillos opacos por debajo de cadera
  let envPiernaX = anillo.a + drBase;
  let envPiernaZ = anillo.b + drBase;
  if (y < perfil.caderaYM) {
    const tRod = smoothstep(pierna.musloAlto[1], pierna.rodilla[1], y);
    const tTob = smoothstep(pierna.rodilla[1], pierna.tobillo[1], y);
    const legX =
      y >= pierna.rodilla[1]
        ? THREE.MathUtils.lerp(Math.abs(pierna.musloAlto[0]), Math.abs(pierna.rodilla[0]), tRod)
        : THREE.MathUtils.lerp(Math.abs(pierna.rodilla[0]), Math.abs(pierna.tobillo[0]), tTob);
    const legZ =
      y >= pierna.rodilla[1]
        ? THREE.MathUtils.lerp(pierna.musloAlto[2], pierna.rodilla[2], tRod)
        : THREE.MathUtils.lerp(pierna.rodilla[2], pierna.tobillo[2], tTob);
    const rPierna =
      y >= pierna.rodilla[1]
        ? THREE.MathUtils.lerp(pierna.radioMusloM, pierna.radioRodillaM, tRod)
        : THREE.MathUtils.lerp(pierna.radioRodillaM, pierna.radioTobilloM, tTob);
    envPiernaX = legX + rPierna + 0.012;
    envPiernaZ = Math.abs(legZ - anillo.desplazamientoZ) + rPierna + 0.014;
  }

  return {
    y,
    anillo,
    aBase: Math.max(anillo.a + drBase, anillo.a + extraA, envPiernaX),
    bBase: Math.max(anillo.b + drBase, anillo.b + extraB, envPiernaZ),
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
  const segs = opciones.nivelDetalle === "movil" ? 52 : 88;
  const rows = opciones.nivelDetalle === "movil" ? 18 : 32;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;
  const tela: TipoTela = opciones.tipoTela ?? (ajusteStretch < 0 ? "licra" : "crepe");

  const { largoTotalFaldaM, boleroAltoM, yRuedoPrincipalM } = calcularAlturasFalda(
    config,
    yCinturaInicioM,
    perfil
  );
  const caderaAnillo = perfil.anillosClave.cadera;
  const drBase = calcularDeltaRadioM(config, yCinturaInicioM, perfil, ajusteStretch);
  const matFalda =
    config.esDosPiezas && opciones.materialSecundario
      ? opciones.materialSecundario
      : opciones.materialPrincipal;

  if (config.prenda === "falda" || config.esDosPiezas) {
    const pretinaGeo = construirPretina(
      perfil,
      config,
      yCinturaInicioM,
      opciones,
      "falda_inferior"
    );
    meshes.push(pretinaGeo);
  }

  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const pesos = new Float32Array(rows * (segs + 1));

  for (let r = 0; r < rows; r++) {
    const tr = r / (rows - 1);
    const { y, aBase, bBase, zCentro, circRef } = evaluarAnilloFaldaEnTr(
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
      const pxRaw = aBase * Math.sin(theta);
      const pzRaw = zCentro + bBase * Math.cos(theta);
      const rEnv = evaluarRadioEnvolventeCuerpoM(perfil, y, theta);
      let px = pxRaw;
      let pz = pzRaw;
      if (rEnv > 0.01) {
        const dz = pz - zCentro;
        const rCur = Math.hypot(px, dz);
        const rMin = rEnv + Math.max(0.006, drBase * 0.5);
        if (rCur < rMin && rCur > 1e-5) {
          const esc = rMin / rCur;
          px *= esc;
          pz = zCentro + dz * esc;
        }
      }

      pos.push(px, y, pz);
      uvs.push(
        (theta / (Math.PI * 2)) * (circRef * (1 + tr * (config.vuelo === "circular" ? 1.1 : 0.3))),
        y
      );
      pesos[r * (segs + 1) + s] = Math.pow(tr, 1.45);
    }
  }

  // Real multi-harmonic cloth godets + XPBD gravity drape + leg/torso/GLB envelope collision
  const { piernaIzq, piernaDer } = perfil.trayectorias;
  applySkirtClothDrape({
    positions: pos,
    rows,
    cols: segs + 1,
    perfil,
    config,
    tela,
    projectSkirtSafe: (x, y, z) => {
      let cur = { x, y, z };
      if (y >= (perfil.envolventeCuerpo?.yMinM ?? perfil.caderaYM)) {
        cur = proyectarFueraDelTorso(cur.x, cur.y, cur.z, perfil, 0.0045);
      }
      if (cur.y < perfil.caderaYM) {
        for (const pierna of [piernaIzq, piernaDer]) {
          cur = proyectarFueraDeSegmento(
            cur.x,
            cur.y,
            cur.z,
            pierna.cadera,
            pierna.rodilla,
            pierna.radioMusloM,
            pierna.radioRodillaM,
            0.0085
          );
          cur = proyectarFueraDeSegmento(
            cur.x,
            cur.y,
            cur.z,
            pierna.rodilla,
            pierna.tobillo,
            pierna.radioRodillaM,
            pierna.radioTobilloM,
            0.0085
          );
        }
      }
      return cur;
    },
  });

  const puntosRuedoFalda: THREE.Vector3[] = [];
  const ultRowOffset = (rows - 1) * (segs + 1);
  for (let s = 0; s < segs; s++) {
    const i3 = (ultRowOffset + s) * 3;
    puntosRuedoFalda.push(new THREE.Vector3(pos[i3], pos[i3 + 1], pos[i3 + 2]));
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
  bakeClothCreviceAO(faldaGeo, CLOTH_DRAPE_PARAMS[tela].aoIntensity);

  const faldaMesh = new THREE.Mesh(faldaGeo, matFalda);
  faldaMesh.name = "falda-principal";
  registrarMalla(faldaMesh, pesos, "falda_inferior");
  meshes.push(faldaMesh);

  if (!config.bolero && puntosRuedoFalda.length >= 6) {
    meshes.push(
      construirDobladilloDesdeAnillo(
        puntosRuedoFalda,
        matFalda,
        "dobladillo-falda",
        "falda_inferior",
        0.0022,
        0.0075
      )
    );
  }

  if (config.bolero) {
    const boleroRows = 10;
    const yBoleroTop = yRuedoPrincipalM + cmAMetros(2);
    const yBoleroBot = Math.max(0.03, yBoleroTop - boleroAltoM);
    const bPos: number[] = [];
    const bUvs: number[] = [];
    const bIdx: number[] = [];
    const bPesos = new Float32Array(boleroRows * (segs + 1));

    for (let r = 0; r < boleroRows; r++) {
      const tr = r / (boleroRows - 1);
      const y = THREE.MathUtils.lerp(yBoleroTop, yBoleroBot, tr);
      for (let s = 0; s <= segs; s++) {
        const bx = pos[(ultRowOffset + s) * 3];
        const bz = pos[(ultRowOffset + s) * 3 + 2] - caderaAnillo.desplazamientoZ;
        const theta = ((s / segs) - 0.5) * Math.PI * 2;
        const radBase = Math.hypot(bx, bz);
        const exp =
          radBase +
          tr * cmAMetros(6.5) +
          (Math.sin(14 * theta) + 0.4 * Math.cos(21 * theta)) *
            cmAMetros(1.9) *
            Math.pow(tr, 1.2) *
            CLOTH_DRAPE_PARAMS[tela].drapeDepth;
        bPos.push(
          exp * Math.sin(theta),
          y,
          caderaAnillo.desplazamientoZ + exp * Math.cos(theta)
        );
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
    bakeClothCreviceAO(boleroGeo, CLOTH_DRAPE_PARAMS[tela].aoIntensity);

    const boleroMesh = new THREE.Mesh(boleroGeo, matFalda);
    boleroMesh.name = "falda-bolero";
    registrarMalla(boleroMesh, bPesos, "bolero");
    meshes.push(boleroMesh);
  }

  void evaluarOndaFaldaEnTheta;
  return meshes;
}

function construirPretina(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yCinturaM: number,
  opciones: OpcionesMallaPrenda,
  zonaPieza: ZonaPieza3D = "falda_inferior"
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
      const p = proyectarFueraDelTorso(
        (anillo.a + dr) * Math.sin(theta),
        y,
        anillo.desplazamientoZ + (anillo.b + dr) * Math.cos(theta),
        perfil,
        0.0045
      );
      pos.push(p.x, y, p.z);
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
  const matPretina =
    config.esDosPiezas && opciones.materialSecundario
      ? opciones.materialSecundario
      : (opciones.materialForroOVista ?? opciones.materialPrincipal);
  const mesh = new THREE.Mesh(geo, matPretina);
  mesh.name = "pretina-cintura";
  registrarMalla(mesh, undefined, zonaPieza);
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
  const piernaRef = perfil.trayectorias.piernaDer;
  const tiroFotoM =
    perfil.alturaTiroM *
    clamp(config.proporcionesFoto?.crotchDepthMultiplier ?? 1, 0.82, 1.28);
  const tiroYM = clamp(
    perfil.cinturaYM - tiroFotoM,
    perfil.musloYM + 0.012,
    perfil.caderaYM - cmAMetros(2)
  );

  // Partimos de la trayectoria y radios reales de la pierna del maniquí opaco
  const rMusloBase = Math.max(piernaRef.radioMusloM, cmAMetros(28) / (2 * Math.PI));
  const rRodillaBase = piernaRef.radioRodillaM;
  const rTobilloBase = piernaRef.radioTobilloM;

  const yPisoSeguroM = Math.max(0.028, perfil.alturaTobilloM * 0.38);
  const largoPiernaM = clamp(
    cmAMetros(config.largoDeseado),
    0.14,
    Math.max(0.18, tiroYM - yPisoSeguroM)
  );
  const yBotaM = Math.max(yPisoSeguroM, tiroYM - largoPiernaM);

  const rMusloPrenda =
    config.pantalon === "legging"
      ? rMusloBase + 0.0045
      : config.pantalon === "palazzo"
        ? Math.max(rMusloBase * 1.28, rMusloBase + 0.022)
        : Math.max(rMusloBase * 1.12, rMusloBase + 0.012);

  const rRodillaPrenda =
    config.pantalon === "legging"
      ? Math.max(rRodillaBase + 0.0045, rMusloBase * 0.72)
      : config.pantalon === "palazzo"
        ? Math.max(rMusloPrenda * 1.06, rRodillaBase + 0.045)
        : Math.max(rRodillaBase + 0.014, rMusloBase * 0.84, cmAMetros(20) / (2 * Math.PI));

  const rBotaPrenda =
    config.pantalon === "legging"
      ? Math.max(rTobilloBase + 0.0045, rMusloBase * 0.48)
      : config.pantalon === "palazzo"
        ? Math.max(rRodillaPrenda * 1.1, perfil.anchoBotaM / Math.PI, rTobilloBase + 0.068)
        : clamp(
          perfil.anchoBotaM / Math.PI,
          Math.max(rTobilloBase + 0.014, rMusloBase * 0.68),
          Math.max(rTobilloBase + 0.036, rMusloBase * 1.18)
        );

  return {
    tiroYM,
    xMuslo: Math.abs(piernaRef.musloAlto[0]),
    zMuslo: piernaRef.musloAlto[2],
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
  const pierna = lado < 0 ? perfil.trayectorias.piernaIzq : perfil.trayectorias.piernaDer;
  const y = THREE.MathUtils.lerp(info.tiroYM + 0.025, info.yBotaM, tr);

  const tLinCaderaRod = clamp(
    (pierna.cadera[1] - y) / Math.max(0.05, pierna.cadera[1] - pierna.rodilla[1]),
    0,
    1
  );
  const tLinRodTob = clamp(
    (pierna.rodilla[1] - y) / Math.max(0.05, pierna.rodilla[1] - pierna.tobillo[1]),
    0,
    1
  );
  const tRod = smoothstep(pierna.musloAlto[1], pierna.rodilla[1], y);

  let cx: number;
  let cz: number;
  let rCuerpoY: number;

  if (y >= pierna.rodilla[1]) {
    cx = THREE.MathUtils.lerp(pierna.cadera[0], pierna.rodilla[0], tLinCaderaRod);
    cz = THREE.MathUtils.lerp(pierna.cadera[2], pierna.rodilla[2], tLinCaderaRod);
    rCuerpoY = THREE.MathUtils.lerp(pierna.radioMusloM, pierna.radioRodillaM, tLinCaderaRod);
  } else {
    cx = THREE.MathUtils.lerp(pierna.rodilla[0], pierna.tobillo[0], tLinRodTob);
    const factorGemelo = Math.sin(clamp(tLinRodTob * 1.45, 0, Math.PI));
    cz =
      THREE.MathUtils.lerp(pierna.rodilla[2], pierna.tobillo[2], tLinRodTob) +
      (pierna.desplazamientoPantorrillaZM ?? 0) * factorGemelo;
    // Volumen de pantorrilla coherente con la malla del maniquí
    const curvaGemelo = factorGemelo * 0.08 * pierna.radioRodillaM;
    rCuerpoY =
      THREE.MathUtils.lerp(pierna.radioRodillaM, pierna.radioTobilloM, tLinRodTob) + curvaGemelo;
  }

  let radio: number;
  if (y >= pierna.rodilla[1]) {
    radio = THREE.MathUtils.lerp(info.rMusloPrenda, info.rRodillaPrenda, tRod);
  } else {
    const fBot = clamp(
      (pierna.rodilla[1] - y) / Math.max(0.05, pierna.rodilla[1] - info.yBotaM),
      0,
      1
    );
    radio = THREE.MathUtils.lerp(info.rRodillaPrenda, info.rBotaPrenda, fBot);
  }

  const holguraMin = configHolguraPierna(info, rCuerpoY);
  return { cx, y, cz, radio: Math.max(radio, holguraMin) };
}

function configHolguraPierna(info: InfoPiernasPantalon, rCuerpoY: number): number {
  const esHolgado = info.rBotaPrenda > info.rMusloPrenda * 0.9;
  return rCuerpoY + (esHolgado ? 0.011 : 0.004);
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
  const segsYugo = opciones.nivelDetalle === "movil" ? 40 : 58;
  const rowsYugo = 14;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;
  const tela: TipoTela = opciones.tipoTela ?? (ajusteStretch < 0 ? "licra" : "crepe");
  const matPant =
    config.esDosPiezas && opciones.materialSecundario
      ? opciones.materialSecundario
      : opciones.materialPrincipal;

  if (config.prenda === "pantalon" || config.esDosPiezas) {
    meshes.push(
      construirPretina(perfil, config, perfil.cinturaYM, opciones, "pantalon_inferior")
    );
  }

  const infoPiernas = calcularInfoPiernasPantalon(perfil, config);
  const { tiroYM } = infoPiernas;

  // 1. Yugo pelvis/tiro (cintura -> tiro) con contorno anatómico glúteo + bragueta + pliegues cadera
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
        ? 0.0045
        : calcularDeltaRadioM(config, y, perfil, ajusteStretch)) + extraPalazzo;

    const piernaHip = perfil.trayectorias.piernaDer;
    const minYugoA =
      y <= piernaHip.cadera[1] + 0.02
        ? Math.abs(piernaHip.cadera[0]) + piernaHip.radioCaderaM + 0.005
        : 0;
    const a = Math.max(anillo.a + dr, minYugoA);
    const b = anillo.b + dr;
    const circ = Math.PI * (a + b);

    for (let s = 0; s <= segsYugo; s++) {
      const theta = ((s / segsYugo) - 0.5) * Math.PI * 2;
      const p = proyectarFueraDelTorso(
        a * Math.sin(theta),
        y,
        anillo.desplazamientoZ + b * Math.cos(theta),
        perfil,
        0.004
      );
      pos.push(p.x, y, p.z);
      uvs.push((theta / (Math.PI * 2)) * circ, y);
    }
  }

  applyTrouserClothDrape({
    positions: pos,
    rows: rowsYugo,
    cols: segsYugo + 1,
    isYugo: true,
    config,
    tela,
    projectSafe: (x, y, z) => proyectarFueraDelTorso(x, y, z, perfil, 0.0028),
  });

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
  bakeClothCreviceAO(yugoGeo, CLOTH_DRAPE_PARAMS[tela].aoIntensity);
  const yugoMesh = new THREE.Mesh(yugoGeo, matPant);
  yugoMesh.name = "pantalon-yugo";
  registrarMalla(yugoMesh, undefined, "pantalon_inferior");
  meshes.push(yugoMesh);

  // 2. Bifurcación en pierna izquierda y derecha con quiebre de plancha, pliegues tras rodilla y caída XPBD
  const ringsLeg = opciones.nivelDetalle === "movil" ? 18 : 28;
  const segsLeg = opciones.nivelDetalle === "movil" ? 22 : 32;
  const holguraMinSeg = config.pantalon === "legging" ? 0.005 : 0.011;

  for (const lado of [-1, 1] as const) {
    const pierna = lado < 0 ? perfil.trayectorias.piernaIzq : perfil.trayectorias.piernaDer;
    const lPos: number[] = [];
    const lUvs: number[] = [];
    const lIdx: number[] = [];
    const lPesos = new Float32Array(ringsLeg * (segsLeg + 1));
    const cxCurve: number[] = [];
    const czCurve: number[] = [];

    for (let r = 0; r < ringsLeg; r++) {
      const tr = r / (ringsLeg - 1);
      const { cx, y, cz, radio } = evaluarCentroYRadioPierna(infoPiernas, perfil, lado, tr);
      cxCurve.push(cx);
      czCurve.push(cz);

      const circ = Math.PI * 2 * radio;
      for (let s = 0; s <= segsLeg; s++) {
        const theta = ((s / segsLeg) - 0.5) * Math.PI * 2;
        let pxRaw = cx + radio * Math.sin(theta);
        let pzRaw = cz + radio * Math.cos(theta);

        const distAlCentroX = lado * pxRaw;
        if (distAlCentroX < 0.004) {
          const excesoInterno = 0.004 - distAlCentroX;
          pxRaw = lado * 0.004;
          const signoZ = pzRaw >= cz ? 1 : -1;
          pzRaw += signoZ * excesoInterno * 0.45;
        }

        const trasMuslo = proyectarFueraDeSegmento(
          pxRaw,
          y,
          pzRaw,
          pierna.cadera,
          pierna.rodilla,
          pierna.radioMusloM,
          pierna.radioRodillaM,
          holguraMinSeg
        );
        const trasPant = proyectarFueraDeSegmento(
          trasMuslo.x,
          trasMuslo.y,
          trasMuslo.z,
          pierna.rodilla,
          pierna.tobillo,
          pierna.radioRodillaM,
          pierna.radioTobilloM,
          holguraMinSeg
        );
        lPos.push(trasPant.x, trasPant.y, trasPant.z);
        lUvs.push((theta / (Math.PI * 2)) * circ, y);
        lPesos[r * (segsLeg + 1) + s] =
          config.pantalon === "palazzo" ? Math.pow(tr, 1.5) * 0.85 : config.pantalon === "recto" ? tr * 0.25 : 0;
      }
    }

    applyTrouserClothDrape({
      positions: lPos,
      rows: ringsLeg,
      cols: segsLeg + 1,
      isYugo: false,
      lado,
      cxCurve,
      czCurve,
      config,
      tela,
      projectSafe: (x, y, z) => {
        const m1 = proyectarFueraDeSegmento(
          x,
          y,
          z,
          pierna.cadera,
          pierna.rodilla,
          pierna.radioMusloM,
          pierna.radioRodillaM,
          holguraMinSeg
        );
        return proyectarFueraDeSegmento(
          m1.x,
          m1.y,
          m1.z,
          pierna.rodilla,
          pierna.tobillo,
          pierna.radioRodillaM,
          pierna.radioTobilloM,
          holguraMinSeg
        );
      },
    });

    const puntosBota: THREE.Vector3[] = [];
    const botRowOff = (ringsLeg - 1) * (segsLeg + 1);
    for (let s = 0; s < segsLeg; s++) {
      const i3 = (botRowOff + s) * 3;
      puntosBota.push(new THREE.Vector3(lPos[i3], lPos[i3 + 1], lPos[i3 + 2]));
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
    bakeClothCreviceAO(lGeo, CLOTH_DRAPE_PARAMS[tela].aoIntensity);

    const lMesh = new THREE.Mesh(lGeo, matPant);
    lMesh.name = `pantalon-pierna-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(lMesh, lPesos, "pantalon_inferior");
    meshes.push(lMesh);

    if (puntosBota.length >= 6) {
      meshes.push(
        construirDobladilloDesdeAnillo(
          puntosBota,
          matPant,
          `dobladillo-bota-${lado > 0 ? "izq" : "der"}`,
          "pantalon_inferior",
          0.002,
          0.007
        )
      );
    }
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
      const p = proyectarFueraDelTorso(
        aBelt * Math.sin(theta),
        y,
        cintura.desplazamientoZ + bBelt * Math.cos(theta),
        perfil,
        0.006
      );
      pos.push(p.x, y, p.z);
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
  registrarMalla(beltMesh, undefined, "cinturon");
  objetos.push(beltMesh);

  // Ancla frontal del lazo 3D
  const rEnvFrenteCint = evaluarRadioEnvolventeCuerpoM(perfil, cintura.y, 0);
  const bFrenteBelt = Math.max(bBelt, rEnvFrenteCint > 0.01 ? rEnvFrenteCint + 0.006 : 0);
  const zFrente = cintura.desplazamientoZ + bFrenteBelt + 0.008;
  const yCint = cintura.y;

  // Nudo central
  const nudoGeo = new THREE.SphereGeometry(0.017, 16, 12);
  nudoGeo.scale(1.15, 1.0, 0.72);
  const nudoMesh = new THREE.Mesh(nudoGeo, mat);
  nudoMesh.position.set(0, yCint, zFrente);
  nudoMesh.name = "cinturon-nudo";
  registrarMalla(nudoMesh, undefined, "cinturon");
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
    registrarMalla(loopMesh, undefined, "cinturon");
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
    registrarMalla(colaMesh, undefined, "cinturon");
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
 * montado directamente sobre la cabeza ovoide del maniquí articulado.
 */
function construirBucketHat(
  perfil: PerfilCuerpo,
  opciones: OpcionesMallaPrenda
): { objetos: THREE.Object3D[]; etiquetaFrente: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const { centroCabeza, radioCabezaX, radioCabezaY, radioCabezaZ } = perfil.trayectorias;
  const rBaseX = radioCabezaX * 1.045;
  const factorElipseZ = clamp(radioCabezaZ / Math.max(0.04, radioCabezaX), 0.96, 1.25);

  const centroCabezaY = centroCabeza[1];
  const centroCabezaZ = centroCabeza[2];

  // Sombrero con corona plana y ala inclinada (~6 cm) en LatheGeometry ovalada al cráneo
  const rCopaTop = rBaseX * 0.91;
  const rAla = rBaseX + cmAMetros(6.0);

  const perfilHat = [
    new THREE.Vector2(0, cmAMetros(8.6)),
    new THREE.Vector2(rCopaTop, cmAMetros(8.4)),
    new THREE.Vector2(rCopaTop * 1.02, cmAMetros(8.0)),
    new THREE.Vector2(rBaseX, cmAMetros(1.0)),
    new THREE.Vector2(rBaseX + cmAMetros(0.4), cmAMetros(0.6)),
    new THREE.Vector2(rAla, -cmAMetros(3.4)),
  ];

  const hatGeo = new THREE.LatheGeometry(perfilHat, 44);
  hatGeo.scale(1, 1, factorElipseZ);

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
  hatMesh.position.set(
    centroCabeza[0],
    centroCabezaY + radioCabezaY * 0.24,
    centroCabezaZ - cmAMetros(0.3)
  );
  hatMesh.rotation.x = -0.04;
  hatMesh.name = "bucket-hat-3d";
  registrarMalla(hatMesh, undefined, "sombrero");
  objetos.push(hatMesh);

  return {
    objetos,
    etiquetaFrente: {
      id: "lbl-delantero",
      texto: "Delantero",
      posicionLocalM: [
        centroCabeza[0],
        centroCabezaY + radioCabezaY * 0.5,
        centroCabezaZ + radioCabezaZ + 0.025,
      ],
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
  const { centroCabeza, radioCabezaX, radioCabezaY, radioCabezaZ } = perfil.trayectorias;
  const rBaseX = radioCabezaX * 1.045;
  const factorElipseZ = clamp(radioCabezaZ / Math.max(0.04, radioCabezaX), 0.96, 1.25);

  const centroCabezaZ = centroCabeza[2] - cmAMetros(0.3);
  const hatYBase = centroCabeza[1] + radioCabezaY * 0.24;

  const rCopaTop = rBaseX * 0.91;
  const rBaseCopa = rBaseX;
  const segs = 44;

  const anillosHat = [
    { nombre: "costura-copa-sombrero", radio: rCopaTop * 1.02 + OFFSET_COSTURA_M, y: hatYBase + cmAMetros(8.0) + 0.002 },
    { nombre: "costura-ala-sombrero", radio: rBaseCopa + cmAMetros(0.4) + OFFSET_COSTURA_M, y: hatYBase + cmAMetros(0.8) + 0.002 },
  ];

  for (const anillo of anillosHat) {
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          centroCabeza[0] + anillo.radio * Math.sin(th),
          anillo.y,
          centroCabezaZ + anillo.radio * factorElipseZ * Math.cos(th)
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
      const y = THREE.MathUtils.lerp(cmAMetros(8.0), cmAMetros(1.0), t) + hatYBase;
      pts.push(new THREE.Vector3(centroCabeza[0] + lado * r, y, centroCabezaZ));
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

  // 1. Costuras de hombro (hombro -> cuello; omitidas en raglán; en kimono continúa por la cresta de la manga)
  if (config.manga !== "raglan") {
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
  } else {
    // Costuras diagonales raglán (escote delantero/espalda -> axila)
    for (const lado of [-1, 1] as const) {
      for (const esFront of [true, false]) {
        const ptsRaglan: THREE.Vector3[] = [];
        const thetaStart = lado * (esFront ? 0.36 : Math.PI - 0.34);
        const thetaEnd = lado * Math.PI * 0.5;
        const yStart = calcularAlturaTopEscoteYSisa(config, thetaStart, perfil);
        const yEnd = perfil.bustoYM - cmAMetros(5.2);
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const theta = THREE.MathUtils.lerp(thetaStart, thetaEnd, t);
          const curveSag = Math.sin(t * Math.PI) * cmAMetros(1.2);
          const y = THREE.MathUtils.lerp(yStart, yEnd, t) - curveSag;
          ptsRaglan.push(
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
            ptsRaglan,
            mat,
            `costura-raglan-${esFront ? "del" : "tra"}-${lado > 0 ? "izq" : "der"}`
          )
        );
      }
    }
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

  // 3. Costura de sisa (OMITIDA explícitamente cuando manga === 'kimono' o 'raglan')
  if (config.manga !== "kimono" && config.manga !== "raglan") {
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

  // 3b. Canesú trasero horizontal (when active)
  if (config.canesuEspalda && !config.cortePrincesa && config.manga !== "kimono" && config.manga !== "raglan") {
    const ptsCanesu: THREE.Vector3[] = [];
    const yCanesu = perfil.hombroYM - cmAMetros(10.0);
    for (let i = 0; i <= 16; i++) {
      const th = THREE.MathUtils.lerp(Math.PI * 0.62, Math.PI * 1.38, i / 16);
      ptsCanesu.push(
        evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yCanesu,
          th,
          ajusteStretchM,
          OFFSET_COSTURA_M + 0.001
        )
      );
    }
    grupoCosturas.add(crearLineaPespunte(ptsCanesu, mat, "costura-canesu-espalda"));
  }

  // 4. Corte Princesa o Pinza de busto (costado -> ápice) en cuerpo adulto femenino
  if (config.cortePrincesa && config.manga !== "kimono" && config.manga !== "raglan") {
    for (const lado of [-1, 1] as const) {
      for (const esFront of [true, false]) {
        const ptsPrincesa: THREE.Vector3[] = [];
        const thSisa = lado * (esFront ? 1.24 : Math.PI - 1.18);
        const thApex = lado * (esFront ? 0.42 : Math.PI - 0.4);
        const ySisaMid = (perfil.hombroYM + perfil.bustoYM) * 0.5 - cmAMetros(2.0);
        const yApex = perfil.bustoYM - cmAMetros(0.4);
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const y = THREE.MathUtils.lerp(ySisaMid, yInferiorTopM, t);
          const th =
            y >= yApex
              ? THREE.MathUtils.lerp(thSisa, thApex, (ySisaMid - y) / Math.max(0.01, ySisaMid - yApex))
              : thApex;
          ptsPrincesa.push(
            evaluarPuntoTorsoConOffset(
              perfil,
              config,
              y,
              th,
              ajusteStretchM,
              OFFSET_COSTURA_M + 0.001
            )
          );
        }
        grupoCosturas.add(
          crearLineaPespunte(
            ptsPrincesa,
            mat,
            `costura-princesa-${esFront ? "del" : "tra"}-${lado > 0 ? "izq" : "der"}`
          )
        );
      }
    }
  } else if (!config.esInfantil) {
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
    yInicioFaldaM,
    perfil
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
      const xIntBase = lado * Math.max(0.004, Math.abs(cx) - (radio + ondaInt));
      ptsInt.push(new THREE.Vector3(xIntBase - lado * OFFSET_COSTURA_M * 0.5, y, cz));
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
 * Construye bolsillos con tapa en relieve frontales y/o ribetes de bolsillo lateral en costura.
 */
function construirBolsillos3D(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  yInferiorTopM: number,
  opciones: OpcionesMallaPrenda,
  grupoCosturas: THREE.Group,
  matCostura: THREE.LineDashedMaterial
): { objetos: THREE.Object3D[]; etiquetaBolsillo?: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  if (!config.bolsillosConTapa && !config.bolsillosLaterales) {
    return { objetos };
  }

  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;
  const matBolsillo =
    config.esDosPiezas &&
    opciones.materialSecundario &&
    config.prenda !== "chaqueta"
      ? opciones.materialSecundario
      : (opciones.materialForroOVista ?? opciones.materialPrincipal);
  let etiquetaBolsillo: Etiqueta3DAncla | undefined;

  if (config.bolsillosConTapa) {
    const esTopChaqueta =
      config.prenda === "chaqueta" ||
      config.prenda === "blusa" ||
      config.dosPiezasArriba === "jacket_blazer";
    const yCentroBolsillo = esTopChaqueta
      ? clamp(yInferiorTopM + cmAMetros(9.0), perfil.caderaYM + cmAMetros(3), perfil.cinturaYM - cmAMetros(2))
      : clamp(perfil.cinturaYM - cmAMetros(9.5), perfil.caderaYM + cmAMetros(2), perfil.cinturaYM - cmAMetros(4));

    const btnGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.0032, 12);
    btnGeo.rotateX(Math.PI * 0.5);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0x3b322d,
      roughness: 0.35,
      metalness: 0.3,
    });
    const instBtnBolsillo = new THREE.InstancedMesh(btnGeo, btnMat, 2);
    instBtnBolsillo.name = "bolsillos-botones";
    instBtnBolsillo.castShadow = true;
    instBtnBolsillo.userData.esHerraje = true;
    instBtnBolsillo.userData.zonaPieza = "bolsillo";
    const dummy = new THREE.Object3D();

    [-1, 1].forEach((lado, idxBtn) => {
      const thCentro = lado * 0.44;
      const thMin = thCentro - 0.16;
      const thMax = thCentro + 0.16;
      const yTop = yCentroBolsillo + cmAMetros(5.2);
      const yBot = yCentroBolsillo - cmAMetros(5.2);

      // Parche inferior
      const pos: number[] = [];
      const uvs: number[] = [];
      const idx: number[] = [];
      const rows = 5;
      const cols = 6;
      for (let r = 0; r < rows; r++) {
        const y = THREE.MathUtils.lerp(yTop, yBot, r / (rows - 1));
        const an = evaluarPerfilEnY(perfil.anillosInterpolados, y);
        const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.007;
        for (let c = 0; c < cols; c++) {
          const th = THREE.MathUtils.lerp(thMin, thMax, c / (cols - 1));
          const p = proyectarFueraDelTorso(
            (an.a + dr) * Math.sin(th),
            y,
            an.desplazamientoZ + (an.b + dr) * Math.cos(th),
            perfil,
            0.007
          );
          pos.push(p.x, y, p.z);
          uvs.push(p.x, y);
        }
      }
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = r * cols + c;
          const b = (r + 1) * cols + c;
          const cN = r * cols + (c + 1);
          const d = (r + 1) * cols + (c + 1);
          idx.push(a, b, cN, cN, b, d);
        }
      }
      const patchGeo = new THREE.BufferGeometry();
      patchGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      patchGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      patchGeo.setIndex(idx);
      finalizarGeometria(patchGeo);
      const patchMesh = new THREE.Mesh(patchGeo, matBolsillo);
      patchMesh.name = `bolsillo-parche-${lado > 0 ? "izq" : "der"}`;
      registrarMalla(patchMesh, undefined, "bolsillo");
      objetos.push(patchMesh);

      // Tapa superior en relieve
      const muestrasTapa: MuestraTiraTorso[] = [];
      for (let i = 0; i <= 5; i++) {
        const th = THREE.MathUtils.lerp(thMin - 0.02, thMax + 0.02, i / 5);
        const anT = evaluarPerfilEnY(perfil.anillosInterpolados, yTop);
        const drT = calcularDeltaRadioM(config, yTop, perfil, ajusteStretch) + 0.0095;
        muestrasTapa.push({
          pos: new THREE.Vector3(
            (anT.a + drT) * Math.sin(th),
            yTop - cmAMetros(1.1),
            anT.desplazamientoZ + (anT.b + drT) * Math.cos(th)
          ),
          normalOut: calcularNormalTorso(anT, th),
        });
      }
      objetos.push(
        construirTiraConRelieveSobreTorso(
          muestrasTapa,
          cmAMetros(3.4),
          0.0038,
          false,
          perfil,
          0.0085,
          matBolsillo,
          `bolsillo-tapa-${lado > 0 ? "izq" : "der"}`,
          0.5,
          "bolsillo"
        )
      );

      // Botón centrado en la tapa
      const pBtnBol = evaluarPuntoTorsoConOffset(
        perfil,
        config,
        yTop - cmAMetros(1.4),
        thCentro,
        ajusteStretch,
        0.0135
      );
      dummy.position.set(pBtnBol.x, pBtnBol.y, pBtnBol.z);
      dummy.rotation.set(0, thCentro, 0);
      dummy.updateMatrix();
      instBtnBolsillo.setMatrixAt(idxBtn, dummy.matrix);

      // Pespunte perimetral en U del parche
      const ptsPespunte: THREE.Vector3[] = [
        evaluarPuntoTorsoConOffset(perfil, config, yTop, thMin, ajusteStretch, 0.009),
        evaluarPuntoTorsoConOffset(perfil, config, yBot, thMin, ajusteStretch, 0.009),
        evaluarPuntoTorsoConOffset(perfil, config, yBot, thCentro, ajusteStretch, 0.009),
        evaluarPuntoTorsoConOffset(perfil, config, yBot, thMax, ajusteStretch, 0.009),
        evaluarPuntoTorsoConOffset(perfil, config, yTop, thMax, ajusteStretch, 0.009),
      ];
      grupoCosturas.add(
        crearLineaPespunte(ptsPespunte, matCostura, `costura-bolsillo-tapa-${lado > 0 ? "izq" : "der"}`)
      );

      if (lado === 1) {
        const pAnc = evaluarPuntoTorsoConOffset(
          perfil,
          config,
          yCentroBolsillo,
          thCentro,
          ajusteStretch,
          0.022
        );
        etiquetaBolsillo = {
          id: "lbl-bolsillo",
          texto: "Bolsillo",
          posicionLocalM: [pAnc.x, pAnc.y, pAnc.z],
          normalLocal: [0.35, 0, 0.94],
        };
      }
    });

    instBtnBolsillo.instanceMatrix.needsUpdate = true;
    objetos.push(instBtnBolsillo);
  }

  if (
    config.bolsillosLaterales &&
    (config.prenda === "falda" ||
      config.prenda === "vestido" ||
      config.prenda === "pantalon" ||
      config.prenda === "enterizo" ||
      config.esDosPiezas)
  ) {
    const yBolTop = perfil.cinturaYM - cmAMetros(3.5);
    const yBolBot = Math.max(perfil.caderaYM + cmAMetros(1.0), yBolTop - cmAMetros(14.5));

    for (const lado of [-1, 1] as const) {
      const muestrasVivo: MuestraTiraTorso[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const y = THREE.MathUtils.lerp(yBolTop, yBolBot, t);
        const th = lado * THREE.MathUtils.lerp(1.16, 1.38, t);
        const an = evaluarPerfilEnY(perfil.anillosInterpolados, y);
        const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.0045;
        muestrasVivo.push({
          pos: new THREE.Vector3(
            (an.a + dr) * Math.sin(th),
            y,
            an.desplazamientoZ + (an.b + dr) * Math.cos(th)
          ),
          normalOut: calcularNormalTorso(an, th),
        });
      }
      objetos.push(
        construirTiraConRelieveSobreTorso(
          muestrasVivo,
          cmAMetros(1.3),
          0.0024,
          false,
          perfil,
          0.004,
          matBolsillo,
          `bolsillo-lateral-vivo-${lado > 0 ? "izq" : "der"}`,
          0.5,
          "bolsillo"
        )
      );

      grupoCosturas.add(
        crearLineaPespunte(
          muestrasVivo.map((m) => m.pos.clone().addScaledVector(m.normalOut, 0.003)),
          matCostura,
          `costura-bolsillo-lat-${lado > 0 ? "izq" : "der"}`
        )
      );

      if (!etiquetaBolsillo && lado === 1) {
        const pLat = muestrasVivo[3].pos.clone().addScaledVector(muestrasVivo[3].normalOut, 0.02);
        etiquetaBolsillo = {
          id: "lbl-bolsillo",
          texto: "Bolsillo",
          posicionLocalM: [pLat.x, pLat.y, pLat.z],
          normalLocal: [0.85, 0, 0.52],
        };
      }
    }
  }

  return { objetos, etiquetaBolsillo };
}

/**
 * Construye pechera delantera, respaldo y tirantes continuos sobre hombros para Jardinera (`overall`).
 */
function construirPecheraYTirantesOverall(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): { objetos: THREE.Object3D[]; etiquetaFrente: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const mat = opciones.materialPrincipal;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  const yTopBibFrente = perfil.bustoYM + cmAMetros(5.0);
  const yTopBibEspalda = perfil.bustoYM + cmAMetros(3.5);
  const yBase = perfil.cinturaYM - cmAMetros(1.2);

  for (const ladoSpec of [
    { nombre: "overall-pechera-frente", yTop: yTopBibFrente, thCentro: 0, semiTh: 0.44 },
    { nombre: "overall-pechera-espalda", yTop: yTopBibEspalda, thCentro: Math.PI, semiTh: 0.42 },
  ]) {
    const rows = 8;
    const cols = 10;
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let r = 0; r < rows; r++) {
      const tr = r / (rows - 1);
      const y = THREE.MathUtils.lerp(ladoSpec.yTop, yBase, tr);
      const an = evaluarPerfilEnY(perfil.anillosInterpolados, y);
      const spanTh = THREE.MathUtils.lerp(ladoSpec.semiTh * 0.72, ladoSpec.semiTh, tr);
      const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.0025;
      for (let c = 0; c < cols; c++) {
        const tc = c / (cols - 1);
        const th = ladoSpec.thCentro + THREE.MathUtils.lerp(-spanTh, spanTh, tc);
        const p = proyectarFueraDelTorso(
          (an.a + dr) * Math.sin(th),
          y,
          an.desplazamientoZ + (an.b + dr) * Math.cos(th),
          perfil,
          0.0045
        );
        pos.push(p.x, y, p.z);
        uvs.push(p.x, y);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = (r + 1) * cols + c;
        const cN = r * cols + (c + 1);
        const d = (r + 1) * cols + (c + 1);
        idx.push(a, b, cN, cN, b, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    finalizarGeometria(geo);
    const m = new THREE.Mesh(geo, mat);
    m.name = ladoSpec.nombre;
    registrarMalla(m, undefined, "delantero");
    objetos.push(m);
  }

  // Tirantes continuos sobre hombros + 2 botones metálicos de peto
  const btnGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 14);
  btnGeo.rotateX(Math.PI * 0.5);
  const btnMat = new THREE.MeshStandardMaterial({
    color: 0xc2934b,
    roughness: 0.28,
    metalness: 0.78,
  });
  const instBtnPeto = new THREE.InstancedMesh(btnGeo, btnMat, 2);
  instBtnPeto.name = "overall-botones-peto";
  instBtnPeto.castShadow = true;
  instBtnPeto.userData.esHerraje = true;
  instBtnPeto.userData.zonaPieza = "delantero";
  const dummy = new THREE.Object3D();

  [-1, 1].forEach((lado, idxBtn) => {
    const samples: MuestraTiraTorso[] = [];
    const pasos = 14;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      let y: number;
      let th: number;
      if (t <= 0.5) {
        const tf = t / 0.5;
        y = THREE.MathUtils.lerp(yTopBibFrente - cmAMetros(1.0), perfil.hombroYM + cmAMetros(0.8), tf);
        th = lado * THREE.MathUtils.lerp(0.28, 0.56, tf);
      } else {
        const tb = (t - 0.5) / 0.5;
        y = THREE.MathUtils.lerp(perfil.hombroYM + cmAMetros(0.8), yTopBibEspalda - cmAMetros(1.0), tb);
        th = lado * THREE.MathUtils.lerp(0.56, Math.PI - 0.28, tb);
      }
      const an = evaluarPerfilEnY(perfil.anillosInterpolados, clamp(y, perfil.musloYM, perfil.cuelloYM));
      const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.004;
      const nOut = calcularNormalTorso(an, th);
      if (Math.abs(t - 0.5) < 0.18) {
        nOut.y += 0.65;
        nOut.normalize();
      }
      samples.push({
        pos: new THREE.Vector3(
          (an.a + dr) * Math.sin(th),
          y,
          an.desplazamientoZ + (an.b + dr) * Math.cos(th)
        ),
        normalOut: nOut,
      });
    }
    objetos.push(
      construirTiraConRelieveSobreTorso(
        samples,
        cmAMetros(3.4),
        0.0032,
        false,
        perfil,
        0.0035,
        mat,
        `overall-tirante-${lado > 0 ? "izq" : "der"}`,
        0.5,
        "delantero"
      )
    );

    const pBtn = samples[0].pos.clone().addScaledVector(samples[0].normalOut, 0.005);
    dummy.position.copy(pBtn);
    dummy.rotation.set(0, lado * 0.28, 0);
    dummy.updateMatrix();
    instBtnPeto.setMatrixAt(idxBtn, dummy.matrix);
  });

  instBtnPeto.instanceMatrix.needsUpdate = true;
  objetos.push(instBtnPeto);

  const busto = perfil.anillosClave.busto;
  return {
    objetos,
    etiquetaFrente: {
      id: "lbl-delantero",
      texto: "Delantero",
      posicionLocalM: [0, busto.y, busto.desplazamientoZ + busto.b + cmAMetros(2)],
      normalLocal: [0, 0, 1],
    },
  };
}

/**
 * Construye delantal de taller (`apron`) con pechera delantera, falda envolvente frontal,
 * cinta de cuello, tiras de cintura y bolsillo central dividido.
 */
function construirDelantal3D(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  opciones: OpcionesMallaPrenda,
  grupoCosturas: THREE.Group,
  matCostura: THREE.LineDashedMaterial
): { objetos: THREE.Object3D[]; etiquetaFrente: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const mat = opciones.materialPrincipal;
  const matVista = opciones.materialForroOVista ?? mat;
  const ajusteStretch = opciones.ajusteTelaStretchM ?? 0;

  const yTopBib = perfil.hombroYM - cmAMetros(4.5);
  const yCint = perfil.cinturaYM;
  const yBotApron = clamp(
    yCint - cmAMetros(46),
    Math.max(0.14, perfil.alturaRodillaM - cmAMetros(4)),
    perfil.caderaYM - cmAMetros(8)
  );

  // Cuerpo delantero continuo del delantal (pechera estrecha arriba -> envolvente lateral abajo)
  const rows = 20;
  const segs = 24;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const pesos = new Float32Array(rows * (segs + 1));

  for (let r = 0; r < rows; r++) {
    const tr = r / (rows - 1);
    const y = THREE.MathUtils.lerp(yTopBib, yBotApron, tr);
    const an = evaluarPerfilEnY(
      perfil.anillosInterpolados,
      Math.max(y, perfil.caderaYM)
    );
    const fracSisa = smoothstep(yTopBib, yCint, y);
    const maxTheta = THREE.MathUtils.lerp(0.46, 1.48, fracSisa);
    const extraFalda = y < yCint ? smoothstep(yCint, yBotApron, y) * cmAMetros(5.5) : 0;
    const dr = calcularDeltaRadioM(config, Math.max(y, yCint), perfil, ajusteStretch) + 0.004 + extraFalda;

    for (let s = 0; s <= segs; s++) {
      const th = THREE.MathUtils.lerp(-maxTheta, maxTheta, s / segs);
      const p = proyectarFueraDelTorso(
        (an.a + dr) * Math.sin(th),
        y,
        an.desplazamientoZ + (an.b + dr) * Math.cos(th),
        perfil,
        0.0055
      );
      pos.push(p.x, y, p.z);
      uvs.push(p.x, y);
      pesos[r * (segs + 1) + s] = y < yCint ? Math.pow((yCint - y) / Math.max(0.1, yCint - yBotApron), 1.3) * 0.6 : 0;
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
  const apronGeo = new THREE.BufferGeometry();
  apronGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  apronGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  apronGeo.setIndex(idx);
  finalizarGeometria(apronGeo);
  const apronMesh = new THREE.Mesh(apronGeo, mat);
  apronMesh.name = "delantal-cuerpo";
  registrarMalla(apronMesh, pesos, "delantero");
  objetos.push(apronMesh);

  // Cinta de cuello alrededor de la nuca
  const muestrasCuello: MuestraTiraTorso[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const th = THREE.MathUtils.lerp(0.38, Math.PI * 2 - 0.38, t);
    const esAtras = Math.abs(Math.sin(t * Math.PI));
    const y = THREE.MathUtils.lerp(yTopBib, perfil.cuelloYM - cmAMetros(0.4), esAtras);
    const an = evaluarPerfilEnY(perfil.anillosInterpolados, y);
    const dr = calcularDeltaRadioM(config, y, perfil, ajusteStretch) + 0.006;
    muestrasCuello.push({
      pos: new THREE.Vector3(
        (an.a + dr) * Math.sin(th),
        y,
        an.desplazamientoZ + (an.b + dr) * Math.cos(th)
      ),
      normalOut: calcularNormalTorso(an, th),
    });
  }
  objetos.push(
    construirTiraConRelieveSobreTorso(
      muestrasCuello,
      cmAMetros(2.2),
      0.0028,
      false,
      perfil,
      0.004,
      matVista,
      "delantal-tira-cuello",
      0.5,
      "cuello_vista"
    )
  );

  // Cinta de cintura alrededor completo
  const muestrasCint: MuestraTiraTorso[] = [];
  for (let i = 0; i < 32; i++) {
    const th = ((i / 32) - 0.5) * Math.PI * 2;
    const an = evaluarPerfilEnY(perfil.anillosInterpolados, yCint);
    const dr = calcularDeltaRadioM(config, yCint, perfil, ajusteStretch) + 0.006;
    muestrasCint.push({
      pos: new THREE.Vector3(
        (an.a + dr) * Math.sin(th),
        yCint,
        an.desplazamientoZ + (an.b + dr) * Math.cos(th)
      ),
      normalOut: calcularNormalTorso(an, th),
    });
  }
  objetos.push(
    construirTiraConRelieveSobreTorso(
      muestrasCint,
      cmAMetros(2.6),
      0.0028,
      true,
      perfil,
      0.005,
      matVista,
      "delantal-tira-cintura",
      0.5,
      "cinturon"
    )
  );

  // Bolsillo delantero dividido
  const yBolTop = yCint - cmAMetros(5.5);
  const yBolBot = yBolTop - cmAMetros(18.0);
  const posB: number[] = [];
  const uvsB: number[] = [];
  const idxB: number[] = [];
  for (let r = 0; r < 6; r++) {
    const y = THREE.MathUtils.lerp(yBolTop, yBolBot, r / 5);
    const an = evaluarPerfilEnY(perfil.anillosInterpolados, Math.max(y, perfil.caderaYM));
    const dr = calcularDeltaRadioM(config, Math.max(y, yCint), perfil, ajusteStretch) + 0.0085;
    for (let c = 0; c < 8; c++) {
      const th = THREE.MathUtils.lerp(-0.48, 0.48, c / 7);
      const px = (an.a + dr) * Math.sin(th);
      const pz = an.desplazamientoZ + (an.b + dr) * Math.cos(th);
      posB.push(px, y, pz);
      uvsB.push(px, y);
    }
  }
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) {
      const a = r * 8 + c;
      const b = (r + 1) * 8 + c;
      const cN = r * 8 + (c + 1);
      const d = (r + 1) * 8 + (c + 1);
      idxB.push(a, b, cN, cN, b, d);
    }
  }
  const pocketGeo = new THREE.BufferGeometry();
  pocketGeo.setAttribute("position", new THREE.Float32BufferAttribute(posB, 3));
  pocketGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvsB, 2));
  pocketGeo.setIndex(idxB);
  finalizarGeometria(pocketGeo);
  const pocketMesh = new THREE.Mesh(pocketGeo, matVista);
  pocketMesh.name = "delantal-bolsillo";
  registrarMalla(pocketMesh, undefined, "bolsillo");
  objetos.push(pocketMesh);

  // Costura divisoria central del bolsillo
  const pMidTop = evaluarPuntoTorsoConOffset(perfil, config, yBolTop, 0, ajusteStretch, 0.011);
  const pMidBot = evaluarPuntoTorsoConOffset(perfil, config, yBolBot, 0, ajusteStretch, 0.011);
  grupoCosturas.add(crearLineaPespunte([pMidTop, pMidBot], matCostura, "costura-delantal-bolsillo"));

  const anBusto = perfil.anillosClave.busto;
  return {
    objetos,
    etiquetaFrente: {
      id: "lbl-delantero",
      texto: "Delantero",
      posicionLocalM: [0, anBusto.y - cmAMetros(2), anBusto.desplazamientoZ + anBusto.b + cmAMetros(3)],
      normalLocal: [0, 0, 1],
    },
  };
}

/**
 * Construye Cartuchera / Neceser Textil 3D acolchada con fuelle inferior,
 * cremallera superior metálica, cursor y presillas laterales (`zipper_pouch`).
 */
function construirCartuchera3D(
  opciones: OpcionesMallaPrenda,
  grupoCosturas: THREE.Group,
  matCostura: THREE.LineDashedMaterial
): { objetos: THREE.Object3D[]; etiquetaFrente: Etiqueta3DAncla } {
  const objetos: THREE.Object3D[] = [];
  const mat = opciones.materialPrincipal;
  const matVista = opciones.materialForroOVista ?? mat;
  const cy = 0.92;
  const wM = 0.22;
  const hM = 0.13;
  const dM = 0.082;

  // Cuerpo acolchado suavizado (BoxGeometry subdividida + curvatura orgánica de neceser)
  const pouchGeo = new THREE.BoxGeometry(wM, hM, dM, 14, 10, 6);
  const posAttr = pouchGeo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const ux = posAttr.getX(i) / (wM * 0.5);
    const uy = posAttr.getY(i) / (hM * 0.5);
    const uz = posAttr.getZ(i) / (dM * 0.5);
    // Se estrecha ligeramente arriba hacia la cremallera y abomba en el centro
    const taperTop = uy > 0 ? 1 - uy * 0.42 : 1;
    const bulgeZ = 1 + (1 - Math.abs(ux) * 0.7) * (1 - uy * uy) * 0.22;
    const x = ux * (wM * 0.5) * (1 - 0.04 * uy * uy);
    const y = cy + uy * (hM * 0.5);
    const z = uz * (dM * 0.5) * taperTop * bulgeZ;
    posAttr.setXYZ(i, x, y, z);
  }
  posAttr.needsUpdate = true;
  // Escalar UVs al patrón de 8 cm reales
  const uvAttr = pouchGeo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setXY(i, uvAttr.getX(i) * wM, uvAttr.getY(i) * hM);
  }
  uvAttr.needsUpdate = true;
  finalizarGeometria(pouchGeo);

  const pouchMesh = new THREE.Mesh(pouchGeo, mat);
  pouchMesh.name = "cartuchera-cuerpo-3d";
  registrarMalla(pouchMesh, undefined, "cartuchera");
  objetos.push(pouchMesh);

  // Presillas laterales de tela
  for (const lado of [-1, 1] as const) {
    const tabGeo = new THREE.BoxGeometry(0.022, 0.018, 0.024);
    finalizarGeometria(tabGeo);
    const tabMesh = new THREE.Mesh(tabGeo, matVista);
    tabMesh.position.set(lado * (wM * 0.5 + 0.008), cy + hM * 0.44, 0);
    tabMesh.name = `cartuchera-presilla-${lado > 0 ? "izq" : "der"}`;
    registrarMalla(tabMesh, undefined, "cartuchera");
    objetos.push(tabMesh);
  }

  // Cremallera superior metálica + tirador
  const zipMat = new THREE.MeshStandardMaterial({
    color: 0xbec5cd,
    roughness: 0.26,
    metalness: 0.85,
  });
  const zipGeo = new THREE.BoxGeometry(wM * 0.96, 0.009, 0.012);
  const zipMesh = new THREE.Mesh(zipGeo, zipMat);
  zipMesh.position.set(0, cy + hM * 0.5 + 0.003, 0);
  zipMesh.name = "cartuchera-cremallera";
  zipMesh.castShadow = true;
  zipMesh.userData.esHerraje = true;
  zipMesh.userData.zonaPieza = "cartuchera";
  objetos.push(zipMesh);

  const pullGeo = new THREE.BoxGeometry(0.012, 0.022, 0.005);
  const pullMesh = new THREE.Mesh(pullGeo, zipMat);
  pullMesh.position.set(wM * 0.34, cy + hM * 0.5 + 0.004, 0.012);
  pullMesh.rotation.x = 0.45;
  pullMesh.name = "cartuchera-tirador";
  pullMesh.castShadow = true;
  pullMesh.userData.esHerraje = true;
  pullMesh.userData.zonaPieza = "cartuchera";
  objetos.push(pullMesh);

  // Costura frontal lateral en modo "Ver Costuras"
  const offsetZ = dM * 0.52;
  grupoCosturas.add(
    crearLineaPespunte(
      [
        new THREE.Vector3(-wM * 0.48, cy + hM * 0.42, 0.012),
        new THREE.Vector3(-wM * 0.48, cy - hM * 0.46, offsetZ * 0.4),
        new THREE.Vector3(wM * 0.48, cy - hM * 0.46, offsetZ * 0.4),
        new THREE.Vector3(wM * 0.48, cy + hM * 0.42, 0.012),
      ],
      matCostura,
      "costura-cartuchera"
    )
  );

  return {
    objetos,
    etiquetaFrente: {
      id: "lbl-delantero",
      texto: "Delantero",
      posicionLocalM: [0, cy, dM * 0.65],
      normalLocal: [0, 0, 1],
    },
  };
}

/**
 * Construye 3 aros de cinta métrica amarilla de modistería alrededor de Busto, Cintura y Cadera
 * con sus anclas de medida real en cm para mostrar sobre la prenda cuando está activo Ver Costuras / Calce.
 */
function poblarCintasMetricas3D(
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  ajusteStretchM: number,
  grupoCintas: THREE.Group,
  etiquetas: Etiqueta3DAncla[]
): void {
  const matCinta = new THREE.MeshStandardMaterial({
    color: 0xe5b842,
    roughness: 0.45,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const niveles = [
    {
      id: "lbl-medida-busto",
      nombre: "cinta-busto",
      anillo: perfil.anillosClave.busto,
      etiqueta: `Busto ${Math.round(perfil.anillosClave.busto.perimetroObjetivoCm)} cm`,
      incluir: config.prenda !== "falda" && config.prenda !== "pantalon",
      thetaEtiqueta: -0.78,
    },
    {
      id: "lbl-medida-cintura",
      nombre: "cinta-cintura",
      anillo: perfil.anillosClave.cintura,
      etiqueta: `Cintura ${Math.round(perfil.anillosClave.cintura.perimetroObjetivoCm)} cm`,
      incluir: true,
      thetaEtiqueta: 0.78,
    },
    {
      id: "lbl-medida-cadera",
      nombre: "cinta-cadera",
      anillo: perfil.anillosClave.cadera,
      etiqueta: `Cadera ${Math.round(perfil.anillosClave.cadera.perimetroObjetivoCm)} cm`,
      incluir: config.prenda !== "blusa",
      thetaEtiqueta: -0.72,
    },
  ];

  const segs = 40;
  const semiAlto = 0.0045;

  for (const niv of niveles) {
    if (!niv.incluir) continue;
    const pos: number[] = [];
    const idx: number[] = [];
    const y = niv.anillo.y;

    for (let s = 0; s <= segs; s++) {
      const th = ((s / segs) - 0.5) * Math.PI * 2;
      const pt = evaluarPuntoTorsoConOffset(
        perfil,
        config,
        y,
        th,
        ajusteStretchM,
        0.011
      );
      pos.push(pt.x, y + semiAlto, pt.z, pt.x, y - semiAlto, pt.z);
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, matCinta);
    mesh.name = niv.nombre;
    mesh.userData.esHerraje = true;
    grupoCintas.add(mesh);

    const ptAnc = evaluarPuntoTorsoConOffset(
      perfil,
      config,
      y,
      niv.thetaEtiqueta,
      ajusteStretchM,
      0.025
    );
    const normal = calcularNormalTorso(niv.anillo, niv.thetaEtiqueta);
    etiquetas.push({
      id: niv.id,
      texto: niv.etiqueta,
      posicionLocalM: [ptAnc.x, ptAnc.y, ptAnc.z],
      normalLocal: [normal.x, normal.y, normal.z],
    });
  }
}

/**
 * Mapea el ID de una pieza 2D (`PatternPiece.id`) a la zona anatómica equivalente en la malla 3D.
 */
export function mapearPieceIdAZona3D(pieceId: string): ZonaPieza3D | null {
  if (!pieceId || pieceId === "all") return null;
  const id = pieceId.toLowerCase();

  if (id.includes("bucket")) return "sombrero";
  if (id.includes("pouch")) return "cartuchera";
  if (id.includes("ruffle")) return "bolero";
  if (id.includes("pocket") || id.includes("flap")) return "bolsillo";
  if (id.includes("waist_tie") || id.includes("waistband") || id.includes("ties")) {
    return "cinturon";
  }
  if (
    id.includes("collar") ||
    id.includes("facing") ||
    id.includes("placket") ||
    id.includes("lapel")
  ) {
    return "cuello_vista";
  }
  if (id.includes("sleeve")) return "manga";
  if (id.includes("skirt")) return "falda_inferior";
  if (id.includes("leg") || id.includes("pants")) return "pantalon_inferior";
  if (id.includes("back")) return "espalda";
  if (
    id.includes("front") ||
    id.includes("bib") ||
    id.includes("strap") ||
    id.includes("apron_body") ||
    id.includes("baby") ||
    id.includes("kids_")
  ) {
    return "delantero";
  }
  return null;
}

/**
 * Busca la pieza del molde 2D más adecuada al tocar una zona de la malla 3D.
 */
export function buscarPieceIdPorZona3D(
  zona: ZonaPieza3D,
  pieces: readonly PatternPiece[],
  thetaClick = 0
): string | null {
  if (pieces.length === 0) return null;
  const esEspaldaClick = Math.abs(thetaClick) > Math.PI * 0.55;

  if (zona === "delantero" || zona === "espalda") {
    const preferidas = esEspaldaClick
      ? ["back", "top_back", "pajama_top_back", "kids_back", "overall_bib_back"]
      : ["front", "top_front", "pajama_top_front", "kids_front", "overall_bib_front", "apron_body"];
    for (const pId of preferidas) {
      const m = pieces.find((p) => p.id === pId);
      if (m) return m.id;
    }
  }

  // Coincidencia exacta por zona mapeada
  for (const p of pieces) {
    if (mapearPieceIdAZona3D(p.id) === zona) {
      return p.id;
    }
  }
  // Fallback para vestidos de 1 panel donde delantero cubre también falda
  if (zona === "falda_inferior") {
    const alt = pieces.find((p) => p.id === "front" || p.id === "back");
    if (alt) return alt.id;
  }
  return pieces[0]?.id ?? null;
}

function distanciaASegmentoCapsula(
  px: number,
  py: number,
  pz: number,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  rA: number,
  rB: number
): number {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const az = b[2] - a[2];
  const lenSq = ax * ax + ay * ay + az * az;
  const t =
    lenSq > 1e-8
      ? clamp(((px - a[0]) * ax + (py - a[1]) * ay + (pz - a[2]) * az) / lenSq, 0, 1)
      : 0;
  const qx = a[0] + ax * t;
  const qy = a[1] + ay * t;
  const qz = a[2] + az * t;
  const dist = Math.hypot(px - qx, py - qy, pz - qz);
  const rCuerpo = THREE.MathUtils.lerp(rA, rB, t);
  return Math.max(0, dist - rCuerpo);
}

/**
 * Calcula atributos `color` de mapa térmico de calce/holgura (`Ceñido`, `Cómodo`, `Holgado`)
 * y conmuta al material `vertexColors` en 0 ms o restaura el material textil original.
 */
export function aplicarMapaCalceEnPrenda(
  grupoPrenda: THREE.Group,
  perfil: PerfilCuerpo,
  matMapaCalce: THREE.MeshPhysicalMaterial,
  activo: boolean
): void {
  const cCenida = new THREE.Color("#D96B43"); // Terracota cálido (< 2.5 cm)
  const cComodo = new THREE.Color("#3B7A57"); // Verde salvia (2.5 - 8.5 cm)
  const cHolgado = new THREE.Color("#3B6E8C"); // Azul atelier (> 8.5 cm)
  const colTmp = new THREE.Color();

  grupoPrenda.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj.userData.esHerraje) return;
    const geo = obj.geometry;

    if (!activo) {
      if (geo.userData.clothAoColors instanceof Float32Array) {
        geo.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(geo.userData.clothAoColors, 3)
        );
      } else {
        const pos = geo.getAttribute("position");
        if (pos) {
          const white = new Float32Array(pos.count * 3);
          white.fill(1);
          geo.setAttribute("color", new THREE.Float32BufferAttribute(white, 3));
        }
      }
      if (obj.userData.materialOriginal) {
        obj.material = obj.userData.materialOriginal;
      }
      return;
    }

    const posAttr = geo.getAttribute("position");
    if (posAttr instanceof THREE.BufferAttribute) {
      if (!(geo.userData.fitColors instanceof Float32Array)) {
        const colors = new Float32Array(posAttr.count * 3);
        const zona = obj.userData.zonaPieza as ZonaPieza3D | undefined;
        const { brazoIzq, brazoDer, piernaIzq, piernaDer } = perfil.trayectorias;

        for (let i = 0; i < posAttr.count; i++) {
          const px = posAttr.getX(i);
          const py = posAttr.getY(i);
          const pz = posAttr.getZ(i);
          let deltaRM = 0.015;

          if (zona === "manga") {
            const b = px < 0 ? brazoIzq : brazoDer;
            const dSup = distanciaASegmentoCapsula(
              px,
              py,
              pz,
              b.hombro,
              b.codo,
              b.radioHombroM,
              b.radioCodoM
            );
            const dAnt = distanciaASegmentoCapsula(
              px,
              py,
              pz,
              b.codo,
              b.muneca,
              b.radioCodoM,
              b.radioMunecaM
            );
            deltaRM = Math.min(dSup, dAnt);
          } else if (zona === "pantalon_inferior" && py < perfil.caderaYM) {
            const p = px < 0 ? piernaIzq : piernaDer;
            const dMus = distanciaASegmentoCapsula(
              px,
              py,
              pz,
              p.cadera,
              p.rodilla,
              p.radioMusloM,
              p.radioRodillaM
            );
            const dPant = distanciaASegmentoCapsula(
              px,
              py,
              pz,
              p.rodilla,
              p.tobillo,
              p.radioRodillaM,
              p.radioTobilloM
            );
            deltaRM = Math.min(dMus, dPant);
          } else if (zona === "sombrero") {
            const cc = perfil.trayectorias.centroCabeza;
            const distCab = Math.hypot(px - cc[0], pz - cc[2]);
            deltaRM = Math.max(0, distCab - perfil.trayectorias.radioCabezaX);
          } else if (zona === "cartuchera") {
            deltaRM = 0.01;
          } else {
            const an = evaluarPerfilEnY(
              perfil.anillosInterpolados,
              clamp(py, perfil.musloYM, perfil.cuelloYM)
            );
            const dx = px;
            const dz = pz - an.desplazamientoZ;
            const rVert = Math.hypot(dx, dz);
            const theta = Math.atan2(dx, dz);
            const rTorso = Math.hypot(an.a * Math.sin(theta), an.b * Math.cos(theta));
            deltaRM = Math.max(0, rVert - rTorso);
          }

          const holguraPerimCm = deltaRM * 2 * Math.PI * 100;
          if (holguraPerimCm <= 2.5) {
            const t = clamp(holguraPerimCm / 2.5, 0, 1);
            colTmp.copy(cCenida).lerp(cComodo, t * 0.35);
          } else if (holguraPerimCm <= 8.5) {
            const t = clamp((holguraPerimCm - 2.5) / 6.0, 0, 1);
            colTmp.copy(cComodo).lerp(cHolgado, t * 0.28);
          } else {
            const t = clamp((holguraPerimCm - 8.5) / 14.0, 0, 1);
            colTmp.copy(cComodo).lerp(cHolgado, 0.35 + t * 0.65);
          }

          colors[i * 3] = colTmp.r;
          colors[i * 3 + 1] = colTmp.g;
          colors[i * 3 + 2] = colTmp.b;
        }

        geo.userData.fitColors = colors;
      }

      geo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(geo.userData.fitColors, 3)
      );
    }

    obj.material = matMapaCalce;
  });
}

/**
 * Resalta las mallas correspondientes a la pieza 2D seleccionada (en modo textura normal)
 * o restaura todas las mallas a su material base.
 */
export function aplicarResaltadoPieza(
  grupoPrenda: THREE.Group,
  activePieceId: string | undefined,
  matResaltado: THREE.MeshPhysicalMaterial,
  mapaCalceActivo: boolean
): void {
  if (mapaCalceActivo) return;
  const zonaActiva = activePieceId ? mapearPieceIdAZona3D(activePieceId) : null;

  grupoPrenda.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj.userData.esHerraje) return;
    if (!obj.userData.materialOriginal) return;

    if (!zonaActiva) {
      obj.material = obj.userData.materialOriginal;
      return;
    }

    const zonaMesh = obj.userData.zonaPieza as ZonaPieza3D | undefined;
    // "espalda" y "delantero" comparten corpiño continuo en 3D
    const coincide =
      zonaMesh === zonaActiva ||
      (zonaActiva === "espalda" && zonaMesh === "delantero");

    obj.material = coincide ? matResaltado : obj.userData.materialOriginal;
  });
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

  const grupoCintasMetricas = new THREE.Group();
  grupoCintasMetricas.name = "cintas-metricas-3d";
  grupoCintasMetricas.visible = opciones.mostrarCosturas;

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
    grupo.add(grupoCintasMetricas);
    return { grupo, grupoCosturas, grupoCintasMetricas, etiquetas, triangulosTotales };
  }

  if (config.subEstiloEspecial === "zipper_pouch") {
    const pouch = construirCartuchera3D(opciones, grupoCosturas, matCostura);
    pouch.objetos.forEach(contarYAgregar);
    etiquetas.push(pouch.etiquetaFrente);
    grupo.add(grupoCosturas);
    grupo.add(grupoCintasMetricas);
    return { grupo, grupoCosturas, grupoCintasMetricas, etiquetas, triangulosTotales };
  }

  if (config.subEstiloEspecial === "apron") {
    const delantal = construirDelantal3D(
      perfil,
      config,
      opciones,
      grupoCosturas,
      matCostura
    );
    delantal.objetos.forEach(contarYAgregar);
    etiquetas.push(delantal.etiquetaFrente);
    poblarCintasMetricas3D(perfil, config, ajusteStretch, grupoCintasMetricas, etiquetas);
    grupo.add(grupoCosturas);
    grupo.add(grupoCintasMetricas);
    return { grupo, grupoCosturas, grupoCintasMetricas, etiquetas, triangulosTotales };
  }

  const esOverall = config.subEstiloEspecial === "overall";
  const esBodyInfantil = config.subEstiloEspecial === "baby_bodysuit";

  const requiereParteSuperior =
    !esOverall &&
    (config.prenda === "vestido" ||
      config.prenda === "blusa" ||
      config.prenda === "chaqueta" ||
      config.prenda === "enterizo" ||
      Boolean(config.esDosPiezas));

  const requiereFalda =
    !esBodyInfantil &&
    !esOverall &&
    (config.prenda === "falda" ||
      config.prenda === "vestido" ||
      (Boolean(config.esDosPiezas) && config.dosPiezasAbajo !== "pants"));

  const requierePantalon =
    esOverall ||
    config.prenda === "pantalon" ||
    config.prenda === "enterizo" ||
    (Boolean(config.esDosPiezas) && config.dosPiezasAbajo === "pants");

  let etiquetaPinza: Etiqueta3DAncla | undefined;
  let yInferiorTopM = perfil.cinturaYM;

  if (esOverall) {
    const overall = construirPecheraYTirantesOverall(perfil, config, opciones);
    overall.objetos.forEach(contarYAgregar);
    etiquetas.push(overall.etiquetaFrente);
  } else if (requiereParteSuperior) {
    let extraOffsetRadialM = 0;

    if (config.esDosPiezas) {
      const topMult = clamp(config.proporcionesFoto?.topLengthMultiplier ?? 1, 0.72, 1.32);
      if (config.dosPiezasArriba === "crop_top") {
        const cropDrop = clamp(cmAMetros(30) * topMult, cmAMetros(18), perfil.cuelloYM - perfil.cinturaYM - cmAMetros(2.5));
        yInferiorTopM = clamp(
          perfil.cuelloYM - cropDrop,
          perfil.cinturaYM + cmAMetros(3.5),
          perfil.bustoYM - cmAMetros(2.0)
        );
      } else if (config.dosPiezasArriba === "jacket_blazer") {
        yInferiorTopM = clamp(
          perfil.cinturaYM - cmAMetros(13.0) * topMult,
          perfil.caderaYM - cmAMetros(2.0),
          perfil.cinturaYM - cmAMetros(5.0)
        );
        extraOffsetRadialM = 0.0055;
      } else {
        yInferiorTopM = clamp(
          perfil.cinturaYM - cmAMetros(6.5) * topMult,
          perfil.caderaYM,
          perfil.cinturaYM - cmAMetros(1.5)
        );
        extraOffsetRadialM = 0.0045;
      }
    } else if (config.prenda === "blusa" || config.prenda === "chaqueta") {
      const largoPrendaTopM = clamp(
        cmAMetros(config.largoDeseado),
        cmAMetros(28),
        perfil.cuelloYM - perfil.caderaYM + cmAMetros(6)
      );
      yInferiorTopM = Math.max(
        perfil.caderaYM - cmAMetros(5),
        perfil.cuelloYM - largoPrendaTopM
      );
    } else if (config.corteImperio) {
      yInferiorTopM = perfil.anillosClave.bajoBusto.y;
    }

    const corp = construirCorpino(
      perfil,
      config,
      yInferiorTopM,
      opciones,
      extraOffsetRadialM
    );
    contarYAgregar(corp.mesh);
    if (corp.extras) corp.extras.forEach(contarYAgregar);
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
    !esBodyInfantil &&
    (config.prenda === "vestido" ||
      config.prenda === "enterizo" ||
      config.prenda === "falda" ||
      config.prenda === "pantalon" ||
      Boolean(config.esDosPiezas));

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

    if (!requiereParteSuperior && !esOverall) {
      const cad = perfil.anillosClave.cadera;
      etiquetas.push({
        id: "lbl-delantero",
        texto: "Delantero",
        posicionLocalM: [0, cad.y, cad.desplazamientoZ + cad.b + cmAMetros(3)],
        normalLocal: [0, 0, 1],
      });
    }
  }

  const resBolsillos = construirBolsillos3D(
    perfil,
    config,
    yInferiorTopM,
    opciones,
    grupoCosturas,
    matCostura
  );
  resBolsillos.objetos.forEach(contarYAgregar);
  if (resBolsillos.etiquetaBolsillo) {
    etiquetas.push(resBolsillos.etiquetaBolsillo);
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

  poblarCintasMetricas3D(perfil, config, ajusteStretch, grupoCintasMetricas, etiquetas);
  grupo.add(grupoCosturas);
  grupo.add(grupoCintasMetricas);

  return {
    grupo,
    grupoCosturas,
    grupoCintasMetricas,
    etiquetas,
    triangulosTotales,
  };
}
