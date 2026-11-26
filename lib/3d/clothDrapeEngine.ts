import * as THREE from "three";
import { ConfigPrenda, PerfilCuerpo, TipoTela, TrayectoriaBrazo3D, cmAMetros } from "./types";
import { evaluarPerfilEnY } from "./bodyProfile";

export interface ClothDrapeConfig {
  bendingStiffness: number;
  stretchStiffness: number;
  drapeDepth: number;
  gravityPull: number;
  foldHarmonics: [number, number, number];
  aoIntensity: number;
  iterations: number;
}

export const CLOTH_DRAPE_PARAMS: Record<TipoTela, ClothDrapeConfig> = {
  seda: {
    bendingStiffness: 0.14,
    stretchStiffness: 0.88,
    drapeDepth: 1.28,
    gravityPull: 0.0042,
    foldHarmonics: [9, 14, 21],
    aoIntensity: 0.36,
    iterations: 16,
  },
  crepe: {
    bendingStiffness: 0.34,
    stretchStiffness: 0.90,
    drapeDepth: 0.96,
    gravityPull: 0.0032,
    foldHarmonics: [7, 11, 17],
    aoIntensity: 0.34,
    iterations: 14,
  },
  lino: {
    bendingStiffness: 0.68,
    stretchStiffness: 0.96,
    drapeDepth: 0.74,
    gravityPull: 0.0020,
    foldHarmonics: [5, 8, 13],
    aoIntensity: 0.38,
    iterations: 12,
  },
  licra: {
    bendingStiffness: 0.52,
    stretchStiffness: 0.98,
    drapeDepth: 0.28,
    gravityPull: 0.0006,
    foldHarmonics: [6, 12, 18],
    aoIntensity: 0.28,
    iterations: 10,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic multi-harmonic cloth fold generator so folds break tube symmetry
 * without random flicker across re-renders.
 */
function foldNoise(theta: number, u: number, harmonics: [number, number, number], seedOffset = 0): number {
  const [h1, h2, h3] = harmonics;
  const f1 = Math.sin(h1 * theta + 0.45 + u * 1.4 + seedOffset);
  const f2 = 0.56 * Math.sin(h2 * theta - 1.15 - u * 1.9 + seedOffset * 1.7);
  const f3 = 0.28 * Math.cos(h3 * theta + 2.3 + u * 2.6 - seedOffset);
  return (f1 + f2 + f3) / 1.84;
}

export interface GridClothDrapeParams {
  pos: Float32Array | number[];
  rows: number;
  cols: number;
  wrapHorizontally: boolean;
  drapeConfig: ClothDrapeConfig;
  pinWeights: Float32Array;
  gravityWeights: Float32Array;
  projectCollision?: (
    x: number,
    y: number,
    z: number,
    r: number,
    s: number
  ) => { x: number; y: number; z: number };
}

/**
 * Fast XPBD-style grid cloth relaxation with structural, shear, and 2-ring bending constraints
 * plus continuous mannequin collision projection. Runs in <10 ms per garment piece.
 */
export function solveGridClothDrape(params: GridClothDrapeParams): void {
  const {
    pos,
    rows,
    cols,
    wrapHorizontally,
    drapeConfig,
    pinWeights,
    gravityWeights,
    projectCollision,
  } = params;

  const totalVerts = rows * cols;
  if (totalVerts < 4) return;

  const restPos = new Float32Array(totalVerts * 3);
  for (let i = 0; i < totalVerts * 3; i++) {
    restPos[i] = pos[i];
  }

  // Build structural + shear + bending constraint pairs [idxA, idxB, restLen, stiffness]
  const pairA: number[] = [];
  const pairB: number[] = [];
  const restLens: number[] = [];
  const pairStiff: number[] = [];

  const addPair = (ia: number, ib: number, stiff: number) => {
    const ax = pos[ia * 3];
    const ay = pos[ia * 3 + 1];
    const az = pos[ia * 3 + 2];
    const bx = pos[ib * 3];
    const by = pos[ib * 3 + 1];
    const bz = pos[ib * 3 + 2];
    const d = Math.hypot(bx - ax, by - ay, bz - az);
    if (d > 1e-5) {
      pairA.push(ia);
      pairB.push(ib);
      restLens.push(d);
      pairStiff.push(stiff);
    }
  };

  const sMax = wrapHorizontally ? cols - 1 : cols;
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < sMax; s++) {
      const idx = r * cols + s;
      // Horizontal structural
      if (s + 1 < cols) {
        addPair(idx, r * cols + (s + 1), drapeConfig.stretchStiffness);
      }
      // Vertical structural
      if (r + 1 < rows) {
        addPair(idx, (r + 1) * cols + s, drapeConfig.stretchStiffness);
      }
      // Diagonal shear
      if (r + 1 < rows && s + 1 < cols) {
        addPair(idx, (r + 1) * cols + (s + 1), drapeConfig.stretchStiffness * 0.7);
      }
      // 2-ring horizontal & vertical bending
      if (s + 2 < sMax) {
        addPair(idx, r * cols + (s + 2), drapeConfig.bendingStiffness);
      }
      if (r + 2 < rows) {
        addPair(idx, (r + 2) * cols + s, drapeConfig.bendingStiffness);
      }
    }
  }

  const invIters = 1 / Math.max(1, drapeConfig.iterations);
  const gStep = drapeConfig.gravityPull * invIters * 1.35;
  const maxAnchorPull = 0.14;

  for (let iter = 0; iter < drapeConfig.iterations; iter++) {
    // 1. Apply gentle downward gravity + rest anchor keeping silhouette true to pattern
    for (let r = 0; r < rows; r++) {
      for (let s = 0; s < sMax; s++) {
        const idx = r * cols + s;
        const pin = clamp(pinWeights[idx] ?? 0, 0, 1);
        if (pin >= 0.999) continue;

        const gW = gravityWeights[idx] ?? 0;
        const i3 = idx * 3;
        const invPin = 1 - pin;
        pos[i3 + 1] -= gStep * gW * invPin;

        // Soft shape-retention tether so cloth relaxes into folds without sagging into space
        const anchorT = (0.04 + pin * maxAnchorPull) * invIters * 4;
        pos[i3] += (restPos[i3] - pos[i3]) * anchorT;
        pos[i3 + 1] += (restPos[i3 + 1] - pos[i3 + 1]) * (anchorT * 0.45);
        pos[i3 + 2] += (restPos[i3 + 2] - pos[i3 + 2]) * anchorT;
      }
    }

    // 2. Constraint projection pass
    for (let k = 0; k < pairA.length; k++) {
      const ia = pairA[k];
      const ib = pairB[k];
      const pa = clamp(pinWeights[ia] ?? 0, 0, 1);
      const pb = clamp(pinWeights[ib] ?? 0, 0, 1);
      const wa = 1 - pa;
      const wb = 1 - pb;
      const wSum = wa + wb;
      if (wSum <= 1e-5) continue;

      const i3a = ia * 3;
      const i3b = ib * 3;
      const dx = pos[i3b] - pos[i3a];
      const dy = pos[i3b + 1] - pos[i3a + 1];
      const dz = pos[i3b + 2] - pos[i3a + 2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1e-6) continue;

      const corr = ((dist - restLens[k]) / dist) * pairStiff[k] * 0.45;
      const cx = dx * corr;
      const cy = dy * corr;
      const cz = dz * corr;

      const fa = wa / wSum;
      const fb = wb / wSum;
      pos[i3a] += cx * fa;
      pos[i3a + 1] += cy * fa;
      pos[i3a + 2] += cz * fa;
      pos[i3b] -= cx * fb;
      pos[i3b + 1] -= cy * fb;
      pos[i3b + 2] -= cz * fb;
    }

    // 3. Synchronize wrapped UV seam & enforce mannequin collision
    if (projectCollision || wrapHorizontally) {
      for (let r = 0; r < rows; r++) {
        if (projectCollision) {
          for (let s = 0; s < sMax; s++) {
            const idx = r * cols + s;
            const i3 = idx * 3;
            const safe = projectCollision(pos[i3], pos[i3 + 1], pos[i3 + 2], r, s);
            pos[i3] = safe.x;
            pos[i3 + 1] = safe.y;
            pos[i3 + 2] = safe.z;
          }
        }
        if (wrapHorizontally) {
          const i0 = r * cols * 3;
          const iLast = (r * cols + (cols - 1)) * 3;
          pos[iLast] = pos[i0];
          pos[iLast + 1] = pos[i0 + 1];
          pos[iLast + 2] = pos[i0 + 2];
        }
      }
    }
  }
}

/**
 * Sculpts anatomical bust domes + sternum fabric bridge + under-bust vertical drape
 * + dorsal spine contour & underarm tension folds directly onto the bodice grid,
 * followed by XPBD cloth relaxation.
 */
export function applyTorsoAnatomicalSculptAndDrape(params: {
  positions: number[];
  rows: number;
  cols: number;
  perfil: PerfilCuerpo;
  config: ConfigPrenda;
  tela: TipoTela;
  projectTorsoSafe: (
    x: number,
    y: number,
    z: number
  ) => { x: number; y: number; z: number };
}): void {
  const { positions, rows, cols, perfil, config, tela, projectTorsoSafe } = params;
  const drapeCfg = CLOTH_DRAPE_PARAMS[tela];
  const segsRad = cols - 1;
  const pinWeights = new Float32Array(rows * cols);
  const gravityWeights = new Float32Array(rows * cols);

  const esStretch = tela === "licra";
  const esLoose = config.silueta === "holgado";
  const bustSpanY = Math.max(0.08, perfil.cuelloYM - perfil.cinturaYM);

  for (let r = 0; r < rows; r++) {
    const tr = r / Math.max(1, rows - 1);
    for (let s = 0; s < cols; s++) {
      const idx = r * cols + s;
      const i3 = idx * 3;
      const fracS = s / segsRad;
      const theta = (fracS - 0.5) * Math.PI * 2;
      let px = positions[i3];
      const py = positions[i3 + 1];
      let pz = positions[i3 + 2];

      // Row 0 (neckline/shoulder) stays pinned to prevent collar gap
      pinWeights[idx] = tr < 0.08 ? 1.0 : tr < 0.22 ? 0.55 : 0.14;
      gravityWeights[idx] = Math.pow(tr, 1.15);

      const an = evaluarPerfilEnY(
        perfil.anillosInterpolados,
        clamp(py, perfil.musloYM, perfil.cuelloYM)
      );
      const tBustBand = Math.exp(
        -Math.pow((py - perfil.bustoYM) / (bustSpanY * 0.28), 2)
      );
      const tUnderBust = smoothstep(
        perfil.bustoYM + cmAMetros(1),
        perfil.cinturaYM + cmAMetros(1),
        py
      );

      // 1. Real cloth sternum bridge across center front between bust mounds (woven/crepe/silk drape over bust)
      if (!esStretch && Math.abs(theta) < 0.55) {
        const apexMask = Math.exp(-Math.pow((Math.abs(theta) - 0.34) / 0.16, 2));
        const bridgeCenter = Math.exp(-Math.pow(theta / 0.2, 2));
        const bridgeAmount = esLoose ? cmAMetros(1.15) : cmAMetros(0.55);
        pz += (bridgeCenter * bridgeAmount + apexMask * cmAMetros(0.28)) * tBustBand;
      }

      // 2. Twin under-bust & waist dart tuck folds converging from bust to waist
      if (!esLoose && config.prenda !== "chaqueta") {
        const dartMask = Math.exp(-Math.pow((Math.abs(theta) - 0.32) / 0.12, 2));
        const tuckPhase = Math.sin((Math.abs(theta) - 0.32) * 32);
        const tuckDepth = cmAMetros(0.22) * drapeCfg.drapeDepth * dartMask * tUnderBust;
        pz += tuckPhase * tuckDepth * 0.55;
      }

      // 3. Soft vertical drape flutes on loose/bloused silhouettes + subtle underarm diagonal creases
      const underarmBand =
        Math.exp(-Math.pow((Math.abs(theta) - Math.PI * 0.45) / 0.28, 2)) *
        Math.exp(-Math.pow((py - (perfil.bustoYM + cmAMetros(2))) / cmAMetros(7), 2));
      const underarmCrease =
        Math.sin(py * 95 + Math.abs(theta) * 6) * cmAMetros(0.24) * underarmBand * drapeCfg.drapeDepth;

      const macroFold =
        foldNoise(theta, tr, drapeCfg.foldHarmonics, 0.3) *
        cmAMetros(esLoose ? 0.85 : 0.24) *
        drapeCfg.drapeDepth *
        tUnderBust;

      // 4. Dorsal spine gentle hollow at center back
      if (Math.abs(theta) > Math.PI * 0.82 && !esLoose) {
        const backCenter = smoothstep(Math.PI * 0.82, Math.PI, Math.abs(theta));
        const tMidBack = Math.exp(-Math.pow((py - (perfil.bustoYM - cmAMetros(4))) / cmAMetros(10), 2));
        pz += cmAMetros(0.35) * backCenter * tMidBack;
      }

      const rCur = Math.max(1e-4, Math.hypot(px, pz - an.desplazamientoZ));
      const radialDisp = macroFold + underarmCrease;
      if (Math.abs(radialDisp) > 1e-6) {
        px += (px / rCur) * radialDisp;
        pz += ((pz - an.desplazamientoZ) / rCur) * radialDisp;
      }

      const safe = projectTorsoSafe(px, py, pz);
      positions[i3] = safe.x;
      positions[i3 + 1] = safe.y;
      positions[i3 + 2] = safe.z;
    }
  }

  solveGridClothDrape({
    pos: positions,
    rows,
    cols,
    wrapHorizontally: true,
    drapeConfig: drapeCfg,
    pinWeights,
    gravityWeights,
    projectCollision: (x, y, z) => projectTorsoSafe(x, y, z),
  });
}

/**
 * Transforms tubular cylindrical sleeves into real draped sleeves with:
 * - Armhole/shoulder-cap ease gathers
 * - Natural underside gravity hang (-Y droop below the arm bone)
 * - Inner-elbow flex folds & subtle wrist cuff stacking
 */
export function applySleeveClothDrape(params: {
  positions: number[];
  rings: number;
  segs: number;
  lado: -1 | 1;
  brazo: TrayectoriaBrazo3D;
  config: ConfigPrenda;
  tela: TipoTela;
  projectArmSafe: (x: number, y: number, z: number) => { x: number; y: number; z: number };
}): void {
  const { positions, rings, segs, brazo, config, tela, projectArmSafe } = params;
  const rows = rings + 1;
  const cols = segs + 1;
  const drapeCfg = CLOTH_DRAPE_PARAMS[tela];
  const pinWeights = new Float32Array(rows * cols);
  const gravityWeights = new Float32Array(rows * cols);

  const esStretch = tela === "licra";
  const esLarga = config.manga === "largaPegada" || config.manga === "acampanada";
  const esAcampanada = config.manga === "acampanada";
  const esFarol = config.manga === "farol";

  const shoulder = new THREE.Vector3(...brazo.hombro);
  const elbow = new THREE.Vector3(...brazo.codo);
  const wrist = new THREE.Vector3(...brazo.muneca);

  for (let r = 0; r < rows; r++) {
    const tr = r / Math.max(1, rows - 1);
    const center = tr < 0.5
      ? shoulder.clone().lerp(elbow, tr * 2)
      : elbow.clone().lerp(wrist, (tr - 0.5) * 2);

    // Underside gravity hang peaks around mid-bicep and forearm (not on top deltoid)
    const hangEnv = Math.sin(clamp(tr, 0, 1) * Math.PI * 0.92);
    const elbowFlexEnv = esLarga
      ? Math.exp(-Math.pow((tr - 0.52) / 0.11, 2))
      : 0;
    const wristPoolEnv = esLarga && !esAcampanada
      ? smoothstep(0.76, 0.96, tr)
      : 0;
    const capGatherEnv = smoothstep(0.24, 0.04, tr);

    for (let s = 0; s < cols; s++) {
      const idx = r * cols + s;
      const i3 = idx * 3;
      const theta = ((s / segs) - 0.5) * Math.PI * 2;
      let px = positions[i3];
      let py = positions[i3 + 1];
      let pz = positions[i3 + 2];

      pinWeights[idx] = tr < 0.08 ? 1.0 : tr < 0.2 ? 0.55 : 0.12;
      gravityWeights[idx] = 0.2 + 0.8 * Math.pow(tr, 0.9);

      const dx = px - center.x;
      const dy = py - center.y;
      const dz = pz - center.z;
      const radialLen = Math.max(1e-4, Math.hypot(dx, dy, dz));

      // 1. Underside gravity drape (-Y hang when vertex sits beneath arm centerline)
      const undersideWeight = clamp(-dy / radialLen, 0, 1);
      if (!esStretch && undersideWeight > 0.05) {
        const sagCm = esAcampanada ? 1.45 : esFarol ? 1.2 : 0.85;
        py -= cmAMetros(sagCm) * drapeCfg.drapeDepth * undersideWeight * hangEnv;
      }

      // 2. Shoulder cap ease micro-gathers (puckering from sewing 1.5–3 cm cap ease into armhole)
      const capGathers =
        capGatherEnv *
        cmAMetros(esFarol ? 0.65 : 0.24) *
        drapeCfg.drapeDepth *
        Math.sin(theta * 14 + 0.5);

      // 3. Inner elbow horizontal flex creases (characteristic diagonal fabric folds on bent elbow!)
      const frontElbowWeight = clamp(dz / radialLen, 0, 1);
      const elbowCreases =
        elbowFlexEnv *
        frontElbowWeight *
        cmAMetros(0.42) *
        (0.55 + 0.45 * drapeCfg.drapeDepth) *
        Math.sin(tr * 62 + theta * 2);

      // 4. Wrist stacking / flared drape flutes
      const lowerFolds =
        (wristPoolEnv * cmAMetros(0.32) * Math.sin(tr * 75 + theta * 3) +
          (esAcampanada ? Math.pow(tr, 1.5) * cmAMetros(0.95) * foldNoise(theta, tr, drapeCfg.foldHarmonics, 1.1) : 0)) *
        drapeCfg.drapeDepth;

      const deltaR = capGathers + elbowCreases + lowerFolds;
      px += (dx / radialLen) * deltaR;
      py += (dy / radialLen) * deltaR * 0.45;
      pz += (dz / radialLen) * deltaR;

      const safe = projectArmSafe(px, py, pz);
      positions[i3] = safe.x;
      positions[i3 + 1] = safe.y;
      positions[i3 + 2] = safe.z;
    }
  }

  solveGridClothDrape({
    pos: positions,
    rows,
    cols,
    wrapHorizontally: true,
    drapeConfig: drapeCfg,
    pinWeights,
    gravityWeights,
    projectCollision: (x, y, z) => projectArmSafe(x, y, z),
  });
}

/**
 * Replaces uniform circular skirt rings with multi-harmonic organic godet cascades,
 * waist dart gathers, and XPBD fabric gravity drape.
 */
export function applySkirtClothDrape(params: {
  positions: number[];
  rows: number;
  cols: number;
  perfil: PerfilCuerpo;
  config: ConfigPrenda;
  tela: TipoTela;
  projectSkirtSafe: (
    x: number,
    y: number,
    z: number
  ) => { x: number; y: number; z: number };
}): void {
  const { positions, rows, cols, perfil, config, tela, projectSkirtSafe } = params;
  const drapeCfg = CLOTH_DRAPE_PARAMS[tela];
  const segs = cols - 1;
  const pinWeights = new Float32Array(rows * cols);
  const gravityWeights = new Float32Array(rows * cols);

  const esCircular = config.vuelo === "circular";
  const esEvase = config.vuelo === "evase";
  const ampBaseCm = esCircular ? 4.4 : esEvase ? 2.2 : config.silueta === "holgado" ? 1.15 : 0.42;

  for (let r = 0; r < rows; r++) {
    const tr = r / Math.max(1, rows - 1);
    for (let s = 0; s < cols; s++) {
      const idx = r * cols + s;
      const i3 = idx * 3;
      const theta = ((s / segs) - 0.5) * Math.PI * 2;
      let px = positions[i3];
      let py = positions[i3 + 1];
      let pz = positions[i3 + 2];

      pinWeights[idx] = tr < 0.06 ? 1.0 : tr < 0.16 ? 0.5 : 0.06;
      gravityWeights[idx] = Math.pow(tr, 1.15);

      const an = evaluarPerfilEnY(
        perfil.anillosInterpolados,
        clamp(py, perfil.musloYM, perfil.cuelloYM)
      );
      const dx = px;
      const dz = pz - an.desplazamientoZ;
      const rCur = Math.max(1e-4, Math.hypot(dx, dz));

      // Multi-harmonic godets + waist gathers (top 18% subtle dart pleats, bottom deep cascade)
      const godet = foldNoise(theta, tr, drapeCfg.foldHarmonics, 0.75);
      const waistGathers =
        Math.exp(-Math.pow(tr / 0.16, 2)) *
        cmAMetros(esCircular ? 0.55 : 0.25) *
        Math.sin(theta * 18 + 0.9);
      const radialDisp =
        (godet * cmAMetros(ampBaseCm) * Math.pow(tr, 1.18) + waistGathers) *
        drapeCfg.drapeDepth;

      px += (dx / rCur) * radialDisp;
      pz += (dz / rCur) * radialDisp;

      // Subtle hem gravity undulation (real bias-cut circular hems dip slightly between godets!)
      if (esCircular || esEvase) {
        py -= Math.abs(godet) * cmAMetros(esCircular ? 1.1 : 0.45) * Math.pow(tr, 1.5) * drapeCfg.drapeDepth;
      }

      const safe = projectSkirtSafe(px, py, pz);
      positions[i3] = safe.x;
      positions[i3 + 1] = safe.y;
      positions[i3 + 2] = safe.z;
    }
  }

  solveGridClothDrape({
    pos: positions,
    rows,
    cols,
    wrapHorizontally: true,
    drapeConfig: drapeCfg,
    pinWeights,
    gravityWeights,
    projectCollision: (x, y, z) => projectSkirtSafe(x, y, z),
  });
}

/**
 * Sculpts trouser pelvis anatomical contours (gluteal saddle, fly placket, hip whiskers)
 * and breaks tubular trouser legs with pressed center crease, back-of-knee flex creases,
 * hem stacking folds, and XPBD leg collision drape.
 */
export function applyTrouserClothDrape(params: {
  positions: number[];
  rows: number;
  cols: number;
  isYugo: boolean;
  lado?: -1 | 1;
  cxCurve?: number[];
  czCurve?: number[];
  config: ConfigPrenda;
  tela: TipoTela;
  projectSafe: (x: number, y: number, z: number) => { x: number; y: number; z: number };
}): void {
  const {
    positions,
    rows,
    cols,
    isYugo,
    cxCurve,
    czCurve,
    config,
    tela,
    projectSafe,
  } = params;
  const drapeCfg = CLOTH_DRAPE_PARAMS[tela];
  const segs = cols - 1;
  const pinWeights = new Float32Array(rows * cols);
  const gravityWeights = new Float32Array(rows * cols);

  const esLegging = config.pantalon === "legging" || tela === "licra";
  const esPalazzo = config.pantalon === "palazzo";

  for (let r = 0; r < rows; r++) {
    const tr = r / Math.max(1, rows - 1);
    const centerX = cxCurve?.[r] ?? 0;
    const centerZ = czCurve?.[r] ?? 0;

    for (let s = 0; s < cols; s++) {
      const idx = r * cols + s;
      const i3 = idx * 3;
      const theta = ((s / segs) - 0.5) * Math.PI * 2;
      let px = positions[i3];
      const py = positions[i3 + 1];
      let pz = positions[i3 + 2];

      pinWeights[idx] = tr < 0.08 ? 1.0 : 0.12;
      gravityWeights[idx] = isYugo ? tr * 0.35 : Math.pow(tr, 0.95);

      if (isYugo) {
        // 1. Gluteal center-back saddle contour + front fly placket relief + hip tension whiskers
        const backCenter = smoothstep(Math.PI * 0.72, Math.PI, Math.abs(theta));
        const frontCenter = Math.exp(-Math.pow(theta / 0.14, 2));
        const saddleIndent =
          backCenter * tr * cmAMetros(esLegging ? 0.55 : 0.95);
        const flyRidge =
          !esLegging && tr > 0.12 && tr < 0.78
            ? frontCenter * cmAMetros(0.45)
            : 0;
        const hipWhiskers =
          Math.exp(-Math.pow((Math.abs(theta) - 0.55) / 0.36, 2)) *
          smoothstep(0.25, 0.85, tr) *
          cmAMetros(esLegging ? 0.15 : 0.34) *
          drapeCfg.drapeDepth *
          Math.sin(tr * 26 + Math.abs(theta) * 4);

        pz += saddleIndent + flyRidge + hipWhiskers;
      } else {
        // Trouser legs: break pure circle with pressed crease + knee creases + hem stacking
        const dx = px - centerX;
        const dz = pz - centerZ;
        const rCur = Math.max(1e-4, Math.hypot(dx, dz));

        // 1. Subtle front/back tailored pressed crease ("quiebre de plancha")
        let creaseDisp = 0;
        if (!esLegging) {
          const frontCrease = Math.exp(-Math.pow(theta / 0.22, 2));
          const backCrease = Math.exp(-Math.pow((Math.abs(theta) - Math.PI) / 0.22, 2));
          const creaseWeight = smoothstep(0.08, 0.25, tr) * smoothstep(1.0, 0.82, tr);
          creaseDisp =
            (frontCrease + backCrease * 0.7) *
            cmAMetros(esPalazzo ? 0.55 : 0.42) *
            creaseWeight;
        }

        // 2. Back-of-knee horizontal flex folds (t = 0.44..0.58 on posterior surface)
        const backWeight = clamp(-dz / rCur, 0, 1);
        const kneeBand = Math.exp(-Math.pow((tr - 0.51) / 0.085, 2));
        const kneeFolds =
          backWeight *
          kneeBand *
          cmAMetros(esLegging ? 0.22 : 0.52) *
          (0.4 + 0.6 * drapeCfg.drapeDepth) *
          Math.sin(tr * 68 + theta * 2);

        // 3. Above-hem ankle stacking/pooling + Palazzo vertical drape flutes
        const anklePool =
          !esLegging && tr > 0.78
            ? smoothstep(0.78, 0.96, tr) *
              cmAMetros(esPalazzo ? 0.75 : 0.48) *
              drapeCfg.drapeDepth *
              Math.sin(tr * 58 + theta * 3)
            : 0;

        const palazzoFlutes = esPalazzo
          ? foldNoise(theta, tr, drapeCfg.foldHarmonics, 1.4) *
            cmAMetros(1.45) *
            Math.pow(tr, 1.1) *
            drapeCfg.drapeDepth
          : 0;

        const radialDisp = creaseDisp + kneeFolds + anklePool + palazzoFlutes;
        px += (dx / rCur) * radialDisp;
        pz += (dz / rCur) * radialDisp;
      }

      const safe = projectSafe(px, py, pz);
      positions[i3] = safe.x;
      positions[i3 + 1] = safe.y;
      positions[i3 + 2] = safe.z;
    }
  }

  solveGridClothDrape({
    pos: positions,
    rows,
    cols,
    wrapHorizontally: true,
    drapeConfig: drapeCfg,
    pinWeights,
    gravityWeights,
    projectCollision: (x, y, z) => projectSafe(x, y, z),
  });
}

/**
 * Bakes per-vertex Crevice Ambient Occlusion into `geo.attributes.color` and saves a copy in
 * `geo.userData.clothAoColors` so concave fold valleys self-shadow realistically.
 */
export function bakeClothCreviceAO(
  geo: THREE.BufferGeometry,
  intensity = 0.34
): Float32Array {
  const posAttr = geo.getAttribute("position");
  const normAttr = geo.getAttribute("normal");
  const count = posAttr ? posAttr.count : 0;
  const colors = new Float32Array(count * 3);

  if (!posAttr || !normAttr || count === 0) {
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.userData.clothAoColors = colors;
    return colors;
  }

  const index = geo.getIndex();
  const sumX = new Float32Array(count);
  const sumY = new Float32Array(count);
  const sumZ = new Float32Array(count);
  const deg = new Uint16Array(count);

  const accumEdge = (ia: number, ib: number) => {
    sumX[ia] += posAttr.getX(ib);
    sumY[ia] += posAttr.getY(ib);
    sumZ[ia] += posAttr.getZ(ib);
    deg[ia]++;
  };

  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const a = arr[i];
      const b = arr[i + 1];
      const c = arr[i + 2];
      accumEdge(a, b);
      accumEdge(a, c);
      accumEdge(b, a);
      accumEdge(b, c);
      accumEdge(c, a);
      accumEdge(c, b);
    }
  }

  const clampedInt = clamp(intensity, 0.08, 0.55);
  for (let i = 0; i < count; i++) {
    const d = deg[i];
    let ao = 1.0;
    if (d > 0) {
      const avgDx = sumX[i] / d - posAttr.getX(i);
      const avgDy = sumY[i] / d - posAttr.getY(i);
      const avgDz = sumZ[i] / d - posAttr.getZ(i);
      // If neighboring surface curves toward the outward normal, this vertex sits inside a fold valley
      const dotConcavity =
        avgDx * normAttr.getX(i) +
        avgDy * normAttr.getY(i) +
        avgDz * normAttr.getZ(i);
      const valley = clamp(dotConcavity / 0.0042, 0, 1);
      ao = 1.0 - valley * clampedInt;
    }
    // Slight warm tint in shadow valleys looks rich like real woven textiles
    const rVal = clamp(ao + (1 - ao) * 0.06, 0.55, 1.0);
    const gVal = clamp(ao, 0.52, 1.0);
    const bVal = clamp(ao - (1 - ao) * 0.05, 0.50, 1.0);
    colors[i * 3] = rVal;
    colors[i * 3 + 1] = gVal;
    colors[i * 3 + 2] = bVal;
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.userData.clothAoColors = colors;
  return colors;
}
