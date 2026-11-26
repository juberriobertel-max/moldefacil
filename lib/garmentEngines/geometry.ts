import {
  CuttingLayout,
  CuttingLayoutItem,
  EdgeAllowanceKind,
  FabricType,
  FinishedMeasurementSpec,
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

export function commandArcLength(
  from: Point2D,
  cmd: PathCommand,
  start: Point2D = from
): number {
  if (cmd.type === "L") {
    return Math.hypot(cmd.x - from.x, cmd.y - from.y);
  }
  if (cmd.type === "C") {
    return cubicBezierLength(
      from,
      { x: cmd.cp1x, y: cmd.cp1y },
      { x: cmd.cp2x, y: cmd.cp2y },
      { x: cmd.x, y: cmd.y },
      32
    );
  }
  if (cmd.type === "Z") {
    return Math.hypot(start.x - from.x, start.y - from.y);
  }
  return 0;
}

export function commandsArcLength(commands: PathCommand[]): number {
  let current: Point2D = { x: 0, y: 0 };
  let start: Point2D = { x: 0, y: 0 };
  let total = 0;
  for (const cmd of commands) {
    if (cmd.type === "M") {
      current = { x: cmd.x, y: cmd.y };
      start = current;
    } else if (cmd.type === "L") {
      total += Math.hypot(cmd.x - current.x, cmd.y - current.y);
      current = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "C") {
      total += cubicBezierLength(
        current,
        { x: cmd.cp1x, y: cmd.cp1y },
        { x: cmd.cp2x, y: cmd.cp2y },
        { x: cmd.x, y: cmd.y },
        32
      );
      current = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "Z") {
      total += Math.hypot(start.x - current.x, start.y - current.y);
      current = start;
    }
  }
  return total;
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

function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-8) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

function isSegmentOnFoldLine(
  p1: Point2D,
  p2: Point2D,
  foldLine?: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  if (!foldLine) return false;
  const fa = { x: foldLine.x1, y: foldLine.y1 };
  const fb = { x: foldLine.x2, y: foldLine.y2 };
  const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (segLen < 0.02) return false;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return (
    pointToSegmentDist(p1, fa, fb) <= 0.2 &&
    pointToSegmentDist(p2, fa, fb) <= 0.2 &&
    pointToSegmentDist(mid, fa, fb) <= 0.2
  );
}

export function resolveEdgeAllowanceCm(
  kindOrCm: number | EdgeAllowanceKind | undefined,
  defaultAllowanceCm: SeamAllowance
): number {
  if (defaultAllowanceCm <= 0) return 0;
  if (typeof kindOrCm === "number") return Math.max(0, kindOrCm);
  switch (kindOrCm) {
    case "fold":
      return 0;
    case "curve":
      return Math.min(1.0, defaultAllowanceCm);
    case "zipper":
      return Math.max(2.0, defaultAllowanceCm);
    case "hem":
      return Math.max(3.0, defaultAllowanceCm * 2);
    case "seam":
    default:
      return defaultAllowanceCm;
  }
}

interface PolyEdge {
  a: Point2D;
  b: Point2D;
  offsetCm: number;
}

/**
 * Offsets a closed PathCommand polygon outward with per-edge allowance support.
 * Any edge lying on `foldLine` or flagged `"fold"` automatically receives `0.0 cm`.
 */
export function offsetClosedPathWithEdges(
  commands: PathCommand[],
  defaultAllowanceCm: SeamAllowance,
  foldLine?: { x1: number; y1: number; x2: number; y2: number },
  edgeAllowances?: Record<number, number | EdgeAllowanceKind>
): PathCommand[] {
  if (defaultAllowanceCm <= 0) return commands;

  const rawEdges: PolyEdge[] = [];
  let start: Point2D = { x: 0, y: 0 };
  let current: Point2D = { x: 0, y: 0 };
  let segIdx = 0;

  for (const cmd of commands) {
    if (cmd.type === "M") {
      start = { x: cmd.x, y: cmd.y };
      current = start;
      continue;
    }

    const explicit = edgeAllowances?.[segIdx];
    let edgeOffset = resolveEdgeAllowanceCm(explicit, defaultAllowanceCm);

    if (cmd.type === "L") {
      const next = { x: cmd.x, y: cmd.y };
      if (Math.hypot(next.x - current.x, next.y - current.y) > 0.02) {
        if (isSegmentOnFoldLine(current, next, foldLine)) {
          edgeOffset = 0;
        }
        rawEdges.push({ a: current, b: next, offsetCm: edgeOffset });
      }
      current = next;
      segIdx++;
    } else if (cmd.type === "C") {
      const next = { x: cmd.x, y: cmd.y };
      if (isSegmentOnFoldLine(current, next, foldLine)) {
        edgeOffset = 0;
      }
      const pts = sampleCubicBezier(
        current,
        { x: cmd.cp1x, y: cmd.cp1y },
        { x: cmd.cp2x, y: cmd.cp2y },
        next,
        16
      );
      let prev = current;
      for (const pt of pts) {
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.02) {
          rawEdges.push({ a: prev, b: pt, offsetCm: edgeOffset });
          prev = pt;
        }
      }
      if (Math.hypot(next.x - prev.x, next.y - prev.y) > 0.005) {
        rawEdges.push({ a: prev, b: next, offsetCm: edgeOffset });
      }
      current = next;
      segIdx++;
    } else if (cmd.type === "Z") {
      if (Math.hypot(start.x - current.x, start.y - current.y) > 0.02) {
        if (isSegmentOnFoldLine(current, start, foldLine)) {
          edgeOffset = 0;
        }
        rawEdges.push({ a: current, b: start, offsetCm: edgeOffset });
      }
      current = start;
      segIdx++;
    }
  }

  if (rawEdges.length < 3) return commands;

  const polyPts = rawEdges.map((e) => e.a);
  const area = signedPolygonArea(polyPts);
  const sign = area >= 0 ? 1 : -1;
  const n = rawEdges.length;

  const offsetLines: { p1: Point2D; p2: Point2D; offsetCm: number }[] = [];
  for (let i = 0; i < n; i++) {
    const { a, b, offsetCm } = rawEdges[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sign * dy) / len;
    const ny = (sign * -dx) / len;
    offsetLines.push({
      p1: { x: a.x + nx * offsetCm, y: a.y + ny * offsetCm },
      p2: { x: b.x + nx * offsetCm, y: b.y + ny * offsetCm },
      offsetCm,
    });
  }

  const outPts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const e1 = offsetLines[(i - 1 + n) % n];
    const e2 = offsetLines[i];
    const origCorner = rawEdges[i].a;

    if (e1.offsetCm === 0 && e2.offsetCm === 0) {
      outPts.push({ x: origCorner.x, y: origCorner.y });
      continue;
    }

    const dx1 = e1.p2.x - e1.p1.x;
    const dy1 = e1.p2.y - e1.p1.y;
    const dx2 = e2.p2.x - e2.p1.x;
    const dy2 = e2.p2.y - e2.p1.y;
    const denom = dx1 * dy2 - dy1 * dx2;
    const maxOffset = Math.max(e1.offsetCm, e2.offsetCm, 0.5);

    if (Math.abs(denom) < 1e-4) {
      if (Math.abs(e1.offsetCm - e2.offsetCm) > 0.05) {
        outPts.push(e1.p2, e2.p1);
      } else {
        outPts.push(e2.p1);
      }
    } else {
      const t =
        ((e2.p1.x - e1.p1.x) * dy2 - (e2.p1.y - e1.p1.y) * dx2) / denom;
      const ix = e1.p1.x + t * dx1;
      const iy = e1.p1.y + t * dy1;
      const dist = Math.hypot(ix - origCorner.x, iy - origCorner.y);
      if (dist > maxOffset * 2.5) {
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

export function offsetClosedPath(
  commands: PathCommand[],
  offsetCm: number
): PathCommand[] {
  if (offsetCm <= 0) return commands;
  return offsetClosedPathWithEdges(
    commands,
    (offsetCm >= 1.25 ? 1.5 : 1) as SeamAllowance,
    undefined,
    Object.fromEntries(
      Array.from({ length: commands.length }, (_, i) => [i, offsetCm])
    )
  );
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

function inferCutQuantity(name: string, subtitle?: string): number {
  const combined = `${name} ${subtitle ?? ""}`;
  const mX = combined.match(/\(\s*x(\d+)/i);
  if (mX) return Math.max(1, Number(mX[1]));
  const mCortar = combined.match(/Cortar\s+(\d+)\s+piezas/i);
  if (mCortar) return Math.max(1, Number(mCortar[1]));
  return 1;
}

export function normalizePiece(
  rawPiece: Omit<
    PatternPiece,
    "widthCm" | "heightCm" | "layoutX" | "layoutY" | "cutPath"
  >,
  seamAllowance: SeamAllowance
): PatternPiece {
  const cutRaw = offsetClosedPathWithEdges(
    rawPiece.seamPath,
    seamAllowance,
    rawPiece.foldLine,
    rawPiece.edgeAllowances
  );
  const bounds = getBounds(cutRaw);
  const shiftX = -bounds.minX;
  const shiftY = -bounds.minY;

  const cutOnFold = rawPiece.cutOnFold ?? Boolean(rawPiece.foldLine);
  const cutQuantity =
    rawPiece.cutQuantity ?? inferCutQuantity(rawPiece.name, rawPiece.subtitle);

  return {
    ...rawPiece,
    cutOnFold,
    cutQuantity,
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
  const maxSheetWidth = Math.max(94, ...pieces.map((p) => p.widthCm));

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

/**
 * Computes a real grainline-aware cutting layout on folded (or open when needed) fabric rolls,
 * respecting `cutQuantity` (x2, x4) and `cutOnFold` pieces.
 */
export function computeCuttingLayout(
  pieces: PatternPiece[],
  rollWidthCm: number
): CuttingLayout {
  const halfRoll = rollWidthCm / 2;
  const maxPieceWidth = Math.max(0, ...pieces.map((p) => p.widthCm));
  const openWidthUsed = maxPieceWidth > halfRoll - 2;
  const usableWidth = openWidthUsed ? rollWidthCm - 2 : halfRoll - 1.5;

  interface CopyJob {
    pieceId: string;
    label: string;
    w: number;
    h: number;
    onFold: boolean;
    copyIndex: number;
  }

  const jobs: CopyJob[] = [];
  for (const p of pieces) {
    const qty = p.cutQuantity ?? inferCutQuantity(p.name, p.subtitle);
    const onFold = p.cutOnFold ?? Boolean(p.foldLine);

    if (onFold && openWidthUsed) {
      // Unfold visually if layout is drawn on open width
      jobs.push({
        pieceId: p.id,
        label: p.tabLabel,
        w: Math.min(usableWidth, p.widthCm * 2),
        h: p.heightCm,
        onFold: true,
        copyIndex: 1,
      });
    } else if (!openWidthUsed && qty % 2 === 0) {
      // On double-folded fabric, a x2 mirrored pair is cut in 1 stacked layer placement!
      const layers = Math.max(1, qty / 2);
      for (let i = 0; i < layers; i++) {
        jobs.push({
          pieceId: p.id,
          label: `${p.tabLabel} (x2 par)`,
          w: p.widthCm,
          h: p.heightCm,
          onFold: false,
          copyIndex: i + 1,
        });
      }
    } else {
      for (let i = 0; i < qty; i++) {
        jobs.push({
          pieceId: p.id,
          label: qty > 1 ? `${p.tabLabel} #${i + 1}` : p.tabLabel,
          w: p.widthCm,
          h: p.heightCm,
          onFold,
          copyIndex: i + 1,
        });
      }
    }
  }

  // Place fold pieces first along x = 0 (folded edge), then tallest-first for remaining
  const sorted = [...jobs].sort((a, b) => {
    if (a.onFold !== b.onFold) return a.onFold ? -1 : 1;
    return b.h - a.h || b.w - a.w;
  });

  const gap = 1.5;
  const items: CuttingLayoutItem[] = [];
  const overlaps = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ) =>
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y;

  let maxBottom = 0;

  for (const job of sorted) {
    const w = Math.min(usableWidth, job.w);
    const h = job.h;
    const candidates: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    if (!job.onFold) {
      for (const r of items) {
        candidates.push({ x: r.x + r.w + gap, y: r.y });
        candidates.push({ x: 0, y: r.y + r.h + gap });
        candidates.push({ x: r.x, y: r.y + r.h + gap });
      }
    } else {
      for (const r of items) {
        candidates.push({ x: 0, y: r.y + r.h + gap });
      }
    }

    let best: { x: number; y: number; scoreY: number; scoreX: number } | null =
      null;
    for (const c of candidates) {
      if (job.onFold && c.x !== 0) continue;
      if (c.x + w > usableWidth + 0.01) continue;
      const cand = { x: c.x, y: c.y, w, h };
      if (items.some((r) => overlaps(cand, r))) continue;
      const scoreY = c.y + h;
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
    const chosenY = best ? best.y : maxBottom + gap;
    items.push({
      pieceId: job.pieceId,
      label: job.label,
      x: Number(chosenX.toFixed(1)),
      y: Number(chosenY.toFixed(1)),
      w: Number(w.toFixed(1)),
      h: Number(h.toFixed(1)),
      onFold: job.onFold,
      copyIndex: job.copyIndex,
    });
    maxBottom = Math.max(maxBottom, chosenY + h);
  }

  return {
    rollWidthCm,
    foldedWidthCm: Number(usableWidth.toFixed(1)),
    usedLengthCm: Number((maxBottom * 1.1 + 5).toFixed(1)),
    openWidthUsed,
    items,
  };
}

export function estimateFabricMeters(
  pieces: PatternPiece[],
  rollWidthCm: number
): number {
  const layout = computeCuttingLayout(pieces, rollWidthCm);
  // Round up to nearest 0.05 m (minimum 0.45 m)
  const rawMeters = Math.max(0.45, layout.usedLengthCm / 100);
  return Number((Math.ceil(rawMeters * 20) / 20).toFixed(2));
}

export function buildFinishedMeasurements(
  specs: Array<{ label: string; bodyCm: number; finishedCm: number }>
): FinishedMeasurementSpec[] {
  return specs.map((s) => ({
    label: s.label,
    bodyCm: Number(s.bodyCm.toFixed(1)),
    finishedCm: Number(s.finishedCm.toFixed(1)),
    easeCm: Number((s.finishedCm - s.bodyCm).toFixed(1)),
  }));
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
