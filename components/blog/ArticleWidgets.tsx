"use client";

import React, { useState } from "react";
import {
  CheckSquare,
  Feather,
  Layers,
  Ruler,
  Scissors,
  Sparkles,
  Square,
} from "lucide-react";

export type WidgetKind =
  | "calculador_tela"
  | "selector_agujas"
  | "checklist_impresion";

type GarmentOption =
  | "Blusa / Top"
  | "Vestido Corto"
  | "Vestido Largo"
  | "Falda Plato"
  | "Pantalón Recto"
  | "Chaqueta / Blazer";

type SizeOption = "XS" | "S" | "M" | "L" | "XL";
type HeightOption = "Menos de 1.60 m" | "1.60 m – 1.70 m" | "Más de 1.70 m";

const GARMENTS: GarmentOption[] = [
  "Blusa / Top",
  "Vestido Corto",
  "Vestido Largo",
  "Falda Plato",
  "Pantalón Recto",
  "Chaqueta / Blazer",
];

const SIZES: SizeOption[] = ["XS", "S", "M", "L", "XL"];
const HEIGHTS: HeightOption[] = [
  "Menos de 1.60 m",
  "1.60 m – 1.70 m",
  "Más de 1.70 m",
];

const BASE_METERS_150: Record<GarmentOption, Record<SizeOption, number>> = {
  "Blusa / Top": { XS: 1.0, S: 1.1, M: 1.2, L: 1.4, XL: 1.6 },
  "Vestido Corto": { XS: 1.5, S: 1.65, M: 1.8, L: 2.05, XL: 2.3 },
  "Vestido Largo": { XS: 2.2, S: 2.35, M: 2.55, L: 2.85, XL: 3.15 },
  "Falda Plato": { XS: 1.7, S: 1.85, M: 2.0, L: 2.25, XL: 2.5 },
  "Pantalón Recto": { XS: 1.4, S: 1.55, M: 1.75, L: 2.05, XL: 2.25 },
  "Chaqueta / Blazer": { XS: 1.6, S: 1.75, M: 1.9, L: 2.15, XL: 2.4 },
};

const GARMENT_TIPS: Record<GarmentOption, string> = {
  "Blusa / Top":
    "Si tu diseño lleva mangas globo o cuello camisero con pie de cuello, suma +25 cm extra.",
  "Vestido Corto":
    "Si la tela tiene estampado con dirección o cuadros, suma +30 cm extra para casar costuras.",
  "Vestido Largo":
    "En rayón, chalis o lino 100%, compra +20 cm adicionales para prelavar antes de cortar.",
  "Falda Plato":
    "Deja colgada la falda 24 h antes de coser el dobladillo para que el corte al sesgo asiente parejo.",
  "Pantalón Recto":
    "A partir de la talla L en telas de 140 cm conviene escalonar delantero y posterior a lo largo.",
  "Chaqueta / Blazer":
    "Recuerda comprar también 0.80 m de entretela fusionable liviana para solapas, vistas y puños.",
};

function QuickFabricCalculatorWidget() {
  const [garment, setGarment] = useState<GarmentOption>("Vestido Corto");
  const [size, setSize] = useState<SizeOption>("M");
  const [height, setHeight] = useState<HeightOption>("1.60 m – 1.70 m");

  const heightDelta =
    height === "Menos de 1.60 m"
      ? -0.15
      : height === "Más de 1.70 m"
        ? 0.2
        : 0;

  const base150 = Math.max(0.8, BASE_METERS_150[garment][size] + heightDelta);
  const meters150 = Math.ceil(base150 * 20) / 20;
  const meters140 = Math.ceil(base150 * 1.12 * 20) / 20;
  const meters115 = Math.ceil(base150 * 1.35 * 20) / 20;

  return (
    <section
      aria-label="Calculador rápido ¿Cuánta tela compro?"
      className="rounded-3xl bg-white border-2 border-[#C85A32]/35 p-5 sm:p-6 shadow-xs space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#FAF6F0] border border-[#E5DCD0] text-[#C85A32] flex items-center justify-center shrink-0">
          <Ruler className="h-6 w-6" />
        </div>
        <div>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#C85A32]">
            Mini-Herramienta Interactiva
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#2D2A26]">
            Calculador Rápido: ¿Cuánta tela compro hoy?
          </h3>
        </div>
      </div>

      {/* 1. Prenda */}
      <div className="space-y-2">
        <span className="block text-xs font-extrabold uppercase tracking-wide text-[#5C554E]">
          1. Toca la prenda que vas a coser
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GARMENTS.map((item) => {
            const active = garment === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setGarment(item)}
                className={`min-h-[46px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition cursor-pointer ${
                  active
                    ? "bg-[#2D2A26] text-white border-[#2D2A26] shadow-xs"
                    : "bg-[#FAF6F0] text-[#2D2A26] border-[#E5DCD0] hover:border-[#C85A32]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Talla + 3. Estatura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-[#5C554E]">
            2. Elige la talla
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {SIZES.map((sz) => {
              const active = size === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSize(sz)}
                  className={`min-h-[46px] rounded-xl text-sm font-extrabold border transition cursor-pointer ${
                    active
                      ? "bg-[#C85A32] text-white border-[#C85A32]"
                      : "bg-[#FAF6F0] text-[#2D2A26] border-[#E5DCD0]"
                  }`}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-[#5C554E]">
            3. Estatura aproximada
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {HEIGHTS.map((h) => {
              const active = height === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHeight(h)}
                  className={`min-h-[46px] px-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    active
                      ? "bg-[#3B7A57] text-white border-[#3B7A57]"
                      : "bg-[#FAF6F0] text-[#2D2A26] border-[#E5DCD0]"
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="rounded-2xl bg-[#F2F7F4] border-2 border-[#3B7A57]/40 p-4 text-center space-y-1">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-[#1E3F2D]">
            En tela de 150 cm (Doble ancho)
          </span>
          <p className="text-3xl font-black text-[#3B7A57]">
            {meters150.toFixed(2)} m
          </p>
          <span className="block text-xs text-[#264735]">
            Compra recomendada en almacén
          </span>
        </div>

        <div className="rounded-2xl bg-[#FDF3EE] border-2 border-[#C85A32]/40 p-4 text-center space-y-1">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-[#6E2B14]">
            En tela de 140 cm o 115 cm
          </span>
          <p className="text-2xl sm:text-3xl font-black text-[#C85A32]">
            {meters140.toFixed(2)} m{" "}
            <span className="text-sm font-bold text-[#6E2B14]">
              (140 cm)
            </span>
          </p>
          <span className="block text-xs font-bold text-[#5C2612]">
            Si el rollo es angosto (115 cm): {meters115.toFixed(2)} m
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E5DCD0] p-3.5 text-sm text-[#2D2A26] flex items-start gap-2.5">
        <Sparkles className="h-5 w-5 text-[#C85A32] shrink-0 mt-0.5" />
        <span>
          <strong>Consejo para {garment}:</strong> {GARMENT_TIPS[garment]}
        </span>
      </div>
    </section>
  );
}

type FabricCategoryKey = "rigidas" | "finas" | "elasticas";

const NEEDLE_GUIDES: Record<
  FabricCategoryKey,
  {
    tabTitle: string;
    examples: string;
    needle: string;
    stitch: string;
    tensionTip: string;
  }
> = {
  rigidas: {
    tabTitle: "Telas Rígidas (Popelina, Lino, Drill)",
    examples: "Popelina de algodón, lino, chambray, gabardina, drill, denim liviano",
    needle: "Aguja Universal 80/12 (o 90/14 para drill y gabardina gruesa)",
    stitch: "Puntada recta estándar — Largo 2.5 mm a 2.8 mm",
    tensionTip:
      "Plancha con vapor antes de cortar y usa prensa-telas estándar con tensión media (4). En costuras gruesas de mezclilla o lino pesado, sube el largo de puntada a 3.0 mm.",
  },
  finas: {
    tabTitle: "Telas Finas / Con Caída (Gasa, Viscosa, Satén)",
    examples: "Rayón, chalis, viscosa, crepé, gasa, chifón, satén y seda fría",
    needle: "Aguja Microtex o Universal fina 70/10 (nueva y sin despuntar)",
    stitch: "Puntada recta corta — Largo 1.8 mm a 2.0 mm",
    tensionTip:
      "Para que no frunza ni se trague la tela al iniciar la costura, coloca un trocito de papel seda debajo de los primeros 3 cm de costura y arráncalo suavemente al terminar.",
  },
  elasticas: {
    tabTitle: "Telas Elásticas (Licra, Jersey, Punto)",
    examples: "Jersey de algodón, franela licrada, rib, suplex, licra, punto roma",
    needle: "Aguja Punta de Bola (Ballpoint / Jersey) o Stretch 75/11 u 80/12",
    stitch: "Zig-zag estrecho (ancho 1.5 mm, largo 2.5 mm) o puntada elástica",
    tensionTip:
      "Nunca estires la tela mientras pasa bajo el prensatelas (deja que los dientes la lleven sola). La punta redonda separa las fibras sin romperlas y evita que salten puntadas.",
  },
};

function NeedleSelectorWidget() {
  const [selected, setSelected] = useState<FabricCategoryKey>("finas");
  const info = NEEDLE_GUIDES[selected];

  return (
    <section
      aria-label="Selector interactivo de aguja y puntada según la tela"
      className="rounded-3xl bg-white border-2 border-[#3B7A57]/35 p-5 sm:p-6 shadow-xs space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#F2F7F4] border border-[#C4DDD0] text-[#3B7A57] flex items-center justify-center shrink-0">
          <Feather className="h-6 w-6" />
        </div>
        <div>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#3B7A57]">
            Selector Técnico de Taller
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#2D2A26]">
            ¿Qué aguja y puntada pongo en mi máquina?
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {(
          [
            { key: "rigidas", icon: Layers },
            { key: "finas", icon: Feather },
            { key: "elasticas", icon: Scissors },
          ] as const
        ).map(({ key, icon: Icon }) => {
          const item = NEEDLE_GUIDES[key];
          const active = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`min-h-[64px] p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 transition cursor-pointer ${
                active
                  ? "bg-[#3B7A57] border-[#3B7A57] text-white shadow-xs"
                  : "bg-[#FAF6F0] border-[#E5DCD0] text-[#2D2A26] hover:border-[#3B7A57]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold leading-snug">
                {item.tabTitle}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E5DCD0] p-4 sm:p-5 space-y-3">
        <div className="text-xs font-bold text-[#5C554E]">
          Ejemplos: <span className="text-[#2D2A26]">{info.examples}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-[#E5DCD0] p-3.5">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#C85A32] mb-1">
              Aguja exacta
            </span>
            <strong className="text-sm sm:text-base font-extrabold text-[#2D2A26]">
              {info.needle}
            </strong>
          </div>

          <div className="rounded-2xl bg-white border border-[#E5DCD0] p-3.5">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-[#3B7A57] mb-1">
              Puntada recomendada
            </span>
            <strong className="text-sm sm:text-base font-extrabold text-[#2D2A26]">
              {info.stitch}
            </strong>
          </div>
        </div>

        <div className="rounded-2xl bg-[#F2F7F4] border border-[#C4DDD0] p-3.5 text-sm text-[#1E3F2D] leading-relaxed">
          <strong>Secreto para que no salte puntadas ni frunza:</strong>{" "}
          {info.tensionTip}
        </div>
      </div>
    </section>
  );
}

const PRINT_STEPS = [
  "Imprimir solo la Hoja 1 primero",
  "Medir el cuadro de control de 5x5 cm",
  "Configurar escala al 100% / Tamaño real",
  "Recortar solo los márgenes izquierdo y superior",
  "Unir siguiendo las coordenadas F1-C1 / F1-C2",
  "Cortar por la línea exterior con margen de costura incluido",
];

function PrintChecklistWidget() {
  const [checked, setChecked] = useState<boolean[]>([
    true,
    false,
    false,
    false,
    false,
    false,
  ]);

  const completedCount = checked.filter(Boolean).length;
  const pct = Math.round((completedCount / PRINT_STEPS.length) * 100);

  const toggleStep = (idx: number) => {
    setChecked((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  return (
    <section
      aria-label="Checklist interactivo de impresión y armado de moldes PDF"
      className="rounded-3xl bg-white border-2 border-[#C85A32]/35 p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#C85A32]">
            Lista de Verificación en Mesa
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#2D2A26]">
            Checklist Táctil de Impresión y Armado
          </h3>
        </div>
        <span className="px-3.5 py-1.5 rounded-full bg-[#FAF6F0] border border-[#E5DCD0] text-xs sm:text-sm font-extrabold text-[#2D2A26]">
          Progreso de armado: {completedCount} de {PRINT_STEPS.length} pasos
        </span>
      </div>

      <div className="w-full h-3 rounded-full bg-[#FAF6F0] overflow-hidden border border-[#E5DCD0]">
        <div
          style={{ width: `${pct}%` }}
          className="h-full bg-[#3B7A57] transition-all duration-200"
        />
      </div>

      <div className="space-y-2.5">
        {PRINT_STEPS.map((step, idx) => {
          const isDone = checked[idx];
          return (
            <button
              key={step}
              type="button"
              onClick={() => toggleStep(idx)}
              className={`w-full min-h-[54px] px-4 py-3 rounded-2xl border-2 text-left flex items-center gap-3.5 transition cursor-pointer ${
                isDone
                  ? "bg-[#F2F7F4] border-[#3B7A57]/40 text-[#3B7A57]"
                  : "bg-[#FAF6F0] border-[#E5DCD0] text-[#2D2A26] hover:border-[#C85A32]"
              }`}
            >
              {isDone ? (
                <CheckSquare className="h-6 w-6 text-[#3B7A57] shrink-0" />
              ) : (
                <Square className="h-6 w-6 text-[#C85A32] shrink-0" />
              )}
              <span
                className={`text-sm sm:text-base font-bold transition ${
                  isDone ? "line-through opacity-75" : ""
                }`}
              >
                Paso {idx + 1}: {step}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function ArticleWidget({ widget }: { widget: WidgetKind }) {
  if (widget === "calculador_tela") {
    return <QuickFabricCalculatorWidget />;
  }
  if (widget === "selector_agujas") {
    return <NeedleSelectorWidget />;
  }
  return <PrintChecklistWidget />;
}
