import React from "react";
import { SvgDiagramKind } from "@/lib/blogPosts";

interface ArticleSvgDiagramProps {
  diagram: SvgDiagramKind;
  title: string;
  caption: string;
}

function BodyMeasurementsSvg() {
  return (
    <svg
      viewBox="0 0 640 420"
      className="w-full h-auto max-w-[640px] mx-auto"
      role="img"
      aria-label="Diagrama de las 10 medidas corporales"
    >
      <rect width="640" height="420" rx="20" fill="#FAF8F5" />
      {/* Silhouette */}
      <g transform="translate(260, 24)" fill="#FDE8EC" stroke="#1E293B" strokeWidth="2.5">
        <circle cx="60" cy="28" r="20" />
        <path d="M46 48 L46 62 L18 76 L6 168 L22 172 L32 104 L36 154 L26 235 L32 365 L54 365 L58 242 L62 242 L66 365 L88 365 L94 235 L84 154 L88 104 L98 172 L114 168 L102 76 L74 62 L74 48 Z" />
      </g>

      {/* Measurement lines + numbered pills */}
      {/* 1. Busto */}
      <line x1="286" y1="130" x2="354" y2="130" stroke="#E11D48" strokeWidth="3" />
      <line x1="170" y1="130" x2="286" y2="130" stroke="#E11D48" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="20" y="114" width="150" height="32" rx="10" fill="#E11D48" />
      <text x="95" y="135" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">1. Busto / Pecho</text>

      {/* 2. Cintura */}
      <line x1="294" y1="176" x2="346" y2="176" stroke="#0D9488" strokeWidth="3.5" />
      <line x1="170" y1="176" x2="294" y2="176" stroke="#0D9488" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="20" y="160" width="150" height="32" rx="10" fill="#0D9488" />
      <text x="95" y="181" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">2. Cintura (cordón)</text>

      {/* 3. Cadera */}
      <line x1="284" y1="226" x2="356" y2="226" stroke="#D97706" strokeWidth="3" />
      <line x1="170" y1="226" x2="284" y2="226" stroke="#D97706" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="20" y="210" width="150" height="32" rx="10" fill="#D97706" />
      <text x="95" y="231" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">3. Cadera</text>

      {/* 8. Tiro & 9. Muslo */}
      <line x1="320" y1="176" x2="320" y2="256" stroke="#E11D48" strokeWidth="2.5" />
      <line x1="180" y1="268" x2="320" y2="256" stroke="#E11D48" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="20" y="256" width="160" height="32" rx="10" fill="#1E293B" />
      <text x="100" y="277" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">8. Altura de tiro</text>

      <line x1="288" y1="294" x2="316" y2="294" stroke="#0D9488" strokeWidth="3" />
      <line x1="180" y1="312" x2="288" y2="294" stroke="#0D9488" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="20" y="302" width="160" height="32" rx="10" fill="#0F766E" />
      <text x="100" y="323" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">9. Muslo</text>

      {/* Right side measurements */}
      {/* 4. Espalda */}
      <line x1="278" y1="98" x2="362" y2="98" stroke="#1E293B" strokeWidth="2.5" />
      <line x1="362" y1="98" x2="455" y2="90" stroke="#1E293B" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="455" y="72" width="165" height="32" rx="10" fill="#334155" />
      <text x="537" y="93" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">4. Ancho espalda</text>

      {/* 5. Largo talle */}
      <line x1="336" y1="88" x2="336" y2="176" stroke="#E11D48" strokeWidth="2.5" />
      <line x1="336" y1="138" x2="455" y2="138" stroke="#E11D48" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="455" y="122" width="165" height="32" rx="10" fill="#E11D48" />
      <text x="537" y="143" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">5. Largo de talle</text>

      {/* 6. Manga */}
      <line x1="364" y1="96" x2="376" y2="190" stroke="#D97706" strokeWidth="3" />
      <line x1="372" y1="184" x2="455" y2="188" stroke="#D97706" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="455" y="172" width="165" height="32" rx="10" fill="#D97706" />
      <text x="537" y="193" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">6. Largo de manga</text>

      {/* 7. Largo falda */}
      <line x1="354" y1="176" x2="362" y2="292" stroke="#0D9488" strokeWidth="2.5" />
      <line x1="360" y1="246" x2="455" y2="246" stroke="#0D9488" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="455" y="230" width="165" height="32" rx="10" fill="#0D9488" />
      <text x="537" y="251" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">7. Largo falda</text>

      {/* 10. Largo pierna */}
      <line x1="322" y1="256" x2="334" y2="388" stroke="#1E293B" strokeWidth="2.5" />
      <line x1="334" y1="330" x2="455" y2="330" stroke="#1E293B" strokeDasharray="4 4" strokeWidth="1.5" />
      <rect x="455" y="314" width="165" height="32" rx="10" fill="#1E293B" />
      <text x="537" y="335" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">10. Largo de pierna</text>
    </svg>
  );
}

function PdfTilingSvg() {
  return (
    <svg
      viewBox="0 0 640 310"
      className="w-full h-auto max-w-[640px] mx-auto"
      role="img"
      aria-label="Diagrama de calibración e impresión de moldes PDF"
    >
      <rect width="640" height="310" rx="20" fill="#FAF8F5" />
      {/* Left: Test Scale Square */}
      <rect x="28" y="32" width="230" height="246" rx="18" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="143" y="64" textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="800">
        1. Mide el cuadro de control
      </text>
      <rect x="88" y="92" width="110" height="110" fill="#FFF1F2" stroke="#E11D48" strokeWidth="3" />
      <text x="143" y="143" textAnchor="middle" fill="#E11D48" fontSize="15" fontWeight="800">5 × 5 cm</text>
      <text x="143" y="164" textAnchor="middle" fill="#475569" fontSize="12">Escala 100%</text>
      <text x="143" y="236" textAnchor="middle" fill="#0D9488" fontSize="12" fontWeight="700">
        ✓ Tamaño real (NO ajustar)
      </text>
      <text x="143" y="256" textAnchor="middle" fill="#64748B" fontSize="11">
        Comprobar con regla física
      </text>

      {/* Right: Joining Tiled Sheets */}
      <rect x="282" y="32" width="330" height="246" rx="18" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="447" y="64" textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="800">
        2. Empalme limpio de hojas Carta / A4
      </text>
      {/* 2x2 Grid */}
      <g transform="translate(322, 84)">
        <rect x="0" y="0" width="120" height="82" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" strokeDasharray="5 3" />
        <rect x="120" y="0" width="120" height="82" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" strokeDasharray="5 3" />
        <rect x="0" y="82" width="120" height="82" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" strokeDasharray="5 3" />
        <rect x="120" y="82" width="120" height="82" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" strokeDasharray="5 3" />
        {/* Pattern outline across sheets */}
        <path d="M40 16 C75 40, 155 40, 195 16 L220 148 L20 148 Z" fill="#CCFBF1" fillOpacity="0.65" stroke="#0D9488" strokeWidth="3.5" />
        {/* Corner alignment crosses */}
        <circle cx="120" cy="82" r="9" fill="#E11D48" />
        <line x1="110" y1="82" x2="130" y2="82" stroke="#FFFFFF" strokeWidth="2.5" />
        <line x1="120" y1="72" x2="120" y2="92" stroke="#FFFFFF" strokeWidth="2.5" />
        <text x="16" y="22" fill="#64748B" fontSize="11" fontWeight="700">F1-C1</text>
        <text x="136" y="22" fill="#64748B" fontSize="11" fontWeight="700">F1-C2</text>
        <text x="16" y="104" fill="#64748B" fontSize="11" fontWeight="700">F2-C1</text>
        <text x="136" y="104" fill="#64748B" fontSize="11" fontWeight="700">F2-C2</text>
      </g>
      <text x="447" y="266" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="600">
        Une las cruces rojas de cada fila y columna
      </text>
    </svg>
  );
}

function CircleSkirtFormulaSvg() {
  return (
    <svg
      viewBox="0 0 640 320"
      className="w-full h-auto max-w-[640px] mx-auto"
      role="img"
      aria-label="Fórmula geométrica de falda circular"
    >
      <rect width="640" height="320" rx="20" fill="#FAF8F5" />
      <rect x="44" y="34" width="280" height="252" rx="12" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="6 4" />
      {/* Quarter fold representation */}
      <path d="M124 34 A 80 80 0 0 1 44 114 L 44 264 A 230 230 0 0 0 274 34 Z" fill="#FFF1F2" stroke="#E11D48" strokeWidth="3.5" />
      <circle cx="44" cy="34" r="7" fill="#0F172A" />
      <line x1="44" y1="34" x2="112" y2="66" stroke="#0D9488" strokeWidth="3" />
      <line x1="112" y1="66" x2="218" y2="178" stroke="#D97706" strokeWidth="3" />
      <text x="92" y="54" fill="#0D9488" fontSize="13" fontWeight="800">R</text>
      <text x="168" y="120" fill="#D97706" fontSize="13" fontWeight="800">Largo</text>

      {/* Formula Legend */}
      <g transform="translate(352, 42)">
        <rect width="256" height="236" rx="18" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
        <text x="20" y="36" fill="#0F172A" fontSize="15" fontWeight="800">Medidas clave</text>
        <text x="20" y="72" fill="#0D9488" fontSize="13" fontWeight="800">• Radio cintura (R):</text>
        <text x="28" y="94" fill="#475569" fontSize="13">Cintura ÷ (2 × π × vuelo)</text>
        <text x="20" y="132" fill="#D97706" fontSize="13" fontWeight="800">• Radio exterior:</text>
        <text x="28" y="154" fill="#475569" fontSize="13">R + Largo deseado + ruedo</text>
        <text x="20" y="192" fill="#E11D48" fontSize="13" fontWeight="800">• Consejo anti-sesgo:</text>
        <text x="28" y="214" fill="#475569" fontSize="13">Resta 1 cm de margen en R</text>
      </g>
    </svg>
  );
}

function CleanFinishesSvg() {
  return (
    <svg
      viewBox="0 0 640 280"
      className="w-full h-auto max-w-[640px] mx-auto"
      role="img"
      aria-label="Acabados limpios en escotes y dobladillos"
    >
      <rect width="640" height="280" rx="20" fill="#FAF8F5" />
      {/* Card 1: Notches */}
      <rect x="24" y="28" width="184" height="224" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="116" y="56" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="800">1. Piquetes en curva</text>
      <path d="M56 170 Q 116 95, 176 170" fill="none" stroke="#E11D48" strokeWidth="4" />
      <path d="M46 150 Q 116 70, 186 150" fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="78" y1="118" x2="86" y2="128" stroke="#0F172A" strokeWidth="2.5" />
      <line x1="116" y1="100" x2="116" y2="113" stroke="#0F172A" strokeWidth="2.5" />
      <line x1="154" y1="118" x2="146" y2="128" stroke="#0F172A" strokeWidth="2.5" />
      <text x="116" y="214" textAnchor="middle" fill="#475569" fontSize="12">Cortes cada 1.5 cm</text>
      <text x="116" y="232" textAnchor="middle" fill="#475569" fontSize="12">sin tocar el hilo</text>

      {/* Card 2: Understitch */}
      <rect x="228" y="28" width="184" height="224" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="320" y="56" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="800">2. Pespunte de carga</text>
      <rect x="252" y="92" width="68" height="90" fill="#CCFBF1" stroke="#0D9488" strokeWidth="2" />
      <rect x="320" y="92" width="68" height="90" fill="#FFF1F2" stroke="#E11D48" strokeWidth="2" />
      <line x1="330" y1="98" x2="330" y2="176" stroke="#0F172A" strokeWidth="2.5" strokeDasharray="5 3" />
      <text x="286" y="142" textAnchor="middle" fill="#0F766E" fontSize="11" fontWeight="700">Prenda</text>
      <text x="358" y="142" textAnchor="middle" fill="#BE123C" fontSize="11" fontWeight="700">Vista</text>
      <text x="320" y="214" textAnchor="middle" fill="#475569" fontSize="12">Cose a 2 mm sobre</text>
      <text x="320" y="232" textAnchor="middle" fill="#475569" fontSize="12">la vista y el margen</text>

      {/* Card 3: Rolled Hem */}
      <rect x="432" y="28" width="184" height="224" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="524" y="56" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="800">3. Dobladillo pañuelo</text>
      <path d="M468 156 L580 156 L580 120 L554 120 L554 138 L468 138 Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="2.5" />
      <line x1="554" y1="126" x2="574" y2="126" stroke="#0F172A" strokeWidth="2" strokeDasharray="3 2" />
      <text x="524" y="214" textAnchor="middle" fill="#475569" fontSize="12">Doble vuelta 0.5 cm</text>
      <text x="524" y="232" textAnchor="middle" fill="#475569" fontSize="12">con plancha previa</text>
    </svg>
  );
}

function PatternAdaptationsSvg() {
  return (
    <svg
      viewBox="0 0 640 280"
      className="w-full h-auto max-w-[640px] mx-auto"
      role="img"
      aria-label="Transformaciones sobre patrón base"
    >
      <rect width="640" height="280" rx="20" fill="#FAF8F5" />
      {/* Kimono */}
      <rect x="24" y="28" width="184" height="224" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="116" y="54" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="800">Manga Kimono</text>
      <path d="M68 84 L112 76 L174 96 L166 138 L138 142 L134 210 L68 210 Z" fill="#CCFBF1" stroke="#0D9488" strokeWidth="3" />
      <line x1="112" y1="76" x2="112" y2="210" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth="1.5" />
      <text x="116" y="236" textAnchor="middle" fill="#0F766E" fontSize="12" fontWeight="700">Extiende el hombro</text>

      {/* Empire */}
      <rect x="228" y="28" width="184" height="224" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="320" y="54" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="800">Corte Imperio</text>
      <path d="M276 80 L344 80 L356 122 L374 210 L276 210 Z" fill="#FFF1F2" stroke="#E11D48" strokeWidth="3" />
      <line x1="276" y1="134" x2="358" y2="134" stroke="#0F172A" strokeWidth="3" strokeDasharray="5 3" />
      <text x="320" y="236" textAnchor="middle" fill="#BE123C" fontSize="12" fontWeight="700">Corta bajo el busto</text>

      {/* Blouson */}
      <rect x="432" y="28" width="184" height="224" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="524" y="54" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="800">Caída Blusada</text>
      <path d="M480 80 L552 80 L574 176 L552 214 L480 214 Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="3" />
      <line x1="480" y1="196" x2="556" y2="196" stroke="#0F172A" strokeWidth="2.5" strokeDasharray="4 3" />
      <text x="524" y="236" textAnchor="middle" fill="#B45309" fontSize="12" fontWeight="700">+3 cm largo + elástico</text>
    </svg>
  );
}

export default function ArticleSvgDiagram({
  diagram,
  title,
  caption,
}: ArticleSvgDiagramProps) {
  return (
    <figure className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
      <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        {diagram === "body-measurements" && <BodyMeasurementsSvg />}
        {diagram === "pdf-tiling" && <PdfTilingSvg />}
        {diagram === "circle-skirt-formula" && <CircleSkirtFormulaSvg />}
        {diagram === "clean-finishes" && <CleanFinishesSvg />}
        {diagram === "pattern-adaptations" && <PatternAdaptationsSvg />}
      </div>
      <figcaption className="text-xs sm:text-sm text-slate-600 leading-relaxed">
        {caption}
      </figcaption>
    </figure>
  );
}
