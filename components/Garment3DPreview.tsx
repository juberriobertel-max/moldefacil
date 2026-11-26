"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Activity,
  AlertTriangle,
  Camera,
  Eye,
  Grid,
  Layers,
  RotateCw,
  Scissors,
  Share2,
  Sliders,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { PatternPiece } from "@/lib/types";
import { getBodyProfile } from "@/lib/3d/bodyProfile";
import { disposeObject } from "@/lib/3d/disposal";
import {
  animarCaidaTelas,
  configurarIluminacionYEntorno3D,
  configurarRendererEscena3D,
  crearRepositorioMateriales,
  crearSombraContactoPedestal,
  IluminacionEntorno3D,
  PROPIEDADES_FISICAS_TELA,
  RepositorioMaterialesTela,
  SombraContactoPedestal,
} from "@/lib/3d/fabricMaterials";
import {
  aplicarMapaCalceEnPrenda,
  aplicarResaltadoPieza,
  buscarPieceIdPorZona3D,
  construirMallaPrenda,
  Etiqueta3DProyectada,
  mapearPieceIdAZona3D,
  proyectarEtiquetas3D,
  ResultadoMallaPrenda,
  ZonaPieza3D,
} from "@/lib/3d/garmentMeshBuilder";
import { cargarManiquiGLB } from "@/lib/3d/glbMannequinLoader";
import { crearManiqui, ManiquiInstancia } from "@/lib/3d/mannequinBuilder";
import {
  AcabadoManiqui3D,
  Apariencia,
  COLORES_RAPIDOS,
  ConfigPrenda,
  Medidas,
  NivelDetalle3D,
  PALETA_UI_3D,
  PerfilCuerpo,
  POSES_MANIQUI_3D,
  PoseManiquiTipo,
  TipoEstampado,
  TipoTela,
} from "@/lib/3d/types";

export interface Garment3DPreviewProps {
  medidas: Medidas;
  config: ConfigPrenda;
  apariencia: Apariencia;
  onAparienciaChange: (siguiente: Apariencia) => void;
  autoGirarInicial?: boolean;
  modoCompacto?: boolean;
  patternPieces?: PatternPiece[];
  activePieceId?: string;
  onActivePieceIdChange?: (pieceId: string) => void;
  onCompartirCreacion?: (capturaDataUrl: string) => void;
}

type VistaCamaraPreset = "frente" | "espalda" | "detalle";
type PopoverActivo = "color" | "estampado" | "tela" | "estudio" | null;

const OPCIONES_POSES: ReadonlyArray<{
  id: PoseManiquiTipo;
  nombre: string;
  desc: string;
}> = [
  { id: "relajada", nombre: "Relajada", desc: "Postura natural de taller" },
  { id: "pasarela", nombre: "Pasarela", desc: "Paso estilizado en movimiento" },
  { id: "brazosAbiertos", nombre: "Brazos 45°", desc: "Despeja sisa y kimono" },
];

const OPCIONES_MANIQUI: ReadonlyArray<{
  id: AcabadoManiqui3D;
  nombre: string;
  color: string;
}> = [
  { id: "lino", nombre: "Lino Claro", color: "#D9D9D6" },
  { id: "grafito", nombre: "Grafito Mate", color: "#35383D" },
  { id: "madera", nombre: "Madera Sastre", color: "#C89D74" },
];

const NOMBRES_PRENDA_UI: Record<ConfigPrenda["prenda"], string> = {
  vestido: "Vestido",
  blusa: "Blusa / Top",
  falda: "Falda",
  pantalon: "Pantalón",
  chaqueta: "Chaqueta / Blazer",
  enterizo: "Enterizo",
  bucketHat: "Sombrero Pescador",
};

const OPCIONES_ESTAMPADO: ReadonlyArray<{
  id: TipoEstampado;
  nombre: string;
  desc: string;
}> = [
  { id: "liso", nombre: "Liso", desc: "Tejido uniforme" },
  { id: "lunares", nombre: "Lunares", desc: "Motivo clásico" },
  { id: "rayas", nombre: "Rayas Sastre", desc: "Líneas verticales" },
  { id: "vichy", nombre: "Cuadros Vichy", desc: "Trama bicolora" },
];

const OPCIONES_TELA: ReadonlyArray<{
  id: TipoTela;
  nombre: string;
  desc: string;
}> = [
  { id: "seda", nombre: "Seda / Satén", desc: "Brillo fluido y caída ligera" },
  { id: "crepe", nombre: "Crepé / Viscosa", desc: "Caída con cuerpo y mate suave" },
  { id: "lino", nombre: "Lino / Gabardina", desc: "Trama marcada, silueta firme" },
  { id: "licra", nombre: "Licra / Punto", desc: "Ajuste ceñido elástico" },
];

const DURACION_TRANSICION_CAMARA_MS = 600;
const DURACION_ASENTAMIENTO_CAIDA_MS = 1200;

interface CamaraObjetivo {
  posicion: THREE.Vector3;
  target: THREE.Vector3;
}

interface TransicionCamara {
  inicioMs: number;
  duracionMs: number;
  posInicio: THREE.Vector3;
  posFin: THREE.Vector3;
  targetInicio: THREE.Vector3;
  targetFin: THREE.Vector3;
}

interface EstadoMotor3D {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  iluminacion: IluminacionEntorno3D;
  sombra: SombraContactoPedestal;
  repoMateriales: RepositorioMaterialesTela;
  maniqui: ManiquiInstancia;
  perfilActual: PerfilCuerpo;
  prendaActual: ResultadoMallaPrenda;
  nivelDetalleActual: NivelDetalle3D;
  configActual: ConfigPrenda;
  medidasActual: Medidas;
  poseActual: PoseManiquiTipo;
  telaActual: TipoTela;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function calcularNivelDetalleViewport(anchoPx: number): NivelDetalle3D {
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return anchoPx < 640 || cores <= 4 ? "movil" : "escritorio";
}

function actualizarLimitesOrbitControls(
  controls: OrbitControls,
  perfil: PerfilCuerpo
): void {
  const h = Math.max(0.75, perfil.alturaTotalM);
  controls.minDistance = Math.min(0.85, Math.max(0.42, h * 0.36));
  controls.maxDistance = Math.min(6.2, Math.max(2.6, h * 3.15));
  controls.maxPolarAngle = Math.PI * 0.52;
}

function calcularPoseCamaraPreset(
  preset: VistaCamaraPreset,
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  aspect: number
): CamaraObjetivo {
  const esSombrero = config.prenda === "bucketHat";
  const esCartuchera = config.subEstiloEspecial === "zipper_pouch";
  const distFactor = aspect < 0.85 ? 1.18 : 1.0;
  const h = Math.max(0.8, perfil.alturaTotalM);

  if (esCartuchera) {
    const dCartuchera = 0.56 * distFactor;
    const zSigno = preset === "espalda" ? -1 : 1;
    const xOff = preset === "detalle" ? 0.14 : 0.08;
    return {
      posicion: new THREE.Vector3(xOff, 0.99, zSigno * dCartuchera),
      target: new THREE.Vector3(0, 0.92, 0),
    };
  }

  // Detalle Escote hace zoom al pecho y cuello (o cabeza si la prenda es bucketHat)
  if (preset === "detalle") {
    if (esSombrero) {
      const cCabeza = perfil.trayectorias.centroCabeza;
      const distDetalleHat = Math.max(0.58, h * 0.44) * distFactor;
      return {
        posicion: new THREE.Vector3(0.16 * h, cCabeza[1] + 0.08, distDetalleHat),
        target: new THREE.Vector3(cCabeza[0], cCabeza[1] + 0.02, cCabeza[2]),
      };
    }

    const yEscote = (perfil.cuelloYM + perfil.bustoYM) * 0.5 - 0.01;
    const distDetalleEscote = Math.max(0.62, h * 0.52) * distFactor;
    return {
      posicion: new THREE.Vector3(0.12 * h, yEscote + 0.05 * h, distDetalleEscote),
      target: new THREE.Vector3(0, yEscote, 0.03),
    };
  }

  // Frente y Espalda encuadran el cuerpo completo de pies (y=0) a cabeza (y=alturaTotalM)
  const centroY = h * 0.48;
  const distanciaCuerpoCompleto = h * 1.72 * distFactor;

  if (preset === "espalda") {
    return {
      posicion: new THREE.Vector3(0, centroY + 0.03 * h, -distanciaCuerpoCompleto),
      target: new THREE.Vector3(0, centroY, 0),
    };
  }

  return {
    posicion: new THREE.Vector3(0, centroY + 0.03 * h, distanciaCuerpoCompleto),
    target: new THREE.Vector3(0, centroY, 0),
  };
}

/**
 * Simulador interactivo 3D de prendas, telas y costuras basado en Three.js puro
 * (renderizado bajo demanda, limpieza estricta WebGL y barra flotante accesible en español).
 */
export default function Garment3DPreview({
  medidas,
  config,
  apariencia,
  onAparienciaChange,
  autoGirarInicial = false,
  modoCompacto = false,
  patternPieces,
  activePieceId,
  onActivePieceIdChange,
  onCompartirCreacion,
}: Garment3DPreviewProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const motorRef = useRef<EstadoMotor3D | null>(null);

  const aparienciaRef = useRef<Apariencia>(apariencia);
  const configRef = useRef<ConfigPrenda>(config);
  const medidasRef = useRef<Medidas>(medidas);
  const patternPiecesRef = useRef<PatternPiece[] | undefined>(patternPieces);
  const activePieceIdRef = useRef<string | undefined>(activePieceId);
  const onActivePieceIdChangeRef = useRef<((pieceId: string) => void) | undefined>(
    onActivePieceIdChange
  );

  const [popoverAbierto, setPopoverAbierto] = useState<PopoverActivo>(null);

  const [autoGirar, setAutoGirar] = useState<boolean>(autoGirarInicial);
  const autoGirarRef = useRef<boolean>(autoGirar);

  const [vistaActiva, setVistaActiva] = useState<VistaCamaraPreset | null>("frente");
  const [etiquetasUI, setEtiquetasUI] = useState<Etiqueta3DProyectada[]>([]);
  const [triangulosUI, setTriangulosUI] = useState<number>(0);
  const [ultimoBuildMs, setUltimoBuildMs] = useState<number>(0);
  const [webglError, setWebglError] = useState<boolean>(false);
  const [contextoPerdido, setContextoPerdido] = useState<boolean>(false);
  const [reinitTick, setReinitTick] = useState<number>(0);

  const transicionRef = useRef<TransicionCamara | null>(null);
  const necesitaRenderRef = useRef<boolean>(true);
  const enPantallaRef = useRef<boolean>(true);
  const dampingActivoRef = useRef<boolean>(false);
  const caidaHastaRef = useRef<number>(0);
  const ultimaProyeccionStrRef = useRef<string>("");
  const debounceTimerRef = useRef<number | null>(null);

  const solicitarRender = useCallback((conCaidaBreve = false) => {
    necesitaRenderRef.current = true;
    if (conCaidaBreve && typeof performance !== "undefined") {
      caidaHastaRef.current = performance.now() + DURACION_ASENTAMIENTO_CAIDA_MS;
    }
  }, []);

  const reconstruirPrendaEnMotor = useCallback(
    (motor: EstadoMotor3D, perfil: PerfilCuerpo, nextConfig: ConfigPrenda) => {
      const previa = motor.prendaActual;
      motor.scene.remove(previa.grupo);
      disposeObject(previa.grupo, {
        preservarMateriales: motor.repoMateriales.materialesCompartidos(),
        preservarTexturas: motor.repoMateriales.texturasCacheadas(),
      });

      const ap = aparienciaRef.current;
      const nueva = construirMallaPrenda(perfil, nextConfig, {
        nivelDetalle: motor.nivelDetalleActual,
        materialPrincipal: motor.repoMateriales.obtenerMaterial(ap),
        materialSecundario: motor.repoMateriales.obtenerMaterialSecundario(ap),
        materialForroOVista: motor.repoMateriales.obtenerMaterialVista(ap),
        mostrarCosturas: ap.mostrarCosturas,
        ajusteTelaStretchM: PROPIEDADES_FISICAS_TELA[ap.tela].ajusteStretchM,
        tipoTela: ap.tela,
      });
      motor.maniqui.mostrarCintasGuia(
        Boolean(ap.mostrarCosturas || ap.mostrarMapaCalce)
      );
      nueva.grupoCintasMetricas.visible = Boolean(
        ap.mostrarCosturas || ap.mostrarMapaCalce
      );
      aplicarMapaCalceEnPrenda(
        nueva.grupo,
        perfil,
        motor.repoMateriales.obtenerMaterialMapaCalce(),
        Boolean(ap.mostrarMapaCalce)
      );
      if (!ap.mostrarMapaCalce) {
        aplicarResaltadoPieza(
          nueva.grupo,
          activePieceIdRef.current,
          motor.repoMateriales.obtenerMaterialResaltado(ap),
          false
        );
      }

      motor.scene.add(nueva.grupo);
      motor.prendaActual = nueva;
      motor.configActual = nextConfig;
      setTriangulosUI(nueva.triangulosTotales);
      return nueva;
    },
    []
  );

  // Cierre de popover por tecla Escape o clic fuera de la barra inferior
  useEffect(() => {
    if (!popoverAbierto) return;
    const manejarKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setPopoverAbierto(null);
    };
    const manejarPointer = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.closest("[data-barra-flotante-3d]")) {
        setPopoverAbierto(null);
      }
    };
    window.addEventListener("keydown", manejarKey);
    window.addEventListener("pointerdown", manejarPointer);
    return () => {
      window.removeEventListener("keydown", manejarKey);
      window.removeEventListener("pointerdown", manejarPointer);
    };
  }, [popoverAbierto]);

  // Sincronizar refs fuera del render (cumple react-hooks/refs)
  useEffect(() => {
    aparienciaRef.current = apariencia;
    configRef.current = config;
    medidasRef.current = medidas;
    autoGirarRef.current = autoGirar;
    patternPiecesRef.current = patternPieces;
    activePieceIdRef.current = activePieceId;
    onActivePieceIdChangeRef.current = onActivePieceIdChange;
  }, [
    apariencia,
    config,
    medidas,
    autoGirar,
    patternPieces,
    activePieceId,
    onActivePieceIdChange,
  ]);

  // Al abrir o cerrar menú también se despierta el render bajo demanda según especificación
  useEffect(() => {
    solicitarRender(false);
  }, [popoverAbierto, solicitarRender]);

  // Montaje único y limpieza estricta del motor WebGL / Three.js
  useEffect(() => {
    const cont = contenedorRef.current;
    const host = canvasHostRef.current;
    if (!cont || !host) return;

    const widthIni = Math.max(280, host.clientWidth || cont.clientWidth || 640);
    const heightIni = Math.max(360, host.clientHeight || cont.clientHeight || 520);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setWebglError(true));
      return;
    }

    configurarRendererEscena3D(renderer);
    renderer.setSize(widthIni, heightIni, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      setContextoPerdido(true);
    };
    const onContextRestored = () => {
      setContextoPerdido(false);
      setReinitTick((t) => t + 1);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETA_UI_3D.crema);

    const camera = new THREE.PerspectiveCamera(38, widthIni / heightIni, 0.08, 25);
    const iluminacion = configurarIluminacionYEntorno3D(scene, renderer);
    const sombra = crearSombraContactoPedestal();
    scene.add(sombra.mesh);

    const repoMateriales = crearRepositorioMateriales(renderer);
    const poseIni: PoseManiquiTipo = aparienciaRef.current.poseManiqui ?? "relajada";
    const perfilIni = getBodyProfile(medidasRef.current, POSES_MANIQUI_3D[poseIni]);
    const maniqui = crearManiqui(perfilIni);
    maniqui.aplicarAcabado(aparienciaRef.current.acabadoManiqui ?? "lino");
    maniqui.mostrarCintasGuia(
      Boolean(
        aparienciaRef.current.mostrarCosturas ||
          aparienciaRef.current.mostrarMapaCalce
      )
    );
    const esCartucheraIni =
      configRef.current.subEstiloEspecial === "zipper_pouch";
    maniqui.grupo.visible = !esCartucheraIni;
    sombra.mesh.visible = !esCartucheraIni;
    scene.add(maniqui.grupo);

    const nivelDetalleIni = calcularNivelDetalleViewport(widthIni);
    const telaIni = aparienciaRef.current.tela;
    const t0 = performance.now();
    const prendaIni = construirMallaPrenda(perfilIni, configRef.current, {
      nivelDetalle: nivelDetalleIni,
      materialPrincipal: repoMateriales.obtenerMaterial(aparienciaRef.current),
      materialSecundario: repoMateriales.obtenerMaterialSecundario(
        aparienciaRef.current
      ),
      materialForroOVista: repoMateriales.obtenerMaterialVista(
        aparienciaRef.current
      ),
      mostrarCosturas: aparienciaRef.current.mostrarCosturas,
      ajusteTelaStretchM: PROPIEDADES_FISICAS_TELA[telaIni].ajusteStretchM,
      tipoTela: telaIni,
    });
    prendaIni.grupoCintasMetricas.visible = Boolean(
      aparienciaRef.current.mostrarCosturas ||
        aparienciaRef.current.mostrarMapaCalce
    );
    aplicarMapaCalceEnPrenda(
      prendaIni.grupo,
      perfilIni,
      repoMateriales.obtenerMaterialMapaCalce(),
      Boolean(aparienciaRef.current.mostrarMapaCalce)
    );
    if (!aparienciaRef.current.mostrarMapaCalce) {
      aplicarResaltadoPieza(
        prendaIni.grupo,
        activePieceIdRef.current,
        repoMateriales.obtenerMaterialResaltado(aparienciaRef.current),
        false
      );
    }
    const buildMs = Math.round(performance.now() - t0);
    scene.add(prendaIni.grupo);
    setTriangulosUI(prendaIni.triangulosTotales);
    setUltimoBuildMs(buildMs);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minPolarAngle = 0.25;
    controls.autoRotateSpeed = 1.65;
    actualizarLimitesOrbitControls(controls, perfilIni);

    const poseInicial = calcularPoseCamaraPreset(
      "frente",
      perfilIni,
      configRef.current,
      widthIni / heightIni
    );
    camera.position.copy(poseInicial.posicion);
    controls.target.copy(poseInicial.target);
    controls.update();

    const motor: EstadoMotor3D = {
      scene,
      camera,
      renderer,
      controls,
      iluminacion,
      sombra,
      repoMateriales,
      maniqui,
      perfilActual: perfilIni,
      prendaActual: prendaIni,
      nivelDetalleActual: nivelDetalleIni,
      configActual: configRef.current,
      medidasActual: medidasRef.current,
      poseActual: poseIni,
      telaActual: telaIni,
    };
    motorRef.current = motor;

    // Sustitución progresiva del maniquí base por el modelo humano 3D esculpido (`base-female.glb`)
    void cargarManiquiGLB(perfilIni).then((maniquiGlb) => {
      if (desmontado || !maniquiGlb || motorRef.current !== motor) {
        if (maniquiGlb) {
          disposeObject(maniquiGlb.grupo);
        }
        return;
      }

      const prevManiqui = motor.maniqui;
      const perfilBase = getBodyProfile(
        motor.medidasActual,
        POSES_MANIQUI_3D[motor.poseActual]
      );
      const perfilCalibrado = maniquiGlb.calibrarPerfilPrenda
        ? maniquiGlb.calibrarPerfilPrenda(perfilBase)
        : perfilBase;

      maniquiGlb.actualizar(perfilCalibrado);
      maniquiGlb.aplicarAcabado(aparienciaRef.current.acabadoManiqui ?? "lino");
      const esCartucheraActual =
        motor.configActual.subEstiloEspecial === "zipper_pouch";
      maniquiGlb.grupo.visible = !esCartucheraActual;

      scene.remove(prevManiqui.grupo);
      disposeObject(prevManiqui.grupo);
      scene.add(maniquiGlb.grupo);
      motor.maniqui = maniquiGlb;
      motor.perfilActual = perfilCalibrado;

      actualizarLimitesOrbitControls(motor.controls, perfilCalibrado);
      reconstruirPrendaEnMotor(motor, perfilCalibrado, motor.configActual);

      const poseCam = calcularPoseCamaraPreset(
        "frente",
        perfilCalibrado,
        motor.configActual,
        motor.camera.aspect
      );
      motor.camera.position.copy(poseCam.posicion);
      motor.controls.target.copy(poseCam.target);
      motor.controls.update();

      ultimaProyeccionStrRef.current = "__dirty__";
      solicitarRender(true);
    });

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;
    const onPointerDownCanvas = (ev: PointerEvent) => {
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
    };
    const onPointerUpCanvas = (ev: PointerEvent) => {
      const fn = onActivePieceIdChangeRef.current;
      const piezas = patternPiecesRef.current;
      if (!fn || !piezas || piezas.length === 0) return;
      if (Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY) > 6) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const objetivos = motor.prendaActual.grupo.children.filter(
        (c) =>
          c !== motor.prendaActual.grupoCosturas &&
          c !== motor.prendaActual.grupoCintasMetricas
      );
      const hits = raycaster.intersectObjects(objetivos, true);
      const hitConZona = hits.find((h) => Boolean(h.object.userData?.zonaPieza));
      if (!hitConZona) return;

      const zona = hitConZona.object.userData.zonaPieza as ZonaPieza3D;
      const thetaClick = Math.atan2(hitConZona.point.x, hitConZona.point.z);
      const resuelto = buscarPieceIdPorZona3D(zona, piezas, thetaClick);
      if (resuelto) {
        fn(activePieceIdRef.current === resuelto ? "all" : resuelto);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDownCanvas);
    renderer.domElement.addEventListener("pointerup", onPointerUpCanvas);

    const onControlStart = () => {
      transicionRef.current = null;
      setVistaActiva(null);
      dampingActivoRef.current = true;
      solicitarRender(false);
    };
    const onControlChange = () => {
      dampingActivoRef.current = true;
      solicitarRender(false);
    };
    controls.addEventListener("start", onControlStart);
    controls.addEventListener("change", onControlChange);

    // Pausar completamente cuando el lienzo queda fuera del viewport
    const intersectionObs = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        enPantallaRef.current = visible;
        if (visible) solicitarRender(false);
      },
      { threshold: 0.05 }
    );
    intersectionObs.observe(cont);

    const resizeObs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(200, Math.round(entry.contentRect.width));
      const h = Math.max(260, Math.round(entry.contentRect.height));
      motor.camera.aspect = w / h;
      motor.camera.updateProjectionMatrix();
      motor.renderer.setSize(w, h, false);
      const nuevoDetalle = calcularNivelDetalleViewport(w);
      if (nuevoDetalle !== motor.nivelDetalleActual) {
        motor.nivelDetalleActual = nuevoDetalle;
        reconstruirPrendaEnMotor(motor, motor.perfilActual, motor.configActual);
      }
      solicitarRender(false);
    });
    resizeObs.observe(host);

    let rafId = 0;
    let desmontado = false;
    const prevCamPos = camera.position.clone();
    const prevTarget = controls.target.clone();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const bucle = (ahoraMs: number) => {
      if (desmontado) return;
      rafId = window.requestAnimationFrame(bucle);

      if (!enPantallaRef.current || document.hidden) {
        return;
      }

      const reducirMov = motionQuery.matches;
      let activo = necesitaRenderRef.current;

      // Transición suave de cámara (~600 ms eased)
      const trans = transicionRef.current;
      if (trans) {
        const elapsed = ahoraMs - trans.inicioMs;
        const u = Math.min(1, elapsed / trans.duracionMs);
        const k = reducirMov ? 1 : easeInOutCubic(u);
        camera.position.lerpVectors(trans.posInicio, trans.posFin, k);
        controls.target.lerpVectors(trans.targetInicio, trans.targetFin, k);
        activo = true;
        if (u >= 1) {
          transicionRef.current = null;
        }
      }

      // Auto-rotación 360° respetando prefers-reduced-motion
      controls.autoRotate = autoGirarRef.current && !reducirMov;
      if (controls.autoRotate) {
        activo = true;
      }

      // Caída de tela en vivo mientras gira 360° o durante ventana breve de asentamiento
      const animandoCaida =
        !reducirMov &&
        (controls.autoRotate || ahoraMs <= caidaHastaRef.current);
      if (animandoCaida) {
        animarCaidaTelas(
          motor.prendaActual.grupo,
          aparienciaRef.current.tela,
          ahoraMs * 0.001,
          false
        );
        activo = true;
      } else if (reducirMov) {
        if (
          animarCaidaTelas(
            motor.prendaActual.grupo,
            aparienciaRef.current.tela,
            0,
            true
          )
        ) {
          activo = true;
        }
      }

      if (dampingActivoRef.current || controls.autoRotate || trans) {
        controls.update();
        const deltaCam =
          prevCamPos.distanceToSquared(camera.position) +
          prevTarget.distanceToSquared(controls.target);
        if (deltaCam > 1e-8) {
          activo = true;
        } else if (!controls.autoRotate && !trans) {
          dampingActivoRef.current = false;
        }
        prevCamPos.copy(camera.position);
        prevTarget.copy(controls.target);
      }

      if (!activo) return;

      necesitaRenderRef.current = false;
      renderer.render(scene, camera);

      // Proyectar etiquetas 3D -> HTML cuando "Ver Costuras" o "Mapa de Calce" están activos
      const mostrarEtiquetas = Boolean(
        aparienciaRef.current.mostrarCosturas ||
          aparienciaRef.current.mostrarMapaCalce
      );
      if (mostrarEtiquetas) {
        const wPx = renderer.domElement.clientWidth || widthIni;
        const hPx = renderer.domElement.clientHeight || heightIni;
        const etiquetasObjetivo = aparienciaRef.current.mostrarCosturas
          ? motor.prendaActual.etiquetas
          : motor.prendaActual.etiquetas.filter((e) =>
              e.id.startsWith("lbl-medida-")
            );
        const proyectadas = proyectarEtiquetas3D(
          etiquetasObjetivo,
          motor.prendaActual.grupo,
          camera,
          wPx,
          hPx
        );
        const clave = proyectadas
          .map(
            (e) =>
              `${e.id}:${e.visible ? 1 : 0}:${Math.round(e.xPx)}:${Math.round(e.yPx)}`
          )
          .join("|");
        if (clave !== ultimaProyeccionStrRef.current) {
          ultimaProyeccionStrRef.current = clave;
          setEtiquetasUI(proyectadas);
        }
      } else if (ultimaProyeccionStrRef.current !== "") {
        ultimaProyeccionStrRef.current = "";
        setEtiquetasUI([]);
      }
    };

    solicitarRender(false);
    rafId = window.requestAnimationFrame(bucle);

    return () => {
      desmontado = true;
      window.cancelAnimationFrame(rafId);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      intersectionObs.disconnect();
      resizeObs.disconnect();
      controls.removeEventListener("start", onControlStart);
      controls.removeEventListener("change", onControlChange);
      controls.dispose();

      renderer.domElement.removeEventListener("pointerdown", onPointerDownCanvas);
      renderer.domElement.removeEventListener("pointerup", onPointerUpCanvas);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      disposeObject(motor.prendaActual.grupo, {
        preservarMateriales: repoMateriales.materialesCompartidos(),
        preservarTexturas: repoMateriales.texturasCacheadas(),
      });
      scene.remove(motor.prendaActual.grupo);

      // Al desmontar liberamos maniquí activo completo (geometrías, materiales y su textura cruda)
      disposeObject(motor.maniqui.grupo);
      scene.remove(motor.maniqui.grupo);

      sombra.dispose();
      iluminacion.dispose();
      repoMateriales.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      motorRef.current = null;
    };
  }, [reinitTick, solicitarRender, reconstruirPrendaEnMotor]);

  // Actualización INSTANTÁNEA de material, textura, calce, maniquí y toggle de costuras
  useEffect(() => {
    const motor = motorRef.current;
    if (!motor) return;

    motor.repoMateriales.obtenerMaterial(apariencia);
    motor.repoMateriales.obtenerMaterialSecundario(apariencia);
    motor.repoMateriales.obtenerMaterialVista(apariencia);
    motor.repoMateriales.obtenerMaterialResaltado(apariencia);

    if (motor.telaActual !== apariencia.tela) {
      motor.telaActual = apariencia.tela;
      reconstruirPrendaEnMotor(motor, motor.perfilActual, motor.configActual);
      ultimaProyeccionStrRef.current = "__dirty__";
      solicitarRender(true);
      return;
    }

    motor.maniqui.aplicarAcabado(apariencia.acabadoManiqui ?? "lino");
    motor.maniqui.mostrarCintasGuia(
      Boolean(apariencia.mostrarCosturas || apariencia.mostrarMapaCalce)
    );
    motor.prendaActual.grupoCosturas.visible = apariencia.mostrarCosturas;
    motor.prendaActual.grupoCintasMetricas.visible = Boolean(
      apariencia.mostrarCosturas || apariencia.mostrarMapaCalce
    );

    aplicarMapaCalceEnPrenda(
      motor.prendaActual.grupo,
      motor.perfilActual,
      motor.repoMateriales.obtenerMaterialMapaCalce(),
      Boolean(apariencia.mostrarMapaCalce)
    );
    if (!apariencia.mostrarMapaCalce) {
      aplicarResaltadoPieza(
        motor.prendaActual.grupo,
        activePieceIdRef.current,
        motor.repoMateriales.obtenerMaterialResaltado(apariencia),
        false
      );
    }

    ultimaProyeccionStrRef.current = "__dirty__";
    solicitarRender(true);
  }, [apariencia, solicitarRender, reconstruirPrendaEnMotor]);

  // Sincronización 2D -> 3D al seleccionar una pieza activa del molde
  useEffect(() => {
    const motor = motorRef.current;
    if (!motor) return;

    aplicarResaltadoPieza(
      motor.prendaActual.grupo,
      activePieceId,
      motor.repoMateriales.obtenerMaterialResaltado(aparienciaRef.current),
      Boolean(aparienciaRef.current.mostrarMapaCalce)
    );

    const zona = activePieceId ? mapearPieceIdAZona3D(activePieceId) : null;
    if (
      zona === "espalda" ||
      zona === "cuello_vista" ||
      zona === "sombrero" ||
      zona === "cartuchera"
    ) {
      const presetDestino: VistaCamaraPreset =
        zona === "espalda" ? "espalda" : "detalle";
      const destino = calcularPoseCamaraPreset(
        presetDestino,
        motor.perfilActual,
        motor.configActual,
        motor.camera.aspect
      );
      transicionRef.current = {
        inicioMs: performance.now(),
        duracionMs: DURACION_TRANSICION_CAMARA_MS,
        posInicio: motor.camera.position.clone(),
        posFin: destino.posicion,
        targetInicio: motor.controls.target.clone(),
        targetFin: destino.target,
      };
    }

    solicitarRender(false);
  }, [activePieceId, solicitarRender]);

  // Actualización con debounce ~120 ms cuando cambian medidas, configuración o pose del maniquí
  useEffect(() => {
    const motor = motorRef.current;
    if (!motor) return;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      const m = motorRef.current;
      if (!m) return;

      const t0 = performance.now();
      const poseSolicitada: PoseManiquiTipo =
        aparienciaRef.current.poseManiqui ?? "relajada";
      const medidasOPoseCambiaron =
        JSON.stringify(m.medidasActual) !== JSON.stringify(medidas) ||
        m.poseActual !== poseSolicitada;

      let perfil = m.perfilActual;
      if (medidasOPoseCambiaron) {
        const perfilBase = getBodyProfile(medidas, POSES_MANIQUI_3D[poseSolicitada]);
        perfil = m.maniqui.calibrarPerfilPrenda
          ? m.maniqui.calibrarPerfilPrenda(perfilBase)
          : perfilBase;
        m.maniqui.actualizar(perfil);
        actualizarLimitesOrbitControls(m.controls, perfil);
        m.perfilActual = perfil;
        m.medidasActual = medidas;
        m.poseActual = poseSolicitada;
      }

      const eraCartuchera =
        m.configActual.subEstiloEspecial === "zipper_pouch";
      const esCartuchera = config.subEstiloEspecial === "zipper_pouch";
      m.maniqui.grupo.visible = !esCartuchera;
      m.sombra.mesh.visible = !esCartuchera;

      const nueva = reconstruirPrendaEnMotor(m, perfil, config);

      if (eraCartuchera !== esCartuchera) {
        const destino = calcularPoseCamaraPreset(
          "frente",
          perfil,
          config,
          m.camera.aspect
        );
        m.camera.position.copy(destino.posicion);
        m.controls.target.copy(destino.target);
        m.controls.update();
      }

      const elapsed = Math.round(performance.now() - t0);
      setTriangulosUI(nueva.triangulosTotales);
      setUltimoBuildMs(elapsed);
      ultimaProyeccionStrRef.current = "__dirty__";
      solicitarRender(true);
    }, 120);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [medidas, config, apariencia.poseManiqui, solicitarRender, reconstruirPrendaEnMotor]);

  const irAVistaCamara = useCallback(
    (preset: VistaCamaraPreset) => {
      const m = motorRef.current;
      if (!m) return;
      setAutoGirar(false);
      setVistaActiva(preset);
      const destino = calcularPoseCamaraPreset(
        preset,
        m.perfilActual,
        m.configActual,
        m.camera.aspect
      );
      transicionRef.current = {
        inicioMs: performance.now(),
        duracionMs: DURACION_TRANSICION_CAMARA_MS,
        posInicio: m.camera.position.clone(),
        posFin: destino.posicion,
        targetInicio: m.controls.target.clone(),
        targetFin: destino.target,
      };
      solicitarRender(false);
    },
    [solicitarRender]
  );

  const botonesPresets: ReadonlyArray<{ id: VistaCamaraPreset; label: string }> =
    useMemo(
      () => [
        { id: "frente", label: "Frente" },
        { id: "espalda", label: "Espalda" },
        { id: "detalle", label: "Detalle Escote" },
      ],
      []
    );

  const piezaActivaObj = useMemo(
    () =>
      activePieceId && activePieceId !== "all"
        ? patternPieces?.find((p) => p.id === activePieceId) ?? null
        : null,
    [activePieceId, patternPieces]
  );

  const capturarFotoEstudio3D = useCallback(() => {
    const m = motorRef.current;
    if (!m || typeof document === "undefined") return;

    m.renderer.render(m.scene, m.camera);
    const glCanvas = m.renderer.domElement;
    if (glCanvas.width === 0 || glCanvas.height === 0) return;

    const outW = 1080;
    const outH = 1350;
    const cardH = 210;
    const drawAreaH = outH - cardH;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = PALETA_UI_3D.crema;
    ctx.fillRect(0, 0, outW, outH);

    // Encuadre proporcional del lienzo 3D en el área superior
    const scale = Math.min(outW / glCanvas.width, drawAreaH / glCanvas.height);
    const dw = glCanvas.width * scale;
    const dh = glCanvas.height * scale;
    const dx = (outW - dw) * 0.5;
    const dy = (drawAreaH - dh) * 0.5;
    ctx.drawImage(glCanvas, dx, dy, dw, dh);

    // Pie de ficha técnica de taller
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, drawAreaH, outW, cardH);
    ctx.fillStyle = "#E2D6C8";
    ctx.fillRect(0, drawAreaH, outW, 2);

    // Muestras de color de tela
    ctx.beginPath();
    ctx.arc(72, drawAreaH + 86, 26, 0, Math.PI * 2);
    ctx.fillStyle = aparienciaRef.current.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#D8CEC0";
    ctx.stroke();

    if (
      configRef.current.esDosPiezas &&
      aparienciaRef.current.colorSecundario
    ) {
      ctx.beginPath();
      ctx.arc(106, drawAreaH + 96, 18, 0, Math.PI * 2);
      ctx.fillStyle = aparienciaRef.current.colorSecundario;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
    }

    const nombrePrenda =
      configRef.current.esDosPiezas
        ? "Conjunto 2 Piezas"
        : NOMBRES_PRENDA_UI[configRef.current.prenda] ?? "Prenda a Medida";
    const infoTela = PROPIEDADES_FISICAS_TELA[aparienciaRef.current.tela].etiquetaCorta;
    const tituloX =
      configRef.current.esDosPiezas && aparienciaRef.current.colorSecundario
        ? 146
        : 122;

    ctx.fillStyle = "#2D2A26";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(
      `${nombrePrenda} • ${infoTela}`,
      tituloX,
      drawAreaH + 80
    );

    ctx.fillStyle = "#5C554E";
    ctx.font = "600 24px sans-serif";
    ctx.fillText(
      `Busto ${medidasRef.current.busto} cm  •  Cintura ${medidasRef.current.cintura} cm  •  Cadera ${medidasRef.current.cadera} cm  •  Largo ${configRef.current.largoDeseado} cm`,
      tituloX,
      drawAreaH + 124
    );

    ctx.fillStyle = "#3B7A57";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(
      "MoldeFácil — Estudio 3D a Medida",
      tituloX,
      drawAreaH + 170
    );

    const url = outCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "moldefacil-vista-3d.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const capturarYCompartirEnComunidad = useCallback(() => {
    if (!onCompartirCreacion) return;
    const m = motorRef.current;
    if (!m) {
      onCompartirCreacion("");
      return;
    }
    m.renderer.render(m.scene, m.camera);
    const glCanvas = m.renderer.domElement;
    if (glCanvas.width === 0 || glCanvas.height === 0) {
      onCompartirCreacion("");
      return;
    }
    let dataUrl = glCanvas.toDataURL("image/webp", 0.86);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = glCanvas.toDataURL("image/jpeg", 0.86);
    }
    onCompartirCreacion(dataUrl);
  }, [onCompartirCreacion]);

  if (webglError) {
    return (
      <div
        className="relative w-full min-h-[480px] rounded-3xl border border-[#E2D6C8] flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: PALETA_UI_3D.crema }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-white"
          style={{ backgroundColor: PALETA_UI_3D.terracota }}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-[#2D2A26]">
          Vista 3D no disponible en este navegador
        </h3>
        <p className="text-sm text-[#5C554E] max-w-md mt-1.5">
          Tu dispositivo no habilitó contexto WebGL en este momento. Puedes seguir
          trabajando en el <strong>Molde 2D (Imprimir)</strong> en tamaño Carta o A4
          sin perder tus medidas.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={contenedorRef}
      data-garment-3d-root
      data-triangles={triangulosUI}
      data-build-ms={ultimoBuildMs}
      className={`relative w-full overflow-hidden rounded-3xl border border-[#E2D6C8] select-none ${
        modoCompacto ? "min-h-[480px] h-[560px]" : "min-h-[540px] h-[640px]"
      }`}
      style={{ backgroundColor: PALETA_UI_3D.crema }}
    >
      {/* Lienzo Three.js */}
      <div
        ref={canvasHostRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Simulador 3D interactivo de la prenda sobre maniquí anatómico"
      />

      {/* Aviso temporal si el navegador suspendió WebGL en segundo plano */}
      {contextoPerdido && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#FAF6F0]/90 p-6 text-center">
          <div className="rounded-2xl border border-[#E2D6C8] bg-white px-5 py-4 shadow-md">
            <p className="text-sm font-bold text-[#2D2A26]">
              Restaurando vista 3D…
            </p>
            <p className="text-xs text-[#6B625A] mt-1">
              El navegador suspendió temporalmente los gráficos 3D.
            </p>
          </div>
        </div>
      )}

      {/* Vistas rápidas superiores (Frente / Espalda / Detalle Escote) */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div
          className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/92 px-2 py-1.5 shadow-sm backdrop-blur-sm pointer-events-auto"
          role="group"
          aria-label="Vistas rápidas de cámara"
        >
          {botonesPresets.map((b) => {
            const activa = vistaActiva === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => irAVistaCamara(b.id)}
                className={`min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                  activa
                    ? "text-white shadow-sm"
                    : "text-[#3D352E] hover:bg-[#EFE6DA]"
                }`}
                style={
                  activa ? { backgroundColor: "#B34720" } : undefined
                }
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* Badge de medidas y botón Foto 3D */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#E2D6C8] bg-[#FAF6F0]/90 px-3 py-2 text-[11px] font-semibold text-[#4D443D] backdrop-blur-sm">
            <User className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>
              {medidas.busto} / {medidas.cintura} / {medidas.cadera} cm
            </span>
          </div>
          <button
            type="button"
            onClick={capturarFotoEstudio3D}
            aria-label="Capturar foto 3D"
            title="Descargar imagen PNG de ficha 3D"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-[#E2D6C8] bg-[#FAF6F0]/95 hover:bg-white text-xs font-extrabold text-[#2D2A26] shadow-sm backdrop-blur-sm flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]"
          >
            <Camera className="w-4 h-4 text-[#C85A32] shrink-0" />
            <span className="hidden sm:inline">Foto 3D</span>
          </button>
          {onCompartirCreacion && (
            <button
              type="button"
              onClick={capturarYCompartirEnComunidad}
              aria-label="Compartir mi creación"
              title="Compartir diseño y captura 3D en la Comunidad"
              className="min-h-[44px] px-3 rounded-xl border border-[#3B7A57] bg-[#3B7A57] hover:bg-[#316649] text-xs font-extrabold text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] focus-visible:ring-offset-1"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Compartir mi creación</span>
            </button>
          )}
        </div>
      </div>

      {/* Chip de pieza activa sincronizada 2D <-> 3D + Leyenda Mapa de Calce */}
      {(piezaActivaObj || apariencia.mostrarMapaCalce) && (
        <div className="absolute top-[66px] left-3 right-3 z-20 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
          {piezaActivaObj ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#C85A32]/50 bg-[#FAF6F0]/95 px-3 py-1.5 text-xs font-bold text-[#2D2A26] shadow-sm backdrop-blur-sm pointer-events-auto">
              <span>
                Pieza: {piezaActivaObj.tabLabel} ({piezaActivaObj.widthCm.toFixed(0)} ×{" "}
                {piezaActivaObj.heightCm.toFixed(0)} cm)
              </span>
              {onActivePieceIdChange && (
                <button
                  type="button"
                  onClick={() => onActivePieceIdChange("all")}
                  aria-label="Ver todas las piezas"
                  className="inline-flex items-center gap-0.5 rounded-lg bg-[#EFE6DA] hover:bg-[#E2D6C8] px-2 py-0.5 text-[11px] font-extrabold text-[#3D352E] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Ver todo
                </button>
              )}
            </div>
          ) : (
            <span />
          )}

          {apariencia.mostrarMapaCalce && (
            <div
              data-leyenda-calce-3d
              className="inline-flex flex-wrap items-center gap-2.5 rounded-xl border border-[#E2D6C8] bg-[#FAF6F0]/95 px-3 py-1.5 text-[11px] font-bold text-[#2D2A26] shadow-sm backdrop-blur-sm pointer-events-auto"
            >
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D96B43]" />
                Ceñido (&lt;2.5 cm)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B7A57]" />
                Cómodo (2.5–8.5 cm)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B6E8C]" />
                Holgado (&gt;8.5 cm)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Etiquetas educativas y cintas métricas HTML proyectadas desde mundo 3D */}
      {(apariencia.mostrarCosturas || apariencia.mostrarMapaCalce) && (
        <div
          className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {etiquetasUI.map((et) => (
            <div
              key={et.id}
              data-etiqueta-3d={et.texto}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150"
              style={{
                left: `${et.xPx}px`,
                top: `${et.yPx}px`,
                opacity: et.visible ? 1 : 0,
              }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C85A32]/75 bg-[#FAF6F0]/95 px-2.5 py-1 text-[11px] font-extrabold text-[#2D2A26] shadow-sm whitespace-nowrap">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: PALETA_UI_3D.terracota }}
                />
                {et.texto}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Barra inferior flotante táctil (>= 44 x 44 px) con popovers compactos */}
      <div
        data-barra-flotante-3d
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-xl flex flex-col items-center pointer-events-none"
      >
        {/* Popover de Color (con fila inferior opcional en conjuntos de 2 piezas) */}
        {popoverAbierto === "color" && (
          <div
            role="dialog"
            aria-label="Selector de color de tela"
            className="mb-2 w-full max-w-sm rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/96 p-3 shadow-xl backdrop-blur-md pointer-events-auto space-y-3"
          >
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A] mb-2">
                {config.esDosPiezas
                  ? "Color superior (Top / Chaqueta)"
                  : "Color de la tela"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {COLORES_RAPIDOS.map((c) => {
                  const seleccionado =
                    apariencia.color.toUpperCase() === c.hex.toUpperCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.nombre}
                      aria-label={`Color ${c.nombre}`}
                      aria-pressed={seleccionado}
                      onClick={() =>
                        onAparienciaChange({ ...apariencia, color: c.hex })
                      }
                      className={`w-11 h-11 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                        seleccionado
                          ? "scale-110 ring-2 ring-[#3B7A57] border-white shadow-md"
                          : "border-[#D8CEC0] hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}

                <label
                  title="Elegir color personalizado"
                  className="relative w-11 h-11 rounded-full border-2 border-dashed border-[#B5A898] flex items-center justify-center cursor-pointer bg-white hover:bg-[#F3ECE2] text-[10px] font-bold text-[#4D443D]"
                >
                  <span>Más</span>
                  <input
                    type="color"
                    aria-label="Elegir color personalizado"
                    value={apariencia.color}
                    onChange={(e) =>
                      onAparienciaChange({ ...apariencia, color: e.target.value })
                    }
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {config.esDosPiezas && (
              <div className="pt-2 border-t border-[#E2D6C8]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A]">
                    Color inferior (Falda / Pantalón)
                  </p>
                  {apariencia.colorSecundario && (
                    <button
                      type="button"
                      onClick={() =>
                        onAparienciaChange({
                          ...apariencia,
                          colorSecundario: undefined,
                        })
                      }
                      className="text-[10px] font-bold text-[#C85A32] hover:underline cursor-pointer"
                    >
                      Igual al superior
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {COLORES_RAPIDOS.map((c) => {
                    const colorInf = apariencia.colorSecundario ?? apariencia.color;
                    const seleccionado =
                      colorInf.toUpperCase() === c.hex.toUpperCase();
                    return (
                      <button
                        key={`sec-${c.hex}`}
                        type="button"
                        title={`Inferior: ${c.nombre}`}
                        aria-label={`Color inferior ${c.nombre}`}
                        aria-pressed={seleccionado}
                        onClick={() =>
                          onAparienciaChange({
                            ...apariencia,
                            colorSecundario: c.hex,
                          })
                        }
                        className={`w-9 h-9 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                          seleccionado
                            ? "scale-110 ring-2 ring-[#3B7A57] border-white shadow-sm"
                            : "border-[#D8CEC0] hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    );
                  })}
                  <label
                    title="Color inferior personalizado"
                    className="relative w-9 h-9 rounded-full border-2 border-dashed border-[#B5A898] flex items-center justify-center cursor-pointer bg-white hover:bg-[#F3ECE2] text-[10px] font-bold text-[#4D443D]"
                  >
                    <span>+</span>
                    <input
                      type="color"
                      aria-label="Color inferior personalizado"
                      value={apariencia.colorSecundario ?? apariencia.color}
                      onChange={(e) =>
                        onAparienciaChange({
                          ...apariencia,
                          colorSecundario: e.target.value,
                        })
                      }
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Popover de Estampado */}
        {popoverAbierto === "estampado" && (
          <div
            role="dialog"
            aria-label="Selector de estampado"
            className="mb-2 w-full max-w-sm rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/96 p-3 shadow-xl backdrop-blur-md pointer-events-auto"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A] mb-2">
              Estampado (escala 8 cm real)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES_ESTAMPADO.map((est) => {
                const activo = apariencia.estampado === est.id;
                return (
                  <button
                    key={est.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      onAparienciaChange({ ...apariencia, estampado: est.id })
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                      activo
                        ? "border-[#C85A32] bg-[#C85A32]/12 text-[#2D2A26]"
                        : "border-[#E2D6C8] bg-white/80 hover:bg-white text-[#4D443D]"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{est.nombre}</div>
                    <div className="text-[10px] text-[#6B625A]">{est.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Popover de Tela */}
        {popoverAbierto === "tela" && (
          <div
            role="dialog"
            aria-label="Selector de tipo de tela"
            className="mb-2 w-full max-w-sm rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/96 p-3 shadow-xl backdrop-blur-md pointer-events-auto"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A] mb-2">
              Material textil y caída
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES_TELA.map((t) => {
                const activo = apariencia.tela === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      onAparienciaChange({ ...apariencia, tela: t.id })
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                      activo
                        ? "border-[#C85A32] bg-[#C85A32]/12 text-[#2D2A26]"
                        : "border-[#E2D6C8] bg-white/80 hover:bg-white text-[#4D443D]"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{t.nombre}</div>
                    <div className="text-[10px] text-[#6B625A]">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Popover de Estudio: Pose + Acabado de Maniquí */}
        {popoverAbierto === "estudio" && (
          <div
            role="dialog"
            aria-label="Opciones de pose y maniquí"
            className="mb-2 w-full max-w-sm rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/96 p-3 shadow-xl backdrop-blur-md pointer-events-auto space-y-3"
          >
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A] mb-2">
                Pose anatómica del maniquí
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {OPCIONES_POSES.map((p) => {
                  const activa =
                    (apariencia.poseManiqui ?? "relajada") === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() =>
                        onAparienciaChange({ ...apariencia, poseManiqui: p.id })
                      }
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                        activa
                          ? "border-[#C85A32] bg-[#C85A32]/12 text-[#2D2A26]"
                          : "border-[#E2D6C8] bg-white/80 hover:bg-white text-[#4D443D]"
                      }`}
                    >
                      <div className="text-xs font-extrabold">{p.nombre}</div>
                      <div className="text-[10px] text-[#6B625A] leading-tight">
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2D6C8]">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A] mb-2">
                Acabado del maniquí
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {OPCIONES_MANIQUI.map((m) => {
                  const activo =
                    (apariencia.acabadoManiqui ?? "lino") === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={activo}
                      onClick={() =>
                        onAparienciaChange({
                          ...apariencia,
                          acabadoManiqui: m.id,
                        })
                      }
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border flex items-center gap-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                        activo
                          ? "border-[#C85A32] bg-[#C85A32]/12 text-[#2D2A26]"
                          : "border-[#E2D6C8] bg-white/80 hover:bg-white text-[#4D443D]"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-[#B5A898] shrink-0"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="text-[11px] font-extrabold leading-tight">
                        {m.nombre}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Fila principal de controles */}
        <div
          className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/94 px-2 py-1.5 shadow-lg backdrop-blur-md pointer-events-auto"
          role="toolbar"
          aria-label="Controles del simulador 3D"
        >
          {/* Color */}
          <button
            type="button"
            aria-expanded={popoverAbierto === "color"}
            aria-label="Color"
            onClick={() =>
              setPopoverAbierto((p) => (p === "color" ? null : "color"))
            }
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
              popoverAbierto === "color"
                ? "bg-[#EFE6DA] text-[#2D2A26]"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border border-[#C7B9A7] shrink-0"
              style={{ backgroundColor: apariencia.color }}
            />
            <span>Color</span>
          </button>

          {/* Estampado */}
          <button
            type="button"
            aria-expanded={popoverAbierto === "estampado"}
            aria-label="Estampado"
            onClick={() =>
              setPopoverAbierto((p) => (p === "estampado" ? null : "estampado"))
            }
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
              popoverAbierto === "estampado"
                ? "bg-[#EFE6DA] text-[#2D2A26]"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
          >
            <Grid className="w-4 h-4 shrink-0 text-[#C85A32]" />
            <span>Estampado</span>
          </button>

          {/* Tela */}
          <button
            type="button"
            aria-expanded={popoverAbierto === "tela"}
            aria-label="Tela"
            onClick={() =>
              setPopoverAbierto((p) => (p === "tela" ? null : "tela"))
            }
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
              popoverAbierto === "tela"
                ? "bg-[#EFE6DA] text-[#2D2A26]"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
          >
            {apariencia.tela === "seda" ? (
              <Sparkles className="w-4 h-4 shrink-0 text-[#C85A32]" />
            ) : (
              <Layers className="w-4 h-4 shrink-0 text-[#C85A32]" />
            )}
            <span>Tela</span>
          </button>

          {/* Estudio (Pose + Maniquí) */}
          <button
            type="button"
            aria-expanded={popoverAbierto === "estudio"}
            aria-label="Estudio"
            onClick={() =>
              setPopoverAbierto((p) => (p === "estudio" ? null : "estudio"))
            }
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
              popoverAbierto === "estudio"
                ? "bg-[#EFE6DA] text-[#2D2A26]"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0 text-[#C85A32]" />
            <span>Estudio</span>
          </button>

          {/* Mapa de Calce / Holgura */}
          <button
            type="button"
            aria-pressed={Boolean(apariencia.mostrarMapaCalce)}
            aria-label="Calce"
            onClick={() =>
              onAparienciaChange({
                ...apariencia,
                mostrarMapaCalce: !apariencia.mostrarMapaCalce,
              })
            }
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B6E8C] ${
              apariencia.mostrarMapaCalce
                ? "text-white shadow-sm bg-[#3B6E8C]"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>Calce</span>
          </button>

          {/* Ver Costuras y Pinzas (#3B7A57 salvia cuando activo) */}
          <button
            type="button"
            aria-pressed={apariencia.mostrarCosturas}
            aria-label="Ver Costuras"
            onClick={() =>
              onAparienciaChange({
                ...apariencia,
                mostrarCosturas: !apariencia.mostrarCosturas,
              })
            }
            className={`min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
              apariencia.mostrarCosturas
                ? "text-white shadow-sm"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
            style={
              apariencia.mostrarCosturas
                ? { backgroundColor: PALETA_UI_3D.salvia }
                : undefined
            }
          >
            <Scissors className="w-4 h-4 shrink-0" />
            <span>Ver Costuras</span>
          </button>

          {/* Girar 360° */}
          <button
            type="button"
            aria-pressed={autoGirar}
            aria-label="Girar 360°"
            onClick={() => {
              const sig = !autoGirar;
              setAutoGirar(sig);
              if (sig) {
                setVistaActiva(null);
                const m = motorRef.current;
                if (m) {
                  const destino = calcularPoseCamaraPreset(
                    "frente",
                    m.perfilActual,
                    m.configActual,
                    m.camera.aspect
                  );
                  transicionRef.current = {
                    inicioMs: performance.now(),
                    duracionMs: DURACION_TRANSICION_CAMARA_MS,
                    posInicio: m.camera.position.clone(),
                    posFin: destino.posicion,
                    targetInicio: m.controls.target.clone(),
                    targetFin: destino.target,
                  };
                }
              }
              solicitarRender(sig);
            }}
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
              autoGirar
                ? "text-white shadow-sm"
                : "text-[#3D352E] hover:bg-[#EFE6DA]"
            }`}
            style={autoGirar ? { backgroundColor: "#B34720" } : undefined}
          >
            <RotateCw
              className={`w-4 h-4 shrink-0 ${autoGirar ? "animate-spin" : ""}`}
              style={autoGirar ? { animationDuration: "5s" } : undefined}
            />
            <span>Girar 360°</span>
          </button>
        </div>
      </div>
    </div>
  );
}