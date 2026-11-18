import * as THREE from "three";
import { PerfilCuerpo } from "./types";

export interface ManiquiInstancia {
  grupo: THREE.Group;
  materialesCompartidos: ReadonlySet<THREE.Material>;
  texturasCompartidas: ReadonlySet<THREE.Texture>;
  actualizar: (perfil: PerfilCuerpo) => void;
}

/**
 * Contrato Fase 1: construirá el maniquí de lino crudo `#EDE4D7`, tapa de cuello,
 * pedestal de madera oscura y extremidades guía semitransparentes en Fase 2.
 */
export function crearManiqui(_perfil: PerfilCuerpo): ManiquiInstancia {
  void _perfil;
  const grupo = new THREE.Group();
  grupo.name = "maniqui-atelier";

  return {
    grupo,
    materialesCompartidos: new Set<THREE.Material>(),
    texturasCompartidas: new Set<THREE.Texture>(),
    actualizar: () => {
      // Se implementa en Fase 2
    },
  };
}
