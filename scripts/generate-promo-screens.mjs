import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { default: sharp } = await import(
  pathToFileURL(path.resolve("node_modules/sharp/dist/index.mjs")).href
);

const outDir = path.resolve("public/promo");
fs.mkdirSync(outDir, { recursive: true });

const W = 860;
const H = 1700;

function commonHeader(activeTab = "generador") {
  const genFill = activeTab === "generador" ? "#E11D48" : "#FAF8F5";
  const genText = activeTab === "generador" ? "#FFFFFF" : "#334155";
  const blogFill = activeTab === "blog" ? "#E11D48" : "#FAF8F5";
  const blogText = activeTab === "blog" ? "#FFFFFF" : "#334155";
  const tallerFill = activeTab === "taller" ? "#E11D48" : "#FAF8F5";
  const tallerText = activeTab === "taller" ? "#FFFFFF" : "#334155";

  return `
    <!-- Top Status & App Bar -->
    <rect x="0" y="0" width="${W}" height="196" fill="#FFFFFF" />
    <line x1="0" y1="196" x2="${W}" y2="196" stroke="#E2E8F0" stroke-width="2" />

    <!-- Brand Logo -->
    <rect x="32" y="24" width="68" height="68" rx="20" fill="#E11D48" />
    <circle cx="54" cy="46" r="8" fill="none" stroke="#FFFFFF" stroke-width="4" />
    <circle cx="54" cy="70" r="8" fill="none" stroke="#FFFFFF" stroke-width="4" />
    <line x1="60" y1="52" x2="84" y2="74" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
    <line x1="84" y1="42" x2="60" y2="64" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />

    <text x="116" y="54" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800" fill="#0F172A">MoldeFácil</text>
    <text x="116" y="82" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#64748B">Patrones a medida PDF 1:1 • Revista y Taller</text>

    <rect x="650" y="30" width="178" height="54" rx="16" fill="#FDF2F8" stroke="#FBCFE8" stroke-width="2" />
    <text x="739" y="64" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#BE123C">100% GRATIS</text>

    <!-- Navigation Bar -->
    <rect x="32" y="110" width="796" height="68" rx="20" fill="#FAF8F5" stroke="#E2E8F0" stroke-width="2" />
    <rect x="42" y="118" width="256" height="52" rx="14" fill="${genFill}" />
    <text x="170" y="151" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="${genText}">✂️ Generador</text>

    <rect x="304" y="118" width="252" height="52" rx="14" fill="${blogFill}" />
    <text x="430" y="151" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="${blogText}">📖 Revista y Guías</text>

    <rect x="562" y="118" width="256" height="52" rx="14" fill="${tallerFill}" />
    <text x="690" y="151" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="${tallerText}">🛠️ Mi Taller</text>
  `;
}

const svg01 = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FAF8F5" />
  ${commonHeader("generador")}

  <rect x="28" y="222" width="804" height="1446" rx="34" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />

  <rect x="60" y="256" width="320" height="44" rx="22" fill="#FFF1F2" stroke="#FECDD3" stroke-width="2" />
  <text x="220" y="285" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#BE123C">PASO 1 • ESCÁNER DE PRENDA IA</text>

  <text x="60" y="344" font-family="Segoe UI, Arial, sans-serif" font-size="33" font-weight="800" fill="#2D2A26">Sube una foto y obtén el molde</text>
  <text x="60" y="380" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="500" fill="#5C554E">Detecta automáticamente corte, mangas, escote y holgura</text>

  <rect x="60" y="408" width="740" height="540" rx="28" fill="#FAF6F0" stroke="#C85A32" stroke-width="3" />

  <rect x="90" y="434" width="340" height="488" rx="22" fill="#F3ECE2" stroke="#E5DCD0" stroke-width="2" />
  <path d="M112 478 L112 454 L138 454" fill="none" stroke="#0D9488" stroke-width="5" stroke-linecap="round" />
  <path d="M408 478 L408 454 L382 454" fill="none" stroke="#0D9488" stroke-width="5" stroke-linecap="round" />
  <path d="M112 878 L112 902 L138 902" fill="none" stroke="#0D9488" stroke-width="5" stroke-linecap="round" />
  <path d="M408 878 L408 902 L382 902" fill="none" stroke="#0D9488" stroke-width="5" stroke-linecap="round" />

  <rect x="248" y="468" width="24" height="32" rx="6" fill="#8C7A6B" />
  <path d="M210 498 L138 536 L154 606 L202 586 L214 648 L306 648 L318 586 L366 606 L382 536 L310 498 L260 568 Z" fill="#C85A32" stroke="#2D2A26" stroke-width="3.5" />
  <line x1="210" y1="498" x2="296" y2="648" stroke="#FAF6F0" stroke-width="3" stroke-dasharray="6 4" />
  <rect x="210" y="642" width="100" height="18" rx="8" fill="#9A3412" />
  <path d="M286 654 L318 720 M296 654 L276 728" stroke="#9A3412" stroke-width="8" stroke-linecap="round" />
  <path d="M214 660 L172 866 L348 866 L306 660 Z" fill="#D96B43" stroke="#2D2A26" stroke-width="3.5" />
  <line x1="280" y1="660" x2="245" y2="866" stroke="#2D2A26" stroke-width="3" />

  <circle cx="260" cy="552" r="9" fill="#10B981" stroke="#FFFFFF" stroke-width="3" />
  <circle cx="156" cy="566" r="9" fill="#10B981" stroke="#FFFFFF" stroke-width="3" />
  <circle cx="260" cy="650" r="9" fill="#10B981" stroke="#FFFFFF" stroke-width="3" />
  <circle cx="260" cy="790" r="9" fill="#10B981" stroke="#FFFFFF" stroke-width="3" />

  <rect x="454" y="434" width="320" height="46" rx="14" fill="#ECFDF5" stroke="#6EE7B7" stroke-width="2" />
  <text x="614" y="464" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#065F46">✨ IA Detectado (98%)</text>

  <text x="454" y="518" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#64748B">PRENDA IDENTIFICADA</text>
  <text x="454" y="550" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="800" fill="#0F172A">Vestido Cruzado</text>
  <text x="454" y="580" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="#C85A32">Corte Wrap + Kimono</text>

  <rect x="454" y="604" width="320" height="72" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" />
  <text x="474" y="632" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="#64748B">TIPO DE MANGA</text>
  <text x="474" y="660" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#1E293B">Kimono Corta Fluida</text>

  <rect x="454" y="690" width="320" height="72" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" />
  <text x="474" y="718" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="#64748B">ESCOTE Y FALDA</text>
  <text x="474" y="746" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#1E293B">Escote V • Falda Midi</text>

  <rect x="454" y="776" width="320" height="72" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" />
  <text x="474" y="804" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="#64748B">HOLGURA SUGERIDA</text>
  <text x="474" y="832" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#0D9488">Confort Suave (+6 cm)</text>

  <rect x="454" y="864" width="320" height="58" rx="16" fill="#0D9488" />
  <text x="614" y="900" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">✓ Parámetros Aplicados</text>

  <rect x="60" y="976" width="740" height="170" rx="24" fill="#F2F7F4" stroke="#3B7A57" stroke-width="2.5" />
  <text x="92" y="1020" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#1E3F2D">💡 Recomendación del Taller para este diseño:</text>
  <text x="92" y="1058" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" fill="#264735">• Telas ideales: Viscosa, Chalis, Rayón, Crepé o Lino liviano.</text>
  <text x="92" y="1094" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" fill="#264735">• Aguja sugerida: Universal 80/12 • Puntada recta 2.5 mm.</text>
  <text x="92" y="1128" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#C85A32">• Piezas del molde: 2 Delanteros + 1 Espalda al doblez + Falda.</text>

  <text x="60" y="1196" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">O elige entre +40 estilos listos de taller:</text>

  <rect x="60" y="1218" width="234" height="86" rx="22" fill="#E11D48" />
  <text x="177" y="1256" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF">👗 Vestido Cruzado</text>
  <text x="177" y="1284" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#FFE4E6">Seleccionado</text>

  <rect x="312" y="1218" width="234" height="86" rx="22" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <text x="429" y="1256" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">👚 Blusa Kimono</text>
  <text x="429" y="1284" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#5C554E">Manga caída</text>

  <rect x="564" y="1218" width="236" height="86" rx="22" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <text x="682" y="1256" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">👖 Pantalón Palazzo</text>
  <text x="682" y="1284" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#5C554E">Tiro alto sastre</text>

  <rect x="60" y="1340" width="740" height="96" rx="26" fill="#E11D48" />
  <text x="430" y="1398" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800" fill="#FFFFFF">Pasar al Paso 2: Mis Medidas Exactas →</text>

  <rect x="60" y="1464" width="740" height="164" rx="24" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <text x="430" y="1518" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">✂️ Trazado geométrico 100% en tu navegador</text>
  <text x="430" y="1558" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="#5C554E">Tus fotos nunca se suben a servidores externos. Privado y rápido.</text>
  <text x="430" y="1596" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#C85A32">Hecho con cariño para modistas y talleres de costura</text>
</svg>
`;

const svg02 = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FAF8F5" />
  ${commonHeader("generador")}

  <rect x="28" y="222" width="804" height="1446" rx="34" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />

  <rect x="60" y="254" width="330" height="44" rx="22" fill="#FFF1F2" stroke="#FECDD3" stroke-width="2" />
  <text x="225" y="283" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#BE123C">PASO 2 • MEDIDAS CORPORALES</text>

  <text x="60" y="340" font-family="Segoe UI, Arial, sans-serif" font-size="33" font-weight="800" fill="#2D2A26">Tus medidas o las de tu clienta</text>
  <text x="60" y="376" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="500" fill="#5C554E">Elige una talla base o carga un perfil guardado en 1 toque</text>

  <text x="60" y="422" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#5C554E">TALLAS RÁPIDAS INDUSTRIALES (CM)</text>
  <g transform="translate(60, 438)">
    <rect x="0" y="0" width="136" height="68" rx="18" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
    <text x="68" y="43" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#2D2A26">XS</text>

    <rect x="151" y="0" width="136" height="68" rx="18" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
    <text x="219" y="43" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#2D2A26">S</text>

    <rect x="302" y="0" width="136" height="68" rx="18" fill="#E11D48" />
    <text x="370" y="43" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF">M ✓</text>

    <rect x="453" y="0" width="136" height="68" rx="18" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
    <text x="521" y="43" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#2D2A26">L</text>

    <rect x="604" y="0" width="136" height="68" rx="18" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
    <text x="672" y="43" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#2D2A26">XL</text>
  </g>

  <rect x="60" y="532" width="740" height="290" rx="26" fill="#FAF6F0" stroke="#C85A32" stroke-width="2.5" />
  <text x="90" y="576" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#C85A32">📒 MIS MEDIDAS GUARDADAS EN EL TALLER</text>

  <rect x="86" y="596" width="688" height="96" rx="20" fill="#F2F7F4" stroke="#3B7A57" stroke-width="3" />
  <text x="114" y="636" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" fill="#1E3F2D">👗 Clienta Ana — Vestido Cruzado</text>
  <text x="114" y="670" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="700" fill="#3B7A57">Busto: 92 cm • Cintura: 72 cm • Cadera: 98 cm • Talle: 42 cm</text>
  <rect x="612" y="618" width="138" height="48" rx="14" fill="#3B7A57" />
  <text x="681" y="649" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">✓ Activa</text>

  <rect x="86" y="706" width="688" height="94" rx="20" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2" />
  <text x="114" y="746" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">👩 Medidas Mamá — Blusa y Falda</text>
  <text x="114" y="778" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#5C554E">Busto: 98 cm • Cintura: 82 cm • Cadera: 104 cm • Talle: 43 cm</text>
  <rect x="612" y="728" width="138" height="48" rx="14" fill="#FAF6F0" stroke="#C85A32" stroke-width="2" />
  <text x="681" y="759" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#C85A32">Cargar</text>

  <text x="60" y="868" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">AJUSTE FINO EN CENTÍMETROS (SIN DECIMALES COMPLICADOS)</text>

  ${[
    { label: "1. Contorno de Busto / Pecho", val: "92 cm", sub: "Alrededor de la parte más saliente" },
    { label: "2. Contorno de Cintura", val: "72 cm", sub: "Donde atas el cordón guía en tu cintura" },
    { label: "3. Contorno de Cadera", val: "98 cm", sub: "Por la parte más prominente del glúteo" },
    { label: "4. Ancho de Espalda", val: "37 cm", sub: "De hueso a hueso de hombro por detrás" },
    { label: "5. Largo de Talle Delantero", val: "42 cm", sub: "De base del cuello a cintura pasando por busto" },
    { label: "6. Largo de Falda Deseado", val: "68 cm", sub: "Desde la cintura hasta el largo midi" },
  ]
    .map((m, idx) => {
      const y = 890 + idx * 108;
      return `
      <rect x="60" y="${y}" width="740" height="94" rx="22" fill="#FAF8F5" stroke="#E2E8F0" stroke-width="2" />
      <text x="88" y="${y + 40}" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#0F172A">${m.label}</text>
      <text x="88" y="${y + 70}" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="500" fill="#64748B">${m.sub}</text>

      <rect x="506" y="${y + 15}" width="64" height="64" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
      <text x="538" y="${y + 58}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="800" fill="#334155">−</text>

      <rect x="580" y="${y + 15}" width="128" height="64" rx="16" fill="#FFFFFF" stroke="#C85A32" stroke-width="2.5" />
      <text x="644" y="${y + 56}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="900" fill="#C85A32">${m.val}</text>

      <rect x="718" y="${y + 15}" width="64" height="64" rx="16" fill="#E11D48" />
      <text x="750" y="${y + 58}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="800" fill="#FFFFFF">+</text>
      `;
    })
    .join("")}

  <rect x="60" y="1552" width="740" height="84" rx="22" fill="#3B7A57" />
  <text x="430" y="1604" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF">✓ Molde Recalculado en Tiempo Real → Ver Piezas</text>
</svg>
`;

const svg03 = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FAF8F5" />
  ${commonHeader("generador")}

  <rect x="28" y="222" width="804" height="1446" rx="34" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />

  <rect x="60" y="254" width="740" height="82" rx="22" fill="#ECFDF5" stroke="#34D399" stroke-width="2.5" />
  <text x="94" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#065F46">✓ COSTURAS VERIFICADAS AL MILÍMETRO (1:1)</text>
  <text x="94" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#047857">Costados: 42.0 cm = 42.0 cm • Hombros: 13.0 cm = 13.0 cm • Margen: +1.0 cm</text>

  <rect x="60" y="356" width="740" height="840" rx="28" fill="#FAF6F0" stroke="#C85A32" stroke-width="3" />

  <g stroke="#CBD5E1" stroke-width="2" stroke-dasharray="10 8">
    <line x1="306" y1="356" x2="306" y2="1196" />
    <line x1="553" y1="356" x2="553" y2="1196" />
    <line x1="60" y1="776" x2="800" y2="776" />
  </g>

  <text x="82" y="392" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#94A3B8">HOJA F1-C1 (Carta)</text>
  <text x="326" y="392" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#94A3B8">HOJA F1-C2</text>
  <text x="574" y="392" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#94A3B8">HOJA F1-C3</text>
  <text x="82" y="812" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#94A3B8">HOJA F2-C1</text>
  <text x="326" y="812" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#94A3B8">HOJA F2-C2</text>
  <text x="574" y="812" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#94A3B8">HOJA F2-C3</text>

  <rect x="86" y="412" width="96" height="96" fill="#F2F7F4" stroke="#3B7A57" stroke-width="3" />
  <text x="134" y="456" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="800" fill="#1E3F2D">CUADRO</text>
  <text x="134" y="478" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="900" fill="#3B7A57">5×5 cm</text>

  <path d="M100 540 L210 520 L285 690 L268 752 L100 752 Z" fill="#FFFFFF" stroke="#2D2A26" stroke-width="3.5" />
  <path d="M110 550 L204 533 L273 688 L258 742 L110 742 Z" fill="none" stroke="#C85A32" stroke-width="2.5" stroke-dasharray="7 5" />
  <text x="186" y="646" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#2D2A26">DELANTERO</text>
  <text x="186" y="670" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="#C85A32">Cortar 2 • Margen 1 cm</text>
  <line x1="145" y1="585" x2="145" y2="720" stroke="#0D9488" stroke-width="2.5" />

  <path d="M336 430 L470 430 C478 492, 502 520, 526 528 L514 748 L336 748 Z" fill="#FFFFFF" stroke="#2D2A26" stroke-width="3.5" />
  <path d="M336 442 L460 442 C468 498, 490 524, 514 532 L502 736 L336 736 Z" fill="none" stroke="#C85A32" stroke-width="2.5" stroke-dasharray="7 5" />
  <line x1="336" y1="430" x2="336" y2="748" stroke="#3B7A57" stroke-width="6" />
  <text x="425" y="598" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#2D2A26">ESPALDA</text>
  <text x="425" y="622" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="800" fill="#3B7A57">x1 AL DOBLEZ</text>

  <path d="M582 444 C640 422, 718 422, 768 444 L752 726 L598 726 Z" fill="#FFFFFF" stroke="#2D2A26" stroke-width="3.5" />
  <path d="M594 454 C644 434, 714 434, 756 454 L742 714 L608 714 Z" fill="none" stroke="#C85A32" stroke-width="2.5" stroke-dasharray="7 5" />
  <text x="675" y="582" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#2D2A26">MANGA KIMONO</text>
  <text x="675" y="606" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="#C85A32">Cortar 2 piezas</text>

  <path d="M100 838 L690 822 L758 1156 L100 1156 Z" fill="#FFFFFF" stroke="#2D2A26" stroke-width="3.5" />
  <path d="M100 850 L678 836 L742 1142 L100 1142 Z" fill="none" stroke="#C85A32" stroke-width="2.5" stroke-dasharray="7 5" />
  <line x1="100" y1="838" x2="100" y2="1156" stroke="#3B7A57" stroke-width="6" />
  <text x="420" y="990" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#2D2A26">FALDA MIDI EVASÉ (68 cm)</text>
  <text x="420" y="1024" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#C85A32">Hilo de la tela paralelo al orillo • Incluye piquetes de cintura</text>

  <rect x="60" y="1220" width="740" height="176" rx="24" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <text x="92" y="1264" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">📦 RESUMEN DE IMPRESIÓN Y TELA</text>
  <text x="92" y="1302" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#3B7A57">• Tela necesaria (Rollo 150 cm): 2.10 metros</text>
  <text x="92" y="1336" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" fill="#5C554E">• Formato seleccionado: Hoja Carta (21.6 × 27.9 cm) • 12 páginas</text>
  <text x="92" y="1370" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="700" fill="#C85A32">• Incluye Guía de Confección paso a paso y mapa de pegado</text>

  <rect x="60" y="1424" width="740" height="104" rx="28" fill="#E11D48" />
  <text x="430" y="1486" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF">📥 Descargar Molde PDF 1:1 (Carta / A4)</text>

  <rect x="60" y="1548" width="740" height="84" rx="22" fill="#F2F7F4" stroke="#3B7A57" stroke-width="2" />
  <text x="430" y="1600" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#1E3F2D">📄 Descargar solo Ficha de Corte e Insumos</text>
</svg>
`;

const svg04 = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FAF8F5" />
  ${commonHeader("taller")}

  <rect x="28" y="222" width="804" height="1446" rx="34" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />

  <g transform="translate(56, 252)">
    <rect x="0" y="0" width="364" height="68" rx="18" fill="#E11D48" />
    <text x="182" y="42" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">💰 1. ¿Cuánto cobrar?</text>

    <rect x="380" y="0" width="368" height="68" rx="18" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
    <text x="564" y="42" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="#2D2A26">⭕ 2. Faldas y Plan Corte</text>
  </g>

  <text x="60" y="374" font-family="Segoe UI, Arial, sans-serif" font-size="31" font-weight="800" fill="#2D2A26">Cotizador Profesional de Costura</text>
  <text x="60" y="410" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="500" fill="#5C554E">Cobra lo justo por tus materiales, tu tiempo real y la ganancia de tu taller</text>

  <rect x="60" y="438" width="740" height="134" rx="22" fill="#FAF8F5" stroke="#E2E8F0" stroke-width="2" />
  <text x="90" y="480" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#0F172A">1. Tela e Insumos (Hilo, cierre, botones, entretela)</text>
  <text x="90" y="518" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="#475569">2.10 m × $18.000/m ($37.800) + Avíos ($12.500)</text>
  <text x="770" y="514" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="900" fill="#0F172A">$50.300</text>

  <rect x="60" y="590" width="740" height="134" rx="22" fill="#FAF8F5" stroke="#E2E8F0" stroke-width="2" />
  <text x="90" y="632" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#0F172A">2. Tu Mano de Obra (Patronaje, Corte, Costura y Prueba)</text>
  <text x="90" y="670" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="#475569">4.5 horas totales × $16.000 valor por hora</text>
  <text x="770" y="666" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="900" fill="#0D9488">$72.000</text>

  <rect x="60" y="742" width="740" height="120" rx="22" fill="#FAF8F5" stroke="#E2E8F0" stroke-width="2" />
  <text x="90" y="784" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#0F172A">3. Luz, Agujas y Mantenimiento (15%) + Margen Taller (25%)</text>
  <rect x="90" y="808" width="300" height="16" rx="8" fill="#E2E8F0" />
  <rect x="90" y="808" width="150" height="16" rx="8" fill="#0D9488" />
  <circle cx="240" cy="816" r="14" fill="#0D9488" />
  <rect x="440" y="808" width="320" height="16" rx="8" fill="#E2E8F0" />
  <rect x="440" y="808" width="180" height="16" rx="8" fill="#E11D48" />
  <circle cx="620" cy="816" r="14" fill="#E11D48" />

  <rect x="60" y="890" width="740" height="560" rx="30" fill="#0F172A" />
  <text x="100" y="946" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#FBBF24">RESUMEN FINANCIERO • VESTIDO CRUZADO DAMA</text>

  <text x="100" y="1000" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#CBD5E1">Costo Total de Materiales</text>
  <text x="760" y="1000" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF">$50.300</text>

  <text x="100" y="1050" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#CBD5E1">Pago por tu Mano de Obra (4.5 h)</text>
  <text x="760" y="1050" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#5EEAD4">$72.000</text>

  <text x="100" y="1100" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#CBD5E1">Desgaste de Máquina y Luz (15%)</text>
  <text x="760" y="1100" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#E2E8F0">$18.345</text>

  <text x="100" y="1150" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#CBD5E1">Ganancia Neta del Taller (25%)</text>
  <text x="760" y="1150" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#FCD34D">$35.160</text>

  <line x1="100" y1="1182" x2="760" y2="1182" stroke="#334155" stroke-width="2" />

  <rect x="96" y="1208" width="668" height="198" rx="24" fill="#1E293B" stroke="#F43F5E" stroke-width="3" />
  <text x="430" y="1252" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#FDA4AF">PRECIO FINAL SUGERIDO AL CLIENTE</text>
  <text x="430" y="1332" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="900" fill="#FFFFFF">$175.800</text>
  <text x="430" y="1380" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#34D399">Anticipo sugerido (50% al tomar medidas): $87.900</text>

  <rect x="60" y="1482" width="740" height="104" rx="28" fill="#059669" />
  <text x="430" y="1544" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="900" fill="#FFFFFF">📲 Enviar Cotización Formal por WhatsApp</text>
</svg>
`;

const svg05 = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FAF8F5" />
  ${commonHeader("taller")}

  <rect x="28" y="222" width="804" height="710" rx="32" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />
  <rect x="60" y="252" width="380" height="42" rx="21" fill="#F2F7F4" stroke="#C4DDD0" stroke-width="2" />
  <text x="250" y="280" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#1E3F2D">⭕ CALCULADORA DE FALDA CIRCULAR</text>

  <text x="60" y="336" font-family="Segoe UI, Arial, sans-serif" font-size="29" font-weight="800" fill="#2D2A26">Medio Plato (180°) • Cintura 72 cm</text>

  <rect x="60" y="362" width="430" height="534" rx="24" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <path d="M110 420 L440 420 A330 330 0 0 1 110 750 Z" fill="#FDF3EE" stroke="#2D2A26" stroke-width="3.5" />
  <path d="M110 420 L235 420 A125 125 0 0 1 110 545 Z" fill="#FAF6F0" stroke="#C85A32" stroke-width="4" stroke-dasharray="8 5" />
  <circle cx="110" cy="420" r="8" fill="#E11D48" />
  <text x="195" y="492" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="900" fill="#C85A32">R = 21.9 cm</text>
  <text x="275" y="620" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#2D2A26">Largo = 65 cm</text>
  <text x="275" y="836" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#3B7A57">✓ Radio total al ruedo: 88.4 cm</text>

  <rect x="512" y="362" width="290" height="162" rx="22" fill="#FDF3EE" stroke="#C85A32" stroke-width="2.5" />
  <text x="657" y="408" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#6E2B14">RADIO DE CINTURA (R)</text>
  <text x="657" y="472" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="900" fill="#C85A32">21.9 cm</text>
  <text x="657" y="506" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="#5C2612">Con descuento anti-sesgo</text>

  <rect x="512" y="544" width="290" height="162" rx="22" fill="#F2F7F4" stroke="#3B7A57" stroke-width="2.5" />
  <text x="657" y="590" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#1E3F2D">TELA A COMPRAR (150 CM)</text>
  <text x="657" y="654" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="900" fill="#3B7A57">1.85 m</text>
  <text x="657" y="688" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="#264735">Incluye pretina de 8 cm</text>

  <rect x="512" y="726" width="290" height="170" rx="22" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <text x="657" y="772" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#2D2A26">💡 Consejo de Taller</text>
  <text x="657" y="808" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#5C554E">Cuelga la falda 24 h antes</text>
  <text x="657" y="834" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#5C554E">de coser el dobladillo.</text>

  <rect x="28" y="958" width="804" height="710" rx="32" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />
  <rect x="60" y="988" width="430" height="42" rx="21" fill="#FFF1F2" stroke="#FECDD3" stroke-width="2" />
  <text x="275" y="1016" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#BE123C">📐 SIMULADOR DE PLAN DE CORTE (150 CM)</text>

  <text x="60" y="1072" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800" fill="#2D2A26">Acomodo óptimo sobre el rollo de tela</text>

  <rect x="60" y="1098" width="740" height="330" rx="22" fill="#FAF6F0" stroke="#3B7A57" stroke-width="3" />
  <text x="86" y="1132" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#3B7A57">DOBLEZ DE LA TELA (LOMO) • ANCHO ÚTIL 150 CM</text>

  <rect x="86" y="1150" width="230" height="120" rx="14" fill="#F2F7F4" stroke="#2D2A26" stroke-width="2.5" />
  <text x="201" y="1216" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#1E3F2D">ESPALDA (Doblez)</text>

  <rect x="334" y="1150" width="230" height="120" rx="14" fill="#FDF3EE" stroke="#C85A32" stroke-width="2.5" />
  <text x="449" y="1216" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#6E2B14">DELANTERO ×2</text>

  <rect x="582" y="1150" width="192" height="250" rx="14" fill="#EFF6FF" stroke="#2563EB" stroke-width="2.5" />
  <text x="678" y="1282" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#1E40AF">FALDA ×2</text>

  <rect x="86" y="1286" width="280" height="114" rx="14" fill="#FEF3C7" stroke="#D97706" stroke-width="2.5" />
  <text x="226" y="1350" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#92400E">MANGA KIMONO ×2</text>

  <rect x="384" y="1286" width="180" height="114" rx="14" fill="#F3E8FF" stroke="#7C3AED" stroke-width="2.5" />
  <text x="474" y="1350" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#5B21B6">VISTAS Y LAZO</text>

  <rect x="60" y="1454" width="740" height="178" rx="24" fill="#0F172A" />
  <text x="94" y="1500" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#5EEAD4">📒 LIBRETA DE CLIENTAS Y PEDIDOS ACTIVOS</text>
  <text x="94" y="1542" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF">Clienta Ana • Vestido Cruzado • Entrega: Viernes</text>
  <text x="94" y="1584" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#FBBF24">Total: $175.800 • Abono recibido: $90.000 • Saldo: $85.800</text>
</svg>
`;

const svg06 = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FAF8F5" />
  <rect x="0" y="0" width="580" height="10" fill="#C85A32" />
  ${commonHeader("blog")}

  <rect x="28" y="218" width="804" height="250" rx="30" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />
  <rect x="60" y="246" width="220" height="40" rx="20" fill="#FAF6F0" stroke="#E5DCD0" stroke-width="2" />
  <text x="170" y="272" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#C85A32">Telas y Materiales</text>
  <text x="304" y="272" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#64748B">⏱ 6 min de lectura</text>

  <text x="60" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="900" fill="#2D2A26">Tabla definitiva: ¿Cuánta tela comprar</text>
  <text x="60" y="368" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="900" fill="#2D2A26">según la prenda y la talla? (XS a XL)</text>
  <text x="60" y="416" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="#5C554E">Cuaderno Visual de Taller • Diagramas Sí vs. No + Calculadora</text>

  <rect x="28" y="490" width="804" height="296" rx="30" fill="#FAF6F0" stroke="#E8DFD3" stroke-width="2.5" />
  <rect x="28" y="490" width="14" height="296" rx="6" fill="#C85A32" />
  <text x="68" y="542" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="900" fill="#2D2A26">⚡ En 15 segundos (Lo esencial)</text>

  <circle cx="84" cy="592" r="18" fill="#C85A32" />
  <text x="84" y="599" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">1</text>
  <text x="118" y="599" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="#2D2A26">Blusa básica (XS–M): 1.10 m en rollo de 150 cm.</text>

  <circle cx="84" cy="654" r="18" fill="#C85A32" />
  <text x="84" y="661" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">2</text>
  <text x="118" y="661" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="#2D2A26">Vestido midi o pantalón (M): 1.80 m a 2.20 m.</text>

  <circle cx="84" cy="716" r="18" fill="#C85A32" />
  <text x="84" y="723" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">3</text>
  <text x="118" y="723" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="#2D2A26">Suma +15 cm/m si es lino, rayón o algodón 100%.</text>

  <rect x="28" y="810" width="804" height="430" rx="30" fill="#FFFFFF" stroke="#E5DCD0" stroke-width="2.5" />
  <text x="60" y="858" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" fill="#2D2A26">Ilustración Técnica: Cómo alinear la pieza al doblez</text>

  <rect x="56" y="882" width="360" height="328" rx="22" fill="#F2F7F4" stroke="#3B7A57" stroke-width="3" />
  <text x="236" y="924" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="900" fill="#1E3F2D">✅ PEGADO AL DOBLEZ</text>
  <rect x="96" y="948" width="280" height="190" fill="#FFFFFF" stroke="#94A3B8" stroke-width="2" />
  <line x1="96" y1="948" x2="96" y2="1138" stroke="#3B7A57" stroke-width="8" />
  <path d="M96 966 L210 966 C220 996, 250 1010, 282 992 L302 1120 L96 1120 Z" fill="#DCFCE7" stroke="#2D2A26" stroke-width="3" />
  <text x="195" y="1056" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#1E3F2D">x1 AL DOBLEZ</text>
  <text x="236" y="1178" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#3B7A57">✓ Sale pieza entera simétrica</text>

  <rect x="444" y="882" width="360" height="328" rx="22" fill="#FDF3EE" stroke="#C85A32" stroke-width="3" />
  <text x="624" y="924" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="900" fill="#6E2B14">❌ SEPARADO (ERROR)</text>
  <rect x="484" y="948" width="280" height="190" fill="#FFFFFF" stroke="#94A3B8" stroke-width="2" />
  <line x1="484" y1="948" x2="484" y2="1138" stroke="#C85A32" stroke-width="8" />
  <path d="M532 966 L646 966 C656 996, 686 1010, 718 992 L738 1120 L532 1120 Z" fill="#FFEDD5" stroke="#2D2A26" stroke-width="3" />
  <text x="630" y="1056" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#C85A32">+3 cm sobrantes</text>
  <text x="624" y="1178" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#C85A32">✗ Deforma el ancho del escote</text>

  <rect x="28" y="1264" width="804" height="404" rx="30" fill="#FFFFFF" stroke="#C85A32" stroke-width="3" />
  <text x="60" y="1312" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#C85A32">MINI-HERRAMIENTA INTERACTIVA EN EL ARTÍCULO</text>
  <text x="60" y="1350" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="900" fill="#2D2A26">Calculador Rápido: ¿Cuánta tela compro hoy?</text>

  <rect x="60" y="1378" width="356" height="156" rx="22" fill="#F2F7F4" stroke="#3B7A57" stroke-width="2.5" />
  <text x="238" y="1420" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#1E3F2D">EN TELA DE 150 CM (DOBLE ANCHO)</text>
  <text x="238" y="1488" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="900" fill="#3B7A57">1.80 m</text>

  <rect x="444" y="1378" width="356" height="156" rx="22" fill="#FDF3EE" stroke="#C85A32" stroke-width="2.5" />
  <text x="622" y="1420" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#6E2B14">EN TELA DE 140 CM</text>
  <text x="622" y="1488" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="900" fill="#C85A32">2.05 m</text>

  <rect x="60" y="1558" width="740" height="82" rx="22" fill="#E11D48" />
  <text x="430" y="1609" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#FFFFFF">✂️ Abrir el Generador con esta prenda →</text>
</svg>
`;

const screens = [
  { file: "01-foto-ia.png", svg: svg01 },
  { file: "02-medidas-guardadas.png", svg: svg02 },
  { file: "03-molde-pdf.png", svg: svg03 },
  { file: "04-cotizador-taller.png", svg: svg04 },
  { file: "05-falda-plan-corte.png", svg: svg05 },
  { file: "06-revista-guias.png", svg: svg06 },
];

for (const item of screens) {
  const outPath = path.join(outDir, item.file);
  await sharp(Buffer.from(item.svg))
    .png({ compressionLevel: 8 })
    .toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(`Generated ${item.file} (${stat.size} bytes)`);
}
