"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Clock,
  Edit3,
  Flag,
  Heart,
  Lightbulb,
  Lock,
  MessageCircle,
  Send,
  Share2,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import {
  alternarReaccion,
  crearComentario,
  crearReporteModeracion,
  editarComentario,
  eliminarPublicacionComunidad,
  type EstadoComunidad,
  guardarEnColeccion,
  obtenerActorActivo,
  registrarRemixMolde,
} from "@/lib/community/communityStore";
import { codificarConfigMoldeParaUrl } from "@/lib/community/patternBridge";
import {
  puedeEditarComentario,
  puedeEditarContenido,
} from "@/lib/community/rlsPolicyEngine";
import type {
  MotivoReporte,
  PerfilModista,
  PublicacionComunidad,
} from "@/lib/community/types";

const MOTIVOS_REPORTE: Array<{ id: MotivoReporte; label: string }> = [
  { id: "falta_respeto", label: "Falta de respeto o burlas" },
  { id: "fotos_sin_permiso", label: "Foto publicada sin permiso / aparece alguien sin consentimiento" },
  { id: "derechos_autor", label: "Reclamo de derechos de autor o molde de pago escaneado" },
  { id: "menores_identificables", label: "Exposición de menores de edad" },
  { id: "spam", label: "Spam o publicidad engañosa" },
  { id: "otro", label: "Otro motivo" },
];

export default function PostDetailModal({
  publicacion,
  autora,
  estado,
  alCerrar,
  alActualizarEstado,
}: {
  publicacion: PublicacionComunidad | null;
  autora: PerfilModista | undefined;
  estado: EstadoComunidad;
  alCerrar: () => void;
  alActualizarEstado: (nuevoEstado: EstadoComunidad, mensaje?: string) => void;
}) {
  const router = useRouter();
  const [sliderAntesDespues, setSliderAntesDespues] = useState<number>(52);
  const [textoComentario, setTextoComentario] = useState<string>("");
  const [respondiendoA, setRespondiendoA] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState<string>("");
  const [coleccion, setColeccion] = useState<string>("Para coser pronto");
  const [abiertoReporte, setAbiertoReporte] = useState<boolean>(false);
  const [motivoReporte, setMotivoReporte] =
    useState<MotivoReporte>("falta_respeto");
  const [detalleReporte, setDetalleReporte] = useState<string>("");
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<boolean>(false);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const [ahoraTickMs, setAhoraTickMs] = useState<number>(0);

  useEffect(() => {
    if (!publicacion) return;
    queueMicrotask(() => setAhoraTickMs(Date.now()));
    const id = window.setInterval(() => setAhoraTickMs(Date.now()), 30_000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [alCerrar, publicacion]);

  if (!publicacion) return null;

  const actor = obtenerActorActivo(estado);
  const fotoPrincipal = publicacion.fotos[0];
  const comentariosVisibles = estado.comentarios.filter(
    (c) => c.publicacion_id === publicacion.id && !c.oculto
  );
  const comentariosRaiz = comentariosVisibles.filter((c) => !c.padre_id);

  const conteoTipo = (tipo: "me_encanta" | "me_sirvio" | "inspirador") =>
    estado.reacciones.filter(
      (r) =>
        r.objeto_tipo === "publicacion" &&
        r.objeto_id === publicacion.id &&
        r.tipo === tipo
    ).length;

  const miReaccion = (tipo: "me_encanta" | "me_sirvio" | "inspirador") =>
    Boolean(
      actor &&
        estado.reacciones.some(
          (r) =>
            r.usuaria_id === actor.id &&
            r.objeto_tipo === "publicacion" &&
            r.objeto_id === publicacion.id &&
            r.tipo === tipo
        )
    );

  const yaGuardada = Boolean(
    actor &&
      estado.guardados.some(
        (g) => g.usuaria_id === actor.id && g.publicacion_id === publicacion.id
      )
  );

  const enviarComentario = () => {
    setAvisoLocal(null);
    const res = crearComentario(estado, {
      publicacion_id: publicacion.id,
      padre_id: respondiendoA,
      contenido: textoComentario,
    });
    if (!res.ok) {
      setAvisoLocal(res.error ?? "No se pudo publicar el comentario.");
      return;
    }
    setTextoComentario("");
    setRespondiendoA(null);
    alActualizarEstado(res.estado, "Comentario publicado en el taller.");
  };

  const abrirMolde = () => {
    if (!publicacion.config_molde) return;
    const token = codificarConfigMoldeParaUrl(publicacion.config_molde);
    alActualizarEstado(registrarRemixMolde(estado, publicacion.id));
    router.push(`/?molde_comunidad=${encodeURIComponent(token)}`);
  };

  const puedeEliminar = puedeEditarContenido(actor, publicacion.autora_id);

  const manejarEliminarPublicacion = () => {
    const res = eliminarPublicacionComunidad(estado, publicacion.id);
    if (!res.ok) {
      setAvisoLocal(res.error ?? "No se pudo eliminar la publicación.");
      return;
    }
    setConfirmandoEliminar(false);
    alActualizarEstado(res.estado, "Publicación eliminada del taller.");
    alCerrar();
  };

  const compartirEnWhatsapp = () => {
    const enlace =
      typeof window !== "undefined"
        ? `${window.location.origin}/comunidad#${publicacion.slug}`
        : `https://moldefacil.app/comunidad#${publicacion.slug}`;
    const texto = encodeURIComponent(
      `Mira este trabajo de costura en MoldeFácil: "${publicacion.titulo}" por @${autora?.usuario_unico ?? "modista"}. Puedes abrir el molde con tus propias medidas aquí: ${enlace}`
    );
    window.open(`https://wa.me/?text=${texto}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle-publicacion"
      className="fixed inset-0 z-50 bg-[#2D2A26]/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-t-3xl sm:rounded-3xl bg-[#FAF6F0] border border-[#E2D6C8] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <header className="bg-white border-b border-[#E2D6C8] px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#5C554E]">
              <span>{publicacion.prenda}</span>
              <span>·</span>
              <span>{publicacion.tela}</span>
              {publicacion.es_demo && (
                <span className="px-2 py-0.5 rounded-full bg-[#EFE6DA] text-[#5C554E]">
                  Ejemplo ilustrativo
                </span>
              )}
            </div>
            <h2
              id="titulo-detalle-publicacion"
              className="text-lg sm:text-xl font-extrabold text-[#2D2A26] truncate"
            >
              {publicacion.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar detalle de creación"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] flex items-center justify-center text-[#2D2A26] hover:border-[#B34720] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {avisoLocal && (
            <div
              role="status"
              className="rounded-2xl bg-[#FFF6F2] border border-[#E6B8A5] px-4 py-3 text-xs sm:text-sm font-bold text-[#8A3112]"
            >
              {avisoLocal}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              {publicacion.captura_3d_url && fotoPrincipal ? (
                <div className="rounded-3xl bg-white border border-[#E2D6C8] p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-extrabold text-[#2D2A26]">
                    <span className="inline-flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-[#B34720]" />
                      Comparador Antes (3D) / Después (Cosido)
                    </span>
                    <span className="text-[#5C554E]">{sliderAntesDespues}%</span>
                  </div>
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#FAF6F0]">
                    <img
                      src={fotoPrincipal.url}
                      alt={fotoPrincipal.alt}
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        clipPath: `inset(0 ${100 - sliderAntesDespues}% 0 0)`,
                      }}
                    >
                      <img
                        src={publicacion.captura_3d_url}
                        alt={`Simulación 3D previa de ${publicacion.titulo}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#2D2A26]/85 text-white text-[11px] font-bold">
                      Antes (Vista 3D)
                    </span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#3B7A57]/90 text-white text-[11px] font-bold">
                      Después (Prenda real)
                    </span>
                  </div>
                  <label className="block text-[11px] font-bold text-[#5C554E]">
                    Desliza para comparar la simulación 3D contra la prenda real
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliderAntesDespues}
                      onChange={(e) =>
                        setSliderAntesDespues(Number(e.target.value))
                      }
                      className="w-full mt-1 accent-[#B34720]"
                    />
                  </label>
                </div>
              ) : (
                fotoPrincipal && (
                  <div className="rounded-3xl bg-white border border-[#E2D6C8] overflow-hidden aspect-[4/3]">
                    <img
                      src={fotoPrincipal.url}
                      alt={fotoPrincipal.alt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )
              )}

              {publicacion.fotos.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {publicacion.fotos.slice(1).map((f) => (
                    <img
                      key={f.id}
                      src={f.url}
                      alt={f.alt}
                      loading="lazy"
                      className="rounded-2xl aspect-square object-cover border border-[#E2D6C8]"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              {autora && (
                <div className="rounded-2xl bg-white border border-[#E2D6C8] p-4 flex items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/modistas/${autora.usuario_unico}`}
                      className="font-extrabold text-sm text-[#2D2A26] hover:text-[#B34720] underline-offset-2 hover:underline"
                    >
                      {autora.nombre_publico}
                    </Link>
                    <p className="text-xs font-bold text-[#B34720]">
                      @{autora.usuario_unico}
                    </p>
                  </div>
                  {autora.vende_por_encargo && (
                    <span className="px-2.5 py-1 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-[11px] font-extrabold">
                      Por encargo
                    </span>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-white border border-[#E2D6C8] p-4 space-y-2.5 text-xs sm:text-sm">
                <p className="text-[#2D2A26] leading-relaxed">
                  {publicacion.descripcion}
                </p>
                <div className="rounded-xl bg-[#FAF6F0] border border-[#EFE6DA] p-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#B34720]">
                    Lo que aprendí al coserla
                  </p>
                  <p className="text-xs text-[#2D2A26] mt-0.5 leading-relaxed">
                    {publicacion.aprendizaje_nota}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold text-[#5C554E]">
                  <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E2D6C8]">
                    Dificultad {publicacion.dificultad}/5
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E2D6C8]">
                    <Clock className="w-3 h-3 text-[#3B7A57]" />
                    {publicacion.tiempo_horas} h
                  </span>
                  {publicacion.costo_aprox && (
                    <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E2D6C8]">
                      Costo aprox: {publicacion.costo_aprox}
                    </span>
                  )}
                </div>
              </div>

              {publicacion.config_molde ? (
                <div className="rounded-2xl bg-white border border-[#E2D6C8] p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-[#2D2A26]">
                      Configuración del molde (v{publicacion.version_config})
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#28593D]">
                      <Lock className="w-3 h-3" />
                      Sin medidas privadas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#5C554E]">
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0]">
                      Escote: {publicacion.config_molde.necklineStyle}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0]">
                      Manga: {publicacion.config_molde.sleeveStyle}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0]">
                      Silueta: {publicacion.config_molde.torsoFit}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0]">
                      Margen: {publicacion.config_molde.seamAllowance} cm
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={abrirMolde}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Hacer este molde con mis medidas
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#EFF7F1] border border-[#C6DFCD] p-4 space-y-1.5">
                  <p className="text-xs font-extrabold text-[#28593D]">
                    Moda real / Creación libre
                  </p>
                  <p className="text-xs text-[#3C4A40]">
                    {publicacion.referencia_inspiracion ??
                      "Inspiración real compartida por una modista sin partir de un molde fijo del generador."}
                  </p>
                </div>
              )}

              {puedeEliminar && (
                <div className="rounded-2xl bg-[#FFF5F3] border border-[#E7C2B9] p-3 flex flex-wrap items-center justify-between gap-2">
                  {confirmandoEliminar ? (
                    <>
                      <span className="text-xs font-extrabold text-[#8A3112]">
                        ¿Confirmas eliminar esta publicación permanentemente?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={manejarEliminarPublicacion}
                          className="min-h-[38px] px-3 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoEliminar(false)}
                          className="min-h-[38px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold text-[#2D2A26] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminar(true)}
                      className="min-h-[40px] px-3 rounded-xl text-xs font-extrabold text-[#8A3112] hover:bg-[#FFEAE5] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar publicación
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "me_encanta" as const, label: "Me encanta", Icon: Heart },
                    { id: "me_sirvio" as const, label: "Me sirvió", Icon: ThumbsUp },
                    { id: "inspirador" as const, label: "Inspirador", Icon: Lightbulb },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const res = alternarReaccion(
                        estado,
                        "publicacion",
                        publicacion.id,
                        id
                      );
                      if (!res.ok) {
                        setAvisoLocal(res.error ?? "Inicia sesión para reaccionar.");
                        return;
                      }
                      alActualizarEstado(res.estado);
                    }}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                      miReaccion(id)
                        ? "bg-[#B34720] text-white border-[#B34720]"
                        : "bg-white text-[#2D2A26] border-[#E2D6C8]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label} ({conteoTipo(id)})
                  </button>
                ))}
              </div>

              <div className="rounded-2xl bg-white border border-[#E2D6C8] p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Colección para guardar"
                    value={coleccion}
                    onChange={(e) => setColeccion(e.target.value)}
                    className="min-h-[44px] px-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
                  >
                    <option value="Para coser pronto">Para coser pronto</option>
                    <option value="Telas fluidas">Telas fluidas</option>
                    <option value="Ideas por encargo">Ideas por encargo</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const res = guardarEnColeccion(
                        estado,
                        publicacion.id,
                        coleccion
                      );
                      if (!res.ok) {
                        setAvisoLocal(res.error ?? "Inicia sesión para guardar.");
                        return;
                      }
                      alActualizarEstado(
                        res.estado,
                        `Colección "${coleccion}" actualizada.`
                      );
                    }}
                    className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                      yaGuardada
                        ? "bg-[#3B7A57] text-white"
                        : "bg-[#EFE6DA] text-[#2D2A26]"
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {yaGuardada ? "Guardado" : "Guardar"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={compartirEnWhatsapp}
                    className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#3B7A57]" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbiertoReporte((r) => !r)}
                    className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold text-[#5C554E] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5 text-[#B34720]" />
                    Reportar
                  </button>
                </div>
              </div>

              {abiertoReporte && (
                <div className="rounded-2xl bg-[#FFF6F2] border border-[#E6B8A5] p-4 space-y-2.5">
                  <p className="text-xs font-extrabold text-[#8A3112]">
                    Reportar contenido para revisión de moderación
                  </p>
                  <select
                    value={motivoReporte}
                    onChange={(e) =>
                      setMotivoReporte(e.target.value as MotivoReporte)
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E6B8A5] text-xs font-bold"
                  >
                    {MOTIVOS_REPORTE.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={detalleReporte}
                    onChange={(e) => setDetalleReporte(e.target.value)}
                    placeholder="Detalle adicional (opcional)"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E6B8A5] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const res = crearReporteModeracion(estado, {
                        objeto_tipo: "publicacion",
                        objeto_id: publicacion.id,
                        motivo: motivoReporte,
                        detalle: detalleReporte || undefined,
                      });
                      if (!res.ok) {
                        setAvisoLocal(res.error ?? "No se pudo enviar el reporte.");
                        return;
                      }
                      setAbiertoReporte(false);
                      setDetalleReporte("");
                      alActualizarEstado(
                        res.estado,
                        "Reporte enviado a moderación. Gracias por cuidar el taller."
                      );
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Enviar reporte
                  </button>
                </div>
              )}
            </div>
          </div>

          <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-4">
            <h3 className="text-base font-extrabold text-[#2D2A26] flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#B34720]" />
              Comentarios del taller ({comentariosVisibles.length})
            </h3>

            <div className="space-y-2">
              {respondiendoA && (
                <div className="text-xs font-bold text-[#B34720] flex items-center justify-between bg-[#FFF6F2] px-3 py-1.5 rounded-xl">
                  <span>Respondiendo a un comentario</span>
                  <button
                    type="button"
                    onClick={() => setRespondiendoA(null)}
                    className="underline cursor-pointer"
                  >
                    Cancelar respuesta
                  </button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={textoComentario}
                  onChange={(e) => setTextoComentario(e.target.value)}
                  placeholder="Comenta con respeto o menciona con @usuario..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                />
                <button
                  type="button"
                  onClick={enviarComentario}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Comentar
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {comentariosRaiz.length === 0 ? (
                <p className="text-xs text-[#5C554E]">
                  Sé la primera en dejar una nota amable o consejo de costura.
                </p>
              ) : (
                comentariosRaiz.map((com) => {
                  const autoraCom = estado.perfiles.find(
                    (p) => p.id === com.autora_id
                  );
                  const hijos = comentariosVisibles.filter(
                    (h) => h.padre_id === com.id
                  );
                  const editable =
                    ahoraTickMs > 0 &&
                    puedeEditarComentario(actor, com, ahoraTickMs);

                  return (
                    <div
                      key={com.id}
                      className="rounded-2xl bg-[#FAF6F0] border border-[#EFE6DA] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-[#2D2A26]">
                          @{autoraCom?.usuario_unico ?? "modista"}
                        </span>
                        <div className="flex items-center gap-2">
                          {editable && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoId(com.id);
                                setTextoEditado(com.contenido);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3B7A57] cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setRespondiendoA(com.id)}
                            className="text-[11px] font-extrabold text-[#B34720] cursor-pointer"
                          >
                            Responder
                          </button>
                        </div>
                      </div>

                      {editandoId === com.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={textoEditado}
                            onChange={(e) => setTextoEditado(e.target.value)}
                            className="flex-1 min-h-[40px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const res = editarComentario(
                                estado,
                                com.id,
                                textoEditado,
                                ahoraTickMs
                              );
                              if (!res.ok) {
                                setAvisoLocal(
                                  res.error ?? "No se pudo editar el comentario."
                                );
                                return;
                              }
                              setEditandoId(null);
                              alActualizarEstado(res.estado);
                            }}
                            className="min-h-[40px] px-3 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-[#2D2A26]">
                          {com.contenido}
                        </p>
                      )}

                      {hijos.length > 0 && (
                        <div className="pl-4 border-l-2 border-[#E2D6C8] space-y-2 pt-1">
                          {hijos.map((hijo) => {
                            const autoraHijo = estado.perfiles.find(
                              (p) => p.id === hijo.autora_id
                            );
                            return (
                              <div
                                key={hijo.id}
                                className="rounded-xl bg-white px-3 py-2 text-xs"
                              >
                                <span className="font-extrabold text-[#B34720]">
                                  @{autoraHijo?.usuario_unico ?? "modista"}:{" "}
                                </span>
                                <span className="text-[#2D2A26]">
                                  {hijo.contenido}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}