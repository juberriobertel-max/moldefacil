"use client";

import React, { useState } from "react";
import { BookmarkCheck, DownloadCloud, Globe2 } from "lucide-react";
import { ESTADO_INICIAL_AMPLIACION } from "@/lib/community/expansionSeed";

const PAISES = ["Colombia", "México", "Argentina", "España", "Perú"];

export default function BlogOfflineAndGlossaryBar({
  slug,
}: {
  slug: string;
}) {
  const [pais, setPais] = useState<string>("Colombia");
  const [guardadaOffline, setGuardadaOffline] = useState<boolean>(false);

  const guardarOffline = async () => {
    try {
      if ("caches" in window) {
        const cache = await window.caches.open("moldefacil-offline-v1");
        await cache.add(`/blog/${slug}`);
      }
      setGuardadaOffline(true);
    } catch {
      setGuardadaOffline(true);
    }
  };

  return (
    <section className="rounded-3xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#2D2A26]">
          <Globe2 className="w-4 h-4 text-[#3B7A57]" />
          <span>Glosario rápido y lectura sin internet</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="País de términos de costura"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className="min-h-[40px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs font-bold"
          >
            {PAISES.map((p) => (
              <option key={p} value={p}>
                Términos: {p}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void guardarOffline()}
            className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              guardadaOffline
                ? "bg-[#3B7A57] text-white border-[#3B7A57]"
                : "bg-white text-[#2D2A26] border-[#E2D6C8] hover:border-[#B34720]"
            }`}
          >
            {guardadaOffline ? (
              <>
                <BookmarkCheck className="w-4 h-4" />
                Guía disponible offline
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4 text-[#B34720]" />
                Guardar guía sin conexión
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {ESTADO_INICIAL_AMPLIACION.glosario.map((g) => (
          <details
            key={g.id}
            className="rounded-2xl bg-white border border-[#E2D6C8] p-3 text-xs"
          >
            <summary className="font-extrabold text-[#B34720] cursor-pointer">
              {g.variantes[pais] ?? g.termino_base} ({g.termino_base})
            </summary>
            <p className="mt-1.5 text-[#5C554E] leading-relaxed">
              {g.definicion_clara}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}