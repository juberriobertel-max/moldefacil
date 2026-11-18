import * as THREE from "three";
import {
  ConfigPrenda,
  Etiqueta3DAncla,
  NivelDetalle3D,
  PerfilCuerpo,
} from "./types";

export interface OpcionesMallaPrenda {
  nivelDetalle: NivelDetalle3D;
  materialPrincipal: THREE.MeshPhysicalMaterial;
  materialForroOVista?: THREE.MeshPhysicalMaterial;
  mostrarCosturas: boolean;
}

export interface ResultadoMallaPrenda {
  grupo: THREE.Group;
  grupoCosturas: THREE.Group;
  etiquetas: Etiqueta3DAncla[];
  triangulosTotales: number;
}

/**
 * Contrato Fase 1: construirá las mallas de prendas desplazando el perfil del cuerpo
 * + líneas punteadas de costura/pinzas en Fases 3 y 5.
 */
export function construirMallaPrenda(
  _perfil: PerfilCuerpo,
  _config: ConfigPrenda,
  opciones: OpcionesMallaPrenda
): ResultadoMallaPrenda {
  void _perfil;
  void _config;
  void opciones;

  const grupo = new THREE.Group();
  grupo.name = "prenda-3d";

  const grupoCosturas = new THREE.Group();
  grupoCosturas.name = "costuras-pinzas-3d";
  grupoCosturas.visible = opciones.mostrarCosturas;
  grupo.add(grupoCosturas);

  return {
    grupo,
    grupoCosturas,
    etiquetas: [],
    triangulosTotales: 0,
  };
}
