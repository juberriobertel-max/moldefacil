import * as THREE from "three";
import { disposeObject } from "./disposal";
import { AnilloPerfil, PerfilCuerpo, cmAMetros } from "./types";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface ManiquiInstancia {
  grupo: THREE.Group;
  materialesCompartidos: ReadonlySet<THREE.Material>;
  texturasCompartidas: ReadonlySet<THREE.Texture>;
  actualizar: (perfil: PerfilCuerpo) => void;
}

/**
 * Crea textura procedural 512x512 de lino crudo (`#EDE4D7`) con trama tejida sutil
 * y líneas estructurales de maniquí (centro, princesa, cinta terracota en cintura y niveles).
 */
function crearTexturaManiqui(perfilBase: PerfilCuerpo): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext("2d");

  if (ctx) {
    // Fondo lino crudo cálido
    ctx.fillStyle = "#EDE4D7";
    ctx.fillRect(0, 0, size, size);

    // Trama de lino sutil horizontal y vertical
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle =
        y % 4 === 0 ? "rgba(182, 164, 141, 0.09)" : "rgba(255, 252, 246, 0.14)";
      ctx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += 2) {
      ctx.fillStyle =
        x % 4 === 0 ? "rgba(170, 152, 129, 0.08)" : "rgba(255, 252, 246, 0.11)";
      ctx.fillRect(x, 0, 1, size);
    }

    // Moteado orgánico suave para evitar textura artificial
    for (let i = 0; i < 1600; i++) {
      const px = ((i * 73) % 509) + 1;
      const py = ((i * 139) % 509) + 1;
      ctx.fillStyle =
        i % 2 === 0 ? "rgba(145, 125, 102, 0.06)" : "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(px, py, 2, 2);
    }

    // Líneas verticales estructurales de patronaje sobre UV (u=0 delantero, u=0.5 trasero)
    const trazarLineaVertical = (uFrac: number, color: string, width: number, dashed = true) => {
      const x = uFrac * size;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
      ctx.restore();
    };

    // Centro delantero (borde u=0/u=1), centro trasero (u=0.5), costados (u=0.25 y u=0.75)
    trazarLineaVertical(0.002, "rgba(116, 86, 65, 0.55)", 2, true);
    trazarLineaVertical(0.998, "rgba(116, 86, 65, 0.55)", 2, true);
    trazarLineaVertical(0.5, "rgba(116, 86, 65, 0.55)", 2, true);
    trazarLineaVertical(0.25, "rgba(116, 86, 65, 0.45)", 1.5, true);
    trazarLineaVertical(0.75, "rgba(116, 86, 65, 0.45)", 1.5, true);

    // Costuras princesa delanteras y traseras
    trazarLineaVertical(0.115, "rgba(130, 104, 82, 0.42)", 1.4, false);
    trazarLineaVertical(0.885, "rgba(130, 104, 82, 0.42)", 1.4, false);
    trazarLineaVertical(0.385, "rgba(130, 104, 82, 0.35)", 1.2, false);
    trazarLineaVertical(0.615, "rgba(130, 104, 82, 0.35)", 1.2, false);

    // Bandas horizontales calibradas según v = (cuelloY - y) / alturaTorso
    const altoTorso = Math.max(0.2, perfilBase.cuelloYM - perfilBase.musloYM);
    const trazarNivel = (yVal: number, color: string, ancho: number) => {
      const v = (perfilBase.cuelloYM - yVal) / altoTorso;
      const py = v * size;
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(size, py);
      ctx.stroke();
    };

    trazarNivel(perfilBase.bustoYM, "rgba(125, 96, 74, 0.35)", 1.4);
    // Cinta terracota distintiva en cintura de modistería
    trazarNivel(perfilBase.cinturaYM, "rgba(200, 90, 50, 0.78)", 4.2);
    trazarNivel(perfilBase.caderaYM, "rgba(125, 96, 74, 0.35)", 1.4);
  }

  if (bCtx) {
    bCtx.fillStyle = "#808080";
    bCtx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      bCtx.fillStyle = y % 4 === 0 ? "#6D6D6D" : "#939393";
      bCtx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += 2) {
      bCtx.fillStyle = x % 4 === 0 ? "rgba(95,95,95,0.45)" : "rgba(165,165,165,0.45)";
      bCtx.fillRect(x, 0, 1, size);
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  return { colorMap, bumpMap };
}

/**
 * Construye `BufferGeometry` cerrada (tapa superior e inferior) mediante loft
 * sobre los anillos interpolados del torso con UVs cilíndricas y normales suaves.
 */
function construirGeometriaTorso(perfil: PerfilCuerpo): THREE.BufferGeometry {
  const anillos: AnilloPerfil[] = perfil.anillosInterpolados;
  const segs = perfil.segmentosRadiales;
  const cols = segs + 1;
  const rows = anillos.length;

  const altoTorso = Math.max(0.15, perfil.cuelloYM - perfil.musloYM);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const anillo = anillos[r];
    const v = clamp(1 - (perfil.cuelloYM - anillo.y) / altoTorso, 0, 1);
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const x = anillo.a * Math.sin(theta);
      const z = anillo.desplazamientoZ + anillo.b * Math.cos(theta);
      positions.push(x, anillo.y, z);
      uvs.push(s / segs, v);
    }
  }

  // Triángulos del manto exterior (CCW normal exterior)
  for (let r = 0; r < rows - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * cols + s;
      const b = (r + 1) * cols + s;
      const c = r * cols + (s + 1);
      const d = (r + 1) * cols + (s + 1);

      indices.push(a, b, c);
      indices.push(c, b, d);
    }
  }

  // Tapa superior (cuello)
  const topAnillo = anillos[0];
  const topCenterIdx = positions.length / 3;
  positions.push(0, topAnillo.y, topAnillo.desplazamientoZ);
  uvs.push(0.5, 1);

  for (let s = 0; s < segs; s++) {
    indices.push(topCenterIdx, s, s + 1);
  }

  // Tapa inferior (base pelvis/muslo)
  const botAnillo = anillos[rows - 1];
  const botStartIdx = (rows - 1) * cols;
  const botCenterIdx = positions.length / 3;
  positions.push(0, botAnillo.y, botAnillo.desplazamientoZ);
  uvs.push(0.5, 0);

  for (let s = 0; s < segs; s++) {
    indices.push(botCenterIdx, botStartIdx + s + 1, botStartIdx + s);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Construye tapa torneada en madera para el cuello (`LatheGeometry`).
 */
function construirTapaCuello(cuello: AnilloPerfil): THREE.LatheGeometry {
  const r = Math.min(cuello.a, cuello.b) * 0.94;
  const h = cmAMetros(3.4);
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r, 0),
    new THREE.Vector2(r * 1.03, h * 0.35),
    new THREE.Vector2(r * 0.72, h * 0.68),
    new THREE.Vector2(r * 0.42, h * 0.85),
    new THREE.Vector2(r * 0.36, h * 1.08),
    new THREE.Vector2(0, h * 1.25),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Agrega pedestal con poste vertical, nudo torneado (`LatheGeometry`) y trípode de 3 patas en madera oscura.
 */
function poblarPedestal(
  grupo: THREE.Group,
  perfil: PerfilCuerpo,
  matMadera: THREE.Material,
  matMetal: THREE.Material
): void {
  const musloCentroZ = perfil.anillosClave.muslo.desplazamientoZ;
  const hubY = Math.max(0.24, Math.min(0.42, perfil.musloYM * 0.56));
  const altoPoste = Math.max(0.15, perfil.musloYM - hubY + 0.04);

  // Poste central
  const posteGeo = new THREE.CylinderGeometry(0.014, 0.017, altoPoste, 16);
  const posteMesh = new THREE.Mesh(posteGeo, matMetal);
  posteMesh.position.set(0, hubY + altoPoste * 0.5 - 0.02, musloCentroZ);
  grupo.add(posteMesh);

  // Anillo/nudo torneado de unión
  const lathePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.036, 0.0),
    new THREE.Vector2(0.044, 0.025),
    new THREE.Vector2(0.028, 0.055),
    new THREE.Vector2(0.038, 0.085),
    new THREE.Vector2(0.022, 0.115),
    new THREE.Vector2(0.0, 0.12),
  ];
  const hubGeo = new THREE.LatheGeometry(lathePts, 28);
  const hubMesh = new THREE.Mesh(hubGeo, matMadera);
  hubMesh.position.set(0, hubY - 0.05, musloCentroZ);
  grupo.add(hubMesh);

  // Base inferior / plato decorativo bajo muslo
  const cuelloBasePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.042, 0.0),
    new THREE.Vector2(0.035, 0.022),
    new THREE.Vector2(0.02, 0.035),
    new THREE.Vector2(0.0, 0.035),
  ];
  const collarGeo = new THREE.LatheGeometry(cuelloBasePts, 24);
  const collarMesh = new THREE.Mesh(collarGeo, matMadera);
  collarMesh.position.set(0, perfil.musloYM - 0.025, musloCentroZ);
  grupo.add(collarMesh);

  // Trípode de 3 patas de madera desde hubY hacia el piso (y = 0)
  const radioPiso = Math.max(0.19, Math.min(0.27, perfil.alturaTotalM * 0.145));
  const origenY = hubY - 0.01;

  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const pInicio = new THREE.Vector3(
      Math.sin(ang) * 0.026,
      origenY,
      musloCentroZ + Math.cos(ang) * 0.026
    );
    const pFin = new THREE.Vector3(
      Math.sin(ang) * radioPiso,
      0.008,
      musloCentroZ + Math.cos(ang) * radioPiso
    );
    const dir = new THREE.Vector3().subVectors(pFin, pInicio);
    const len = dir.length();

    const pataGeo = new THREE.CylinderGeometry(0.017, 0.011, len, 12);
    const pataMesh = new THREE.Mesh(pataGeo, matMadera);
    pataMesh.position.copy(pInicio).addScaledVector(dir, 0.5);
    pataMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    grupo.add(pataMesh);

    const taponGeo = new THREE.CylinderGeometry(0.013, 0.015, 0.016, 12);
    const taponMesh = new THREE.Mesh(taponGeo, matMetal);
    taponMesh.position.set(pFin.x, 0.008, pFin.z);
    grupo.add(taponMesh);
  }
}

/**
 * Construye cilindro orientado entre dos puntos 3D (para brazos y piernas guía).
 */
function crearSegmentoExtremidad(
  pInicio: THREE.Vector3,
  pFin: THREE.Vector3,
  rTop: number,
  rBot: number,
  mat: THREE.Material
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(pFin, pInicio);
  const len = Math.max(0.02, dir.length());
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, 14);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pInicio).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  return mesh;
}

/**
 * Agrega brazos guía (~22° separados del torso) y piernas guía semitransparentes
 * (`opacity: 0.35`, `depthWrite: false`) para dar volumen real a mangas, pantalones y faldas largas.
 */
function poblarExtremidadesGuia(
  grupo: THREE.Group,
  perfil: PerfilCuerpo,
  matGuia: THREE.Material
): void {
  const hombros = perfil.anillosClave.hombros;
  const cadera = perfil.anillosClave.cadera;
  const busto = perfil.anillosClave.busto;

  const escalaHumana = clamp(perfil.alturaTotalM / 1.65, 0.55, 1.18);
  const angBrazoRad = (22 * Math.PI) / 180;
  const largoBrazoTotal = Math.max(perfil.largoMangaM, 0.46 * escalaHumana);
  const largoSupBrazo = largoBrazoTotal * 0.48;
  const largoAntebrazo = largoBrazoTotal * 0.46;

  // 1. Brazos izquierdo (+X) y derecho (-X)
  for (const lado of [-1, 1] as const) {
    const pHombro = new THREE.Vector3(
      lado * (hombros.a * 1.02 + 0.008),
      hombros.y - 0.022 * escalaHumana,
      hombros.desplazamientoZ
    );
    const dirSup = new THREE.Vector3(
      lado * Math.sin(angBrazoRad),
      -Math.cos(angBrazoRad),
      -0.05
    ).normalize();
    const pCodo = pHombro.clone().addScaledVector(dirSup, largoSupBrazo);

    const dirAnt = new THREE.Vector3(
      lado * Math.sin(angBrazoRad * 0.72),
      -Math.cos(angBrazoRad * 0.72),
      0.16
    ).normalize();
    const pMuneca = pCodo.clone().addScaledVector(dirAnt, largoAntebrazo);

    const rHombro = clamp(busto.a * 0.28, 0.028, 0.055);
    const rCodo = rHombro * 0.78;
    const rMuneca = rHombro * 0.56;

    const esfHombro = new THREE.Mesh(
      new THREE.SphereGeometry(rHombro, 14, 10),
      matGuia
    );
    esfHombro.position.copy(pHombro);
    grupo.add(esfHombro);

    grupo.add(
      crearSegmentoExtremidad(pHombro, pCodo, rHombro * 0.94, rCodo, matGuia)
    );

    const esfCodo = new THREE.Mesh(
      new THREE.SphereGeometry(rCodo, 12, 10),
      matGuia
    );
    esfCodo.position.copy(pCodo);
    grupo.add(esfCodo);

    grupo.add(
      crearSegmentoExtremidad(pCodo, pMuneca, rCodo * 0.96, rMuneca, matGuia)
    );

    const esfMuneca = new THREE.Mesh(
      new THREE.SphereGeometry(rMuneca * 1.05, 12, 10),
      matGuia
    );
    esfMuneca.position.copy(pMuneca);
    grupo.add(esfMuneca);
  }

  // 2. Piernas guía desde el muslo superior hasta el tobillo
  const rMusloEst = clamp(
    perfil.contornoMusloM / (2 * Math.PI),
    0.045,
    cadera.a * 0.54
  );
  const rRodilla = rMusloEst * 0.68;
  const rTobillo = rMusloEst * 0.44;
  const xMuslo = Math.max(rMusloEst * 0.96, cadera.a * 0.46);
  const zBase = perfil.anillosClave.muslo.desplazamientoZ;

  for (const lado of [-1, 1] as const) {
    const pMuslo = new THREE.Vector3(lado * xMuslo, perfil.musloYM + 0.03, zBase);
    const pRodilla = new THREE.Vector3(
      lado * (xMuslo * 0.86),
      perfil.alturaRodillaM,
      zBase + 0.008
    );
    const pTobillo = new THREE.Vector3(
      lado * (xMuslo * 0.78),
      perfil.alturaTobilloM,
      zBase
    );

    const esfCadera = new THREE.Mesh(
      new THREE.SphereGeometry(rMusloEst * 0.94, 14, 10),
      matGuia
    );
    esfCadera.position.copy(pMuslo);
    grupo.add(esfCadera);

    grupo.add(
      crearSegmentoExtremidad(pMuslo, pRodilla, rMusloEst * 0.94, rRodilla, matGuia)
    );

    const esfRodilla = new THREE.Mesh(
      new THREE.SphereGeometry(rRodilla, 12, 10),
      matGuia
    );
    esfRodilla.position.copy(pRodilla);
    grupo.add(esfRodilla);

    grupo.add(
      crearSegmentoExtremidad(pRodilla, pTobillo, rRodilla * 0.96, rTobillo, matGuia)
    );

    const esfTobillo = new THREE.Mesh(
      new THREE.SphereGeometry(rTobillo * 1.05, 12, 10),
      matGuia
    );
    esfTobillo.position.copy(pTobillo);
    grupo.add(esfTobillo);
  }
}

/**
 * Crea el maniquí anatómico completo de modistería reutilizando materiales y texturas
 * cuando cambian las medidas (`actualizar` solo reconstruye geometrías).
 */
export function crearManiqui(perfilInicial: PerfilCuerpo): ManiquiInstancia {
  const grupo = new THREE.Group();
  grupo.name = "maniqui-atelier";

  const { colorMap, bumpMap } = crearTexturaManiqui(perfilInicial);

  const materialTorso = new THREE.MeshStandardMaterial({
    map: colorMap,
    bumpMap,
    bumpScale: 0.0025,
    roughness: 0.86,
    metalness: 0.02,
  });

  const materialMadera = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#4B2E1E"),
    roughness: 0.44,
    metalness: 0.05,
  });

  const materialMetal = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#332F2C"),
    roughness: 0.35,
    metalness: 0.65,
  });

  const materialGuia = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#D8CEC0"),
    roughness: 0.72,
    metalness: 0.04,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  const materialesCompartidos = new Set<THREE.Material>([
    materialTorso,
    materialMadera,
    materialMetal,
    materialGuia,
  ]);
  const texturasCompartidas = new Set<THREE.Texture>([colorMap, bumpMap]);

  const grupoGeometria = new THREE.Group();
  grupoGeometria.name = "maniqui-geometria-dinamica";
  grupo.add(grupoGeometria);

  const construirContenido = (perfil: PerfilCuerpo) => {
    disposeObject(grupoGeometria, {
      preservarMateriales: materialesCompartidos,
      preservarTexturas: texturasCompartidas,
    });
    grupoGeometria.clear();

    // 1. Torso de lino crudo con costuras estructurales
    const torsoGeo = construirGeometriaTorso(perfil);
    const torsoMesh = new THREE.Mesh(torsoGeo, materialTorso);
    torsoMesh.name = "maniqui-torso";
    grupoGeometria.add(torsoMesh);

    // 2. Tapa de cuello torneada
    const cuello = perfil.anillosClave.cuello;
    const tapaCuelloGeo = construirTapaCuello(cuello);
    const tapaCuelloMesh = new THREE.Mesh(tapaCuelloGeo, materialMadera);
    tapaCuelloMesh.position.set(0, cuello.y - 0.002, cuello.desplazamientoZ);
    grupoGeometria.add(tapaCuelloMesh);

    // 3. Pedestal / trípode de madera oscura
    poblarPedestal(grupoGeometria, perfil, materialMadera, materialMetal);

    // 4. Brazos y piernas guía semitransparentes
    poblarExtremidadesGuia(grupoGeometria, perfil, materialGuia);
  };

  construirContenido(perfilInicial);

  return {
    grupo,
    materialesCompartidos,
    texturasCompartidas,
    actualizar: construirContenido,
  };
}
