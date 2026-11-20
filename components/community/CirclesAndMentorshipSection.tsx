"use client";

import React, { useState } from "react";
import {
  Award,
  CheckCircle2,
  HeartHandshake,
  Lock,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  aceptarMentoriaComoMentora,
  crearSolicitudMentoria,
  publicarEnCirculo,
  puedeLeerPublicacionesCirculo,
  unirseACirculo,
} from "@/lib/community/expansionStore";
import type { EstadoAmpliacionComunidad } from "@/lib/community/expansionTypes";
import type { ActorSesion } from "@/lib/community/rlsPolicyEngine";

export default function CirclesAndMentorshipSection({
  ampliacion,
  actor,
  alActualizarAmpliacion,
}: {
  ampliacion: EstadoAmpliacionComunidad;
  actor: ActorSesion | null;
  alActualizarAmpliacion: (next: EstadoAmpliacionComunidad, msg?: string) => void;
}) {
  const [notaCirculo, setNotaCirculo] = useState<Record<string, string>>({});
  const [temaMentoria, setTemaMentoria] = useState<string>("");
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {aviso && (
        <div className="rounded-2xl bg-[#EFF7F1] border border-[#B8D7C3] px-4 py-3 text-xs font-bold text-[#28593D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Fase 19: Círculos de costura */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B34720]" />
            Círculos y Grupos por Ciudad o Técnica
          </h2>
          <p className="text-xs text-[#5C554E]">
            Los mensajes internos de cada círculo son privados para sus integrantes. Los
            círculos se muestran en el directorio público al reunir mínimo 3 integrantes y
            muestran aviso tras 90 días sin actividad.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ampliacion.circulos.map((c) => {
            const esMiembro = actor ? c.miembros_ids.includes(actor.id) : false;
            const enEspera = actor ? c.pendientes_ids.includes(actor.id) : false;
            const puedeVerInterno = puedeLeerPublicacionesCirculo(c, actor);

            return (
              <article
                key={c.id}
                className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#2D2A26]">
                        {c.nombre}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-[#E2D6C8] text-[10px] font-extrabold text-[#5C554E]">
                        {c.tipo_acceso === "abierto" ? "Abierto" : "Con solicitud"}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C554E]">
                      {c.tema_o_ciudad} · {c.miembros_ids.length} integrante(s)
                    </p>
                    {c.miembros_ids.length < 3 && (
                      <p className="text-[11px] font-bold text-[#8A3112] mt-0.5">
                        En formación (reúne {3 - c.miembros_ids.length} más para listado público).
                      </p>
                    )}
                  </div>

                  {!esMiembro && (
                    <button
                      type="button"
                      disabled={enEspera}
                      onClick={() => {
                        const res = unirseACirculo(ampliacion, actor, c.id);
                        if (!res.ok) {
                          setAviso(res.error ?? "Inicia sesión para unirte.");
                          return;
                        }
                        alActualizarAmpliacion(
                          res.estado,
                          c.tipo_acceso === "con_solicitud"
                            ? "Solicitud enviada a la anfitriona del círculo."
                            : `Te uniste a ${c.nombre}.`
                        );
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      {enEspera
                        ? "Solicitud pendiente"
                        : c.tipo_acceso === "con_solicitud"
                          ? "Solicitar ingreso"
                          : "Unirme"}
                    </button>
                  )}
                </div>

                {puedeVerInterno ? (
                  <div className="space-y-2 pt-2 border-t border-[#E2D6C8]">
                    {c.publicaciones_privadas.map((pub) => (
                      <div
                        key={pub.id}
                        className="rounded-xl bg-white border border-[#E2D6C8] p-2.5 text-xs text-[#2D2A26]"
                      >
                        {pub.contenido}
                      </div>
                    ))}
                    {esMiembro && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notaCirculo[c.id] ?? ""}
                          onChange={(e) =>
                            setNotaCirculo((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          placeholder="Compartir apunte en el círculo..."
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const txt = notaCirculo[c.id] ?? "";
                            if (txt.trim().length < 3) return;
                            const res = publicarEnCirculo(ampliacion, actor, c.id, txt);
                            if (!res.ok) {
                              setAviso(res.error ?? "No se pudo publicar.");
                              return;
                            }
                            setNotaCirculo((prev) => ({ ...prev, [c.id]: "" }));
                            alActualizarAmpliacion(res.estado);
                          }}
                          className="min-h-[40px] px-3.5 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                        >
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white border border-[#E2D6C8] px-3 py-2 text-xs font-semibold text-[#5C554E] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#B34720]" />
                    Contenido privado: visible únicamente para integrantes del círculo.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Fase 20: Mentoría 1 a 1 */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-[#3B7A57]" />
            Mentoría 1 a 1 (Sin rankings ni competencia)
          </h2>
          <p className="text-xs text-[#5C554E]">
            Pide una revisión concreta de tu molde antes de cortar tela. Si ninguna
            mentora responde en 7 días, la solicitud se reenvía automáticamente a la
            cola abierta.
          </p>
        </div>

        <div className="rounded-2xl bg-[#FFF9F2] border border-[#E5C9A8] p-3.5 flex items-start gap-2.5 text-xs text-[#5C554E]">
          <ShieldAlert className="w-4 h-4 text-[#B34720] shrink-0 mt-0.5" />
          <p>
            <strong>Espacio seguro:</strong> las sesiones privadas son exclusivamente
            de costura y patronaje; nunca compartas datos bancarios ni contraseñas, y
            usa siempre el botón de reporte ante cualquier conducta inapropiada.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const res = crearSolicitudMentoria(ampliacion, actor, temaMentoria);
            if (!res.ok) {
              setAviso(res.error ?? "Describe tu duda puntual para pedir mentoría.");
              return;
            }
            setTemaMentoria("");
            alActualizarAmpliacion(
              res.estado,
              "Solicitud de mentoría publicada en la cola abierta (plazo 7 días)."
            );
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            required
            value={temaMentoria}
            onChange={(e) => setTemaMentoria(e.target.value)}
            placeholder="Ej. Ayuda revisando mi margen y caída antes de cortar viscosa..."
            className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
          />
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-[#3B7A57] hover:bg-[#2F6446] text-white text-xs font-extrabold cursor-pointer"
          >
            Solicitar mentoría puntual
          </button>
        </form>

        <div className="space-y-2.5">
          {ampliacion.mentorias.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-1 max-w-xl">
                <span className="px-2 py-0.5 rounded-full bg-white border border-[#E2D6C8] text-[10px] font-extrabold text-[#28593D]">
                  Estado: {m.estado} · Vence sin respuesta:{" "}
                  {new Date(m.vence_sin_respuesta_en).toLocaleDateString("es-CO")}
                </span>
                <p className="text-xs font-bold text-[#2D2A26]">{m.tema_concreto}</p>
              </div>

              {m.estado === "abierta" && actor && actor.id !== m.aprendiz_id && (
                <button
                  type="button"
                  onClick={() => {
                    const res = aceptarMentoriaComoMentora(ampliacion, actor, m.id);
                    if (!res.ok) {
                      setAviso(res.error ?? "No puedes aceptar más aprendices por ahora.");
                      return;
                    }
                    alActualizarAmpliacion(
                      res.estado,
                      "Acompañamiento iniciado. ¡Gracias por compartir tu oficio!"
                    );
                  }}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B34720] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  Acompañar como Mentora
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}