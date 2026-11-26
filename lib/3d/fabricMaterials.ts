import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DatosCaidaAnimada, TILE_ESTAMPADO_M } from "./garmentMeshBuilder";
import { Apariencia, APARIENCIA_POR_DEFECTO, TipoEstampado, TipoTela } from "./types";

export interface ConfiguracionFisicaTela {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
  normalScale: number;
  amplitudCaidaM: number;
  frecuenciaOnda: number;
  ajusteStretchM: number;
  etiquetaCorta: string;
}

export const PROPIEDADES_FISICAS_TELA: Record<TipoTela, ConfiguracionFisicaTela> = {
  seda: {
    roughness: 0.28,
    metalness: 0.04,
    clearcoat: 0.32,
    clearcoatRoughness: 0.24,
    sheen: 0.45,
    sheenRoughness: 0.34,
    normalScale: 0.55,
    amplitudCaidaM: 0.0085,
    frecuenciaOnda: 2.35,
    ajusteStretchM: 0,
    etiquetaCorta: "Seda / Satén",
  },
  crepe: {
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.55,
    sheen: 0.62,
    sheenRoughness: 0.56,
    normalScale: 0.85,
    amplitudCaidaM: 0.005,
    frecuenciaOnda: 1.5,
    ajusteStretchM: 0,
    etiquetaCorta: "Crepé / Viscosa",
  },
  lino: {
    roughness: 0.88,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.85,
    sheen: 0.18,
    sheenRoughness: 0.82,
    normalScale: 1.15,
    amplitudCaidaM: 0.0018,
    frecuenciaOnda: 1.0,
    ajusteStretchM: 0,
    etiquetaCorta: "Lino / Gabardina",
  },
  licra: {
    roughness: 0.44,
    metalness: 0.02,
    clearcoat: 0.06,
    clearcoatRoughness: 0.42,
    sheen: 0.40,
    sheenRoughness: 0.48,
    normalScale: 0.85,
    amplitudCaidaM: 0.0022,
    frecuenciaOnda: 1.75,
    ajusteStretchM: -0.004,
    etiquetaCorta: "Licra / Punto",
  },
};

export function obtenerParametrosTela(tela: TipoTela): ConfiguracionFisicaTela {
  return PROPIEDADES_FISICAS_TELA[tela];
}

export interface RepositorioMaterialesTela {
  obtenerMaterial: (apariencia: Apariencia) => THREE.MeshPhysicalMaterial;
  obtenerMaterialSecundario: (apariencia: Apariencia) => THREE.MeshPhysicalMaterial;
  obtenerMaterialVista: (apariencia: Apariencia) => THREE.MeshPhysicalMaterial;
  obtenerMaterialMapaCalce: () => THREE.MeshPhysicalMaterial;
  obtenerMaterialResaltado: (apariencia: Apariencia) => THREE.MeshPhysicalMaterial;
  texturasCacheadas: () => ReadonlySet<THREE.Texture>;
  materialesCompartidos: () => ReadonlySet<THREE.Material>;
  tamanoCache: () => number;
  dispose: () => void;
}

export interface IluminacionEntorno3D {
  luces: THREE.Group;
  envRenderTarget: THREE.WebGLRenderTarget;
  dispose: () => void;
}

export interface SombraContactoPedestal {
  mesh: THREE.Mesh;
  textura: THREE.Texture;
  dispose: () => void;
}

const TAM_TEXTURA_ESTAMPADO = 512;
const TAM_TEXTURA_PBR = 512;

function normalizarHex(colorCss: string): string {
  try {
    return `#${new THREE.Color(colorCss).getHexString().toUpperCase()}`;
  } catch {
    return "#C85A32";
  }
}

function luminanciaRelativa(hex: string): number {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function obtenerColorContraste(hexBase: string): {
  contrasteHex: string;
  rgbRgba: (alpha: number) => string;
  vichyFondoHex: string;
  esClaro: boolean;
} {
  const lum = luminanciaRelativa(hexBase);
  const esClaro = lum >= 0.48;
  const c = new THREE.Color(hexBase);
  const r255 = Math.round(c.r * 255);
  const g255 = Math.round(c.g * 255);
  const b255 = Math.round(c.b * 255);

  const contrasteHex = esClaro ? "#332924" : "#F6F0E4";
  const vichyFondoHex = lum > 0.78 ? "#DFD2BF" : "#FAF6F0";

  return {
    contrasteHex,
    esClaro,
    vichyFondoHex,
    rgbRgba: (alpha: number) => `rgba(${r255}, ${g255}, ${b255}, ${alpha})`,
  };
}

function crearTexturaSolidaFallback(hex: string, esSrgb: boolean): THREE.DataTexture {
  const c = new THREE.Color(hex);
  const data = new Uint8Array([
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
    255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = esSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function dibujarMicroTexturaTela512(
  ctx: CanvasRenderingContext2D,
  tela: TipoTela
): void {
  const n = TAM_TEXTURA_ESTAMPADO;
  ctx.save();
  if (tela === "seda") {
    for (let y = 0; y < n; y += 2) {
      const lum = Math.sin((y / n) * Math.PI * 16) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.015 + lum * 0.025).toFixed(4)})`;
      ctx.fillRect(0, y, n, 2);
    }
  } else if (tela === "crepe") {
    for (let y = 0; y < n; y += 4) {
      for (let x = 0; x < n; x += 4) {
        const hash = Math.sin(
          (x / n) * Math.PI * 64 + Math.cos((y / n) * Math.PI * 64) * 2.1
        );
        ctx.fillStyle =
          hash > 0 ? "rgba(255, 255, 255, 0.028)" : "rgba(0, 0, 0, 0.028)";
        ctx.fillRect(x, y, 3, 3);
      }
    }
  } else if (tela === "lino") {
    for (let i = 0; i < n; i += 8) {
      const slub = Math.sin(i * 0.37) * 0.015;
      ctx.fillStyle =
        i % 16 === 0
          ? `rgba(0, 0, 0, ${(0.05 + slub).toFixed(4)})`
          : `rgba(255, 255, 255, ${(0.045 + slub).toFixed(4)})`;
      ctx.fillRect(i, 0, 2, n);
      ctx.fillRect(0, i, n, 2);
    }
  } else {
    for (let x = 0; x < n; x += 6) {
      ctx.fillStyle =
        x % 12 === 0 ? "rgba(255, 255, 255, 0.036)" : "rgba(0, 0, 0, 0.036)";
      ctx.fillRect(x, 0, 2, n);
    }
  }
  ctx.restore();
}

function crearTexturaEstampado512(
  estampado: TipoEstampado,
  colorHex: string,
  tela: TipoTela,
  anisotropyMax: number
): THREE.Texture {
  if (typeof document === "undefined") {
    const fallback = crearTexturaSolidaFallback(colorHex, true);
    fallback.repeat.set(1 / TILE_ESTAMPADO_M, 1 / TILE_ESTAMPADO_M);
    fallback.anisotropy = Math.min(4, anisotropyMax);
    return fallback;
  }

  const size = TAM_TEXTURA_ESTAMPADO;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const { contrasteHex, esClaro, vichyFondoHex, rgbRgba } =
      obtenerColorContraste(colorHex);

    if (estampado === "vichy") {
      const paso = size / 4;
      const banda = paso / 2;

      ctx.fillStyle = vichyFondoHex;
      ctx.fillRect(0, 0, size, size);

      const usaOscuro = luminanciaRelativa(colorHex) > 0.78;
      const fillBanda = usaOscuro ? "rgba(176, 148, 122, 0.46)" : rgbRgba(0.46);
      const fillCruce = usaOscuro ? "rgba(156, 124, 96, 0.56)" : rgbRgba(0.56);

      ctx.fillStyle = fillBanda;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(i * paso, 0, banda, size);
      }
      for (let j = 0; j < 4; j++) {
        ctx.fillRect(0, j * paso, size, banda);
      }

      ctx.fillStyle = fillCruce;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillRect(i * paso, j * paso, banda, banda);
        }
      }
    } else {
      ctx.fillStyle = colorHex;
      ctx.fillRect(0, 0, size, size);

      if (estampado === "lunares") {
        const step = size / 4;
        const half = step / 2;
        const radio = 18;
        ctx.fillStyle = esClaro ? "rgba(51, 41, 36, 0.85)" : "rgba(246, 240, 228, 0.90)";

        const dibujarLunarConWrap = (cx: number, cy: number) => {
          for (const ox of [-size, 0, size]) {
            for (const oy of [-size, 0, size]) {
              const px = cx + ox;
              const py = cy + oy;
              if (
                px + radio >= 0 &&
                px - radio <= size &&
                py + radio >= 0 &&
                py - radio <= size
              ) {
                ctx.beginPath();
                ctx.arc(px, py, radio, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        };

        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            dibujarLunarConWrap(col * step + half * 0.5, row * step + half * 0.5);
            dibujarLunarConWrap(col * step + half * 1.5, row * step + half * 1.5);
          }
        }
      } else if (estampado === "rayas") {
        const period = size / 8;
        ctx.fillStyle = esClaro ? "rgba(51, 41, 36, 0.65)" : contrasteHex;
        ctx.globalAlpha = esClaro ? 0.62 : 0.78;
        for (let x = 0; x < size; x += period) {
          ctx.fillRect(x + 4, 0, 5, size);
          ctx.fillRect(x + 15, 0, 2, size);
        }
        ctx.globalAlpha = 1;
      }
    }

    dibujarMicroTexturaTela512(ctx, tela);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / TILE_ESTAMPADO_M, 1 / TILE_ESTAMPADO_M);
  tex.anisotropy = Math.min(4, Math.max(1, anisotropyMax));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates seamless 512x512 tangent-space `normalMap` and `roughnessMap` from true
 * textile weave heightfields (satin twill, crepe high-twist, slubbed linen, or V-knit jersey).
 */
function crearMapasPbrTela512(
  tela: TipoTela,
  anisotropyMax: number
): { normalMap: THREE.Texture; roughnessMap: THREE.Texture } {
  const repeatVal =
    tela === "lino"
      ? 1 / 0.036
      : tela === "licra"
        ? 1 / 0.024
        : tela === "seda"
          ? 1 / 0.052
          : 1 / 0.042;

  if (typeof document === "undefined") {
    const nFb = crearTexturaSolidaFallback("#8080FF", false);
    nFb.repeat.set(repeatVal, repeatVal);
    nFb.anisotropy = Math.min(4, anisotropyMax);
    const rFb = crearTexturaSolidaFallback("#D0D0D0", false);
    rFb.repeat.set(repeatVal, repeatVal);
    rFb.anisotropy = Math.min(4, anisotropyMax);
    return { normalMap: nFb, roughnessMap: rFb };
  }

  const size = TAM_TEXTURA_PBR;
  const height = new Float32Array(size * size);

  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let h = 0;

      if (tela === "lino") {
        // Slubbed warp & weft plain linen weave
        const cellX = (x >> 3) & 1;
        const cellY = (y >> 3) & 1;
        const fx = (x % 8) / 8;
        const fy = (y % 8) / 8;
        const warpThread = Math.sin(fx * Math.PI);
        const weftThread = Math.sin(fy * Math.PI);
        const parity = (cellX + cellY) % 2 === 0;
        const slub =
          0.16 * Math.sin(u * tau * 3 + Math.cos(v * tau * 5)) +
          0.12 * Math.sin(v * tau * 4 - Math.sin(u * tau * 7));
        h = parity
          ? warpThread * 0.72 + weftThread * 0.25 + slub
          : weftThread * 0.72 + warpThread * 0.25 + slub;
      } else if (tela === "licra") {
        // Jersey fine V-stitch rib knit
        const rib = Math.sin(u * tau * 64);
        const chevron = Math.sin(v * tau * 48 + Math.abs(((x % 8) - 4) / 4) * 1.4);
        h = rib * 0.55 + chevron * 0.45;
      } else if (tela === "seda") {
        // Diagonal satin twill + silky subtle directional sheen wave
        const diag = Math.sin((u * 48 + v * 16) * tau);
        const softWave = 0.35 * Math.sin(v * tau * 8 + Math.sin(u * tau * 6));
        h = diag * 0.28 + softWave * 0.35;
      } else {
        // High-twist granular crepe weave
        const g1 = Math.sin(u * tau * 48 + Math.cos(v * tau * 48) * 1.8);
        const g2 = Math.cos(v * tau * 40 - Math.sin(u * tau * 32) * 1.6);
        h = (g1 + g2) * 0.45;
      }
      height[y * size + x] = h;
    }
  }

  const strength =
    tela === "lino" ? 3.2 : tela === "crepe" ? 2.1 : tela === "licra" ? 2.2 : 1.05;

  const normCanvas = document.createElement("canvas");
  normCanvas.width = size;
  normCanvas.height = size;
  const normCtx = normCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext("2d");

  if (normCtx && roughCtx) {
    const normImg = normCtx.createImageData(size, size);
    const roughImg = roughCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const ym = (y - 1 + size) & (size - 1);
      const yp = (y + 1) & (size - 1);
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) & (size - 1);
        const xp = (x + 1) & (size - 1);

        const hL = height[y * size + xm];
        const hR = height[y * size + xp];
        const hU = height[ym * size + x];
        const hD = height[yp * size + x];

        const dX = (hL - hR) * strength;
        const dY = (hU - hD) * strength;
        const dZ = 1.0;
        const inv = 1 / Math.hypot(dX, dY, dZ);

        const idx4 = (y * size + x) * 4;
        normImg.data[idx4] = Math.round((dX * inv * 0.5 + 0.5) * 255);
        normImg.data[idx4 + 1] = Math.round((dY * inv * 0.5 + 0.5) * 255);
        normImg.data[idx4 + 2] = Math.round((dZ * inv * 0.5 + 0.5) * 255);
        normImg.data[idx4 + 3] = 255;

        // Roughness value modulates threads (crests slightly smoother than yarn valleys)
        const valH = height[y * size + x];
        const roughScalar = Math.round(
          THREE.MathUtils.clamp(225 - valH * 42, 165, 255)
        );
        roughImg.data[idx4] = roughScalar;
        roughImg.data[idx4 + 1] = roughScalar;
        roughImg.data[idx4 + 2] = roughScalar;
        roughImg.data[idx4 + 3] = 255;
      }
    }
    normCtx.putImageData(normImg, 0, 0);
    roughCtx.putImageData(roughImg, 0, 0);
  }

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeatVal, repeatVal);
  normalMap.anisotropy = Math.min(4, Math.max(1, anisotropyMax));
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatVal, repeatVal);
  roughnessMap.anisotropy = Math.min(4, Math.max(1, anisotropyMax));
  roughnessMap.needsUpdate = true;

  return { normalMap, roughnessMap };
}

export function configurarRendererEscena3D(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  renderer.setPixelRatio(Math.min(dpr, 2));
}

export function configurarIluminacionYEntorno3D(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): IluminacionEntorno3D {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new RoomEnvironment();
  const envRenderTarget = pmremGenerator.fromScene(envScene, 0.04);

  envScene.traverse((obj) => {
    const mesh = obj as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  });
  pmremGenerator.dispose();

  scene.environment = envRenderTarget.texture;
  scene.environmentIntensity = 0.52;

  const luces = new THREE.Group();
  luces.name = "estudio-iluminacion-3d";

  const luzHemi = new THREE.HemisphereLight("#FAF6F0", "#C4B7A8", 0.62);
  luces.add(luzHemi);

  // Raking studio key light with 2048x2048 soft PCF shadows to sculpt cloth folds
  const luzClave = new THREE.DirectionalLight("#FFF3E4", 2.25);
  luzClave.position.set(2.45, 2.75, 2.15);
  luzClave.castShadow = true;
  luzClave.shadow.mapSize.set(2048, 2048);
  luzClave.shadow.bias = -0.0004;
  luzClave.shadow.normalBias = 0.008;
  luzClave.shadow.camera.left = -0.85;
  luzClave.shadow.camera.right = 0.85;
  luzClave.shadow.camera.top = 1.85;
  luzClave.shadow.camera.bottom = -0.05;
  luzClave.shadow.camera.near = 0.5;
  luzClave.shadow.camera.far = 6.5;
  luces.add(luzClave);

  const luzRelleno = new THREE.DirectionalLight("#ECF2FC", 0.68);
  luzRelleno.position.set(-2.3, 1.9, 1.7);
  luces.add(luzRelleno);

  const luzContraluz = new THREE.DirectionalLight("#FFE6CE", 1.15);
  luzContraluz.position.set(-0.6, 2.4, -2.7);
  luces.add(luzContraluz);

  scene.add(luces);

  return {
    luces,
    envRenderTarget,
    dispose() {
      scene.remove(luces);
      scene.environment = null;
      envRenderTarget.dispose();
    },
  };
}

export function crearSombraContactoPedestal(): SombraContactoPedestal {
  let tex: THREE.Texture;

  if (typeof document === "undefined") {
    tex = crearTexturaSolidaFallback("#221C18", true);
  } else {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size * 0.5,
        size * 0.5,
        size * 0.04,
        size * 0.5,
        size * 0.5,
        size * 0.49
      );
      grad.addColorStop(0, "rgba(42, 33, 26, 0.36)");
      grad.addColorStop(0.42, "rgba(42, 33, 26, 0.16)");
      grad.addColorStop(1, "rgba(42, 33, 26, 0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const cTex = new THREE.CanvasTexture(canvas);
    cTex.colorSpace = THREE.SRGBColorSpace;
    cTex.needsUpdate = true;
    tex = cTex;
  }

  const geo = new THREE.PlaneGeometry(1.12, 1.12);
  geo.rotateX(-Math.PI * 0.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.002, 0);
  mesh.name = "sombra-contacto-pedestal";

  return {
    mesh,
    textura: tex,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

export function animarCaidaTelas(
  grupoPrenda: THREE.Object3D,
  tela: TipoTela,
  tiempoS: number,
  reducirMovimiento = false
): boolean {
  const params = PROPIEDADES_FISICAS_TELA[tela];
  let huboCambio = false;

  grupoPrenda.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const datos = obj.userData.datosCaida as DatosCaidaAnimada | undefined;
    if (!datos) return;

    const posAttr = obj.geometry.getAttribute("position");
    if (!(posAttr instanceof THREE.BufferAttribute)) return;

    const { posicionesBase, pesos } = datos;

    if (reducirMovimiento) {
      if (obj.userData.caidaActiva) {
        (posAttr.array as Float32Array).set(posicionesBase);
        posAttr.needsUpdate = true;
        obj.geometry.computeVertexNormals();
        obj.userData.caidaActiva = false;
        huboCambio = true;
      }
      return;
    }

    const amp = params.amplitudCaidaM;
    const freq = params.frecuenciaOnda;
    const count = Math.min(posAttr.count, pesos.length);

    for (let i = 0; i < count; i++) {
      const w = pesos[i];
      if (w <= 0.01) continue;

      const idx3 = i * 3;
      const bx = posicionesBase[idx3];
      const by = posicionesBase[idx3 + 1];
      const bz = posicionesBase[idx3 + 2];

      const rXZ = Math.max(1e-4, Math.hypot(bx, bz));
      const onda =
        0.5 +
        0.5 *
          Math.sin(tiempoS * freq + bx * 14.0 + bz * 11.0 - by * 4.2);
      const disp = amp * w * onda;

      posAttr.setXYZ(
        i,
        bx + (bx / rXZ) * disp,
        by - disp * 0.14,
        bz + (bz / rXZ) * disp
      );
    }

    posAttr.needsUpdate = true;
    obj.geometry.computeVertexNormals();
    obj.userData.caidaActiva = true;
    huboCambio = true;
  });

  return huboCambio;
}

export function crearRepositorioMateriales(
  renderer?: THREE.WebGLRenderer
): RepositorioMaterialesTela {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;

  const cacheAlbedo = new Map<string, THREE.Texture>();
  const cachePbr = new Map<
    TipoTela,
    { normalMap: THREE.Texture; roughnessMap: THREE.Texture }
  >();
  const todasTexturas = new Set<THREE.Texture>();

  const materialPrincipal = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#FFFFFF"),
    vertexColors: true,
    roughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].roughness,
    sheen: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheen,
    sheenRoughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheenRoughness,
    side: THREE.DoubleSide,
  });
  materialPrincipal.name = "material-tela-principal";

  const materialSecundario = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#FFFFFF"),
    vertexColors: true,
    roughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].roughness,
    sheen: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheen,
    sheenRoughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheenRoughness,
    side: THREE.DoubleSide,
  });
  materialSecundario.name = "material-tela-secundario";

  const materialVista = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#F4F0EA"),
    vertexColors: true,
    roughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].roughness,
    sheen: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheen,
    side: THREE.DoubleSide,
  });
  materialVista.name = "material-tela-vista";

  const materialMapaCalce = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#FFFFFF"),
    vertexColors: true,
    roughness: 0.52,
    metalness: 0,
    sheen: 0.25,
    side: THREE.DoubleSide,
  });
  materialMapaCalce.name = "material-mapa-calce";

  const materialResaltado = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#FFFFFF"),
    vertexColors: true,
    roughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].roughness,
    sheen: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheen,
    emissive: new THREE.Color("#C85A32"),
    emissiveIntensity: 0.24,
    side: THREE.DoubleSide,
  });
  materialResaltado.name = "material-pieza-resaltada";

  const materialesSet = new Set<THREE.Material>([
    materialPrincipal,
    materialSecundario,
    materialVista,
    materialMapaCalce,
    materialResaltado,
  ]);

  const obtenerOTexturaAlbedo = (apariencia: Apariencia): THREE.Texture => {
    const colorNorm = normalizarHex(apariencia.color);
    const key = `${apariencia.estampado}|${colorNorm}|${apariencia.tela}`;
    const existente = cacheAlbedo.get(key);
    if (existente) return existente;

    const nueva = crearTexturaEstampado512(
      apariencia.estampado,
      colorNorm,
      apariencia.tela,
      maxAniso
    );
    cacheAlbedo.set(key, nueva);
    todasTexturas.add(nueva);
    return nueva;
  };

  const obtenerPbr = (tela: TipoTela) => {
    const existing = cachePbr.get(tela);
    if (existing) return existing;
    const mapas = crearMapasPbrTela512(tela, maxAniso);
    cachePbr.set(tela, mapas);
    todasTexturas.add(mapas.normalMap);
    todasTexturas.add(mapas.roughnessMap);
    return mapas;
  };

  const aplicarEnMaterial = (
    mat: THREE.MeshPhysicalMaterial,
    apariencia: Apariencia,
    tinteBaseHex: string
  ): void => {
    const fisica = PROPIEDADES_FISICAS_TELA[apariencia.tela];
    const mapPrevio = mat.map;
    const texturaAlbedo = obtenerOTexturaAlbedo(apariencia);
    const normPrevio = mat.normalMap;
    const pbr = obtenerPbr(apariencia.tela);

    mat.color.set(tinteBaseHex);
    mat.map = texturaAlbedo;
    mat.normalMap = pbr.normalMap;
    mat.normalScale.set(fisica.normalScale, fisica.normalScale);
    mat.roughnessMap = pbr.roughnessMap;
    mat.roughness = fisica.roughness;
    mat.metalness = fisica.metalness;
    mat.clearcoat = fisica.clearcoat;
    mat.clearcoatRoughness = fisica.clearcoatRoughness;
    mat.sheen = fisica.sheen;
    mat.sheenRoughness = fisica.sheenRoughness;

    const sheenColor = new THREE.Color(normalizarHex(apariencia.color)).lerp(
      new THREE.Color("#FFFFFF"),
      0.35
    );
    mat.sheenColor.copy(sheenColor);

    if (
      (mapPrevio === null) !== (texturaAlbedo === null) ||
      (normPrevio === null) !== (pbr.normalMap === null)
    ) {
      mat.needsUpdate = true;
    }
  };

  aplicarEnMaterial(materialPrincipal, APARIENCIA_POR_DEFECTO, "#FFFFFF");
  aplicarEnMaterial(materialSecundario, APARIENCIA_POR_DEFECTO, "#FFFFFF");
  aplicarEnMaterial(materialVista, APARIENCIA_POR_DEFECTO, "#F2ECE4");
  aplicarEnMaterial(materialResaltado, APARIENCIA_POR_DEFECTO, "#FFFFFF");

  return {
    obtenerMaterial(apariencia: Apariencia) {
      aplicarEnMaterial(materialPrincipal, apariencia, "#FFFFFF");
      return materialPrincipal;
    },
    obtenerMaterialSecundario(apariencia: Apariencia) {
      const apSec: Apariencia = apariencia.colorSecundario
        ? { ...apariencia, color: apariencia.colorSecundario }
        : apariencia;
      aplicarEnMaterial(materialSecundario, apSec, "#FFFFFF");
      return materialSecundario;
    },
    obtenerMaterialVista(apariencia: Apariencia) {
      aplicarEnMaterial(materialVista, apariencia, "#F2ECE4");
      return materialVista;
    },
    obtenerMaterialMapaCalce() {
      return materialMapaCalce;
    },
    obtenerMaterialResaltado(apariencia: Apariencia) {
      aplicarEnMaterial(materialResaltado, apariencia, "#FFFFFF");
      return materialResaltado;
    },
    texturasCacheadas() {
      return todasTexturas;
    },
    materialesCompartidos() {
      return materialesSet;
    },
    tamanoCache() {
      return todasTexturas.size;
    },
    dispose() {
      materialPrincipal.dispose();
      materialSecundario.dispose();
      materialVista.dispose();
      materialMapaCalce.dispose();
      materialResaltado.dispose();
      todasTexturas.forEach((tex) => tex.dispose());
      todasTexturas.clear();
      cacheAlbedo.clear();
      cachePbr.clear();
    },
  };
}
