"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Flag,
  HelpCircle,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Upload,
} from "lucide-react";
import {
  aceptarRespuestaPregunta,
  alternarReaccion,
  crearPreguntaComunidad,
  crearReporteModeracion,
  crearRespuestaPregunta,
  type EstadoComunidad,
  obtenerActorActivo,
  promoverPreguntaABlog,
} from "@/lib/community/communityStore";
import { ETIQUETAS_SELECTORES_DEMO } from "@/lib/community/demoSeed";
import { procesarImagenClienteSinExif } from "@/lib/community/imageSecurity";
import { buscarPreguntasSimilares, normalizarTextoEspanol } from "@/lib/community/moderationEngine";
import {
  esModeradoraOAdmin,
  puedeAceptarRespuesta,
  puedeLeerPregunta,
} from "@/lib/community/rlsPolicyEngine";
import type { CategoriaPregunta } from "@/lib/community/types";

const CATEGORIAS: Array<{ id: CategoriaPregunta; label: string }> = [
  { id: "medidas", label: "Medidas" },
  { id: "ajustes_molde", label: "Ajustes de molde" },
  { id: "telas", label: "Telas y caídas" },
  { id: "costura_acabados", label: "Costura y acabados" },
  { id: "imprimir_armar", label: "Imprimir y armar PDF" },
  { id: "negocio_precios", label: "Negocio y precios" },
];

const ARTICULOS_REVISTA: Array<{ slug: string; titulo: string }> = [
  {
    slug: "formula-exacta-faldas-circulares-plato-medio-doble",
    titulo: "Fórmula exacta para faldas circulares",
  },
  {
    slug: "como-imprimir-moldes-pdf-en-casa-sin-descuadrar",
    titulo: "Cómo imprimir moldes PDF en Carta / A4 sin descuadrar",
  },
  {
    slug: "como-tomar-10-medidas-corporales-sin-ayuda",
    titulo: "Cómo tomar las 10 medidas corporales sin ayuda",
  },
  {
    slug: "guia-acabados-limpios-vistas-sesgos-dobladillos",
    titulo: "Guía de acabados limpios: vistas, sesgos y dobladillos",
  },
  {
    slug: "como-ponerle-precio-justo-a-tu-trabajo-de-costura",
    titulo: "Cómo ponerle precio justo a tu trabajo de costura",
  },
];

export default function QuestionsSection({
  estado,
  alActualizarEstado,
}: {
  estado: EstadoComunidad;
  alActualizarEstado: (nuevoEstado: EstadoComunidad, mensaje?: string) => void;
}) {
  const actor = obtenerActorActivo(estado);
  const esMod = esModeradoraOAdmin(actor);

  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>("todas");
  const [soloSinResponder, setSoloSinResponder] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [mostrarFormulario, setMostrarFormulario] = useState<boolean>(false);

  const [titulo, setTitulo] = useState<string>("");
  const [detalle, setDetalle] = useState<string>("");
  const [categoria, setCategoria] = useState<CategoriaPregunta>("ajustes_molde");
  const [moldeRef, setMoldeRef] = useState<string>("");
  const [etiquetasSel, setEtiquetasSel] = useState<string[]>([]);
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const [fotoAlt, setFotoAlt] = useState<string>("");

  const [expandidaId, setExpandidaId] = useState<string | null>(
    estado.preguntas[0]?.id ?? null
  );
  const [borradoresRespuesta, setBorradoresRespuesta] = useState<
    Record<string, string>
  >({});
  const [slugPromocion, setSlugPromocion] = useState<string>(
    ARTICULOS_REVISTA[0].slug
  );
  const [avisoQ, setAvisoQ] = useState<string | null>(null);

  const similares = useMemo(
    () => buscarPreguntasSimilares(titulo, detalle, estado.preguntas, 3),
    [detalle, estado.preguntas, titulo]
  );

  const preguntasVisibles = useMemo(() => {
    const qNorm = normalizarTextoEspanol(busqueda);
    return estado.preguntas.filter((p) => {
      if (!puedeLeerPregunta(actor, p, { bloqueos: estado.bloqueos })) {
        return false;
      }
      if (filtroCat !== "todas" && p.categoria !== filtroCat) return false;
      if (filtroEtiqueta !== "todas" && !p.etiquetas.includes(filtroEtiqueta)) {
        return false;
      }
      if (soloSinResponder && p.conteo_respuestas > 0) return false;
      if (
        qNorm &&
        !normalizarTextoEspanol(
          `${p.titulo} ${p.detalle} ${p.molde_referencia ?? ""} ${p.etiquetas.join(" ")}`
        ).includes(qNorm)
      ) {
        return false;
      }
      return true;
    });
  }, [
    actor,
    busqueda,
    estado.bloqueos,
    estado.preguntas,
    filtroCat,
    filtroEtiqueta,
    soloSinResponder,
  ]);

  const manejarSubirFotoPregunta = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const res = await procesarImagenClienteSinExif(files[0], {
        maxLadoPx: 1400,
        maxBytes: 350 * 1024,
      });
      setFotoUrl(res.dataUrl);
      if (!fotoAlt.trim()) {
        setFotoAlt("Foto de costura para ilustrar la duda técnica en el taller");
      }
    } catch (err) {
      setAvisoQ(
        err instanceof Error ? err.message : "No se pudo procesar la foto."
      );
    }
  };

  const enviarPregunta = () => {
    setAvisoQ(null);
    const res = crearPreguntaComunidad(estado, {
      titulo,
      detalle,
      categoria,
      foto_url: fotoUrl,
      foto_alt: fotoUrl ? fotoAlt : undefined,
      molde_referencia: moldeRef.trim() || undefined,
      etiquetas: etiquetasSel,
    });
    if (!res.ok) {
      setAvisoQ(res.error ?? "No se pudo publicar la pregunta.");
      return;
    }
    setTitulo("");
    setDetalle("");
    setMoldeRef("");
    setEtiquetasSel([]);
    setFotoUrl(undefined);
    setFotoAlt("");
    setMostrarFormulario(false);
    if (res.idCreado) setExpandidaId(res.idCreado);
    alActualizarEstado(
      res.estado,
      "Tu pregunta ya está publicada. Otras modistas recibirán el aviso."
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#B34720]" />
            Pregúntale a la modista
          </h2>
          <p className="text-xs sm:text-sm text-[#5C554E]">
            Resuelve dudas reales sobre ajuste de busto, sisas, tiros, telas o impresión Carta/A4 en menos de 24 h.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarFormulario((v) => !v)}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4" />
          {mostrarFormulario ? "Cerrar formulario" : "Hacer una pregunta"}
        </button>
      </div>

      {avisoQ && (
        <div
          role="status"
          className="rounded-2xl bg-[#FFF6F2] border border-[#E6B8A5] px-4 py-3 text-sm font-bold text-[#8A3112]"
        >
          {avisoQ}
        </div>
      )}

      {mostrarFormulario && (
        <div className="rounded-3xl bg-white border-2 border-[#C85A32]/35 p-5 sm:p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-extrabold text-[#2D2A26]">
            Nueva consulta al taller
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Categoría
              <select
                value={categoria}
                onChange={(e) =>
                  setCategoria(e.target.value as CategoriaPregunta)
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-extrabold text-[#2D2A26]">
              Molde relacionado (opcional)
              <input
                type="text"
                value={moldeRef}
                onChange={(e) => setMoldeRef(e.target.value)}
                placeholder="Ej. Pantalón pinzado o Vestido escote V"
                className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
              />
            </label>
          </div>

          <label className="block text-xs font-extrabold text-[#2D2A26]">
            Título claro de tu duda
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. ¿Cómo evito que se abra el escote en V en viscosa?"
              className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
            />
          </label>

          <label className="block text-xs font-extrabold text-[#2D2A26]">
            Cuéntanos qué tela usas y qué notaste en la prueba
            <textarea
              rows={3}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Describe el ajuste sin necesidad de publicar tus medidas privadas..."
              className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
            />
          </label>

          {similares.length > 0 && (
            <div className="rounded-2xl bg-[#3B7A57]/10 border border-[#3B7A57]/30 p-4 space-y-2">
              <p className="text-xs font-extrabold text-[#28593D] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Antes de publicar, mira estas preguntas parecidas ya contestadas:
              </p>
              <ul className="space-y-1.5">
                {similares.map((sim) => (
                  <li key={sim.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandidaId(sim.id);
                        setMostrarFormulario(false);
                      }}
                      className="text-left text-xs font-bold text-[#2D2A26] hover:text-[#B34720] underline cursor-pointer"
                    >
                      {sim.titulo} {sim.resuelta ? "✓ (Resuelta)" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-extrabold text-[#2D2A26]">
              Etiquetas del patrón (opcional, máx. 6)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ETIQUETAS_SELECTORES_DEMO.map((et) => {
                const activa = etiquetasSel.includes(et.nombre);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() =>
                      setEtiquetasSel((prev) =>
                        activa
                          ? prev.filter((x) => x !== et.nombre)
                          : prev.length < 6
                            ? [...prev, et.nombre]
                            : prev
                      )
                    }
                    className={`min-h-[36px] px-3 rounded-full text-xs font-bold border cursor-pointer ${
                      activa
                        ? "bg-[#3B7A57] text-white border-[#3B7A57]"
                        : "bg-[#FAF6F0] text-[#5C554E] border-[#E2D6C8]"
                    }`}
                  >
                    {et.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EFE6DA] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-[#B34720]" />
              Adjuntar foto de la prueba (sin EXIF)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  void manejarSubirFotoPregunta(e.target.files);
                  e.currentTarget.value = "";
                }}
                className="sr-only"
              />
            </label>
            {fotoUrl && (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#28593D]">
                <ShieldCheck className="w-4 h-4" />
                Foto limpia adjunta
              </span>
            )}
          </div>

          {fotoUrl && (
            <input
              type="text"
              value={fotoAlt}
              onChange={(e) => setFotoAlt(e.target.value)}
              placeholder="Descripción breve de la foto para accesibilidad (alt)"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
            />
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={enviarPregunta}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#3B7A57] hover:bg-[#2F6647] text-white text-sm font-extrabold cursor-pointer"
            >
              Publicar duda al taller
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-[#E2D6C8] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5C554E] absolute left-3.5 top-3.5" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar duda (ej. tiro, pinza, sisa)..."
              aria-label="Buscar preguntas de modistas"
              className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
            />
          </div>
          <select
            aria-label="Filtrar por categoría de duda"
            value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm font-bold"
          >
            <option value="todas">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por etiqueta del selector"
            value={filtroEtiqueta}
            onChange={(e) => setFiltroEtiqueta(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm font-bold"
          >
            <option value="todas">Todas las etiquetas técnicas</option>
            {ETIQUETAS_SELECTORES_DEMO.map((et) => (
              <option key={et.id} value={et.nombre}>
                {et.nombre}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-bold text-[#5C554E] cursor-pointer">
          <input
            type="checkbox"
            checked={soloSinResponder}
            onChange={(e) => setSoloSinResponder(e.target.checked)}
            className="w-4 h-4 accent-[#B34720]"
          />
          Mostrar primero dudas sin responder
        </label>
      </div>

      <div className="space-y-4">
        {preguntasVisibles.length === 0 ? (
          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-8 text-center text-sm text-[#5C554E]">
            No encontramos preguntas con esos filtros. ¡Anímate a abrir la primera consulta!
          </div>
        ) : (
          preguntasVisibles.map((preg) => {
            const autora = estado.perfiles.find((p) => p.id === preg.autora_id);
            const respuestas = estado.respuestas.filter(
              (r) => r.pregunta_id === preg.id && !r.oculto
            );
            const abierta = expandidaId === preg.id;
            const borradorResp = borradoresRespuesta[preg.id] ?? "";

            return (
              <article
                key={preg.id}
                className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E2D6C8] font-extrabold text-[#5C554E]">
                      {CATEGORIAS.find((c) => c.id === preg.categoria)?.label ??
                        preg.categoria}
                    </span>
                    {preg.resuelta && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3B7A57]/15 text-[#28593D] font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resuelta
                      </span>
                    )}
                    {preg.destacada_semana && (
                      <span className="px-2.5 py-1 rounded-full bg-[#FFF6F2] text-[#B34720] font-extrabold">
                        Pregunta destacada
                      </span>
                    )}
                    {preg.es_demo && (
                      <span className="px-2.5 py-1 rounded-full bg-[#EFE6DA] text-[#5C554E] font-bold">
                        Ejemplo ilustrativo
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold text-[#5C554E]">
                    {respuestas.length} respuesta(s)
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandidaId(abierta ? null : preg.id)
                    }
                    className="text-left text-base sm:text-lg font-extrabold text-[#2D2A26] hover:text-[#B34720] cursor-pointer"
                  >
                    {preg.titulo}
                  </button>
                  <p className="text-xs sm:text-sm text-[#5C554E] mt-1">
                    {preg.detalle}
                  </p>
                  <p className="text-xs font-bold text-[#5C554E] mt-2">
                    Preguntó{" "}
                    {autora ? (
                      <Link
                        href={`/modistas/${autora.usuario_unico}`}
                        className="text-[#B34720] hover:underline"
                      >
                        @{autora.usuario_unico}
                      </Link>
                    ) : (
                      "@modista"
                    )}
                    {preg.molde_referencia
                      ? ` · Molde: ${preg.molde_referencia}`
                      : ""}
                  </p>
                </div>

                {preg.etiquetas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preg.etiquetas.map((et) => (
                      <span
                        key={et}
                        className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E2D6C8] text-[11px] font-bold text-[#5C554E]"
                      >
                        #{et}
                      </span>
                    ))}
                  </div>
                )}

                {preg.articulo_blog_slug && (
                  <Link
                    href={`/blog/${preg.articulo_blog_slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#3B7A57] hover:underline"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Convertida en guía permanente de la Revista
                  </Link>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EFE6DA]">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandidaId(abierta ? null : preg.id)
                    }
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] hover:border-[#B34720] cursor-pointer"
                  >
                    {abierta
                      ? "Ocultar respuestas"
                      : `Ver o responder (${respuestas.length})`}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const res = crearReporteModeracion(estado, {
                        objeto_tipo: "pregunta",
                        objeto_id: preg.id,
                        motivo: "otro",
                        detalle: "Revisión solicitada desde Pregúntale a la modista",
                      });
                      if (!res.ok) {
                        setAvisoQ(res.error ?? "Inicia sesión para reportar.");
                        return;
                      }
                      alActualizarEstado(
                        res.estado,
                        "Pregunta enviada a revisión de moderación."
                      );
                    }}
                    className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-[#5C554E] hover:text-[#B34720] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Reportar
                  </button>
                </div>

                {abierta && (
                  <div className="pt-3 space-y-3 border-t border-[#EFE6DA]">
                    {preg.foto_url && (
                      <img
                        src={preg.foto_url}
                        alt={preg.foto_alt ?? preg.titulo}
                        className="max-h-64 rounded-2xl border border-[#E2D6C8] object-cover"
                      />
                    )}

                    {respuestas.map((resp) => {
                      const respAutora = estado.perfiles.find(
                        (p) => p.id === resp.autora_id
                      );
                      const puedeMarcar = puedeAceptarRespuesta(
                        actor,
                        preg,
                        resp
                      );
                      const conteoUtil =
                        resp.conteo_me_sirvio +
                        estado.reacciones.filter(
                          (r) =>
                            r.objeto_tipo === "respuesta" &&
                            r.objeto_id === resp.id
                        ).length;

                      return (
                        <div
                          key={resp.id}
                          className={`rounded-2xl p-4 space-y-2 border ${
                            resp.es_aceptada
                              ? "bg-[#3B7A57]/8 border-[#3B7A57]/40"
                              : "bg-[#FAF6F0] border-[#E2D6C8]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-extrabold text-[#2D2A26]">
                              @{respAutora?.usuario_unico ?? "modista"}
                            </span>
                            {resp.es_aceptada && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3B7A57] text-white text-[11px] font-extrabold">
                                <CheckCircle2 className="w-3 h-3" />
                                Solución aceptada
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-[#2D2A26] leading-relaxed">
                            {resp.contenido}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const res = alternarReaccion(
                                  estado,
                                  "respuesta",
                                  resp.id,
                                  "me_sirvio"
                                );
                                if (!res.ok) {
                                  setAvisoQ(res.error ?? "Inicia sesión para valorar.");
                                  return;
                                }
                                alActualizarEstado(res.estado);
                              }}
                              className="min-h-[40px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 text-[#3B7A57]" />
                              Me sirvió ({conteoUtil})
                            </button>

                            {puedeMarcar && !resp.es_aceptada && (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = aceptarRespuestaPregunta(
                                    estado,
                                    preg.id,
                                    resp.id
                                  );
                                  if (!res.ok) {
                                    setAvisoQ(res.error ?? "No se pudo marcar como resuelta.");
                                    return;
                                  }
                                  alActualizarEstado(
                                    res.estado,
                                    "¡Genial! Marcamos esa respuesta como solución."
                                  );
                                }}
                                className="min-h-[40px] px-3 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Esto me resolvió
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={borradorResp}
                        onChange={(e) =>
                          setBorradoresRespuesta((prev) => ({
                            ...prev,
                            [preg.id]: e.target.value,
                          }))
                        }
                        placeholder="Comparte tu solución o consejo de patronaje..."
                        className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const res = crearRespuestaPregunta(estado, {
                            pregunta_id: preg.id,
                            contenido: borradorResp,
                          });
                          if (!res.ok) {
                            setAvisoQ(res.error ?? "No se pudo publicar tu respuesta.");
                            return;
                          }
                          setBorradoresRespuesta((prev) => ({
                            ...prev,
                            [preg.id]: "",
                          }));
                          alActualizarEstado(res.estado, "Respuesta publicada.");
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        Responder
                      </button>
                    </div>

                    {esMod && !preg.articulo_blog_slug && (
                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-[#2D2A26]">
                          Moderación · Vincular con artículo de Revista:
                        </span>
                        <select
                          value={slugPromocion}
                          onChange={(e) => setSlugPromocion(e.target.value)}
                          className="min-h-[40px] px-2.5 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold"
                        >
                          {ARTICULOS_REVISTA.map((art) => (
                            <option key={art.slug} value={art.slug}>
                              {art.titulo}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const res = promoverPreguntaABlog(
                              estado,
                              preg.id,
                              slugPromocion
                            );
                            if (res.ok) {
                              alActualizarEstado(
                                res.estado,
                                "Pregunta enlazada con la guía de la Revista."
                              );
                            }
                          }}
                          className="min-h-[40px] px-3 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
                        >
                          Promover a guía
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}