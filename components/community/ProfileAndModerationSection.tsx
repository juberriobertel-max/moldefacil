"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Ban,
  CheckCircle2,
  Download,
  ExternalLink,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  actualizarPerfilModista,
  actualizarResumenSemanalCorreo,
  alternarBloqueoUsuaria,
  aprobarPublicacionEnRevision,
  calcularAnaliticaComunidad,
  eliminarCuentaUsuaria,
  type EstadoComunidad,
  exportarDatosUsuariaJson,
  obtenerActorActivo,
  resolverReporteModeracion,
} from "@/lib/community/communityStore";
import { PLANTILLAS_MENSAJES_MODERACION } from "@/lib/community/moderationEngine";
import { esModeradoraOAdmin } from "@/lib/community/rlsPolicyEngine";
import type {
  NivelModista,
  PermisoComentarios,
  VisibilidadPerfil,
} from "@/lib/community/types";

export default function ProfileAndModerationSection({
  estado,
  alActualizarEstado,
}: {
  estado: EstadoComunidad;
  alActualizarEstado: (nuevoEstado: EstadoComunidad, mensaje?: string) => void;
}) {
  const actor = obtenerActorActivo(estado);
  const perfil = useMemo(
    () => estado.perfiles.find((p) => p.id === actor?.id) ?? null,
    [actor?.id, estado.perfiles]
  );

  const [nombrePublico, setNombrePublico] = useState<string>(
    perfil?.nombre_publico ?? ""
  );
  const [usuarioUnico, setUsuarioUnico] = useState<string>(
    perfil?.usuario_unico ?? ""
  );
  const [ciudadPais, setCiudadPais] = useState<string>(
    perfil?.ciudad_pais ?? ""
  );
  const [bio, setBio] = useState<string>(perfil?.bio ?? "");
  const [especialidadesTxt, setEspecialidadesTxt] = useState<string>(
    perfil?.especialidades.join(", ") ?? ""
  );
  const [nivel, setNivel] = useState<NivelModista>(
    perfil?.nivel ?? "aprendiz"
  );
  const [vendeEncargo, setVendeEncargo] = useState<boolean>(
    perfil?.vende_por_encargo ?? false
  );
  const [mostrarContacto, setMostrarContacto] = useState<boolean>(
    perfil?.mostrar_contacto ?? false
  );
  const [whatsapp, setWhatsapp] = useState<string>(
    perfil?.enlace_whatsapp ?? ""
  );
  const [instagram, setInstagram] = useState<string>(
    perfil?.enlace_instagram ?? ""
  );
  const [visibilidad, setVisibilidad] = useState<VisibilidadPerfil>(
    perfil?.visibilidad_perfil ?? "publico"
  );
  const [permisoCom, setPermisoCom] = useState<PermisoComentarios>(
    perfil?.permiso_comentarios ?? "todas"
  );
  const [resumenSemanal, setResumenSemanal] = useState<boolean>(
    perfil?.resumen_semanal_correo ?? false
  );

  const [confirmarBorrado, setConfirmarBorrado] = useState<boolean>(false);
  const [notaModeracion, setNotaModeracion] = useState<string>(
    PLANTILLAS_MENSAJES_MODERACION.ocultar
  );
  const [avisoPerfil, setAvisoPerfil] = useState<string | null>(null);
  const [ahoraAnaliticaMs, setAhoraAnaliticaMs] = useState<number>(
    1_795_132_800_000
  );

  React.useEffect(() => {
    queueMicrotask(() => setAhoraAnaliticaMs(Date.now()));
  }, []);

  const esMod = esModeradoraOAdmin(actor);
  const analitica = useMemo(
    () => calcularAnaliticaComunidad(estado, ahoraAnaliticaMs),
    [ahoraAnaliticaMs, estado]
  );

  if (!perfil) {
    return (
      <div className="rounded-3xl bg-white border border-[#E2D6C8] p-8 text-center space-y-2">
        <p className="text-base font-extrabold text-[#2D2A26]">
          Inicia sesión o crea tu perfil en la barra superior
        </p>
        <p className="text-sm text-[#5C554E]">
          Podrás editar tu ficha de modista, configurar quién te contacta y exportar o borrar tus datos.
        </p>
      </div>
    );
  }

  const misBloqueos = estado.bloqueos.filter(
    (b) => b.bloqueadora_id === perfil.id
  );
  const pendientesRevision = estado.publicaciones.filter(
    (p) => p.estado === "en_revision"
  );
  const reportesPendientes = estado.reportes.filter(
    (r) => r.estado === "pendiente" || r.estado === "en_revision"
  );

  const guardarPerfil = () => {
    setAvisoPerfil(null);
    const especialidades = especialidadesTxt
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = actualizarPerfilModista(estado, {
      nombre_publico: nombrePublico,
      usuario_unico: usuarioUnico,
      ciudad_pais: ciudadPais.trim() || undefined,
      bio,
      especialidades,
      nivel,
      vende_por_encargo: vendeEncargo,
      mostrar_contacto: mostrarContacto,
      enlace_whatsapp: whatsapp.trim() || undefined,
      enlace_instagram: instagram.trim() || undefined,
      visibilidad_perfil: visibilidad,
      permiso_comentarios: permisoCom,
      resumen_semanal_correo: resumenSemanal,
    });
    if (!res.ok) {
      setAvisoPerfil(res.error ?? "No se pudo actualizar tu perfil.");
      return;
    }
    alActualizarEstado(
      res.estado,
      "Tu perfil y preferencias de privacidad se guardaron."
    );
  };

  const descargarJsonDatos = () => {
    const json = exportarDatosUsuariaJson(estado, perfil.id);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mis-datos-${perfil.usuario_unico}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {avisoPerfil && (
        <div
          role="status"
          className="rounded-2xl bg-[#FFF6F2] border border-[#E6B8A5] px-4 py-3 text-sm font-bold text-[#8A3112]"
        >
          {avisoPerfil}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
              <UserCog className="w-5 h-5 text-[#B34720]" />
              Mi Perfil y Privacidad
            </h2>
            <Link
              href={`/modistas/${perfil.usuario_unico}`}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5"
            >
              Ver mi página pública
              <ExternalLink className="w-3.5 h-3.5 text-[#B34720]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Nombre público
              <input
                type="text"
                value={nombrePublico}
                onChange={(e) => setNombrePublico(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
              />
            </label>
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Usuario único (@)
              <input
                type="text"
                value={usuarioUnico}
                onChange={(e) => setUsuarioUnico(e.target.value.toLowerCase())}
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Ciudad o país (opcional)
              <input
                type="text"
                value={ciudadPais}
                onChange={(e) => setCiudadPais(e.target.value)}
                placeholder="Ej. Cali, Colombia"
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
              />
            </label>
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Nivel de experiencia
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value as NivelModista)}
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
              >
                <option value="aprendiz">Aprendiz</option>
                <option value="intermedia">Intermedia</option>
                <option value="profesional">Profesional</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-extrabold text-[#2D2A26]">
            Biografía corta
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
            />
          </label>

          <label className="block text-xs font-extrabold text-[#2D2A26]">
            Especialidades (separadas por coma)
            <input
              type="text"
              value={especialidadesTxt}
              onChange={(e) => setEspecialidadesTxt(e.target.value)}
              placeholder="Ej. Vestidos, Lencería, Ajuste infantil"
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
            />
          </label>

          <div className="space-y-2 pt-2 border-t border-[#EFE6DA]">
            <label className="flex items-start gap-2.5 text-xs font-bold text-[#2D2A26] cursor-pointer">
              <input
                type="checkbox"
                checked={vendeEncargo}
                onChange={(e) => setVendeEncargo(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#3B7A57]"
              />
              <span>
                Activar etiqueta “Modista por encargo” para que clientas te encuentren (sin pagos dentro de MoldeFácil).
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs font-bold text-[#2D2A26] cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarContacto}
                onChange={(e) => setMostrarContacto(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#B34720]"
              />
              <span>
                Mostrar voluntariamente mis enlaces de WhatsApp o Instagram en mi perfil público.
              </span>
            </label>
          </div>

          {mostrarContacto && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-3.5">
              <label className="block text-xs font-bold text-[#2D2A26]">
                WhatsApp (número o enlace https)
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="https://wa.me/573001112233"
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
                />
              </label>
              <label className="block text-xs font-bold text-[#2D2A26]">
                Instagram (@usuario o https)
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@mi_taller"
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Quién puede ver mi perfil
              <select
                value={visibilidad}
                onChange={(e) =>
                  setVisibilidad(e.target.value as VisibilidadPerfil)
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
              >
                <option value="publico">Público para todas</option>
                <option value="solo_registradas">
                  Solo usuarias registradas
                </option>
              </select>
            </label>
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Quién puede comentar en mis prendas
              <select
                value={permisoCom}
                onChange={(e) =>
                  setPermisoCom(e.target.value as PermisoComentarios)
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
              >
                <option value="todas">Cualquier modista</option>
                <option value="seguidoras">Solo seguidoras</option>
                <option value="nadie">Comentarios cerrados</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-bold text-[#2D2A26] cursor-pointer">
            <input
              type="checkbox"
              checked={resumenSemanal}
              onChange={(e) => {
                const activo = e.target.checked;
                setResumenSemanal(activo);
                alActualizarEstado(
                  actualizarResumenSemanalCorreo(estado, perfil.id, activo)
                );
              }}
              className="w-4 h-4 accent-[#3B7A57]"
            />
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#3B7A57]" />
              Recibir resumen semanal opcional (3 creaciones destacadas y 3 dudas resueltas)
            </span>
          </label>

          <button
            type="button"
            onClick={guardarPerfil}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold cursor-pointer"
          >
            Guardar cambios de perfil
          </button>
        </section>

        <aside className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#3B7A57]">
              Vista previa de tu tarjeta pública
            </p>
            <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-sm text-[#2D2A26]">
                  {nombrePublico || perfil.nombre_publico}
                </span>
                {vendeEncargo && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#3B7A57]/15 text-[#28593D] text-[11px] font-extrabold">
                    Modista por encargo
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-[#B34720]">
                @{usuarioUnico || perfil.usuario_unico} · {nivel}
              </p>
              <p className="text-xs text-[#5C554E]">
                {bio || "Sin biografía todavía."}
              </p>
              <p className="text-[11px] font-semibold text-[#5C554E]">
                Contacto:{" "}
                {mostrarContacto
                  ? "Visible según lo que escribiste"
                  : "Oculto por privacidad"}
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-[#B34720]" />
              Cuentas bloqueadas ({misBloqueos.length})
            </h3>
            {misBloqueos.length === 0 ? (
              <p className="text-xs text-[#5C554E]">
                No has bloqueado ninguna cuenta.
              </p>
            ) : (
              <ul className="space-y-2">
                {misBloqueos.map((b) => {
                  const bloqueada = estado.perfiles.find(
                    (p) => p.id === b.bloqueada_id
                  );
                  return (
                    <li
                      key={b.bloqueada_id}
                      className="flex items-center justify-between gap-2 text-xs bg-[#FAF6F0] px-3 py-2 rounded-xl"
                    >
                      <span className="font-bold">
                        @{bloqueada?.usuario_unico ?? b.bloqueada_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const res = alternarBloqueoUsuaria(
                            estado,
                            b.bloqueada_id
                          );
                          alActualizarEstado(res.estado, "Bloqueo retirado.");
                        }}
                        className="text-xs font-extrabold text-[#3B7A57] cursor-pointer"
                      >
                        Desbloquear
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3B7A57]" />
              Control de mis datos (Exportar o Borrar)
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={descargarJsonDatos}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EFE6DA] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#3B7A57]" />
                Exportar mis datos (.json)
              </button>
              <button
                type="button"
                onClick={() => setConfirmarBorrado((v) => !v)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FFF1ED] text-xs font-extrabold text-[#8A3112] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar mi cuenta
              </button>
            </div>
            {confirmarBorrado && (
              <div className="rounded-2xl bg-[#FFF1ED] border border-[#E6B8A5] p-3.5 space-y-2">
                <p className="text-xs font-bold text-[#8A3112]">
                  Esta acción elimina tu perfil y tus publicaciones en esta sesión. ¿Confirmas el borrado definitivo?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = eliminarCuentaUsuaria(estado, perfil.id);
                      setConfirmarBorrado(false);
                      alActualizarEstado(
                        next,
                        "Tu cuenta y tus datos fueron eliminados."
                      );
                    }}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Sí, borrar cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarBorrado(false)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {esMod && (
        <section className="rounded-3xl bg-white border-2 border-[#C85A32]/35 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#B34720]" />
              Panel de Moderación ({pendientesRevision.length} por aprobar ·{" "}
              {reportesPendientes.length} reportes abiertos)
            </h3>
            <span className="px-3 py-1 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-xs font-extrabold">
              Rol activo: {perfil.rol}
            </span>
          </div>

          {pendientesRevision.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase text-[#B34720]">
                Primeras publicaciones esperando revisión
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendientesRevision.map((pub) => (
                  <div
                    key={pub.id}
                    className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold truncate">
                        {pub.titulo}
                      </p>
                      <p className="text-xs text-[#5C554E]">
                        {pub.prenda} · {pub.fotos.length} foto(s) sin EXIF
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const res = aprobarPublicacionEnRevision(estado, pub.id);
                        if (res.ok) {
                          alActualizarEstado(
                            res.estado,
                            `Publicación "${pub.titulo}" aprobada e insignia otorgada.`
                          );
                        }
                      }}
                      className="min-h-[44px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprobar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-[#5C554E]">
              Cola de reportes ciudadanos ({estado.reportes.length})
            </h4>
            <label className="block text-xs font-bold text-[#2D2A26]">
              Mensaje respetuoso predefinido al moderar
              <input
                type="text"
                value={notaModeracion}
                onChange={(e) => setNotaModeracion(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
              />
            </label>

            {reportesPendientes.length === 0 ? (
              <p className="text-xs text-[#5C554E]">
                No hay reportes pendientes en este momento.
              </p>
            ) : (
              <div className="space-y-2.5">
                {reportesPendientes.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-[#8A3112]">
                        {rep.objeto_tipo} · Motivo: {rep.motivo}
                      </span>
                      <span className="font-bold text-[#5C554E]">
                        {rep.creado_en.slice(0, 10)}
                      </span>
                    </div>
                    {rep.detalle && (
                      <p className="text-xs text-[#2D2A26]">{rep.detalle}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: "aprobar" as const, label: "Aprobar" },
                          { id: "ocultar" as const, label: "Ocultar contenido" },
                          { id: "advertir" as const, label: "Advertencia amable" },
                          { id: "descartar" as const, label: "Descartar reporte" },
                        ] as const
                      ).map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            const res = resolverReporteModeracion(
                              estado,
                              rep.id,
                              acc.id,
                              notaModeracion
                            );
                            if (res.ok) {
                              alActualizarEstado(
                                res.estado,
                                `Reporte resuelto con acción "${acc.label}".`
                              );
                            }
                          }}
                          className="min-h-[40px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] hover:border-[#B34720] cursor-pointer"
                        >
                          {acc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#2D2A26] flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#3B7A57]" />
          Métricas saludables del taller (sin rastreadores invasivos)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">Activas / sem.</p>
            <p className="text-xl font-extrabold text-[#2D2A26]">
              {analitica.usuariasActivasSemanales}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">Prendas / sem.</p>
            <p className="text-xl font-extrabold text-[#2D2A26]">
              {analitica.publicacionesSemana}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">Resp. &lt;24h</p>
            <p className="text-xl font-extrabold text-[#3B7A57]">
              {analitica.porcentajePreguntasRespondidas24h}%
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">Dudas resueltas</p>
            <p className="text-xl font-extrabold text-[#3B7A57]">
              {analitica.porcentajePreguntasResueltas}%
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">“Hacer este molde”</p>
            <p className="text-xl font-extrabold text-[#B34720]">
              {analitica.totalHacerEsteMolde}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">Reportes / 100</p>
            <p className="text-xl font-extrabold text-[#2D2A26]">
              {analitica.tasaReportesPorCien}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] p-3">
            <p className="text-[11px] font-bold text-[#5C554E]">Mod. media (min)</p>
            <p className="text-xl font-extrabold text-[#2D2A26]">
              {analitica.tiempoMedioModeracionMinutos}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}