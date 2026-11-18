import React from "react";

export type IllustrationKind =
  | "medidas-cuerpo"
  | "hilo-tela"
  | "piquetes-curvas"
  | "cuadro-calibracion"
  | "doblez-tela";

interface SewingIllustrationProps {
  tipo: IllustrationKind;
  titulo?: string;
  nota?: string;
}

function MedidasCuerpoSvg() {
  return (
    <svg
      viewBox="0 0 680 380"
      className="w-full h-auto max-w-[680px] mx-auto"
      role="img"
      aria-label="Ilustración técnica de frente y perfil con medidas de Busto, Cintura, Cadera y Largo de Talle"
    >
      <rect width="680" height="380" rx="20" fill="#FAF6F0" />

      {/* Left card: Frente */}
      <rect
        x="20"
        y="20"
        width="310"
        height="340"
        rx="16"
        fill="#FFFFFF"
        stroke="#E5DCD0"
        strokeWidth="2"
      />
      <text
        x="175"
        y="46"
        textAnchor="middle"
        fill="#2D2A26"
        fontSize="14"
        fontWeight="800"
      >
        VISTA DE FRENTE (Sin apretar la cinta)
      </text>

      {/* Front Stylized Silhouette */}
      <g
        transform="translate(115, 62)"
        fill="#F5EDE4"
        stroke="#2D2A26"
        strokeWidth="2.4"
      >
        <circle cx="60" cy="22" r="16" />
        <path d="M48 38 L48 50 L20 62 L12 140 L26 142 L34 86 L38 130 L28 200 L34 276 L54 276 L58 205 L62 205 L66 276 L86 276 L92 200 L82 130 L86 86 L94 142 L108 140 L100 62 L72 50 L72 38 Z" />
      </g>

      {/* Busto line */}
      <line
        x1="138"
        y1="150"
        x2="212"
        y2="150"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <rect x="34" y="136" width="88" height="26" rx="8" fill="#C85A32" />
      <text
        x="78"
        y="153"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="12"
        fontWeight="800"
      >
        1. Busto
      </text>

      {/* Cintura line */}
      <line
        x1="146"
        y1="190"
        x2="204"
        y2="190"
        stroke="#3B7A57"
        strokeWidth="3.5"
        strokeDasharray="5 3"
      />
      <rect x="34" y="176" width="88" height="26" rx="8" fill="#3B7A57" />
      <text
        x="78"
        y="193"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="12"
        fontWeight="800"
      >
        2. Cintura
      </text>

      {/* Cadera line */}
      <line
        x1="136"
        y1="238"
        x2="214"
        y2="238"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <rect x="34" y="224" width="88" height="26" rx="8" fill="#2D2A26" />
      <text
        x="78"
        y="241"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="12"
        fontWeight="800"
      >
        3. Cadera
      </text>

      {/* Vertical Largo de Talle */}
      <line
        x1="190"
        y1="114"
        x2="190"
        y2="190"
        stroke="#3B7A57"
        strokeWidth="3"
      />
      <circle cx="190" cy="114" r="4" fill="#3B7A57" />
      <circle cx="190" cy="190" r="4" fill="#3B7A57" />
      <rect x="218" y="140" width="98" height="42" rx="8" fill="#F2F7F4" stroke="#3B7A57" strokeWidth="1.5" />
      <text x="267" y="158" textAnchor="middle" fill="#1E3F2D" fontSize="11" fontWeight="800">
        Largo de Talle
      </text>
      <text x="267" y="173" textAnchor="middle" fill="#3B7A57" fontSize="10" fontWeight="700">
        Hombro → Cintura
      </text>

      {/* Right card: Perfil */}
      <rect
        x="350"
        y="20"
        width="310"
        height="340"
        rx="16"
        fill="#FFFFFF"
        stroke="#E5DCD0"
        strokeWidth="2"
      />
      <text
        x="505"
        y="46"
        textAnchor="middle"
        fill="#2D2A26"
        fontSize="14"
        fontWeight="800"
      >
        VISTA DE PERFIL (Cinta horizontal)
      </text>

      {/* Side Profile Silhouette */}
      <g
        transform="translate(455, 62)"
        fill="#F5EDE4"
        stroke="#2D2A26"
        strokeWidth="2.4"
      >
        <circle cx="44" cy="22" r="16" />
        <path d="M36 38 L52 38 L56 62 C74 74, 76 96, 58 106 L54 130 C36 148, 34 182, 46 212 L48 276 L32 276 L28 205 C14 182, 14 148, 28 128 L30 62 Z" />
      </g>

      {/* Profile Horizontal Tape Guides */}
      <line
        x1="478"
        y1="152"
        x2="532"
        y2="152"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <line
        x1="482"
        y1="190"
        x2="514"
        y2="190"
        stroke="#3B7A57"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <line
        x1="468"
        y1="238"
        x2="520"
        y2="238"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="5 3"
      />

      {/* Callouts on Profile */}
      <rect x="366" y="135" width="102" height="36" rx="8" fill="#FDF3EE" stroke="#C85A32" strokeWidth="1.5" />
      <text x="417" y="151" textAnchor="middle" fill="#6E2B14" fontSize="10.5" fontWeight="800">
        Parte más
      </text>
      <text x="417" y="164" textAnchor="middle" fill="#C85A32" fontSize="10.5" fontWeight="800">
        prominente
      </text>

      <rect x="532" y="218" width="114" height="42" rx="8" fill="#F2F7F4" stroke="#3B7A57" strokeWidth="1.5" />
      <text x="589" y="236" textAnchor="middle" fill="#1E3F2D" fontSize="10.5" fontWeight="800">
        ✓ Paralela al piso
      </text>
      <text x="589" y="251" textAnchor="middle" fill="#3B7A57" fontSize="10" fontWeight="700">
        Por el glúteo mayor
      </text>
    </svg>
  );
}

function HiloTelaSvg() {
  return (
    <svg
      viewBox="0 0 680 320"
      className="w-full h-auto max-w-[680px] mx-auto"
      role="img"
      aria-label="Comparación Sí vs No al alinear la flecha del hilo con el orillo de la tela"
    >
      <rect width="680" height="320" rx="20" fill="#FAF6F0" />

      {/* Left: Correcto */}
      <rect
        x="20"
        y="20"
        width="310"
        height="280"
        rx="16"
        fill="#FFFFFF"
        stroke="#3B7A57"
        strokeWidth="2.5"
      />
      <rect x="36" y="34" width="278" height="32" rx="10" fill="#F2F7F4" />
      <text
        x="175"
        y="55"
        textAnchor="middle"
        fill="#3B7A57"
        fontSize="14"
        fontWeight="800"
      >
        ✅ CORRECTO: Paralelo al orillo
      </text>

      {/* Selvedge line left */}
      <line x1="58" y1="82" x2="58" y2="250" stroke="#2D2A26" strokeWidth="3" />
      <text
        x="46"
        y="170"
        textAnchor="middle"
        fill="#2D2A26"
        fontSize="11"
        fontWeight="800"
        transform="rotate(-90 46 170)"
      >
        ORILLO DE LA TELA
      </text>

      {/* Straight Pattern Piece */}
      <path
        d="M126 88 L234 88 L252 244 L114 244 Z"
        fill="#F2F7F4"
        stroke="#2D2A26"
        strokeWidth="2.5"
      />
      {/* Grainline arrow straight */}
      <line x1="180" y1="104" x2="180" y2="228" stroke="#3B7A57" strokeWidth="3" />
      <polygon points="180,96 174,108 186,108" fill="#3B7A57" />
      <polygon points="180,236 174,224 186,224" fill="#3B7A57" />

      {/* Equal distance markers */}
      <line x1="58" y1="118" x2="180" y2="118" stroke="#C85A32" strokeWidth="2" strokeDasharray="4 3" />
      <text x="119" y="112" textAnchor="middle" fill="#C85A32" fontSize="11" fontWeight="800">
        14.0 cm
      </text>
      <line x1="58" y1="214" x2="180" y2="214" stroke="#C85A32" strokeWidth="2" strokeDasharray="4 3" />
      <text x="119" y="208" textAnchor="middle" fill="#C85A32" fontSize="11" fontWeight="800">
        14.0 cm
      </text>

      <text x="175" y="278" textAnchor="middle" fill="#3B7A57" fontSize="12" fontWeight="700">
        Igual distancia arriba y abajo = caída perfecta
      </text>

      {/* Right: Error comun */}
      <rect
        x="350"
        y="20"
        width="310"
        height="280"
        rx="16"
        fill="#FFFFFF"
        stroke="#C85A32"
        strokeWidth="2.5"
      />
      <rect x="366" y="34" width="278" height="32" rx="10" fill="#FDF3EE" />
      <text
        x="505"
        y="55"
        textAnchor="middle"
        fill="#C85A32"
        fontSize="14"
        fontWeight="800"
      >
        ❌ ERROR COMÚN: Hilo torcido
      </text>

      {/* Selvedge line right */}
      <line x1="388" y1="82" x2="388" y2="250" stroke="#2D2A26" strokeWidth="3" />
      <text
        x="376"
        y="170"
        textAnchor="middle"
        fill="#2D2A26"
        fontSize="11"
        fontWeight="800"
        transform="rotate(-90 376 170)"
      >
        ORILLO DE LA TELA
      </text>

      {/* Tilted Pattern Piece */}
      <g transform="rotate(14 515 166)">
        <path
          d="M460 88 L568 88 L586 244 L448 244 Z"
          fill="#FDF3EE"
          stroke="#2D2A26"
          strokeWidth="2.5"
        />
        <line x1="514" y1="104" x2="514" y2="228" stroke="#C85A32" strokeWidth="3" />
        <polygon points="514,96 508,108 520,108" fill="#C85A32" />
        <polygon points="514,236 508,224 520,224" fill="#C85A32" />
      </g>

      {/* Unequal distance markers */}
      <line x1="388" y1="114" x2="526" y2="114" stroke="#C85A32" strokeWidth="2" strokeDasharray="4 3" />
      <text x="448" y="108" textAnchor="middle" fill="#C85A32" fontSize="11" fontWeight="800">
        16.5 cm
      </text>
      <line x1="388" y1="218" x2="498" y2="218" stroke="#C85A32" strokeWidth="2" strokeDasharray="4 3" />
      <text x="438" y="212" textAnchor="middle" fill="#C85A32" fontSize="11" fontWeight="800">
        11.0 cm
      </text>

      <text x="505" y="278" textAnchor="middle" fill="#C85A32" fontSize="12" fontWeight="700">
        La pierna o blusa se girará al primer lavado
      </text>
    </svg>
  );
}

function PiquetesCurvasSvg() {
  return (
    <svg
      viewBox="0 0 680 300"
      className="w-full h-auto max-w-[680px] mx-auto"
      role="img"
      aria-label="Comparación de curva de escote con piquetes vs sin piquetes"
    >
      <rect width="680" height="300" rx="20" fill="#FAF6F0" />

      {/* Left: Con piquetes */}
      <rect
        x="20"
        y="20"
        width="310"
        height="260"
        rx="16"
        fill="#FFFFFF"
        stroke="#3B7A57"
        strokeWidth="2.5"
      />
      <rect x="36" y="34" width="278" height="32" rx="10" fill="#F2F7F4" />
      <text x="175" y="55" textAnchor="middle" fill="#3B7A57" fontSize="14" fontWeight="800">
        ✅ CON PIQUETES (Curva limpia)
      </text>

      {/* Curved neckline with triangular notches */}
      <path
        d="M58 190 Q 175 88, 292 190"
        fill="none"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="6 4"
      />
      <path
        d="M46 164 Q 175 56, 304 164"
        fill="none"
        stroke="#2D2A26"
        strokeWidth="2.5"
      />
      {[95, 135, 175, 215, 255].map((xPos, i) => {
        const yTop = i === 2 ? 108 : i === 1 || i === 3 ? 116 : 134;
        return (
          <polygon
            key={xPos}
            points={`${xPos - 7},${yTop - 14} ${xPos + 7},${yTop - 14} ${xPos},${yTop + 2}`}
            fill="#FAF6F0"
            stroke="#3B7A57"
            strokeWidth="2"
          />
        );
      })}
      <text x="175" y="226" textAnchor="middle" fill="#2D2A26" fontSize="12" fontWeight="700">
        Cortes cada 1.5 cm a 2 mm del hilo de costura
      </text>
      <text x="175" y="250" textAnchor="middle" fill="#3B7A57" fontSize="12" fontWeight="800">
        ✓ Al voltear y planchar queda totalmente plano
      </text>

      {/* Right: Sin piquetes */}
      <rect
        x="350"
        y="20"
        width="310"
        height="260"
        rx="16"
        fill="#FFFFFF"
        stroke="#C85A32"
        strokeWidth="2.5"
      />
      <rect x="366" y="34" width="278" height="32" rx="10" fill="#FDF3EE" />
      <text x="505" y="55" textAnchor="middle" fill="#C85A32" fontSize="14" fontWeight="800">
        ❌ SIN PIQUETES (Se frunce y tira)
      </text>

      <path
        d="M388 190 Q 505 88, 622 190"
        fill="none"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="6 4"
      />
      <path
        d="M376 164 Q 505 56, 634 164"
        fill="none"
        stroke="#2D2A26"
        strokeWidth="2.5"
      />
      <path
        d="M445 145 L460 128 M495 130 L505 110 M545 138 L535 118 M575 155 L560 135"
        stroke="#C85A32"
        strokeWidth="3"
      />
      <text x="505" y="226" textAnchor="middle" fill="#2D2A26" fontSize="12" fontWeight="700">
        El margen sobrante choca por dentro al voltear
      </text>
      <text x="505" y="250" textAnchor="middle" fill="#C85A32" fontSize="12" fontWeight="800">
        ✗ Forma bultos y levanta la vista del escote
      </text>
    </svg>
  );
}

function CuadroCalibracionSvg() {
  return (
    <svg
      viewBox="0 0 680 300"
      className="w-full h-auto max-w-[680px] mx-auto"
      role="img"
      aria-label="Comparación del cuadro de prueba 5x5 cm a escala 100% frente a Ajustar a página"
    >
      <rect width="680" height="300" rx="20" fill="#FAF6F0" />

      {/* Left: Escala 100% */}
      <rect
        x="20"
        y="20"
        width="310"
        height="260"
        rx="16"
        fill="#FFFFFF"
        stroke="#3B7A57"
        strokeWidth="2.5"
      />
      <rect x="36" y="34" width="278" height="32" rx="10" fill="#F2F7F4" />
      <text x="175" y="55" textAnchor="middle" fill="#3B7A57" fontSize="14" fontWeight="800">
        ✅ ESCALA 100% (Tamaño real)
      </text>

      <rect
        x="115"
        y="82"
        width="120"
        height="100"
        fill="#F2F7F4"
        stroke="#3B7A57"
        strokeWidth="3"
      />
      <text x="175" y="136" textAnchor="middle" fill="#1E3F2D" fontSize="16" fontWeight="800">
        5.0 × 5.0 cm
      </text>

      <rect x="95" y="192" width="160" height="28" rx="4" fill="#FAF6F0" stroke="#2D2A26" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((cm) => {
        const rx = 115 + cm * 24;
        return (
          <g key={cm}>
            <line x1={rx} y1="192" x2={rx} y2="204" stroke="#2D2A26" strokeWidth="2" />
            <text x={rx} y="216" textAnchor="middle" fill="#2D2A26" fontSize="10" fontWeight="800">
              {cm}
            </text>
          </g>
        );
      })}
      <text x="175" y="252" textAnchor="middle" fill="#3B7A57" fontSize="12" fontWeight="800">
        ✓ Tu prenda quedará exactamente a tu talla
      </text>

      {/* Right: Ajustar a página */}
      <rect
        x="350"
        y="20"
        width="310"
        height="260"
        rx="16"
        fill="#FFFFFF"
        stroke="#C85A32"
        strokeWidth="2.5"
      />
      <rect x="366" y="34" width="278" height="32" rx="10" fill="#FDF3EE" />
      <text x="505" y="55" textAnchor="middle" fill="#C85A32" fontSize="14" fontWeight="800">
        ❌ &quot;AJUSTAR A PÁGINA&quot; (Encogido)
      </text>

      <rect
        x="445"
        y="90"
        width="108"
        height="92"
        fill="#FDF3EE"
        stroke="#C85A32"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <text x="499" y="140" textAnchor="middle" fill="#6E2B14" fontSize="16" fontWeight="800">
        4.6 × 4.6 cm
      </text>

      <rect x="425" y="192" width="160" height="28" rx="4" fill="#FAF6F0" stroke="#2D2A26" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((cm) => {
        const rx = 445 + cm * 24;
        return (
          <g key={cm}>
            <line x1={rx} y1="192" x2={rx} y2="204" stroke="#2D2A26" strokeWidth="2" />
            <text x={rx} y="216" textAnchor="middle" fill="#2D2A26" fontSize="10" fontWeight="800">
              {cm}
            </text>
          </g>
        );
      })}
      <text x="505" y="252" textAnchor="middle" fill="#C85A32" fontSize="12" fontWeight="800">
        ✗ Pierdes hasta 6 cm de contorno en el molde
      </text>
    </svg>
  );
}

function DoblezTelaSvg() {
  return (
    <svg
      viewBox="0 0 680 300"
      className="w-full h-auto max-w-[680px] mx-auto"
      role="img"
      aria-label="Comparación de pieza al doblez de la tela frente al error de dejar margen en el doblez"
    >
      <rect width="680" height="300" rx="20" fill="#FAF6F0" />

      {/* Left: Correcto al doblez */}
      <rect
        x="20"
        y="20"
        width="310"
        height="260"
        rx="16"
        fill="#FFFFFF"
        stroke="#3B7A57"
        strokeWidth="2.5"
      />
      <rect x="36" y="34" width="278" height="32" rx="10" fill="#F2F7F4" />
      <text x="175" y="55" textAnchor="middle" fill="#3B7A57" fontSize="14" fontWeight="800">
        ✅ PEGADO AL DOBLEZ (x1 pieza entera)
      </text>

      <rect x="64" y="80" width="220" height="150" fill="#FAF6F0" stroke="#94A3B8" strokeWidth="2" />
      <line x1="64" y1="80" x2="64" y2="230" stroke="#3B7A57" strokeWidth="4" />
      <path
        d="M64 92 L145 92 C152 115, 175 125, 196 112 L212 218 L64 218 Z"
        fill="#F2F7F4"
        stroke="#2D2A26"
        strokeWidth="2.5"
      />
      <text x="128" y="164" textAnchor="middle" fill="#1E3F2D" fontSize="12" fontWeight="800">
        x1 AL DOBLEZ
      </text>
      <text x="128" y="182" textAnchor="middle" fill="#3B7A57" fontSize="11" fontWeight="700">
        ← Sin margen aquí
      </text>
      <text x="175" y="256" textAnchor="middle" fill="#3B7A57" fontSize="12" fontWeight="800">
        ✓ Al abrir la tela sale el delantero simétrico
      </text>

      {/* Right: Error dejando espacio en el doblez */}
      <rect
        x="350"
        y="20"
        width="310"
        height="260"
        rx="16"
        fill="#FFFFFF"
        stroke="#C85A32"
        strokeWidth="2.5"
      />
      <rect x="366" y="34" width="278" height="32" rx="10" fill="#FDF3EE" />
      <text x="505" y="55" textAnchor="middle" fill="#C85A32" fontSize="14" fontWeight="800">
        ❌ SEPARADO DEL DOBLEZ (Error)
      </text>

      <rect x="394" y="80" width="220" height="150" fill="#FAF6F0" stroke="#94A3B8" strokeWidth="2" />
      <line x1="394" y1="80" x2="394" y2="230" stroke="#C85A32" strokeWidth="4" />
      <path
        d="M426 92 L507 92 C514 115, 537 125, 558 112 L574 218 L426 218 Z"
        fill="#FDF3EE"
        stroke="#2D2A26"
        strokeWidth="2.5"
      />
      <line x1="394" y1="155" x2="426" y2="155" stroke="#C85A32" strokeWidth="3" />
      <text x="492" y="164" textAnchor="middle" fill="#6E2B14" fontSize="12" fontWeight="800">
        +3 cm sobrantes
      </text>
      <text x="505" y="256" textAnchor="middle" fill="#C85A32" fontSize="12" fontWeight="800">
        ✗ Ensancha el escote o corta la pieza en dos
      </text>
    </svg>
  );
}

export default function SewingIllustration({
  tipo,
  titulo,
  nota,
}: SewingIllustrationProps) {
  return (
    <figure className="rounded-3xl bg-white border border-[#E5DCD0] p-4 sm:p-6 shadow-xs space-y-3">
      {titulo && (
        <h3 className="text-base sm:text-lg font-extrabold text-[#2D2A26]">
          {titulo}
        </h3>
      )}
      <div className="overflow-hidden rounded-2xl border border-[#EDE6DC]">
        {tipo === "medidas-cuerpo" && <MedidasCuerpoSvg />}
        {tipo === "hilo-tela" && <HiloTelaSvg />}
        {tipo === "piquetes-curvas" && <PiquetesCurvasSvg />}
        {tipo === "cuadro-calibracion" && <CuadroCalibracionSvg />}
        {tipo === "doblez-tela" && <DoblezTelaSvg />}
      </div>
      {nota && (
        <figcaption className="text-xs sm:text-sm text-[#5C554E] leading-relaxed font-medium">
          {nota}
        </figcaption>
      )}
    </figure>
  );
}
