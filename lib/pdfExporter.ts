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
import { flattenPathToPoints } from "./garmentEngines/geometry";

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
  // Sample along segment for curve-safe intersection
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

  // Also check if tile center lies completely inside a large piece
  if (pointInPolygon({ x: tx + tw / 2, y: ty + th / 2 }, polyWorld)) {
    return true;
  }
  return false;
}

/**
 * Computes the exact 1:1 tiling grid, flagging empty tiles so no blank sheets are printed.
 */
export function computeTilingGrid(
  totalWidthCm: number,
  totalHeightCm: number,
  format: PaperFormat,
  pieces?: PatternPiece[]
): TilingGrid {
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
  const { pattern, paperFormat, measurements, seamAllowance } =
    options;

  const paper = PAPER_DIMENSIONS_MM[paperFormat];
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paper.width, paper.height],
    compress: true,
  });

  const grid = computeTilingGrid(
    pattern.totalBoundsCm.width,
    pattern.totalBoundsCm.height,
    paperFormat,
    pattern.pieces
  );
  const printableTiles = grid.tiles.filter((t) => !t.isEmpty);

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
    `Margen de costura: ${seamAllowance} cm   |   Tejido: ${pattern.appliedEaseLabel}`,
    15,
    36
  );

  // 50x50 mm Scale Verification Square
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

  // Mini-Map Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Mini-Mapa de Ensamblaje de Hojas", 15, 111);

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

  // Map outer frame
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(mapOriginX, mapOriginY, mapW, mapH, "FD");

  // 1) Shade empty cells lightly and subtle 10 mm overlap strips
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

  // Subtle 10mm overlap strips
  doc.setFillColor(239, 246, 255);
  for (let c = 1; c < grid.cols; c++) {
    const sx = mapOriginX + c * grid.stepXMm * mapScale;
    doc.rect(sx, mapOriginY, OVERLAP_MM * mapScale, mapH, "F");
  }
  for (let r = 1; r < grid.rows; r++) {
    const sy = mapOriginY + r * grid.stepYMm * mapScale;
    doc.rect(mapOriginX, sy, mapW, OVERLAP_MM * mapScale, "F");
  }

  // 2) Draw REAL vector silhouettes of ALL pattern pieces (light cream fill, dark outline)
  for (const piece of pattern.pieces) {
    const px = mapOriginX + piece.layoutX * mmPerCmMap;
    const py = mapOriginY + piece.layoutY * mmPerCmMap;

    // Reset fill & stroke explicitly inside the loop for every single piece!
    doc.setFillColor(245, 239, 227);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.32);
    doc.setLineDashPattern([], 0);
    drawVectorPath(doc, piece.cutPath, px, py, mmPerCmMap, "fillStroke");
  }

  // 3) Single clean dashed grid lines per sheet boundary
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

  // 4) Crisp white top-left badges for Sheet Numbers (or "Vacía (No imprimir)" on blank cells)
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

      // Compact single-row pill when height is tight, stacked when taller
      if (badgeH < 6.4) {
        const numFs = Math.max(6.5, Math.min(8.5, badgeH * 1.45));
        const coordFs = Math.max(4.2, Math.min(5.2, badgeH * 0.85));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(numFs);
        doc.setTextColor(29, 78, 216);
        doc.text(`${tile.sheetNumber}`, bx + badgeW * 0.28, by + badgeH * 0.68, {
          align: "center",
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(coordFs);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `F${tile.row}-C${tile.col}`,
          bx + badgeW * 0.68,
          by + badgeH * 0.65,
          { align: "center" }
        );
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(29, 78, 216);
        doc.text(`${tile.sheetNumber}`, bx + badgeW / 2, by + badgeH * 0.5, {
          align: "center",
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.3);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `F${tile.row}-C${tile.col}`,
          bx + badgeW / 2,
          by + badgeH * 0.86,
          { align: "center" }
        );
      }
    }
  }

  // 5) Piece names centered cleanly inside each silhouette (nudged below any badge)
  for (const piece of pattern.pieces) {
    const px = mapOriginX + piece.layoutX * mmPerCmMap;
    const py = mapOriginY + piece.layoutY * mmPerCmMap;
    const labelX = px + piece.labelPos.x * mmPerCmMap;
    let labelY = py + piece.labelPos.y * mmPerCmMap;
    const pieceMapW = piece.widthCm * mmPerCmMap;
    const pieceMapH = piece.heightCm * mmPerCmMap;
    const fontSize = Math.max(
      4.8,
      Math.min(7.5, pieceMapW * 0.16, pieceMapH * 0.38)
    );

    // If the silhouette label falls inside a tile's corner badge box, nudge it below the badge
    for (const tile of grid.tiles) {
      if (tile.isEmpty) continue;
      const bx = mapOriginX + tile.xCm * mmPerCmMap + badgeOffsetX;
      const by = mapOriginY + tile.yCm * mmPerCmMap + badgeOffsetY;
      if (
        labelX >= bx - 2 &&
        labelX <= bx + badgeW + 2 &&
        labelY >= by - 1.5 &&
        labelY <= by + badgeH + 2
      ) {
        const pieceBottomY = py + pieceMapH - 1.5;
        if (by + badgeH + 2.6 <= pieceBottomY) {
          labelY = by + badgeH + 2.6;
        }
        break;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);

    const lines = doc.splitTextToSize(piece.tabLabel, Math.max(8, pieceMapW - 1.6));
    const lineHeightMm = fontSize * 0.38;
    const textHeightMm = lines.length * lineHeightMm;
    const maxLineW = Math.min(
      Math.max(8, pieceMapW - 1.6),
      Math.max(...lines.map((l: string) => doc.getTextWidth(l))) + 2.2
    );

    doc.setFillColor(245, 239, 227);
    doc.roundedRect(
      labelX - maxLineW / 2,
      labelY - lineHeightMm * 0.78,
      maxLineW,
      textHeightMm + 1.2,
      0.8,
      0.8,
      "F"
    );

    doc.setTextColor(30, 41, 59);
    doc.text(lines, labelX, labelY, { align: "center" });
  }

  // =========================================================================
  // TILES: 1:1 Vector Pattern Pages (ONLY non-empty sheets!)
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
      const pieceOffsetXmm = tileOriginXmm + piece.layoutX * 10;
      const pieceOffsetYmm = tileOriginYmm + piece.layoutY * 10;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.45);
      doc.setLineDashPattern([], 0);
      drawVectorPath(doc, piece.cutPath, pieceOffsetXmm, pieceOffsetYmm, 10, "stroke");

      if (seamAllowance > 0) {
        doc.setDrawColor(13, 148, 136);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([3, 2], 0);
        drawVectorPath(doc, piece.seamPath, pieceOffsetXmm, pieceOffsetYmm, 10, "stroke");
        doc.setLineDashPattern([], 0);
      }

      const gx1 = pieceOffsetXmm + piece.grainline.x1 * 10;
      const gy1 = pieceOffsetYmm + piece.grainline.y1 * 10;
      const gx2 = pieceOffsetXmm + piece.grainline.x2 * 10;
      const gy2 = pieceOffsetYmm + piece.grainline.y2 * 10;

      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.3);
      doc.line(gx1, gy1, gx2, gy2);
      doc.line(gx1, gy1, gx1 - 1.8, gy1 + 3);
      doc.line(gx1, gy1, gx1 + 1.8, gy1 + 3);
      doc.line(gx2, gy2, gx2 - 1.8, gy2 - 3);
      doc.line(gx2, gy2, gx2 + 1.8, gy2 - 3);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text("HILO DE LA TELA", gx1 + 2.5, (gy1 + gy2) / 2);

      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.35);
      for (const notch of piece.notches) {
        const nx = pieceOffsetXmm + notch.x * 10;
        const ny = pieceOffsetYmm + notch.y * 10;
        doc.line(nx - 2.5, ny, nx + 2.5, ny);
        doc.line(nx, ny - 2.5, nx, ny + 2.5);
        if (notch.label) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(190, 18, 60);
          doc.text(notch.label, nx + (notch.angle === 180 ? 3.2 : -3.2), ny + 1, {
            align: notch.angle === 180 ? "left" : "right",
          });
        }
      }

      const lx = pieceOffsetXmm + piece.labelPos.x * 10;
      const ly = pieceOffsetYmm + piece.labelPos.y * 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(piece.name, lx, ly, { align: "center" });
      if (piece.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(piece.subtitle, lx, ly + 4.5, { align: "center" });
      }
    }

    doc.restoreGraphicsState();
  }

  // =========================================================================
  // FINAL PAGE: Technical Spec Sheet
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
  doc.text(`Prenda: ${pattern.subStyleLabel}`, 15, 35);
  doc.text(
    `Fecha: ${new Date().toLocaleDateString("es-ES")}   |   Margen de costura: ${seamAllowance} cm`,
    15,
    41
  );
  doc.text(
    `Tipo de tejido: ${pattern.appliedEaseLabel}`,
    15,
    47
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Tabla de Medidas Aplicadas", 15, 60);

  const rowsData: [string, string][] = [
    ["Contorno de Cintura", `${measurements.waist} cm`],
    ["Contorno de Cadera", `${measurements.hip} cm`],
  ];

  if (
    pattern.category === "top" ||
    pattern.category === "dress" ||
    pattern.category === "two_piece"
  ) {
    rowsData.unshift(["Contorno de Busto / Pecho", `${measurements.bust} cm`]);
    rowsData.push(
      ["Ancho de Espalda", `${measurements.backWidth} cm`],
      ["Largo de Talle", `${measurements.bodiceLength} cm`],
      ["Largo de Manga", `${measurements.sleeveLength} cm`]
    );
  }
  if (
    pattern.category === "skirt" ||
    pattern.category === "dress" ||
    pattern.category === "two_piece"
  ) {
    rowsData.push(["Largo de Falda", `${measurements.skirtLength} cm`]);
  }
  if (pattern.category === "pants" || pattern.category === "two_piece") {
    rowsData.push(
      ["Altura de Tiro", `${measurements.crotchDepth} cm`],
      ["Contorno de Muslo", `${measurements.thigh} cm`],
      ["Largo de Entrepierna", `${measurements.inseam} cm`],
      ["Ancho de Bota", `${measurements.hemWidth} cm`]
    );
  }

  let tableY = 66;
  for (const [label, value] of rowsData) {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(15, tableY, paper.width - 30, 8, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(label, 19, tableY + 5.4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(value, paper.width - 19, tableY + 5.4, { align: "right" });
    tableY += 8;
  }

  tableY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Consumo Estimado de Tela", 15, tableY);

  tableY += 5;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(147, 197, 253);
  doc.rect(15, tableY, paper.width - 30, 20, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(
    `• Rollo de 140 cm de ancho:  ${pattern.fabricConsumption.width140m.toFixed(2)} metros`,
    20,
    tableY + 7.5
  );
  doc.text(
    `• Rollo de 150 cm de ancho:  ${pattern.fabricConsumption.width150m.toFixed(2)} metros`,
    20,
    tableY + 14.5
  );

  tableY += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Piezas Incluidas en el Molde", 15, tableY);
  tableY += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  for (const p of pattern.pieces) {
    doc.text(
      `• ${p.name} — ${p.widthCm.toFixed(1)} × ${p.heightCm.toFixed(1)} cm`,
      18,
      tableY
    );
    tableY += 6;
  }

  const filename = `moldefacil-${pattern.category}-${paperFormat}.pdf`;
  doc.save(filename);

  return {
    totalPages: 1 + printableTiles.length + 1,
    filename,
  };
}
