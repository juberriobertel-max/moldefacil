"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { EstadoComunidad } from "@/lib/community/communityStore";
import {
  actualizarEstadoEncargo,
  alternarConsentimientoMedidasEncargo,
  crearSolicitudEncargo,
  publicarResenaEncargo,
  registrarLecturaMedidasModista,
} from "@/lib/community/expansionStore";
import type {
  EstadoAmpliacionComunidad,
  EstadoEncargo,
} from "@/lib/community/expansionTypes";
import { construirConfigMoldeDesdeGenerador } from "@/lib/community/patternBridge";
import type { ActorSesion } from "@/lib/community/rlsPolicyEngine";
import { loadMeasurementProfiles } from "@/lib/savedMeasurements";
import { DEFAULT_GARMENT_EXTRAS } from "@/lib/types";

const CONFIG_BASE_ENCARGO = construirConfigMoldeDesdeGenerador({
  category: "dress",
  topSubStyle: "blouse",
  pantsSubStyle: "straight",
  skirtSubStyle: "a_line",
  dressSubStyle: "dress",
  twoPieceTopStyle: "crop_top",
  twoPieceBottomStyle: "aline_skirt",
  jumpsuitSubStyle: "romper_long",
  kidsSubStyle: "baby_bodysuit",
  loungewearSubStyle: "leggings",
  accessorySubStyle: "bucket_hat",
  necklineStyle: "round",
  sleeveStyle: "short",
  torsoFit: "fitted",
  seamAllowance: 1,
  fabricType: "woven",
  extras: { ...DEFAULT_GARMENT_EXTRAS },
  quickLength: "photo",
  styleVariant: "default",
  apariencia3D: {
    tela: "lino",
    color: "#C85A32",
    estampado: "liso",
    mostrarCosturas: false,
  },
});

export default function DirectoryAndCommissionsSection({
  ampliacion,
  estadoComunidad,
  actor,
  alActualizarAmpliacion,
}: {
  ampliacion: EstadoAmpliacionComunidad;
  estadoComunidad: EstadoComunidad;
  actor: ActorSesion | null;
  alActualizarAmpliacion: (next: EstadoAmpliacionComunidad, msg?: string) => void;
}) {
  const [filtroCiudad, setFiltroCiudad] = useState<string>("");
  const [soloVerificadas, setSoloVerificadas] = useState<boolean>(false);
  const [modistaSeleccionadaId, setModistaSeleccionadaId] = useState<string>("");
  const [tituloPrenda, setTituloPrenda] = useState<string>("");
  const [telaColor, setTelaColor] = useState<string>("Lino terracota");
  const [notasClienta, setNotasClienta] = useState<string>("");
  const [medidasLeidas, setMedidasLeidas] = useState<
    Record<string, Record<string, number>>
  >({});
  const [notaResena, setNotaResena] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const modistas = useMemo(() => {
    return estadoComunidad.perfiles
      .filter((p) => p.vende_por_encargo && !p.suspendida)
      .map((p) => {
        const pro = ampliacion.perfilesPro.find((x) => x.usuaria_id === p.id);
        return { perfil: p, pro };
      })
      .filter(({ perfil, pro }) => {
        if (soloVerificadas && !pro?.verificada_manual) return false;
        if (
          filtroCiudad.trim() &&
          !`${perfil.ciudad_pais ?? ""} ${pro?.ciudad_pais ?? ""} ${pro?.servicios.join(" ") ?? ""}`
            .toLowerCase()
            .includes(filtroCiudad.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      });
  }, [ampliacion.perfilesPro, estadoComunidad.perfiles, filtroCiudad, soloVerificadas]);

  const misEncargos = useMemo(() => {
    if (!actor) return ampliacion.encargos.filter((e) => e.es_demo);
    return ampliacion.encargos.filter(
      (e) =>
        e.clienta_id === actor.id ||
        e.modista_id === actor.id ||
        e.es_demo
    );
  }, [actor, ampliacion.encargos]);

  const enviarEncargo = (e: React.FormEvent) => {
    e.preventDefault();
    const modistaId = modistaSeleccionadaId || modistas[0]?.perfil.id || "";
    if (!modistaId) {
      setAviso("Elige primero una modista disponible.");
      return;
    }
    const res = crearSolicitudEncargo(ampliacion, actor, {
      modistaId,
      titulo_prenda: tituloPrenda || "Prenda personalizada con MoldeFácil",
      config_molde: CONFIG_BASE_ENCARGO,
      tela_color_deseado: telaColor,
      notas_clienta: notasClienta,
      compartirMedidasAhora: false, // Excluidas por defecto hasta autorización explícita
    });
    if (!res.ok) {
      setAviso(res.error ?? "No pudimos enviar la solicitud.");
      return;
    }
    setTituloPrenda("");
    setNotasClienta("");
    alActualizarAmpliacion(
      res.estado,
      "Solicitud enviada sin medidas privadas. Puedes autorizar medidas por 30 días si la modista acepta."
    );
  };

  return (
    <div className="space-y-6">
      {aviso && (
        <div className="rounded-2xl bg-[#EFF7F1] border border-[#B8D7C3] px-4 py-3 text-xs font-bold text-[#28593D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Aviso de acuerdo directo sin pagos en plataforma */}
      <div className="rounded-2xl bg-[#FFF9F2] border border-[#E5C9A8] p-4 flex flex-wrap items-start gap-3 text-xs text-[#5C554E]">
        <AlertTriangle className="w-4 h-4 text-[#B34720] shrink-0 mt-0.5" />
        <p>
          <strong>Acuerdo directo y seguro:</strong> MoldeFácil conecta clientas y
          modistas pero <strong>no procesa pagos ni intermedia cobros</strong>. La
          insignia <em>Verificada</em> indica revisión manual de perfil en taller y{" "}
          <strong>no constituye garantía comercial</strong>; recuerda pedir avance con
          fotos de prueba antes de cancelar el saldo total.
        </p>
      </div>

      {/* Directorio de modistas (Fase 17) */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#2D2A26]">
              Directorio de Modistas por Encargo y Portafolios
            </h2>
            <p className="text-xs text-[#5C554E]">
              Explora hasta 12 trabajos terminados, tiempos de entrega y especialidades.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={filtroCiudad}
              onChange={(e) => setFiltroCiudad(e.target.value)}
              placeholder="Filtrar ciudad o especialidad..."
              className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
            />
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={soloVerificadas}
                onChange={(e) => setSoloVerificadas(e.target.checked)}
                className="w-4 h-4 accent-[#3B7A57]"
              />
              Solo verificadas manualmente
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modistas.map(({ perfil, pro }) => (
            <article
              key={perfil.id}
              className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/modistas/${perfil.usuario_unico}`}
                      className="text-base font-extrabold text-[#2D2A26] hover:text-[#B34720]"
                    >
                      {perfil.nombre_publico}
                    </Link>
                    {pro?.verificada_manual && (
                      <span
                        title={pro.nota_verificacion}
                        className="px-2 py-0.5 rounded-full bg-[#EFF7F1] text-[#28593D] text-[11px] font-extrabold inline-flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Verificada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C554E]">
                    @{perfil.usuario_unico} ·{" "}
                    {pro?.ciudad_pais || perfil.ciudad_pais || "Taller independiente"} ·
                    Responde aprox. en {pro?.tiempo_respuesta_horas ?? 24} h
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModistaSeleccionadaId(perfil.id);
                    setAviso(`Seleccionaste a ${perfil.nombre_publico} abajo para pedir tu prenda.`);
                  }}
                  className="min-h-[40px] px-3 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                >
                  Elegir para encargo
                </button>
              </div>

              {pro?.verificada_manual && (
                <p className="text-[11px] text-[#5C554E] italic">
                  {pro.nota_verificacion}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {(pro?.servicios ?? perfil.especialidades).slice(0, 4).map((srv) => (
                  <span
                    key={srv}
                    className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2D6C8] text-[11px] font-bold text-[#2D2A26]"
                  >
                    {srv}
                  </span>
                ))}
              </div>

              {pro && pro.portafolio.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {pro.portafolio.slice(0, 2).map((obra) => (
                    <div
                      key={obra.id}
                      className="rounded-xl bg-white border border-[#E2D6C8] overflow-hidden"
                    >
                      <img
                        src={obra.fotoUrl}
                        alt={obra.alt}
                        loading="lazy"
                        className="w-full h-24 object-cover"
                      />
                      <p className="p-2 text-[11px] font-bold text-[#2D2A26] truncate">
                        {obra.titulo} ({obra.tiempo_entrega_dias} días)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Formulario solicitar encargo (Fase 18) */}
      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <h3 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#B34720]" />
          Pedir una prenda a una modista (sin medidas expuestas por defecto)
        </h3>
        <form onSubmit={enviarEncargo} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={modistaSeleccionadaId || modistas[0]?.perfil.id || ""}
            onChange={(e) => setModistaSeleccionadaId(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
          >
            {modistas.map(({ perfil }) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.nombre_publico} (@{perfil.usuario_unico})
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            value={tituloPrenda}
            onChange={(e) => setTituloPrenda(e.target.value)}
            placeholder="Prenda deseada (ej. Vestido cruzado midi)"
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
          />
          <input
            type="text"
            required
            value={telaColor}
            onChange={(e) => setTelaColor(e.target.value)}
            placeholder="Tela y color preferidos"
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
          />
          <input
            type="text"
            value={notasClienta}
            onChange={(e) => setNotasClienta(e.target.value)}
            placeholder="Fecha deseada o detalles de confección"
            className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
          />
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs font-extrabold cursor-pointer"
            >
              Enviar solicitud segura
            </button>
          </div>
        </form>
      </section>

      {/* Bandeja de encargos + consentimiento temporal revocable 30 días + auditoría */}
      <section className="space-y-3">
        <h3 className="text-base font-extrabold text-[#2D2A26]">
          Tus encargos y control temporal de medidas ({misEncargos.length})
        </h3>

        {misEncargos.map((enc) => {
          const esClienta = actor?.id === enc.clienta_id;
          const esModista = actor?.id === enc.modista_id;
          const modistaPerfil = estadoComunidad.perfiles.find((p) => p.id === enc.modista_id);

          return (
            <article
              key={enc.id}
              className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E2D6C8] text-[11px] font-extrabold text-[#2D2A26]">
                    Estado: {enc.estado.toUpperCase()}
                  </span>
                  <h4 className="text-base font-extrabold text-[#2D2A26] mt-1">
                    {enc.titulo_prenda} · Modista:{" "}
                    {modistaPerfil?.nombre_publico ?? "Taller"}
                  </h4>
                  <p className="text-xs text-[#5C554E]">
                    Tela/color: {enc.tela_color_deseado} ·{" "}
                    {enc.medidas_compartidas ? (
                      <span className="text-[#28593D] font-bold">
                        Medidas autorizadas temporalmente (30 días)
                      </span>
                    ) : (
                      <span>Medidas ocultas por defecto (privadas)</span>
                    )}
                  </p>
                </div>

                {esClienta && (
                  <button
                    type="button"
                    onClick={() => {
                      const primerPerfilLocal = loadMeasurementProfiles()[0];
                      const res = alternarConsentimientoMedidasEncargo(
                        ampliacion,
                        actor,
                        enc.id,
                        !enc.medidas_compartidas,
                        primerPerfilLocal?.measurements as unknown as Record<string, number>
                      );
                      if (!res.ok) {
                        setAviso(res.error ?? "No se pudo actualizar permiso.");
                        return;
                      }
                      alActualizarAmpliacion(
                        res.estado,
                        enc.medidas_compartidas
                          ? "Permiso de medidas revocado de inmediato."
                          : "Autorizaste acceso temporal (30 días) a tus medidas para este encargo."
                      );
                    }}
                    className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                      enc.medidas_compartidas
                        ? "bg-[#FFF1ED] border-[#E6B8AA] text-[#8A3112]"
                        : "bg-[#EFF7F1] border-[#B8D7C3] text-[#28593D]"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {enc.medidas_compartidas
                      ? "Revocar acceso a medidas ahora"
                      : "Compartir medidas por 30 días"}
                  </button>
                )}

                {esModista && (
                  <button
                    type="button"
                    onClick={() => {
                      const lec = registrarLecturaMedidasModista(ampliacion, actor, enc.id);
                      alActualizarAmpliacion(lec.estado);
                      if (!lec.permitido) {
                        setAviso(lec.motivo ?? "Acceso denegado.");
                        return;
                      }
                      if (lec.medidas) {
                        setMedidasLeidas((prev) => ({ ...prev, [enc.id]: lec.medidas! }));
                        setAviso("Consulta registrada en el historial de auditoría.");
                      }
                    }}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Consultar ficha de medidas
                  </button>
                )}
              </div>

              {medidasLeidas[enc.id] && (
                <div className="rounded-xl bg-[#EFF7F1] border border-[#B8D7C3] p-3 text-xs font-bold text-[#28593D]">
                  Medidas autorizadas:{" "}
                  {Object.entries(medidasLeidas[enc.id])
                    .slice(0, 6)
                    .map(([k, v]) => `${k}: ${v} cm`)
                    .join(" · ")}
                </div>
              )}

              {esModista && (
                <div className="flex flex-wrap gap-2">
                  {(["aceptada", "en_proceso", "entregada", "rechazada"] as EstadoEncargo[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          const r = actualizarEstadoEncargo(ampliacion, actor, enc.id, st);
                          if (r.ok) alActualizarAmpliacion(r.estado, `Estado actualizado a ${st}.`);
                        }}
                        className="min-h-[36px] px-3 rounded-lg bg-[#FAF6F0] border border-[#E2D6C8] text-[11px] font-extrabold cursor-pointer"
                      >
                        Marcar: {st}
                      </button>
                    )
                  )}
                </div>
              )}

              {enc.mensajes.length > 0 && (
                <ul className="space-y-1.5 text-xs text-[#5C554E] border-t border-[#EFE6DA] pt-2">
                  {enc.mensajes.map((m) => (
                    <li key={m.id} className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-[#3B7A57] shrink-0" />
                      <span>{m.contenido}</span>
                    </li>
                  ))}
                </ul>
              )}

              {esClienta && !enc.resena && enc.estado !== "enviada" && enc.estado !== "rechazada" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EFE6DA]">
                  <input
                    type="text"
                    value={notaResena[enc.id] ?? ""}
                    onChange={(e) =>
                      setNotaResena((prev) => ({ ...prev, [enc.id]: e.target.value }))
                    }
                    placeholder="Deja tu única reseña verificada sobre este encargo..."
                    className="flex-1 min-w-[200px] min-h-[40px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const res = publicarResenaEncargo(
                        ampliacion,
                        actor,
                        enc.id,
                        5,
                        notaResena[enc.id] ?? "Excelente acabado y comunicación."
                      );
                      if (!res.ok) {
                        setAviso(res.error ?? "No se pudo guardar la reseña.");
                        return;
                      }
                      alActualizarAmpliacion(res.estado, "Reseña verificada publicada.");
                    }}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5" />
                    Publicar reseña (5★)
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {ampliacion.auditoriaMedidas.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#E2D6C8] p-4 space-y-1.5">
            <p className="text-xs font-extrabold text-[#2D2A26]">
              Bitácora de auditoría de acceso a medidas
            </p>
            {ampliacion.auditoriaMedidas.slice(0, 5).map((aud) => (
              <p key={aud.id} className="text-[11px] text-[#5C554E]">
                {new Date(aud.creado_en).toLocaleString("es-CO")} · {aud.accion}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}