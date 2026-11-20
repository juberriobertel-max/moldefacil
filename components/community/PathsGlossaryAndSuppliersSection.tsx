"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Globe2,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  alternarPasoRuta,
  publicarResenaProveedor,
} from "@/lib/community/expansionStore";
import type { EstadoAmpliacionComunidad } from "@/lib/community/expansionTypes";
import type { ActorSesion } from "@/lib/community/rlsPolicyEngine";

const PAISES_GLOSARIO = ["Colombia", "México", "Argentina", "España", "Perú"];

export default function PathsGlossaryAndSuppliersSection({
  ampliacion,
  actor,
  creadoCuentaIso,
  interaccionesPrevias,
  alActualizarAmpliacion,
}: {
  ampliacion: EstadoAmpliacionComunidad;
  actor: ActorSesion | null;
  creadoCuentaIso: string;
  interaccionesPrevias: number;
  alActualizarAmpliacion: (next: EstadoAmpliacionComunidad, msg?: string) => void;
}) {
  const [paisSeleccionado, setPaisSeleccionado] = useState<string>(
    ampliacion.paisGlosarioPreferido || "Colombia"
  );
  const [proveedorSel, setProveedorSel] = useState<string>(
    ampliacion.proveedores[0]?.id ?? ""
  );
  const [comentarioProv, setComentarioProv] = useState<string>("");
  const [tieneRelacion, setTieneRelacion] = useState<boolean>(false);
  const [califProv, setCalifProv] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {aviso && (
        <div className="rounded-2xl bg-[#EFF7F1] border border-[#B8D7C3] px-4 py-3 text-xs font-bold text-[#28593D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Fase 22A: Rutas guiadas */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#B34720]" />
            Rutas Guiadas Paso a Paso
          </h2>
          <p className="text-xs text-[#5C554E]">
            Avanza a tu ritmo desde la primera toma de medidas hasta terminar tu prenda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ampliacion.rutas.map((ruta) => {
            const completados = actor
              ? ampliacion.progresoRutasPorUsuaria[actor.id]?.[ruta.id] ?? []
              : [];
            const porcentaje = Math.round(
              (completados.length / Math.max(1, ruta.pasos.length)) * 100
            );
            const terminada = completados.length === ruta.pasos.length;

            return (
              <article
                key={ruta.id}
                className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-[#2D2A26]">
                      {ruta.titulo}
                    </h3>
                    <p className="text-xs text-[#5C554E]">
                      {ruta.duracion_estimada} · Molde: {ruta.molde_recomendado}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2D6C8] text-[11px] font-extrabold text-[#28593D]">
                    {porcentaje}%
                  </span>
                </div>

                <p className="text-xs text-[#2D2A26]">{ruta.descripcion}</p>

                <ul className="space-y-2">
                  {ruta.pasos.map((paso) => {
                    const hecho = completados.includes(paso.id);
                    return (
                      <li
                        key={paso.id}
                        className="rounded-xl bg-white border border-[#E2D6C8] p-2.5 flex items-start gap-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={hecho}
                          aria-label={paso.titulo}
                          onChange={() => {
                            const res = alternarPasoRuta(
                              ampliacion,
                              actor,
                              ruta.id,
                              paso.id
                            );
                            if (!res.ok) {
                              setAviso(res.error ?? "Inicia sesión para guardar avance.");
                              return;
                            }
                            alActualizarAmpliacion(res.estado);
                          }}
                          className="mt-0.5 w-4 h-4 accent-[#3B7A57]"
                        />
                        <div className="text-xs">
                          <p className="font-extrabold text-[#2D2A26]">{paso.titulo}</p>
                          <p className="text-[#5C554E]">{paso.detalle}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {terminada ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#28593D]">
                      <Award className="w-4 h-4" />
                      {ruta.insignia_completada}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#5C554E]">
                      Marca todos los pasos para desbloquear tu insignia.
                    </span>
                  )}
                  <Link
                    href="/"
                    className="text-xs font-extrabold text-[#B34720] hover:underline"
                  >
                    Abrir generador →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Fase 22B: Glosario colaborativo con regionalismos */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-[#3B7A57]" />
              Glosario Colaborativo con Regionalismos (disponible offline)
            </h2>
            <p className="text-xs text-[#5C554E]">
              Elige tu país para traducir términos de costura usados en las guías y
              preguntas.
            </p>
          </div>

          <select
            aria-label="País de referencia para el glosario"
            value={paisSeleccionado}
            onChange={(e) => {
              const p = e.target.value;
              setPaisSeleccionado(p);
              alActualizarAmpliacion({
                ...ampliacion,
                paisGlosarioPreferido: p,
              });
            }}
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold"
          >
            {PAISES_GLOSARIO.map((pais) => (
              <option key={pais} value={pais}>
                Regionalismo: {pais}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ampliacion.glosario.map((term) => (
            <div
              key={term.id}
              className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#2D2A26]">
                  {term.variantes[paisSeleccionado] ?? term.termino_base}
                </h3>
                <span className="text-[11px] font-bold text-[#3B7A57]">
                  Estándar: {term.termino_base}
                </span>
              </div>
              <p className="text-xs text-[#5C554E] leading-relaxed">
                {term.definicion_clara}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Fase 23: Directorio de telas y tiendas con reseñas anti-fraude */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#B34720]" />
            Directorio de Telas y Mercerías (Reseñas Anti-Fraude)
          </h2>
          <p className="text-xs text-[#5C554E]">
            Cero posiciones pagadas. Solo pueden reseñar cuentas con{" "}
            <strong>más de 30 días de antigüedad y participación previa</strong>, 1
            reseña por negocio y detección automática de ráfagas o spam.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ampliacion.proveedores.map((prov) => {
            const resenas = ampliacion.resenasProveedores.filter(
              (r) => r.proveedor_id === prov.id
            );
            return (
              <article
                key={prov.id}
                className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-[#2D2A26]">
                      {prov.nombre}
                    </h3>
                    <p className="text-xs text-[#5C554E]">
                      {prov.ciudad_pais} · {prov.categoria}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2D6C8] text-[11px] font-extrabold text-[#2D2A26]">
                    {resenas.length} reseña(s)
                  </span>
                </div>
                <p className="text-xs text-[#2D2A26]">{prov.descripcion}</p>
                {resenas.length < 3 && (
                  <p className="text-[11px] font-bold text-[#8A3112]">
                    Aún tiene pocas reseñas verificadas para promedio definitivo.
                  </p>
                )}

                <ul className="space-y-2">
                  {resenas.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl bg-white border border-[#E2D6C8] p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#B34720] inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" />
                          {r.calificacion}/5
                        </span>
                        {r.tiene_relacion_negocio && (
                          <span className="text-[10px] font-extrabold text-[#8A3112]">
                            Declaró relación con el negocio
                          </span>
                        )}
                        {r.marcada_revision && (
                          <span className="text-[10px] font-extrabold text-[#8A3112] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            En revisión ({r.razon_revision})
                          </span>
                        )}
                      </div>
                      <p className="text-[#2D2A26]">{r.comentario}</p>
                      {r.respuesta_dueno && (
                        <p className="text-[11px] text-[#28593D] bg-[#EFF7F1] rounded-lg px-2 py-1">
                          <strong>Respuesta del comercio:</strong> {r.respuesta_dueno}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const res = publicarResenaProveedor(
              ampliacion,
              actor,
              creadoCuentaIso,
              interaccionesPrevias,
              {
                proveedor_id: proveedorSel,
                calificacion: califProv,
                comentario: comentarioProv,
                tiene_relacion_negocio: tieneRelacion,
              }
            );
            if (!res.ok) {
              setAviso(res.error ?? "No se pudo publicar la reseña.");
              return;
            }
            setComentarioProv("");
            alActualizarAmpliacion(res.estado, "Reseña registrada con verificación anti-fraude.");
          }}
          className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3"
        >
          <p className="text-xs font-extrabold text-[#2D2A26] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#3B7A57]" />
            Dejar reseña verificada (requiere cuenta &gt; 30 días y participación previa)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              value={proveedorSel}
              onChange={(e) => setProveedorSel(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold"
            >
              {ampliacion.proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select
              value={califProv}
              onChange={(e) => setCalifProv(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
              className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold"
            >
              <option value={5}>5 estrellas</option>
              <option value={4}>4 estrellas</option>
              <option value={3}>3 estrellas</option>
              <option value={2}>2 estrellas</option>
              <option value={1}>1 estrella</option>
            </select>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={tieneRelacion}
                onChange={(e) => setTieneRelacion(e.target.checked)}
                className="w-4 h-4 accent-[#B34720]"
              />
              Tengo relación con este negocio
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              required
              minLength={10}
              value={comentarioProv}
              onChange={(e) => setComentarioProv(e.target.value)}
              placeholder="Comparte tu experiencia real con telas, gramaje o trato al cliente..."
              className="flex-1 min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
            />
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
            >
              Publicar reseña
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}