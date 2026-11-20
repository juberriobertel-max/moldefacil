import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { evaluarPerfilEnY } from "./bodyProfile";
import { disposeObject } from "./disposal";
import {
  ACABADOS_MANIQUI,
  crearGrupoCintasModisteria,
  ManiquiInstancia,
} from "./mannequinBuilder";
import { AcabadoManiqui3D, PerfilCuerpo } from "./types";

const URLS_MANIQUI_GLB: readonly string[] = [
  "/models/base-female.glb",
  "https://cdn.jsdelivr.net/gh/opensegra/ai-library@main/public/assets/base-female.glb",
  "https://raw.githubusercontent.com/opensegra/ai-library/main/public/assets/base-female.glb",
];
const ALTURA_BASE_GLB_M = 1.766;
const MARGEN_INTERIOR_PRENDA = 0.945;

interface SliceBaseGLB {
  y: number;
  a: number;
  b: number;
  zMid: number;
}

/**
 * Perfil transversal medido directamente sobre la malla `Superhero_Female`
 * de `base-female.glb` en pose T de referencia (altura 1.766 m).
 */
const PERFIL_BASE_GLB: ReadonlyArray<SliceBaseGLB> = [
  { y: 1.48, a: 0.165, b: 0.072, zMid: -0.02 },
  { y: 1.4, a: 0.175, b: 0.112, zMid: -0.015 },
  { y: 1.29, a: 0.141, b: 0.124, zMid: 0.016 },
  { y: 1.2, a: 0.116, b: 0.094, zMid: 0.015 },
  { y: 1.09, a: 0.142, b: 0.092, zMid: -0.003 },
  { y: 0.95, a: 0.194, b: 0.118, zMid: -0.044 },
  { y: 0.85, a: 0.205, b: 0.111, zMid: -0.025 },
  { y: 0.72, a: 0.16, b: 0.095, zMid: -0.02 },
];

let cacheGltfPromise: Promise<GLTF | null> | null = null;

async function intentarCargarGLB(): Promise<GLTF | null> {
  const loader = new GLTFLoader();
  for (const url of URLS_MANIQUI_GLB) {
    try {
      return await loader.loadAsync(url);
    } catch {
      // Intenta el siguiente origen (local -> jsDelivr CDN -> GitHub raw)
    }
  }
  return null;
}

function cargarPlantillaGLB(): Promise<GLTF | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (!cacheGltfPromise) {
    cacheGltfPromise = intentarCargarGLB();
  }
  return cacheGltfPromise;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function evaluarSliceBaseGLB(y: number): SliceBaseGLB {
  if (y >= PERFIL_BASE_GLB[0].y) return PERFIL_BASE_GLB[0];
  const last = PERFIL_BASE_GLB[PERFIL_BASE_GLB.length - 1];
  if (y <= last.y) return last;

  for (let i = 0; i < PERFIL_BASE_GLB.length - 1; i++) {
    const s0 = PERFIL_BASE_GLB[i];
    const s1 = PERFIL_BASE_GLB[i + 1];
    if (y <= s0.y && y >= s1.y) {
      const f = clamp((s0.y - y) / Math.max(1e-5, s0.y - s1.y), 0, 1);
      return {
        y,
        a: THREE.MathUtils.lerp(s0.a, s1.a, f),
        b: THREE.MathUtils.lerp(s0.b, s1.b, f),
        zMid: THREE.MathUtils.lerp(s0.zMid, s1.zMid, f),
      };
    }
  }
  return last;
}

function rotarHuesoEnMundo(
  hueso: THREE.Object3D | undefined,
  ejeMundo: THREE.Vector3,
  anguloRad: number
): void {
  if (!hueso || !hueso.parent || Math.abs(anguloRad) < 1e-5) return;
  hueso.parent.updateMatrixWorld(true);
  const qParent = new THREE.Quaternion();
  hueso.parent.getWorldQuaternion(qParent);
  const qDelta = new THREE.Quaternion().setFromAxisAngle(ejeMundo, anguloRad);
  const qNueva = qParent
    .clone()
    .invert()
    .multiply(qDelta)
    .multiply(qParent)
    .multiply(hueso.quaternion);
  hueso.quaternion.copy(qNueva);
  hueso.updateMatrixWorld(true);
}

/**
 * Carga el modelo humano 3D esculpido (`base-female.glb`, licencia CC0),
 * calibra su esqueleto a las poses del probador y ajusta suavemente su torso
 * a las medidas corporales reales sin atravesar las prendas paramétricas.
 */
export async function cargarManiquiGLB(
  perfilInicial: PerfilCuerpo
): Promise<ManiquiInstancia | null> {
  const gltf = await cargarPlantillaGLB();
  if (!gltf) return null;

  const grupo = new THREE.Group();
  grupo.name = "maniqui-glb-esculpido";

  const modeloClonado = SkeletonUtils.clone(gltf.scene) as THREE.Group;
  modeloClonado.name = "maniqui-glb-armadura";
  grupo.add(modeloClonado);

  const acabadoIni = ACABADOS_MANIQUI.lino;
  const materialCuerpo = new THREE.MeshStandardMaterial({
    color: acabadoIni.cuerpo,
    roughness: Math.max(0.55, acabadoIni.roughnessCuerpo - 0.1),
    metalness: 0.04,
    side: THREE.FrontSide,
  });

  const materialDetalle = new THREE.MeshStandardMaterial({
    color: acabadoIni.articulacion,
    roughness: 0.45,
    metalness: 0.06,
    side: THREE.FrontSide,
  });

  const materialCinta = new THREE.MeshStandardMaterial({
    color: acabadoIni.cinta,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const grupoCintasHost = new THREE.Group();
  grupoCintasHost.name = "maniqui-glb-cintas-host";
  grupo.add(grupoCintasHost);

  const materialesSet = new Set<THREE.Material>([
    materialCuerpo,
    materialDetalle,
    materialCinta,
  ]);
  const texturasVacias = new Set<THREE.Texture>();

  let cuerpoGeometry: THREE.BufferGeometry | null = null;
  let baseBodyPositions: Float32Array | null = null;

  const huesosRest = new Map<
    string,
    { nodo: THREE.Object3D; q: THREE.Quaternion; p: THREE.Vector3 }
  >();

  modeloClonado.traverse((obj) => {
    if ((obj as THREE.Bone).isBone || obj.type === "Bone") {
      huesosRest.set(obj.name, {
        nodo: obj,
        q: obj.quaternion.clone(),
        p: obj.position.clone(),
      });
    }

    if (obj instanceof THREE.Mesh) {
      obj.geometry = obj.geometry.clone();
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;

      if (obj.name.toLowerCase().includes("eye")) {
        obj.material = materialDetalle;
      } else {
        obj.material = materialCuerpo;
        const posAttr = obj.geometry.getAttribute("position");
        if (posAttr && (!cuerpoGeometry || posAttr.count > 1500)) {
          cuerpoGeometry = obj.geometry;
          baseBodyPositions = new Float32Array(
            posAttr.array as ArrayLike<number>
          );
        }
      }
    }
  });

  let cintasVisible = false;
  let refGrupoCintas: THREE.Group | null = null;

  const EJE_X = new THREE.Vector3(1, 0, 0);
  const EJE_Y = new THREE.Vector3(0, 1, 0);
  const EJE_Z = new THREE.Vector3(0, 0, 1);

  const actualizar = (perfil: PerfilCuerpo) => {
    const escalaAltura = clamp(perfil.alturaTotalM / ALTURA_BASE_GLB_M, 0.52, 1.3);
    modeloClonado.scale.setScalar(escalaAltura);
    // Eleva mínimamente para apoyar talones/suelas sobre y = 0
    modeloClonado.position.set(0, 0.0084 * escalaAltura, 0);

    // 1. Morfología radial suave del torso/cadera para encajar dentro de la prenda sin colisiones
    if (cuerpoGeometry && baseBodyPositions) {
      const posAttr = cuerpoGeometry.getAttribute("position") as THREE.BufferAttribute;
      const count = posAttr.count;

      for (let i = 0; i < count; i++) {
        const bx = baseBodyPositions[i * 3];
        const by = baseBodyPositions[i * 3 + 1];
        const bz = baseBodyPositions[i * 3 + 2];

        // Solo el bloque de torso/pelvis/cintura; los brazos en T (|bx| > 0.215) quedan intactos
        const pesoY =
          smoothstep(0.7, 0.84, by) * (1 - smoothstep(1.38, 1.48, by));
        const pesoX = 1 - smoothstep(0.165, 0.215, Math.abs(bx));
        const pesoTorso = pesoY * pesoX;

        if (pesoTorso <= 0.001) {
          posAttr.setXYZ(i, bx, by, bz);
          continue;
        }

        const sliceBase = evaluarSliceBaseGLB(by);
        const worldY = by * escalaAltura;
        const target = evaluarPerfilEnY(perfil.anillosInterpolados, worldY);

        const targetABind = (target.a * MARGEN_INTERIOR_PRENDA) / escalaAltura;
        const targetBBind = (target.b * MARGEN_INTERIOR_PRENDA) / escalaAltura;
        const targetDzBind = target.desplazamientoZ / escalaAltura;

        const rx = targetABind / Math.max(0.04, sliceBase.a);
        const rz = targetBBind / Math.max(0.04, sliceBase.b);

        const fx = bx * rx;
        const fz = targetDzBind + (bz - sliceBase.zMid) * rz;

        posAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(bx, fx, pesoTorso),
          by,
          THREE.MathUtils.lerp(bz, fz, pesoTorso)
        );
      }

      posAttr.needsUpdate = true;
      cuerpoGeometry.computeVertexNormals();
    }

    // 2. Restaurar pose T de referencia y aplicar pose articulada en espacio mundial
    for (const entry of huesosRest.values()) {
      entry.nodo.quaternion.copy(entry.q);
      entry.nodo.position.copy(entry.p);
    }
    modeloClonado.updateMatrixWorld(true);

    const { pose } = perfil.trayectorias;
    const esPasarela = pose.nombre === "pose_pasarela";
    const angBrazoDesdeVerticalDeg = clamp(pose.anguloBrazoDeg, 16, 52);
    const bajarBrazoDeg = 90 - angBrazoDesdeVerticalDeg;
    const codoFlexDeg = clamp(pose.flexionCodoDeg, 4, 24);
    const inclCaderaDeg = esPasarela ? 4.5 : 0;
    const angPasoDeg = esPasarela ? 9.5 : 0;
    const rotPieDeg = clamp(pose.rotacionPieDeg, 0, 18);

    const pelvis = huesosRest.get("pelvis")?.nodo;
    const spine01 = huesosRest.get("spine_01")?.nodo;
    const spine02 = huesosRest.get("spine_02")?.nodo;
    const head = huesosRest.get("Head")?.nodo;
    const upperArmL = huesosRest.get("upperarm_l")?.nodo;
    const upperArmR = huesosRest.get("upperarm_r")?.nodo;
    const lowerArmL = huesosRest.get("lowerarm_l")?.nodo;
    const lowerArmR = huesosRest.get("lowerarm_r")?.nodo;
    const thighL = huesosRest.get("thigh_l")?.nodo;
    const thighR = huesosRest.get("thigh_r")?.nodo;
    const calfL = huesosRest.get("calf_l")?.nodo;
    const calfR = huesosRest.get("calf_r")?.nodo;

    const footL = huesosRest.get("foot_l")?.nodo;
    const footR = huesosRest.get("foot_r")?.nodo;

    // Postura de pasarela / cadera y piernas
    if (Math.abs(inclCaderaDeg) > 0.2) {
      rotarHuesoEnMundo(pelvis, EJE_Z, THREE.MathUtils.degToRad(inclCaderaDeg * 0.7));
      rotarHuesoEnMundo(spine01, EJE_Z, THREE.MathUtils.degToRad(-inclCaderaDeg * 0.35));
      rotarHuesoEnMundo(spine02, EJE_Z, THREE.MathUtils.degToRad(-inclCaderaDeg * 0.25));
      rotarHuesoEnMundo(head, EJE_Y, THREE.MathUtils.degToRad(-3));
    }

    if (angPasoDeg > 0.5) {
      rotarHuesoEnMundo(thighL, EJE_X, THREE.MathUtils.degToRad(-angPasoDeg));
      rotarHuesoEnMundo(calfL, EJE_X, THREE.MathUtils.degToRad(angPasoDeg * 0.85));
      rotarHuesoEnMundo(thighR, EJE_X, THREE.MathUtils.degToRad(angPasoDeg * 0.7));
      rotarHuesoEnMundo(calfR, EJE_X, THREE.MathUtils.degToRad(angPasoDeg * 0.55));
    } else {
      // Ligera apertura natural de piernas en pose A estable
      const aperturaDeg = clamp(pose.factorSeparacionPiesCadera * 4.5, 1.5, 4);
      rotarHuesoEnMundo(thighL, EJE_Z, THREE.MathUtils.degToRad(aperturaDeg));
      rotarHuesoEnMundo(thighR, EJE_Z, THREE.MathUtils.degToRad(-aperturaDeg));
    }

    if (rotPieDeg > 0.2) {
      rotarHuesoEnMundo(footL, EJE_Y, THREE.MathUtils.degToRad(rotPieDeg * 0.6));
      rotarHuesoEnMundo(footR, EJE_Y, THREE.MathUtils.degToRad(-rotPieDeg * 0.6));
    }

    // Bajar brazos desde T-pose al ángulo deseado y doblar suavemente codos hacia adelante
    rotarHuesoEnMundo(upperArmL, EJE_Z, THREE.MathUtils.degToRad(-bajarBrazoDeg));
    rotarHuesoEnMundo(upperArmR, EJE_Z, THREE.MathUtils.degToRad(bajarBrazoDeg));
    rotarHuesoEnMundo(lowerArmL, EJE_Y, THREE.MathUtils.degToRad(-codoFlexDeg));
    rotarHuesoEnMundo(lowerArmR, EJE_Y, THREE.MathUtils.degToRad(codoFlexDeg));

    // 3. Actualizar cintas guía anatómicas (busto/cintura/cadera)
    while (grupoCintasHost.children.length > 0) {
      const hijo = grupoCintasHost.children[0];
      grupoCintasHost.remove(hijo);
      disposeObject(hijo, {
        preservarMateriales: materialesSet,
        preservarTexturas: texturasVacias,
      });
    }
    const cintas = crearGrupoCintasModisteria(perfil, materialCinta);
    cintas.visible = cintasVisible;
    refGrupoCintas = cintas;
    grupoCintasHost.add(cintas);
  };

  actualizar(perfilInicial);

  return {
    grupo,
    materialesCompartidos: [materialCuerpo, materialDetalle, materialCinta],
    texturasCompartidas: [],
    actualizar,
    aplicarAcabado(acabado: AcabadoManiqui3D) {
      const cfg = ACABADOS_MANIQUI[acabado] ?? ACABADOS_MANIQUI.lino;
      materialCuerpo.color.setHex(cfg.cuerpo);
      materialCuerpo.roughness = Math.max(0.55, cfg.roughnessCuerpo - 0.1);
      materialDetalle.color.setHex(cfg.articulacion);
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
