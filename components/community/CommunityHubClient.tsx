"use client";

import React, {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Check,
  Clock,
  Download,
  FileText,
  Flag,
  Heart,
  MessageCircle,
  PlusCircle,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import {
  cambiarUsuariaActiva,
  crearCuentaModista,
  crearReporteModeracion,
  type EstadoComunidad,
  getComunidadServerSnapshot,
  INSIGNIAS_CATALOGO,
  loadComunidadEstado,
  marcarNotificacionesLeidas,
  obtenerActorActivo,
  registrarDescargaRecurso,
  registrarRemixMolde,
  saveComunidadEstado,
  subscribeComunidad,
  votarParticipacionReto,
} from "@/lib/community/communityStore";
import { RETO_MENSUAL_DEMO } from "@/lib/community/demoSeed";
import { normalizarTextoEspanol } from "@/lib/community/moderationEngine";
import {
  type BorradorCompartirCreacion,
  codificarConfigMoldeParaUrl,
  leerBorradorCompartirCreacion,
  limpiarBorradorCompartirCreacion,
} from "@/lib/community/patternBridge";
import { descargarRecursoComunidadPdf } from "@/lib/community/resourcePdfGenerator";
import {
  esModeradoraOAdmin,
  puedeLeerPublicacion,
} from "@/lib/community/rlsPolicyEngine";
import type { PublicacionComunidad } from "@/lib/community/types";
import PublishCreationModal from "./PublishCreationModal";
import PostDetailModal from "./PostDetailModal";
import QuestionsSection from "./QuestionsSection";
import ProfileAndModerationSection from "./ProfileAndModerationSection";

type TabComunidad = "galeria" | "preguntas" | "retos" | "recursos" | "perfil";

function CommunityQuerySync({
  onSolicitarPublicar,
  onSolicitarTab,
}: {
  onSolicitarPublicar: (borrador: BorradorCompartirCreacion | null) => void;
  onSolicitarTab: (tab: TabComunidad) => void;
}) {
  const searchParams = useSearchParams();
  const procesadoRef = useRef<string>("");

  React.useEffect(() => {
    const key = searchParams.toString();
    if (procesadoRef.current === key) return;
    procesadoRef.current = key;

    const tab = searchParams.get("tab");
    const publicar = searchParams.get("publicar");

    queueMicrotask(() => {
      if (
        tab === "galeria" ||
        tab === "preguntas" ||
        tab === "retos" ||
        tab === "recursos" ||
        tab === "perfil"
      ) {
        onSolicitarTab(tab);
      }
      if (publicar === "1") {
        onSolicitarPublicar(leerBorradorCompartirCreacion());
      }
    });
  }, [onSolicitarPublicar, onSolicitarTab, searchParams]);

  return null;
}

export default function CommunityHubClient() {
  const router = useRouter();
  const estado = useSyncExternalStore(
    subscribeComunidad,
    loadComunidadEstado,
    getComunidadServerSnapshot
  );

  const actor = useMemo(() => obtenerActorActivo(estado), [estado]);
  const perfilActivo = useMemo(
    () => estado.perfiles.find((p) => p.id === actor?.id) ?? null,
    [actor?.id, estado.perfiles]
  );

  const [tabActiva, setTabActiva] = useState<TabComunidad>("galeria");
  const [modalPublicarAbierto, setModalPublicarAbierto] =
    useState<boolean>(false);
  const [borradorPublicar, setBorradorPublicar] =
    useState<BorradorCompartirCreacion | null>(null);
  const [publicacionDetalleId, setPublicacionDetalleId] = useState<
    string | null
  >(null);

  const [mostrarNotif, setMostrarNotif] = useState<boolean>(false);
  const [mostrarRegistro, setMostrarRegistro] = useState<boolean>(false);
  const [nuevoNombre, setNuevoNombre] = useState<string>("");
  const [nuevoUsuario, setNuevoUsuario] = useState<string>("");
  const [nuevaCiudad, setNuevaCiudad] = useState<string>("");

  const [busquedaGaleria, setBusquedaGaleria] = useState<string>("");
  const [filtroPrenda, setFiltroPrenda] = useState<string>("Todas");
  const [filtroTela, setFiltroTela] = useState<string>("Todas");
  const [filtroDificultad, setFiltroDificultad] = useState<string>("Todas");
  const [soloPorEncargo, setSoloPorEncargo] = useState<boolean>(false);
  const [ordenGaleria, setOrdenGaleria] = useState<"recientes" | "utiles">(
    "recientes"
  );
  const [limiteCursor, setLimiteCursor] = useState<number>(6);
  const [avisoGlobal, setAvisoGlobal] = useState<string | null>(null);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const manejarActualizarEstado = useCallback(
    (siguiente: EstadoComunidad, mensaje?: string) => {
      saveComunidadEstado(siguiente);
      if (mensaje) setAvisoGlobal(mensaje);
    },
    []
  );

  const abrirAsistentePublicacion = useCallback(
    (borradorInicial: BorradorCompartirCreacion | null) => {
      setTabActiva("galeria");
      setBorradorPublicar(borradorInicial);
      setModalPublicarAbierto(true);
    },
    []
  );

  const misNotificaciones = useMemo(() => {
    if (!actor) return [];
    return estado.notificaciones.filter((n) => n.usuaria_id === actor.id);
  }, [actor, estado.notificaciones]);

  const noLeidas = useMemo(
    () => misNotificaciones.filter((n) => !n.leida).length,
    [misNotificaciones]
  );

  const prendasUnicas = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(estado.publicaciones.map((p) => p.prenda))),
    ],
    [estado.publicaciones]
  );

  const telasUnicas = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(estado.publicaciones.map((p) => p.tela))),
    ],
    [estado.publicaciones]
  );

  const publicacionesFiltradas = useMemo(() => {
    const qNorm = normalizarTextoEspanol(busquedaGaleria);
    const lista = estado.publicaciones.filter((pub) => {
      if (!puedeLeerPublicacion(actor, pub, { bloqueos: estado.bloqueos })) {
        return false;
      }
      if (filtroPrenda !== "Todas" && pub.prenda !== filtroPrenda) return false;
      if (filtroTela !== "Todas" && pub.tela !== filtroTela) return false;
      if (filtroDificultad === "facil" && pub.dificultad > 2) return false;
      if (filtroDificultad === "media" && pub.dificultad !== 3) return false;
      if (filtroDificultad === "retadora" && pub.dificultad < 4) return false;
      if (soloPorEncargo) {
        const autora = estado.perfiles.find((p) => p.id === pub.autora_id);
        if (!autora?.vende_por_encargo) return false;
      }
      if (
        qNorm &&
        !normalizarTextoEspanol(
          `${pub.titulo} ${pub.descripcion} ${pub.aprendizaje_nota} ${pub.prenda} ${pub.tela}`
        ).includes(qNorm)
      ) {
        return false;
      }
      return true;
    });

    return [...lista].sort((a, b) => {
      if (ordenGaleria === "utiles") {
        const scoreB = b.conteo_reacciones + b.conteo_remixes * 2;
        const scoreA = a.conteo_reacciones + a.conteo_remixes * 2;
        return scoreB - scoreA;
      }
      return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime();
    });
  }, [
    actor,
    busquedaGaleria,
    estado.bloqueos,
    estado.perfiles,
    estado.publicaciones,
    filtroDificultad,
    filtroPrenda,
    filtroTela,
    ordenGaleria,
    soloPorEncargo,
  ]);

  const publicacionesMostradas = useMemo(
    () => publicacionesFiltradas.slice(0, limiteCursor),
    [limiteCursor, publicacionesFiltradas]
  );

  const publicacionSeleccionada: PublicacionComunidad | null = useMemo(() => {
    if (!publicacionDetalleId) return null;
    return (
      estado.publicaciones.find((p) => p.id === publicacionDetalleId) ?? null
    );
  }, [estado.publicaciones, publicacionDetalleId]);

  const retoActivo = estado.retos[0] ?? RETO_MENSUAL_DEMO;
  const yaVoteReto = Boolean(
    actor &&
      estado.votosReto.some(
        (v) => v.reto_id === retoActivo.id && v.votante_id === actor.id
      )
  );

  const TABS: Array<{ id: TabComunidad; label: string; badge?: number }> = [
    {
      id: "galeria",
      label: "Lo que cosieron",
      badge: publicacionesFiltradas.length,
    },
    {
      id: "preguntas",
      label: "Pregúntale a la modista",
      badge: estado.preguntas.filter((q) => !q.oculto).length,
    },
    { id: "retos", label: "Retos e Insignias" },
    { id: "recursos", label: "Recursos PDF", badge: estado.descargables.length },
    {
      id: "perfil",
      label: esModeradoraOAdmin(actor)
        ? "Perfil, Moderación y Métricas"
        : "Mi Perfil y Ajustes",
    },
  ];

  const abrirMoldeDesdeTarjeta = (pub: PublicacionComunidad) => {
    const token = codificarConfigMoldeParaUrl(pub.config_molde);
    saveComunidadEstado(registrarRemixMolde(estado, pub.id));
    router.push(`/?molde_comunidad=${encodeURIComponent(token)}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <Suspense fallback={null}>
        <CommunityQuerySync
          onSolicitarPublicar={abrirAsistentePublicacion}
          onSolicitarTab={setTabActiva}
        />
      </Suspense>

      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-xs font-extrabold">
              <ShieldCheck className="w-4 h-4" />
              Taller Comunitario Seguro · Cero medidas expuestas · EXIF limpio
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2D2A26]">
              Comunidad de Modistas: “Lo que cosieron”
            </h1>
            <p className="text-sm text-[#5C554E] leading-relaxed">
              Inspírate con prendas reales confeccionadas con nuestros moldes, resuelve dudas de costura con compañeras de oficio y abre cualquier diseño con tus propias medidas en un clic.
            </p>
            <div className="flex flex-wrap gap-3 text-xs font-bold pt-1">
              <Link
                href="/comunidad/normas"
                className="text-[#B34720] hover:underline"
              >
                Normas de convivencia y derechos de autor
              </Link>
              <span className="text-[#C7B9A8]">·</span>
              <Link
                href="/comunidad/privacidad"
                className="text-[#3B7A57] hover:underline"
              >
                Cómo protegemos tus fotos y medidas
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-[#5C554E]">
                <span className="sr-only">Cuenta activa de taller</span>
                <select
                  value={actor?.id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    saveComunidadEstado(cambiarUsuariaActiva(estado, id));
                    setAvisoGlobal(
                      id
                        ? "Cambiaste de perfil activo para explorar o moderar."
                        : "Estás navegando como visitante sin sesión."
                    );
                  }}
                  aria-label="Cambiar cuenta activa en la comunidad"
                  className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26]"
                >
                  <option value="">Visitante (sin sesión)</option>
                  {estado.perfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      @{p.usuario_unico} ·{" "}
                      {p.rol === "moderadora" || p.rol === "admin"
                        ? "Moderadora"
                        : p.publicaciones_aprobadas_count === 0
                          ? "Cuenta nueva"
                          : "Modista"}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => setMostrarRegistro((v) => !v)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#EFE6DA] hover:bg-[#E4D6C4] text-[#2D2A26] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#B34720]" />
                Nueva cuenta
              </button>

              {actor && (
                <button
                  type="button"
                  onClick={() => setMostrarNotif((v) => !v)}
                  aria-label={`Notificaciones (${noLeidas} sin leer)`}
                  className="relative min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] inline-flex items-center justify-center cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#B34720]" />
                  {noLeidas > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#B34720] text-white text-[10px] font-extrabold">
                      {noLeidas}
                    </span>
                  )}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                abrirAsistentePublicacion(leerBorradorCompartirCreacion())
              }
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Compartir lo que cosí
            </button>
          </div>
        </div>

        {mostrarRegistro && (
          <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3">
            <p className="text-xs font-extrabold text-[#2D2A26]">
              Crear mi perfil gratuito de modista (tu primera publicación pasa por revisión amable anti-spam)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Tu nombre público"
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
              />
              <input
                type="text"
                value={nuevoUsuario}
                onChange={(e) => setNuevoUsuario(e.target.value.toLowerCase())}
                placeholder="usuario_taller"
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
              />
              <input
                type="text"
                value={nuevaCiudad}
                onChange={(e) => setNuevaCiudad(e.target.value)}
                placeholder="Ciudad / País (opcional)"
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const res = crearCuentaModista(estado, {
                    nombre_publico: nuevoNombre,
                    usuario_unico: nuevoUsuario,
                    ciudad_pais: nuevaCiudad || undefined,
                    nivel: "aprendiz",
                  });
                  if (!res.ok) {
                    setAvisoGlobal(res.error ?? "No se pudo crear la cuenta.");
                    return;
                  }
                  setNuevoNombre("");
                  setNuevoUsuario("");
                  setNuevaCiudad("");
                  setMostrarRegistro(false);
                  manejarActualizarEstado(
                    res.estado,
                    "¡Bienvenida! Tu cuenta nueva ya está activa en el taller."
                  );
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
              >
                Registrarme y entrar
              </button>
              <button
                type="button"
                onClick={() => setMostrarRegistro(false)}
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {mostrarNotif && actor && (
          <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-extrabold uppercase text-[#2D2A26]">
                Tus notificaciones recientes
              </h2>
              <button
                type="button"
                onClick={() =>
                  manejarActualizarEstado(
                    marcarNotificacionesLeidas(estado, actor.id)
                  )
                }
                className="text-xs font-extrabold text-[#3B7A57] hover:underline cursor-pointer"
              >
                Marcar todo como leído
              </button>
            </div>
            {misNotificaciones.length === 0 ? (
              <p className="text-xs text-[#5C554E]">
                Aún no tienes notificaciones nuevas.
              </p>
            ) : (
              <ul className="space-y-2">
                {misNotificaciones.slice(0, 5).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-xl px-3.5 py-2.5 text-xs border ${
                      n.leida
                        ? "bg-white border-[#EFE6DA] text-[#5C554E]"
                        : "bg-[#FFF6F2] border-[#E6B8A5] text-[#2D2A26] font-semibold"
                    }`}
                  >
                    <p className="font-extrabold">{n.titulo}</p>
                    <p>{n.mensaje}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {avisoGlobal && (
        <div
          role="status"
          className="rounded-2xl bg-[#3B7A57]/12 border border-[#3B7A57]/35 px-4 py-3 flex items-center justify-between gap-3 text-sm font-bold text-[#28593D]"
        >
          <span>{avisoGlobal}</span>
          <button
            type="button"
            onClick={() => setAvisoGlobal(null)}
            className="min-h-[36px] px-3 rounded-lg bg-white border border-[#3B7A57]/30 text-xs font-extrabold cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      <nav
        role="tablist"
        aria-label="Secciones de la Comunidad de Modistas"
        className="flex flex-wrap gap-2 rounded-2xl bg-white border border-[#E2D6C8] p-2 shadow-xs"
      >
        {TABS.map((t, idx) => {
          const activa = tabActiva === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              id={`tab-com-${t.id}`}
              aria-selected={activa}
              aria-controls={`panel-com-${t.id}`}
              tabIndex={activa ? 0 : -1}
              type="button"
              onClick={() => setTabActiva(t.id)}
              onKeyDown={(e) => {
                let nextIdx = -1;
                if (e.key === "ArrowRight") nextIdx = (idx + 1) % TABS.length;
                else if (e.key === "ArrowLeft")
                  nextIdx = (idx - 1 + TABS.length) % TABS.length;
                if (nextIdx >= 0) {
                  e.preventDefault();
                  setTabActiva(TABS[nextIdx].id);
                  tabRefs.current[nextIdx]?.focus();
                }
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] ${
                activa
                  ? "bg-[#B34720] text-white shadow-xs"
                  : "bg-[#FAF6F0] text-[#2D2A26] hover:bg-[#EFE6DA]"
              }`}
            >
              <span>{t.label}</span>
              {typeof t.badge === "number" && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                    activa
                      ? "bg-white/20 text-white"
                      : "bg-white text-[#5C554E] border border-[#E2D6C8]"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tabActiva === "galeria" && (
        <section
          role="tabpanel"
          id="panel-com-galeria"
          aria-labelledby="tab-com-galeria"
          className="space-y-5"
        >
          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-[#5C554E] absolute left-3.5 top-3.5" />
                <input
                  type="search"
                  value={busquedaGaleria}
                  onChange={(e) => setBusquedaGaleria(e.target.value)}
                  placeholder="Buscar por prenda, tela o aprendizaje..."
                  aria-label="Buscar creaciones en la galería"
                  className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                />
              </div>

              <select
                aria-label="Filtrar por prenda"
                value={filtroPrenda}
                onChange={(e) => setFiltroPrenda(e.target.value)}
                className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
              >
                {prendasUnicas.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr === "Todas" ? "Todas las prendas" : pr}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por tela"
                value={filtroTela}
                onChange={(e) => setFiltroTela(e.target.value)}
                className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
              >
                {telasUnicas.map((tl) => (
                  <option key={tl} value={tl}>
                    {tl === "Todas" ? "Todas las telas" : tl}
                  </option>
                ))}
              </select>

              <select
                aria-label="Ordenar galería"
                value={ordenGaleria}
                onChange={(e) =>
                  setOrdenGaleria(e.target.value as "recientes" | "utiles")
                }
                className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
              >
                <option value="recientes">Más recientes</option>
                <option value="utiles">Más útiles e inspiradoras</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "Todas", label: "Cualquier dificultad" },
                    { id: "facil", label: "Fácil (1–2)" },
                    { id: "media", label: "Intermedia (3)" },
                    { id: "retadora", label: "Retadora (4–5)" },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setFiltroDificultad(d.id)}
                    className={`min-h-[36px] px-3 rounded-full text-xs font-bold border cursor-pointer ${
                      filtroDificultad === d.id
                        ? "bg-[#3B7A57] text-white border-[#3B7A57]"
                        : "bg-[#FAF6F0] text-[#5C554E] border-[#E2D6C8]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-extrabold text-[#2D2A26] cursor-pointer">
                <input
                  type="checkbox"
                  checked={soloPorEncargo}
                  onChange={(e) => setSoloPorEncargo(e.target.checked)}
                  className="w-4 h-4 accent-[#3B7A57]"
                />
                <Briefcase className="w-3.5 h-3.5 text-[#3B7A57]" />
                Solo modistas por encargo
              </label>
            </div>
          </div>

          {publicacionesMostradas.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#E2D6C8] p-10 text-center space-y-2">
              <p className="text-base font-extrabold text-[#2D2A26]">
                Aún no hay prendas con esa combinación de filtros
              </p>
              <p className="text-xs text-[#5C554E]">
                Prueba limpiar la búsqueda o sé la primera en compartir esta prenda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {publicacionesMostradas.map((pub) => {
                const autora = estado.perfiles.find(
                  (p) => p.id === pub.autora_id
                );
                const foto = pub.fotos[0];

                return (
                  <article
                    id={pub.slug}
                    key={pub.id}
                    className="rounded-3xl bg-white border border-[#E2D6C8] overflow-hidden shadow-xs flex flex-col"
                  >
                    {foto && (
                      <div className="relative aspect-[4/3] bg-[#FAF6F0] overflow-hidden">
                        <img
                          src={foto.url}
                          alt={foto.alt}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          {pub.es_demo && (
                            <span className="px-2.5 py-1 rounded-full bg-white/95 text-[#5C554E] text-[11px] font-extrabold shadow-xs">
                              Ejemplo ilustrativo
                            </span>
                          )}
                          {pub.estado === "en_revision" && (
                            <span className="px-2.5 py-1 rounded-full bg-[#B34720] text-white text-[11px] font-extrabold shadow-xs">
                              En revisión previa
                            </span>
                          )}
                          {pub.captura_3d_url && (
                            <span className="px-2.5 py-1 rounded-full bg-[#3B7A57] text-white text-[11px] font-extrabold shadow-xs">
                              3D vs. Real
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#5C554E]">
                          <span>
                            {pub.prenda} · {pub.tela}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#3B7A57]" />
                            {pub.tiempo_horas}h
                          </span>
                        </div>

                        <h2 className="text-base font-extrabold text-[#2D2A26] leading-snug">
                          {pub.titulo}
                        </h2>

                        {autora && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Link
                              href={`/modistas/${autora.usuario_unico}`}
                              className="font-extrabold text-[#B34720] hover:underline"
                            >
                              @{autora.usuario_unico}
                            </Link>
                            {autora.vende_por_encargo && (
                              <span className="px-2 py-0.5 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-[11px] font-extrabold">
                                Por encargo
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-[#5C554E] line-clamp-2 leading-relaxed">
                          “{pub.aprendizaje_nota}”
                        </p>
                      </div>

                      <div className="space-y-2.5 pt-3 border-t border-[#EFE6DA]">
                        <div className="flex items-center justify-between text-xs font-bold text-[#5C554E]">
                          <span className="inline-flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-[#B34720]" />
                            {pub.conteo_reacciones}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5 text-[#3B7A57]" />
                            {pub.conteo_comentarios}
                          </span>
                          <span>{pub.conteo_remixes} remixes</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPublicacionDetalleId(pub.id)}
                            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] hover:border-[#B34720] cursor-pointer"
                          >
                            Ver y comentar
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirMoldeDesdeTarjeta(pub)}
                            className="min-h-[44px] px-3 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Hacer molde
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {limiteCursor < publicacionesFiltradas.length && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setLimiteCursor((c) => c + 6)}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white border border-[#E2D6C8] hover:border-[#B34720] text-sm font-extrabold text-[#2D2A26] cursor-pointer"
              >
                Cargar más creaciones ({publicacionesFiltradas.length - limiteCursor}{" "}
                restantes)
              </button>
            </div>
          )}
        </section>
      )}

      {tabActiva === "preguntas" && (
        <section
          role="tabpanel"
          id="panel-com-preguntas"
          aria-labelledby="tab-com-preguntas"
        >
          <QuestionsSection
            estado={estado}
            alActualizarEstado={manejarActualizarEstado}
          />
        </section>
      )}

      {tabActiva === "retos" && (
        <section
          role="tabpanel"
          id="panel-com-retos"
          aria-labelledby="tab-com-retos"
          className="space-y-6"
        >
          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-xs font-extrabold">
                <Calendar className="w-4 h-4" />
                {retoActivo.fecha_inicio} al {retoActivo.fecha_fin} ·{" "}
                {retoActivo.etiqueta_reto}
              </span>
              <button
                type="button"
                onClick={() =>
                  abrirAsistentePublicacion(leerBorradorCompartirCreacion())
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Subir mi creación al reto
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-[#2D2A26]">
              {retoActivo.titulo}
            </h2>
            <p className="text-sm text-[#5C554E] leading-relaxed">
              {retoActivo.descripcion}
            </p>
            <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 text-xs sm:text-sm text-[#2D2A26]">
              <strong>Reglas del taller:</strong> {retoActivo.reglas}
            </div>
            {retoActivo.guia_blog_slug && (
              <Link
                href={`/blog/${retoActivo.guia_blog_slug}`}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#3B7A57] hover:underline"
              >
                <BookOpen className="w-4 h-4" />
                Leer guía paso a paso para este reto
              </Link>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
              <Scissors className="w-5 h-5 text-[#B34720]" />
              Participaciones del mes ({estado.participacionesReto.length}) ·{" "}
              {yaVoteReto ? "Ya registraste tu voto este mes" : "1 voto por modista"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {estado.participacionesReto.map((part) => {
                const pub = estado.publicaciones.find(
                  (p) => p.id === part.publicacion_id
                );
                const autora = estado.perfiles.find(
                  (p) => p.id === part.autora_id
                );
                if (!pub) return null;

                return (
                  <div
                    key={part.id}
                    className="rounded-3xl bg-white border border-[#E2D6C8] p-4 space-y-3"
                  >
                    {pub.fotos[0] && (
                      <img
                        src={pub.fotos[0].url}
                        alt={pub.fotos[0].alt}
                        loading="lazy"
                        className="aspect-[4/3] w-full rounded-2xl object-cover"
                      />
                    )}
                    <h4 className="font-extrabold text-sm text-[#2D2A26]">
                      {pub.titulo}
                    </h4>
                    <p className="text-xs font-bold text-[#5C554E]">
                      Por @{autora?.usuario_unico ?? "modista"} · {part.conteo_votos}{" "}
                      apoyos
                    </p>
                    <button
                      type="button"
                      disabled={yaVoteReto}
                      onClick={() => {
                        const res = votarParticipacionReto(
                          estado,
                          retoActivo.id,
                          part.id
                        );
                        if (!res.ok) {
                          setAvisoGlobal(
                            res.error ?? "No se pudo registrar tu voto."
                          );
                          return;
                        }
                        manejarActualizarEstado(
                          res.estado,
                          "¡Voto registrado! Gracias por celebrar el trabajo de tus compañeras."
                        );
                      }}
                      className={`w-full min-h-[44px] px-4 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 ${
                        yaVoteReto
                          ? "bg-[#EFE6DA] text-[#5C554E] cursor-not-allowed"
                          : "bg-[#3B7A57] hover:bg-[#2F6647] text-white cursor-pointer"
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {yaVoteReto ? "Voto del mes utilizado" : "Apoyar esta prenda"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#B34720]" />
              Insignias comunitarias (colaborativas y sin rankings)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {INSIGNIAS_CATALOGO.map((ins) => {
                const ganada = Boolean(
                  perfilActivo &&
                    (estado.insigniasPorUsuaria[perfilActivo.id] ?? []).includes(
                      ins.id
                    )
                );
                return (
                  <div
                    key={ins.id}
                    className={`rounded-2xl p-4 border space-y-1.5 ${
                      ganada
                        ? "bg-[#3B7A57]/10 border-[#3B7A57]/40"
                        : "bg-[#FAF6F0] border-[#E2D6C8]"
                    }`}
                  >
                    <p className="text-xs font-extrabold text-[#2D2A26]">
                      {ins.nombre} {ganada ? "✓" : ""}
                    </p>
                    <p className="text-[11px] text-[#5C554E] leading-snug">
                      {ins.descripcion}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {tabActiva === "recursos" && (
        <section
          role="tabpanel"
          id="panel-com-recursos"
          aria-labelledby="tab-com-recursos"
          className="space-y-5"
        >
          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-1">
            <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#B34720]" />
              Biblioteca de Recursos PDF Imprimibles (Carta)
            </h2>
            <p className="text-xs sm:text-sm text-[#5C554E]">
              Hojas de taller generadas al instante sin anuncios ni registros complicados para organizar tus medidas y costos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {estado.descargables.map((rec) => (
              <article
                key={rec.id}
                className="rounded-3xl bg-white border border-[#E2D6C8] p-5 flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#5C554E]">
                    <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E2D6C8]">
                      {rec.categoria} · {rec.version}
                    </span>
                    <span>
                      Actualizado {rec.fecha_actualizacion} ·{" "}
                      {rec.conteo_descargas} descargas
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#2D2A26]">
                    {rec.titulo}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5C554E] leading-relaxed">
                    {rec.descripcion}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EFE6DA]">
                  <button
                    type="button"
                    onClick={() => {
                      descargarRecursoComunidadPdf(rec);
                      manejarActualizarEstado(
                        registrarDescargaRecurso(estado, rec.id),
                        `Descargando "${rec.titulo}" (${rec.version})...`
                      );
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#3B7A57] hover:bg-[#2F6647] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF gratis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = crearReporteModeracion(estado, {
                        objeto_tipo: "publicacion",
                        objeto_id: rec.id,
                        motivo: "otro",
                        detalle: `Sugerencia o reporte de error en recurso "${rec.titulo}"`,
                      });
                      if (!res.ok) {
                        setAvisoGlobal(
                          res.error ?? "Inicia sesión para reportar un error."
                        );
                        return;
                      }
                      manejarActualizarEstado(
                        res.estado,
                        `¡Gracias! Registramos tu aviso sobre "${rec.titulo}".`
                      );
                    }}
                    className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-[#5C554E] hover:text-[#B34720] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Reportar error
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tabActiva === "perfil" && (
        <section
          role="tabpanel"
          id="panel-com-perfil"
          aria-labelledby="tab-com-perfil"
        >
          <ProfileAndModerationSection
            key={actor?.id ?? "anon"}
            estado={estado}
            alActualizarEstado={manejarActualizarEstado}
          />
        </section>
      )}

      {modalPublicarAbierto && (
        <PublishCreationModal
          key={borradorPublicar?.creadoEn ?? "nueva-creacion"}
          abierto={modalPublicarAbierto}
          alCerrar={() => setModalPublicarAbierto(false)}
          estado={estado}
          borrador={borradorPublicar}
          onPublicacionCreada={(siguienteEstado, idCreado, enRevision) => {
            limpiarBorradorCompartirCreacion();
            setModalPublicarAbierto(false);
            setBorradorPublicar(null);
            setPublicacionDetalleId(idCreado);
            manejarActualizarEstado(
              siguienteEstado,
              enRevision
                ? "Tu primera publicación quedó guardada y pasó a revisión rápida antes de mostrarse al público."
                : "¡Tu prenda ya se publicó en Lo que cosieron!"
            );
          }}
        />
      )}

      <PostDetailModal
        publicacion={publicacionSeleccionada}
        autora={
          publicacionSeleccionada
            ? estado.perfiles.find(
                (p) => p.id === publicacionSeleccionada.autora_id
              )
            : undefined
        }
        estado={estado}
        alCerrar={() => setPublicacionDetalleId(null)}
        alActualizarEstado={manejarActualizarEstado}
      />

      <footer className="rounded-3xl bg-white border border-[#E2D6C8] px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#5C554E]">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Users className="w-4 h-4 text-[#3B7A57]" />
          Comunidad de patronaje MoldeFácil · Tus medidas corporales siempre son privadas.
        </span>
        <div className="flex flex-wrap gap-3 font-bold">
          <Link href="/" className="text-[#B34720] hover:underline">
            Generador 2D/3D
          </Link>
          <Link href="/comunidad/normas" className="hover:underline">
            Normas
          </Link>
          <Link href="/comunidad/privacidad" className="hover:underline">
            Privacidad
          </Link>
        </div>
      </footer>
    </div>
  );
}