import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import {
  calcularPerimetroElipseM,
  evaluarPerfilEnY,
  interpolarAnillosTorso,
} from "./bodyProfile";
import { disposeObject } from "./disposal";
import {
  ACABADOS_MANIQUI,
  crearGrupoCintasModisteria,
  ManiquiInstancia,
} from "./mannequinBuilder";
import {
  AcabadoManiqui3D,
  AnilloPerfil,
  EnvolventeTorso3D,
  NombreSeccionAnatomica,
  PerfilCuerpo,
  TrayectoriaBrazo3D,
  TrayectoriaPierna3D,
} from "./types";

const URLS_MANIQUI_GLB: readonly string[] = [
  "/models/base-female.glb",
  "https://cdn.jsdelivr.net/gh/opensegra/ai-library@main/public/assets/base-female.glb",
  "https://raw.githubusercontent.com/opensegra/ai-library/main/public/assets/base-female.glb",
];
const ALTURA_BASE_GLB_M = 1.766;
const Y_BASE_PISO_GLB = 0.0084;
const MARGEN_INTERIOR_PRENDA = 0.925;

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
  { y: 1.48, a: 0.167, b: 0.068, zMid: -0.048 },
  { y: 1.41, a: 0.176, b: 0.109, zMid: -0.022 },
  { y: 1.31, a: 0.148, b: 0.128, zMid: 0.012 },
  { y: 1.24, a: 0.131, b: 0.101, zMid: 0.014 },
  { y: 1.18, a: 0.112, b: 0.089, zMid: 0.017 },
  { y: 1.05, a: 0.161, b: 0.111, zMid: -0.022 },
  { y: 0.94, a: 0.194, b: 0.12, zMid: -0.043 },
  { y: 0.85, a: 0.205, b: 0.111, zMid: -0.025 },
  { y: 0.74, a: 0.201, b: 0.092, zMid: -0.019 },
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
  return construirManiquiDesdeGLTF(gltf, perfilInicial);
}

/**
 * Construye la instancia articulada y morfeable del maniquí a partir de un `GLTF` ya cargado.
 */
export function construirManiquiDesdeGLTF(
  gltf: GLTF,
  perfilInicial: PerfilCuerpo
): ManiquiInstancia {

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

  let cuerpoMesh: THREE.SkinnedMesh | null = null;
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

    if (obj instanceof THREE.Mesh || (obj as THREE.Mesh).isMesh) {
      const meshObj = obj as THREE.Mesh;
      meshObj.geometry = meshObj.geometry.clone();
      meshObj.castShadow = true;
      meshObj.receiveShadow = true;
      meshObj.frustumCulled = false;

      if (meshObj.name.toLowerCase().includes("eye")) {
        meshObj.material = materialDetalle;
      } else {
        meshObj.material = materialCuerpo;
        const posAttr = meshObj.geometry.getAttribute("position");
        if (posAttr && (!cuerpoGeometry || posAttr.count > 1500)) {
          cuerpoMesh = meshObj as THREE.SkinnedMesh;
          cuerpoGeometry = meshObj.geometry;
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

  const aplicarPoseEnHuesos = (perfil: PerfilCuerpo): number => {
    const escalaAltura = clamp(perfil.alturaTotalM / ALTURA_BASE_GLB_M, 0.52, 1.3);
    modeloClonado.scale.setScalar(escalaAltura);
    // Eleva mínimamente para apoyar talones/suelas sobre y = 0
    modeloClonado.position.set(0, Y_BASE_PISO_GLB * escalaAltura, 0);

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
      const aperturaDeg = clamp(pose.factorSeparacionPiesCadera * 4.5, 1.5, 4);
      rotarHuesoEnMundo(thighL, EJE_Z, THREE.MathUtils.degToRad(aperturaDeg));
      rotarHuesoEnMundo(thighR, EJE_Z, THREE.MathUtils.degToRad(-aperturaDeg));
    }

    if (rotPieDeg > 0.2) {
      rotarHuesoEnMundo(footL, EJE_Y, THREE.MathUtils.degToRad(rotPieDeg * 0.6));
      rotarHuesoEnMundo(footR, EJE_Y, THREE.MathUtils.degToRad(-rotPieDeg * 0.6));
    }

    rotarHuesoEnMundo(upperArmL, EJE_Z, THREE.MathUtils.degToRad(-bajarBrazoDeg));
    rotarHuesoEnMundo(upperArmR, EJE_Z, THREE.MathUtils.degToRad(bajarBrazoDeg));
    rotarHuesoEnMundo(lowerArmL, EJE_Y, THREE.MathUtils.degToRad(-codoFlexDeg));
    rotarHuesoEnMundo(lowerArmR, EJE_Y, THREE.MathUtils.degToRad(codoFlexDeg));

    modeloClonado.updateMatrixWorld(true);
    return escalaAltura;
  };

  /**
   * Extrae una grilla cilíndrica `(y, θ)` con el radio máximo real de la malla posada y deformada
   * (torso, senos, clavículas, hombros, pelvis y muslos superiores, excluyendo brazos colgantes),
   * para garantizar 0 intersecciones al construir cualquier prenda.
   */
  const extraerEnvolventeCuerpo = (perfil: PerfilCuerpo): EnvolventeTorso3D | undefined => {
    if (!cuerpoMesh || !cuerpoGeometry || !baseBodyPositions) return undefined;
    const posAttr = cuerpoGeometry.getAttribute("position");
    const skinIdxAttr = cuerpoGeometry.getAttribute("skinIndex");
    const skinWAttr = cuerpoGeometry.getAttribute("skinWeight");
    const skeleton = cuerpoMesh.skeleton;
    if (!posAttr || !skinIdxAttr || !skinWAttr || !skeleton) return undefined;

    grupo.updateMatrixWorld(true);
    skeleton.update();
    const invGrupo = grupo.matrixWorld.clone().invert();
    const meshToGrupo = invGrupo.clone().multiply(cuerpoMesh.matrixWorld);

    const rows = 56;
    const cols = 72;
    const yMinM = Math.max(0.08, perfil.alturaTobilloM + 0.04);
    const yMaxM = perfil.cuelloYM + 0.025;
    const ySpan = Math.max(1e-4, yMaxM - yMinM);
    const radiosMaxM = new Float32Array(rows * cols);
    const centrosZM = new Float32Array(rows);

    for (let r = 0; r < rows; r++) {
      const yRow = yMinM + (r / (rows - 1)) * ySpan;
      const yEval = clamp(yRow, perfil.musloYM, perfil.cuelloYM);
      centrosZM[r] = evaluarPerfilEnY(perfil.anillosInterpolados, yEval).desplazamientoZ;
    }

    const bones = skeleton.bones;
    const count = posAttr.count;
    const posedXYZ = new Float32Array(count * 3);
    const incluir = new Uint8Array(count);
    const vTmp = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const bx = baseBodyPositions[i * 3];
      const by = baseBodyPositions[i * 3 + 1];

      let wArmOrHand = 0;
      let wUpperArm = 0;
      let wHead = 0;
      for (let k = 0; k < 4; k++) {
        const w = skinWAttr.getComponent(i, k);
        if (w <= 0.01) continue;
        const bName = bones[skinIdxAttr.getComponent(i, k)]?.name ?? "";
        if (bName.startsWith("upperarm")) {
          wUpperArm += w;
        } else if (
          bName.startsWith("lowerarm") ||
          bName.startsWith("hand") ||
          bName.startsWith("index") ||
          bName.startsWith("middle") ||
          bName.startsWith("ring") ||
          bName.startsWith("pinky") ||
          bName.startsWith("thumb")
        ) {
          wArmOrHand += w;
        } else if (bName === "Head") {
          wHead += w;
        }
      }

      const esDanglingArm =
        wArmOrHand > 0.25 ||
        (wUpperArm > 0.3 && (Math.abs(bx) > 0.168 || by < 1.33));
      const ok = !esDanglingArm && wHead < 0.45 && by < 1.495;
      incluir[i] = ok ? 1 : 0;
      if (!ok) continue;

      vTmp.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (cuerpoMesh.isSkinnedMesh) {
        cuerpoMesh.applyBoneTransform(i, vTmp);
      }
      vTmp.applyMatrix4(meshToGrupo);
      posedXYZ[i * 3] = vTmp.x;
      posedXYZ[i * 3 + 1] = vTmp.y;
      posedXYZ[i * 3 + 2] = vTmp.z;
    }

    const depositarPunto = (px: number, py: number, pz: number) => {
      if (py < yMinM - 0.01 || py > yMaxM + 0.01) return;
      const tY = clamp((py - yMinM) / ySpan, 0, 1);
      const rFloat = tY * (rows - 1);
      const r0 = Math.floor(rFloat);
      const r1 = Math.min(rows - 1, r0 + 1);
      const dz =
        centrosZM[r0] + (centrosZM[r1] - centrosZM[r0]) * (rFloat - r0);
      const rad = Math.hypot(px, pz - dz);
      const th = Math.atan2(px, pz - dz);
      const tTh = (th + Math.PI) / (Math.PI * 2);
      const cFloat = tTh * cols;
      const c0 = ((Math.floor(cFloat) % cols) + cols) % cols;
      const c1 = (c0 + 1) % cols;

      const rowsTouch = r0 === r1 ? [r0] : [r0, r1];
      const colsTouch = [c0, c1];
      for (const rr of rowsTouch) {
        for (const cc of colsTouch) {
          const idx = rr * cols + cc;
          if (rad > radiosMaxM[idx]) radiosMaxM[idx] = rad;
        }
      }
    };

    const indexAttr = cuerpoGeometry.getIndex();
    if (indexAttr) {
      const idxArr = indexAttr.array;
      for (let t = 0; t < idxArr.length; t += 3) {
        const ia = idxArr[t];
        const ib = idxArr[t + 1];
        const ic = idxArr[t + 2];
        if (!incluir[ia] || !incluir[ib] || !incluir[ic]) continue;

        const ax = posedXYZ[ia * 3], ay = posedXYZ[ia * 3 + 1], az = posedXYZ[ia * 3 + 2];
        const bx = posedXYZ[ib * 3], by = posedXYZ[ib * 3 + 1], bz = posedXYZ[ib * 3 + 2];
        const cx = posedXYZ[ic * 3], cy = posedXYZ[ic * 3 + 1], cz = posedXYZ[ic * 3 + 2];

        const minYTri = Math.min(ay, by, cy);
        const maxYTri = Math.max(ay, by, cy);
        if (maxYTri < yMinM - 0.01 || minYTri > yMaxM + 0.01) continue;

        depositarPunto(ax, ay, az);
        depositarPunto(bx, by, bz);
        depositarPunto(cx, cy, cz);
        depositarPunto((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
        depositarPunto((bx + cx) * 0.5, (by + cy) * 0.5, (bz + cz) * 0.5);
        depositarPunto((cx + ax) * 0.5, (cy + ay) * 0.5, (cz + az) * 0.5);
        depositarPunto((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
      }
    } else {
      for (let i = 0; i < count; i++) {
        if (!incluir[i]) continue;
        depositarPunto(posedXYZ[i * 3], posedXYZ[i * 3 + 1], posedXYZ[i * 3 + 2]);
      }
    }

    // Dilatación morfológica mínima 3x3 para evitar huecos entre celdas vecinas
    const dilated = new Float32Array(radiosMaxM);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let best = radiosMaxM[r * cols + c];
        for (let dr = -1; dr <= 1; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const cc = (c + dc + cols) % cols;
            const neighbor = radiosMaxM[rr * cols + cc] * (dr === 0 && dc === 0 ? 1 : 0.992);
            if (neighbor > best) best = neighbor;
          }
        }
        dilated[r * cols + c] = best;
      }
    }

    return { yMinM, yMaxM, rows, cols, radiosMaxM: dilated, centrosZM };
  };

  const actualizar = (perfil: PerfilCuerpo) => {
    const escalaAltura = aplicarPoseEnHuesos(perfil);

    // 1. Morfología radial suave del torso/cadera/clavículas para encajar dentro de la prenda
    if (cuerpoGeometry && baseBodyPositions) {
      const posAttr = cuerpoGeometry.getAttribute("position") as THREE.BufferAttribute;
      const count = posAttr.count;

      for (let i = 0; i < count; i++) {
        const bx = baseBodyPositions[i * 3];
        const by = baseBodyPositions[i * 3 + 1];
        const bz = baseBodyPositions[i * 3 + 2];

        // Cubre todo el torso incluyendo parte alta de pecho y clavículas (1.38..1.47 m)
        const pesoY =
          smoothstep(0.66, 0.80, by) * (1 - smoothstep(1.44, 1.505, by));
        const enZonaBrazos = smoothstep(1.28, 1.35, by);
        const pesoX = 1 - enZonaBrazos * smoothstep(0.165, 0.215, Math.abs(bx));
        const pesoTorso = pesoY * pesoX;

        if (pesoTorso <= 0.001) {
          posAttr.setXYZ(i, bx, by, bz);
          continue;
        }

        const sliceBase = evaluarSliceBaseGLB(by);
        const worldY = (by + Y_BASE_PISO_GLB) * escalaAltura;
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

    perfil.envolventeCuerpo = extraerEnvolventeCuerpo(perfil);

    // 2. Actualizar cintas guía anatómicas (busto/cintura/cadera)
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

  /**
   * Calibra alturas clave, curvatura espinal y trayectorias óseas de brazos/piernas
   * al maniquí `base-female.glb` posado para que todas las prendas ajusten sin perforaciones.
   */
  const calibrarPerfilPrenda = (perfilBase: PerfilCuerpo): PerfilCuerpo => {
    const s = aplicarPoseEnHuesos(perfilBase);
    grupo.updateMatrixWorld(true);
    const invGrupo = grupo.matrixWorld.clone().invert();
    const tmp = new THREE.Vector3();

    const posBoneGrupo = (nombre: string): [number, number, number] | null => {
      const hueso = huesosRest.get(nombre)?.nodo;
      if (!hueso) return null;
      hueso.getWorldPosition(tmp);
      tmp.applyMatrix4(invGrupo);
      return [tmp.x, tmp.y, tmp.z];
    };

    const crearAnilloCalibrado = (
      nombre: NombreSeccionAnatomica,
      yBind: number,
      aMinBind: number,
      bMinBind: number,
      dzBind: number
    ): AnilloPerfil => {
      const base = perfilBase.anillosClave[nombre];
      const a = Math.max(base.a, aMinBind * s);
      const b = Math.max(base.b, bMinBind * s);
      return {
        y: (yBind + Y_BASE_PISO_GLB) * s,
        a,
        b,
        desplazamientoZ: dzBind * s,
        perimetroObjetivoCm: Number((calcularPerimetroElipseM(a, b) * 100).toFixed(2)),
      };
    };

    const cuello = crearAnilloCalibrado("cuello", 1.485, 0.068, 0.064, -0.044);
    const hombros = crearAnilloCalibrado("hombros", 1.418, 0.166, 0.106, -0.022);
    const busto = crearAnilloCalibrado("busto", 1.308, 0.105, 0.088, 0.012);
    const bajoBusto = crearAnilloCalibrado("bajoBusto", 1.235, 0.092, 0.072, 0.014);
    const cintura = crearAnilloCalibrado("cintura", 1.18, 0.085, 0.066, 0.017);
    const caderaAlta = crearAnilloCalibrado("caderaAlta", 1.048, 0.115, 0.082, -0.022);
    const cadera = crearAnilloCalibrado("cadera", 0.935, 0.135, 0.088, -0.042);
    const muslo = crearAnilloCalibrado("muslo", 0.665, 0.196, 0.096, -0.02);

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
    const anillosInterpolados = interpolarAnillosTorso([
      cuello,
      hombros,
      busto,
      bajoBusto,
      cintura,
      caderaAlta,
      cadera,
      muslo,
    ]);

    const construirBrazoDesdeGLB = (lado: -1 | 1): TrayectoriaBrazo3D => {
      const suf = lado < 0 ? "r" : "l";
      const base =
        lado < 0 ? perfilBase.trayectorias.brazoIzq : perfilBase.trayectorias.brazoDer;
      const hombro = posBoneGrupo(`upperarm_${suf}`) ?? base.hombro;
      const codo = posBoneGrupo(`lowerarm_${suf}`) ?? base.codo;
      const muneca = posBoneGrupo(`hand_${suf}`) ?? base.muneca;

      const dirMano = new THREE.Vector3(
        muneca[0] - codo[0],
        muneca[1] - codo[1],
        muneca[2] - codo[2]
      );
      if (dirMano.lengthSq() > 1e-6) {
        dirMano.normalize().multiplyScalar(base.largoManoM);
      } else {
        dirMano.set(0, -base.largoManoM, 0);
      }

      return {
        lado,
        hombro,
        codo,
        muneca,
        manoFin: [
          muneca[0] + dirMano.x,
          muneca[1] + dirMano.y,
          muneca[2] + dirMano.z,
        ],
        radioHombroM: Math.max(base.radioHombroM, 0.052 * s),
        radioCodoM: Math.max(base.radioCodoM, 0.044 * s),
        radioMunecaM: Math.max(base.radioMunecaM, 0.036 * s),
        largoManoM: base.largoManoM,
      };
    };

    const construirPiernaDesdeGLB = (lado: -1 | 1): TrayectoriaPierna3D => {
      const suf = lado < 0 ? "r" : "l";
      const base =
        lado < 0 ? perfilBase.trayectorias.piernaIzq : perfilBase.trayectorias.piernaDer;
      const thigh = posBoneGrupo(`thigh_${suf}`);
      const calf = posBoneGrupo(`calf_${suf}`);
      const foot = posBoneGrupo(`foot_${suf}`);

      if (!thigh || !calf || !foot) {
        return base;
      }

      const vThigh = new THREE.Vector3(...thigh);
      const vCalf = new THREE.Vector3(...calf);
      const vFoot = new THREE.Vector3(...foot);

      const vCadera = vThigh.clone().lerp(vCalf, 0.16);
      vCadera.z += 0.028 * s;

      const vMusloAlto = vThigh.clone().lerp(vCalf, 0.42);
      vMusloAlto.z += 0.018 * s;

      const vRodilla = vCalf.clone();
      vRodilla.z -= 0.018 * s;

      const vTobillo = vFoot.clone();
      vTobillo.y += 0.045 * s;
      vTobillo.z -= 0.008 * s;

      return {
        lado,
        cadera: [vCadera.x, vCadera.y, vCadera.z],
        musloAlto: [vMusloAlto.x, vMusloAlto.y, vMusloAlto.z],
        rodilla: [vRodilla.x, vRodilla.y, vRodilla.z],
        tobillo: [vTobillo.x, vTobillo.y, vTobillo.z],
        piePunta: [vTobillo.x + lado * 0.015 * s, 0.014 * s, vTobillo.z + base.largoPieM * 0.8],
        radioCaderaM: Math.max(base.radioCaderaM, 0.094 * s),
        radioMusloM: Math.max(base.radioMusloM, 0.096 * s),
        radioRodillaM: Math.max(base.radioRodillaM, 0.065 * s),
        radioTobilloM: Math.max(base.radioTobilloM, 0.042 * s),
        largoPieM: base.largoPieM,
        desplazamientoPantorrillaZM: -0.028 * s,
      };
    };

    const armL = construirBrazoDesdeGLB(-1);
    const armR = construirBrazoDesdeGLB(1);
    const piernaIzq = construirPiernaDesdeGLB(-1);
    const piernaDer = construirPiernaDesdeGLB(1);
    const headPos = posBoneGrupo("Head");

    const alturaRodillaM = (piernaIzq.rodilla[1] + piernaDer.rodilla[1]) * 0.5;
    const alturaTobilloM = (piernaIzq.tobillo[1] + piernaDer.tobillo[1]) * 0.5;
    const alturaTiroM = clamp(
      cintura.y - (0.69 + Y_BASE_PISO_GLB) * s,
      0.24 * s,
      Math.max(0.28 * s, cintura.y - muslo.y - 0.015)
    );

    return {
      ...perfilBase,
      anillosClave,
      anillosInterpolados,
      alturaTiroM,
      alturaRodillaM,
      alturaTobilloM,
      cuelloYM: cuello.y,
      hombroYM: hombros.y,
      bustoYM: busto.y,
      cinturaYM: cintura.y,
      caderaYM: cadera.y,
      musloYM: muslo.y,
      trayectorias: {
        ...perfilBase.trayectorias,
        alturaCabezaM: (ALTURA_BASE_GLB_M + Y_BASE_PISO_GLB) * s,
        centroCabeza: headPos
          ? [headPos[0], headPos[1] + 0.112 * s, headPos[2] + 0.018 * s]
          : perfilBase.trayectorias.centroCabeza,
        radioCabezaX: Math.max(perfilBase.trayectorias.radioCabezaX, 0.095 * s),
        radioCabezaY: Math.max(perfilBase.trayectorias.radioCabezaY, 0.105 * s),
        radioCabezaZ: Math.max(perfilBase.trayectorias.radioCabezaZ, 0.108 * s),
        brazoIzq: armL,
        brazoDer: armR,
        piernaIzq,
        piernaDer,
      },
    };
  };

  const perfilInicialCalibrado = calibrarPerfilPrenda(perfilInicial);
  actualizar(perfilInicialCalibrado);

  return {
    grupo,
    materialesCompartidos: [materialCuerpo, materialDetalle, materialCinta],
    texturasCompartidas: [],
    actualizar,
    calibrarPerfilPrenda,
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