"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AlertTriangle,
  Eye,
  Grid,
  Layers,
  RotateCw,
  Scissors,
  Sparkles,
  User,
} from "lucide-react";
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
  construirMallaPrenda,
  Etiqueta3DProyectada,
  proyectarEtiquetas3D,
  ResultadoMallaPrenda,
} from "@/lib/3d/garmentMeshBuilder";
import { crearManiqui, ManiquiInstancia } from "@/lib/3d/mannequinBuilder";
import {
  Apariencia,
  COLORES_RAPIDOS,
  ConfigPrenda,
  Medidas,
  NivelDetalle3D,
  PALETA_UI_3D,
  PerfilCuerpo,
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
}

type VistaCamaraPreset = "frente" | "espalda" | "detalle";
type PopoverActivo = "color" | "estampado" | "tela" | null;

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
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function calcularNivelDetalleViewport(anchoPx: number): NivelDetalle3D {
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return anchoPx < 640 || cores <= 4 ? "movil" : "escritorio";
}

function calcularPoseCamaraPreset(
  preset: VistaCamaraPreset,
  perfil: PerfilCuerpo,
  config: ConfigPrenda,
  aspect: number
): CamaraObjetivo {
  const esSombrero = config.prenda === "bucketHat";
  const distFactor = aspect < 0.85 ? 1.18 : 1.0;

  if (esSombrero) {
    const yCabeza = perfil.cuelloYM + 0.14;
    if (preset === "espalda") {
      return {
        posicion: new THREE.Vector3(0, yCabeza + 0.08, -1.08 * distFactor),
        target: new THREE.Vector3(0, yCabeza, 0),
      };
    }
    if (preset === "detalle") {
      return {
        posicion: new THREE.Vector3(0.24, yCabeza + 0.12, 0.82 * distFactor),
        target: new THREE.Vector3(0, yCabeza + 0.02, 0.02),
      };
    }
    return {
      posicion: new THREE.Vector3(0, yCabeza + 0.08, 1.08 * distFactor),
      target: new THREE.Vector3(0, yCabeza, 0),
    };
  }

  const tieneInferiorLargo =
    config.prenda === "vestido" ||
    config.prenda === "falda" ||
    config.prenda === "pantalon" ||
    config.prenda === "enterizo" ||
    Boolean(config.esDosPiezas);

  const centroY = tieneInferiorLargo
    ? (perfil.hombroYM + Math.max(0.25, perfil.alturaTobilloM + 0.16)) * 0.5
    : (perfil.hombroYM + perfil.caderaYM) * 0.5;
  const distanciaBase = (tieneInferiorLargo ? 2.15 : 1.55) * distFactor;

  if (preset === "espalda") {
    return {
      posicion: new THREE.Vector3(0, centroY + 0.06, -distanciaBase),
      target: new THREE.Vector3(0, centroY, 0),
    };
  }

  if (preset === "detalle") {
    const yEscote = (perfil.cuelloYM + perfil.bustoYM) * 0.5 - 0.02;
    return {
      posicion: new THREE.Vector3(0.18, yEscote + 0.1, 0.96 * distFactor),
      target: new THREE.Vector3(0, yEscote, 0.04),
    };
  }

  return {
    posicion: new THREE.Vector3(0, centroY + 0.06, distanciaBase),
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
}: Garment3DPreviewProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const motorRef = useRef<EstadoMotor3D | null>(null);

  const aparienciaRef = useRef<Apariencia>(apariencia);
  const configRef = useRef<ConfigPrenda>(config);
  const medidasRef = useRef<Medidas>(medidas);

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
  }, [apariencia, config, medidas, autoGirar]);

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
    const perfilIni = getBodyProfile(medidasRef.current);
    const maniqui = crearManiqui(perfilIni);
    scene.add(maniqui.grupo);

    const nivelDetalleIni = calcularNivelDetalleViewport(widthIni);
    const telaIni = aparienciaRef.current.tela;
    const t0 = performance.now();
    const prendaIni = construirMallaPrenda(perfilIni, configRef.current, {
      nivelDetalle: nivelDetalleIni,
      materialPrincipal: repoMateriales.obtenerMaterial(aparienciaRef.current),
      materialForroOVista: repoMateriales.obtenerMaterialVista(aparienciaRef.current),
      mostrarCosturas: aparienciaRef.current.mostrarCosturas,
      ajusteTelaStretchM: PROPIEDADES_FISICAS_TELA[telaIni].ajusteStretchM,
    });
    const buildMs = Math.round(performance.now() - t0);
    scene.add(prendaIni.grupo);
    setTriangulosUI(prendaIni.triangulosTotales);
    setUltimoBuildMs(buildMs);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.72;
    controls.maxDistance = 3.8;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.autoRotateSpeed = 1.65;

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
    };
    motorRef.current = motor;

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
        const mPrev = motor.prendaActual;
        disposeObject(mPrev.grupo, {
          preservarMateriales: motor.repoMateriales.materialesCompartidos(),
          preservarTexturas: motor.repoMateriales.texturasCacheadas(),
        });
        motor.scene.remove(mPrev.grupo);
        const nueva = construirMallaPrenda(motor.perfilActual, motor.configActual, {
          nivelDetalle: nuevoDetalle,
          materialPrincipal: motor.repoMateriales.obtenerMaterial(aparienciaRef.current),
          materialForroOVista: motor.repoMateriales.obtenerMaterialVista(
            aparienciaRef.current
          ),
          mostrarCosturas: aparienciaRef.current.mostrarCosturas,
          ajusteTelaStretchM:
            PROPIEDADES_FISICAS_TELA[aparienciaRef.current.tela].ajusteStretchM,
        });
        motor.scene.add(nueva.grupo);
        motor.prendaActual = nueva;
        setTriangulosUI(nueva.triangulosTotales);
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

      // Proyectar etiquetas 3D -> HTML solo cuando "Ver Costuras" está activo
      if (aparienciaRef.current.mostrarCosturas) {
        const wPx = renderer.domElement.clientWidth || widthIni;
        const hPx = renderer.domElement.clientHeight || heightIni;
        const proyectadas = proyectarEtiquetas3D(
          motor.prendaActual.etiquetas,
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

      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      disposeObject(motor.prendaActual.grupo, {
        preservarMateriales: repoMateriales.materialesCompartidos(),
        preservarTexturas: repoMateriales.texturasCacheadas(),
      });
      scene.remove(motor.prendaActual.grupo);

      // Al desmontar liberamos maniquí completo (geometrías, materiales y su textura cruda)
      disposeObject(maniqui.grupo);
      scene.remove(maniqui.grupo);

      sombra.dispose();
      iluminacion.dispose();
      repoMateriales.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      motorRef.current = null;
    };
  }, [reinitTick, solicitarRender]);

  // Actualización INSTANTÁNEA de material, textura y toggle de costuras (0 reconstrucción de geometría)
  useEffect(() => {
    const motor = motorRef.current;
    if (!motor) return;

    motor.repoMateriales.obtenerMaterial(apariencia);
    motor.repoMateriales.obtenerMaterialVista(apariencia);
    motor.prendaActual.grupoCosturas.visible = apariencia.mostrarCosturas;
    ultimaProyeccionStrRef.current = "__dirty__";
    solicitarRender(true);
  }, [apariencia, solicitarRender]);

  // Actualización con debounce ~120 ms cuando cambian medidas o configuración de la prenda
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
      const medidasCambiaron =
        JSON.stringify(m.medidasActual) !== JSON.stringify(medidas);

      const perfil = medidasCambiaron ? getBodyProfile(medidas) : m.perfilActual;
      if (medidasCambiaron) {
        m.maniqui.actualizar(perfil);
        m.perfilActual = perfil;
        m.medidasActual = medidas;
      }

      const previa = m.prendaActual;
      m.scene.remove(previa.grupo);
      disposeObject(previa.grupo, {
        preservarMateriales: m.repoMateriales.materialesCompartidos(),
        preservarTexturas: m.repoMateriales.texturasCacheadas(),
      });

      const ap = aparienciaRef.current;
      const nueva = construirMallaPrenda(perfil, config, {
        nivelDetalle: m.nivelDetalleActual,
        materialPrincipal: m.repoMateriales.obtenerMaterial(ap),
        materialForroOVista: m.repoMateriales.obtenerMaterialVista(ap),
        mostrarCosturas: ap.mostrarCosturas,
        ajusteTelaStretchM: PROPIEDADES_FISICAS_TELA[ap.tela].ajusteStretchM,
      });
      m.scene.add(nueva.grupo);
      m.prendaActual = nueva;
      m.configActual = config;

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
  }, [medidas, config, solicitarRender]);

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

        {/* Badge sutil de medidas sincronizadas */}
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#E2D6C8] bg-[#FAF6F0]/90 px-3 py-2 text-[11px] font-semibold text-[#4D443D] backdrop-blur-sm">
          <User className="w-3.5 h-3.5 text-[#C85A32]" />
          <span>
            {medidas.busto} / {medidas.cintura} / {medidas.cadera} cm
          </span>
        </div>
      </div>

      {/* Etiquetas educativas HTML proyectadas desde mundo 3D (ocultas detrás del maniquí) */}
      {apariencia.mostrarCosturas && (
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
        {/* Popover de Color */}
        {popoverAbierto === "color" && (
          <div
            role="dialog"
            aria-label="Selector de color de tela"
            className="mb-2 w-full max-w-sm rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0]/96 p-3 shadow-xl backdrop-blur-md pointer-events-auto"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B625A] mb-2">
              Color de la tela
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
              setAutoGirar((prev) => {
                const sig = !prev;
                if (sig) setVistaActiva(null);
                solicitarRender(sig);
                return sig;
              });
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
