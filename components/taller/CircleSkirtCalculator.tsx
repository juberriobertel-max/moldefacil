"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Ruler, Scissors } from "lucide-react";

type CircleAngle = 90 | 180 | 360 | 720;

interface SkirtFlightOption {
  angle: CircleAngle;
  label: string;
  shortDesc: string;
  fraction: number;
}

const FLIGHT_OPTIONS: SkirtFlightOption[] = [
  {
    angle: 90,
    label: "Cuarto de plato (90°)",
    shortDesc: "Caída suave y elegante",
    fraction: 0.25,
  },
  {
    angle: 180,
    label: "Medio plato (180°)",
    shortDesc: "Vuelo clásico equilibrado",
    fraction: 0.5,
  },
  {
    angle: 360,
    label: "Plato completo (360°)",
    shortDesc: "Giro amplio estilo vintage",
    fraction: 1,
  },
  {
    angle: 720,
    label: "Doble plato (720°)",
    shortDesc: "Máximo volumen de fiesta",
    fraction: 2,
  },
];

export default function CircleSkirtCalculator() {
  const [waistCm, setWaistCm] = useState<number>(72);
  const [lengthCm, setLengthCm] = useState<number>(60);
  const [seamCm, setSeamCm] = useState<number>(1.5);
  const [rollWidthCm, setRollWidthCm] = useState<140 | 150>(150);
  const [angle, setAngle] = useState<CircleAngle>(180);

  const calc = useMemo(() => {
    const safeWaist = Math.max(40, Math.min(160, waistCm || 72));
    const safeLength = Math.max(20, Math.min(130, lengthCm || 60));
    const safeSeam = Math.max(0, Math.min(3, seamCm || 0));
    const option =
      FLIGHT_OPTIONS.find((f) => f.angle === angle) ?? FLIGHT_OPTIONS[1];

    // Exact anatomical waist radius for chosen circle fraction
    const exactWaistRadius = safeWaist / (2 * Math.PI * option.fraction);
    // Cutting radius subtracts waist seam allowance so stitched waist matches target
    const cutWaistRadius = Math.max(2, exactWaistRadius - safeSeam);
    const outerRadius = cutWaistRadius + safeLength + safeSeam;

    let piecesToCut = 1;
    let skirtBodyCm = outerRadius;
    let foldDescription = "";

    if (angle === 90) {
      if (outerRadius <= rollWidthCm) {
        piecesToCut = 1;
        skirtBodyCm = outerRadius;
        foldDescription = `1 pieza abierta en esquina (${outerRadius.toFixed(
          0
        )} × ${outerRadius.toFixed(0)} cm)`;
      } else {
        piecesToCut = 2;
        skirtBodyCm = outerRadius * 1.65;
        foldDescription =
          "2 gajos unidos en costados (el largo excede el ancho del rollo)";
      }
    } else if (angle === 180) {
      if (outerRadius * 2 <= rollWidthCm) {
        piecesToCut = 1;
        skirtBodyCm = outerRadius;
        foldDescription = "1 pieza al doblez transversal (cabe en el ancho)";
      } else if (outerRadius <= rollWidthCm) {
        piecesToCut = 1;
        skirtBodyCm = outerRadius * 2;
        foldDescription =
          "1 pieza doblada por el largo de la tela (al hilo / lomo)";
      } else {
        piecesToCut = 2;
        skirtBodyCm = outerRadius * 2;
        foldDescription =
          "2 cuartos de plato unidos en costados (falda maxi)";
      }
    } else if (angle === 360) {
      if (outerRadius * 2 <= rollWidthCm) {
        piecesToCut = 1;
        skirtBodyCm = outerRadius * 2;
        foldDescription = "1 círculo entero doblado en 4 dentro del ancho";
      } else if (outerRadius <= rollWidthCm) {
        piecesToCut = 2;
        skirtBodyCm = outerRadius * 4;
        foldDescription = "2 medios platos unidos en los costados";
      } else {
        piecesToCut = 4;
        skirtBodyCm = outerRadius * 4;
        foldDescription = "4 cuartos de plato unidos (largo maxi)";
      }
    } else {
      // 720 double circle = 2 full 360° skirts joined
      if (outerRadius * 2 <= rollWidthCm) {
        piecesToCut = 2;
        skirtBodyCm = outerRadius * 4;
        foldDescription = "2 círculos completos unidos en costados";
      } else {
        piecesToCut = 4;
        skirtBodyCm = outerRadius * 8;
        foldDescription = "4 medios platos unidos para doble vuelo completo";
      }
    }

    // Add 15 cm for waistband + fabric squaring
    const waistbandBufferCm = 15;
    const totalMetersToBuy =
      Math.ceil(((skirtBodyCm + waistbandBufferCm) / 100) * 10) / 10;

    return {
      option,
      exactWaistRadius,
      cutWaistRadius,
      outerRadius,
      piecesToCut,
      foldDescription,
      totalMetersToBuy,
    };
  }, [waistCm, lengthCm, seamCm, rollWidthCm, angle]);

  // SVG scale inside 420x320 box (representing folded quarter/half fabric corner)
  const svgMetrics = useMemo(() => {
    const pad = 28;
    const maxDraw = 240;
    const rScale = maxDraw / Math.max(calc.outerRadius, 30);
    const rInnerPx = Math.max(20, calc.cutWaistRadius * rScale);
    const rOuterPx = Math.min(maxDraw, calc.outerRadius * rScale);
    const ox = 50;
    const oy = 34;

    let arcPath = "";
    if (angle === 90) {
      arcPath = `M ${ox + rInnerPx} ${oy} A ${rInnerPx} ${rInnerPx} 0 0 1 ${ox} ${
        oy + rInnerPx
      } L ${ox} ${oy + rOuterPx} A ${rOuterPx} ${rOuterPx} 0 0 0 ${
        ox + rOuterPx
      } ${oy} Z`;
    } else {
      arcPath = `M ${ox + rInnerPx} ${oy} A ${rInnerPx} ${rInnerPx} 0 0 1 ${ox} ${
        oy + rInnerPx
      } L ${ox} ${oy + rOuterPx} A ${rOuterPx} ${rOuterPx} 0 0 0 ${
        ox + rOuterPx
      } ${oy} Z`;
    }

    return {
      ox,
      oy,
      rInnerPx,
      rOuterPx,
      arcPath,
      rectW: rOuterPx + pad,
      rectH: rOuterPx + pad,
    };
  }, [calc.cutWaistRadius, calc.outerRadius, angle]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Controls */}
      <div className="lg:col-span-5 space-y-4">
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Medidas de tu falda
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Calcula el radio de compás exacto en centímetros.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Cintura (cm)
              </label>
              <input
                type="number"
                min={40}
                max={160}
                value={waistCm}
                onChange={(e) => setWaistCm(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Largo deseado (cm)
              </label>
              <input
                type="number"
                min={20}
                max={130}
                value={lengthCm}
                onChange={(e) => setLengthCm(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Margen cintura/ruedo (cm)
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={3}
                value={seamCm}
                onChange={(e) => setSeamCm(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Ancho del rollo
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
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="block text-sm font-bold text-slate-800">
              Elige el vuelo de la falda
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FLIGHT_OPTIONS.map((opt) => {
                const active = opt.angle === angle;
                return (
                  <button
                    key={opt.angle}
                    type="button"
                    onClick={() => setAngle(opt.angle)}
                    className={`min-h-[60px] p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                      active
                        ? "bg-rose-50 border-rose-600 text-rose-950"
                        : "bg-[#FAF8F5] border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">
                      {opt.label}
                    </span>
                    <span className="block text-xs opacity-80">
                      {opt.shortDesc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <Link
          href="/?prenda=falda&estilo=circular"
          className="w-full min-h-[50px] px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-base font-extrabold shadow-sm flex items-center justify-center gap-2 transition"
        >
          <Scissors className="h-5 w-5" />
          <span>Generar molde PDF de Falda Circular</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Right Results + Live SVG Technical Diagram */}
      <div className="lg:col-span-7 space-y-4">
        {/* Highlight Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
            <span className="block text-xs font-bold text-slate-500">
              Radio cintura (R)
            </span>
            <strong className="text-xl sm:text-2xl font-black text-rose-600">
              {calc.cutWaistRadius.toFixed(1)} cm
            </strong>
            <span className="block text-[11px] text-slate-400">
              Exacto sin margen: {calc.exactWaistRadius.toFixed(1)} cm
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
            <span className="block text-xs font-bold text-slate-500">
              Radio exterior
            </span>
            <strong className="text-xl sm:text-2xl font-black text-teal-700">
              {calc.outerRadius.toFixed(1)} cm
            </strong>
            <span className="block text-[11px] text-slate-400">
              R + Largo + Ruedo
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
            <span className="block text-xs font-bold text-slate-500">
              Tela a comprar
            </span>
            <strong className="text-xl sm:text-2xl font-black text-slate-900">
              {calc.totalMetersToBuy.toFixed(1)} m
            </strong>
            <span className="block text-[11px] text-slate-400">
              Incluye pretina (+15 cm)
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
            <span className="block text-xs font-bold text-slate-500">
              Piezas a cortar
            </span>
            <strong className="text-xl sm:text-2xl font-black text-amber-700">
              {calc.piecesToCut} {calc.piecesToCut === 1 ? "pieza" : "piezas"}
            </strong>
            <span className="block text-[11px] text-slate-400">
              + 1 pretina recta
            </span>
          </div>
        </div>

        {/* Live Technical SVG Diagram */}
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Ruler className="h-5 w-5 text-teal-600" />
              <span>Esquema técnico en vivo ({calc.option.label})</span>
            </h3>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              Ancho rollo: {rollWidthCm} cm
            </span>
          </div>

          <div className="rounded-2xl bg-[#FAF8F5] border border-slate-200 p-3 overflow-hidden">
            <svg
              viewBox="0 0 540 315"
              className="w-full h-auto max-w-[540px] mx-auto"
              role="img"
              aria-label="Diagrama geométrico en vivo para corte de falda circular"
            >
              {/* Folded Fabric Rectangle */}
              <rect
                x={svgMetrics.ox}
                y={svgMetrics.oy}
                width={svgMetrics.rectW}
                height={svgMetrics.rectH}
                rx="8"
                fill="#FFFFFF"
                stroke="#94A3B8"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              {/* Skirt Sector */}
              <path
                d={svgMetrics.arcPath}
                fill="#FFF1F2"
                stroke="#E11D48"
                strokeWidth="3"
              />
              {/* Pivot Corner */}
              <circle
                cx={svgMetrics.ox}
                cy={svgMetrics.oy}
                r="6"
                fill="#0F172A"
              />
              <text
                x={svgMetrics.ox + 10}
                y={svgMetrics.oy - 10}
                fill="#0F172A"
                fontSize="12"
                fontWeight="800"
              >
                Centro de giro (esquina)
              </text>

              {/* Waist Radius Vector */}
              <line
                x1={svgMetrics.ox}
                y1={svgMetrics.oy}
                x2={svgMetrics.ox + svgMetrics.rInnerPx * 0.72}
                y2={svgMetrics.oy + svgMetrics.rInnerPx * 0.72}
                stroke="#0D9488"
                strokeWidth="3"
              />
              {/* Outer Radius Vector */}
              <line
                x1={svgMetrics.ox + svgMetrics.rInnerPx * 0.72}
                y1={svgMetrics.oy + svgMetrics.rInnerPx * 0.72}
                x2={svgMetrics.ox + svgMetrics.rOuterPx * 0.72}
                y2={svgMetrics.oy + svgMetrics.rOuterPx * 0.72}
                stroke="#D97706"
                strokeWidth="3"
              />

              {/* Right Side Callouts */}
              <g transform="translate(332, 34)">
                <rect
                  width="190"
                  height="245"
                  rx="16"
                  fill="#FFFFFF"
                  stroke="#E2E8F0"
                  strokeWidth="2"
                />
                <text x="16" y="30" fill="#0F172A" fontSize="13" fontWeight="800">
                  Anotaciones del corte
                </text>
                <text x="16" y="62" fill="#0D9488" fontSize="12" fontWeight="800">
                  1. Curva cintura (R):
                </text>
                <text x="24" y="82" fill="#0F172A" fontSize="16" fontWeight="800">
                  {calc.cutWaistRadius.toFixed(1)} cm
                </text>
                <text x="16" y="114" fill="#D97706" fontSize="12" fontWeight="800">
                  2. Curva ruedo (R ext):
                </text>
                <text x="24" y="134" fill="#0F172A" fontSize="16" fontWeight="800">
                  {calc.outerRadius.toFixed(1)} cm
                </text>
                <text x="16" y="166" fill="#E11D48" fontSize="12" fontWeight="800">
                  3. Largo total corte:
                </text>
                <text x="24" y="186" fill="#0F172A" fontSize="15" fontWeight="800">
                  {(lengthCm + seamCm).toFixed(1)} cm
                </text>
                <text x="16" y="218" fill="#475569" fontSize="11">
                  Tira pretina: {waistCm + 6} × 10 cm
                </text>
              </g>
            </svg>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-sm text-teal-950">
            <strong>Cómo doblar y cortar:</strong> {calc.foldDescription}. Deja la falda colgada 24 horas antes de coser el ruedo para nivelar las caídas al sesgo.
          </div>
        </section>
      </div>
    </div>
  );
}
