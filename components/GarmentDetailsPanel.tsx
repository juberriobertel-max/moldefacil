"use client";

import React from "react";
import { Check } from "lucide-react";
import {
  GarmentCategory,
  GarmentExtras,
  NecklineStyle,
  QuickLengthPreset,
  SleeveStyle,
} from "@/lib/types";

interface ExtraCardDef {
  key: keyof GarmentExtras;
  title: string;
  desc: string;
}

const EXTRA_CARDS: ExtraCardDef[] = [
  {
    key: "wrapFront",
    title: "Frente Cruzado (Envolvente)",
    desc: "+ Vista de escote cruzado",
  },
  {
    key: "flaredSleeve",
    title: "Manga Ancha / Acampanada",
    desc: "Caída amplia tipo campana",
  },
  {
    key: "waistTie",
    title: "Tiras / Lazo de Cintura",
    desc: "+ 2 tiras para amarrar",
  },
  {
    key: "hemRuffle",
    title: "Volante / Bolero en Ruedo",
    desc: "+ Pieza curva inferior",
  },
  {
    key: "sidePockets",
    title: "Bolsillos Laterales",
    desc: "+ 4 bolsas y piquetes",
  },
  {
    key: "flapPockets",
    title: "Bolsillos con Solapa",
    desc: "+ Tapetas y bolsas sastre",
  },
];

function ExtraIcon({ type }: { type: keyof GarmentExtras }) {
  switch (type) {
    case "wrapFront":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M11 6 L6 12 L9 14 L9 30 L27 30 L27 14 L30 12 L25 6" />
          <path d="M11 6 L23 21 L23 30" />
          <path d="M25 6 L15 18" strokeDasharray="2 2" />
        </svg>
      );
    case "flaredSleeve":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M18 6 C23 6, 25 12, 26 16 L32 29 C24 32, 12 32, 4 29 L10 16 C11 12, 13 6, 18 6 Z" />
        </svg>
      );
    case "waistTie":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <rect x="6" y="10" width="24" height="5" rx="2" />
          <path d="M18 15 L11 29 L15 30 L18 19 L21 30 L25 29 Z" />
        </svg>
      );
    case "hemRuffle":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M11 6 L25 6 L27 21 L9 21 Z" />
          <path d="M9 21 L5 30 C10 32, 14 28, 18 30 C22 32, 26 28, 31 30 L27 21" />
        </svg>
      );
    case "sidePockets":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M10 6 L26 6 L28 30 L8 30 Z" />
          <path d="M10 13 C15 14, 16 19, 14 23 C12 25, 10 24, 9 21" />
          <path d="M26 13 C21 14, 20 19, 22 23 C24 25, 26 24, 27 21" />
        </svg>
      );
    case "flapPockets":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M7 10 L29 10 L29 16 L26.5 18 L9.5 18 L7 16 Z" />
          <path d="M9 18 L9 29 L27 29 L27 18" />
        </svg>
      );
  }
}

export function NecklineIcon({ style }: { style: NecklineStyle }) {
  return (
    <svg viewBox="0 0 40 32" className="w-8 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
      <path d="M4 28 L4 9 L12 6" />
      <path d="M28 6 L36 9 L36 28" />
      {style === "round" && <path d="M12 6 C15 17, 25 17, 28 6" />}
      {style === "v_neck" && <path d="M12 6 L20 20 L28 6" />}
      {style === "square" && <path d="M12 6 L12 16 L28 16 L28 6" />}
      {style === "high" && <path d="M12 6 C16 9, 24 9, 28 6" />}
      {style === "tailored_lapel" && (
        <>
          <path d="M12 6 L16 11 L13 13 L20 22 L20 28" />
          <path d="M28 6 L24 11 L27 13 L20 22" />
          <path d="M12 6 C16 8, 24 8, 28 6" />
        </>
      )}
      {style === "shirt_collar" && (
        <>
          <path d="M12 6 L14 14 L20 10 L26 14 L28 6" />
          <path d="M12 6 C16 9, 24 9, 28 6" />
          <line x1="20" y1="10" x2="20" y2="28" strokeDasharray="2 2" />
        </>
      )}
    </svg>
  );
}

export function NecklineCollarSelector({
  necklineStyle,
  onNecklineStyleChange,
  heading = "Cuello, Escote o Solapa",
}: {
  necklineStyle: NecklineStyle;
  onNecklineStyleChange: (style: NecklineStyle) => void;
  heading?: string;
}) {
  const openNecklines: { id: NecklineStyle; label: string }[] = [
    { id: "round", label: "Redondo" },
    { id: "v_neck", label: "En V" },
    { id: "square", label: "Cuadrado" },
    { id: "high", label: "Alto / Cerrado" },
  ];

  const structuredCollars: { id: NecklineStyle; label: string }[] = [
    { id: "tailored_lapel", label: "Solapa Sastre (Blazer)" },
    { id: "shirt_collar", label: "Cuello Camisero" },
  ];

  const renderGroup = (
    title: string,
    items: { id: NecklineStyle; label: string }[]
  ) => (
    <div className="space-y-1.5">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {items.map((nk) => (
          <button
            key={nk.id}
            type="button"
            onClick={() => onNecklineStyleChange(nk.id)}
            className={`min-h-[54px] p-2.5 rounded-2xl border-2 flex items-center gap-2 text-left transition cursor-pointer ${
              necklineStyle === nk.id
                ? "bg-teal-50 border-teal-600 text-teal-900 shadow-2xs"
                : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <NecklineIcon style={nk.id} />
            <span className="text-xs sm:text-sm font-bold leading-tight">
              {nk.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <span className="block text-sm font-bold text-slate-700">{heading}</span>
      {renderGroup("Escotes abiertos", openNecklines)}
      {renderGroup("Cuellos y Solapas estructurados", structuredCollars)}
    </div>
  );
}

export function QuickLengthSelector({
  quickLength,
  onQuickLengthChange,
}: {
  quickLength: QuickLengthPreset;
  onQuickLengthChange: (preset: QuickLengthPreset) => void;
}) {
  const options: {
    id: Exclude<QuickLengthPreset, "photo">;
    label: string;
    hint: string;
  }[] = [
    { id: "mini", label: "Corto (Mini)", hint: "~42 cm" },
    { id: "knee", label: "A la rodilla", hint: "~58 cm" },
    { id: "midi", label: "Midi (Media pierna)", hint: "~76 cm" },
    { id: "maxi", label: "Largo (Tobillo)", hint: "~98 cm" },
  ];

  return (
    <div className="space-y-2 rounded-2xl bg-[#FAF8F5] border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-800">
          Largo real de la prenda
        </span>
        {quickLength !== "photo" ? (
          <button
            type="button"
            onClick={() => onQuickLengthChange("photo")}
            className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            Usar foto / medida
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">
            Si la foto corta los pies
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = quickLength === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() =>
                onQuickLengthChange(active ? "photo" : opt.id)
              }
              className={`min-h-[48px] px-2.5 py-2 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-center ${
                active
                  ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="text-xs sm:text-sm font-bold leading-tight">
                {opt.label}
              </span>
              <span
                className={`text-[11px] ${
                  active ? "text-rose-100" : "text-slate-400"
                }`}
              >
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GarmentExtrasSelector({
  category,
  sleeveStyle,
  onSleeveStyleChange,
  extras,
  onExtrasChange,
}: {
  category: GarmentCategory;
  sleeveStyle: SleeveStyle;
  onSleeveStyleChange: (style: SleeveStyle) => void;
  extras: GarmentExtras;
  onExtrasChange: (next: GarmentExtras) => void;
}) {
  const isAvailable = (key: keyof GarmentExtras): boolean => {
    if (key === "wrapFront" || key === "flaredSleeve") {
      return category === "dress" || category === "top" || category === "two_piece";
    }
    if (key === "hemRuffle") {
      return category !== "pants";
    }
    if (key === "flapPockets") {
      return category !== "skirt";
    }
    return true;
  };

  const toggleExtra = (key: keyof GarmentExtras) => {
    const nextVal = !extras[key];
    onExtrasChange({
      ...extras,
      [key]: nextVal,
    });
    if (key === "flaredSleeve" && nextVal && sleeveStyle === "sleeveless") {
      onSleeveStyleChange("short");
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-sm font-extrabold text-slate-900">
          Detalles y Extras de la Prenda
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          Puedes activar varios
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {EXTRA_CARDS.filter((card) => isAvailable(card.key)).map((card) => {
          const active = extras[card.key];
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleExtra(card.key)}
              className={`min-h-[56px] p-2.5 rounded-2xl border-2 flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                active
                  ? "bg-teal-50 border-teal-600 text-teal-950 shadow-2xs"
                  : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={
                    active ? "text-teal-700" : "text-slate-600"
                  }
                >
                  <ExtraIcon type={card.key} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight">
                    {card.title}
                  </div>
                  <div
                    className={`text-xs ${
                      active ? "text-teal-700" : "text-slate-500"
                    }`}
                  >
                    {card.desc}
                  </div>
                </div>
              </div>

              <span
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                  active
                    ? "bg-teal-600 border-teal-600 text-white"
                    : "bg-white border-slate-300 text-transparent"
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
