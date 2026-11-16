"use client";

import React from "react";
import { Sparkles, Check } from "lucide-react";
import {
  FASHION_STYLES_CATALOG,
  FashionStylePreset,
} from "@/lib/fashionStylesCatalog";

function FashionStyleSvg({ id }: { id: string }) {
  switch (id) {
    case "wrap_dress":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M14 6 L3 14 L5 22 C9 21, 12 20, 14 23 L7 42 L37 42 L30 23 C32 20, 35 21, 39 22 L41 14 L30 6" />
          <path d="M14 6 L28 22 L15 22 Z" opacity="0.25" fill="currentColor" stroke="none" />
          <path d="M14 6 L28 22 M30 6 L16 20 M13 23 L31 23" />
        </svg>
      );
    case "empire_dress":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M14 7 L14 13 L30 13 L30 7 L36 9 C38 14, 37 18, 32 18 L30 16 L31 20 L38 42 L6 42 L13 20 L14 16 L12 18 C7 18, 6 14, 8 9 Z" />
          <line x1="13" y1="19" x2="31" y2="19" strokeDasharray="2 1.5" />
        </svg>
      );
    case "shirt_dress":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M16 7 L22 11 L28 7 L35 10 L37 18 L31 19 L29 14 L29 22 L34 42 L10 42 L15 22 L15 14 L13 19 L7 18 L9 10 Z" />
          <line x1="22" y1="11" x2="22" y2="42" />
          <line x1="15" y1="22" x2="29" y2="22" />
        </svg>
      );
    case "boho_ruffle_dress":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M15 6 L22 14 L29 6 L37 10 L39 19 L31 20 L29 15 L33 34 L11 34 L15 15 L13 20 L5 19 L7 10 Z" />
          <path d="M11 34 L7 43 C13 45, 17 41, 22 43 C27 45, 31 41, 37 43 L33 34" />
        </svg>
      );
    case "summer_two_piece":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M14 6 L14 12 L30 12 L30 6 L34 8 L31 17 L13 17 L10 8 Z" />
          <path d="M13 22 L31 22 L38 43 Q22 46 6 43 Z" />
          <line x1="13" y1="25" x2="31" y2="25" />
        </svg>
      );
    case "tailored_two_piece":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M15 5 L22 13 L29 5 L35 8 L33 17 L29 15 L29 22 L15 22 L15 15 L11 17 L9 8 Z" />
          <path d="M14 24 L30 24 L36 44 L24 44 L22 31 L20 44 L8 44 Z" />
        </svg>
      );
    case "peasant_blouse":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M11 11 C17 13, 27 13, 33 11 L39 17 C40 22, 36 25, 32 23 L31 38 L13 38 L12 23 C8 25, 4 22, 5 17 Z" />
          <path d="M12 15 C18 17, 26 17, 32 15" strokeDasharray="2 1.5" />
        </svg>
      );
    case "office_blouse":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M15 8 C19 14, 25 14, 29 8 L36 11 L34 21 L29 19 L29 38 L15 38 L15 19 L10 21 L8 11 Z" />
          <path d="M15 24 L19 26 M29 24 L25 26" strokeWidth="1.6" />
        </svg>
      );
    case "circle_skirt":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M14 10 L30 10 L40 37 Q22 44 4 37 Z" />
          <line x1="14" y1="14" x2="30" y2="14" />
          <path d="M19 14 L14 39 M25 14 L30 39" strokeWidth="1.4" opacity="0.65" />
        </svg>
      );
    case "pencil_skirt":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M13 10 L31 10 L32 40 L12 40 Z" />
          <line x1="13" y1="14" x2="31" y2="14" />
        </svg>
      );
    case "palazzo_pants":
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M13 7 L31 7 L38 42 L24 42 L22 22 L20 42 L6 42 Z" />
          <line x1="13" y1="11" x2="31" y2="11" />
        </svg>
      );
    case "high_waist_shorts":
    default:
      return (
        <svg viewBox="0 0 44 48" className="w-10 h-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M12 10 L32 10 L35 29 L24 29 L22 21 L20 29 L9 29 Z" />
          <line x1="12" y1="14" x2="32" y2="14" />
        </svg>
      );
  }
}

interface FashionStylesGalleryProps {
  activeStyleId: string | null;
  onSelectStyle: (preset: FashionStylePreset) => void;
}

export default function FashionStylesGallery({
  activeStyleId,
  onSelectStyle,
}: FashionStylesGalleryProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          Toca cualquier estilo de moda para cargar al instante su prenda base,
          escote, mangas y piezas extras en el molde.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
        {FASHION_STYLES_CATALOG.map((preset) => {
          const isSelected = activeStyleId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectStyle(preset)}
              className={`w-full p-3 rounded-2xl border-2 text-left transition cursor-pointer flex items-center gap-3 ${
                isSelected
                  ? "bg-rose-50 border-rose-600 text-rose-950 shadow-xs"
                  : "bg-[#FAF8F5] border-slate-200 text-slate-800 hover:border-teal-400 hover:bg-white"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl border ${
                  isSelected
                    ? "bg-white border-rose-200 text-rose-600"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <FashionStyleSvg id={preset.id} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm sm:text-base font-extrabold leading-snug">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div
                  className={`text-xs font-semibold mt-0.5 ${
                    isSelected ? "text-rose-700" : "text-teal-700"
                  }`}
                >
                  {preset.shortTag}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  {preset.fabricTip}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
