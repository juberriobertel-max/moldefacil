import {
  FabricType,
  NecklineStyle,
  PathCommand,
  PatternPiece,
  Point2D,
  SeamAllowance,
  TorsoFit,
} from "../types";

export function commandsToSvgPath(commands: PathCommand[]): string {
  return commands
    .map((cmd) => {
      switch (cmd.type) {
        case "M":
          return `M ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
        case "L":
          return `L ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
        case "C":
          return `C ${cmd.cp1x.toFixed(2)} ${cmd.cp1y.toFixed(2)}, ${cmd.cp2x.toFixed(2)} ${cmd.cp2y.toFixed(2)}, ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)}`;
        case "Z":
          return "Z";
      }
    })
    .join(" ");
}

export function sampleCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  steps = 16
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * p1.x +
        3 * mt * t * t * p2.x +
        t * t * t * p3.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * p1.y +
        3 * mt * t * t * p2.y +
        t * t * t * p3.y,
    });
  }
  return pts;
}

export function cubicBezierLength(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  steps = 24
): number {
  const pts = [p0, ...sampleCubicBezier(p0, p1, p2, p3, steps)];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

export function flattenPathToPoints(commands: PathCommand[]): Point2D[] {
  const pts: Point2D[] = [];
  let current: Point2D = { x: 0, y: 0 };

  for (const cmd of commands) {
    if (cmd.type === "M" || cmd.type === "L") {
      current = { x: cmd.x, y: cmd.y };
      pts.push(current);
    } else if (cmd.type === "C") {
      pts.push(
        ...sampleCubicBezier(
          current,
          { x: cmd.cp1x, y: cmd.cp1y },
          { x: cmd.cp2x, y: cmd.cp2y },
          { x: cmd.x, y: cmd.y },
          16
        )
      );
      current = { x: cmd.x, y: cmd.y };
    }
  }

  const cleaned: Point2D[] = [];
  for (const p of pts) {
    if (
      cleaned.length === 0 ||
      Math.hypot(
        p.x - cleaned[cleaned.length - 1].x,
        p.y - cleaned[cleaned.length - 1].y
      ) > 0.02
    ) {
      cleaned.push(p);
    }
  }
  if (
    cleaned.length > 2 &&
    Math.hypot(
      cleaned[0].x - cleaned[cleaned.length - 1].x,
      cleaned[0].y - cleaned[cleaned.length - 1].y
    ) < 0.02
  ) {
    cleaned.pop();
  }
  return cleaned;
}

function signedPolygonArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return area / 2;
}

export function offsetClosedPath(
  commands: PathCommand[],
  offsetCm: number
): PathCommand[] {
  if (offsetCm <= 0) return commands;
  const pts = flattenPathToPoints(commands);
  if (pts.length < 3) return commands;

  const area = signedPolygonArea(pts);
  const sign = area >= 0 ? 1 : -1;
  const n = pts.length;

  const offsetEdges: { p1: Point2D; p2: Point2D }[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sign * dy) / len;
    const ny = (sign * -dx) / len;
    offsetEdges.push({
      p1: { x: a.x + nx * offsetCm, y: a.y + ny * offsetCm },
      p2: { x: b.x + nx * offsetCm, y: b.y + ny * offsetCm },
    });
  }

  const outPts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const e1 = offsetEdges[(i - 1 + n) % n];
    const e2 = offsetEdges[i];
    const dx1 = e1.p2.x - e1.p1.x;
    const dy1 = e1.p2.y - e1.p1.y;
    const dx2 = e2.p2.x - e2.p1.x;
    const dy2 = e2.p2.y - e2.p1.y;
    const denom = dx1 * dy2 - dy1 * dx2;

    if (Math.abs(denom) < 1e-4) {
      outPts.push(e2.p1);
    } else {
      const t =
        ((e2.p1.x - e1.p1.x) * dy2 - (e2.p1.y - e1.p1.y) * dx2) / denom;
      const ix = e1.p1.x + t * dx1;
      const iy = e1.p1.y + t * dy1;
      const dist = Math.hypot(ix - pts[i].x, iy - pts[i].y);
      if (dist > offsetCm * 2.4) {
        outPts.push(e1.p2, e2.p1);
      } else {
        outPts.push({ x: ix, y: iy });
      }
    }
  }

  const result: PathCommand[] = [{ type: "M", x: outPts[0].x, y: outPts[0].y }];
  for (let i = 1; i < outPts.length; i++) {
    result.push({ type: "L", x: outPts[i].x, y: outPts[i].y });
  }
  result.push({ type: "Z" });
  return result;
}

function getBounds(commands: PathCommand[]) {
  const pts = flattenPathToPoints(commands);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function translateCommands(
  commands: PathCommand[],
  dx: number,
  dy: number
): PathCommand[] {
  return commands.map((cmd) => {
    if (cmd.type === "M" || cmd.type === "L") {
      return { ...cmd, x: cmd.x + dx, y: cmd.y + dy };
    }
    if (cmd.type === "C") {
      return {
        ...cmd,
        cp1x: cmd.cp1x + dx,
        cp1y: cmd.cp1y + dy,
        cp2x: cmd.cp2x + dx,
        cp2y: cmd.cp2y + dy,
        x: cmd.x + dx,
        y: cmd.y + dy,
      };
    }
    return cmd;
  });
}

export function normalizePiece(
  rawPiece: Omit<
    PatternPiece,
    "widthCm" | "heightCm" | "layoutX" | "layoutY" | "cutPath"
  >,
  seamAllowance: SeamAllowance
): PatternPiece {
  const cutRaw = offsetClosedPath(rawPiece.seamPath, seamAllowance);
  const bounds = getBounds(cutRaw);
  const shiftX = -bounds.minX;
  const shiftY = -bounds.minY;

  return {
    ...rawPiece,
    seamPath: translateCommands(rawPiece.seamPath, shiftX, shiftY),
    cutPath: translateCommands(cutRaw, shiftX, shiftY),
    widthCm: Number((bounds.maxX - bounds.minX).toFixed(2)),
    heightCm: Number((bounds.maxY - bounds.minY).toFixed(2)),
    layoutX: 0,
    layoutY: 0,
    grainline: {
      x1: rawPiece.grainline.x1 + shiftX,
      y1: rawPiece.grainline.y1 + shiftY,
      x2: rawPiece.grainline.x2 + shiftX,
      y2: rawPiece.grainline.y2 + shiftY,
    },
    notches: rawPiece.notches.map((n) => ({
      ...n,
      x: n.x + shiftX,
      y: n.y + shiftY,
    })),
    internalLines: rawPiece.internalLines?.map((line) => ({
      ...line,
      commands: translateCommands(line.commands, shiftX, shiftY),
      labelPos: line.labelPos
        ? { x: line.labelPos.x + shiftX, y: line.labelPos.y + shiftY }
        : undefined,
    })),
    labelPos: {
      x: rawPiece.labelPos.x + shiftX,
      y: rawPiece.labelPos.y + shiftY,
    },
    foldLine: rawPiece.foldLine
      ? {
          x1: rawPiece.foldLine.x1 + shiftX,
          y1: rawPiece.foldLine.y1 + shiftY,
          x2: rawPiece.foldLine.x2 + shiftX,
          y2: rawPiece.foldLine.y2 + shiftY,
        }
      : undefined,
  };
}

export function packPiecesOnSheet(
  pieces: PatternPiece[],
  gapCm = 2.0
): { width: number; height: number } {
  const effectiveGap = Math.min(gapCm, 2.2);
  // 94 cm fits cleanly in 5 Letter/A4 columns while keeping layout compact
  const maxSheetWidth = Math.max(
    94,
    ...pieces.map((p) => p.widthCm)
  );

  // Sort tallest first so tall skirt/pant pieces anchor rows and shorter pieces tuck beside/below
  const sorted = [...pieces].sort(
    (a, b) => b.heightCm - a.heightCm || b.widthCm - a.widthCm
  );

  interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const placed: Rect[] = [];

  const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.w + effectiveGap &&
    a.x + a.w + effectiveGap > b.x &&
    a.y < b.y + b.h + effectiveGap &&
    a.y + a.h + effectiveGap > b.y;

  let totalW = 0;
  let totalH = 0;

  for (const piece of sorted) {
    const candidates: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (const r of placed) {
      candidates.push({ x: r.x + r.w + effectiveGap, y: r.y });
      candidates.push({ x: 0, y: r.y + r.h + effectiveGap });
      candidates.push({ x: r.x, y: r.y + r.h + effectiveGap });
    }

    let best: { x: number; y: number; scoreY: number; scoreX: number } | null =
      null;

    for (const c of candidates) {
      if (c.x + piece.widthCm > maxSheetWidth + 0.01) continue;
      const candRect: Rect = {
        x: c.x,
        y: c.y,
        w: piece.widthCm,
        h: piece.heightCm,
      };
      if (placed.some((r) => overlaps(candRect, r))) continue;

      const scoreY = c.y + piece.heightCm;
      const scoreX = c.x;
      if (
        !best ||
        scoreY < best.scoreY - 0.01 ||
        (Math.abs(scoreY - best.scoreY) <= 0.01 && scoreX < best.scoreX)
      ) {
        best = { x: c.x, y: c.y, scoreY, scoreX };
      }
    }

    const chosenX = best ? best.x : 0;
    const chosenY = best ? best.y : totalH + effectiveGap;

    piece.layoutX = Number(chosenX.toFixed(2));
    piece.layoutY = Number(chosenY.toFixed(2));
    placed.push({
      x: chosenX,
      y: chosenY,
      w: piece.widthCm,
      h: piece.heightCm,
    });

    totalW = Math.max(totalW, chosenX + piece.widthCm);
    totalH = Math.max(totalH, chosenY + piece.heightCm);
  }

  return {
    width: Number(totalW.toFixed(2)),
    height: Number(totalH.toFixed(2)),
  };
}

export function estimateFabricMeters(
  pieces: PatternPiece[],
  rollWidthCm: number
): number {
  const buffer = 2;
  let x = 0;
  let y = 0;
  let shelfH = 0;
  const sorted = [...pieces].sort((a, b) => b.heightCm - a.heightCm);
  for (const p of sorted) {
    const w = p.widthCm + buffer;
    const h = p.heightCm + buffer;
    if (x > 0 && x + w > rollWidthCm) {
      x = 0;
      y += shelfH;
      shelfH = 0;
    }
    x += w;
    shelfH = Math.max(shelfH, h);
  }
  return Number(((y + shelfH + 5) / 100).toFixed(2));
}

export function buildNecklineCommand(
  neckWidth: number,
  neckDrop: number,
  style: NecklineStyle
): PathCommand[] {
  if (style === "square") {
    return [
      { type: "L", x: neckWidth, y: neckDrop },
      { type: "L", x: neckWidth, y: 0 },
    ];
  }
  if (style === "high" || style === "shirt_collar") {
    const shallowDrop = Math.min(neckDrop, 4.2);
    return [
      {
        type: "C",
        cp1x: neckWidth * 0.55,
        cp1y: shallowDrop,
        cp2x: neckWidth,
        cp2y: shallowDrop * 0.55,
        x: neckWidth,
        y: 0,
      },
    ];
  }
  if (style === "v_neck" || style === "tailored_lapel") {
    return [
      {
        type: "C",
        cp1x: neckWidth * 0.32,
        cp1y: neckDrop * 0.72,
        cp2x: neckWidth * 0.72,
        cp2y: neckDrop * 0.35,
        x: neckWidth,
        y: 0,
      },
    ];
  }
  return [
    {
      type: "C",
      cp1x: neckWidth * 0.58,
      cp1y: neckDrop,
      cp2x: neckWidth,
      cp2y: neckDrop * 0.58,
      x: neckWidth,
      y: 0,
    },
  ];
}

export function computeEase(
  fabricType: FabricType,
  extraJacketEaseCm = 0,
  torsoFit: TorsoFit = "fitted"
) {
  const easeFactor = fabricType === "woven" ? 1 : 0.95;
  const blousedEase = torsoFit === "loose" ? 5 : 0;
  const flatEase = (fabricType === "woven" ? 2 : 0) + extraJacketEaseCm + blousedEase;
  const fitSuffix = torsoFit === "loose" ? " • Holgado/Blusado" : "";
  const label =
    fabricType === "woven"
      ? `Tela normal (+${flatEase} cm soltura${fitSuffix})`
      : `Tela que estira (ajuste elástico${flatEase > 0 ? ` +${flatEase} cm` : ""}${fitSuffix})`;
  return { easeFactor, flatEase, label };
}
