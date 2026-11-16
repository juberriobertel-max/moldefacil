"use client";

import React, { useMemo, useState } from "react";
import {
  Scissors,
  Download,
  Camera,
  Shirt,
  Sparkles,
  Plus,
  Minus,
  FileText,
  Ruler,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DEFAULT_GARMENT_EXTRAS,
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  Measurements,
  NecklineStyle,
  PantsSubStyle,
  PaperFormat,
  QuickLengthPreset,
  SeamAllowance,
  SkirtSubStyle,
  SleeveStyle,
  StyleVariant,
  TopSubStyle,
  TorsoFit,
  TracingPins,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "@/lib/types";
import { generateUniversalPattern } from "@/lib/patternEngine";
import { resolveQuickLength } from "@/lib/garmentEngines/extrasEngine";
import { FashionStylePreset } from "@/lib/fashionStylesCatalog";
import { DetectedGarmentConfig } from "@/lib/browserStyleDetector";
import {
  DEFAULT_TRACING_PINS,
  solveTracingProportions,
} from "@/lib/proportionSolver";
import { computeTilingGrid, exportPatternToPdf } from "@/lib/pdfExporter";
import SmartGarmentScanner from "@/components/SmartGarmentScanner";
import FashionStylesGallery from "@/components/FashionStylesGallery";
import {
  GarmentExtrasSelector,
  QuickLengthSelector,
} from "@/components/GarmentDetailsPanel";
import PatternCanvas from "@/components/PatternCanvas";
import AdBanner from "@/components/AdBanner";
import DownloadAdModal from "@/components/DownloadAdModal";

const DEFAULT_MEASUREMENTS: Measurements = {
  bust: 92,
  waist: 72,
  hip: 98,
  backWidth: 37,
  bodiceLength: 42,
  sleeveLength: 58,
  skirtLength: 58,
  crotchDepth: 27,
  thigh: 58,
  inseam: 76,
  hemWidth: 38,
};

interface MeasurementField {
  key: keyof Measurements;
  label: string;
  min: number;
  max: number;
  categories: GarmentCategory[];
}

const DYNAMIC_FIELDS: MeasurementField[] = [
  {
    key: "bust",
    label: "Busto",
    min: 70,
    max: 140,
    categories: ["top", "dress", "two_piece"],
  },
  {
    key: "waist",
    label: "Cintura",
    min: 52,
    max: 130,
    categories: ["top", "pants", "skirt", "dress", "two_piece"],
  },
  {
    key: "hip",
    label: "Cadera",
    min: 76,
    max: 150,
    categories: ["top", "pants", "skirt", "dress", "two_piece"],
  },
  {
    key: "backWidth",
    label: "Ancho de espalda",
    min: 28,
    max: 52,
    categories: ["top", "dress", "two_piece"],
  },
  {
    key: "bodiceLength",
    label: "Largo de talle",
    min: 32,
    max: 56,
    categories: ["top", "dress", "two_piece"],
  },
  {
    key: "sleeveLength",
    label: "Largo de manga",
    min: 18,
    max: 70,
    categories: ["top", "dress", "two_piece"],
  },
  {
    key: "skirtLength",
    label: "Largo deseado",
    min: 30,
    max: 115,
    categories: ["skirt", "dress", "two_piece"],
  },
  {
    key: "crotchDepth",
    label: "Altura de tiro",
    min: 20,
    max: 38,
    categories: ["pants", "dress", "two_piece"],
  },
  {
    key: "thigh",
    label: "Contorno de muslo",
    min: 40,
    max: 85,
    categories: ["pants", "two_piece"],
  },
  {
    key: "inseam",
    label: "Largo de pierna",
    min: 20,
    max: 92,
    categories: ["pants", "dress", "two_piece"],
  },
  {
    key: "hemWidth",
    label: "Ancho de bota",
    min: 26,
    max: 70,
    categories: ["pants", "dress", "two_piece"],
  },
];

export default function HomePage() {
  const [mode, setMode] = useState<"styles" | "scanner" | "template">("template");
  const [openStep, setOpenStep] = useState<1 | 2 | 3>(1);

  const [category, setCategory] = useState<GarmentCategory>("dress");
  const [topSubStyle, setTopSubStyle] = useState<TopSubStyle>("blouse");
  const [pantsSubStyle, setPantsSubStyle] = useState<PantsSubStyle>("straight");
  const [skirtSubStyle, setSkirtSubStyle] = useState<SkirtSubStyle>("a_line");
  const [dressSubStyle, setDressSubStyle] = useState<DressSubStyle>("dress");
  const [twoPieceTopStyle, setTwoPieceTopStyle] =
    useState<TwoPieceTopStyle>("crop_top");
  const [twoPieceBottomStyle, setTwoPieceBottomStyle] =
    useState<TwoPieceBottomStyle>("aline_skirt");
  const [necklineStyle, setNecklineStyle] = useState<NecklineStyle>("round");
  const [sleeveStyle, setSleeveStyle] = useState<SleeveStyle>("short");
  const [torsoFit, setTorsoFit] = useState<TorsoFit>("fitted");
  const [extras, setExtras] = useState<GarmentExtras>(DEFAULT_GARMENT_EXTRAS);
  const [quickLength, setQuickLength] = useState<QuickLengthPreset>("photo");
  const [styleVariant, setStyleVariant] = useState<StyleVariant>("default");
  const [activeFashionStyleId, setActiveFashionStyleId] = useState<string | null>(
    null
  );

  const [measurements, setMeasurements] =
    useState<Measurements>(DEFAULT_MEASUREMENTS);
  const [seamAllowance, setSeamAllowance] = useState<SeamAllowance>(1);
  const [fabricType, setFabricType] = useState<FabricType>("woven");

  const [pins, setPins] = useState<TracingPins>(DEFAULT_TRACING_PINS);
  const [pinsMoved, setPinsMoved] = useState<boolean>(false);

  const [paperFormat, setPaperFormat] = useState<PaperFormat>("letter");
  const [activePieceId, setActivePieceId] = useState<string>("all");
  const [showSheetGrid, setShowSheetGrid] = useState<boolean>(false);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  const applyFashionPreset = (preset: FashionStylePreset) => {
    const c = preset.config;
    setCategory(c.category);
    if (c.topSubStyle) setTopSubStyle(c.topSubStyle);
    if (c.pantsSubStyle) setPantsSubStyle(c.pantsSubStyle);
    else if (c.category === "two_piece" && c.twoPieceBottomStyle === "pants") {
      setPantsSubStyle("straight");
    }
    if (c.skirtSubStyle) setSkirtSubStyle(c.skirtSubStyle);
    if (c.dressSubStyle) setDressSubStyle(c.dressSubStyle);
    if (c.twoPieceTopStyle) setTwoPieceTopStyle(c.twoPieceTopStyle);
    if (c.twoPieceBottomStyle) setTwoPieceBottomStyle(c.twoPieceBottomStyle);
    if (c.necklineStyle) setNecklineStyle(c.necklineStyle);
    if (c.sleeveStyle) setSleeveStyle(c.sleeveStyle);
    setTorsoFit(c.torsoFit ?? "fitted");
    if (c.fabricType) setFabricType(c.fabricType);
    setExtras(c.extras);
    setQuickLength(c.quickLength);
    setStyleVariant(c.styleVariant);
    setActiveFashionStyleId(preset.id);
    setActivePieceId("all");
  };

  const applyDetectedAttributes = (cfg: DetectedGarmentConfig) => {
    setCategory(cfg.category);
    if (cfg.topSubStyle) setTopSubStyle(cfg.topSubStyle);
    if (cfg.pantsSubStyle) setPantsSubStyle(cfg.pantsSubStyle);
    if (cfg.skirtSubStyle) setSkirtSubStyle(cfg.skirtSubStyle);
    if (cfg.dressSubStyle) setDressSubStyle(cfg.dressSubStyle);
    if (cfg.twoPieceTopStyle) setTwoPieceTopStyle(cfg.twoPieceTopStyle);
    if (cfg.twoPieceBottomStyle) setTwoPieceBottomStyle(cfg.twoPieceBottomStyle);
    setNecklineStyle(cfg.necklineStyle);
    setSleeveStyle(cfg.sleeveStyle);
    setTorsoFit(cfg.torsoFit);
    setExtras(cfg.extras);
    setQuickLength(cfg.quickLength);
    setStyleVariant(cfg.styleVariant);
    setActiveFashionStyleId(null);
    setActivePieceId("all");
  };

  const tracingProportions = useMemo(() => {
    if (mode !== "scanner" || !pinsMoved) return null;
    return solveTracingProportions(pins);
  }, [mode, pinsMoved, pins]);

  const pattern = useMemo(
    () =>
      generateUniversalPattern({
        category,
        topSubStyle,
        pantsSubStyle,
        skirtSubStyle,
        dressSubStyle,
        twoPieceTopStyle,
        twoPieceBottomStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        measurements,
        seamAllowance,
        fabricType,
        tracingProportions,
        extras,
        quickLength,
        styleVariant,
      }),
    [
      category,
      topSubStyle,
      pantsSubStyle,
      skirtSubStyle,
      dressSubStyle,
      twoPieceTopStyle,
      twoPieceBottomStyle,
      necklineStyle,
      sleeveStyle,
      torsoFit,
      measurements,
      seamAllowance,
      fabricType,
      tracingProportions,
      extras,
      quickLength,
      styleVariant,
    ]
  );

  const tilingGrid = useMemo(
    () =>
      computeTilingGrid(
        pattern.totalBoundsCm.width,
        pattern.totalBoundsCm.height,
        paperFormat,
        pattern.pieces
      ),
    [pattern.totalBoundsCm.width, pattern.totalBoundsCm.height, paperFormat, pattern.pieces]
  );

  const totalSheetPages = tilingGrid.printableCount;

  const visibleFields = useMemo(
    () =>
      DYNAMIC_FIELDS.filter((f) => {
        if (!f.categories.includes(category)) return false;
        if (
          category === "dress" &&
          dressSubStyle === "dress" &&
          ["crotchDepth", "inseam", "hemWidth"].includes(f.key)
        ) {
          return false;
        }
        if (
          category === "dress" &&
          dressSubStyle === "jumpsuit" &&
          f.key === "skirtLength"
        ) {
          return false;
        }
        if (category === "two_piece") {
          if (
            twoPieceBottomStyle !== "pants" &&
            ["crotchDepth", "thigh", "inseam", "hemWidth"].includes(f.key)
          ) {
            return false;
          }
          if (twoPieceBottomStyle === "pants" && f.key === "skirtLength") {
            return false;
          }
        }
        return true;
      }),
    [category, dressSubStyle, twoPieceBottomStyle]
  );

  const adjustMeasurement = (field: MeasurementField, delta: number) => {
    if (field.key === "skirtLength" || field.key === "inseam") {
      setQuickLength("photo");
    }
    setMeasurements((prev) => {
      const next = Math.min(
        field.max,
        Math.max(field.min, prev[field.key] + delta)
      );
      return { ...prev, [field.key]: next };
    });
  };

  const triggerPdfDownload = () => {
    const { measurements: effectiveMeasurements } = resolveQuickLength(
      measurements,
      quickLength,
      category
    );
    exportPatternToPdf({
      pattern,
      paperFormat,
      measurements: effectiveMeasurements,
      seamAllowance,
      fabricType,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-slate-800 overflow-x-hidden">
      {/* Warm, Inviting Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-4 lg:px-8 py-3.5 shadow-2xs">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 flex items-center justify-center shadow-sm text-white shrink-0">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                MoldeFácil — Tus patrones de costura a medida
              </h1>
              <p className="text-sm text-slate-500 hidden sm:block">
                Crea moldes a tu talla en 3 pasos y descárgalos gratis listos para imprimir en casa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDownloadModalOpen(true)}
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold shadow-md flex items-center gap-2 transition cursor-pointer"
          >
            <Download className="h-5 w-5" />
            Descargar Molde en PDF (Gratis)
          </button>
        </div>
      </header>

      {/* Main 2-Column Sewing Studio */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: 3-Step Guided Assistant + Box Ad */}
        <aside className="min-w-0 lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          {/* PASO 1: Elige cómo empezar */}
          <section className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenStep(openStep === 1 ? 2 : 1)}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-white hover:bg-slate-50/70 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-extrabold text-base flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Paso 1: Elige cómo empezar
                  </h2>
                  <p className="text-sm text-slate-500">
                    {mode === "scanner" ? "Desde una foto" : pattern.subStyleLabel}
                  </p>
                </div>
              </div>
              {openStep === 1 ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {openStep === 1 && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode("styles")}
                    className={`sm:col-span-2 min-h-[54px] p-3 rounded-2xl border-2 font-bold text-base flex items-center justify-center gap-2 transition cursor-pointer ${
                      mode === "styles"
                        ? "bg-amber-50 border-amber-500 text-amber-900 shadow-2xs"
                        : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
                    <span>Explorar Modas y Estilos (12 diseños)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("scanner")}
                    className={`min-h-[54px] p-3 rounded-2xl border-2 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer ${
                      mode === "scanner"
                        ? "bg-teal-50 border-teal-600 text-teal-800 shadow-2xs"
                        : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Camera className="h-5 w-5 shrink-0" />
                    <span>Desde una foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("template")}
                    className={`min-h-[54px] p-3 rounded-2xl border-2 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer ${
                      mode === "template"
                        ? "bg-teal-50 border-teal-600 text-teal-800 shadow-2xs"
                        : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Shirt className="h-5 w-5 shrink-0" />
                    <span>Prenda básica</span>
                  </button>
                </div>

                {mode === "styles" ? (
                  <FashionStylesGallery
                    activeStyleId={activeFashionStyleId}
                    onSelectStyle={applyFashionPreset}
                  />
                ) : mode === "scanner" ? (
                  <SmartGarmentScanner
                    pins={pins}
                    onPinsChange={(next) => {
                      setPins(next);
                      setPinsMoved(true);
                    }}
                    category={category}
                    onCategoryChange={(cat) => {
                      setCategory(cat);
                      setStyleVariant("default");
                      setActiveFashionStyleId(null);
                      setActivePieceId("all");
                    }}
                    necklineStyle={necklineStyle}
                    onNecklineStyleChange={(st) => {
                      setNecklineStyle(st);
                      setActiveFashionStyleId(null);
                    }}
                    sleeveStyle={sleeveStyle}
                    onSleeveStyleChange={(sl) => {
                      setSleeveStyle(sl);
                      setActiveFashionStyleId(null);
                    }}
                    torsoFit={torsoFit}
                    onTorsoFitChange={(fit) => {
                      setTorsoFit(fit);
                      setActiveFashionStyleId(null);
                    }}
                    skirtSubStyle={skirtSubStyle}
                    onSkirtSubStyleChange={(sk) => {
                      setSkirtSubStyle(sk);
                      setActiveFashionStyleId(null);
                    }}
                    pantsSubStyle={pantsSubStyle}
                    onPantsSubStyleChange={(pt) => {
                      setPantsSubStyle(pt);
                      setActiveFashionStyleId(null);
                    }}
                    twoPieceTopStyle={twoPieceTopStyle}
                    onTwoPieceTopStyleChange={(tp) => {
                      setTwoPieceTopStyle(tp);
                      setActiveFashionStyleId(null);
                    }}
                    twoPieceBottomStyle={twoPieceBottomStyle}
                    onTwoPieceBottomStyleChange={(bt) => {
                      setTwoPieceBottomStyle(bt);
                      setActiveFashionStyleId(null);
                    }}
                    extras={extras}
                    onExtrasChange={(next) => {
                      setExtras(next);
                      setActiveFashionStyleId(null);
                    }}
                    quickLength={quickLength}
                    onQuickLengthChange={(q) => {
                      setQuickLength(q);
                      setActiveFashionStyleId(null);
                    }}
                    onApplyDetectedAttributes={applyDetectedAttributes}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      {(
                        [
                          { id: "two_piece", label: "Conjunto (2 Piezas)" },
                          { id: "dress", label: "Vestido / Mono" },
                          { id: "top", label: "Blusa / Chaqueta" },
                          { id: "pants", label: "Pantalón / Short" },
                          { id: "skirt", label: "Falda" },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategory(cat.id);
                            setStyleVariant("default");
                            setActiveFashionStyleId(null);
                            setActivePieceId("all");
                            setPinsMoved(false);
                          }}
                          className={`min-h-[48px] px-3 py-2.5 rounded-xl text-base font-semibold border transition cursor-pointer ${
                            cat.id === "two_piece" ? "col-span-2" : ""
                          } ${
                            category === cat.id
                              ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                              : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Sub-style & Neckline */}
                    <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Modelo de prenda
                        </label>
                        {category === "top" && (
                          <select
                            value={topSubStyle}
                            onChange={(e) =>
                              setTopSubStyle(e.target.value as TopSubStyle)
                            }
                            className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                          >
                            <option value="tshirt">Camiseta básica</option>
                            <option value="blouse">Blusa / Camisa</option>
                            <option value="jacket">Chaqueta holgada</option>
                          </select>
                        )}
                        {category === "pants" && (
                          <select
                            value={pantsSubStyle}
                            onChange={(e) =>
                              setPantsSubStyle(e.target.value as PantsSubStyle)
                            }
                            className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                          >
                            <option value="straight">Pantalón recto</option>
                            <option value="wide">Pantalón ancho</option>
                            <option value="shorts">Short / Bermuda</option>
                          </select>
                        )}
                        {category === "skirt" && (
                          <select
                            value={skirtSubStyle}
                            onChange={(e) =>
                              setSkirtSubStyle(e.target.value as SkirtSubStyle)
                            }
                            className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                          >
                            <option value="straight">Falda recta / tubo</option>
                            <option value="a_line">Falda línea A</option>
                            <option value="semicircular">
                              Falda semicircular con vuelo
                            </option>
                          </select>
                        )}
                        {category === "dress" && (
                          <select
                            value={dressSubStyle}
                            onChange={(e) =>
                              setDressSubStyle(e.target.value as DressSubStyle)
                            }
                            className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                          >
                            <option value="dress">Vestido completo</option>
                            <option value="jumpsuit">Enterizo / Mono</option>
                          </select>
                        )}
                        {category === "two_piece" && (
                          <div className="space-y-2.5">
                            <select
                              value={twoPieceTopStyle}
                              onChange={(e) =>
                                setTwoPieceTopStyle(
                                  e.target.value as TwoPieceTopStyle
                                )
                              }
                              className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                            >
                              <option value="crop_top">
                                Arriba: Top corto (Crop top)
                              </option>
                              <option value="waist_blouse">
                                Arriba: Blusa a la cintura
                              </option>
                            </select>
                            <select
                              value={twoPieceBottomStyle}
                              onChange={(e) =>
                                setTwoPieceBottomStyle(
                                  e.target.value as TwoPieceBottomStyle
                                )
                              }
                              className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                            >
                              <option value="straight_skirt">
                                Abajo: Falda recta
                              </option>
                              <option value="aline_skirt">
                                Abajo: Falda en A
                              </option>
                              <option value="long_skirt">
                                Abajo: Falda larga fluida
                              </option>
                              <option value="pants">Abajo: Pantalón</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {(category === "top" ||
                        category === "dress" ||
                        category === "two_piece") && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Forma del escote
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                [
                                  { id: "round", label: "Redondo" },
                                  { id: "v_neck", label: "En V" },
                                  { id: "square", label: "Cuadrado" },
                                  { id: "high", label: "Alto / Cerrado" },
                                ] as const
                              ).map((nk) => (
                                <button
                                  key={nk.id}
                                  type="button"
                                  onClick={() => setNecklineStyle(nk.id)}
                                  className={`min-h-[48px] rounded-xl text-base font-semibold border transition cursor-pointer ${
                                    necklineStyle === nk.id
                                      ? "bg-teal-600 text-white border-teal-600"
                                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {nk.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              Mangas
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                [
                                  { id: "sleeveless", label: "Sin mangas" },
                                  { id: "short", label: "Manga corta" },
                                  { id: "long", label: "Manga larga" },
                                  { id: "kimono", label: "Kimono / Murciélago" },
                                ] as const
                              ).map((sl) => (
                                <button
                                  key={sl.id}
                                  type="button"
                                  onClick={() => setSleeveStyle(sl.id)}
                                  className={`min-h-[48px] px-2.5 rounded-xl text-sm font-semibold border transition cursor-pointer ${
                                    sleeveStyle === sl.id
                                      ? "bg-teal-600 text-white border-teal-600"
                                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {sl.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Largo rápido y Detalles y Extras de la Prenda */}
                      <QuickLengthSelector
                        quickLength={quickLength}
                        onQuickLengthChange={setQuickLength}
                      />

                      <GarmentExtrasSelector
                        category={category}
                        sleeveStyle={sleeveStyle}
                        onSleeveStyleChange={setSleeveStyle}
                        extras={extras}
                        onExtrasChange={setExtras}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* PASO 2: Pon tus medidas (en cm) */}
          <section className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenStep(openStep === 2 ? 3 : 2)}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-white hover:bg-slate-50/70 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-extrabold text-base flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Paso 2: Pon tus medidas (en cm)
                  </h2>
                  <p className="text-sm text-slate-500">
                    Busto {measurements.bust} • Cintura {measurements.waist} • Cadera {measurements.hip} cm
                  </p>
                </div>
              </div>
              {openStep === 2 ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {openStep === 2 && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-5">
                {/* Numeric Fields with Large + and - Buttons */}
                <div className="space-y-3">
                  {visibleFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#FAF8F5] border border-slate-200"
                    >
                      <label
                        htmlFor={`input-${field.key}`}
                        className="text-base font-semibold text-slate-800 pl-1"
                      >
                        {field.label}
                      </label>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Restar 1 cm a ${field.label}`}
                          onClick={() => adjustMeasurement(field, -1)}
                          className="w-11 h-11 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs cursor-pointer"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2 h-11">
                          <input
                            id={`input-${field.key}`}
                            type="number"
                            min={field.min}
                            max={field.max}
                            value={measurements[field.key]}
                            onChange={(e) => {
                              if (
                                field.key === "skirtLength" ||
                                field.key === "inseam"
                              ) {
                                setQuickLength("photo");
                              }
                              setMeasurements({
                                ...measurements,
                                [field.key]:
                                  Number(e.target.value) || field.min,
                              });
                            }}
                            className="w-14 text-center text-base font-bold text-slate-900 focus:outline-none"
                          />
                          <span className="text-sm text-slate-500">cm</span>
                        </div>

                        <button
                          type="button"
                          aria-label={`Sumar 1 cm a ${field.label}`}
                          onClick={() => adjustMeasurement(field, 1)}
                          className="w-11 h-11 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <QuickLengthSelector
                  quickLength={quickLength}
                  onQuickLengthChange={setQuickLength}
                />

                {/* Friendly Fabric Selector */}
                <div className="space-y-2">
                  <span className="block text-base font-bold text-slate-800">
                    ¿Qué tela vas a usar?
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFabricType("woven")}
                      className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                        fabricType === "woven"
                          ? "bg-teal-50 border-teal-600 text-teal-900"
                          : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-base font-bold">
                        Tela normal (sin estirar)
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFabricType("stretch")}
                      className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                        fabricType === "stretch"
                          ? "bg-teal-50 border-teal-600 text-teal-900"
                          : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-base font-bold">
                        Tela que estira (licra/punto)
                      </div>
                    </button>
                  </div>
                </div>

                {/* Waist / Torso Silhouette Selector */}
                {(category === "top" ||
                  category === "dress" ||
                  category === "two_piece") && (
                  <div className="space-y-2">
                    <span className="block text-base font-bold text-slate-800">
                      Ajuste de la cintura
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTorsoFit("fitted")}
                        className={`min-h-[54px] px-3.5 py-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                          torsoFit === "fitted"
                            ? "bg-teal-50 border-teal-600 text-teal-900"
                            : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-base font-bold">
                          Entallado (al cuerpo)
                        </div>
                        <div className="text-xs text-slate-500">
                          Cintura definida con curva al costado
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTorsoFit("loose")}
                        className={`min-h-[54px] px-3.5 py-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                          torsoFit === "loose"
                            ? "bg-teal-50 border-teal-600 text-teal-900"
                            : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-base font-bold">
                          Holgado / Blusado (para cinturón)
                        </div>
                        <div className="text-xs text-slate-500">
                          Sin entalle, +5 cm de soltura para fruncir
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Friendly Seam Allowance Selector */}
                <div className="space-y-2">
                  <span className="block text-base font-bold text-slate-800">
                    Margen para costura
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { val: 0, label: "Sin margen" },
                        { val: 1, label: "1 cm (normal)" },
                        { val: 1.5, label: "1.5 cm" },
                      ] as const
                    ).map((sa) => (
                      <button
                        key={sa.val}
                        type="button"
                        onClick={() => setSeamAllowance(sa.val)}
                        className={`min-h-[48px] px-2 py-2 rounded-xl text-sm sm:text-base font-semibold border transition cursor-pointer ${
                          seamAllowance === sa.val
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {sa.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* PASO 3: Descargar e Imprimir */}
          <section className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenStep(openStep === 3 ? 1 : 3)}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-white hover:bg-slate-50/70 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-extrabold text-base flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Paso 3: Descargar e Imprimir
                  </h2>
                  <p className="text-sm text-slate-500">
                    Hoja {paperFormat === "letter" ? "Carta" : "A4"} • {totalSheetPages} hojas
                  </p>
                </div>
              </div>
              {openStep === 3 ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
              {/* Paper Size Visual Selector */}
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: "letter",
                      title: "Hoja Carta",
                      sub: "21.6 × 27.9 cm",
                    },
                    {
                      id: "a4",
                      title: "Hoja A4",
                      sub: "21.0 × 29.7 cm",
                    },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setPaperFormat(fmt.id)}
                    className={`min-h-[60px] p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                      paperFormat === fmt.id
                        ? "bg-teal-50 border-teal-600 text-teal-900"
                        : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-base font-bold">
                      <FileText className="h-4 w-4 shrink-0" />
                      {fmt.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {fmt.sub}
                    </div>
                  </button>
                ))}
              </div>

              {/* Clear Fabric & Sheets Summary */}
              <div className="rounded-2xl bg-[#FAF8F5] border border-slate-200 p-3.5 space-y-1.5 text-base">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Hojas para imprimir:</span>
                  <strong className="text-slate-900">
                    {totalSheetPages} hojas
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Ruler className="h-4 w-4 text-teal-600" />
                    Tela para comprar:
                  </span>
                  <strong className="text-teal-700">
                    {pattern.fabricConsumption.width140m.toFixed(2)} metros
                  </strong>
                </div>
              </div>

              {/* Giant Primary Free Download CTA */}
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(true)}
                className="w-full min-h-[54px] py-3.5 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-extrabold shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2.5 transition cursor-pointer"
              >
                <Download className="h-5 w-5" />
                Descargar Molde en PDF (Gratis)
              </button>
            </div>
          </section>

          {/* LOCATION 2: Box Ad (300x250) at bottom of Left Panel */}
          <div className="pt-1 w-full flex justify-center">
            <AdBanner variant="box-ad" adSlotId="sidebar-box-300x250" />
          </div>
        </aside>

        {/* RIGHT COLUMN: White Cutting Mat Canvas + Bottom Responsive Banner */}
        <section className="min-w-0 lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <div className="flex-1 min-h-[540px]">
            <PatternCanvas
              pattern={pattern}
              seamAllowance={seamAllowance}
              paperFormat={paperFormat}
              activePieceId={activePieceId}
              onActivePieceIdChange={setActivePieceId}
              showSheetGrid={showSheetGrid}
              onToggleSheetGrid={() => setShowSheetGrid((s) => !s)}
            />
          </div>

          {/* LOCATION 1: Responsive Bottom Banner (320x50 Mobile / 728x90 Desktop) */}
          <div className="flex justify-center md:hidden w-full">
            <AdBanner
              variant="mobile-banner"
              adSlotId="workspace-bottom-mobile-320x50"
              mediaQuery="(max-width: 767px)"
            />
          </div>
          <div className="hidden md:flex justify-center w-full">
            <AdBanner
              variant="horizontal-banner"
              adSlotId="workspace-bottom-728x90"
              mediaQuery="(min-width: 768px)"
            />
          </div>
        </section>
      </main>

      {/* Free Download Modal with 5-Second Ad Countdown */}
      <DownloadAdModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onTriggerDownload={triggerPdfDownload}
        paperLabel={paperFormat === "letter" ? "Carta" : "A4"}
        pageCount={totalSheetPages + 2}
      />
    </div>
  );
}
