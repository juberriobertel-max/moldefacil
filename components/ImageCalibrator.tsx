"use client";

import React, { useRef, useState } from "react";
import { Crop, Check, Maximize2, Smartphone, Focus } from "lucide-react";

export interface CropBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ImageCalibratorProps {
  rawImageSrc: string;
  onConfirmCrop: (croppedDataUrl: string) => void;
  onUseFullImage: () => void;
}

type DragHandle =
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e"
  | null;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export default function ImageCalibrator({
  rawImageSrc,
  onConfirmCrop,
  onUseFullImage,
}: ImageCalibratorProps) {
  // Default slight inset to automatically trim phone status/navigation bars
  const [crop, setCrop] = useState<CropBox>({
    left: 0.06,
    top: 0.08,
    right: 0.94,
    bottom: 0.92,
  });
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const [dragOrigin, setDragOrigin] = useState<{
    x: number;
    y: number;
    box: CropBox;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const minSpan = 0.22;

  const startDrag = (e: React.PointerEvent, handle: DragHandle) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    setActiveHandle(handle);
    setDragOrigin({ x: nx, y: ny, box: { ...crop } });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !dragOrigin || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const dx = nx - dragOrigin.x;
    const dy = ny - dragOrigin.y;
    const b = dragOrigin.box;

    if (activeHandle === "move") {
      const w = b.right - b.left;
      const h = b.bottom - b.top;
      const nextLeft = clamp(b.left + dx, 0, 1 - w);
      const nextTop = clamp(b.top + dy, 0, 1 - h);
      setCrop({
        left: Number(nextLeft.toFixed(3)),
        top: Number(nextTop.toFixed(3)),
        right: Number((nextLeft + w).toFixed(3)),
        bottom: Number((nextTop + h).toFixed(3)),
      });
      return;
    }

    let { left, top, right, bottom } = b;
    if (activeHandle.includes("w")) {
      left = clamp(b.left + dx, 0, right - minSpan);
    }
    if (activeHandle.includes("e")) {
      right = clamp(b.right + dx, left + minSpan, 1);
    }
    if (activeHandle.includes("n")) {
      top = clamp(b.top + dy, 0, bottom - minSpan);
    }
    if (activeHandle.includes("s")) {
      bottom = clamp(b.bottom + dy, top + minSpan, 1);
    }

    setCrop({
      left: Number(left.toFixed(3)),
      top: Number(top.toFixed(3)),
      right: Number(right.toFixed(3)),
      bottom: Number(bottom.toFixed(3)),
    });
  };

  const applyCropToCanvas = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      onConfirmCrop(rawImageSrc);
      return;
    }

    const sx = Math.round(crop.left * img.naturalWidth);
    const sy = Math.round(crop.top * img.naturalHeight);
    const sw = Math.max(32, Math.round((crop.right - crop.left) * img.naturalWidth));
    const sh = Math.max(32, Math.round((crop.bottom - crop.top) * img.naturalHeight));

    const canvas = document.createElement("canvas");
    const maxDim = 960;
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    canvas.width = Math.max(64, Math.round(sw * scale));
    canvas.height = Math.max(64, Math.round(sh * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onConfirmCrop(rawImageSrc);
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onConfirmCrop(canvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <div
      data-testid="image-calibrator"
      className="rounded-2xl border-2 border-teal-600 bg-white p-3.5 space-y-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Crop className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              Encuadre rápido de tu prenda
            </h4>
            <p className="text-xs text-slate-500">
              Recorta barras de celular o fondos antes de analizar y colocar pines
            </p>
          </div>
        </div>
      </div>

      {/* Quick 1-click framing presets */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() =>
            setCrop({ left: 0.05, top: 0.13, right: 0.95, bottom: 0.85 })
          }
          className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-teal-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-teal-600" />
          Quitar barras de captura
        </button>
        <button
          type="button"
          onClick={() =>
            setCrop({ left: 0.15, top: 0.08, right: 0.85, bottom: 0.92 })
          }
          className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-teal-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <Focus className="w-3.5 h-3.5 text-teal-600" />
          Centrar prenda
        </button>
        <button
          type="button"
          onClick={() => setCrop({ left: 0, top: 0, right: 1, bottom: 1 })}
          className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-teal-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-teal-600" />
          Todo el marco
        </button>
      </div>

      {/* Interactive Crop Viewport */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setActiveHandle(null)}
        onPointerLeave={() => setActiveHandle(null)}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 select-none touch-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={rawImageSrc}
          alt="Imagen para encuadrar"
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Shaded outside masks */}
        <div
          style={{ height: `${crop.top * 100}%` }}
          className="absolute inset-x-0 top-0 bg-slate-950/55 pointer-events-none"
        />
        <div
          style={{ height: `${(1 - crop.bottom) * 100}%` }}
          className="absolute inset-x-0 bottom-0 bg-slate-950/55 pointer-events-none"
        />
        <div
          style={{
            top: `${crop.top * 100}%`,
            height: `${(crop.bottom - crop.top) * 100}%`,
            width: `${crop.left * 100}%`,
          }}
          className="absolute left-0 bg-slate-950/55 pointer-events-none"
        />
        <div
          style={{
            top: `${crop.top * 100}%`,
            height: `${(crop.bottom - crop.top) * 100}%`,
            width: `${(1 - crop.right) * 100}%`,
          }}
          className="absolute right-0 bg-slate-950/55 pointer-events-none"
        />

        {/* Active Crop Box */}
        <div
          onPointerDown={(e) => startDrag(e, "move")}
          style={{
            left: `${crop.left * 100}%`,
            top: `${crop.top * 100}%`,
            width: `${(crop.right - crop.left) * 100}%`,
            height: `${(crop.bottom - crop.top) * 100}%`,
          }}
          className="absolute border-2 border-teal-400 shadow-[0_0_0_1px_rgba(255,255,255,0.6)] cursor-move"
        >
          {/* Rule-of-thirds grid inside crop */}
          <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div key={idx} className="border border-white/25" />
            ))}
          </div>

          {/* 4 Corner Handles */}
          {(
            [
              { h: "nw", cls: "-top-2.5 -left-2.5 cursor-nwse-resize" },
              { h: "ne", cls: "-top-2.5 -right-2.5 cursor-nesw-resize" },
              { h: "sw", cls: "-bottom-2.5 -left-2.5 cursor-nesw-resize" },
              { h: "se", cls: "-bottom-2.5 -right-2.5 cursor-nwse-resize" },
            ] as const
          ).map(({ h, cls }) => (
            <div
              key={h}
              onPointerDown={(e) => startDrag(e, h)}
              className={`absolute w-5 h-5 rounded-full bg-teal-500 border-2 border-white shadow-md ${cls}`}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="apply-crop-btn"
          onClick={applyCropToCanvas}
          className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
        >
          <Check className="w-4 h-4" />
          Aplicar encuadre y analizar
        </button>
        <button
          type="button"
          onClick={onUseFullImage}
          className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
        >
          Usar completa
        </button>
      </div>
    </div>
  );
}
