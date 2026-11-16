import {
  AccessorySubStyle,
  FabricType,
  Measurements,
  PathCommand,
  PatternPiece,
  PatternResult,
  SeamAllowance,
} from "../types";
import {
  estimateFabricMeters,
  normalizePiece,
  packPiecesOnSheet,
} from "./geometry";

export interface AccessoriesEngineInput {
  measurements: Measurements;
  subStyle: AccessorySubStyle;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
}

/**
 * Helper to build a circular or annular sector (conical frustum unrolled in 2D)
 * with inner arc length `innerArcLen`, radial width `bandWidth`, and chord curvature drop `archDrop`.
 */
function buildCurvedBandCommands(params: {
  innerSpanX: number;
  outerSpanX: number;
  bandHeight: number;
  archDrop: number;
}): PathCommand[] {
  const { innerSpanX, outerSpanX, bandHeight, archDrop } = params;
  return [
    { type: "M", x: 0, y: archDrop },
    {
      type: "C",
      cp1x: innerSpanX * 0.36,
      cp1y: archDrop,
      cp2x: innerSpanX * 0.72,
      cp2y: archDrop * 0.38,
      x: innerSpanX,
      y: 0,
    },
    { type: "L", x: outerSpanX, y: bandHeight },
    {
      type: "C",
      cp1x: outerSpanX * 0.72,
      cp1y: bandHeight + archDrop * 0.42,
      cp2x: outerSpanX * 0.36,
      cp2y: bandHeight + archDrop * 1.05,
      x: 0,
      y: bandHeight + archDrop * 1.05,
    },
    { type: "Z" },
  ];
}

export function generateAccessoriesPattern(
  input: AccessoriesEngineInput
): PatternResult {
  const { measurements, subStyle, seamAllowance } = input;
  const pieces: PatternPiece[] = [];

  if (subStyle === "bucket_hat") {
    // =========================================================================
    // 1. SOMBRERO PESCADOR (BUCKET HAT):
    //    - Corona superior circular (2πR = contorno superior)
    //    - Banda lateral inclinada (x2 al doblez)
    //    - Ala caída (x2 al doblez)
    // =========================================================================
    const rawHead = Math.min(64, Math.max(48, measurements.headCircumference ?? 57));
    const effHead = rawHead + 1.5; // +1.5 cm comfort ease
    const crownCircumference = effHead - 2.4; // Top of crown is slightly narrower for tapered bucket slope
    const crownRadius = Number((crownCircumference / (2 * Math.PI)).toFixed(2));
    const k = Number((crownRadius * 0.55228475).toFixed(2));
    const r = crownRadius;

    // Full circle drawn with 4 cubic Bézier quarter-arcs centered at (r, r)
    const crownSeam: PathCommand[] = [
      { type: "M", x: r, y: 0 },
      { type: "C", cp1x: r + k, cp1y: 0, cp2x: 2 * r, cp2y: r - k, x: 2 * r, y: r },
      { type: "C", cp1x: 2 * r, cp1y: r + k, cp2x: r + k, cp2y: 2 * r, x: r, y: 2 * r },
      { type: "C", cp1x: r - k, cp1y: 2 * r, cp2x: 0, cp2y: r + k, x: 0, y: r },
      { type: "C", cp1x: 0, cp1y: r - k, cp2x: r - k, cp2y: 0, x: r, y: 0 },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "bucket_crown",
          name: "CORONA SUPERIOR CIRCULAR (x1 exterior + x1 forro)",
          subtitle: `Diámetro: ${(r * 2).toFixed(1)} cm | Contorno cabeza: ${rawHead} cm`,
          tabLabel: "Corona Superior",
          seamPath: crownSeam,
          grainline: { x1: r, y1: 2.2, x2: r, y2: 2 * r - 2.2 },
          notches: [
            { x: r, y: 0, angle: -90, label: "Frente" },
            { x: r, y: 2 * r, angle: 90, label: "Atrás" },
            { x: 0, y: r, angle: 180, label: "Costado Izq." },
            { x: 2 * r, y: r, angle: 0, label: "Costado Der." },
          ],
          labelPos: { x: r, y: r },
        },
        seamAllowance
      )
    );

    // 2. Banda Lateral Inclinada (cortar x2 al doblez: 1 delantera + 1 trasera, o x2 tela + x2 forro)
    const bandTopArc = Number((crownCircumference / 4).toFixed(2));
    const bandBotArc = Number((effHead / 4).toFixed(2));
    const bandHeight = 8.5;
    const bandArch = 2.4;

    const bandSeam = buildCurvedBandCommands({
      innerSpanX: bandTopArc,
      outerSpanX: bandBotArc + 1.2,
      bandHeight,
      archDrop: bandArch,
    });

    pieces.push(
      normalizePiece(
        {
          id: "bucket_band",
          name: "BANDA LATERAL INCLINADA (x2 al doblez)",
          subtitle: `Alto: ${bandHeight} cm | Arco sup: ${(bandTopArc * 4).toFixed(1)} cm → inf: ${effHead.toFixed(1)} cm`,
          tabLabel: "Banda Lateral",
          seamPath: bandSeam,
          grainline: {
            x1: bandTopArc * 0.48,
            y1: bandArch + 1.5,
            x2: bandTopArc * 0.48,
            y2: bandHeight + bandArch - 1.5,
          },
          notches: [
            { x: 0, y: bandArch, angle: -90, label: "Centro Frente/Atrás" },
            { x: bandTopArc, y: 0, angle: 0, label: "Costado corona" },
            { x: bandBotArc + 1.2, y: bandHeight, angle: 0, label: "Unión ala" },
          ],
          labelPos: { x: bandTopArc * 0.52, y: bandArch + bandHeight * 0.52 },
          labelAngle: 0,
          labelMaxSpanCm: bandTopArc - 2,
          labelBandWidthCm: bandHeight,
          foldLine: { x1: 0, y1: bandArch, x2: 0, y2: bandHeight + bandArch * 1.05 },
        },
        seamAllowance
      )
    );

    // 3. Ala Caída (Brim — cortar x2 al doblez en tela exterior + x2 en forro/entretela)
    const brimInnerArc = bandBotArc;
    const brimOuterArc = Number((brimInnerArc + 4.2).toFixed(2));
    const brimWidth = 6.5;
    const brimArch = 3.2;

    const brimSeam = buildCurvedBandCommands({
      innerSpanX: brimInnerArc,
      outerSpanX: brimOuterArc,
      bandHeight: brimWidth,
      archDrop: brimArch,
    });

    pieces.push(
      normalizePiece(
        {
          id: "bucket_brim",
          name: "ALA CAÍDA SOMBRERO (x2 al doblez)",
          subtitle: `Ancho de ala: ${brimWidth} cm | Encaja con banda (${effHead.toFixed(1)} cm)`,
          tabLabel: "Ala Caída",
          seamPath: brimSeam,
          grainline: {
            x1: brimInnerArc * 0.48,
            y1: brimArch + 1.2,
            x2: brimInnerArc * 0.48,
            y2: brimWidth + brimArch - 1.2,
          },
          notches: [
            { x: 0, y: brimArch, angle: -90, label: "Centro Ala" },
            { x: brimInnerArc, y: 0, angle: 0, label: "Costado unión" },
          ],
          labelPos: { x: brimInnerArc * 0.52, y: brimArch + brimWidth * 0.52 },
          labelAngle: 0,
          labelMaxSpanCm: brimInnerArc - 2,
          labelBandWidthCm: brimWidth,
          foldLine: { x1: 0, y1: brimArch, x2: 0, y2: brimWidth + brimArch * 1.05 },
        },
        seamAllowance
      )
    );
  } else if (subStyle === "apron") {
    // =========================================================================
    // 2. DELANTAL DE COCINA / TALLER:
    //    - Cuerpo principal al doblez con curva ergonómica en sisa
    //    - Bolsillo delantero dividido
    //    - Kit de tiras de cuello y cintura
    // =========================================================================
    const bibHalfW = 13.5;
    const bodyHalfW = Math.max(30, Math.round(measurements.hip * 0.34));
    const bibArmholeY = 26;
    const totalLen = 78;

    const apronBodySeam: PathCommand[] = [
      { type: "M", x: 0, y: 0 },
      { type: "L", x: bibHalfW, y: 0 },
      // Ergonomic curved armhole sweep from bib top out to waist wrap
      {
        type: "C",
        cp1x: bibHalfW,
        cp1y: bibArmholeY * 0.58,
        cp2x: bodyHalfW * 0.62,
        cp2y: bibArmholeY,
        x: bodyHalfW,
        y: bibArmholeY,
      },
      { type: "L", x: bodyHalfW, y: totalLen },
      { type: "L", x: 0, y: totalLen },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "apron_body",
          name: "CUERPO PRINCIPAL DELANTAL (x1 al doblez)",
          subtitle: `Ancho total: ${bodyHalfW * 2} cm × Largo: ${totalLen} cm`,
          tabLabel: "Cuerpo Delantal",
          seamPath: apronBodySeam,
          grainline: { x1: bibHalfW * 0.55, y1: 6, x2: bibHalfW * 0.55, y2: totalLen - 6 },
          notches: [
            { x: bibHalfW - 1.5, y: 0, angle: -90, label: "Tira cuello" },
            { x: bodyHalfW, y: bibArmholeY, angle: 0, label: "Tira cintura" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: bibArmholeY + 8 },
                { type: "L", x: 19, y: bibArmholeY + 8 },
                { type: "L", x: 19, y: bibArmholeY + 28 },
                { type: "L", x: 0, y: bibArmholeY + 28 },
              ],
              style: "mark",
              label: "Ubicación bolsillo",
              labelPos: { x: 9.5, y: bibArmholeY + 18 },
            },
          ],
          labelPos: { x: bodyHalfW * 0.48, y: totalLen * 0.65 },
          foldLine: { x1: 0, y1: 0, x2: 0, y2: totalLen },
        },
        seamAllowance
      )
    );

    // Bolsillo delantero dividido (con costura central para herramientas/recetas)
    const pocketHalfW = 19;
    const pocketH = 21;
    pieces.push(
      normalizePiece(
        {
          id: "apron_pocket",
          name: "BOLSILLO DELANTERO DIVIDIDO (x1 al doblez)",
          subtitle: `Ancho: ${pocketHalfW * 2} × ${pocketH} cm | Coser línea divisoria central`,
          tabLabel: "Bolsillo Dividido",
          seamPath: [
            { type: "M", x: 0, y: 0 },
            { type: "L", x: pocketHalfW, y: 0 },
            { type: "L", x: pocketHalfW, y: pocketH },
            { type: "L", x: 0, y: pocketH },
            { type: "Z" },
          ],
          grainline: { x1: pocketHalfW * 0.5, y1: 4, x2: pocketHalfW * 0.5, y2: pocketH - 3 },
          notches: [{ x: pocketHalfW, y: 2.5, angle: 0, label: "Dobladillo boca" }],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: 2.5 },
                { type: "L", x: pocketHalfW, y: 2.5 },
              ],
              style: "fold",
              label: "Doblar boca 2.5 cm",
              labelPos: { x: pocketHalfW * 0.5, y: 4.2 },
            },
            {
              commands: [
                { type: "M", x: pocketHalfW * 0.45, y: 2.5 },
                { type: "L", x: pocketHalfW * 0.45, y: pocketH },
              ],
              style: "mark",
              label: "Costura división",
              labelPos: { x: pocketHalfW * 0.45 + 1.2, y: pocketH * 0.58 },
            },
          ],
          labelPos: { x: pocketHalfW * 0.52, y: pocketH * 0.62 },
          foldLine: { x1: 0, y1: 0, x2: 0, y2: pocketH },
        },
        seamAllowance
      )
    );

    // Tiras de cuello y cintura
    const strapLen = 78;
    const strapH = 7.0;
    pieces.push(
      normalizePiece(
        {
          id: "apron_ties",
          name: "TIRAS DE CUELLO Y CINTURA (Cortar x3 tiras)",
          subtitle: `2 tiras cintura (78 cm) + 1 tira cuello (62 cm) × ${strapH} cm`,
          tabLabel: "Tiras Amarre",
          seamPath: [
            { type: "M", x: 0, y: 0 },
            { type: "L", x: strapLen, y: 0 },
            { type: "L", x: strapLen, y: strapH },
            { type: "L", x: 0, y: strapH },
            { type: "Z" },
          ],
          grainline: { x1: 6, y1: strapH / 2, x2: strapLen - 6, y2: strapH / 2 },
          notches: [{ x: 62, y: 0, angle: -90, label: "Largo tira cuello (62 cm)" }],
          labelPos: { x: strapLen * 0.48, y: strapH * 0.54 },
          labelAngle: 0,
          labelMaxSpanCm: strapLen - 10,
          labelBandWidthCm: strapH,
        },
        seamAllowance
      )
    );
  } else {
    // =========================================================================
    // 3. NECESER / CARTUCHERA CON FUELLE (Esquinas recortadas en caja 4.5 × 4.5 cm)
    // =========================================================================
    const pouchW = 28; // Finished length ~19 cm + 2 * 4.5 cm box depth
    const pouchH = 18; // Half-panel height (cut x2 or 1 full folded sheet)
    const boxCut = 4.5; // 4.5 x 4.5 cm corner cutout creates a 9 cm 3D box gusset!

    // Cross / T-box shape with all 4 corners notched out 4.5 x 4.5 cm
    const pouchSeam: PathCommand[] = [
      { type: "M", x: boxCut, y: 0 },
      { type: "L", x: pouchW - boxCut, y: 0 },
      { type: "L", x: pouchW - boxCut, y: boxCut },
      { type: "L", x: pouchW, y: boxCut },
      { type: "L", x: pouchW, y: pouchH - boxCut },
      { type: "L", x: pouchW - boxCut, y: pouchH - boxCut },
      { type: "L", x: pouchW - boxCut, y: pouchH },
      { type: "L", x: boxCut, y: pouchH },
      { type: "L", x: boxCut, y: pouchH - boxCut },
      { type: "L", x: 0, y: pouchH - boxCut },
      { type: "L", x: 0, y: boxCut },
      { type: "L", x: boxCut, y: boxCut },
      { type: "Z" },
    ];

    pieces.push(
      normalizePiece(
        {
          id: "pouch_body",
          name: "CUERPO NECESER CON FUELLE (x2 Exterior + x2 Forro)",
          subtitle: `Esquinas en caja de ${boxCut}×${boxCut} cm para fondo 3D de ${boxCut * 2} cm`,
          tabLabel: "Cuerpo Fuelle",
          seamPath: pouchSeam,
          grainline: { x1: pouchW / 2, y1: 3, x2: pouchW / 2, y2: pouchH - 3 },
          notches: [
            { x: pouchW / 2, y: 0, angle: -90, label: "Cierre / Cremallera (22 cm)" },
            { x: pouchW / 2, y: pouchH, angle: 90, label: "Base fondo" },
            { x: boxCut, y: boxCut, angle: 180, label: "Esquina fuelle" },
            { x: pouchW - boxCut, y: boxCut, angle: 0, label: "Esquina fuelle" },
          ],
          internalLines: [
            {
              commands: [
                { type: "M", x: boxCut, y: pouchH - boxCut },
                { type: "L", x: pouchW - boxCut, y: pouchH - boxCut },
              ],
              style: "fold",
              label: "Línea de quiebre base 3D",
              labelPos: { x: pouchW / 2, y: pouchH - boxCut - 1.2 },
            },
          ],
          labelPos: { x: pouchW / 2, y: pouchH * 0.46 },
        },
        seamAllowance
      )
    );

    // Tiradores laterales de cierre (Zipper pull tabs)
    const tabW = 8;
    const tabH = 10;
    pieces.push(
      normalizePiece(
        {
          id: "pouch_tabs",
          name: "TIRADORES LATERALES DE CIERRE (x2)",
          subtitle: `Cortar 2 cuadros (${tabW} × ${tabH} cm) y doblar en 4`,
          tabLabel: "Tiradores",
          seamPath: [
            { type: "M", x: 0, y: 0 },
            { type: "L", x: tabW, y: 0 },
            { type: "L", x: tabW, y: tabH },
            { type: "L", x: 0, y: tabH },
            { type: "Z" },
          ],
          grainline: { x1: tabW / 2, y1: 2, x2: tabW / 2, y2: tabH - 2 },
          notches: [{ x: tabW / 2, y: 0, angle: -90, label: "Extremo cierre" }],
          internalLines: [
            {
              commands: [
                { type: "M", x: 0, y: tabH / 2 },
                { type: "L", x: tabW, y: tabH / 2 },
              ],
              style: "fold",
              label: "Doblar mitad",
              labelPos: { x: tabW / 2, y: tabH * 0.35 },
            },
          ],
          labelPos: { x: tabW / 2, y: tabH * 0.65 },
        },
        seamAllowance
      )
    );
  }

  const subLabels: Record<AccessorySubStyle, string> = {
    bucket_hat: "Sombrero Pescador (Bucket Hat — 3 Piezas)",
    apron: "Delantal de Cocina / Taller con Bolsillo Dividido",
    zipper_pouch: "Neceser / Cartuchera 3D con Fuelle en Caja",
  };

  return {
    category: "accessories",
    subStyleLabel: subLabels[subStyle],
    pieces,
    fabricConsumption: {
      width140m: estimateFabricMeters(pieces, 140),
      width150m: estimateFabricMeters(pieces, 150),
    },
    totalBoundsCm: packPiecesOnSheet(pieces, 5),
    appliedEaseLabel:
      subStyle === "bucket_hat"
        ? `Geometría circular exacta (Cabeza ${(measurements.headCircumference ?? 57)} cm + 1.5 cm holgura)`
        : "Trazado técnico para lona, dril o gabardina",
  };
}
