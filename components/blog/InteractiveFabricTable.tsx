"use client";

import React, { useState } from "react";
import { Ruler } from "lucide-react";

type SizeKey = "XS" | "S" | "M" | "L" | "XL";
type FabricWidth = "140" | "150";

interface FabricRow {
  garment: string;
  note: string;
  bySize: Record<SizeKey, { w140: number; w150: number }>;
}

const SIZES: SizeKey[] = ["XS", "S", "M", "L", "XL"];

const SIZE_INFO: Record<SizeKey, string> = {
  XS: "Busto 82 • Cintura 64 • Cadera 88 cm",
  S: "Busto 88 • Cintura 68 • Cadera 94 cm",
  M: "Busto 94 • Cintura 74 • Cadera 100 cm",
  L: "Busto 102 • Cintura 82 • Cadera 108 cm",
  XL: "Busto 112 • Cintura 92 • Cadera 118 cm",
};

const FABRIC_ROWS: FabricRow[] = [
  {
    garment: "Blusa / Camiseta manga corta",
    note: "Incluye vistas o cuello básico",
    bySize: {
      XS: { w140: 1.0, w150: 0.9 },
      S: { w140: 1.1, w150: 1.0 },
      M: { w140: 1.25, w150: 1.1 },
      L: { w140: 1.45, w150: 1.25 },
      XL: { w140: 1.65, w150: 1.4 },
    },
  },
  {
    garment: "Blusa manga larga / Kimono",
    note: "Mangas con caída amplia",
    bySize: {
      XS: { w140: 1.45, w150: 1.3 },
      S: { w140: 1.55, w150: 1.4 },
      M: { w140: 1.75, w150: 1.55 },
      L: { w140: 1.95, w150: 1.75 },
      XL: { w140: 2.2, w150: 1.95 },
    },
  },
  {
    garment: "Falda recta / Lápiz (a la rodilla)",
    note: "Con pretina y abertura trasera",
    bySize: {
      XS: { w140: 0.85, w150: 0.8 },
      S: { w140: 0.9, w150: 0.85 },
      M: { w140: 1.0, w150: 0.95 },
      L: { w140: 1.35, w150: 1.15 },
      XL: { w140: 1.5, w150: 1.35 },
    },
  },
  {
    garment: "Falda circular medio plato (midi)",
    note: "Largo aprox. 65 cm",
    bySize: {
      XS: { w140: 1.9, w150: 1.7 },
      S: { w140: 2.0, w150: 1.8 },
      M: { w140: 2.15, w150: 1.95 },
      L: { w140: 2.35, w150: 2.1 },
      XL: { w140: 2.6, w150: 2.3 },
    },
  },
  {
    garment: "Pantalón recto o Palazzo",
    note: "Incluye bolsillos y pretina",
    bySize: {
      XS: { w140: 1.65, w150: 1.45 },
      S: { w140: 1.8, w150: 1.55 },
      M: { w140: 2.05, w150: 1.75 },
      L: { w140: 2.35, w150: 2.05 },
      XL: { w140: 2.6, w150: 2.3 },
    },
  },
  {
    garment: "Vestido cruzado / Camisero (midi)",
    note: "Con cinturón y mangas cortas",
    bySize: {
      XS: { w140: 2.1, w150: 1.85 },
      S: { w140: 2.25, w150: 2.0 },
      M: { w140: 2.45, w150: 2.2 },
      L: { w140: 2.75, w150: 2.45 },
      XL: { w140: 3.05, w150: 2.7 },
    },
  },
  {
    garment: "Conjunto 2 piezas (Blusa + Palazzo)",
    note: "Cintura entallada + pantalón fluido",
    bySize: {
      XS: { w140: 2.55, w150: 2.25 },
      S: { w140: 2.75, w150: 2.45 },
      M: { w140: 3.0, w150: 2.7 },
      L: { w140: 3.35, w150: 2.95 },
      XL: { w140: 3.7, w150: 3.3 },
    },
  },
];

interface InteractiveFabricTableProps {
  title: string;
  note: string;
}

export default function InteractiveFabricTable({
  title,
  note,
}: InteractiveFabricTableProps) {
  const [selectedSize, setSelectedSize] = useState<SizeKey>("M");
  const [selectedWidth, setSelectedWidth] = useState<FabricWidth>("150");

  return (
    <div className="rounded-3xl bg-white border-2 border-teal-200 p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Referencia talla {selectedSize}: {SIZE_INFO[selectedSize]}
            </p>
          </div>
        </div>
      </div>

      {/* Size + Fabric Width Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-slate-200 space-y-2">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-600">
            1. Elige la talla
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setSelectedSize(sz)}
                className={`min-h-[44px] rounded-xl text-sm font-extrabold border transition cursor-pointer ${
                  selectedSize === sz
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-slate-200 space-y-2">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-600">
            2. Ancho del rollo de tela
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["140", "150"] as FabricWidth[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setSelectedWidth(w)}
                className={`min-h-[44px] px-3 rounded-xl text-sm font-extrabold border transition cursor-pointer ${
                  selectedWidth === w
                    ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                Ancho {w} cm
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left border-collapse text-sm sm:text-base">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <th className="py-3 px-4 font-extrabold">Prenda</th>
              <th className="py-3 px-4 font-extrabold text-right whitespace-nowrap">
                {selectedWidth === "140" ? "En 140 cm" : "En 150 cm"}
              </th>
              <th className="py-3 px-4 font-bold text-right text-slate-500 whitespace-nowrap hidden sm:table-cell">
                Comparación {selectedWidth === "140" ? "150 cm" : "140 cm"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FABRIC_ROWS.map((row) => {
              const vals = row.bySize[selectedSize];
              const primary = selectedWidth === "140" ? vals.w140 : vals.w150;
              const secondary = selectedWidth === "140" ? vals.w150 : vals.w140;
              return (
                <tr key={row.garment} className="hover:bg-[#FAF8F5] transition">
                  <td className="py-3 px-4">
                    <span className="block font-bold text-slate-900">
                      {row.garment}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {row.note}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <span className="inline-block px-3 py-1 rounded-xl bg-teal-50 text-teal-800 font-extrabold border border-teal-200">
                      {primary.toFixed(2)} m
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 font-semibold whitespace-nowrap hidden sm:table-cell">
                    {secondary.toFixed(2)} m
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">{note}</p>
    </div>
  );
}
