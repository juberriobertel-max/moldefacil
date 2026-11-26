"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Box,
  Columns2,
  Download,
  Camera,
  Share2,
  Shirt,
  Sparkles,
  Plus,
  Minus,
  FileText,
  Ruler,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import {
  AccessorySubStyle,
  DEFAULT_GARMENT_EXTRAS,
  DressSubStyle,
  FabricType,
  GarmentCategory,
  GarmentExtras,
  JumpsuitSubStyle,
  KidsSubStyle,
  LoungewearSubStyle,
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
import { KIDS_SIZE_PRESETS } from "@/lib/garmentEngines/kidsEngine";
import { FashionStylePreset } from "@/lib/fashionStylesCatalog";
import { DetectedGarmentConfig } from "@/lib/browserStyleDetector";
import {
  DEFAULT_TRACING_PINS,
  getDefaultPinsForCategory,
  solveTracingProportions,
} from "@/lib/proportionSolver";
import { computeTilingGrid, exportPatternToPdf, exportPatternToSvg } from "@/lib/pdfExporter";
import { resolveProMeasurements } from "@/lib/seamValidator";
import { generateSewingGuide } from "@/lib/sewingGuideGenerator";
import SmartGarmentScanner from "@/components/SmartGarmentScanner";
import FashionStylesGallery from "@/components/FashionStylesGallery";
import {
  GarmentExtrasSelector,
  NecklineCollarSelector,
  QuickLengthSelector,
} from "@/components/GarmentDetailsPanel";
import PatternCanvas from "@/components/PatternCanvas";
import AdBanner from "@/components/AdBanner";
import DownloadAdModal from "@/components/DownloadAdModal";
import SiteHeader from "@/components/SiteHeader";
import HomeQueryParamsSync from "@/components/HomeQueryParamsSync";
import {
  loadMeasurementProfiles,
  saveLastGeneratedPattern,
} from "@/lib/savedMeasurements";
import {
  construirConfigMoldeDesdeGenerador,
  generarEtiquetasDesdeConfig,
  guardarBorradorCompartirCreacion,
} from "@/lib/community/patternBridge";
import type { ConfigMoldeSerializado } from "@/lib/community/types";
import {
  APARIENCIA_POR_DEFECTO,
  PALETA_UI_3D,
  toConfigPrenda,
  toMedidas3D,
  type Apariencia,
} from "@/lib/3d/types";

const Garment3DPreview = dynamic(
  () => import("@/components/Garment3DPreview"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full min-h-[540px] h-[640px] rounded-3xl border border-[#E2D6C8] flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: PALETA_UI_3D.crema }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-white animate-pulse"
          style={{ backgroundColor: PALETA_UI_3D.terracota }}
        >
          <Box className="w-6 h-6" />
        </div>
        <p className="text-sm font-extrabold text-[#2D2A26]">
          Cargando Probador 3D…
        </p>
        <p className="text-xs text-[#5C554E] mt-1 max-w-xs">
          Preparando maniquí anatómico y motor textil interactivo en tu dispositivo.
        </p>
      </div>
    ),
  }
);

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
  headCircumference: 57,
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
    key: "headCircumference",
    label: "Contorno de cabeza",
    min: 48,
    max: 64,
    categories: ["accessories"],
  },
  {
    key: "bust",
    label: "Busto / Pecho",
    min: 46,
    max: 145,
    categories: ["top", "dress", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "waist",
    label: "Cintura",
    min: 44,
    max: 135,
    categories: [
      "top",
      "pants",
      "skirt",
      "dress",
      "two_piece",
      "jumpsuit",
      "kids",
      "loungewear",
    ],
  },
  {
    key: "hip",
    label: "Cadera",
    min: 48,
    max: 155,
    categories: [
      "top",
      "pants",
      "skirt",
      "dress",
      "two_piece",
      "jumpsuit",
      "kids",
      "loungewear",
      "accessories",
    ],
  },
  {
    key: "backWidth",
    label: "Ancho de espalda",
    min: 20,
    max: 54,
    categories: ["top", "dress", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "bodiceLength",
    label: "Largo de talle",
    min: 18,
    max: 56,
    categories: ["top", "dress", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "sleeveLength",
    label: "Largo de manga",
    min: 14,
    max: 70,
    categories: ["top", "dress", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "skirtLength",
    label: "Largo deseado",
    min: 24,
    max: 115,
    categories: ["skirt", "dress", "two_piece", "kids"],
  },
  {
    key: "crotchDepth",
    label: "Altura de tiro",
    min: 16,
    max: 38,
    categories: ["pants", "dress", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "thigh",
    label: "Contorno de muslo",
    min: 28,
    max: 85,
    categories: ["pants", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "inseam",
    label: "Largo de pierna",
    min: 18,
    max: 92,
    categories: ["pants", "dress", "two_piece", "jumpsuit", "kids", "loungewear"],
  },
  {
    key: "hemWidth",
    label: "Ancho de bota",
    min: 20,
    max: 70,
    categories: ["pants", "dress", "two_piece", "jumpsuit", "kids"],
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
  const [jumpsuitSubStyle, setJumpsuitSubStyle] =
    useState<JumpsuitSubStyle>("romper_long");
  const [kidsSubStyle, setKidsSubStyle] =
    useState<KidsSubStyle>("baby_bodysuit");
  const [loungewearSubStyle, setLoungewearSubStyle] =
    useState<LoungewearSubStyle>("leggings");
  const [accessorySubStyle, setAccessorySubStyle] =
    useState<AccessorySubStyle>("bucket_hat");

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
  const [showProMeasurements, setShowProMeasurements] = useState<boolean>(false);

  const [vistaPatron, setVistaPatron] = useState<"2d" | "3d" | "dividida">("2d");
  const [apariencia3D, setApariencia3D] = useState<Apariencia>(() => ({
    ...APARIENCIA_POR_DEFECTO,
  }));
  const [usuarioFijoTela3D, setUsuarioFijoTela3D] = useState<boolean>(false);
  const [esPantallaAncha, setEsPantallaAncha] = useState<boolean>(false);
  const [modoAhorroDatos, setModoAhorroDatos] = useState<boolean>(false);
  const [permitir3DEnAhorro, setPermitir3DEnAhorro] = useState<boolean>(false);
  const [ajusteSugeridoPreview, setAjusteSugeridoPreview] = useState<{
    zona: string;
    cmDelta: number;
  } | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sincronizar = () => setEsPantallaAncha(mq.matches);
    queueMicrotask(() => {
      sincronizar();
      const navConn = navigator as Navigator & {
        connection?: { saveData?: boolean };
      };
      if (navConn.connection?.saveData) {
        setModoAhorroDatos(true);
      }
      const sp = new URLSearchParams(window.location.search);
      const aj = sp.get("ajuste_sugerido");
      if (aj && aj.includes(":")) {
        const [zona, cmStr] = aj.split(":");
        const cmDelta = Number(cmStr);
        if (zona && Number.isFinite(cmDelta)) {
          setAjusteSugeridoPreview({ zona, cmDelta });
        }
      }
    });
    mq.addEventListener("change", sincronizar);
    return () => mq.removeEventListener("change", sincronizar);
  }, []);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  const applyFashionPreset = useCallback((preset: FashionStylePreset) => {
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
  }, []);

  const handleUpdateMeasurementsPatch = useCallback(
    (patch: Partial<Measurements>) => {
      setMeasurements((prev) => ({ ...prev, ...patch }));
      setOpenStep(2);
    },
    []
  );

  const applyDetectedAttributes = (cfg: DetectedGarmentConfig) => {
    setCategory(cfg.category);
    if (cfg.topSubStyle) setTopSubStyle(cfg.topSubStyle);
    if (cfg.pantsSubStyle) setPantsSubStyle(cfg.pantsSubStyle);
    if (cfg.skirtSubStyle) setSkirtSubStyle(cfg.skirtSubStyle);
    if (cfg.dressSubStyle) setDressSubStyle(cfg.dressSubStyle);
    if (cfg.twoPieceTopStyle) setTwoPieceTopStyle(cfg.twoPieceTopStyle);
    if (cfg.twoPieceBottomStyle) setTwoPieceBottomStyle(cfg.twoPieceBottomStyle);
    if (cfg.jumpsuitSubStyle) setJumpsuitSubStyle(cfg.jumpsuitSubStyle);
    if (cfg.kidsSubStyle) setKidsSubStyle(cfg.kidsSubStyle);
    if (cfg.loungewearSubStyle) setLoungewearSubStyle(cfg.loungewearSubStyle);
    if (cfg.accessorySubStyle) setAccessorySubStyle(cfg.accessorySubStyle);
    setNecklineStyle(cfg.necklineStyle);
    setSleeveStyle(cfg.sleeveStyle);
    setTorsoFit(cfg.torsoFit);
    setExtras(cfg.extras);
    setQuickLength(cfg.quickLength);
    setStyleVariant(cfg.styleVariant);
    if (cfg.fabricType) setFabricType(cfg.fabricType);
    if (cfg.apariencia3D) {
      setUsuarioFijoTela3D(false);
      setApariencia3D((prev) => ({
        ...prev,
        color: cfg.apariencia3D!.color,
        tela: cfg.apariencia3D!.tela,
        estampado: cfg.apariencia3D!.estampado,
      }));
    }
    if (cfg.autoPins) {
      setPins(cfg.autoPins);
      setPinsMoved(true);
    } else {
      setPins(getDefaultPinsForCategory(cfg.category));
      setPinsMoved(false);
    }
    setActiveFashionStyleId(null);
    setActivePieceId("all");
  };

  const tracingProportions = useMemo(() => {
    if (mode !== "scanner" || !pinsMoved) return null;
    return solveTracingProportions(pins, category);
  }, [mode, pinsMoved, pins, category]);

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
        jumpsuitSubStyle,
        kidsSubStyle,
        loungewearSubStyle,
        accessorySubStyle,
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
      jumpsuitSubStyle,
      kidsSubStyle,
      loungewearSubStyle,
      accessorySubStyle,
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

  const sewingGuide = useMemo(() => generateSewingGuide(pattern), [pattern]);

  const medidas3D = useMemo(
    () => toMedidas3D(measurements, category),
    [measurements, category]
  );

  const configPrenda3D = useMemo(
    () =>
      toConfigPrenda({
        category,
        topSubStyle,
        pantsSubStyle,
        skirtSubStyle,
        dressSubStyle,
        twoPieceTopStyle,
        twoPieceBottomStyle,
        jumpsuitSubStyle,
        kidsSubStyle,
        loungewearSubStyle,
        accessorySubStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        extras,
        quickLength,
        styleVariant,
        measurements,
        fabricType,
        tracingProportions,
      }),
    [
      category,
      topSubStyle,
      pantsSubStyle,
      skirtSubStyle,
      dressSubStyle,
      twoPieceTopStyle,
      twoPieceBottomStyle,
      jumpsuitSubStyle,
      kidsSubStyle,
      loungewearSubStyle,
      accessorySubStyle,
      necklineStyle,
      sleeveStyle,
      torsoFit,
      extras,
      quickLength,
      styleVariant,
      measurements,
      fabricType,
      tracingProportions,
    ]
  );

  const aparienciaEfectiva3D = useMemo<Apariencia>(() => {
    if (usuarioFijoTela3D) return apariencia3D;
    return {
      ...apariencia3D,
      tela: fabricType === "stretch" ? "licra" : apariencia3D.tela,
    };
  }, [apariencia3D, fabricType, usuarioFijoTela3D]);

  const router = useRouter();
  const [communityRemixNotice, setCommunityRemixNotice] = useState<string | null>(
    null
  );

  const handleApariencia3DChange = useCallback(
    (siguiente: Apariencia) => {
      if (siguiente.tela !== aparienciaEfectiva3D.tela) {
        setUsuarioFijoTela3D(true);
      }
      setApariencia3D(siguiente);
    },
    [aparienciaEfectiva3D.tela]
  );

  const handleApplyCommunityConfig = useCallback(
    (cfg: ConfigMoldeSerializado) => {
      setMode("template");
      setCategory(cfg.category);
      if (cfg.topSubStyle) setTopSubStyle(cfg.topSubStyle);
      if (cfg.pantsSubStyle) setPantsSubStyle(cfg.pantsSubStyle);
      if (cfg.skirtSubStyle) setSkirtSubStyle(cfg.skirtSubStyle);
      if (cfg.dressSubStyle) setDressSubStyle(cfg.dressSubStyle);
      if (cfg.twoPieceTopStyle) setTwoPieceTopStyle(cfg.twoPieceTopStyle);
      if (cfg.twoPieceBottomStyle) setTwoPieceBottomStyle(cfg.twoPieceBottomStyle);
      if (cfg.jumpsuitSubStyle) setJumpsuitSubStyle(cfg.jumpsuitSubStyle);
      if (cfg.kidsSubStyle) setKidsSubStyle(cfg.kidsSubStyle);
      if (cfg.loungewearSubStyle) setLoungewearSubStyle(cfg.loungewearSubStyle);
      if (cfg.accessorySubStyle) setAccessorySubStyle(cfg.accessorySubStyle);
      setNecklineStyle(cfg.necklineStyle);
      setSleeveStyle(cfg.sleeveStyle);
      setTorsoFit(cfg.torsoFit);
      setSeamAllowance(cfg.seamAllowance);
      setFabricType(cfg.fabricType);
      setExtras(cfg.extras);
      setQuickLength(cfg.quickLength);
      setStyleVariant(cfg.styleVariant);
      if (cfg.apariencia3D) {
        setUsuarioFijoTela3D(true);
        setApariencia3D((prev) => ({
          ...prev,
          tela: cfg.apariencia3D!.tela,
          color: cfg.apariencia3D!.color,
          estampado: cfg.apariencia3D!.estampado,
          colorSecundario: cfg.apariencia3D!.colorSecundario ?? prev.colorSecundario,
          acabadoManiqui: cfg.apariencia3D!.acabadoManiqui ?? prev.acabadoManiqui,
        }));
      }
      const perfilesGuardados = loadMeasurementProfiles();
      if (perfilesGuardados.length > 0) {
        setMeasurements((prev) => ({
          ...prev,
          ...perfilesGuardados[0].measurements,
        }));
      }
      setActiveFashionStyleId(null);
      setActivePieceId("all");
      setPins(getDefaultPinsForCategory(cfg.category));
      setPinsMoved(false);
      setOpenStep(2);
      const { prendaLabel } = generarEtiquetasDesdeConfig(cfg);
      setCommunityRemixNotice(
        perfilesGuardados.length > 0
          ? `Molde "${prendaLabel}" cargado desde la comunidad usando tu perfil de medidas "${perfilesGuardados[0].clientName}". Revisa el paso 2 si deseas ajustar algún detalle.`
          : `Molde "${prendaLabel}" cargado desde la comunidad con tus medidas actuales de trabajo (nunca copiamos medidas de otras modistas).`
      );
    },
    []
  );

  const handleCompartirCreacion = useCallback(
    (captura3dUrl?: string) => {
      const cfg = construirConfigMoldeDesdeGenerador({
        category,
        topSubStyle,
        pantsSubStyle,
        skirtSubStyle,
        dressSubStyle,
        twoPieceTopStyle,
        twoPieceBottomStyle,
        jumpsuitSubStyle,
        kidsSubStyle,
        loungewearSubStyle,
        accessorySubStyle,
        necklineStyle,
        sleeveStyle,
        torsoFit,
        seamAllowance,
        fabricType,
        extras,
        quickLength,
        styleVariant,
        apariencia3D: aparienciaEfectiva3D,
      });
      const etiquetas = generarEtiquetasDesdeConfig(cfg);
      guardarBorradorCompartirCreacion({
        ...etiquetas,
        captura3dUrl,
        config_molde: cfg,
        creadoEn: new Date().toISOString(),
      });
      router.push("/comunidad?publicar=1");
    },
    [
      accessorySubStyle,
      aparienciaEfectiva3D,
      category,
      dressSubStyle,
      extras,
      fabricType,
      jumpsuitSubStyle,
      kidsSubStyle,
      loungewearSubStyle,
      necklineStyle,
      pantsSubStyle,
      quickLength,
      router,
      seamAllowance,
      skirtSubStyle,
      sleeveStyle,
      styleVariant,
      topSubStyle,
      torsoFit,
      twoPieceBottomStyle,
      twoPieceTopStyle,
    ]
  );

  useEffect(() => {
    saveLastGeneratedPattern(pattern);
  }, [pattern]);

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
        if (category === "accessories") {
          if (accessorySubStyle === "bucket_hat") {
            return f.key === "headCircumference";
          }
          if (accessorySubStyle === "apron") {
            return f.key === "hip";
          }
          return f.key === "headCircumference";
        }
        if (category === "loungewear" && loungewearSubStyle === "leggings") {
          return ["waist", "hip", "crotchDepth", "thigh", "inseam"].includes(
            f.key
          );
        }
        if (category === "kids") {
          if (kidsSubStyle === "baby_bodysuit") {
            return ["bust", "waist", "hip", "bodiceLength"].includes(f.key);
          }
          if (kidsSubStyle === "kids_dress") {
            return ["bust", "waist", "bodiceLength", "skirtLength"].includes(
              f.key
            );
          }
          return ["waist", "hip", "crotchDepth", "inseam"].includes(f.key);
        }
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
    [
      category,
      dressSubStyle,
      twoPieceBottomStyle,
      loungewearSubStyle,
      kidsSubStyle,
      accessorySubStyle,
    ]
  );

  const adjustMeasurement = (field: MeasurementField, delta: number) => {
    if (field.key === "skirtLength" || field.key === "inseam") {
      setQuickLength("photo");
    }
    setMeasurements((prev) => {
      const curr = prev[field.key] ?? field.min;
      const next = Math.min(field.max, Math.max(field.min, curr + delta));
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

  const showUpperBodyControls =
    category === "top" ||
    category === "dress" ||
    category === "two_piece" ||
    (category === "jumpsuit" && jumpsuitSubStyle !== "overall");

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-slate-800 overflow-x-hidden">
      <Suspense fallback={null}>
        <HomeQueryParamsSync
          onApplyPreset={applyFashionPreset}
          onApplyCommunityConfig={handleApplyCommunityConfig}
          onSelectCategory={(cat) => {
            setCategory(cat);
            setStyleVariant("default");
            setActiveFashionStyleId(null);
            setActivePieceId("all");
            setPins(getDefaultPinsForCategory(cat));
            setPinsMoved(false);
          }}
          onUpdateMeasurements={handleUpdateMeasurementsPatch}
          onSelectMode={setMode}
        />
      </Suspense>

      <SiteHeader
        rightSlot={
          <button
            type="button"
            onClick={() => setIsDownloadModalOpen(true)}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-base font-bold shadow-md flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Descargar PDF (Gratis)</span>
          </button>
        }
      />

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
                    <span>Plantillas / Prendas</span>
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
                      setPins(getDefaultPinsForCategory(cat));
                      setPinsMoved(false);
                    }}
                    topSubStyle={topSubStyle}
                    onTopSubStyleChange={(sub) => {
                      setTopSubStyle(sub);
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
                    jumpsuitSubStyle={jumpsuitSubStyle}
                    onJumpsuitSubStyleChange={(js) => {
                      setJumpsuitSubStyle(js);
                      setActiveFashionStyleId(null);
                      setActivePieceId("all");
                    }}
                    kidsSubStyle={kidsSubStyle}
                    onKidsSubStyleChange={(ks) => {
                      setKidsSubStyle(ks);
                      setActiveFashionStyleId(null);
                      setActivePieceId("all");
                    }}
                    loungewearSubStyle={loungewearSubStyle}
                    onLoungewearSubStyleChange={(lw) => {
                      setLoungewearSubStyle(lw);
                      setActiveFashionStyleId(null);
                      setActivePieceId("all");
                    }}
                    accessorySubStyle={accessorySubStyle}
                    onAccessorySubStyleChange={(ac) => {
                      setAccessorySubStyle(ac);
                      setActiveFashionStyleId(null);
                      setActivePieceId("all");
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
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: "two_piece", label: "Conjunto (2 Piezas)" },
                          { id: "dress", label: "Vestido" },
                          { id: "top", label: "Blusa / Camisa" },
                          { id: "jacket", label: "Chaqueta / Blazer" },
                          { id: "skirt", label: "Falda" },
                          { id: "pants", label: "Pantalón / Short" },
                          { id: "jumpsuit", label: "Enterizos y Overoles" },
                          { id: "kids", label: "Infantil y Bebé" },
                          { id: "loungewear", label: "Deportivo y Pijamas" },
                          { id: "accessories", label: "Accesorios Textiles" },
                        ] as const
                      ).map((cat) => {
                        const isSelected =
                          cat.id === "jacket"
                            ? category === "top" && topSubStyle === "jacket"
                            : cat.id === "top"
                              ? category === "top" && topSubStyle !== "jacket"
                              : category === cat.id;

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              const nextCat: GarmentCategory =
                                cat.id === "jacket" ? "top" : cat.id;
                              setCategory(nextCat);
                              if (cat.id === "jacket") {
                                setTopSubStyle("jacket");
                                setNecklineStyle("tailored_lapel");
                              } else if (cat.id === "top" && topSubStyle === "jacket") {
                                setTopSubStyle("blouse");
                              }
                              setStyleVariant("default");
                              setActiveFashionStyleId(null);
                              setActivePieceId("all");
                              setPins(getDefaultPinsForCategory(nextCat));
                              setPinsMoved(false);
                            }}
                            className={`min-h-[48px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                              isSelected
                                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
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
                            <option value="jacket">Chaqueta / Blazer</option>
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
                            <option value="jumpsuit">Enterizo / Mono clásico</option>
                          </select>
                        )}
                        {category === "two_piece" && (
                          <div className="space-y-2.5">
                            <select
                              value={twoPieceTopStyle}
                              onChange={(e) => {
                                const nextTop = e.target.value as TwoPieceTopStyle;
                                setTwoPieceTopStyle(nextTop);
                                if (nextTop === "jacket_blazer") {
                                  setNecklineStyle("tailored_lapel");
                                }
                              }}
                              className="w-full min-h-[48px] rounded-xl bg-[#FAF8F5] border border-slate-300 px-3 text-base text-slate-800"
                            >
                              <option value="crop_top">
                                Arriba: Top corto (Crop top)
                              </option>
                              <option value="waist_blouse">
                                Arriba: Blusa a la cintura
                              </option>
                              <option value="jacket_blazer">
                                Arriba: Chaqueta / Blazer
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
                        {category === "jumpsuit" && (
                          <div className="grid grid-cols-1 gap-2">
                            {(
                              [
                                {
                                  id: "romper_long",
                                  label: "Enterizo Largo (+3 cm holgura tiro)",
                                },
                                {
                                  id: "romper_short",
                                  label: "Enterizo Corto / Romper (+3 cm tiro)",
                                },
                                {
                                  id: "overall",
                                  label: "Overol / Jardinera (Pechera + Tirantes)",
                                },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setJumpsuitSubStyle(opt.id);
                                  setActivePieceId("all");
                                }}
                                className={`min-h-[46px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                                  jumpsuitSubStyle === opt.id
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {category === "kids" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2">
                              {(
                                [
                                  {
                                    id: "baby_bodysuit",
                                    label: "Pelele / Body de Bebé (curva pañal)",
                                  },
                                  {
                                    id: "kids_dress",
                                    label: "Vestido Infantil Evasé (1 a 10 años)",
                                  },
                                  {
                                    id: "kids_pants",
                                    label: "Pantalón Infantil con Elástico",
                                  },
                                ] as const
                              ).map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setKidsSubStyle(opt.id);
                                    setActivePieceId("all");
                                  }}
                                  className={`min-h-[46px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                                    kidsSubStyle === opt.id
                                      ? "bg-teal-600 text-white border-teal-600"
                                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                              <span className="block text-xs font-bold text-amber-900">
                                Tallas rápidas infantiles (1 clic):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {KIDS_SIZE_PRESETS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() =>
                                      setMeasurements((prev) => ({
                                        ...prev,
                                        ...preset.measurements,
                                      }))
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-xs font-bold text-amber-950 cursor-pointer"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {category === "loungewear" && (
                          <div className="grid grid-cols-1 gap-2">
                            {(
                              [
                                {
                                  id: "leggings",
                                  label:
                                    "Leggings / Licra Deportiva (1 pieza envolvente)",
                                },
                                {
                                  id: "classic_pajama",
                                  label:
                                    "Pijama Clásica (Camisa holgada + Pantalón)",
                                },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setLoungewearSubStyle(opt.id);
                                  setActivePieceId("all");
                                  if (opt.id === "leggings") {
                                    setFabricType("stretch");
                                  }
                                }}
                                className={`min-h-[46px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                                  loungewearSubStyle === opt.id
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {category === "accessories" && (
                          <div className="grid grid-cols-1 gap-2">
                            {(
                              [
                                {
                                  id: "bucket_hat",
                                  label:
                                    "Sombrero Pescador (Bucket Hat — 3 piezas)",
                                },
                                {
                                  id: "apron",
                                  label: "Delantal de Cocina / Taller",
                                },
                                {
                                  id: "zipper_pouch",
                                  label:
                                    "Neceser / Cartuchera con Fuelle en Caja",
                                },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setAccessorySubStyle(opt.id);
                                  setActivePieceId("all");
                                }}
                                className={`min-h-[46px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                                  accessorySubStyle === opt.id
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {showUpperBodyControls && (
                        <>
                          <NecklineCollarSelector
                            heading="Cuello, Escote o Solapa"
                            necklineStyle={necklineStyle}
                            onNecklineStyleChange={setNecklineStyle}
                          />

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

                      {category !== "accessories" && (
                        <>
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
                        </>
                      )}
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
                    {category === "accessories"
                      ? `Contorno cabeza ${measurements.headCircumference ?? 57} cm`
                      : category === "pants" || category === "skirt" || (category === "loungewear" && loungewearSubStyle === "leggings")
                        ? `Cintura ${measurements.waist} • Cadera ${measurements.hip} cm`
                        : `Busto ${measurements.bust} • Cintura ${measurements.waist} • Cadera ${measurements.hip} cm`}
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
                {/* Smart Bézier stabilization notice when disproportionate numbers are entered */}
                {pattern.seamValidation?.stabilizedNotes &&
                  pattern.seamValidation.stabilizedNotes.length > 0 && (
                    <div
                      data-testid="smart-bounds-notice"
                      className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs font-medium text-amber-900 space-y-1"
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                        Protección automática de curvas Bézier activa:
                      </div>
                      {pattern.seamValidation.stabilizedNotes.map((note, idx) => (
                        <p key={idx}>• {note}</p>
                      ))}
                    </div>
                  )}

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
                            value={measurements[field.key] ?? field.min}
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

                {/* Optional Pro Measurements ("Modo Taller") Accordion */}
                {category !== "accessories" && (
                  <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowProMeasurements((s) => !s)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/60 transition cursor-pointer"
                    >
                      <div>
                        <span className="block text-sm font-bold text-slate-800">
                          Medidas Avanzadas — Modo Taller (Opcional)
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          Auto-calculadas si se dejan vacías (talle del., pinza busto, bíceps)
                        </span>
                      </div>
                      {showProMeasurements ? (
                        <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                      )}
                    </button>

                    {showProMeasurements && (
                      <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200 space-y-2.5">
                        {(() => {
                          const autoPro = resolveProMeasurements(measurements);
                          const proFields: Array<{
                            key: keyof Pick<
                              Measurements,
                              | "frontBodiceLength"
                              | "bustHeight"
                              | "bustSeparation"
                              | "bicep"
                              | "wrist"
                              | "hipHeight"
                            >;
                            label: string;
                            autoVal: number;
                            min: number;
                            max: number;
                            show: boolean;
                          }> = [
                            {
                              key: "frontBodiceLength",
                              label: "Talle delantero",
                              autoVal: autoPro.frontBodiceLength,
                              min: 24,
                              max: 62,
                              show: showUpperBodyControls,
                            },
                            {
                              key: "bustHeight",
                              label: "Altura de busto",
                              autoVal: autoPro.bustHeight,
                              min: 16,
                              max: 42,
                              show: showUpperBodyControls,
                            },
                            {
                              key: "bustSeparation",
                              label: "Separación de busto",
                              autoVal: autoPro.bustSeparation,
                              min: 12,
                              max: 30,
                              show: showUpperBodyControls,
                            },
                            {
                              key: "bicep",
                              label: "Contorno de bíceps",
                              autoVal: autoPro.bicep,
                              min: 18,
                              max: 56,
                              show: showUpperBodyControls,
                            },
                            {
                              key: "wrist",
                              label: "Contorno de puño",
                              autoVal: autoPro.wrist,
                              min: 13,
                              max: 28,
                              show: showUpperBodyControls,
                            },
                            {
                              key: "hipHeight",
                              label: "Alto de cadera",
                              autoVal: autoPro.hipHeight,
                              min: 12,
                              max: 28,
                              show: true,
                            },
                          ];
                          return (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {proFields
                                  .filter((pf) => pf.show)
                                  .map((pf) => (
                                    <div
                                      key={pf.key}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200"
                                    >
                                      <label
                                        htmlFor={`pro-${pf.key}`}
                                        className="text-xs font-semibold text-slate-700"
                                      >
                                        {pf.label}
                                      </label>
                                      <div className="flex items-center gap-1">
                                        <input
                                          id={`pro-${pf.key}`}
                                          type="number"
                                          step="0.5"
                                          min={pf.min}
                                          max={pf.max}
                                          placeholder={String(pf.autoVal)}
                                          value={measurements[pf.key] ?? ""}
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            setMeasurements({
                                              ...measurements,
                                              [pf.key]:
                                                raw === "" ? undefined : Number(raw),
                                            });
                                          }}
                                          className="w-14 text-right text-xs font-bold text-slate-900 focus:outline-none"
                                        />
                                        <span className="text-[11px] text-slate-400">
                                          cm
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setMeasurements({
                                    ...measurements,
                                    frontBodiceLength: undefined,
                                    bustHeight: undefined,
                                    bustSeparation: undefined,
                                    bicep: undefined,
                                    wrist: undefined,
                                    hipHeight: undefined,
                                  })
                                }
                                className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                              >
                                Restablecer valores automáticos
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {category !== "accessories" && (
                  <QuickLengthSelector
                    quickLength={quickLength}
                    onQuickLengthChange={setQuickLength}
                  />
                )}

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
                {showUpperBodyControls && (
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
                    {paperFormat === "projector"
                      ? "Proyector • 1 lámina continua"
                      : `${paperFormat === "letter" ? "Carta" : paperFormat === "a4" ? "A4" : "Ploter A0"} • ${totalSheetPages} hoja(s)`}
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
              {/* Paper Size Visual Selector (4 formatos profesionales) */}
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
                    {
                      id: "a0",
                      title: "Ploter A0",
                      sub: "84.1 × 118.9 cm",
                    },
                    {
                      id: "projector",
                      title: "Proyector",
                      sub: "Sin cortes • Alto contraste",
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
                    <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold">
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
                    {paperFormat === "projector"
                      ? "1 lámina continua"
                      : `${totalSheetPages} hojas`}
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

              <button
                type="button"
                onClick={() => exportPatternToSvg(pattern, seamAllowance)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#FAF8F5] hover:bg-slate-100 border border-slate-300 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="h-4 w-4 text-teal-700" />
                Descargar SVG 1:1 (Ploter / Cricut)
              </button>
            </div>
          </section>

          {/* LOCATION 2: Box Ad (300x250) at bottom of Left Panel */}
          <div className="pt-1 w-full flex justify-center">
            <AdBanner variant="box-ad" adSlotId="sidebar-box-300x250" />
          </div>
        </aside>

        {/* RIGHT COLUMN: Selector de vista (2D / 3D / Dividida) + Canvas + Sewing Guide */}
        <section className="min-w-0 lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2D6C8] bg-[#FAF6F0] px-2.5 py-2 shadow-xs">
            <div
              role="tablist"
              aria-label="Modo de visualización del patrón y simulador 3D"
              className="inline-flex flex-wrap items-center gap-1.5"
            >
              {(
                [
                  {
                    id: "2d" as const,
                    label: "📐 Molde 2D (Imprimir)",
                  },
                  {
                    id: "3d" as const,
                    label: "👗 Probador 3D",
                  },
                  {
                    id: "dividida" as const,
                    label: "👯 Vista Dividida",
                  },
                ] as const
              ).map((tab, idx, arr) => {
                const seleccionado = vistaPatron === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    role="tab"
                    id={`tab-vista-${tab.id}`}
                    aria-selected={seleccionado}
                    aria-controls={`panel-vista-${tab.id}`}
                    tabIndex={seleccionado ? 0 : -1}
                    type="button"
                    onClick={() => setVistaPatron(tab.id)}
                    onKeyDown={(e) => {
                      let nextIdx = -1;
                      if (e.key === "ArrowRight") nextIdx = (idx + 1) % arr.length;
                      else if (e.key === "ArrowLeft")
                        nextIdx = (idx - 1 + arr.length) % arr.length;
                      else if (e.key === "Home") nextIdx = 0;
                      else if (e.key === "End") nextIdx = arr.length - 1;
                      if (nextIdx >= 0) {
                        e.preventDefault();
                        setVistaPatron(arr[nextIdx].id);
                        tabRefs.current[nextIdx]?.focus();
                      }
                    }}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] focus-visible:ring-offset-1 ${
                      seleccionado
                        ? "text-white shadow-sm border border-[#9E3E1C]"
                        : "text-[#2D2A26] bg-white/80 hover:bg-[#EFE6DA] border border-[#E2D6C8]"
                    }`}
                    style={
                      seleccionado
                        ? { backgroundColor: "#B34720" }
                        : undefined
                    }
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {vistaPatron === "dividida" && !esPantallaAncha && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5C554E] px-2">
                  <Columns2 className="w-3.5 h-3.5 text-[#C85A32]" />
                  Vista única automática en móvil
                </span>
              )}
              <button
                type="button"
                onClick={() => handleCompartirCreacion()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#3B7A57] hover:bg-[#2F6647] text-white text-xs sm:text-sm font-extrabold shadow-xs inline-flex items-center gap-1.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57] focus-visible:ring-offset-1"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartir mi creación</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/comunidad?tab=encargos")}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FFF5EE] hover:bg-[#FCE8DB] border border-[#E5B8A0] text-[#8A3112] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Shirt className="w-4 h-4" />
                <span>Pedir a una modista</span>
              </button>
            </div>
          </div>

          {ajusteSugeridoPreview && (
            <div
              role="region"
              aria-label="Sugerencia comunitaria de ajuste"
              className="rounded-2xl bg-[#FFF9F2] border border-[#E5C9A8] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#2D2A26]"
            >
              <div>
                <strong>Sugerencia comunitaria opcional (k≥5):</strong> algunas modistas recomiendan{" "}
                <strong>
                  {ajusteSugeridoPreview.cmDelta > 0 ? `+${ajusteSugeridoPreview.cmDelta}` : ajusteSugeridoPreview.cmDelta} cm
                </strong>{" "}
                en zona <strong>{ajusteSugeridoPreview.zona}</strong>. Nunca se aplica sin tu confirmación.
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVistaPatron("dividida");
                    setCommunityRemixNotice(
                      `Vista comparativa lista para probar tu ajuste sugerido en ${ajusteSugeridoPreview.zona} (${ajusteSugeridoPreview.cmDelta} cm) sin sobrescribir tus medidas.`
                    );
                    setAjusteSugeridoPreview(null);
                  }}
                  className="min-h-[36px] px-3 rounded-lg bg-[#B34720] text-white font-extrabold cursor-pointer"
                >
                  Previsualizar en 2D/3D
                </button>
                <button
                  type="button"
                  onClick={() => setAjusteSugeridoPreview(null)}
                  className="min-h-[36px] px-3 rounded-lg bg-white border border-[#E2D6C8] font-bold cursor-pointer"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          {communityRemixNotice && (
            <div
              role="status"
              className="rounded-2xl bg-[#3B7A57]/10 border border-[#3B7A57]/30 px-4 py-3 flex items-start justify-between gap-3 text-xs sm:text-sm text-[#28593D] font-semibold"
            >
              <span>{communityRemixNotice}</span>
              <button
                type="button"
                onClick={() => setCommunityRemixNotice(null)}
                className="shrink-0 min-h-[32px] px-2.5 rounded-lg bg-white border border-[#3B7A57]/30 text-xs font-extrabold text-[#28593D] hover:bg-[#FAF6F0] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}

          <div
            role="tabpanel"
            id={`panel-vista-${vistaPatron}`}
            aria-labelledby={`tab-vista-${vistaPatron}`}
            className="flex-1 min-h-[540px]"
          >
            {vistaPatron === "2d" && (
              <PatternCanvas
                pattern={pattern}
                seamAllowance={seamAllowance}
                paperFormat={paperFormat}
                activePieceId={activePieceId}
                onActivePieceIdChange={setActivePieceId}
                showSheetGrid={showSheetGrid}
                onToggleSheetGrid={() => setShowSheetGrid((s) => !s)}
              />
            )}

            {(vistaPatron === "3d" ||
              (vistaPatron === "dividida" && !esPantallaAncha)) && (
              modoAhorroDatos && !permitir3DEnAhorro ? (
                <div className="rounded-3xl bg-[#FAF6F0] border border-[#E2D6C8] p-8 text-center space-y-3">
                  <p className="text-sm font-extrabold text-[#2D2A26]">
                    Modo Ahorro de Datos detectado
                  </p>
                  <p className="text-xs text-[#5C554E] max-w-md mx-auto">
                    Pospusimos la descarga del probador 3D para ahorrar tus megas. Tu
                    molde 2D e impresión PDF siguen disponibles al 100%.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPermitir3DEnAhorro(true)}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Ver en 3D ahora
                  </button>
                </div>
              ) : (
                <Garment3DPreview
                  medidas={medidas3D}
                  config={configPrenda3D}
                  apariencia={aparienciaEfectiva3D}
                  onAparienciaChange={handleApariencia3DChange}
                  patternPieces={pattern.pieces}
                  activePieceId={activePieceId}
                  onActivePieceIdChange={setActivePieceId}
                  onCompartirCreacion={handleCompartirCreacion}
                />
              )
            )}

            {vistaPatron === "dividida" && esPantallaAncha && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <div className="min-h-[560px]">
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
                <div className="min-h-[560px]">
                  <Garment3DPreview
                    medidas={medidas3D}
                    config={configPrenda3D}
                    apariencia={aparienciaEfectiva3D}
                    onAparienciaChange={handleApariencia3DChange}
                    modoCompacto
                    patternPieces={pattern.pieces}
                    activePieceId={activePieceId}
                    onActivePieceIdChange={setActivePieceId}
                    onCompartirCreacion={handleCompartirCreacion}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Step-by-Step Sewing Guide & Fabric Recommendations */}
          <div
            data-testid="sewing-guide-card"
            className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {sewingGuide.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nivel: {sewingGuide.difficulty} • Incluida también en tu PDF
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-slate-200">
                <span className="block text-xs font-extrabold uppercase tracking-wide text-teal-800 mb-1">
                  Telas recomendadas
                </span>
                <ul className="space-y-1 text-slate-700">
                  {sewingGuide.recommendedFabrics.map((fab, i) => (
                    <li key={i}>• {fab}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-slate-200">
                <span className="block text-xs font-extrabold uppercase tracking-wide text-rose-800 mb-1">
                  Insumos sugeridos
                </span>
                <ul className="space-y-1 text-slate-700">
                  {sewingGuide.notions.map((not, i) => (
                    <li key={i}>• {not}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-sm text-slate-700">
              <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Orden de armado paso a paso
              </span>
              {sewingGuide.steps.map((step, i) => (
                <p key={i} className="leading-snug">
                  {step}
                </p>
              ))}
            </div>
          </div>

          {/* Ficha Técnica: Medidas Terminadas, Validación de Costuras y Plano de Corte */}
          <div
            data-testid="technical-spec-card"
            className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Ficha Técnica, Auditoría de Costuras y Plano de Corte (140 cm)
                </h3>
                <p className="text-xs text-slate-500">
                  Márgenes por borde: Doblez 0 cm • Curvas/Sisas 1 cm • Costados {seamAllowance} cm • Ruedo 3 cm
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  pattern.seamValidation?.verified
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {pattern.seamValidation?.verified ? "Empate exacto verificado" : "Revisar tolerancias"}
              </span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Tabla Cuerpo vs Prenda Terminada */}
              {pattern.finishedMeasurements && pattern.finishedMeasurements.length > 0 && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-700 border-b border-slate-200">
                    Medidas de la Prenda Terminada
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="grid grid-cols-4 px-3.5 py-2 font-bold text-slate-500 bg-white">
                      <span className="col-span-1">Zona</span>
                      <span className="text-right">Cuerpo</span>
                      <span className="text-right">Holgura</span>
                      <span className="text-right">Terminada</span>
                    </div>
                    {pattern.finishedMeasurements.map((fm, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-4 px-3.5 py-2 text-slate-700 bg-white"
                      >
                        <span className="font-semibold text-slate-900">{fm.label}</span>
                        <span className="text-right">{fm.bodyCm} cm</span>
                        <span className="text-right text-teal-700 font-semibold">
                          {fm.easeCm >= 0 ? `+${fm.easeCm}` : fm.easeCm} cm
                        </span>
                        <span className="text-right font-extrabold text-slate-900">
                          {fm.finishedCm} cm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verificación real de costuras */}
              {pattern.seamValidation?.checks && pattern.seamValidation.checks.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-3.5 space-y-2">
                  <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-700">
                    Comprobación Geométrica de Costuras
                  </span>
                  <div className="space-y-1.5">
                    {pattern.seamValidation.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="flex items-start justify-between gap-2 text-xs bg-white rounded-xl px-3 py-2 border border-slate-200"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{chk.label}</div>
                          <div className="text-slate-500">{chk.detail}</div>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full font-bold ${
                            chk.passed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {chk.passed ? "OK" : `${chk.diffMm} mm`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Visual Cutting Layout on 140 cm fabric */}
            {pattern.cuttingLayout && pattern.cuttingLayout.items.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold uppercase tracking-wide text-slate-700">
                    Plano de Corte Sugerido ({pattern.cuttingLayout.openWidthUsed ? "Tela abierta 140 cm" : "Tela doblada (70 cm útil)"})
                  </span>
                  <span className="font-bold text-teal-800">
                    Largo usado: {pattern.cuttingLayout.usedLengthCm} cm ({pattern.fabricConsumption.width140m.toFixed(2)} m)
                  </span>
                </div>
                <svg
                  viewBox={`0 0 ${Math.max(80, pattern.cuttingLayout.usedLengthCm)} ${pattern.cuttingLayout.foldedWidthCm}`}
                  className="w-full h-36 bg-white rounded-xl border border-slate-200"
                >
                  <line
                    x1={0}
                    y1={0.5}
                    x2={Math.max(80, pattern.cuttingLayout.usedLengthCm)}
                    y2={0.5}
                    stroke="#E11D48"
                    strokeWidth="0.9"
                    strokeDasharray="3 1.5"
                  />
                  {pattern.cuttingLayout.items.map((item, idx) => (
                    <g key={`${item.pieceId}-${item.copyIndex}-${idx}`}>
                      <rect
                        x={item.y}
                        y={item.x}
                        width={item.h}
                        height={item.w}
                        fill="#F5EFE3"
                        stroke="#334155"
                        strokeWidth="0.45"
                        rx="0.6"
                      />
                      {item.h > 12 && item.w > 7 && (
                        <text
                          x={item.y + item.h / 2}
                          y={item.x + item.w / 2}
                          fontSize="3.4"
                          fontWeight="bold"
                          fill="#0F172A"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {item.label}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            )}
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
        paperLabel={
          paperFormat === "letter"
            ? "Carta"
            : paperFormat === "a4"
              ? "A4"
              : paperFormat === "a0"
                ? "Ploter A0"
                : "Proyector"
        }
        pageCount={paperFormat === "projector" ? 1 : totalSheetPages + 2}
      />
    </div>
  );
}
