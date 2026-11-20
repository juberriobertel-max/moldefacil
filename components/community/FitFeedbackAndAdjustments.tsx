"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Lock,
  Ruler,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import {
  alternarProbadoraBeta,
  crearAjusteMolde,
  marcarMeFuncionoAjuste,
  obtenerAjustesAgrupadosConKAnonimato,
  registrarRetroalimentacionCalce,
} from "@/lib/community/expansionStore";
import type {
  EstadoAmpliacionComunidad,
  PercepcionZonaCalce,
  ZonaAjusteMolde,
} from "@/lib/community/expansionTypes";
import {
  MIN_RESPUESTAS_ESTADISTICA_ADMIN,
} from "@/lib/community/privacyAggregation";
import { esModeradoraOAdmin, type ActorSesion } from "@/lib/community/rlsPolicyEngine";

const CATEGORIAS_MOLDE = [
  { id: "dress", label: "Vestido Base / Cruzado" },
  { id: "pants", label: "Pantalón Recto / Palazzo" },
  { id: "top", label: "Blusa / Camisa" },
  { id: "skirt", label: "Falda Línea A / Semicircular" },
  { id: "two_piece", label: "Conjunto 2 Piezas" },
];

export default function FitFeedbackAndAdjustments({
  ampliacion,
  actor,
  alActualizarAmpliacion,
  mostrarCalce,
  mostrarAjustes,
}: {
  ampliacion: EstadoAmpliacionComunidad;
  actor: ActorSesion | null;
  alActualizarAmpliacion: (next: EstadoAmpliacionComunidad, msg?: string) => void;
  mostrarCalce: boolean;
  mostrarAjustes: boolean;
}) {
  // Estado encuesta rápida de 30s (Fase 13)
  const [categoriaCalce, setCategoriaCalce] = useState<string>("dress");
  const [bustoCm, setBustoCm] = useState<string>("92");
  const [cinturaCm, setCinturaCm] = useState<string>("72");
  const [caderaCm, setCaderaCm] = useState<string>("98");
  const [telaUsada, setTelaUsada] = useState<string>("Lino prelavado");
  const [calceTalle, setCalceTalle] = useState<PercepcionZonaCalce>("perfecto");
  const [calceBusto, setCalceBusto] = useState<PercepcionZonaCalce>("perfecto");
  const [calceCintura, setCalceCintura] = useState<PercepcionZonaCalce>("perfecto");
  const [calceCadera, setCalceCadera] = useState<PercepcionZonaCalce>("perfecto");
  const [calceHombros, setCalceHombros] = useState<PercepcionZonaCalce>("perfecto");
  const [calceManga, setCalceManga] = useState<PercepcionZonaCalce>("perfecto");
  const [volveriaHacer, setVolveriaHacer] = useState<boolean>(true);

  // Estado biblioteca de ajustes (Fase 14)
  const [zonaAjuste, setZonaAjuste] = useState<ZonaAjusteMolde>("sisa");
  const [cmDelta, setCmDelta] = useState<string>("1");
  const [descAjuste, setDescAjuste] = useState<string>("");
  const [filtroCatAjuste, setFiltroCatAjuste] = useState<string>("dress");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const esAdminOMod = esModeradoraOAdmin(actor);
  const esBeta = actor ? ampliacion.probadorasBetaIds.includes(actor.id) : false;

  const gruposAjustes = useMemo(
    () => obtenerAjustesAgrupadosConKAnonimato(ampliacion, filtroCatAjuste),
    [ampliacion, filtroCatAjuste]
  );

  // Panel admin de calidad de patrones por molde (Fase 13)
  const resumenAdmin = useMemo(() => {
    const mapa = new Map<string, { total: number; repeticion: number; alertasBusto: number }>();
    for (const r of ampliacion.retroalimentaciones) {
      const act = mapa.get(r.molde_categoria) ?? { total: 0, repeticion: 0, alertasBusto: 0 };
      act.total += 1;
      if (r.volveria_hacer) act.repeticion += 1;
      if (r.ajuste_busto !== "perfecto") act.alertasBusto += 1;
      mapa.set(r.molde_categoria, act);
    }
    return Array.from(mapa.entries()).map(([cat, stats]) => ({
      cat,
      ...stats,
      insuficiente: stats.total < MIN_RESPUESTAS_ESTADISTICA_ADMIN,
    }));
  }, [ampliacion.retroalimentaciones]);

  const enviarCalce = (e: React.FormEvent) => {
    e.preventDefault();
    const res = registrarRetroalimentacionCalce(ampliacion, actor, {
      molde_categoria: categoriaCalce,
      version_config: 1,
      bustoCm: Number(bustoCm) || 92,
      cinturaCm: Number(cinturaCm) || 72,
      caderaCm: Number(caderaCm) || 98,
      tela_usada: telaUsada,
      ajuste_talle: calceTalle,
      ajuste_busto: calceBusto,
      ajuste_cintura: calceCintura,
      ajuste_cadera: calceCadera,
      ajuste_hombros: calceHombros,
      ajuste_manga: calceManga,
      volveria_hacer: volveriaHacer,
    });
    if (!res.ok) {
      setMensaje(res.error ?? "No se pudo guardar tu reporte.");
      return;
    }
    setMensaje(
      "¡Gracias! Guardamos tu evaluación agrupada en rango de 5 cm sin exponer tus medidas exactas."
    );
    alActualizarAmpliacion(res.estado);
  };

  const enviarAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    const res = crearAjusteMolde(ampliacion, actor, {
      molde_categoria: filtroCatAjuste,
      version_config: 1,
      bustoCm: Number(bustoCm) || 92,
      zona: zonaAjuste,
      cm_delta: Number(cmDelta) || 0,
      descripcion_corta: descAjuste,
    });
    if (!res.ok) {
      setMensaje(res.error ?? "Revisa el ajuste ingresado.");
      return;
    }
    setDescAjuste("");
    setMensaje("Ajuste compartido en el taller con anonimato por rango de 5 cm.");
    alActualizarAmpliacion(res.estado);
  };

  return (
    <div className="space-y-6">
      {mensaje && (
        <div className="rounded-2xl bg-[#EFF7F1] border border-[#B8D7C3] px-4 py-3 text-xs font-bold text-[#28593D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{mensaje}</span>
        </div>
      )}

      {mostrarCalce && (
        <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#28593D]">
                <Lock className="w-3.5 h-3.5" />
                Privacidad k≥5 · Solo rangos de 5 cm (nunca centímetros exactos)
              </span>
              <h2 className="text-xl font-extrabold text-[#2D2A26]">
                ¿Cómo te quedó el molde? (Cuestionario rápido de 30 s)
              </h2>
              <p className="text-xs text-[#5C554E]">
                Tu experiencia mejora la próxima versión de nuestros moldes para miles
                de modistas.
              </p>
            </div>

            {actor && (
              <button
                type="button"
                onClick={() =>
                  alActualizarAmpliacion(
                    alternarProbadoraBeta(ampliacion, actor),
                    esBeta
                      ? "Saliste del grupo de probadoras beta."
                      : "¡Ahora eres Probadora Beta de nuevos moldes!"
                  )
                }
                className={`min-h-[44px] px-4 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                  esBeta
                    ? "bg-[#3B7A57] text-white border-[#3B7A57]"
                    : "bg-[#FAF6F0] text-[#2D2A26] border-[#E2D6C8]"
                }`}
              >
                <Award className="w-4 h-4" />
                {esBeta ? "Insignia activa: Probadora Beta" : "Unirme a Probadoras Beta"}
              </button>
            )}
          </div>

          <form onSubmit={enviarCalce} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <label className="text-xs font-extrabold text-[#2D2A26] lg:col-span-2">
                Molde evaluado
                <select
                  value={categoriaCalce}
                  onChange={(e) => setCategoriaCalce(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
                >
                  {CATEGORIAS_MOLDE.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-extrabold text-[#2D2A26]">
                Tu busto aprox. (se guarda en rango 5 cm)
                <input
                  type="number"
                  min={50}
                  max={180}
                  value={bustoCm}
                  onChange={(e) => setBustoCm(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
              </label>

              <label className="text-xs font-extrabold text-[#2D2A26]">
                Cintura aprox.
                <input
                  type="number"
                  min={45}
                  max={170}
                  value={cinturaCm}
                  onChange={(e) => setCinturaCm(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
              </label>

              <label className="text-xs font-extrabold text-[#2D2A26]">
                Cadera aprox.
                <input
                  type="number"
                  min={55}
                  max={190}
                  value={caderaCm}
                  onChange={(e) => setCaderaCm(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {(
                [
                  { label: "Talle", val: calceTalle, set: setCalceTalle },
                  { label: "Busto", val: calceBusto, set: setCalceBusto },
                  { label: "Cintura", val: calceCintura, set: setCalceCintura },
                  { label: "Cadera", val: calceCadera, set: setCalceCadera },
                  { label: "Hombros", val: calceHombros, set: setCalceHombros },
                  { label: "Manga / Sisa", val: calceManga, set: setCalceManga },
                ] as const
              ).map((z) => (
                <label
                  key={z.label}
                  className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-2.5 text-xs font-extrabold text-[#2D2A26]"
                >
                  {z.label}
                  <select
                    value={z.val}
                    onChange={(e) => z.set(e.target.value as PercepcionZonaCalce)}
                    className="mt-1 w-full min-h-[38px] px-2 rounded-lg bg-white border border-[#E2D6C8] text-xs font-bold"
                  >
                    <option value="pequeno">Justo / pequeño</option>
                    <option value="perfecto">Calce perfecto</option>
                    <option value="grande">Amplio / grande</option>
                  </select>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={telaUsada}
                  onChange={(e) => setTelaUsada(e.target.value)}
                  placeholder="Tela usada"
                  className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={volveriaHacer}
                    onChange={(e) => setVolveriaHacer(e.target.checked)}
                    className="w-4 h-4 accent-[#3B7A57]"
                  />
                  Volvería a coser este molde
                </label>
              </div>

              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs font-extrabold cursor-pointer"
              >
                Enviar opinión en 1 clic
              </button>
            </div>
          </form>

          {/* Novedades / Changelog de mejoras aplicadas */}
          <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-2">
            <h3 className="text-xs font-extrabold text-[#2D2A26] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#B34720]" />
              Novedades del molde basadas en tus reportes
            </h3>
            {ampliacion.novedadesMolde.map((n) => (
              <p key={n.id} className="text-xs text-[#5C554E]">
                <strong className="text-[#2D2A26]">
                  v{n.version_nueva} · {n.titulo}:
                </strong>{" "}
                {n.resumen}
              </p>
            ))}
          </div>

          {esAdminOMod && (
            <div className="rounded-2xl bg-[#FFF9F2] border border-[#E5C9A8] p-4 space-y-2.5">
              <h3 className="text-xs font-extrabold text-[#8A3112]">
                Panel de Calidad de Moldes (Solo Administración / Moderación)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {resumenAdmin.map((r) => (
                  <div
                    key={r.cat}
                    className="rounded-xl bg-white border border-[#E2D6C8] p-3 space-y-1"
                  >
                    <p className="font-extrabold text-[#2D2A26]">
                      Categoría: {r.cat} ({r.total} respuestas)
                    </p>
                    <p className="text-[#5C554E]">
                      Lo volverían a hacer:{" "}
                      {Math.round((r.repeticion / Math.max(1, r.total)) * 100)}%
                    </p>
                    {r.insuficiente && (
                      <p className="text-[11px] font-bold text-[#8A3112] inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Muestra pequeña (&lt; {MIN_RESPUESTAS_ESTADISTICA_ADMIN} respuestas)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {mostrarAjustes && (
        <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
                <Ruler className="w-5 h-5 text-[#B34720]" />
                Ajustes que funcionaron (Biblioteca comunitaria)
              </h2>
              <p className="text-xs text-[#5C554E]">
                Solo se muestran grupos con k ≥ 5 modistas en cada rango de 5 cm. Los
                grupos con menos de 10 reportes muestran etiqueta “poco probado”.
              </p>
            </div>

            <select
              aria-label="Filtrar ajustes por molde"
              value={filtroCatAjuste}
              onChange={(e) => setFiltroCatAjuste(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold"
            >
              {CATEGORIAS_MOLDE.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {gruposAjustes.length === 0 ? (
              <p className="text-xs text-[#5C554E]">
                Aún no hay suficientes ajustes registrados en esta categoría.
              </p>
            ) : (
              gruposAjustes.map((g) => (
                <div
                  key={g.etiquetaRango}
                  className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-[#2D2A26]">
                      {g.etiquetaRango} · {g.total} reportes
                    </p>
                    {!g.cumpleKAnonimato ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2D6C8] text-[11px] font-bold text-[#5C554E]">
                        Oculto hasta alcanzar k≥5 personas (privacidad)
                      </span>
                    ) : g.etiquetaConfianza === "poco_probado" ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FFF9F2] border border-[#E5C9A8] text-[11px] font-extrabold text-[#8A3112]">
                        Poco probado (5–9 reportes)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EFF7F1] text-[11px] font-extrabold text-[#28593D]">
                        Confirmado por la comunidad
                      </span>
                    )}
                  </div>

                  {g.cumpleKAnonimato && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {g.items.slice(0, 4).map((aj) => (
                        <div
                          key={aj.id}
                          className="rounded-xl bg-white border border-[#E2D6C8] p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs font-extrabold">
                            <span className="text-[#B34720]">
                              Zona: {aj.zona} ({aj.cm_delta > 0 ? `+${aj.cm_delta}` : aj.cm_delta} cm)
                            </span>
                            {aj.slug_blog && (
                              <Link
                                href={`/blog/${aj.slug_blog}`}
                                className="text-[#3B7A57] underline"
                              >
                                Ver en guía editorial
                              </Link>
                            )}
                          </div>
                          <p className="text-xs text-[#2D2A26] leading-relaxed">
                            {aj.descripcion_corta}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const res = marcarMeFuncionoAjuste(ampliacion, actor, aj.id);
                                if (!res.ok) {
                                  setMensaje(res.error ?? "Inicia sesión para votar.");
                                  return;
                                }
                                alActualizarAmpliacion(res.estado);
                              }}
                              className="min-h-[36px] px-3 rounded-lg bg-[#FAF6F0] border border-[#E2D6C8] text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 text-[#3B7A57]" />
                              Me funcionó ({aj.conteo_me_funciono})
                            </button>

                            <Link
                              href={`/?ajuste_sugerido=${encodeURIComponent(
                                `${aj.zona}:${aj.cm_delta}`
                              )}`}
                              className="text-[11px] font-extrabold text-[#B34720] hover:underline"
                            >
                              Previsualizar sugerencia en 2D/3D →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={enviarAjuste}
            className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3"
          >
            <p className="text-xs font-extrabold text-[#2D2A26]">
              Aportar un ajuste que te funcionó
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={zonaAjuste}
                onChange={(e) => setZonaAjuste(e.target.value as ZonaAjusteMolde)}
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold"
              >
                <option value="sisa">Sisa</option>
                <option value="espalda">Espalda</option>
                <option value="tiro">Tiro pantalón</option>
                <option value="busto">Busto / Pinza</option>
                <option value="cintura">Cintura</option>
                <option value="cadera">Cadera</option>
                <option value="largo">Largo total</option>
              </select>
              <input
                type="number"
                step="0.5"
                min={-15}
                max={15}
                value={cmDelta}
                onChange={(e) => setCmDelta(e.target.value)}
                placeholder="Delta cm (ej. +1.5)"
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
              >
                Guardar ajuste
              </button>
            </div>
            <input
              type="text"
              required
              minLength={10}
              value={descAjuste}
              onChange={(e) => setDescAjuste(e.target.value)}
              placeholder="Ej. En telas con caída subí 1 cm la sisa para que no se asome el tirante"
              className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
            />
          </form>
        </section>
      )}
    </div>
  );
}