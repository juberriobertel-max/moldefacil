import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { evaluarPerfilEnY } from "./bodyProfile";
import { disposeObject } from "./disposal";
import { AcabadoManiqui3D, AnilloPerfil, PerfilCuerpo } from "./types";

export interface ManiquiInstancia {
  grupo: THREE.Group;
  materialesCompartidos: THREE.Material[];
  texturasCompartidas: THREE.Texture[];
  actualizar: (perfil: PerfilCuerpo) => void;
  aplicarAcabado: (acabado: AcabadoManiqui3D) => void;
  mostrarCintasGuia: (visible: boolean) => void;
  calibrarPerfilPrenda?: (perfilBase: PerfilCuerpo) => PerfilCuerpo;
}

const SEGMENTOS_RADIALES_TORSO = 48;
export const ACABADOS_MANIQUI: Record<
  AcabadoManiqui3D,
  {
    cuerpo: number;
    articulacion: number;
    cinta: number;
    roughnessCuerpo: number;
    roughnessArt: number;
  }
> = {
  lino: {
    cuerpo: 0xd9d9d6,
    articulacion: 0xbdbdb8,
    cinta: 0x1e1b18,
    roughnessCuerpo: 0.8,
    roughnessArt: 0.78,
  },
  grafito: {
    cuerpo: 0x35383d,
    articulacion: 0x232529,
    cinta: 0xe6dccb,
    roughnessCuerpo: 0.72,
    roughnessArt: 0.7,
  },
  madera: {
    cuerpo: 0xc89d74,
    articulacion: 0x9e744f,
    cinta: 0x2a1c14,
    roughnessCuerpo: 0.64,
    roughnessArt: 0.62,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function crearVector3(tupla: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(tupla[0], tupla[1], tupla[2]);
}

function construirMatrizSegmento(
  inicio: THREE.Vector3,
  fin: THREE.Vector3,
  escalaRadial = 1
): { posicion: THREE.Vector3; cuaternion: THREE.Quaternion; longitud: number; escala: THREE.Vector3 } {
  const delta = new THREE.Vector3().subVectors(fin, inicio);
  const longitud = Math.max(0.01, delta.length());
  const dir = delta.clone().divideScalar(longitud);
  const cuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir
  );
  return {
    posicion: inicio,
    cuaternion,
    longitud,
    escala: new THREE.Vector3(escalaRadial, longitud, escalaRadial),
  };
}

/**
 * Construye el torso paramétrico continuo desde el cuello al fondo pélvico.
 * Incluye modelado sutil del busto (sin sobresalir del anillo objetivo) y
 * 2 surcos visuales (-2.5 mm) entre pecho, cintura y pelvis sin huecos reales.
 */
function crearGeometriaTorsoArticulado(perfil: PerfilCuerpo): THREE.BufferGeometry {
  const { anillosInterpolados, anillosClave } = perfil;
  const cols = SEGMENTOS_RADIALES_TORSO;

  // Insertamos filas dedicadas para surcos visuales finos sin alterar la continuidad de la superficie
  interface FilaTorso {
    anillo: AnilloPerfil;
    profundidadSurcoM: number;
  }

  const filas: FilaTorso[] = [];
  const ySurcoTorax = anillosClave.bajoBusto.y - 0.016;
  const ySurcoPelvis = anillosClave.caderaAlta.y + 0.012;
  const anchoSurco = 0.011;

  const calcularSurco = (y: number, theta: number): number => {
    // Surco torácico sigue suavemente el contorno bajo el busto
    const curvaBajoBusto = ySurcoTorax - 0.014 * Math.cos(theta);
    const dTorax = Math.abs(y - curvaBajoBusto);
    const gTorax =
      dTorax < anchoSurco
        ? Math.cos((dTorax / anchoSurco) * (Math.PI * 0.5)) * 0.0026
        : 0;

    // Surco pélvico separa la cintura del bloque pélvico/calzón anatómico
    const curvaPelvis = ySurcoPelvis - 0.012 * Math.max(0, Math.cos(theta));
    const dPelvis = Math.abs(y - curvaPelvis);
    const gPelvis =
      dPelvis < anchoSurco
        ? Math.cos((dPelvis / anchoSurco) * (Math.PI * 0.5)) * 0.0026
        : 0;

    return Math.max(gTorax, gPelvis);
  };

  for (let i = 0; i < anillosInterpolados.length; i++) {
    filas.push({ anillo: anillosInterpolados[i], profundidadSurcoM: 0 });
  }

  // Modelado sutil de pecho y cavidades del bloque pélvico sin cruzar nunca el perfil medido
  const yBusto = anillosClave.busto.y;
  const dyBustoSpan = Math.max(
    0.045,
    (anillosClave.hombros.y - anillosClave.bajoBusto.y) * 0.45
  );
  const yMuslo = anillosClave.muslo.y;
  const yCadera = anillosClave.cadera.y;

  const numRows = filas.length;
  const stride = cols + 1;
  const pos: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < numRows; r++) {
    const anillo = filas[r].anillo;
    const v = r / Math.max(1, numRows - 1);

    // Suave recogimiento ventral en la base del bloque pélvico para alojar las articulaciones de cadera
    let factorTaperPelvisZ = 1;
    let factorTaperPelvisX = 1;
    if (anillo.y < yCadera) {
      const tP = clamp(
        (yCadera - anillo.y) / Math.max(0.02, yCadera - yMuslo),
        0,
        1
      );
      factorTaperPelvisX = 1 - tP * 0.14;
      factorTaperPelvisZ = 1 - tP * 0.22;
    }

    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      let px = anillo.a * factorTaperPelvisX * sinT;
      let pz = anillo.desplazamientoZ + anillo.b * factorTaperPelvisZ * cosT;

      // Modelado sutil de busto femenino dentro de la envolvente del anillo
      if (cosT > 0.12 && Math.abs(anillo.y - yBusto) < dyBustoSpan) {
        const pesoY = Math.cos(
          clamp((anillo.y - yBusto) / dyBustoSpan, -1, 1) * (Math.PI * 0.5)
        );
        const absAng = Math.abs(Math.atan2(sinT, cosT));
        // Hundimiento sutil en el esternón central para sugerir dos copas suaves
        const pesoEsternon = Math.exp(-Math.pow(absAng / 0.22, 2));
        const pesoLateralPecho = Math.exp(-Math.pow((absAng - 0.44) / 0.28, 2));
        const ajusteEsternon = -0.0055 * pesoY * pesoEsternon;
        const microSutilezaCopa = 0.0012 * pesoY * pesoLateralPecho;
        pz += ajusteEsternon + microSutilezaCopa * cosT;
      }

      // Esculpir ligera cavidad glútea central trasera
      if (cosT < -0.35 && anillo.y < anillosClave.cintura.y && anillo.y > yMuslo) {
        const pesoCentroAtras = Math.exp(
          -Math.pow(Math.sin(theta) / 0.22, 2)
        );
        pz += 0.0032 * pesoCentroAtras;
      }

      // Aplicar surcos visuales (~2.5 mm) manteniendo malla 100% continua
      const surco = calcularSurco(anillo.y, theta);
      if (surco > 0) {
        const rPlanar = Math.hypot(px, pz - anillo.desplazamientoZ);
        if (rPlanar > 1e-4) {
          const factorR = Math.max(0.75, (rPlanar - surco) / rPlanar);
          px *= factorR;
          pz = anillo.desplazamientoZ + (pz - anillo.desplazamientoZ) * factorR;
        }
      }

      pos.push(px, anillo.y, pz);
      uvs.push(u, 1 - v);
    }
  }

  for (let r = 0; r < numRows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const d = (r + 1) * stride + c;
      const e = d + 1;
      indices.push(a, d, b);
      indices.push(b, d, e);
    }
  }

  // Tapa superior continua del cuello (sin hueco abierto)
  const centroTopIdx = pos.length / 3;
  const topRing = anillosInterpolados[0];
  pos.push(0, topRing.y + 0.006, topRing.desplazamientoZ);
  uvs.push(0.5, 1);
  for (let c = 0; c < cols; c++) {
    indices.push(centroTopIdx, c, c + 1);
  }

  // Tapa inferior pélvica esculpida entre las caderas
  const botStart = (numRows - 1) * stride;
  const centroBotIdx = pos.length / 3;
  const botRing = anillosInterpolados[numRows - 1];
  pos.push(0, botRing.y - 0.018, botRing.desplazamientoZ);
  uvs.push(0.5, 0);
  for (let c = 0; c < cols; c++) {
    indices.push(centroBotIdx, botStart + c + 1, botStart + c);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Cabeza ovoide sin rostro (sin ojos ni boca), con nariz y pómulos apenas insinuados.
 */
function crearGeometriaCabezaOvoide(perfil: PerfilCuerpo): THREE.BufferGeometry {
  const { radioCabezaX, radioCabezaY, radioCabezaZ } = perfil.trayectorias;
  const geom = new THREE.SphereGeometry(1, 28, 20);
  const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;

  for (let i = 0; i < posAttr.count; i++) {
    const ux = posAttr.getX(i);
    const uy = posAttr.getY(i);
    const uz = posAttr.getZ(i);

    // Forma ovoide: mentón más afinado abajo, cráneo más lleno arriba-atrás
    const taperMenton = uy < 0 ? 1 - Math.abs(uy) * 0.26 : 1 + uy * 0.04;
    let x = ux * radioCabezaX * taperMenton;
    const y = uy * radioCabezaY;
    let z = uz * radioCabezaZ * (uy < -0.25 ? 0.9 : 1);

    // Insinuación muy sutil de pómulos y puente nasal sin dibujar ojos ni boca
    if (uz > 0.25) {
      const puenteNasall =
        Math.exp(-Math.pow(ux / 0.16, 2)) *
        Math.exp(-Math.pow((uy + 0.05) / 0.22, 2));
      z += radioCabezaZ * 0.075 * puenteNasall;

      const pomuloIzqDer =
        Math.exp(-Math.pow((Math.abs(ux) - 0.48) / 0.22, 2)) *
        Math.exp(-Math.pow((uy + 0.08) / 0.24, 2));
      z += radioCabezaZ * 0.03 * pomuloIzqDer;
      x += Math.sign(ux) * radioCabezaX * 0.02 * pomuloIzqDer;
    }

    if (uy > 0 && uz < 0) {
      // Nuca ligeramente redondeada atrás
      z -= radioCabezaZ * 0.04 * uy * Math.abs(uz);
    }

    posAttr.setXYZ(i, x, y, z);
  }

  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Segmento anatómico normalizado en Y ∈ [0, 1] mediante LatheGeometry compartida.
 */
function crearGeometriaSegmentoExtremidad(
  radioInicio: number,
  radioMedio: number,
  radioFin: number,
  tMedio = 0.42
): THREE.BufferGeometry {
  const puntos: THREE.Vector2[] = [];
  const pasos = 8;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    let r: number;
    if (t <= tMedio) {
      const k = t / Math.max(0.05, tMedio);
      const s = Math.sin(k * Math.PI * 0.5);
      r = radioInicio * (1 - k * 0.45) + radioMedio * (k * 0.45) + (radioMedio - radioInicio) * 0.18 * s;
    } else {
      const k = (t - tMedio) / Math.max(0.05, 1 - tMedio);
      const smooth = k * k * (3 - 2 * k);
      r = radioMedio * (1 - smooth) + radioFin * smooth;
    }
    // Leve bisel en extremos para estética articulada limpia
    const finCap = t === 0 || t === 1 ? 0.92 : 1;
    puntos.push(new THREE.Vector2(Math.max(0.008, r * finCap), t));
  }

  const geom = new THREE.LatheGeometry(puntos, 16);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Mano simplificada en forma de manopla con pulgar separado (<= 300 triángulos).
 * Base orientada con ejey muñeca->punta (-Y mundo), ejez adelante (+Z mundo) y ejex (-X mundo).
 */
function crearGeometriaManoManopla(
  largoManoM: number,
  radioMunecaM: number,
  lado: -1 | 1
): THREE.BufferGeometry {
  const anchoPalma = clamp(radioMunecaM * 1.18, 0.015, 0.042);
  const grosorPalma = clamp(radioMunecaM * 0.66, 0.009, 0.024);

  // Bloque principal de palma + dedos juntos relajados (SphereGeometry 10x6 -> ~100 tris)
  const palma = new THREE.SphereGeometry(1, 10, 6);
  palma.scale(grosorPalma, largoManoM * 0.5, anchoPalma);
  palma.translate(0, largoManoM * 0.5, 0);

  // Pulgar separado orientado hacia adelante (+Z mundo) y levemente hacia el cuerpo (hacia -lado*X mundo => +lado en ejex)
  const pulgar = new THREE.SphereGeometry(1, 8, 5);
  pulgar.scale(grosorPalma * 0.72, largoManoM * 0.24, grosorPalma * 0.8);
  pulgar.rotateX(0.45);
  pulgar.rotateZ(-lado * 0.22);
  pulgar.translate(lado * grosorPalma * 0.35, largoManoM * 0.35, anchoPalma * 0.96);

  const combinada = mergeGeometries([palma, pulgar], false);
  palma.dispose();
  pulgar.dispose();
  combinada.computeVertexNormals();
  return combinada;
}

function calcularCuaternionMano(
  muneca: THREE.Vector3,
  manoFin: THREE.Vector3
): THREE.Quaternion {
  const ejey = new THREE.Vector3().subVectors(manoFin, muneca).normalize();
  const forwardRef = new THREE.Vector3(0, 0, 1);
  const ejex = new THREE.Vector3().crossVectors(ejey, forwardRef);
  if (ejex.lengthSq() < 1e-6) {
    ejex.set(-1, 0, 0);
  } else {
    ejex.normalize();
  }
  const ejez = new THREE.Vector3().crossVectors(ejex, ejey).normalize();
  const mat = new THREE.Matrix4().makeBasis(ejex, ejey, ejez);
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}

/**
 * Pie con forma de zapato plano simple apoyado al nivel y = 0.
 */
function crearGeometriaPieZapatoPlano(
  largoPieM: number,
  radioTobilloM: number
): THREE.BufferGeometry {
  const anchoPie = clamp(radioTobilloM * 1.55, 0.028, 0.056);
  const altoTalon = clamp(largoPieM * 0.26, 0.03, 0.062);

  // Suela + empeine esculpido sobre un cilindro/esfera aplanada (12 radial x 6 anillos = ~120 tris)
  const pie = new THREE.SphereGeometry(1, 12, 7);
  const pos = pie.getAttribute("position") as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Desplazamiento longitudinal Z: talón hacia atrás (-0.28), puntera adelante (+0.72)
    const zNorm = uz * 0.5 + 0.22; // ~[-0.28, +0.72]
    const z = zNorm * largoPieM;

    // Puntera ligeramente más ancha en metatarso y redondeada al frente
    const perfilAncho =
      uz > 0.35
        ? 1 - Math.pow((uz - 0.35) / 0.65, 2) * 0.3
        : 0.76 + (uz + 1) * 0.14;
    const x = ux * anchoPie * perfilAncho;

    // Empeine alto en el talón, bajo en los dedos, suela plana estricta en y = 0
    const yTecho =
      uz < 0
        ? altoTalon
        : altoTalon * clamp(1 - Math.pow(Math.max(0, uz), 0.85) * 0.62, 0.26, 1);
    const y = uy <= -0.05 ? 0 : (uy + 0.05) * yTecho;

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  pie.computeVertexNormals();
  return pie;
}

/**
 * Construye las cintas de modistería anatómicas (busto, cintura, cadera y líneas centrales)
 * adheridas suavemente (+1.3 mm) sobre la superficie del maniquí sin z-fighting.
 */
export function crearGrupoCintasModisteria(
  perfil: PerfilCuerpo,
  materialCinta: THREE.Material
): THREE.Group {
  const grupoCintas = new THREE.Group();
  grupoCintas.name = "maniqui-cintas-modisteria";

  const anillosGuia = [
    { nombre: "cinta-busto", anillo: perfil.anillosClave.busto },
    { nombre: "cinta-cintura", anillo: perfil.anillosClave.cintura },
    { nombre: "cinta-cadera", anillo: perfil.anillosClave.cadera },
  ];

  const offsetM = 0.0014;
  const semiAncho = 0.0028;
  const segs = 48;

  for (const g of anillosGuia) {
    const pos: number[] = [];
    const idx: number[] = [];
    const yTop = g.anillo.y + semiAncho;
    const yBot = g.anillo.y - semiAncho;
    const aR = g.anillo.a + offsetM;
    const bR = g.anillo.b + offsetM;

    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const px = aR * Math.sin(th);
      const pz = g.anillo.desplazamientoZ + bR * Math.cos(th);
      pos.push(px, yTop, pz, px, yBot, pz);
    }
    for (let s = 0; s < segs; s++) {
      const i0 = s * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 2, i0 + 1, i0 + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materialCinta);
    mesh.name = g.nombre;
    grupoCintas.add(mesh);
  }

  // Líneas centrales delantero (θ = 0) y espalda (θ = π)
  const yTopVert = perfil.cuelloYM - 0.015;
  const yBotVert = perfil.caderaYM - 0.01;
  const pasosV = 24;
  for (const linea of [
    { nombre: "cinta-centro-delantero", theta: 0 },
    { nombre: "cinta-centro-espalda", theta: Math.PI },
  ]) {
    const pos: number[] = [];
    const idx: number[] = [];
    const signoZ = linea.theta === 0 ? 1 : -1;

    for (let i = 0; i <= pasosV; i++) {
      const y = THREE.MathUtils.lerp(yTopVert, yBotVert, i / pasosV);
      const an = evaluarPerfilEnY(perfil.anillosInterpolados, y);
      const pz = an.desplazamientoZ + signoZ * (an.b + offsetM);
      pos.push(-semiAncho, y, pz, semiAncho, y, pz);
    }
    for (let i = 0; i < pasosV; i++) {
      const i0 = i * 2;
      if (signoZ > 0) {
        idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      } else {
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materialCinta);
    mesh.name = linea.nombre;
    grupoCintas.add(mesh);
  }

  return grupoCintas;
}

/**
 * Crea la figura articulada humana completa de pie apoyada en y = 0, sin trípode ni pedestal.
 */
export function crearManiqui(perfilInicial: PerfilCuerpo): ManiquiInstancia {
  const grupo = new THREE.Group();
  grupo.name = "maniqui-artista-articulado";

  const grupoDinamico = new THREE.Group();
  grupoDinamico.name = "maniqui-segmentos-dinamicos";
  grupo.add(grupoDinamico);

  const acabadoIni = ACABADOS_MANIQUI.lino;
  const materialCuerpo = new THREE.MeshStandardMaterial({
    color: acabadoIni.cuerpo,
    roughness: acabadoIni.roughnessCuerpo,
    metalness: 0,
    side: THREE.FrontSide,
  });

  const materialArticulacion = new THREE.MeshStandardMaterial({
    color: acabadoIni.articulacion,
    roughness: acabadoIni.roughnessArt,
    metalness: 0,
    side: THREE.FrontSide,
  });

  const materialCinta = new THREE.MeshStandardMaterial({
    color: acabadoIni.cinta,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const materialesSet = new Set<THREE.Material>([
    materialCuerpo,
    materialArticulacion,
    materialCinta,
  ]);
  const texturasVacias = new Set<THREE.Texture>();
  let cintasVisible = false;
  let refGrupoCintas: THREE.Group | null = null;

  // Geometría compartida e instanciada para todas las 14 articulaciones
  const geometriaArticulacion = new THREE.SphereGeometry(1, 14, 10);
  const CANTIDAD_ARTICULACIONES = 14;
  const articulacionesInstanciadas = new THREE.InstancedMesh(
    geometriaArticulacion,
    materialArticulacion,
    CANTIDAD_ARTICULACIONES
  );
  articulacionesInstanciadas.name = "maniqui-articulaciones-instanced";
  articulacionesInstanciadas.castShadow = true;
  articulacionesInstanciadas.receiveShadow = true;
  grupo.add(articulacionesInstanciadas);

  const matrizDummy = new THREE.Object3D();

  const actualizar = (perfil: PerfilCuerpo) => {
    // Liberar geometrías previas de segmentos dinámicos conservando los materiales compartidos
    while (grupoDinamico.children.length > 0) {
      const hijo = grupoDinamico.children[0];
      grupoDinamico.remove(hijo);
      disposeObject(hijo, {
        preservarMateriales: materialesSet,
        preservarTexturas: texturasVacias,
      });
    }

    const { trayectorias, anillosClave } = perfil;
    const escEst = clamp(perfil.alturaTotalM / 1.65, 0.52, 1.25);

    // 1. Torso continuo paramétrico (con pecho modelado sutil + pelvis en dos bloques)
    const meshTorso = new THREE.Mesh(
      crearGeometriaTorsoArticulado(perfil),
      materialCuerpo
    );
    meshTorso.name = "torso-articulado-parametrico";
    meshTorso.castShadow = true;
    meshTorso.receiveShadow = true;
    grupoDinamico.add(meshTorso);

    // 2. Cuello cilíndrico con transición suave al cráneo
    const centroCabeza = crearVector3(trayectorias.centroCabeza);
    const alturaCuelloBase = anillosClave.cuello.y - 0.004 * escEst;
    const alturaNuca = centroCabeza.y - trayectorias.radioCabezaY * 0.72;
    const altoCuelloReal = Math.max(0.032 * escEst, alturaNuca - alturaCuelloBase);
    const geomCuello = new THREE.CylinderGeometry(
      trayectorias.radioCuelloM * 0.88,
      trayectorias.radioCuelloM * 0.96,
      altoCuelloReal,
      18,
      1
    );
    geomCuello.translate(0, altoCuelloReal * 0.5, 0);
    const meshCuello = new THREE.Mesh(geomCuello, materialCuerpo);
    meshCuello.name = "cuello-articulado";
    meshCuello.position.set(0, alturaCuelloBase, centroCabeza.z * 0.92);
    meshCuello.castShadow = true;
    meshCuello.receiveShadow = true;
    grupoDinamico.add(meshCuello);

    // 3. Cabeza ovoide sin rostro (compartida con bucket hat)
    const meshCabeza = new THREE.Mesh(
      crearGeometriaCabezaOvoide(perfil),
      materialCuerpo
    );
    meshCabeza.name = "cabeza-ovoide";
    meshCabeza.position.copy(centroCabeza);
    meshCabeza.castShadow = true;
    meshCabeza.receiveShadow = true;
    grupoDinamico.add(meshCabeza);

    // 4. Segmentos de brazos compartidos (1 brazo superior + 1 antebrazo compartidos por L/R)
    const bIzq = trayectorias.brazoIzq;
    const bDer = trayectorias.brazoDer;

    const geomBrazoSup = crearGeometriaSegmentoExtremidad(
      bIzq.radioHombroM * 0.96,
      bIzq.radioHombroM * 0.92,
      bIzq.radioCodoM * 0.92,
      0.35
    );
    const geomAntebrazo = crearGeometriaSegmentoExtremidad(
      bIzq.radioCodoM * 0.96,
      bIzq.radioCodoM * 1.0,
      bIzq.radioMunecaM * 0.94,
      0.3
    );

    const ladosBrazo = [
      { id: "izq", data: bIzq },
      { id: "der", data: bDer },
    ] as const;

    for (const { id, data } of ladosBrazo) {
      const pHombro = crearVector3(data.hombro);
      const pCodo = crearVector3(data.codo);
      const pMuneca = crearVector3(data.muneca);
      const pManoFin = crearVector3(data.manoFin);

      const segSup = construirMatrizSegmento(pHombro, pCodo);
      const meshSup = new THREE.Mesh(geomBrazoSup, materialCuerpo);
      meshSup.name = `brazo-superior-${id}`;
      meshSup.position.copy(segSup.posicion);
      meshSup.quaternion.copy(segSup.cuaternion);
      meshSup.scale.set(1, segSup.longitud, 1);
      meshSup.castShadow = true;
      meshSup.receiveShadow = true;
      grupoDinamico.add(meshSup);

      const segAnt = construirMatrizSegmento(pCodo, pMuneca);
      const meshAnt = new THREE.Mesh(geomAntebrazo, materialCuerpo);
      meshAnt.name = `antebrazo-${id}`;
      meshAnt.position.copy(segAnt.posicion);
      meshAnt.quaternion.copy(segAnt.cuaternion);
      meshAnt.scale.set(1, segAnt.longitud, 1);
      meshAnt.castShadow = true;
      meshAnt.receiveShadow = true;
      grupoDinamico.add(meshAnt);

      // Mano simplificada orientada de muñeca a punta de dedos, palma hacia el muslo
      const geomMano = crearGeometriaManoManopla(
        data.largoManoM,
        data.radioMunecaM,
        data.lado
      );
      const meshMano = new THREE.Mesh(geomMano, materialCuerpo);
      meshMano.name = `mano-manopla-${id}`;
      meshMano.position.copy(pMuneca);
      meshMano.quaternion.copy(calcularCuaternionMano(pMuneca, pManoFin));
      if (trayectorias.pose.palmaHaciaMuslo) {
        meshMano.rotateY(data.lado * 0.14);
      }
      meshMano.castShadow = true;
      meshMano.receiveShadow = true;
      grupoDinamico.add(meshMano);
    }

    // 5. Segmentos de piernas compartidos (muslos y pantorrillas izq/der + pies zapato plano)
    const pIzq = trayectorias.piernaIzq;
    const pDer = trayectorias.piernaDer;

    const geomMuslo = crearGeometriaSegmentoExtremidad(
      pIzq.radioMusloM * 0.99,
      pIzq.radioMusloM * 0.96,
      pIzq.radioRodillaM * 0.95,
      0.26
    );
    const geomPantorrilla = crearGeometriaSegmentoExtremidad(
      pIzq.radioRodillaM * 0.98,
      pIzq.radioRodillaM * 1.05,
      pIzq.radioTobilloM * 0.94,
      0.34
    );
    const geomPie = crearGeometriaPieZapatoPlano(
      pIzq.largoPieM,
      pIzq.radioTobilloM
    );

    const ladosPierna = [
      { id: "izq", data: pIzq },
      { id: "der", data: pDer },
    ] as const;

    const rotPieRad = deg2rad(trayectorias.pose.rotacionPieDeg);
    for (const { id, data } of ladosPierna) {
      const pCadera = crearVector3(data.cadera);
      const pRodilla = crearVector3(data.rodilla);
      const pTobillo = crearVector3(data.tobillo);

      const segMuslo = construirMatrizSegmento(pCadera, pRodilla);
      const meshMuslo = new THREE.Mesh(geomMuslo, materialCuerpo);
      meshMuslo.name = `muslo-${id}`;
      meshMuslo.position.copy(segMuslo.posicion);
      meshMuslo.quaternion.copy(segMuslo.cuaternion);
      meshMuslo.scale.set(1, segMuslo.longitud, 1);
      meshMuslo.castShadow = true;
      meshMuslo.receiveShadow = true;
      grupoDinamico.add(meshMuslo);

      const segPant = construirMatrizSegmento(pRodilla, pTobillo);
      const meshPant = new THREE.Mesh(geomPantorrilla, materialCuerpo);
      meshPant.name = `pantorrilla-${id}`;
      meshPant.position.copy(segPant.posicion);
      meshPant.quaternion.copy(segPant.cuaternion);
      meshPant.scale.set(1, segPant.longitud, 1);
      meshPant.castShadow = true;
      meshPant.receiveShadow = true;
      grupoDinamico.add(meshPant);

      const meshPie = new THREE.Mesh(geomPie, materialCuerpo);
      meshPie.name = `pie-zapato-${id}`;
      meshPie.position.set(pTobillo.x, 0, pTobillo.z);
      meshPie.rotation.y = data.lado * rotPieRad;
      meshPie.castShadow = true;
      meshPie.receiveShadow = true;
      grupoDinamico.add(meshPie);
    }

    // 6. Actualizar las 14 matrices de la InstancedMesh de articulaciones (un tono más oscuro #BDBDB8)
    const joints: Array<{ pos: [number, number, number]; sx: number; sy: number; sz: number }> = [
      // Cuello base & base craneal
      {
        pos: [0, alturaCuelloBase + 0.005 * escEst, centroCabeza.z * 0.92],
        sx: trayectorias.radioCuelloM * 1.01,
        sy: trayectorias.radioCuelloM * 0.62,
        sz: trayectorias.radioCuelloM * 1.01,
      },
      {
        pos: [0, alturaNuca, centroCabeza.z],
        sx: trayectorias.radioCuelloM * 0.82,
        sy: trayectorias.radioCuelloM * 0.65,
        sz: trayectorias.radioCuelloM * 0.82,
      },
      // Hombros izq/der
      {
        pos: bIzq.hombro,
        sx: bIzq.radioHombroM * 0.96,
        sy: bIzq.radioHombroM * 0.96,
        sz: bIzq.radioHombroM * 0.96,
      },
      {
        pos: bDer.hombro,
        sx: bDer.radioHombroM * 0.96,
        sy: bDer.radioHombroM * 0.96,
        sz: bDer.radioHombroM * 0.96,
      },
      // Codos izq/der
      {
        pos: bIzq.codo,
        sx: bIzq.radioCodoM * 0.92,
        sy: bIzq.radioCodoM * 1.05,
        sz: bIzq.radioCodoM * 0.92,
      },
      {
        pos: bDer.codo,
        sx: bDer.radioCodoM * 0.92,
        sy: bDer.radioCodoM * 1.05,
        sz: bDer.radioCodoM * 0.92,
      },
      // Muñecas izq/der
      {
        pos: bIzq.muneca,
        sx: bIzq.radioMunecaM * 0.96,
        sy: bIzq.radioMunecaM * 0.88,
        sz: bIzq.radioMunecaM * 0.96,
      },
      {
        pos: bDer.muneca,
        sx: bDer.radioMunecaM * 0.96,
        sy: bDer.radioMunecaM * 0.88,
        sz: bDer.radioMunecaM * 0.96,
      },
      // Caderas izq/der
      {
        pos: pIzq.cadera,
        sx: pIzq.radioCaderaM * 0.96,
        sy: pIzq.radioCaderaM * 0.88,
        sz: pIzq.radioCaderaM * 0.96,
      },
      {
        pos: pDer.cadera,
        sx: pDer.radioCaderaM * 0.96,
        sy: pDer.radioCaderaM * 0.88,
        sz: pDer.radioCaderaM * 0.96,
      },
      // Rodillas izq/der
      {
        pos: pIzq.rodilla,
        sx: pIzq.radioRodillaM * 0.94,
        sy: pIzq.radioRodillaM * 1.06,
        sz: pIzq.radioRodillaM * 0.94,
      },
      {
        pos: pDer.rodilla,
        sx: pDer.radioRodillaM * 0.94,
        sy: pDer.radioRodillaM * 1.06,
        sz: pDer.radioRodillaM * 0.94,
      },
      // Tobillos izq/der
      {
        pos: pIzq.tobillo,
        sx: pIzq.radioTobilloM * 0.98,
        sy: pIzq.radioTobilloM * 0.92,
        sz: pIzq.radioTobilloM * 0.98,
      },
      {
        pos: pDer.tobillo,
        sx: pDer.radioTobilloM * 0.98,
        sy: pDer.radioTobilloM * 0.92,
        sz: pDer.radioTobilloM * 0.98,
      },
    ];

    for (let idx = 0; idx < joints.length; idx++) {
      const j = joints[idx];
      matrizDummy.position.set(j.pos[0], j.pos[1], j.pos[2]);
      matrizDummy.rotation.set(0, 0, 0);
      matrizDummy.scale.set(j.sx, j.sy, j.sz);
      matrizDummy.updateMatrix();
      articulacionesInstanciadas.setMatrixAt(idx, matrizDummy.matrix);
    }
    articulacionesInstanciadas.instanceMatrix.needsUpdate = true;
    articulacionesInstanciadas.computeBoundingSphere();

    // 7. Cintas guía de modistería sobre busto, cintura, cadera y líneas centrales
    const cintas = crearGrupoCintasModisteria(perfil, materialCinta);
    cintas.visible = cintasVisible;
    refGrupoCintas = cintas;
    grupoDinamico.add(cintas);
  };

  actualizar(perfilInicial);

  return {
    grupo,
    materialesCompartidos: [materialCuerpo, materialArticulacion, materialCinta],
    texturasCompartidas: [],
    actualizar,
    aplicarAcabado(acabado: AcabadoManiqui3D) {
      const cfg = ACABADOS_MANIQUI[acabado] ?? ACABADOS_MANIQUI.lino;
      materialCuerpo.color.setHex(cfg.cuerpo);
      materialCuerpo.roughness = cfg.roughnessCuerpo;
      materialArticulacion.color.setHex(cfg.articulacion);
      materialArticulacion.roughness = cfg.roughnessArt;
      materialCinta.color.setHex(cfg.cinta);
    },
    mostrarCintasGuia(visible: boolean) {
      cintasVisible = visible;
      if (refGrupoCintas) {
        refGrupoCintas.visible = visible;
      }
    },
  };
}
