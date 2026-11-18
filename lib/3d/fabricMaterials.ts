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
  bumpScale: number;
  amplitudCaidaM: number;
  frecuenciaOnda: number;
  ajusteStretchM: number;
  etiquetaCorta: string;
}

export const PROPIEDADES_FISICAS_TELA: Record<TipoTela, ConfiguracionFisicaTela> = {
  seda: {
    roughness: 0.22,
    metalness: 0.04,
    clearcoat: 0.35,
    clearcoatRoughness: 0.24,
    sheen: 0.18,
    sheenRoughness: 0.35,
    bumpScale: 0.0003,
    amplitudCaidaM: 0.0085,
    frecuenciaOnda: 2.35,
    ajusteStretchM: 0,
    etiquetaCorta: "Seda / Satén",
  },
  crepe: {
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.55,
    sheen: 0.6,
    sheenRoughness: 0.58,
    bumpScale: 0.0022,
    amplitudCaidaM: 0.005,
    frecuenciaOnda: 1.5,
    ajusteStretchM: 0,
    etiquetaCorta: "Crepé / Viscosa",
  },
  lino: {
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.85,
    sheen: 0.16,
    sheenRoughness: 0.82,
    bumpScale: 0.0046,
    amplitudCaidaM: 0.0016,
    frecuenciaOnda: 1.0,
    ajusteStretchM: 0,
    etiquetaCorta: "Lino / Gabardina",
  },
  licra: {
    roughness: 0.4,
    metalness: 0.02,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    sheen: 0.36,
    sheenRoughness: 0.48,
    bumpScale: 0.0018,
    amplitudCaidaM: 0.0024,
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
  obtenerMaterialVista: (apariencia: Apariencia) => THREE.MeshPhysicalMaterial;
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
const TAM_TEXTURA_TRAMA = 256;

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

/**
 * Fallback liviano cuando se ejecuta en entornos sin DOM (pruebas unitarias en Node).
 */
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

/**
 * Traza la microtextura sutil del tejido sobre un lienzo de 512 px con periodo exacto (sin costuras).
 */
function dibujarMicroTexturaTela512(
  ctx: CanvasRenderingContext2D,
  tela: TipoTela
): void {
  const n = TAM_TEXTURA_ESTAMPADO;
  ctx.save();
  if (tela === "seda") {
    // Sutil brillo direccional de satén periódico (divisor exacto de 512)
    for (let y = 0; y < n; y += 2) {
      const lum = Math.sin((y / n) * Math.PI * 16) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.015 + lum * 0.025).toFixed(4)})`;
      ctx.fillRect(0, y, n, 2);
    }
  } else if (tela === "crepe") {
    // Grano crepé suave mediante cuadrícula sinusoidal periódica
    for (let y = 0; y < n; y += 4) {
      for (let x = 0; x < n; x += 4) {
        const hash =
          Math.sin((x / n) * Math.PI * 64 + Math.cos((y / n) * Math.PI * 64) * 2.1);
        ctx.fillStyle =
          hash > 0 ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.025)";
        ctx.fillRect(x, y, 3, 3);
      }
    }
  } else if (tela === "lino") {
    // Hilos ortogonales perceptibles de lino / drill (paso 8 px divisor exacto de 512)
    for (let i = 0; i < n; i += 8) {
      ctx.fillStyle = i % 16 === 0 ? "rgba(0, 0, 0, 0.045)" : "rgba(255, 255, 255, 0.04)";
      ctx.fillRect(i, 0, 2, n);
      ctx.fillRect(0, i, n, 2);
    }
  } else {
    // Licra / Punto fino en acanalado vertical continuo (paso 8 px)
    for (let x = 0; x < n; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? "rgba(255, 255, 255, 0.035)" : "rgba(0, 0, 0, 0.035)";
      ctx.fillRect(x, 0, 2, n);
    }
  }
  ctx.restore();
}

/**
 * Genera mapa difuso procedural 512x512 completamente repetible sin costuras
 * para `(estampado, color, tela)` con escala física de `8 cm` por repetición.
 */
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
      // Cuadros Vichy clásicos: 4 bloques de 128 px (2 cm reales) sobre fondo luminoso
      const paso = size / 4; // 128 px exactos -> seamless 100%
      const banda = paso / 2; // 64 px

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

      // Refuerzo sutil en intersecciones para dar riqueza textil de hilo teñido
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
        // Lunares escalonados 4x4 (paso 128 px, radio ~18 px -> ~5.6 mm reales) con wrap toroidal
        const step = size / 4; // 128 px
        const half = step / 2; // 64 px
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
        // Rayas sastre verticales: 8 repeticiones exactas por cada 512 px (~1 cm de paso)
        const period = size / 8; // 64 px
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
 * Crea mapa de relieve (`bumpMap` 256 px) sin costuras para trama de lino, crepé o punto.
 */
function crearBumpTexturaTela256(
  tela: TipoTela,
  anisotropyMax: number
): THREE.Texture | null {
  if (tela === "seda") {
    return null;
  }

  const repeatVal = tela === "lino" ? 1 / 0.036 : tela === "licra" ? 1 / 0.024 : 1 / 0.045;

  if (typeof document === "undefined") {
    const fb = crearTexturaSolidaFallback("#808080", false);
    fb.repeat.set(repeatVal, repeatVal);
    fb.anisotropy = Math.min(4, anisotropyMax);
    return fb;
  }

  const size = TAM_TEXTURA_TRAMA;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);

    if (tela === "lino") {
      // Trama cruzada equilibrada urdimbre + trama (paso 8 px divisor exacto de 256)
      for (let y = 0; y < size; y += 8) {
        for (let x = 0; x < size; x += 8) {
          const paridad = ((x >> 3) + (y >> 3)) % 2 === 0;
          ctx.fillStyle = paridad ? "#B8B8B8" : "#585858";
          ctx.fillRect(x, y, 6, 4);
          ctx.fillStyle = paridad ? "#626262" : "#AFAFAF";
          ctx.fillRect(x + 2, y + 4, 4, 4);
        }
      }
    } else if (tela === "licra") {
      // Punto fino Jersey: espigas verticales finas cada 4 px (64 repeticiones exactas)
      for (let x = 0; x < size; x += 4) {
        const esValle = (x >> 2) % 2 === 0;
        ctx.fillStyle = esValle ? "#606060" : "#A2A2A2";
        ctx.fillRect(x, 0, 2, size);
      }
      for (let y = 0; y < size; y += 8) {
        ctx.fillStyle = "rgba(180, 180, 180, 0.35)";
        ctx.fillRect(0, y, size, 2);
      }
    } else {
      // Crepé: granulado multidireccional periódico sin costuras
      for (let y = 0; y < size; y += 4) {
        for (let x = 0; x < size; x += 4) {
          const v =
            Math.sin((x / size) * Math.PI * 32) *
            Math.cos((y / size) * Math.PI * 32 + Math.sin((x / size) * Math.PI * 16));
          const tono = Math.round(128 + v * 36);
          ctx.fillStyle = `rgb(${tono}, ${tono}, ${tono})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
  }

  const bumpTex = new THREE.CanvasTexture(canvas);
  bumpTex.colorSpace = THREE.NoColorSpace;
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(repeatVal, repeatVal);
  bumpTex.anisotropy = Math.min(4, Math.max(1, anisotropyMax));
  bumpTex.needsUpdate = true;
  return bumpTex;
}

/**
 * Configura el WebGLRenderer según los estándares de colorimetría sRGB, tone mapping ACES
 * y límite de densidad de píxeles para rendimiento fluido en móvil y escritorio.
 */
export function configurarRendererEscena3D(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = false;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  renderer.setPixelRatio(Math.min(dpr, 2));
}

/**
 * Configura iluminación de 3 puntos cálida + entorno procedural `RoomEnvironment` vía `PMREMGenerator`.
 * Libera el `PMREMGenerator` y la escena auxiliar inmediatamente tras hornear el entorno.
 */
export function configurarIluminacionYEntorno3D(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): IluminacionEntorno3D {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new RoomEnvironment();
  const envRenderTarget = pmremGenerator.fromScene(envScene, 0.04);

  // Limpieza inmediata de RoomEnvironment y PMREMGenerator tras generar el cubo PMREM
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
  scene.environmentIntensity = 0.5;

  const luces = new THREE.Group();
  luces.name = "estudio-iluminacion-3d";

  // Relleno ambiental suave cálido-crema arriba y sombra neutra abajo
  const luzHemi = new THREE.HemisphereLight("#FAF6F0", "#CBBFB0", 0.65);
  luces.add(luzHemi);

  // Luz clave cálida principal (delantero derecho superior)
  const luzClave = new THREE.DirectionalLight("#FFF4E6", 2.15);
  luzClave.position.set(2.2, 3.1, 2.7);
  luces.add(luzClave);

  // Luz de relleno suave izquierda
  const luzRelleno = new THREE.DirectionalLight("#EEF3FB", 0.72);
  luzRelleno.position.set(-2.3, 2.0, 1.8);
  luces.add(luzRelleno);

  // Contraluz trasera para recortar silueta y destacar caída
  const luzContraluz = new THREE.DirectionalLight("#FFE7D1", 1.05);
  luzContraluz.position.set(-0.5, 2.5, -2.8);
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

/**
 * Crea un plano de sombra de contacto suave con `CanvasTexture` radial bajo el pedestal (sin shadow maps).
 */
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

/**
 * Aplica movimiento orgánico sutil de caída sobre los vértices con peso (`userData.datosCaida`),
 * respetando `prefers-reduced-motion` y garantizando desplazamiento radial positivo (sin perforar maniquí).
 */
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
      // Onda estrictamente positiva [0, 1] para evitar perforar el maniquí en vuelos suaves
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
    obj.userData.caidaActiva = true;
    huboCambio = true;
  });

  return huboCambio;
}

/**
 * Repositorio con caché de texturas por `(estampado, color, tela)` + trama tejida (`bumpMap`).
 * Al cambiar color, tela o estampado actualiza las instancias compartidas de `MeshPhysicalMaterial`
 * sin reconstruir geometrías de malla.
 */
export function crearRepositorioMateriales(
  renderer?: THREE.WebGLRenderer
): RepositorioMaterialesTela {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;

  const cacheAlbedo = new Map<string, THREE.Texture>();
  const cacheBump = new Map<TipoTela, THREE.Texture | null>();
  const todasTexturas = new Set<THREE.Texture>();

  const materialPrincipal = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#FFFFFF"),
    roughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].roughness,
    sheen: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheen,
    sheenRoughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheenRoughness,
    side: THREE.DoubleSide,
  });
  materialPrincipal.name = "material-tela-principal";

  // Material sutilmente contrastado para vista de 4 cm, pretina y lazo sin reconstruir malla
  const materialVista = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#F4F0EA"),
    roughness: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].roughness,
    sheen: PROPIEDADES_FISICAS_TELA[APARIENCIA_POR_DEFECTO.tela].sheen,
    side: THREE.DoubleSide,
  });
  materialVista.name = "material-tela-vista";

  const materialesSet = new Set<THREE.Material>([materialPrincipal, materialVista]);

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

  const obtenerBump = (tela: TipoTela): THREE.Texture | null => {
    if (cacheBump.has(tela)) return cacheBump.get(tela) ?? null;
    const nueva = crearBumpTexturaTela256(tela, maxAniso);
    cacheBump.set(tela, nueva);
    if (nueva) todasTexturas.add(nueva);
    return nueva;
  };

  const aplicarEnMaterial = (
    mat: THREE.MeshPhysicalMaterial,
    apariencia: Apariencia,
    tinteBaseHex: string
  ): void => {
    const fisica = PROPIEDADES_FISICAS_TELA[apariencia.tela];
    const mapPrevio = mat.map;
    const texturaAlbedo = obtenerOTexturaAlbedo(apariencia);
    const bumpPrevio = mat.bumpMap;
    const bumpNuevo = obtenerBump(apariencia.tela);

    mat.color.set(tinteBaseHex);
    mat.map = texturaAlbedo;
    mat.bumpMap = bumpNuevo;
    mat.bumpScale = fisica.bumpScale;
    mat.roughness = fisica.roughness;
    mat.metalness = fisica.metalness;
    mat.clearcoat = fisica.clearcoat;
    mat.clearcoatRoughness = fisica.clearcoatRoughness;
    mat.sheen = fisica.sheen;
    mat.sheenRoughness = fisica.sheenRoughness;

    // Tinte de brillo satinado/aterciopelado coherente con el color base elegido
    const sheenColor = new THREE.Color(normalizarHex(apariencia.color)).lerp(
      new THREE.Color("#FFFFFF"),
      0.35
    );
    mat.sheenColor.copy(sheenColor);

    if ((mapPrevio === null) !== (texturaAlbedo === null) || (bumpPrevio === null) !== (bumpNuevo === null)) {
      mat.needsUpdate = true;
    }
  };

  // Pre-poblar apariencia inicial
  aplicarEnMaterial(materialPrincipal, APARIENCIA_POR_DEFECTO, "#FFFFFF");
  aplicarEnMaterial(materialVista, APARIENCIA_POR_DEFECTO, "#F2ECE4");

  return {
    obtenerMaterial(apariencia: Apariencia) {
      aplicarEnMaterial(materialPrincipal, apariencia, "#FFFFFF");
      return materialPrincipal;
    },
    obtenerMaterialVista(apariencia: Apariencia) {
      aplicarEnMaterial(materialVista, apariencia, "#F2ECE4");
      return materialVista;
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
      materialVista.dispose();
      todasTexturas.forEach((tex) => tex.dispose());
      todasTexturas.clear();
      cacheAlbedo.clear();
      cacheBump.clear();
    },
  };
}
