import * as THREE from "three";

const MATERIAL_TEXTURE_KEYS = [
  "map",
  "bumpMap",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "envMap",
  "lightMap",
  "displacementMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularIntensityMap",
  "specularColorMap",
  "transmissionMap",
  "thicknessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
] as const;

export interface OpcionesDispose3D {
  /** Texturas cacheadas que deben seguir vivas hasta cerrar el caché global. */
  preservarTexturas?: ReadonlySet<THREE.Texture>;
  /** Materiales compartidos que se reutilizan al reconstruir solo geometrías. */
  preservarMateriales?: ReadonlySet<THREE.Material>;
}

function disposeMaterialAndTextures(
  material: THREE.Material,
  preservarTexturas?: ReadonlySet<THREE.Texture>
): void {
  const matRecord = material as unknown as Record<string, unknown>;
  for (const key of MATERIAL_TEXTURE_KEYS) {
    const candidate = matRecord[key];
    if (
      candidate instanceof THREE.Texture &&
      !preservarTexturas?.has(candidate)
    ) {
      candidate.dispose();
    }
  }
  material.dispose();
}

/**
 * Recorre cualquier `Object3D` (Mesh, InstancedMesh, Line, LineSegments, Group, Scene)
 * y libera sus geometrías, materiales y mapas de textura para evitar fugas de memoria WebGL.
 */
export function disposeObject(
  obj: THREE.Object3D | null | undefined,
  opciones: OpcionesDispose3D = {}
): void {
  if (!obj) return;

  const { preservarTexturas, preservarMateriales } = opciones;
  const geometriesDisposed = new Set<THREE.BufferGeometry>();
  const materialsDisposed = new Set<THREE.Material>();

  obj.traverse((child) => {
    const renderable = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (
      renderable.geometry instanceof THREE.BufferGeometry &&
      !geometriesDisposed.has(renderable.geometry)
    ) {
      geometriesDisposed.add(renderable.geometry);
      renderable.geometry.dispose();
    }

    const mat = renderable.material;
    if (!mat) return;

    if (Array.isArray(mat)) {
      for (const item of mat) {
        if (
          item &&
          !preservarMateriales?.has(item) &&
          !materialsDisposed.has(item)
        ) {
          materialsDisposed.add(item);
          disposeMaterialAndTextures(item, preservarTexturas);
        }
      }
    } else if (
      !preservarMateriales?.has(mat) &&
      !materialsDisposed.has(mat)
    ) {
      materialsDisposed.add(mat);
      disposeMaterialAndTextures(mat, preservarTexturas);
    }
  });
}
