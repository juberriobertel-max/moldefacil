"use client";

import React, { useRef, useState } from "react";
import { Upload, Camera, RotateCcw, Sparkles, Loader2, Crop } from "lucide-react";
import {
  AccessorySubStyle,
  GarmentCategory,
  GarmentExtras,
  JumpsuitSubStyle,
  KidsSubStyle,
  LoungewearSubStyle,
  NecklineStyle,
  PantsSubStyle,
  QuickLengthPreset,
  SkirtSubStyle,
  SleeveStyle,
  TopSubStyle,
  TorsoFit,
  TracingPins,
  TwoPieceBottomStyle,
  TwoPieceTopStyle,
} from "@/lib/types";
import { getDefaultPinsForCategory } from "@/lib/proportionSolver";
import {
  DetectedGarmentConfig,
  detectFashionStyleInBrowser,
} from "@/lib/browserStyleDetector";
import {
  GarmentExtrasSelector,
  NecklineCollarSelector,
  QuickLengthSelector,
} from "@/components/GarmentDetailsPanel";
import ImageCalibrator from "@/components/ImageCalibrator";

interface SmartGarmentScannerProps {
  pins: TracingPins;
  onPinsChange: (pins: TracingPins) => void;
  category: GarmentCategory;
  onCategoryChange: (cat: GarmentCategory) => void;
  topSubStyle: TopSubStyle;
  onTopSubStyleChange: (style: TopSubStyle) => void;
  necklineStyle: NecklineStyle;
  onNecklineStyleChange: (style: NecklineStyle) => void;
  sleeveStyle: SleeveStyle;
  onSleeveStyleChange: (style: SleeveStyle) => void;
  torsoFit: TorsoFit;
  onTorsoFitChange: (fit: TorsoFit) => void;
  skirtSubStyle: SkirtSubStyle;
  onSkirtSubStyleChange: (style: SkirtSubStyle) => void;
  pantsSubStyle: PantsSubStyle;
  onPantsSubStyleChange: (style: PantsSubStyle) => void;
  twoPieceTopStyle: TwoPieceTopStyle;
  onTwoPieceTopStyleChange: (style: TwoPieceTopStyle) => void;
  twoPieceBottomStyle: TwoPieceBottomStyle;
  onTwoPieceBottomStyleChange: (style: TwoPieceBottomStyle) => void;
  jumpsuitSubStyle?: JumpsuitSubStyle;
  onJumpsuitSubStyleChange?: (style: JumpsuitSubStyle) => void;
  kidsSubStyle?: KidsSubStyle;
  onKidsSubStyleChange?: (style: KidsSubStyle) => void;
  loungewearSubStyle?: LoungewearSubStyle;
  onLoungewearSubStyleChange?: (style: LoungewearSubStyle) => void;
  accessorySubStyle?: AccessorySubStyle;
  onAccessorySubStyleChange?: (style: AccessorySubStyle) => void;
  extras: GarmentExtras;
  onExtrasChange: (extras: GarmentExtras) => void;
  quickLength: QuickLengthPreset;
  onQuickLengthChange: (preset: QuickLengthPreset) => void;
  onApplyDetectedAttributes: (config: DetectedGarmentConfig) => void;
}

type PinKey = keyof TracingPins;

interface PinConfig {
  key: PinKey;
  label: string;
  color: string;
  num: number;
  labelSide?: "left" | "right";
}

const PANTS_PINS: PinConfig[] = [
  { key: "waist", label: "Cintura", color: "#0284C7", num: 1, labelSide: "left" },
  { key: "hip", label: "Cadera", color: "#7C3AED", num: 2, labelSide: "left" },
  { key: "crotch", label: "Tiro (Entrepierna)", color: "#E11D48", num: 3, labelSide: "right" },
  { key: "hem", label: "Largo Bota", color: "#0D9488", num: 4, labelSide: "left" },
];

const SKIRT_PINS: PinConfig[] = [
  { key: "waist", label: "Cintura", color: "#0284C7", num: 1, labelSide: "left" },
  { key: "hip", label: "Cadera", color: "#7C3AED", num: 2, labelSide: "left" },
  { key: "hem", label: "Largo Ruedo", color: "#0D9488", num: 3, labelSide: "left" },
];

const TOP_PINS: PinConfig[] = [
  { key: "shoulder", label: "Hombro", color: "#D97706", num: 1, labelSide: "left" },
  { key: "neckline", label: "Cuello / Escote", color: "#E11D48", num: 2, labelSide: "right" },
  { key: "armhole", label: "Sisa", color: "#0284C7", num: 3, labelSide: "left" },
  { key: "hem", label: "Largo Cintura/Cadera", color: "#0D9488", num: 4, labelSide: "left" },
];

const DRESS_PINS: PinConfig[] = [
  { key: "shoulder", label: "Hombro", color: "#D97706", num: 1, labelSide: "left" },
  { key: "neckline", label: "Cuello / Escote", color: "#E11D48", num: 2, labelSide: "right" },
  { key: "waist", label: "Cintura", color: "#0284C7", num: 3, labelSide: "right" },
  { key: "hip", label: "Cadera", color: "#7C3AED", num: 4, labelSide: "right" },
  { key: "hem", label: "Largo Ruedo", color: "#0D9488", num: 5, labelSide: "right" },
];

const TWO_PIECE_PINS: PinConfig[] = [
  { key: "shoulder", label: "Hombro", color: "#D97706", num: 1, labelSide: "left" },
  { key: "neckline", label: "Cuello / Escote", color: "#E11D48", num: 2, labelSide: "right" },
  { key: "topEnd", label: "Fin del Top", color: "#EA580C", num: 3, labelSide: "right" },
  {
    key: "bottomStart",
    label: "Inicio Falda/Pant.",
    color: "#0284C7",
    num: 4,
    labelSide: "right",
  },
  { key: "hip", label: "Cadera", color: "#7C3AED", num: 5, labelSide: "right" },
  { key: "hem", label: "Largo Bota/Ruedo", color: "#0D9488", num: 6, labelSide: "right" },
];

function getPinsForCategory(
  cat: GarmentCategory,
  loungewearSubStyle: LoungewearSubStyle = "leggings"
): PinConfig[] {
  switch (cat) {
    case "pants":
      return PANTS_PINS;
    case "loungewear":
      return loungewearSubStyle === "leggings" ? PANTS_PINS : TWO_PIECE_PINS;
    case "skirt":
    case "accessories":
      return SKIRT_PINS;
    case "top":
      return TOP_PINS;
    case "two_piece":
      return TWO_PIECE_PINS;
    case "jumpsuit":
    case "kids":
    case "dress":
    default:
      return DRESS_PINS;
  }
}

function createSamplePhoto(
  kind: "dress" | "pants" | "blouse" | "two_piece"
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#F5F2EC";
  ctx.fillRect(0, 0, 360, 480);

  if (kind === "dress") {
    ctx.fillStyle = "#E11D48";
    ctx.beginPath();
    ctx.moveTo(145, 62);
    ctx.quadraticCurveTo(180, 108, 215, 62);
    ctx.lineTo(245, 70);
    ctx.lineTo(235, 145);
    ctx.lineTo(215, 210);
    ctx.lineTo(246, 285);
    ctx.lineTo(282, 420);
    ctx.quadraticCurveTo(180, 434, 78, 420);
    ctx.lineTo(114, 285);
    ctx.lineTo(145, 210);
    ctx.lineTo(125, 145);
    ctx.lineTo(115, 70);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "two_piece") {
    ctx.fillStyle = "#E11D48";
    ctx.beginPath();
    ctx.moveTo(145, 62);
    ctx.quadraticCurveTo(180, 104, 215, 62);
    ctx.lineTo(246, 70);
    ctx.lineTo(234, 145);
    ctx.lineTo(224, 182);
    ctx.lineTo(136, 182);
    ctx.lineTo(126, 145);
    ctx.lineTo(114, 70);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0F766E";
    ctx.beginPath();
    ctx.moveTo(134, 216);
    ctx.lineTo(226, 216);
    ctx.lineTo(252, 290);
    ctx.lineTo(286, 422);
    ctx.quadraticCurveTo(180, 434, 74, 422);
    ctx.lineTo(108, 290);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "pants") {
    ctx.fillStyle = "#0F766E";
    ctx.beginPath();
    ctx.moveTo(118, 56);
    ctx.lineTo(242, 56);
    ctx.lineTo(260, 170);
    ctx.lineTo(246, 426);
    ctx.lineTo(192, 426);
    ctx.lineTo(180, 210);
    ctx.lineTo(168, 426);
    ctx.lineTo(114, 426);
    ctx.lineTo(100, 170);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#1E293B";
    ctx.beginPath();
    ctx.moveTo(146, 68);
    ctx.quadraticCurveTo(180, 114, 214, 68);
    ctx.lineTo(248, 78);
    ctx.lineTo(312, 210);
    ctx.lineTo(278, 226);
    ctx.lineTo(236, 150);
    ctx.lineTo(230, 325);
    ctx.lineTo(130, 325);
    ctx.lineTo(124, 150);
    ctx.lineTo(82, 226);
    ctx.lineTo(48, 210);
    ctx.lineTo(112, 78);
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
}

/* ---------- Minimalist Schematic SVG Icons for Part Cards ---------- */
function GarmentIcon({ type }: { type: GarmentCategory | "jacket" }) {
  if (type === "jacket") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
        <path d="M14 6 L6 11 L4 24 L9 25 L11 16 L11 34 L29 34 L29 16 L31 25 L36 24 L34 11 L26 6" />
        <path d="M14 6 L17 14 L14 16 L20 22 L20 34" />
        <path d="M26 6 L23 14 L26 16 L20 22" />
      </svg>
    );
  }
  if (type === "jumpsuit") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
        <path d="M14 5 L26 5 L29 16 L29 35 L22 35 L20 22 L18 35 L11 35 L11 16 Z" />
        <line x1="11" y1="17" x2="29" y2="17" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "kids") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
        <path d="M15 7 C18 10, 22 10, 25 7 L32 12 L29 17 L26 15 L26 26 C26 30, 23 34, 20 34 C17 34, 14 30, 14 26 L14 15 L11 17 L8 12 Z" />
      </svg>
    );
  }
  if (type === "loungewear") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
        <path d="M13 6 L27 6 L28 35 L22 35 L20 16 L18 35 L12 35 Z" />
        <line x1="13" y1="10" x2="27" y2="10" />
      </svg>
    );
  }
  if (type === "accessories") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round">
        <path d="M13 12 C15 9, 25 9, 27 12 L29 22 L11 22 Z" />
        <path d="M5 24 C14 21, 26 21, 35 24 C27 29, 13 29, 5 24 Z" />
      </svg>
    );
  }
  if (type === "top") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M14 7 C17 11, 23 11, 26 7 L34 11 L31 19 L27 17 L27 33 L13 33 L13 17 L9 19 L6 11 Z" />
      </svg>
    );
  }
  if (type === "dress") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M15 6 C18 10, 22 10, 25 6 L29 9 L26 18 L32 34 L8 34 L14 18 L11 9 Z" />
        <line x1="14" y1="18" x2="26" y2="18" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "two_piece") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M15 5 C18 9, 22 9, 25 5 L30 8 L27 16 L13 16 L10 8 Z" />
        <path d="M13 21 L27 21 L32 35 L8 35 Z" />
      </svg>
    );
  }
  if (type === "skirt") {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M13 8 L27 8 L33 33 L7 33 Z" />
        <line x1="13" y1="11" x2="27" y2="11" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 7 L28 7 L30 34 L22 34 L20 18 L18 34 L10 34 Z" />
    </svg>
  );
}

function SleeveIcon({ style }: { style: SleeveStyle }) {
  return (
    <svg viewBox="0 0 40 32" className="w-8 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      {style === "sleeveless" && (
        <path d="M13 6 L27 6 L29 14 L27 28 L13 28 L11 14 Z" />
      )}
      {style === "short" && (
        <path d="M14 6 L26 6 L35 13 L31 19 L27 16 L27 28 L13 28 L13 16 L9 19 L5 13 Z" />
      )}
      {style === "long" && (
        <path d="M14 6 L26 6 L37 24 L32 26 L26 15 L26 28 L14 28 L14 15 L8 26 L3 24 Z" />
      )}
      {style === "kimono" && (
        <path d="M14 6 L26 6 L37 14 L35 22 C30 21, 27 21, 26 28 L14 28 C13 21, 10 21, 5 22 L3 14 Z" />
      )}
    </svg>
  );
}

function SkirtBottomIcon({ style }: { style: SkirtSubStyle }) {
  return (
    <svg viewBox="0 0 40 32" className="w-8 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      {style === "straight" && <path d="M12 5 L28 5 L28 28 L12 28 Z" />}
      {style === "a_line" && <path d="M13 5 L27 5 L32 28 L8 28 Z" />}
      {style === "semicircular" && (
        <path d="M14 5 L26 5 L36 26 Q20 31 4 26 Z" />
      )}
    </svg>
  );
}

function PantsBottomIcon({ style }: { style: PantsSubStyle }) {
  return (
    <svg viewBox="0 0 40 32" className="w-8 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      {style === "straight" && (
        <path d="M12 4 L28 4 L29 28 L22 28 L20 15 L18 28 L11 28 Z" />
      )}
      {style === "wide" && (
        <path d="M13 4 L27 4 L34 28 L22 28 L20 15 L18 28 L6 28 Z" />
      )}
      {style === "shorts" && (
        <path d="M12 4 L28 4 L30 18 L22 18 L20 13 L18 18 L10 18 Z" />
      )}
    </svg>
  );
}

export default function SmartGarmentScanner({
  pins,
  onPinsChange,
  category,
  onCategoryChange,
  topSubStyle,
  onTopSubStyleChange,
  necklineStyle,
  onNecklineStyleChange,
  sleeveStyle,
  onSleeveStyleChange,
  torsoFit,
  onTorsoFitChange,
  skirtSubStyle,
  onSkirtSubStyleChange,
  pantsSubStyle,
  onPantsSubStyleChange,
  twoPieceTopStyle,
  onTwoPieceTopStyleChange,
  twoPieceBottomStyle,
  onTwoPieceBottomStyleChange,
  jumpsuitSubStyle = "romper_long",
  onJumpsuitSubStyleChange,
  kidsSubStyle = "baby_bodysuit",
  onKidsSubStyleChange,
  loungewearSubStyle = "leggings",
  onLoungewearSubStyleChange,
  accessorySubStyle = "bucket_hat",
  onAccessorySubStyleChange,
  extras,
  onExtrasChange,
  quickLength,
  onQuickLengthChange,
  onApplyDetectedAttributes,
}: SmartGarmentScannerProps) {
  const [rawUploadSrc, setRawUploadSrc] = useState<string | null>(null);
  const [isCalibratingCrop, setIsCalibratingCrop] = useState<boolean>(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [draggingPin, setDraggingPin] = useState<PinKey | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [detectionState, setDetectionState] = useState<
    | { status: "idle" }
    | { status: "analyzing"; progress?: number }
    | { status: "detected" }
    | { status: "fallback"; reason: string }
  >({ status: "idle" });

  const innerFrameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisSeqRef = useRef(0);

  const isTwoPiece = category === "two_piece";
  const activePins = getPinsForCategory(category, loungewearSubStyle);

  const hasUpperBodyControls =
    category === "top" ||
    category === "dress" ||
    category === "two_piece" ||
    (category === "jumpsuit" && jumpsuitSubStyle !== "overall");

  const detectedBadges = (() => {
    const badges: string[] = [];
    const catLabels: Record<GarmentCategory, string> = {
      dress: "Vestido",
      two_piece: "Conjunto 2 Piezas",
      top: topSubStyle === "jacket" ? "Chaqueta / Blazer" : "Blusa / Camisa",
      skirt: "Falda",
      pants: "Pantalón",
      jumpsuit: "Enterizo / Overol",
      kids: "Ropa Infantil / Bebé",
      loungewear: "Deportivo / Pijama",
      accessories: "Accesorios",
    };
    badges.push(catLabels[category]);

    if (hasUpperBodyControls) {
      if (extras.wrapFront) {
        badges.push("Frente Cruzado");
      } else {
        const nkMap: Record<NecklineStyle, string> = {
          v_neck: "Escote en V",
          round: "Escote Redondo",
          square: "Escote Cuadrado",
          high: "Cuello Alto",
          tailored_lapel: "Solapa Sastre",
          shirt_collar: "Cuello Camisero",
        };
        badges.push(nkMap[necklineStyle]);
      }

      const slMap: Record<SleeveStyle, string> = {
        kimono: "Manga Kimono",
        short: "Manga Corta",
        long: "Manga Larga",
        sleeveless: "Sin Mangas",
      };
      badges.push(slMap[sleeveStyle]);

      badges.push(
        torsoFit === "loose" ? "Torso Holgado" : "Torso Entallado"
      );
    }

    if (extras.waistTie) badges.push("Con Cinturón");
    if (extras.hemRuffle) badges.push("Con Bolero / Volante");
    if (extras.flaredSleeve) badges.push("Manga Acampanada");
    if (extras.sidePockets) badges.push("Con Bolsillos");
    if (extras.flapPockets) badges.push("Bolsillos con Solapa");
    return badges;
  })();

  const runStyleDetection = async (dataUrl: string) => {
    const seq = ++analysisSeqRef.current;
    setDetectionState({ status: "analyzing" });
    const res = await detectFashionStyleInBrowser(dataUrl, {
      onProgress: (pct) => {
        if (analysisSeqRef.current === seq) {
          setDetectionState({ status: "analyzing", progress: pct });
        }
      },
    });
    if (analysisSeqRef.current !== seq) return;

    if (res.status === "detected") {
      onApplyDetectedAttributes(res.config);
      setDetectionState({ status: "detected" });
    } else {
      setDetectionState({ status: "fallback", reason: res.reason });
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        const resultUrl = e.target.result;
        // Open ImageCalibrator first so the user can crop/frame before analysis
        setRawUploadSrc(resultUrl);
        setIsCalibratingCrop(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Safe clamped dragging inside [0.05..0.95] x [0.05..0.94] so pins never clip
  const updatePin = (clientX: number, clientY: number, key: PinKey) => {
    if (!innerFrameRef.current) return;
    const rect = innerFrameRef.current.getBoundingClientRect();
    const x = Math.min(0.95, Math.max(0.05, (clientX - rect.left) / rect.width));
    const y = Math.min(0.94, Math.max(0.05, (clientY - rect.top) / rect.height));
    onPinsChange({
      ...pins,
      [key]: { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) },
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. QUICK IMAGE CALIBRATOR (CROP/FRAMING BEFORE DETECTOR & PINS) */}
      {isCalibratingCrop && rawUploadSrc ? (
        <ImageCalibrator
          rawImageSrc={rawUploadSrc}
          onConfirmCrop={(croppedUrl) => {
            setIsCalibratingCrop(false);
            setImageSrc(croppedUrl);
            void runStyleDetection(croppedUrl);
          }}
          onUseFullImage={() => {
            setIsCalibratingCrop(false);
            setImageSrc(rawUploadSrc);
            void runStyleDetection(rawUploadSrc);
          }}
        />
      ) : !imageSrc ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
            isDragOver
              ? "border-rose-500 bg-rose-50"
              : "border-slate-300 bg-[#FAF8F5] hover:border-teal-500"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3">
            <Camera className="h-6 w-6" />
          </div>
          <p className="text-base font-bold text-slate-800">
            Sube una foto o captura de tu prenda
          </p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Podrás recortar bordes de captura antes de analizar y mover los pines
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer mb-3"
          >
            <Upload className="h-5 w-5" />
            Elegir foto desde mi dispositivo
          </button>

          <p className="text-xs text-slate-500 mb-2">
            O prueba con una foto de ejemplo:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                const sample = createSamplePhoto("two_piece");
                setRawUploadSrc(sample);
                setImageSrc(sample);
                onCategoryChange("two_piece");
              }}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
            >
              Conjunto (2 Piezas)
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = createSamplePhoto("dress");
                setRawUploadSrc(sample);
                setImageSrc(sample);
                onCategoryChange("dress");
              }}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
            >
              Vestido
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = createSamplePhoto("pants");
                setRawUploadSrc(sample);
                setImageSrc(sample);
                onCategoryChange("pants");
              }}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
            >
              Pantalón
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = createSamplePhoto("blouse");
                setRawUploadSrc(sample);
                setImageSrc(sample);
                onCategoryChange("top");
              }}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
            >
              Blusa
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {detectionState.status === "analyzing" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
              <span>
                Analizando prenda, mangas, caída y detalles en tu navegador...
                {typeof detectionState.progress === "number" &&
                detectionState.progress > 0 &&
                detectionState.progress < 100
                  ? ` (${detectionState.progress}%)`
                  : ""}
              </span>
            </div>
          )}

          {detectionState.status === "fallback" && (
            <div className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              Análisis automático no disponible en este momento; elige la prenda
              y sus partes manualmente abajo.
            </div>
          )}

          <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-900 leading-snug">
            {isTwoPiece
              ? "Modo 2 Piezas: marca hasta dónde llega el Top (3) y dónde empieza la Falda o Pantalón (4)."
              : category === "pants" || (category === "loungewear" && loungewearSubStyle === "leggings")
                ? "Modo Pantalón / Leggings: ubica Cintura (1), Cadera (2), Tiro/Entrepierna (3) y Largo Bota (4)."
                : category === "skirt" || category === "accessories"
                  ? "Modo Falda / Accesorio: ubica Borde Superior (1), Ancho Medio (2) y Largo Final (3)."
                  : category === "top"
                    ? "Modo Parte Superior: ubica Hombro (1), Cuello (2), Sisa (3) y Largo (4)."
                    : "Mueve los 5 círculos sobre tu foto. El molde de la derecha cambiará al instante."}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPinsChange(getDefaultPinsForCategory(category))}
                className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-slate-200 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Centrar puntos
              </button>
              <button
                type="button"
                data-testid="open-crop-btn"
                onClick={() => {
                  if (!rawUploadSrc) setRawUploadSrc(imageSrc);
                  setIsCalibratingCrop(true);
                }}
                className="text-xs sm:text-sm font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 cursor-pointer"
              >
                <Crop className="h-3.5 w-3.5" />
                Encuadrar foto
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                analysisSeqRef.current += 1;
                setDetectionState({ status: "idle" });
                setImageSrc(null);
                setRawUploadSrc(null);
                setIsCalibratingCrop(false);
              }}
              className="text-sm font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer"
            >
              Cambiar foto
            </button>
          </div>

          {/* Safe 24px (p-6) outer padding so bottom/edge pins & labels NEVER clip */}
          <div
            onPointerMove={(e) => {
              if (draggingPin) updatePin(e.clientX, e.clientY, draggingPin);
            }}
            onPointerUp={() => setDraggingPin(null)}
            onPointerLeave={() => setDraggingPin(null)}
            className="p-6 rounded-2xl border border-slate-200 bg-[#F5F2EC] shadow-inner select-none touch-none"
          >
            <div
              ref={innerFrameRef}
              className="relative w-full aspect-[3/4]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt="Foto de referencia limpia"
                className="w-full h-full object-contain pointer-events-none rounded-lg"
              />

              {/* Soft dashed guide lines */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {isTwoPiece ? (
                  <>
                    <polyline
                      fill="none"
                      stroke="rgba(225, 29, 72, 0.7)"
                      strokeWidth="0.75"
                      strokeDasharray="2 1.5"
                      points={["shoulder", "neckline", "topEnd"]
                        .map(
                          (k) =>
                            `${pins[k as PinKey].x * 100},${pins[k as PinKey].y * 100}`
                        )
                        .join(" ")}
                    />
                    <polyline
                      fill="none"
                      stroke="rgba(13, 148, 136, 0.75)"
                      strokeWidth="0.75"
                      strokeDasharray="2 1.5"
                      points={["bottomStart", "hip", "hem"]
                        .map(
                          (k) =>
                            `${pins[k as PinKey].x * 100},${pins[k as PinKey].y * 100}`
                        )
                        .join(" ")}
                    />
                  </>
                ) : (
                  <polyline
                    fill="none"
                    stroke="rgba(15, 23, 42, 0.55)"
                    strokeWidth="0.7"
                    strokeDasharray="2 1.5"
                    points={activePins
                      .map(
                        (cfg) =>
                          `${pins[cfg.key].x * 100},${pins[cfg.key].y * 100}`
                      )
                      .join(" ")}
                  />
                )}
              </svg>

              {/* Draggable Pins with Edge-Aware Left/Right Non-Clipping Labels */}
              {activePins.map((meta) => {
                const p = pins[meta.key];
                const isActive = draggingPin === meta.key;
                let placeLeft: boolean;
                if (p.x < 0.25) {
                  placeLeft = false;
                } else if (p.x > 0.75) {
                  placeLeft = true;
                } else {
                  placeLeft = meta.labelSide === "left" || p.x > 0.62;
                }

                return (
                  <div
                    key={meta.key}
                    data-tracing-pin={meta.key}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingPin(meta.key);
                    }}
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10"
                  >
                    <div
                      style={{ backgroundColor: meta.color }}
                      className={`w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[11px] font-extrabold text-white transition-transform ${
                        isActive
                          ? "scale-125 ring-4 ring-rose-300"
                          : "hover:scale-110"
                      }`}
                    >
                      {meta.num}
                    </div>
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-white/95 border border-slate-300 text-[11px] font-bold text-slate-900 shadow-sm pointer-events-none ${
                        placeLeft ? "right-7" : "left-7"
                      }`}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {detectionState.status === "detected" && (
            <div
              data-testid="detected-attributes-card"
              className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2.5"
            >
              <div className="flex items-start gap-2 text-sm text-emerald-950 font-medium leading-snug">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Esto es lo que detectamos en tu foto. Toca cualquier botón
                  abajo si quieres cambiar algo
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detectedBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-emerald-300 text-xs font-bold text-emerald-900 shadow-2xs"
                  >
                    ✓ {badge}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. VISUAL PART BUILDER WITH SCHEMATIC SVG DRAWINGS */}
      <div className="pt-2 border-t border-slate-200 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900">
          ¿Qué prenda quieres trazar?
        </h3>

        {/* Categorías completas (incluyendo Enterizos, Infantil, Deportivo/Pijamas y Accesorios) */}
        <div className="space-y-1.5">
          <span className="block text-sm font-bold text-slate-700">
            1. Categoría de prenda
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "two_piece", label: "Conjunto (2 Piezas)" },
                { id: "dress", label: "Vestido" },
                { id: "top", label: "Blusa / Camisa" },
                { id: "jacket", label: "Chaqueta / Blazer" },
                { id: "skirt", label: "Falda" },
                { id: "pants", label: "Pantalón" },
                { id: "jumpsuit", label: "Enterizos y Overoles" },
                { id: "kids", label: "Infantil y Bebé" },
                { id: "loungewear", label: "Deportivo y Pijamas" },
                { id: "accessories", label: "Accesorios Textiles" },
              ] as const
            ).map((item) => {
              const isSelected =
                item.id === "jacket"
                  ? category === "top" && topSubStyle === "jacket"
                  : item.id === "top"
                    ? category === "top" && topSubStyle !== "jacket"
                    : category === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "jacket") {
                      onCategoryChange("top");
                      onTopSubStyleChange("jacket");
                      onNecklineStyleChange("tailored_lapel");
                    } else if (item.id === "top") {
                      onCategoryChange("top");
                      if (topSubStyle === "jacket") {
                        onTopSubStyleChange("blouse");
                      }
                    } else {
                      onCategoryChange(item.id);
                    }
                  }}
                  className={`min-h-[58px] p-2.5 rounded-2xl border-2 flex items-center gap-2 text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-rose-50 border-rose-600 text-rose-900 shadow-2xs"
                      : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <GarmentIcon type={item.id} />
                  <span className="text-xs sm:text-sm font-bold leading-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-selectores para Conjunto (2 Piezas) */}
        {category === "two_piece" && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-200">
            <div className="space-y-1.5">
              <span className="block text-sm font-bold text-slate-800">
                Parte de arriba
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "crop_top", label: "Top corto (Crop top)" },
                    { id: "waist_blouse", label: "Blusa a la cintura" },
                    { id: "jacket_blazer", label: "Chaqueta / Blazer" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onTwoPieceTopStyleChange(opt.id);
                      if (opt.id === "jacket_blazer") {
                        onNecklineStyleChange("tailored_lapel");
                      }
                    }}
                    className={`min-h-[48px] px-2.5 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                      opt.id === "jacket_blazer" ? "col-span-2" : ""
                    } ${
                      twoPieceTopStyle === opt.id
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-bold text-slate-800">
                Parte de abajo
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "straight_skirt", label: "Falda recta" },
                    { id: "aline_skirt", label: "Falda en A" },
                    { id: "long_skirt", label: "Falda larga fluida" },
                    { id: "pants", label: "Pantalón" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onTwoPieceBottomStyleChange(opt.id)}
                    className={`min-h-[48px] px-2.5 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                      twoPieceBottomStyle === opt.id
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sub-selector Enterizos y Overoles */}
        {category === "jumpsuit" && onJumpsuitSubStyleChange && (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-slate-700">
              2. Modelo de Enterizo / Overol
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  { id: "romper_long", label: "Enterizo Largo (+3 cm holgura tiro)" },
                  { id: "romper_short", label: "Enterizo Corto / Romper (+3 cm tiro)" },
                  { id: "overall", label: "Overol / Jardinera (Pechera + Tirantes)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onJumpsuitSubStyleChange(opt.id)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                    jumpsuitSubStyle === opt.id
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-selector Infantil y Bebé */}
        {category === "kids" && onKidsSubStyleChange && (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-slate-700">
              2. Prenda Infantil / Bebé
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  { id: "baby_bodysuit", label: "Pelele / Body de Bebé (curva pañal y broches)" },
                  { id: "kids_dress", label: "Vestido Infantil Evasé (1 a 10 años)" },
                  { id: "kids_pants", label: "Pantalón Infantil con Elástico" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onKidsSubStyleChange(opt.id)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                    kidsSubStyle === opt.id
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-selector Deportivo y Pijamas */}
        {category === "loungewear" && onLoungewearSubStyleChange && (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-slate-700">
              2. Modelo Deportivo / Pijama
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  { id: "leggings", label: "Leggings / Licra Deportiva (1 pieza envolvente)" },
                  { id: "classic_pajama", label: "Pijama Clásica (Camisa holgada + Pantalón)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onLoungewearSubStyleChange(opt.id)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                    loungewearSubStyle === opt.id
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-selector Accesorios Textiles */}
        {category === "accessories" && onAccessorySubStyleChange && (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-slate-700">
              2. Tipo de Accesorio Textil
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  { id: "bucket_hat", label: "Sombrero Pescador (Bucket Hat — 3 piezas)" },
                  { id: "apron", label: "Delantal de Cocina / Taller" },
                  { id: "zipper_pouch", label: "Neceser / Cartuchera con Fuelle en Caja" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onAccessorySubStyleChange(opt.id)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border-2 text-sm font-bold text-left transition cursor-pointer ${
                    accessorySubStyle === opt.id
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cuello, Escote o Solapa */}
        {hasUpperBodyControls && (
          <NecklineCollarSelector
            heading="2. Cuello, Escote o Solapa"
            necklineStyle={necklineStyle}
            onNecklineStyleChange={onNecklineStyleChange}
          />
        )}

        {/* Mangas */}
        {hasUpperBodyControls && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="block text-sm font-bold text-slate-700">
                3. Mangas
              </span>
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
                    onClick={() => onSleeveStyleChange(sl.id)}
                    className={`min-h-[60px] p-2.5 rounded-2xl border-2 flex items-center gap-2 text-left transition cursor-pointer ${
                      sleeveStyle === sl.id
                        ? "bg-teal-50 border-teal-600 text-teal-900 shadow-2xs"
                        : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <SleeveIcon style={sl.id} />
                    <span className="text-xs sm:text-sm font-bold leading-tight">
                      {sl.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-bold text-slate-700">
                Ajuste de la cintura
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "fitted", label: "Entallado (al cuerpo)" },
                    { id: "loose", label: "Holgado / Blusado (cinturón)" },
                  ] as const
                ).map((fit) => (
                  <button
                    key={fit.id}
                    type="button"
                    onClick={() => onTorsoFitChange(fit.id)}
                    className={`min-h-[50px] px-2.5 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold text-left transition cursor-pointer ${
                      torsoFit === fit.id
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {fit.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Parte de abajo (Vestido o Falda) */}
        {(category === "dress" || category === "skirt") && (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-slate-700">
              {category === "dress"
                ? "4. Parte de abajo (Falda)"
                : "2. Forma de la falda"}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "straight", label: "Recta" },
                  { id: "a_line", label: "En A (evasé)" },
                  { id: "semicircular", label: "Acampanada" },
                ] as const
              ).map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => onSkirtSubStyleChange(sk.id)}
                  className={`min-h-[68px] p-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                    skirtSubStyle === sk.id
                      ? "bg-teal-50 border-teal-600 text-teal-900 shadow-2xs"
                      : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <SkirtBottomIcon style={sk.id} />
                  <span className="text-xs font-bold leading-tight">
                    {sk.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Parte de abajo (Pantalón) */}
        {category === "pants" && (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-slate-700">
              2. Forma del pantalón
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "straight", label: "Recto" },
                  { id: "wide", label: "Ancho (palazzo)" },
                  { id: "shorts", label: "Short" },
                ] as const
              ).map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => onPantsSubStyleChange(pt.id)}
                  className={`min-h-[68px] p-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                    pantsSubStyle === pt.id
                      ? "bg-teal-50 border-teal-600 text-teal-900 shadow-2xs"
                      : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <PantsBottomIcon style={pt.id} />
                  <span className="text-xs font-bold leading-tight">
                    {pt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {category !== "accessories" && (
          <>
            <QuickLengthSelector
              quickLength={quickLength}
              onQuickLengthChange={onQuickLengthChange}
            />

            <GarmentExtrasSelector
              category={category}
              sleeveStyle={sleeveStyle}
              onSleeveStyleChange={onSleeveStyleChange}
              extras={extras}
              onExtrasChange={onExtrasChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
