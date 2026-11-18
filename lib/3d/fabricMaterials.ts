import * as THREE from "three";
import { Apariencia, APARIENCIA_POR_DEFECTO } from "./types";

export interface RepositorioMaterialesTela {
  obtenerMaterial: (apariencia: Apariencia) => THREE.MeshPhysicalMaterial;
  texturasCacheadas: () => ReadonlySet<THREE.Texture>;
  dispose: () => void;
}

/**
 * Contrato Fase 1: generará materiales PBR procedurales con texturas cacheadas
 * por (estampado, color, tela) y trama tejida en canvas en Fase 4.
 */
export function crearRepositorioMateriales(
  _renderer?: THREE.WebGLRenderer
): RepositorioMaterialesTela {
  void _renderer;

  const texturas = new Set<THREE.Texture>();
  const materialActual = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(APARIENCIA_POR_DEFECTO.color),
    roughness: 0.55,
    sheen: 0.6,
    side: THREE.DoubleSide,
  });

  return {
    obtenerMaterial(apariencia: Apariencia) {
      materialActual.color.set(apariencia.color);
      return materialActual;
    },
    texturasCacheadas() {
      return texturas;
    },
    dispose() {
      materialActual.dispose();
      texturas.forEach((tex) => tex.dispose());
      texturas.clear();
    },
  };
}
