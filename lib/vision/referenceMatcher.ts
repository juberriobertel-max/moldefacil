import type { VisionCropKey } from "./imagePreprocessor";
import type { AtributoVision } from "./visionAttributes";

export const UMBRAL_SIN_COINCIDENCIA = 0.75;

export interface ReferenceEntryEncoded {
  id: string;
  label: string;
  source: string;
  v: string;
}

export interface ReferenceAttributeBucket {
  crop: VisionCropKey;
  entries: ReferenceEntryEncoded[];
}

export interface ReferenceLibraryFile {
  version: 1;
  modelId: string;
  dim: number;
  quantization: "int8";
  createdAt: string;
  totalImagenes: number;
  attributes: Partial<Record<AtributoVision, ReferenceAttributeBucket>>;
}

export interface DecodedReferenceEntry {
  id: string;
  label: string;
  source: string;
  vector: Float32Array;
}

export interface KnnNeighbor {
  id: string;
  label: string;
  sim: number;
}

export interface KnnVoteResult {
  probs: Record<string, number>;
  maxSim: number;
  sinCoincidencia: boolean;
  vecinos: KnnNeighbor[];
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
      "base64"
    );
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Cuantiza un vector L2-normalizado a `int8` compacto en base64.
 */
export function cuantizarVector(f32: Float32Array): string {
  const int8 = new Int8Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const q = Math.round(f32[i] * 127);
    int8[i] = Math.max(-127, Math.min(127, q));
  }
  return bytesToBase64(new Uint8Array(int8.buffer, int8.byteOffset, int8.byteLength));
}

/**
 * Decodifica un vector base64 `int8` a `Float32Array` y lo renormaliza a norma unitaria L2.
 */
export function decodificarVector(b64: string, dim: number): Float32Array {
  const rawBytes = base64ToBytes(b64);
  const view = new Int8Array(
    rawBytes.buffer,
    rawBytes.byteOffset,
    Math.min(dim, rawBytes.byteLength)
  );
  const out = new Float32Array(dim);
  let normSq = 0;
  for (let i = 0; i < view.length; i++) {
    const val = view[i] / 127;
    out[i] = val;
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq);
  if (norm > 1e-12) {
    const inv = 1 / norm;
    for (let i = 0; i < out.length; i++) {
      out[i] *= inv;
    }
  }
  return out;
}

/**
 * Decodifica todas las entradas de una cubeta de atributo desde `ReferenceLibraryFile`.
 */
export function decodificarCubetaReferencia(
  bucket: ReferenceAttributeBucket,
  dim: number
): DecodedReferenceEntry[] {
  return bucket.entries.map((e) => ({
    id: e.id,
    label: e.label,
    source: e.source,
    vector: decodificarVector(e.v, dim),
  }));
}

function productoPunto(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Calcula votación kNN ponderada por `exp(sim / temperatura)` sobre los `k` vecinos más cercanos.
 */
export function votarKnn(
  query: Float32Array,
  entries: readonly DecodedReferenceEntry[],
  opts?: { k?: number; temperatura?: number }
): KnnVoteResult {
  if (entries.length === 0) {
    return {
      probs: {},
      maxSim: 0,
      sinCoincidencia: true,
      vecinos: [],
    };
  }

  const k = Math.max(1, opts?.k ?? 7);
  const temperatura = Math.max(1e-4, opts?.temperatura ?? 0.05);

  const scored: KnnNeighbor[] = entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    sim: productoPunto(query, entry.vector),
  }));
  scored.sort((a, b) => b.sim - a.sim);

  const vecinos = scored.slice(0, k);
  const maxSim = vecinos[0]?.sim ?? 0;

  const pesosPorEtiqueta: Record<string, number> = {};
  let sumaPesos = 0;

  for (const v of vecinos) {
    const peso = Math.exp((v.sim - maxSim) / temperatura);
    pesosPorEtiqueta[v.label] = (pesosPorEtiqueta[v.label] ?? 0) + peso;
    sumaPesos += peso;
  }

  const probs: Record<string, number> = {};
  if (sumaPesos > 0) {
    for (const [label, peso] of Object.entries(pesosPorEtiqueta)) {
      probs[label] = peso / sumaPesos;
    }
  }

  return {
    probs,
    maxSim,
    sinCoincidencia: maxSim < UMBRAL_SIN_COINCIDENCIA,
    vecinos,
  };
}

/**
 * Combina probabilidades de zero-shot texto con votación kNN de biblioteca visual.
 */
export function mezclarProbabilidades(
  zeroShot: Record<string, number> | undefined,
  knn: Record<string, number> | undefined,
  pesoKnn = 0.6
): Record<string, number> {
  const tieneZs = zeroShot && Object.keys(zeroShot).length > 0;
  const tieneKnn = knn && Object.keys(knn).length > 0;

  if (!tieneZs && !tieneKnn) return {};
  if (!tieneZs) return { ...(knn ?? {}) };
  if (!tieneKnn) return { ...(zeroShot ?? {}) };

  const wKnn = Math.max(0, Math.min(1, pesoKnn));
  const wZs = 1 - wKnn;
  const labels = new Set([...Object.keys(zeroShot), ...Object.keys(knn)]);

  const raw: Record<string, number> = {};
  let total = 0;
  for (const label of labels) {
    const v = (zeroShot[label] ?? 0) * wZs + (knn[label] ?? 0) * wKnn;
    raw[label] = v;
    total += v;
  }

  if (total <= 0) return {};
  const normalized: Record<string, number> = {};
  for (const [label, v] of Object.entries(raw)) {
    normalized[label] = v / total;
  }
  return normalized;
}

/**
 * Devuelve las `n` opciones con mayor probabilidad ordenadas de mayor a menor.
 */
export function topN(
  probs: Record<string, number>,
  n = 3
): { id: string; score: number }[] {
  return Object.entries(probs)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, n));
}
