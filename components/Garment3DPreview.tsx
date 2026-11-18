"use client";

import React from "react";
import { Box, Layers } from "lucide-react";
import { Apariencia, ConfigPrenda, Medidas, PALETA_UI_3D } from "@/lib/3d/types";

export interface Garment3DPreviewProps {
  medidas: Medidas;
  config: ConfigPrenda;
  apariencia: Apariencia;
  onAparienciaChange: (siguiente: Apariencia) => void;
  autoGirarInicial?: boolean;
  modoCompacto?: boolean;
}

/**
 * Contenedor cliente del simulador 3D (contratos listos en Fase 1;
 * motor Three.js completo y barra flotante en Fase 6).
 */
export default function Garment3DPreview({
  medidas,
  config,
  apariencia,
}: Garment3DPreviewProps) {
  return (
    <div
      className="relative w-full min-h-[480px] rounded-3xl border border-[#E5DCD0] flex flex-col items-center justify-center p-6 text-center select-none"
      style={{ backgroundColor: PALETA_UI_3D.crema }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-white shadow-sm"
        style={{ backgroundColor: PALETA_UI_3D.terracota }}
      >
        <Box className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-extrabold text-[#2D2A26]">
        Estudio 3D de Prendas, Telas y Costuras
      </h3>
      <p className="text-sm text-[#5C554E] max-w-md mt-1">
        Prenda: <strong>{config.prenda}</strong> • Escote:{" "}
        <strong>{config.escote}</strong> • Manga: <strong>{config.manga}</strong>{" "}
        • Tela: <strong>{apariencia.tela}</strong>
      </p>
      <div
        className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
        style={{ backgroundColor: PALETA_UI_3D.salvia }}
      >
        <Layers className="w-4 h-4" />
        <span>
          Busto {medidas.busto} • Cintura {medidas.cintura} • Cadera{" "}
          {medidas.cadera} cm
        </span>
      </div>
    </div>
  );
}
