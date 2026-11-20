"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  crearPreguntaComunidad,
  type EstadoComunidad,
} from "@/lib/community/communityStore";
import {
  agregarEtapaBitacora,
  crearBitacoraProyecto,
} from "@/lib/community/expansionStore";
import type {
  EstadoAmpliacionComunidad,
  EtapaBitacoraNombre,
} from "@/lib/community/expansionTypes";
import { encolarOperacionOffline } from "@/lib/community/offlineQueue";
import type { ActorSesion } from "@/lib/community/rlsPolicyEngine";

const NOMBRES_ETAPA: Record<EtapaBitacoraNombre, string> = {
  molde: "1. Molde",
  corte: "2. Corte",
  prueba: "3. Prueba",
  costura: "4. Costura",
  terminada: "5. Terminada",
};

export default function ProjectLogSection({
  ampliacion,
  estadoComunidad,
  actor,
  alActualizarAmpliacion,
  alActualizarComunidad,
  onAbrirTabPreguntas,
}: {
  ampliacion: EstadoAmpliacionComunidad;
  estadoComunidad: EstadoComunidad;
  actor: ActorSesion | null;
  alActualizarAmpliacion: (next: EstadoAmpliacionComunidad, msg?: string) => void;
  alActualizarComunidad: (next: EstadoComunidad, msg?: string) => void;
  onAbrirTabPreguntas: () => void;
}) {
  const [titulo, setTitulo] = useState<string>("");
  const [prenda, setPrenda] = useState<string>("Vestido");
  const [tela, setTela] = useState<string>("Lino / Popelina");
  const [notaInicial, setNotaInicial] = useState<string>("");
  const [notaEtapa, setNotaEtapa] = useState<Record<string, string>>({});
  const [proximaEtapa, setProximaEtapa] = useState<Record<string, EtapaBitacoraNombre>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const crearNuevaBitacora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await encolarOperacionOffline("bitacora", titulo || "Bitácora offline", {
        titulo,
        prenda,
        tela,
        notaInicial,
      });
      setAviso("Sin internet: guardamos tu bitácora en IndexedDB y la subiremos al reconectarte.");
      setTitulo("");
      setNotaInicial("");
      return;
    }

    const res = crearBitacoraProyecto(ampliacion, actor, {
      titulo,
      prenda,
      tela,
      molde_categoria: "dress",
      notaInicial,
    });
    if (!res.ok) {
      setAviso(res.error ?? "No se pudo crear la bitácora.");
      return;
    }
    setTitulo("");
    setNotaInicial("");
    alActualizarAmpliacion(res.estado, "Bitácora iniciada. ¡Éxito en tu costura!");
  };

  const pedirAyudaDesdeEtapa = (bitacoraTitulo: string, etapa: string, nota: string) => {
    const res = crearPreguntaComunidad(estadoComunidad, {
      titulo: `Duda en "${bitacoraTitulo}" (${etapa})`,
      detalle: `Estoy en la etapa ${etapa} de mi bitácora (${bitacoraTitulo}). Esto es lo que llevo hasta ahora: ${nota}. ¿Cómo me recomiendan continuar?`,
      categoria: "costura_acabados",
      molde_referencia: bitacoraTitulo,
      etiquetas: ["ajuste_sisa"],
    });
    if (!res.ok) {
      setAviso(res.error ?? "Inicia sesión para publicar tu duda.");
      return;
    }
    alActualizarComunidad(res.estado, "Duda prellenada y publicada en Pregúntale a la modista.");
    onAbrirTabPreguntas();
  };

  return (
    <section className="space-y-5">
      {aviso && (
        <div className="rounded-2xl bg-[#EFF7F1] border border-[#B8D7C3] px-4 py-3 text-xs font-bold text-[#28593D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#B34720]" />
            Bitácora de Proyecto por Etapas
          </h2>
          <p className="text-xs text-[#5C554E]">
            Documenta tu prenda paso a paso (Molde → Corte → Prueba → Costura →
            Terminada), pide ayuda con un toque desde cualquier etapa o trabaja sin
            conexión en tu celular.
          </p>
        </div>

        <form
          onSubmit={crearNuevaBitacora}
          className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E2D6C8]"
        >
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Mi primer palazzo de lino"
            className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
          />
          <input
            type="text"
            value={prenda}
            onChange={(e) => setPrenda(e.target.value)}
            placeholder="Prenda"
            className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
          />
          <input
            type="text"
            value={tela}
            onChange={(e) => setTela(e.target.value)}
            placeholder="Tela"
            className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
          />
          <input
            type="text"
            value={notaInicial}
            onChange={(e) => setNotaInicial(e.target.value)}
            placeholder="Nota de la etapa Molde"
            className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva bitácora
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {ampliacion.bitacoras.map((bit) => (
          <article
            key={bit.id}
            className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-[11px] font-extrabold">
                  Etapa actual: {NOMBRES_ETAPA[bit.etapa_actual]}
                </span>
                <h3 className="text-lg font-extrabold text-[#2D2A26] mt-1">
                  {bit.titulo}
                </h3>
                <p className="text-xs text-[#5C554E]">
                  {bit.prenda} · {bit.tela}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  pedirAyudaDesdeEtapa(
                    bit.titulo,
                    NOMBRES_ETAPA[bit.etapa_actual],
                    bit.etapas[bit.etapas.length - 1]?.nota ?? ""
                  )
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EFF7F1] border border-[#B8D7C3] text-xs font-extrabold text-[#28593D] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
                Necesito ayuda con esto
              </button>
            </div>

            <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {bit.etapas.map((et) => (
                <li
                  key={et.id}
                  className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-3.5 space-y-1.5"
                >
                  <p className="text-xs font-extrabold text-[#B34720]">
                    {NOMBRES_ETAPA[et.nombre]}
                  </p>
                  <p className="text-xs text-[#2D2A26] leading-relaxed">{et.nota}</p>
                  <p className="text-[11px] text-[#5C554E]">
                    {new Date(et.creado_en).toLocaleDateString("es-CO")}
                  </p>
                </li>
              ))}
            </ol>

            {actor && actor.id === bit.autora_id && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EFE6DA]">
                <select
                  value={proximaEtapa[bit.id] ?? "costura"}
                  onChange={(e) =>
                    setProximaEtapa((prev) => ({
                      ...prev,
                      [bit.id]: e.target.value as EtapaBitacoraNombre,
                    }))
                  }
                  className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-bold"
                >
                  <option value="corte">2. Corte</option>
                  <option value="prueba">3. Prueba</option>
                  <option value="costura">4. Costura</option>
                  <option value="terminada">5. Terminada (graduar)</option>
                </select>
                <input
                  type="text"
                  value={notaEtapa[bit.id] ?? ""}
                  onChange={(e) =>
                    setNotaEtapa((prev) => ({ ...prev, [bit.id]: e.target.value }))
                  }
                  placeholder="Anota tu avance de hoy..."
                  className="flex-1 min-w-[200px] min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const st = proximaEtapa[bit.id] ?? "costura";
                    const res = agregarEtapaBitacora(ampliacion, actor, {
                      bitacoraId: bit.id,
                      nombre: st,
                      nota: notaEtapa[bit.id] ?? "Avance guardado en taller.",
                    });
                    if (!res.ok) {
                      setAviso(res.error ?? "No se pudo añadir la etapa.");
                      return;
                    }
                    setNotaEtapa((prev) => ({ ...prev, [bit.id]: "" }));
                    alActualizarAmpliacion(
                      res.estado,
                      st === "terminada"
                        ? "¡Felicidades por terminar tu prenda! Puedes publicarla en Lo que cosieron."
                        : "Etapa registrada en la bitácora."
                    );
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Agregar avance
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}