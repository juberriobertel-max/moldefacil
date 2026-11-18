"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Layers, RefreshCw, Ruler, Scissors } from "lucide-react";
import {
  DEFAULT_GARMENT_EXTRAS,
  Measurements,
  PatternPiece,
  PatternResult,
} from "@/lib/types";
import { generateUniversalPattern, commandsToSvgPath } from "@/lib/patternEngine";
import { FASHION_STYLES_CATALOG } from "@/lib/fashionStylesCatalog";
import {
  getLastPatternServerSnapshot,
  loadLastGeneratedPattern,
  subscribeWorkshopStorage,
} from "@/lib/savedMeasurements";

type GarmentPresetKey =
  | "custom_last"
  | "wrap_dress"
  | "office_blouse"
  | "pencil_skirt"
  | "circle_skirt"
  | "palazzo_pants"
  | "summer_two_piece";

const PLANNER_PRESETS: {
  key: Exclude<GarmentPresetKey, "custom_last">;
  label: string;
}[] = [
  { key: "wrap_dress", label: "Vestido Cruzado Fluido" },
  { key: "office_blouse", label: "Blusa Básica de Oficina" },
  { key: "pencil_skirt", label: "Falda Recta / Tubo" },
  { key: "circle_skirt", label: "Falda Circular" },
  { key: "palazzo_pants", label: "Pantalón Palazzo" },
  { key: "summer_two_piece", label: "Conjunto Crop + Falda" },
];

const DEFAULT_SAMPLE_MEASUREMENTS: Measurements = {
  bust: 94,
  waist: 74,
  hip: 100,
  backWidth: 38,
  bodiceLength: 42,
  sleeveLength: 58,
  skirtLength: 60,
  crotchDepth: 27,
  thigh: 58,
  inseam: 76,
  hemWidth: 42,
  headCircumference: 57,
};

interface PlacedPiece {
  id: string;
  label: string;
  xCm: number;
  yCm: number;
  wCm: number;
  hCm: number;
  piece: PatternPiece;
  copyNote?: string;
}

const PIECE_PALETTE = [
  { fill: "#FFE4E6", stroke: "#E11D48" },
  { fill: "#CCFBF1", stroke: "#0D9488" },
  { fill: "#FEF3C7", stroke: "#D97706" },
  { fill: "#E0E7FF", stroke: "#4338CA" },
  { fill: "#F1F5F9", stroke: "#334155" },
];

export default function FabricLayoutPlanner() {
  const [selectedPreset, setSelectedPreset] =
    useState<GarmentPresetKey>("wrap_dress");
  const [rollWidthCm, setRollWidthCm] = useState<140 | 150>(150);
  const [fabricMode, setFabricMode] = useState<"folded" | "open">("folded");
  const [sizeMultiplier, setSizeMultiplier] = useState<number>(1.0);

  const lastPatternSnap = useSyncExternalStore(
    subscribeWorkshopStorage,
    loadLastGeneratedPattern,
    getLastPatternServerSnapshot
  );

  const handleImportLastPattern = () => {
    if (lastPatternSnap) {
      setSelectedPreset("custom_last");
    }
  };

  const activePattern: PatternResult = useMemo(() => {
    if (selectedPreset === "custom_last" && lastPatternSnap) {
      return lastPatternSnap.pattern;
    }

    const styleId =
      selectedPreset === "custom_last" ? "wrap_dress" : selectedPreset;
    const preset =
      FASHION_STYLES_CATALOG.find((s) => s.id === styleId) ??
      FASHION_STYLES_CATALOG[0];

    const scaledMeasurements: Measurements = {
      ...DEFAULT_SAMPLE_MEASUREMENTS,
      bust: Math.round(DEFAULT_SAMPLE_MEASUREMENTS.bust * sizeMultiplier),
      waist: Math.round(DEFAULT_SAMPLE_MEASUREMENTS.waist * sizeMultiplier),
      hip: Math.round(DEFAULT_SAMPLE_MEASUREMENTS.hip * sizeMultiplier),
    };

    const c = preset.config;
    return generateUniversalPattern({
      category: c.category,
      topSubStyle: c.topSubStyle ?? "blouse",
      pantsSubStyle: c.pantsSubStyle ?? "straight",
      skirtSubStyle: c.skirtSubStyle ?? "a_line",
      dressSubStyle: c.dressSubStyle ?? "dress",
      twoPieceTopStyle: c.twoPieceTopStyle ?? "crop_top",
      twoPieceBottomStyle: c.twoPieceBottomStyle ?? "aline_skirt",
      necklineStyle: c.necklineStyle ?? "round",
      sleeveStyle: c.sleeveStyle ?? "short",
      torsoFit: c.torsoFit ?? "fitted",
      measurements: scaledMeasurements,
      seamAllowance: 1.5,
      fabricType: c.fabricType ?? "woven",
      extras: c.extras ?? DEFAULT_GARMENT_EXTRAS,
      quickLength: c.quickLength,
      styleVariant: c.styleVariant,
    });
  }, [selectedPreset, lastPatternSnap, sizeMultiplier]);

  const layout = useMemo(() => {
    const marginCm = 2;
    const gapCm = 2;
    const usableCrossCm =
      fabricMode === "folded" ? rollWidthCm / 2 : rollWidthCm;

    const queue: { piece: PatternPiece; copyNote?: string; key: string }[] = [];
    for (const p of activePattern.pieces) {
      const hasFold = Boolean(p.foldLine);
      if (fabricMode === "open" && !hasFold) {
        queue.push({ piece: p, copyNote: "Der.", key: `${p.id}-a` });
        queue.push({ piece: p, copyNote: "Izq.", key: `${p.id}-b` });
      } else {
        queue.push({
          piece: p,
          copyNote: hasFold && fabricMode === "folded" ? "Al doblez" : undefined,
          key: p.id,
        });
      }
    }

    const sorted = [...queue].sort(
      (a, b) => b.piece.widthCm - a.piece.widthCm
    );

    const placed: PlacedPiece[] = [];
    let currentX = marginCm;
    let currentY = marginCm;
    let columnMaxLength = 0;
    let totalPieceAreaCm2 = 0;

    for (const item of sorted) {
      const lenAlongRoll = Math.max(8, item.piece.heightCm);
      const crossAcrossRoll = Math.max(8, item.piece.widthCm);
      const effectiveCross = Math.min(crossAcrossRoll, usableCrossCm - marginCm * 2);

      if (currentY + effectiveCross > usableCrossCm - marginCm) {
        currentX += columnMaxLength + gapCm;
        currentY = marginCm;
        columnMaxLength = 0;
      }

      placed.push({
        id: item.key,
        label: item.piece.tabLabel || item.piece.name,
        xCm: currentX,
        yCm: currentY,
        wCm: lenAlongRoll,
        hCm: effectiveCross,
        piece: item.piece,
        copyNote: item.copyNote,
      });

      totalPieceAreaCm2 += lenAlongRoll * effectiveCross;
      currentY += effectiveCross + gapCm;
      columnMaxLength = Math.max(columnMaxLength, lenAlongRoll);
    }

    const totalLengthCm = Math.max(60, currentX + columnMaxLength + 10);
    const totalMeters = Math.ceil((totalLengthCm / 100) * 10) / 10;
    const rollAreaCm2 = totalLengthCm * usableCrossCm;
    const efficiencyPct = Math.min(
      95,
      Math.round((totalPieceAreaCm2 / Math.max(1, rollAreaCm2)) * 100)
    );

    return {
      usableCrossCm,
      totalLengthCm,
      totalMeters,
      efficiencyPct,
      placed,
    };
  }, [activePattern, rollWidthCm, fabricMode]);

  const svgWidth = Math.max(420, layout.totalLengthCm + 20);
  const svgHeight = layout.usableCrossCm + 44;

  return (
    <div className="space-y-5">
      {/* Controls Card */}
      <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Simulador de Acomodo sobre Tela (&quot;Plan de Corte&quot;)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Visualiza cómo caben las piezas respetando el hilo de la tela para comprar solo los metros necesarios.
            </p>
          </div>

          <button
            type="button"
            onClick={handleImportLastPattern}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>
              {lastPatternSnap
                ? `Importar último molde (${lastPatternSnap.pattern.subStyleLabel})`
                : "Importar último molde del Generador"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Garment Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-600 mb-1.5">
              Prenda a simular
            </label>
            <select
              value={selectedPreset}
              onChange={(e) =>
                setSelectedPreset(e.target.value as GarmentPresetKey)
              }
              className="w-full min-h-[48px] px-3 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm font-bold text-slate-900"
            >
              {lastPatternSnap && (
                <option value="custom_last">
                  Último molde generado ({lastPatternSnap.pattern.subStyleLabel})
                </option>
              )}
              {PLANNER_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Roll Width */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-600 mb-1.5">
              Ancho de la tela
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([140, 150] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setRollWidthCm(w)}
                  className={`min-h-[48px] rounded-2xl text-sm font-extrabold border transition cursor-pointer ${
                    rollWidthCm === w
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-[#FAF8F5] text-slate-700 border-slate-200"
                  }`}
                >
                  {w} cm
                </button>
              ))}
            </div>
          </div>

          {/* Fold Mode */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-600 mb-1.5">
              Modo de tendido
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFabricMode("folded")}
                className={`min-h-[48px] px-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition cursor-pointer ${
                  fabricMode === "folded"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-[#FAF8F5] text-slate-700 border-slate-200"
                }`}
              >
                Al doblez (1/2)
              </button>
              <button
                type="button"
                onClick={() => setFabricMode("open")}
                className={`min-h-[48px] px-2 rounded-2xl text-xs sm:text-sm font-extrabold border transition cursor-pointer ${
                  fabricMode === "open"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-[#FAF8F5] text-slate-700 border-slate-200"
                }`}
              >
                Tela abierta
              </button>
            </div>
          </div>
        </div>

        {/* Size quick scale when using built-in preset */}
        {selectedPreset !== "custom_last" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-600">
              Referencia de talla:
            </span>
            {[
              { label: "XS / S", mult: 0.9 },
              { label: "M (Estándar)", mult: 1.0 },
              { label: "L", mult: 1.09 },
              { label: "XL", mult: 1.18 },
            ].map((sz) => (
              <button
                key={sz.label}
                type="button"
                onClick={() => setSizeMultiplier(sz.mult)}
                className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  sizeMultiplier === sz.mult
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-[#FAF8F5] text-slate-700 border-slate-200"
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border-2 border-teal-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-500">
              Metros lineales a comprar
            </span>
            <strong className="text-2xl font-black text-teal-700">
              {layout.totalMeters.toFixed(1)} metros
            </strong>
          </div>
          <Ruler className="h-8 w-8 text-teal-600 shrink-0" />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-500">
              Piezas ubicadas al hilo
            </span>
            <strong className="text-2xl font-black text-slate-900">
              {layout.placed.length} piezas
            </strong>
          </div>
          <Layers className="h-8 w-8 text-rose-600 shrink-0" />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-500">
              Aprovechamiento de tela
            </span>
            <strong className="text-2xl font-black text-amber-700">
              {layout.efficiencyPct}% útil
            </strong>
          </div>
          <Scissors className="h-8 w-8 text-amber-600 shrink-0" />
        </div>
      </div>

      {/* Interactive Scaled Cutting Roll Canvas */}
      <section className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-slate-900">
            Plano a escala sobre tela ({layout.totalLengthCm.toFixed(0)} cm de largo ×{" "}
            {layout.usableCrossCm} cm útiles)
          </span>
          <span className="text-xs font-semibold text-slate-500">
            Hilo de la tela paralelo al orillo (horizontal) ↔
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-[#FAF8F5] border border-slate-200 p-3">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[540px] h-auto"
            role="img"
            aria-label="Simulador visual de acomodo de moldes sobre el rollo de tela"
          >
            {/* Fabric Roll Surface */}
            <rect
              x="10"
              y="22"
              width={layout.totalLengthCm}
              height={layout.usableCrossCm}
              rx="6"
              fill="#FFFFFF"
              stroke="#94A3B8"
              strokeWidth="2"
            />

            {/* Top edge: Selvedge / Orillo */}
            <line
              x1="10"
              y1="26"
              x2={10 + layout.totalLengthCm}
              y2="26"
              stroke="#0D9488"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text x="16" y="16" fill="#0F766E" fontSize="10" fontWeight="800">
              ORILLO (Hilo de la tela → {layout.totalMeters.toFixed(1)} m)
            </text>

            {/* Bottom edge: Fold or second selvedge */}
            <line
              x1="10"
              y1={22 + layout.usableCrossCm - 3}
              x2={10 + layout.totalLengthCm}
              y2={22 + layout.usableCrossCm - 3}
              stroke="#E11D48"
              strokeWidth="1.8"
              strokeDasharray={fabricMode === "folded" ? "8 4" : "4 4"}
            />
            <text
              x="16"
              y={22 + layout.usableCrossCm + 15}
              fill="#BE123C"
              fontSize="10"
              fontWeight="800"
            >
              {fabricMode === "folded"
                ? `DOBLEZ DE TELA (Ancho doblez: ${layout.usableCrossCm} cm de ${rollWidthCm} cm)`
                : `ORILLO INFERIOR (Ancho abierto: ${rollWidthCm} cm)`}
            </text>

            {/* Placed Pieces */}
            {layout.placed.map((item, idx) => {
              const colors = PIECE_PALETTE[idx % PIECE_PALETTE.length];
              const pathD = commandsToSvgPath(item.piece.seamPath);
              const pxW = Math.max(1, item.piece.widthCm);
              const pxH = Math.max(1, item.piece.heightCm);
              const sx = item.wCm / pxH;
              const sy = item.hCm / pxW;

              return (
                <g key={item.id}>
                  <rect
                    x={10 + item.xCm}
                    y={22 + item.yCm}
                    width={item.wCm}
                    height={item.hCm}
                    rx="4"
                    fill={colors.fill}
                    fillOpacity="0.65"
                    stroke={colors.stroke}
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                  <g
                    transform={`translate(${10 + item.xCm}, ${
                      22 + item.yCm + item.hCm
                    }) rotate(-90) scale(${sy}, ${sx})`}
                  >
                    <path
                      d={pathD}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="1.6"
                    />
                  </g>
                  <text
                    x={10 + item.xCm + item.wCm / 2}
                    y={22 + item.yCm + item.hCm / 2}
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize="9.5"
                    fontWeight="800"
                  >
                    {item.label}
                    {item.copyNote ? ` (${item.copyNote})` : ""}
                  </text>
                  <text
                    x={10 + item.xCm + item.wCm / 2}
                    y={22 + item.yCm + item.hCm / 2 + 11}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="8"
                    fontWeight="700"
                  >
                    {item.wCm.toFixed(0)} × {item.hCm.toFixed(0)} cm
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Tip: si tu tela encoge al lavar (lino, algodón o rayón), suma 15 cm extra por cada metro antes de comprar.
          </p>
          <Link
            href="/"
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition"
          >
            <span>Ajustar medidas en el Generador</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
