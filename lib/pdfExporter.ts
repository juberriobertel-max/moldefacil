import { jsPDF } from "jspdf";
import {
  FabricType,
  Measurements,
  PaperFormat,
  PathCommand,
  PatternPiece,
  PatternResult,
  Point2D,
  SeamAllowance,
} from "./types";
import { commandsToSvgPath, flattenPathToPoints } from "./garmentEngines/geometry";
import { generateSewingGuide } from "./sewingGuideGenerator";

export const PAPER_DIMENSIONS_MM: Record<
  PaperFormat,
  { width: number; height: number; label: string }
> = {
  letter: {
    width: 215.9,
    height: 279.4,
    label: "Carta / US Letter (215.9 × 279.4 mm)",
  },
  a4: { width: 210, height: 297, label: "A4 (210 × 297 mm)" },
  a0: { width: 841, height: 1189, label: "Ploter A0 / Copistería (841 × 1189 mm)" },
  projector: {
    width: 1200,
    height: 1600,
    label: "Proyector (Lámina continua sin cortes)",
  },
};

const PAGE_MARGIN_MM = 10;
const OVERLAP_MM = 10;

export interface TilingTile {
  row: number;
  col: number;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  isEmpty: boolean;
  sheetNumber: number | null;
}

export interface TilingGrid {
  cols: number;
  rows: number;
  printableWidthMm: number;
  printableHeightMm: number;
  stepXMm: number;
  stepYMm: number;
  tiles: TilingTile[];
  printableCount: number;
}

function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentIntersectsRect(
  a: Point2D,
  b: Point2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) {
    return false;
  }
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) {
      return true;
    }
  }
  return false;
}

function pieceIntersectsTile(
  piece: PatternPiece,
  polyWorld: Point2D[],
  tx: number,
  ty: number,
  tw: number,
  th: number
): boolean {
  if (
    piece.layoutX + piece.widthCm < tx ||
    piece.layoutX > tx + tw ||
    piece.layoutY + piece.heightCm < ty ||
    piece.layoutY > ty + th
  ) {
    return false;
  }

  for (let i = 0; i < polyWorld.length; i++) {
    const a = polyWorld[i];
    const b = polyWorld[(i + 1) % polyWorld.length];
    if (segmentIntersectsRect(a, b, tx, ty, tw, th)) {
      return true;
    }
  }

  if (pointInPolygon({ x: tx + tw / 2, y: ty + th / 2 }, polyWorld)) {
    return true;
  }
  return false;
}

/**
 * Computes the exact 1:1 tiling grid for Letter, A4, A0, or continuous Projector format.
 */
export function computeTilingGrid(
  totalWidthCm: number,
  totalHeightCm: number,
  format: PaperFormat,
  pieces?: PatternPiece[]
): TilingGrid {
  if (format === "projector") {
    const padCm = 25;
    const wCm = Math.max(80, totalWidthCm + padCm * 2);
    const hCm = Math.max(80, totalHeightCm + padCm * 2);
    return {
      cols: 1,
      rows: 1,
      printableWidthMm: wCm * 10,
      printableHeightMm: hCm * 10,
      stepXMm: wCm * 10,
      stepYMm: hCm * 10,
      tiles: [
        {
          row: 1,
          col: 1,
          xCm: -padCm,
          yCm: -padCm,
          widthCm: wCm,
          heightCm: hCm,
          isEmpty: false,
          sheetNumber: 1,
        },
      ],
      printableCount: 1,
    };
  }

  const { width: pageW, height: pageH } = PAPER_DIMENSIONS_MM[format];
  const printableWidthMm = pageW - PAGE_MARGIN_MM * 2;
  const printableHeightMm = pageH - PAGE_MARGIN_MM * 2;
  const stepXMm = printableWidthMm - OVERLAP_MM;
  const stepYMm = printableHeightMm - OVERLAP_MM;

  const totalWidthMm = Math.max(10, totalWidthCm * 10);
  const totalHeightMm = Math.max(10, totalHeightCm * 10);

  const cols = Math.max(
    1,
    Math.ceil(Math.max(0, totalWidthMm - OVERLAP_MM) / stepXMm)
  );
  const rows = Math.max(
    1,
    Math.ceil(Math.max(0, totalHeightMm - OVERLAP_MM) / stepYMm)
  );

  const piecePolys = pieces
    ? pieces.map((piece) => ({
        piece,
        poly: flattenPathToPoints(piece.cutPath).map((p) => ({
          x: p.x + piece.layoutX,
          y: p.y + piece.layoutY,
        })),
      }))
    : null;

  const tiles: TilingTile[] = [];
  let sheetCounter = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xCm = (c * stepXMm) / 10;
      const yCm = (r * stepYMm) / 10;
      const widthCm = printableWidthMm / 10;
      const heightCm = printableHeightMm / 10;

      const isEmpty = piecePolys
        ? !piecePolys.some(({ piece, poly }) =>
            pieceIntersectsTile(piece, poly, xCm, yCm, widthCm, heightCm)
          )
        : false;

      if (!isEmpty) {
        sheetCounter++;
      }

      tiles.push({
        row: r + 1,
        col: c + 1,
        xCm,
        yCm,
        widthCm,
        heightCm,
        isEmpty,
        sheetNumber: isEmpty ? null : sheetCounter,
      });
    }
  }

  return {
    cols,
    rows,
    printableWidthMm,
    printableHeightMm,
    stepXMm,
    stepYMm,
    tiles,
    printableCount: sheetCounter || tiles.length,
  };
}

function drawRegistrationCross(doc: jsPDF, x: number, y: number, size = 3.5) {
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.25);
  doc.line(x - size, y, x + size, y);
  doc.line(x, y - size, x, y + size);
  doc.circle(x, y, 1.3, "S");
}

function drawVectorPath(
  doc: jsPDF,
  commands: PathCommand[],
  offsetXmm: number,
  offsetYmm: number,
  scaleMmPerCm = 10,
  paintMode: "stroke" | "fillStroke" = "stroke"
) {
  let hasStarted = false;
  for (const cmd of commands) {
    if (cmd.type === "M") {
      doc.moveTo(
        offsetXmm + cmd.x * scaleMmPerCm,
        offsetYmm + cmd.y * scaleMmPerCm
      );
      hasStarted = true;
    } else if (cmd.type === "L") {
      doc.lineTo(
        offsetXmm + cmd.x * scaleMmPerCm,
        offsetYmm + cmd.y * scaleMmPerCm
      );
    } else if (cmd.type === "C") {
      doc.curveTo(
        offsetXmm + cmd.cp1x * scaleMmPerCm,
        offsetYmm + cmd.cp1y * scaleMmPerCm,
        offsetXmm + cmd.cp2x * scaleMmPerCm,
        offsetYmm + cmd.cp2y * scaleMmPerCm,
        offsetXmm + cmd.x * scaleMmPerCm,
        offsetYmm + cmd.y * scaleMmPerCm
      );
    } else if (cmd.type === "Z" && hasStarted) {
      doc.close();
    }
  }
  if (hasStarted) {
    if (paintMode === "fillStroke") {
      doc.fillStroke();
    } else {
      doc.stroke();
    }
  }
}

function renderPieceMarkingsToPdf(
  doc: jsPDF,
  piece: PatternPiece,
  pieceOffsetXmm: number,
  pieceOffsetYmm: number,
  seamAllowance: SeamAllowance,
  isProjector = false
) {
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(isProjector ? 0.85 : 0.45);
  doc.setLineDashPattern([], 0);
  drawVectorPath(doc, piece.cutPath, pieceOffsetXmm, pieceOffsetYmm, 10, "stroke");

  if (seamAllowance > 0) {
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(isProjector ? 0.5 : 0.3);
    doc.setLineDashPattern([3, 2], 0);
    drawVectorPath(doc, piece.seamPath, pieceOffsetXmm, pieceOffsetYmm, 10, "stroke");
    doc.setLineDashPattern([], 0);
  }

  if (piece.foldLine) {
    const fx1 = pieceOffsetXmm + piece.foldLine.x1 * 10;
    const fy1 = pieceOffsetYmm + piece.foldLine.y1 * 10;
    const fx2 = pieceOffsetXmm + piece.foldLine.x2 * 10;
    const fy2 = pieceOffsetYmm + piece.foldLine.y2 * 10;
    doc.setDrawColor(225, 29, 72);
    doc.setLineWidth(isProjector ? 0.65 : 0.35);
    doc.setLineDashPattern([3, 1.2, 0.8, 1.2], 0);
    doc.line(fx1, fy1, fx2, fy2);
    doc.setLineDashPattern([], 0);

    // Cut-on-fold double bracket arrows
    const dx = fx2 - fx1;
    const dy = fy2 - fy1;
    const flen = Math.hypot(dx, dy) || 1;
    const ux = dx / flen;
    const uy = dy / flen;
    const nx = uy;
    const ny = -ux;
    const pad = Math.min(30, flen * 0.14);
    const p1x = fx1 + ux * pad;
    const p1y = fy1 + uy * pad;
    const p2x = fx2 - ux * pad;
    const p2y = fy2 - uy * pad;
    const off = 9;
    doc.line(p1x + nx * off, p1y + ny * off, p1x, p1y);
    doc.line(p2x + nx * off, p2y + ny * off, p2x, p2y);
    doc.line(p1x + nx * off, p1y + ny * off, p2x + nx * off, p2y + ny * off);
  }

  if (piece.internalLines && piece.internalLines.length > 0) {
    for (const internalLine of piece.internalLines) {
      if (internalLine.style === "button") {
        const m = internalLine.commands[0];
        if (m && m.type === "M") {
          const bx = pieceOffsetXmm + m.x * 10;
          const by = pieceOffsetYmm + m.y * 10;
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.35);
          doc.circle(bx, by, 4, "S");
          doc.line(bx - 2.5, by, bx + 2.5, by);
          doc.line(bx, by - 2.5, bx, by + 2.5);
        }
        continue;
      }
      if (internalLine.style === "buttonhole") {
        const p0 = internalLine.commands[0];
        const p1 = internalLine.commands[1];
        if (p0 && p1 && p0.type === "M" && p1.type === "L") {
          const x0 = pieceOffsetXmm + p0.x * 10;
          const y0 = pieceOffsetYmm + p0.y * 10;
          const x1 = pieceOffsetXmm + p1.x * 10;
          const y1 = pieceOffsetYmm + p1.y * 10;
          doc.setDrawColor(190, 18, 60);
          doc.setLineWidth(0.4);
          doc.line(x0, y0, x1, y1);
          doc.line(x0, y0 - 2.5, x0, y0 + 2.5);
          doc.line(x1, y1 - 2.5, x1, y1 + 2.5);
        }
        continue;
      }

      if (internalLine.style === "dart") {
        doc.setDrawColor(124, 58, 237);
        doc.setLineWidth(isProjector ? 0.6 : 0.32);
        doc.setLineDashPattern([], 0);
      } else if (internalLine.style === "fold") {
        doc.setDrawColor(225, 29, 72);
        doc.setLineWidth(0.32);
        doc.setLineDashPattern([3, 1.5], 0);
      } else {
        doc.setDrawColor(2, 132, 199);
        doc.setLineWidth(0.28);
        doc.setLineDashPattern([2, 1.5], 0);
      }
      drawVectorPath(
        doc,
        internalLine.commands,
        pieceOffsetXmm,
        pieceOffsetYmm,
        10,
        "stroke"
      );
      doc.setLineDashPattern([], 0);

      if (internalLine.label && internalLine.labelPos) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isProjector ? 9 : 6.8);
        doc.setTextColor(
          internalLine.style === "dart"
            ? 109
            : internalLine.style === "fold"
              ? 190
              : 3,
          internalLine.style === "dart"
            ? 40
            : internalLine.style === "fold"
              ? 18
              : 105,
          internalLine.style === "dart"
            ? 217
            : internalLine.style === "fold"
              ? 60
              : 161
        );
        doc.text(
          internalLine.label,
          pieceOffsetXmm + internalLine.labelPos.x * 10,
          pieceOffsetYmm + internalLine.labelPos.y * 10,
          {
            align: "center",
            angle: internalLine.style === "dart" ? 90 : 0,
          }
        );
      }
    }
  }

  const gx1 = pieceOffsetXmm + piece.grainline.x1 * 10;
  const gy1 = pieceOffsetYmm + piece.grainline.y1 * 10;
  const gx2 = pieceOffsetXmm + piece.grainline.x2 * 10;
  const gy2 = pieceOffsetYmm + piece.grainline.y2 * 10;

  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(isProjector ? 0.5 : 0.3);
  doc.line(gx1, gy1, gx2, gy2);
  doc.line(gx1, gy1, gx1 - 1.8, gy1 + 3);
  doc.line(gx1, gy1, gx1 + 1.8, gy1 + 3);
  doc.line(gx2, gy2, gx2 - 1.8, gy2 - 3);
  doc.line(gx2, gy2, gx2 + 1.8, gy2 - 3);

  const bandWCm =
    piece.labelBandWidthCm ?? Math.min(piece.widthCm, piece.heightCm);
  const isNarrowPiece = bandWCm < 10;
  const grainLenMm = Math.hypot(gx2 - gx1, gy2 - gy1);

  if (!isNarrowPiece && grainLenMm > 100) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isProjector ? 10 : 7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("HILO DE LA TELA", gx1 + 2.5, (gy1 + gy2) / 2);
  }

  // Directional V-notches (1, 2, or 3)
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(isProjector ? 0.65 : 0.35);
  for (const notch of piece.notches) {
    const count = notch.count ?? 1;
    const rad = (notch.angle * Math.PI) / 180;
    const txVec = -Math.sin(rad);
    const tyVec = Math.cos(rad);
    const nxVec = Math.cos(rad);
    const nyVec = Math.sin(rad);
    const offsets = count === 1 ? [0] : count === 2 ? [-3.5, 3.5] : [-6, 0, 6];

    const nxMm = pieceOffsetXmm + notch.x * 10;
    const nyMm = pieceOffsetYmm + notch.y * 10;

    for (const off of offsets) {
      const cx = nxMm + txVec * off;
      const cy = nyMm + tyVec * off;
      doc.line(cx - txVec * 2.4 + nxVec * 5, cy - tyVec * 2.4 + nyVec * 5, cx, cy);
      doc.line(cx, cy, cx + txVec * 2.4 + nxVec * 5, cy + tyVec * 2.4 + nyVec * 5);
    }
    if (notch.label) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isProjector ? 9 : 6.5);
      doc.setTextColor(190, 18, 60);
      doc.text(notch.label, nxMm + (notch.angle === 180 ? 3.5 : -3.5), nyMm + 1, {
        align: notch.angle === 180 ? "left" : "right",
      });
    }
  }

  const lx = pieceOffsetXmm + piece.labelPos.x * 10;
  const ly = pieceOffsetYmm + piece.labelPos.y * 10;
  const svgAngle = piece.labelAngle ?? 0;
  const pdfAngle = -svgAngle;
  const spanMm = (piece.labelMaxSpanCm ?? piece.widthCm) * 10;
  const bandMm = bandWCm * 10;
  const titleText = isNarrowPiece ? piece.tabLabel : piece.name;
  const maxPtByBand = bandMm * 0.34 * 2.8346;
  const maxPtBySpan =
    ((spanMm * 0.72) / Math.max(titleText.length * 0.56, 4)) * 2.8346;
  const titlePt = Math.min(
    isProjector ? 15 : 10,
    Math.max(6.2, Math.min(maxPtByBand, maxPtBySpan))
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titlePt);
  doc.setTextColor(15, 23, 42);
  doc.text(titleText, lx, ly, {
    align: "center",
    baseline: "middle",
    angle: pdfAngle,
  });
  if (!isNarrowPiece && piece.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isProjector ? 10.5 : 8);
    doc.setTextColor(71, 85, 105);
    doc.text(piece.subtitle, lx, ly + 4.8, {
      align: "center",
      baseline: "middle",
      angle: pdfAngle,
    });
  }
}

export interface ExportPdfOptions {
  pattern: PatternResult;
  paperFormat: PaperFormat;
  measurements: Measurements;
  seamAllowance: SeamAllowance;
  fabricType: FabricType;
}

export function exportPatternToPdf(options: ExportPdfOptions): {
  totalPages: number;
  filename: string;
} {
  const { pattern, paperFormat, measurements, seamAllowance } = options;

  const grid = computeTilingGrid(
    pattern.totalBoundsCm.width,
    pattern.totalBoundsCm.height,
    paperFormat,
    pattern.pieces
  );
  const printableTiles = grid.tiles.filter((t) => !t.isEmpty);

  // =========================================================================
  // SPECIAL MODE: PROJECTOR PDF (Single calibrated continuous canvas)
  // =========================================================================
  if (paperFormat === "projector") {
    const sheetWmm = grid.printableWidthMm;
    const sheetHmm = grid.printableHeightMm;
    const doc = new jsPDF({
      orientation: sheetWmm > sheetHmm ? "landscape" : "portrait",
      unit: "mm",
      format: [sheetWmm, sheetHmm],
      compress: true,
    });

    // 100 mm (10 cm) light calibration grid
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    for (let x = 0; x <= sheetWmm; x += 50) {
      doc.line(x, 0, x, sheetHmm);
    }
    for (let y = 0; y <= sheetHmm; y += 50) {
      doc.line(0, y, sheetWmm, y);
    }

    // Dual calibration square: 10x10 cm & 4x4 in
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.9);
    doc.rect(20, 20, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("CALIBRACIÓN PROYECTOR: 10 × 10 cm (100 × 100 mm)", 130, 35);
    doc.setFontSize(11);
    doc.text(
      `Prenda: ${pattern.subStyleLabel} | Margen: ${seamAllowance} cm (0 cm en doblez)`,
      130,
      48
    );

    const originXmm = 250; // 25 cm left buffer
    const originYmm = 250; // 25 cm top buffer
    for (const piece of pattern.pieces) {
      renderPieceMarkingsToPdf(
        doc,
        piece,
        originXmm + piece.layoutX * 10,
        originYmm + piece.layoutY * 10,
        seamAllowance,
        true
      );
    }

    const filename = `moldefacil-${pattern.category}-proyector.pdf`;
    doc.save(filename);
    return { totalPages: 1, filename };
  }

  const paper = PAPER_DIMENSIONS_MM[paperFormat];
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paper.width, paper.height],
    compress: true,
  });

  // =========================================================================
  // PAGE 1: 50x50 mm Verification Square + Vector Mini-Map Assembly Guide
  // =========================================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("MoldeFácil — Guía de Impresión Real 1:1", 15, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Prenda: ${pattern.subStyleLabel}   |   Formato: ${paper.label}`,
    15,
    30
  );
  doc.text(
    `Margen de costura: ${seamAllowance} cm (0 en doblez)   |   Tejido: ${pattern.appliedEaseLabel}`,
    15,
    36
  );

  const boxX = 15;
  const boxY = 45;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, 50, 50);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  for (let i = 10; i < 50; i += 10) {
    doc.line(boxX + i, boxY, boxX + i, boxY + 3);
    doc.line(boxX, boxY + i, boxX + 3, boxY + i);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("50 mm × 50 mm", boxX + 25, boxY + 23, { align: "center" });
  doc.setFontSize(9);
  doc.text("(5 × 5 cm)", boxX + 25, boxY + 29, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(185, 28, 28);
  const verifyLines = doc.splitTextToSize(
    "IMPRIMIR AL 100% / SIN AJUSTAR A PÁGINA — Verifica este cuadro con una regla antes de cortar",
    paper.width - 85
  );
  doc.text(verifyLines, 72, boxY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    [
      "Instrucciones de armado:",
      "1. Imprime en 'Escala real' o '100%' (desactiva 'Ajustar a página').",
      "2. Comprueba con una regla que el cuadro mida exactamente 5.0 × 5.0 cm.",
      "3. Recorta por el marco exterior y une las cruces (+) con 10 mm de solape.",
      `4. Hojas con molde a imprimir: ${printableTiles.length} (se omitieron las vacías).`,
    ],
    72,
    boxY + 27
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(
    paperFormat === "a0"
      ? "Vista Previa Lámina A0 (Ploter)"
      : "Mini-Mapa de Ensamblaje de Hojas",
    15,
    111
  );

  const mapMaxW = paper.width - 30;
  const mapMaxH = paper.height - 134;
  const totalGridWmm =
    (grid.cols - 1) * grid.stepXMm + grid.printableWidthMm;
  const totalGridHmm =
    (grid.rows - 1) * grid.stepYMm + grid.printableHeightMm;
  const mapScale = Math.min(mapMaxW / totalGridWmm, mapMaxH / totalGridHmm);

  const mapOriginX = 15 + (mapMaxW - totalGridWmm * mapScale) / 2;
  const mapOriginY = 117;
  const mapW = totalGridWmm * mapScale;
  const mapH = totalGridHmm * mapScale;
  const mmPerCmMap = 10 * mapScale;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(mapOriginX, mapOriginY, mapW, mapH, "FD");

  for (const tile of grid.tiles) {
    if (tile.isEmpty) {
      const tx = mapOriginX + tile.xCm * mmPerCmMap;
      const ty = mapOriginY + tile.yCm * mmPerCmMap;
      const tw = tile.widthCm * mmPerCmMap;
      const th = tile.heightCm * mmPerCmMap;
      doc.setFillColor(248, 250, 252);
      doc.rect(tx, ty, tw, th, "F");
    }
  }

  doc.setFillColor(239, 246, 255);
  for (let c = 1; c < grid.cols; c++) {
    const sx = mapOriginX + c * grid.stepXMm * mapScale;
    doc.rect(sx, mapOriginY, OVERLAP_MM * mapScale, mapH, "F");
  }
  for (let r = 1; r < grid.rows; r++) {
    const sy = mapOriginY + r * grid.stepYMm * mapScale;
    doc.rect(mapOriginX, sy, mapW, OVERLAP_MM * mapScale, "F");
  }

  for (const piece of pattern.pieces) {
    const px = mapOriginX + piece.layoutX * mmPerCmMap;
    const py = mapOriginY + piece.layoutY * mmPerCmMap;
    doc.setFillColor(245, 239, 227);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.32);
    doc.setLineDashPattern([], 0);
    drawVectorPath(doc, piece.cutPath, px, py, mmPerCmMap, "fillStroke");
  }

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.6, 1.4], 0);
  for (let c = 1; c < grid.cols; c++) {
    const gx = mapOriginX + c * grid.stepXMm * mapScale;
    doc.line(gx, mapOriginY, gx, mapOriginY + mapH);
  }
  for (let r = 1; r < grid.rows; r++) {
    const gy = mapOriginY + r * grid.stepYMm * mapScale;
    doc.line(mapOriginX, gy, mapOriginX + mapW, gy);
  }
  doc.setLineDashPattern([], 0);

  const sampleTile = grid.tiles[0];
  const cellWmm = (sampleTile?.widthCm ?? 20) * mmPerCmMap;
  const cellHmm = (sampleTile?.heightCm ?? 26) * mmPerCmMap;
  const badgeW = Math.max(7.5, Math.min(cellWmm - 1.4, 13));
  const badgeH = Math.max(4.8, Math.min(cellHmm * 0.36, 8.2));
  const badgeOffsetX = 0.7;
  const badgeOffsetY = 0.7;

  for (const tile of grid.tiles) {
    const tx = mapOriginX + tile.xCm * mmPerCmMap;
    const ty = mapOriginY + tile.yCm * mmPerCmMap;
    const tw = tile.widthCm * mmPerCmMap;
    const th = tile.heightCm * mmPerCmMap;

    if (tile.isEmpty) {
      const emptyFs = Math.max(4.5, Math.min(6.5, tw * 0.42));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(emptyFs);
      doc.setTextColor(148, 163, 184);
      doc.text("Vacía", tx + tw / 2, ty + th / 2 - emptyFs * 0.22, {
        align: "center",
        maxWidth: Math.max(6, tw - 1.2),
      });
      doc.text("(No imprimir)", tx + tw / 2, ty + th / 2 + emptyFs * 0.45, {
        align: "center",
        maxWidth: Math.max(6, tw - 1.2),
      });
    } else {
      const bx = tx + badgeOffsetX;
      const by = ty + badgeOffsetY;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.28);
      doc.roundedRect(bx, by, badgeW, badgeH, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.min(8.5, badgeH * 1.4));
      doc.setTextColor(29, 78, 216);
      doc.text(`${tile.sheetNumber}`, bx + badgeW * 0.3, by + badgeH * 0.66, {
        align: "center",
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.min(5.2, badgeH * 0.85));
      doc.setTextColor(71, 85, 105);
      doc.text(`F${tile.row}-C${tile.col}`, bx + badgeW * 0.7, by + badgeH * 0.65, {
        align: "center",
      });
    }
  }

  for (const piece of pattern.pieces) {
    const px = mapOriginX + piece.layoutX * mmPerCmMap;
    const py = mapOriginY + piece.layoutY * mmPerCmMap;
    const labelX = px + piece.labelPos.x * mmPerCmMap;
    const labelY = py + piece.labelPos.y * mmPerCmMap;
    const pieceMapW = piece.widthCm * mmPerCmMap;
    const fontSize = Math.max(4.2, Math.min(7.2, pieceMapW * 0.16));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 41, 59);
    doc.text(piece.tabLabel, labelX, labelY, {
      align: "center",
      angle: -(piece.labelAngle ?? 0),
    });
  }

  // =========================================================================
  // TILES: 1:1 Vector Pattern Pages
  // =========================================================================
  for (const tile of printableTiles) {
    doc.addPage([paper.width, paper.height], "portrait");

    const frameX = PAGE_MARGIN_MM;
    const frameY = PAGE_MARGIN_MM;
    const frameW = grid.printableWidthMm;
    const frameH = grid.printableHeightMm;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(frameX, frameY, frameW, frameH);
    doc.setLineDashPattern([], 0);

    drawRegistrationCross(doc, frameX, frameY);
    drawRegistrationCross(doc, frameX + frameW, frameY);
    drawRegistrationCross(doc, frameX, frameY + frameH);
    drawRegistrationCross(doc, frameX + frameW, frameY + frameH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Hoja ${tile.sheetNumber} de ${printableTiles.length}  [Fila ${tile.row} - Columna ${tile.col}]  |  MoldeFácil 1:1 (${paperFormat.toUpperCase()})`,
      frameX + 4,
      frameY + 5
    );

    doc.saveGraphicsState();
    doc.rect(frameX, frameY, frameW, frameH);
    doc.clip();
    doc.discardPath();

    const tileOriginXmm = frameX - tile.xCm * 10;
    const tileOriginYmm = frameY - tile.yCm * 10;

    for (const piece of pattern.pieces) {
      renderPieceMarkingsToPdf(
        doc,
        piece,
        tileOriginXmm + piece.layoutX * 10,
        tileOriginYmm + piece.layoutY * 10,
        seamAllowance,
        false
      );
    }

    doc.restoreGraphicsState();
  }

  // =========================================================================
  // FINAL PAGE: Technical Spec Sheet + Finished Garment Table + Cutting Layout
  // =========================================================================
  doc.addPage([paper.width, paper.height], "portrait");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("Ficha Técnica de Confección — MoldeFácil", 15, 22);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(15, 26, paper.width - 15, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Prenda: ${pattern.subStyleLabel}`, 15, 34);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString("es-ES")}   |   Margen base: ${seamAllowance} cm (curvas 1 cm / doblez 0 cm / ruedo 3 cm)`,
    15,
    40
  );
  doc.text(`Tejido: ${pattern.appliedEaseLabel}`, 15, 46);

  let tableY = 55;
  if (pattern.finishedMeasurements && pattern.finishedMeasurements.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Medidas Corporales vs. Prenda Terminada (con Holgura)", 15, tableY);
    tableY += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(15, tableY, paper.width - 30, 7, "F");
    doc.setFontSize(8.5);
    doc.text("Medida", 18, tableY + 4.8);
    doc.text("Cuerpo", paper.width - 68, tableY + 4.8, { align: "right" });
    doc.text("Holgura", paper.width - 43, tableY + 4.8, { align: "right" });
    doc.text("Terminada", paper.width - 18, tableY + 4.8, { align: "right" });
    tableY += 7;

    for (const fm of pattern.finishedMeasurements) {
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, tableY, paper.width - 30, 6.8, "S");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(fm.label, 18, tableY + 4.6);
      doc.text(`${fm.bodyCm} cm`, paper.width - 68, tableY + 4.6, { align: "right" });
      doc.text(
        `${fm.easeCm >= 0 ? "+" : ""}${fm.easeCm} cm`,
        paper.width - 43,
        tableY + 4.6,
        { align: "right" }
      );
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${fm.finishedCm} cm`, paper.width - 18, tableY + 4.6, {
        align: "right",
      });
      tableY += 6.8;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Medidas Corporales Aplicadas", 15, tableY);
    tableY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(
      `Busto ${measurements.bust} cm • Cintura ${measurements.waist} cm • Cadera ${measurements.hip} cm`,
      15,
      tableY
    );
    tableY += 8;
  }

  // Visual Cutting Layout diagram on 140 cm fabric
  tableY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Consumo y Plano de Corte (140 cm: ${pattern.fabricConsumption.width140m.toFixed(2)} m | 150 cm: ${pattern.fabricConsumption.width150m.toFixed(2)} m)`,
    15,
    tableY
  );
  tableY += 4;

  if (pattern.cuttingLayout && pattern.cuttingLayout.items.length > 0) {
    const cl = pattern.cuttingLayout;
    const boxW = paper.width - 30;
    const boxH = 44;
    const scaleX = boxW / Math.max(80, cl.usedLengthCm);
    const scaleY = boxH / Math.max(40, cl.foldedWidthCm);
    const scale = Math.min(scaleX, scaleY);
    const drawW = cl.usedLengthCm * scale;
    const drawH = cl.foldedWidthCm * scale;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.rect(15, tableY, drawW, drawH, "FD");
    // Fold line top edge
    doc.setDrawColor(225, 29, 72);
    doc.setLineWidth(0.45);
    doc.line(15, tableY, 15 + drawW, tableY);

    for (const item of cl.items) {
      const ix = 15 + item.y * scale;
      const iy = tableY + item.x * scale;
      const iw = item.h * scale;
      const ih = item.w * scale;
      doc.setFillColor(245, 239, 227);
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.22);
      doc.rect(ix, iy, iw, ih, "FD");
      if (iw > 10 && ih > 5) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(30, 41, 59);
        doc.text(item.label, ix + iw / 2, iy + ih / 2 + 1, {
          align: "center",
          maxWidth: iw - 1,
        });
      }
    }
    tableY += drawH + 7;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Piezas del Molde", 15, tableY);
  tableY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  for (const p of pattern.pieces) {
    if (tableY > paper.height - 45) break;
    doc.text(
      `• ${p.name} — ${p.widthCm.toFixed(1)} × ${p.heightCm.toFixed(1)} cm`,
      18,
      tableY
    );
    tableY += 4.8;
  }

  const guide = generateSewingGuide(pattern);
  if (tableY < paper.height - 32) {
    tableY += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Orden de Armado Profesional", 15, tableY);
    tableY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    for (const stepText of guide.steps) {
      if (tableY > paper.height - 14) break;
      const wrappedStep = doc.splitTextToSize(stepText, paper.width - 32);
      doc.text(wrappedStep, 18, tableY);
      tableY += wrappedStep.length * 3.8 + 1.0;
    }
  }

  const filename = `moldefacil-${pattern.category}-${paperFormat}.pdf`;
  doc.save(filename);

  return {
    totalPages: 1 + printableTiles.length + 1,
    filename,
  };
}

/**
 * Generates and downloads a true 1:1 SVG file in millimeter units (`1 cm = 10 mm`)
 * suitable for plotters, Cricut, Inkscape, or Adobe Illustrator.
 */
export function exportPatternToSvg(
  pattern: PatternResult,
  seamAllowance: SeamAllowance
): { filename: string } {
  const padCm = 4;
  const wMm = Math.round((pattern.totalBoundsCm.width + padCm * 2) * 10);
  const hMm = Math.round((pattern.totalBoundsCm.height + padCm * 2) * 10);
  const vx = -padCm;
  const vy = -padCm;
  const vw = pattern.totalBoundsCm.width + padCm * 2;
  const vh = pattern.totalBoundsCm.height + padCm * 2;

  const pieceGroups = pattern.pieces
    .map((p) => {
      const cutD = commandsToSvgPath(p.cutPath);
      const seamD = seamAllowance > 0 ? commandsToSvgPath(p.seamPath) : "";
      const foldLine = p.foldLine
        ? `<line x1="${p.foldLine.x1}" y1="${p.foldLine.y1}" x2="${p.foldLine.x2}" y2="${p.foldLine.y2}" stroke="#E11D48" stroke-width="0.25" stroke-dasharray="1.2 0.4" />`
        : "";
      const internals = (p.internalLines ?? [])
        .map((l) => `<path d="${commandsToSvgPath(l.commands)}" fill="none" stroke="#7C3AED" stroke-width="0.2" />`)
        .join("");
      const notches = p.notches
        .map((n) => `<circle cx="${n.x}" cy="${n.y}" r="0.3" fill="#E11D48" />`)
        .join("");
      return `
  <g id="${p.id}" transform="translate(${p.layoutX}, ${p.layoutY})">
    <path d="${cutD}" fill="none" stroke="#0F172A" stroke-width="0.3" />
    ${seamD ? `<path d="${seamD}" fill="none" stroke="#0D9488" stroke-width="0.2" stroke-dasharray="0.8 0.5" />` : ""}
    ${foldLine}
    ${internals}
    ${notches}
    <line x1="${p.grainline.x1}" y1="${p.grainline.y1}" x2="${p.grainline.x2}" y2="${p.grainline.y2}" stroke="#64748B" stroke-width="0.18" />
    <text x="${p.labelPos.x}" y="${p.labelPos.y}" font-family="Arial, sans-serif" font-size="1.6" font-weight="bold" text-anchor="middle" fill="#0F172A">${p.name}</text>
  </g>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${wMm}mm" height="${hMm}mm" viewBox="${vx} ${vy} ${vw} ${vh}">
  <rect x="${pattern.totalBoundsCm.width + 0.5}" y="0" width="5" height="5" fill="none" stroke="#0D9488" stroke-width="0.25" />
  <text x="${pattern.totalBoundsCm.width + 3}" y="2.8" font-family="Arial, sans-serif" font-size="1.1" text-anchor="middle" fill="#0F766E">5x5 cm</text>
  ${pieceGroups}
</svg>`;

  const filename = `moldefacil-${pattern.category}-1a1.svg`;
  if (typeof document !== "undefined") {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return { filename };
}
