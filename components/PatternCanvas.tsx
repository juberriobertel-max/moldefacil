"use client";

import React, { useMemo, useState } from "react";
import { ZoomIn, ZoomOut, Grid, Scissors, Layers } from "lucide-react";
import { PaperFormat, PatternResult, SeamAllowance } from "@/lib/types";
import { commandsToSvgPath } from "@/lib/patternEngine";
import { computeTilingGrid } from "@/lib/pdfExporter";

interface PatternCanvasProps {
  pattern: PatternResult;
  seamAllowance: SeamAllowance;
  paperFormat: PaperFormat;
  activePieceId: string;
  onActivePieceIdChange: (pieceId: string) => void;
  showSheetGrid: boolean;
  onToggleSheetGrid: () => void;
}

const PAPER_NAME_MAP: Record<PaperFormat, string> = {
  letter: "Carta",
  a4: "A4",
  a0: "A0 (Ploter)",
  projector: "Proyector",
};

export default function PatternCanvas({
  pattern,
  seamAllowance,
  paperFormat,
  activePieceId,
  onActivePieceIdChange,
  showSheetGrid,
  onToggleSheetGrid,
}: PatternCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const visiblePieces = useMemo(() => {
    if (activePieceId === "all") return pattern.pieces;
    const found = pattern.pieces.filter((p) => p.id === activePieceId);
    return found.length > 0 ? found : pattern.pieces;
  }, [pattern.pieces, activePieceId]);

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

  const isSinglePieceView =
    activePieceId !== "all" && visiblePieces.length === 1;

  const padCm = 8;
  const contentW = isSinglePieceView
    ? Math.max(visiblePieces[0].widthCm, 25)
    : Math.max(pattern.totalBoundsCm.width, 40);
  const contentH = isSinglePieceView
    ? Math.max(visiblePieces[0].heightCm, 35)
    : Math.max(pattern.totalBoundsCm.height, 40);

  const baseW = contentW + padCm * 2 + 12;
  const baseH = contentH + padCm * 2;

  const viewW = baseW / zoom;
  const viewH = baseH / zoom;
  const viewX = -padCm + pan.x + (baseW - viewW) / 2;
  const viewY = -padCm + pan.y + (baseH - viewH) / 2;

  const isVerified = pattern.seamValidation?.verified ?? true;

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onActivePieceIdChange("all");
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              activePieceId === "all"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-[#FAF8F5] text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Layers className="h-4 w-4" />
            Ver todas las piezas
          </button>

          {pattern.pieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => {
                onActivePieceIdChange(piece.id);
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activePieceId === piece.id
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-[#FAF8F5] text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {piece.tabLabel}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleSheetGrid}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold border flex items-center gap-2 transition cursor-pointer ${
              showSheetGrid
                ? "bg-amber-50 text-amber-800 border-amber-300 shadow-2xs"
                : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Grid className="h-4 w-4" />
            Ver cómo se divide en hojas
          </button>

          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))))
            }
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
            + Acercar
          </button>

          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.max(0.45, Number((z - 0.2).toFixed(2))))
            }
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
            - Alejar
          </button>
        </div>
      </div>

      {/* Butcher-Paper Cutting Mat */}
      <div
        className="relative flex-1 min-h-[480px] bg-[#FFFDF9] overflow-hidden select-none"
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          setZoom((z) =>
            Math.min(3, Math.max(0.45, Number((z + delta).toFixed(2))))
          );
        }}
        onPointerDown={(e) => {
          setIsPanning(true);
          setPanStart({ x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          if (!isPanning) return;
          const dx = (e.clientX - panStart.x) * (viewW / 800);
          const dy = (e.clientY - panStart.y) * (viewH / 600);
          setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
          setPanStart({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={() => setIsPanning(false)}
        onPointerLeave={() => setIsPanning(false)}
      >
        <svg
          id="patron-svg-canvas"
          viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
          className={`w-full h-full ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <defs>
            <pattern
              id="grid-1cm-light"
              width="1"
              height="1"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 1 0 L 0 0 0 1"
                fill="none"
                stroke="#F1F5F9"
                strokeWidth="0.06"
              />
            </pattern>
            <pattern
              id="grid-5cm-light"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <rect width="5" height="5" fill="url(#grid-1cm-light)" />
              <path
                d="M 5 0 L 0 0 0 5"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="0.1"
              />
            </pattern>
            <marker
              id="grain-arrow-light"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#64748B" />
            </marker>
          </defs>

          <rect
            x={viewX - 200}
            y={viewY - 200}
            width={viewW + 400}
            height={viewH + 400}
            fill="url(#grid-5cm-light)"
          />

          {/* Tiling Sheet Grid Overlay */}
          {showSheetGrid && !isSinglePieceView && (
            <g>
              {tilingGrid.tiles.map((tile) => (
                <g key={`tile-${tile.row}-${tile.col}`}>
                  <rect
                    x={tile.xCm}
                    y={tile.yCm}
                    width={tile.widthCm}
                    height={tile.heightCm}
                    fill={
                      tile.isEmpty
                        ? "rgba(148, 163, 184, 0.08)"
                        : "rgba(217, 119, 6, 0.05)"
                    }
                    stroke={tile.isEmpty ? "#94A3B8" : "#D97706"}
                    strokeWidth="0.22"
                    strokeDasharray="0.9 0.5"
                  />
                  <text
                    x={tile.xCm + 1.2}
                    y={tile.yCm + 2.6}
                    fill={tile.isEmpty ? "#94A3B8" : "#B45309"}
                    fontSize={tile.isEmpty ? "1.3" : "1.8"}
                    fontWeight="bold"
                  >
                    {tile.isEmpty
                      ? `Vacía (F${tile.row}-C${tile.col})`
                      : `Hoja ${tile.sheetNumber} (F${tile.row}-C${tile.col})`}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Pattern Pieces in Warm Kraft Paper */}
          {visiblePieces.map((piece) => {
            const tx = isSinglePieceView ? 0 : piece.layoutX;
            const ty = isSinglePieceView ? 0 : piece.layoutY;

            const shortLabel = piece.tabLabel;
            const labelAngle = piece.labelAngle ?? 0;
            const bandW =
              piece.labelBandWidthCm ?? Math.min(piece.widthCm, piece.heightCm);
            const longSpan =
              piece.labelMaxSpanCm ?? Math.max(piece.widthCm * 0.72, 8);
            const isNarrowBand = bandW < 10;

            const fittedBySpan =
              (longSpan * 0.76) / Math.max(shortLabel.length * 0.6, 3.5);
            const fittedByBand = bandW * (isNarrowBand ? 0.36 : 0.38);
            const finalTitleSize = Math.min(
              3.4,
              Math.max(0.95, Math.min(fittedBySpan, fittedByBand))
            );
            const subSize = Math.max(0.8, finalTitleSize * 0.56);

            const grainHeight = Math.abs(piece.grainline.y2 - piece.grainline.y1);
            const showGrainText =
              !isNarrowBand && grainHeight > 14 && piece.widthCm > 12;

            return (
              <g key={piece.id} transform={`translate(${tx}, ${ty})`}>
                {/* Kraft paper fill + crisp dark cutting border */}
                <path
                  d={commandsToSvgPath(piece.cutPath)}
                  fill="#F5EFE3"
                  fillOpacity="0.88"
                  stroke="#1E293B"
                  strokeWidth="0.28"
                  strokeLinejoin="round"
                />

                {/* Dashed stitching line */}
                {seamAllowance > 0 && (
                  <path
                    d={commandsToSvgPath(piece.seamPath)}
                    fill="none"
                    stroke="#0D9488"
                    strokeWidth="0.2"
                    strokeDasharray="0.8 0.5"
                  />
                )}

                {/* Cut-on-fold line + standard double-bracket arrows */}
                {piece.foldLine && (
                  <g>
                    <line
                      x1={piece.foldLine.x1}
                      y1={piece.foldLine.y1}
                      x2={piece.foldLine.x2}
                      y2={piece.foldLine.y2}
                      stroke="#E11D48"
                      strokeWidth="0.26"
                      strokeDasharray="1.2 0.4 0.3 0.4"
                    />
                    {(() => {
                      const fdx = piece.foldLine.x2 - piece.foldLine.x1;
                      const fdy = piece.foldLine.y2 - piece.foldLine.y1;
                      const flen = Math.hypot(fdx, fdy) || 1;
                      const ux = fdx / flen;
                      const uy = fdy / flen;
                      const nx = uy;
                      const ny = -ux;
                      const p1x = piece.foldLine.x1 + ux * Math.min(4, flen * 0.15);
                      const p1y = piece.foldLine.y1 + uy * Math.min(4, flen * 0.15);
                      const p2x = piece.foldLine.x2 - ux * Math.min(4, flen * 0.15);
                      const p2y = piece.foldLine.y2 - uy * Math.min(4, flen * 0.15);
                      const off = 1.4;
                      const q1x = p1x + nx * off;
                      const q1y = p1y + ny * off;
                      const q2x = p2x + nx * off;
                      const q2y = p2y + ny * off;
                      return (
                        <g stroke="#E11D48" strokeWidth="0.2" fill="none">
                          <path d={`M ${q1x} ${q1y} L ${p1x} ${p1y} M ${q2x} ${q2y} L ${p2x} ${p2y} M ${q1x} ${q1y} L ${q2x} ${q2y}`} />
                          <circle cx={p1x} cy={p1y} r="0.25" fill="#E11D48" />
                          <circle cx={p2x} cy={p2y} r="0.25" fill="#E11D48" />
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* Internal darts, lapel folds, buttons, buttonholes, and pocket marks */}
                {piece.internalLines?.map((line, idx) => {
                  if (line.style === "button") {
                    const m = line.commands[0];
                    if (!m || m.type !== "M") return null;
                    return (
                      <g key={`internal-${idx}`}>
                        <circle
                          cx={m.x}
                          cy={m.y}
                          r="0.55"
                          fill="#FFFFFF"
                          stroke="#0F172A"
                          strokeWidth="0.2"
                        />
                        <path
                          d={`M ${m.x - 0.35} ${m.y} L ${m.x + 0.35} ${m.y} M ${m.x} ${m.y - 0.35} L ${m.x} ${m.y + 0.35}`}
                          stroke="#0F172A"
                          strokeWidth="0.16"
                        />
                      </g>
                    );
                  }
                  if (line.style === "buttonhole") {
                    const p0 = line.commands[0];
                    const p1 = line.commands[1];
                    if (!p0 || !p1 || p0.type !== "M" || p1.type !== "L") return null;
                    return (
                      <g key={`internal-${idx}`} stroke="#BE123C" strokeWidth="0.22">
                        <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} />
                        <line x1={p0.x} y1={p0.y - 0.35} x2={p0.x} y2={p0.y + 0.35} />
                        <line x1={p1.x} y1={p1.y - 0.35} x2={p1.x} y2={p1.y + 0.35} />
                      </g>
                    );
                  }

                  const strokeColor =
                    line.style === "dart"
                      ? "#7C3AED"
                      : line.style === "fold"
                        ? "#E11D48"
                        : "#0284C7";
                  const dashArray =
                    line.style === "dart"
                      ? undefined
                      : line.style === "fold"
                        ? "1.1 0.45"
                        : "0.75 0.45";
                  return (
                    <g key={`internal-${idx}`}>
                      <path
                        d={commandsToSvgPath(line.commands)}
                        fill={
                          line.style === "dart"
                            ? "rgba(124, 58, 237, 0.08)"
                            : "none"
                        }
                        stroke={strokeColor}
                        strokeWidth={line.style === "dart" ? "0.22" : "0.2"}
                        strokeDasharray={dashArray}
                        strokeLinejoin="round"
                      />
                      {line.label && line.labelPos && (
                        <text
                          x={line.labelPos.x}
                          y={line.labelPos.y}
                          fill={strokeColor}
                          fontSize="0.95"
                          fontWeight="700"
                          textAnchor="middle"
                          transform={
                            line.style === "dart"
                              ? `rotate(-90, ${line.labelPos.x}, ${line.labelPos.y})`
                              : undefined
                          }
                        >
                          {line.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Grainline */}
                <line
                  x1={piece.grainline.x1}
                  y1={piece.grainline.y1}
                  x2={piece.grainline.x2}
                  y2={piece.grainline.y2}
                  stroke="#64748B"
                  strokeWidth="0.16"
                  markerStart="url(#grain-arrow-light)"
                  markerEnd="url(#grain-arrow-light)"
                />
                {showGrainText && (
                  <text
                    x={piece.grainline.x1 + 1.1}
                    y={(piece.grainline.y1 + piece.grainline.y2) / 2}
                    fill="#64748B"
                    fontSize="1.35"
                    fontWeight="600"
                    transform={`rotate(-90, ${piece.grainline.x1 + 1.1}, ${(piece.grainline.y1 + piece.grainline.y2) / 2})`}
                    textAnchor="middle"
                  >
                    HILO DE LA TELA
                  </text>
                )}

                {/* Directional V-Notches (1 = delantero, 2 = espalda, 3 = centro/especial) */}
                {piece.notches.map((notch, idx) => {
                  const count = notch.count ?? 1;
                  const rad = (notch.angle * Math.PI) / 180;
                  const txVec = -Math.sin(rad);
                  const tyVec = Math.cos(rad);
                  const nxVec = Math.cos(rad);
                  const nyVec = Math.sin(rad);
                  const offsets =
                    count === 1 ? [0] : count === 2 ? [-0.4, 0.4] : [-0.7, 0, 0.7];

                  return (
                    <g key={idx}>
                      {offsets.map((off, nIdx) => {
                        const cx = notch.x + txVec * off;
                        const cy = notch.y + tyVec * off;
                        const pLeftX = cx - txVec * 0.32 + nxVec * 0.65;
                        const pLeftY = cy - tyVec * 0.32 + nyVec * 0.65;
                        const pRightX = cx + txVec * 0.32 + nxVec * 0.65;
                        const pRightY = cy + tyVec * 0.32 + nyVec * 0.65;
                        return (
                          <path
                            key={nIdx}
                            d={`M ${pLeftX} ${pLeftY} L ${cx} ${cy} L ${pRightX} ${pRightY}`}
                            fill="none"
                            stroke="#E11D48"
                            strokeWidth="0.24"
                            strokeLinejoin="round"
                          />
                        );
                      })}
                      {notch.label &&
                        (isSinglePieceView ||
                          notch.label.includes("Bolsillo") ||
                          notch.label.includes("Cruce") ||
                          notch.label.includes("cierre")) && (
                          <text
                            x={notch.x + (notch.angle === 180 ? 1.1 : -1.1)}
                            y={notch.y + 0.35}
                            fill="#BE123C"
                            fontSize="1.05"
                            fontWeight="700"
                            textAnchor={notch.angle === 180 ? "start" : "end"}
                          >
                            {notch.label}
                          </text>
                        )}
                    </g>
                  );
                })}

                {/* Piece Title & Specs centered inside piece */}
                <g
                  transform={`translate(${piece.labelPos.x}, ${piece.labelPos.y}) rotate(${labelAngle})`}
                >
                  <text
                    x={0}
                    y={0}
                    fill="#0F172A"
                    fontSize={finalTitleSize}
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {shortLabel}
                  </text>
                  {!isNarrowBand && piece.heightCm > 9 && (
                    <text
                      x={0}
                      y={finalTitleSize * 1.15}
                      fill="#475569"
                      fontSize={subSize}
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {`${piece.widthCm.toFixed(0)} × ${piece.heightCm.toFixed(0)} cm`}
                    </text>
                  )}
                  {!isNarrowBand &&
                    (piece.interfacingQuantity ?? 0) > 0 &&
                    piece.heightCm > 7 && (
                      <text
                        x={0}
                        y={finalTitleSize * (piece.heightCm > 9 ? 2.15 : 1.15)}
                        fill="#B45309"
                        fontSize={Math.max(0.85, subSize * 0.9)}
                        fontWeight="800"
                        textAnchor="middle"
                      >
                        {`+ Entretela x${piece.interfacingQuantity}`}
                      </text>
                    )}
                </g>
              </g>
            );
          })}

          {/* Visible 5x5 cm Reference Square */}
          <g transform={`translate(${contentW + 3}, 0)`}>
            <rect
              x={0}
              y={0}
              width={5}
              height={5}
              fill="#ECFDF5"
              stroke="#0D9488"
              strokeWidth="0.24"
            />
            <text
              x={2.5}
              y={2.2}
              fill="#0F766E"
              fontSize="1.15"
              fontWeight="bold"
              textAnchor="middle"
            >
              5×5 cm
            </text>
            <text
              x={2.5}
              y={3.8}
              fill="#0D9488"
              fontSize="0.85"
              textAnchor="middle"
            >
              Medida real
            </text>
          </g>
        </svg>

        {/* Seam Validation Badge (Top-Left of Cutting Mat) */}
        <div
          data-testid="seam-validation-badge"
          className={`absolute top-3 left-3 flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-bold shadow-xs ${
            isVerified
              ? "bg-emerald-50/95 border-emerald-300 text-emerald-900"
              : "bg-amber-50/95 border-amber-300 text-amber-900"
          }`}
        >
          <span>
            {pattern.seamValidation?.badgeText ??
              "✓ Costuras verificadas: todas las piezas encajan al milímetro"}
          </span>
          {pattern.seamValidation?.checks?.[0] && (
            <span
              className={`hidden xl:inline text-xs font-medium border-l pl-2 ${
                isVerified
                  ? "text-emerald-700 border-emerald-300"
                  : "text-amber-700 border-amber-300"
              }`}
            >
              {pattern.seamValidation.checks[0].detail}
            </span>
          )}
        </div>

        {/* Friendly Legend Pill */}
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3.5 px-4 py-2 rounded-2xl bg-white/95 border border-slate-200 text-sm text-slate-700 shadow-sm">
          <span className="font-bold text-slate-900 flex items-center gap-1.5">
            <Scissors className="h-4 w-4 text-rose-600" />
            {pattern.subStyleLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-slate-800 inline-block" />
            Cortar aquí
          </span>
          {seamAllowance > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-b-2 border-dashed border-teal-600 inline-block" />
              Coser aquí ({seamAllowance} cm, 0 en doblez)
            </span>
          )}
        </div>
      </div>

      {/* Friendly Summary Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-[#FAF8F5] border-t border-slate-200 text-sm text-slate-700">
        <div>
          <strong className="text-slate-900">Tela estimada:</strong>{" "}
          {pattern.fabricConsumption.width140m.toFixed(2)} m (en tela de 140 cm de ancho)
        </div>
        <div className="text-slate-600">
          {paperFormat === "projector" ? (
            <>
              <strong className="text-slate-900">1 lámina continua</strong> para Proyector
            </>
          ) : (
            <>
              Ocupa <strong className="text-slate-900">{tilingGrid.printableCount} hojas</strong> tamaño{" "}
              {PAPER_NAME_MAP[paperFormat]}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
