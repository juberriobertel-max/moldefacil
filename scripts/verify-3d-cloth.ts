import * as THREE from "three";
import { getBodyProfile } from "../lib/3d/bodyProfile";
import { crearRepositorioMateriales, PROPIEDADES_FISICAS_TELA } from "../lib/3d/fabricMaterials";
import {
  aplicarMapaCalceEnPrenda,
  construirMallaPrenda,
} from "../lib/3d/garmentMeshBuilder";
import {
  APARIENCIA_POR_DEFECTO,
  ConfigPrenda,
  Medidas,
  NivelDetalle3D,
  TipoTela,
} from "../lib/3d/types";

const MEDIDAS_TEST: Medidas = {
  busto: 94,
  cintura: 72,
  cadera: 100,
  anchoEspalda: 37,
  largoTalle: 42,
  alturaTiro: 27,
  alturaTotal: 165,
  largoManga: 58,
  contornoMuslo: 58,
  largoEntrepierna: 76,
  anchoBota: 38,
};

const CONFIGS: Array<{ name: string; config: ConfigPrenda }> = [
  {
    name: "vestido-circular-larga",
    config: {
      prenda: "vestido",
      escote: "redondo",
      manga: "largaPegada",
      silueta: "entallado",
      cinturon: true,
      vuelo: "circular",
      bolero: false,
      pantalon: "recto",
      largoDeseado: 68,
    },
  },
  {
    name: "blusa-holgada-kimono",
    config: {
      prenda: "blusa",
      escote: "v",
      manga: "kimono",
      silueta: "holgado",
      cinturon: false,
      vuelo: "recta",
      bolero: false,
      pantalon: "recto",
      largoDeseado: 58,
    },
  },
  {
    name: "falda-evase-bolero",
    config: {
      prenda: "falda",
      escote: "redondo",
      manga: "ninguna",
      silueta: "entallado",
      cinturon: false,
      vuelo: "evase",
      bolero: true,
      pantalon: "recto",
      largoDeseado: 64,
    },
  },
  {
    name: "pantalon-recto",
    config: {
      prenda: "pantalon",
      escote: "redondo",
      manga: "ninguna",
      silueta: "entallado",
      cinturon: false,
      vuelo: "recta",
      bolero: false,
      pantalon: "recto",
      largoDeseado: 98,
    },
  },
  {
    name: "pantalon-palazzo",
    config: {
      prenda: "pantalon",
      escote: "redondo",
      manga: "ninguna",
      silueta: "holgado",
      cinturon: true,
      vuelo: "recta",
      bolero: false,
      pantalon: "palazzo",
      largoDeseado: 102,
    },
  },
  {
    name: "chaqueta-solapa-larga",
    config: {
      prenda: "chaqueta",
      escote: "solapaSastre",
      manga: "largaPegada",
      silueta: "entallado",
      cinturon: false,
      vuelo: "recta",
      bolero: false,
      pantalon: "recto",
      largoDeseado: 62,
      bolsillosConTapa: true,
    },
  },
  {
    name: "enterizo-wrap",
    config: {
      prenda: "enterizo",
      escote: "wrap",
      manga: "cortaPegada",
      silueta: "entallado",
      cinturon: true,
      vuelo: "recta",
      bolero: false,
      pantalon: "recto",
      largoDeseado: 100,
    },
  },
];

const TELAS: TipoTela[] = ["seda", "crepe", "lino", "licra"];
const NIVELES: NivelDetalle3D[] = ["escritorio", "movil"];

const repo = crearRepositorioMateriales();
const perfil = getBodyProfile(MEDIDAS_TEST);

let totalRuns = 0;
let totalMs = 0;
const skirtHemRadiusStdDevByTela: Partial<Record<TipoTela, number>> = {};

for (const nivel of NIVELES) {
  for (const tela of TELAS) {
    const ap = { ...APARIENCIA_POR_DEFECTO, tela };
    const matPrincipal = repo.obtenerMaterial(ap);
    const matSecundario = repo.obtenerMaterialSecundario(ap);
    const matVista = repo.obtenerMaterialVista(ap);
    const matMapaCalce = repo.obtenerMaterialMapaCalce();

    for (const item of CONFIGS) {
      const t0 = performance.now();
      const res = construirMallaPrenda(perfil, item.config, {
        nivelDetalle: nivel,
        materialPrincipal: matPrincipal,
        materialSecundario: matSecundario,
        materialForroOVista: matVista,
        mostrarCosturas: false,
        ajusteTelaStretchM: PROPIEDADES_FISICAS_TELA[tela].ajusteStretchM,
        tipoTela: tela,
      });
      const dt = performance.now() - t0;
      totalMs += dt;
      totalRuns++;

      let meshCount = 0;
      let sawAoContrast = false;

      res.grupo.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || obj.userData.esHerraje) return;
        meshCount++;
        const pos = obj.geometry.getAttribute("position");
        const norm = obj.geometry.getAttribute("normal");
        const color = obj.geometry.getAttribute("color");
        if (!pos || !norm) {
          throw new Error(`[${item.name}/${tela}/${nivel}] Mesh ${obj.name} missing position/normal`);
        }
        if (!color) {
          throw new Error(
            `[${item.name}/${tela}/${nivel}] Mesh ${obj.name} missing color attribute (would render black under vertexColors:true)`
          );
        }

        for (let i = 0; i < pos.count; i++) {
          if (
            !Number.isFinite(pos.getX(i)) ||
            !Number.isFinite(pos.getY(i)) ||
            !Number.isFinite(pos.getZ(i)) ||
            !Number.isFinite(norm.getX(i)) ||
            !Number.isFinite(color.getX(i))
          ) {
            throw new Error(`[${item.name}/${tela}/${nivel}] Non-finite buffer value in ${obj.name}`);
          }
          if (color.getY(i) < 0.94) {
            sawAoContrast = true;
          }
        }

        if (
          nivel === "escritorio" &&
          item.name === "vestido-circular-larga" &&
          obj.name === "falda-principal"
        ) {
          // Check hem radial variance on bottom ring
          const cols = 89;
          const rows = 32;
          const startIdx = (rows - 1) * cols;
          const radii: number[] = [];
          for (let s = 0; s < cols - 1; s++) {
            const vi = startIdx + s;
            radii.push(Math.hypot(pos.getX(vi), pos.getZ(vi)));
          }
          const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
          const std = Math.sqrt(
            radii.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / radii.length
          );
          skirtHemRadiusStdDevByTela[tela] = std;
        }
      });

      if (meshCount === 0) {
        throw new Error(`[${item.name}/${tela}/${nivel}] Generated 0 meshes`);
      }
      if (nivel === "escritorio" && tela !== "licra" && !sawAoContrast) {
        throw new Error(
          `[${item.name}/${tela}/${nivel}] Expected cloth crevice AO contrast on sculpted mesh`
        );
      }

      // Verify Fit Map toggle restores original clothAoColors cleanly
      aplicarMapaCalceEnPrenda(res.grupo, perfil, matMapaCalce, true);
      aplicarMapaCalceEnPrenda(res.grupo, perfil, matMapaCalce, false);
      res.grupo.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.esHerraje !== true) {
          if (obj.material === matMapaCalce) {
            throw new Error(`[${item.name}] Fit map material did not restore cleanly`);
          }
        }
      });
    }
  }
}

const sedaStd = skirtHemRadiusStdDevByTela.seda ?? 0;
const licraStd = skirtHemRadiusStdDevByTela.licra ?? 0;
if (sedaStd <= 0.008 || sedaStd <= licraStd) {
  throw new Error(
    `Expected circular silk skirt fold variance (${sedaStd.toFixed(4)}) > 0.008 and > stretch (${licraStd.toFixed(4)})`
  );
}

const avgMs = totalMs / Math.max(1, totalRuns);
console.log(
  `MoldeFácil 3D Cloth Verification: ${totalRuns}/${totalRuns} builds passed cleanly (avg ${avgMs.toFixed(1)} ms/garment).`
);
console.log(
  `Skirt hem fold variance (stdDev m): seda=${sedaStd.toFixed(4)}, crepe=${(skirtHemRadiusStdDevByTela.crepe ?? 0).toFixed(4)}, lino=${(skirtHemRadiusStdDevByTela.lino ?? 0).toFixed(4)}, licra=${licraStd.toFixed(4)}`
);
if (avgMs > 150) {
  throw new Error(`Cloth build exceeded 150 ms budget (${avgMs.toFixed(1)} ms)`);
}

repo.dispose();
