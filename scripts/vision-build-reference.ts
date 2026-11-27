import fs from "node:fs";
import path from "node:path";
import { PRIMARY_VISION_MODEL } from "../lib/vision/garmentPrompts";
import {
  calcularEmbeddingImagen,
  cargarEmbedderImagen,
} from "../lib/vision/imageEmbedder";
import type { VisionCropKey } from "../lib/vision/imagePreprocessor";
import {
  cuantizarVector,
  decodificarCubetaReferencia,
  type ReferenceAttributeBucket,
  type ReferenceLibraryFile,
  topN,
  votarKnn,
} from "../lib/vision/referenceMatcher";
import {
  ATRIBUTO_A_RECORTE,
  ATRIBUTOS_VISION,
  type AtributoVision,
  IDS_VALIDOS,
} from "../lib/vision/visionAttributes";
import {
  cargarYValidarManifest,
  cropARawImage,
  prepararRecortesDesdeArchivo,
  slugModeloVision,
} from "./lib/nodeVisionPreprocess";

interface CliArgs {
  modelId: string;
  manifestPath: string;
  outPath: string;
  runLoo: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let modelId = PRIMARY_VISION_MODEL;
  let manifestPath = "data/vision/reference/manifest.json";
  let outPath = "";
  let runLoo = false;

  for (const arg of argv) {
    if (arg.startsWith("--model=")) {
      modelId = arg.slice("--model=".length).trim();
    } else if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length).trim();
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length).trim();
    } else if (arg === "--loo") {
      runLoo = true;
    }
  }

  if (!outPath) {
    outPath = path.join(
      "public",
      "vision",
      "reference",
      `${slugModeloVision(modelId)}.json`
    );
  }

  return { modelId, manifestPath, outPath, runLoo };
}

function imprimirReporteCobertura(library: ReferenceLibraryFile): void {
  console.log("\n=== Cobertura de biblioteca de referencia ===");
  for (const attr of ATRIBUTOS_VISION) {
    const bucket = library.attributes[attr];
    if (!bucket || bucket.entries.length === 0) {
      continue;
    }

    const counts = new Map<string, number>();
    for (const id of IDS_VALIDOS[attr]) {
      counts.set(id, 0);
    }
    for (const entry of bucket.entries) {
      counts.set(entry.label, (counts.get(entry.label) ?? 0) + 1);
    }

    const resumen = Array.from(counts.entries())
      .map(([label, count]) => `${label}:${count}`)
      .join(", ");
    console.log(`- ${attr} (${bucket.crop}, n=${bucket.entries.length}): ${resumen}`);

    const bajos = Array.from(counts.entries())
      .filter(([, c]) => c > 0 && c < 3)
      .map(([k, c]) => `${k} (${c})`);
    const vacios = Array.from(counts.entries())
      .filter(([, c]) => c === 0)
      .map(([k]) => k);

    if (bajos.length > 0) {
      console.warn(`  [AVISO] Valores con < 3 ejemplos en '${attr}': ${bajos.join(", ")}`);
    }
    if (vacios.length > 0) {
      console.warn(`  [AVISO] Valores con 0 ejemplos en '${attr}': ${vacios.join(", ")}`);
    }
  }
}

function ejecutarLeaveOneOut(library: ReferenceLibraryFile): void {
  console.log("\n=== Validación Leave-One-Out (LOO kNN) ===");
  for (const attr of ATRIBUTOS_VISION) {
    const bucket = library.attributes[attr];
    if (!bucket || bucket.entries.length < 2) continue;

    const decoded = decodificarCubetaReferencia(bucket, library.dim);
    let total = 0;
    let aciertos = 0;
    const perLabel = new Map<string, { total: number; ok: number }>();

    for (let i = 0; i < decoded.length; i++) {
      const target = decoded[i];
      const resto = decoded.filter((_, j) => j !== i);
      const res = votarKnn(target.vector, resto);
      const pred = topN(res.probs, 1)[0]?.id;
      const ok = pred === target.label;

      total++;
      if (ok) aciertos++;
      const stat = perLabel.get(target.label) ?? { total: 0, ok: 0 };
      stat.total++;
      if (ok) stat.ok++;
      perLabel.set(target.label, stat);
    }

    const accPct = ((aciertos / Math.max(1, total)) * 100).toFixed(1);
    const desglose = Array.from(perLabel.entries())
      .map(
        ([label, st]) =>
          `${label}=${st.ok}/${st.total} (${((st.ok / st.total) * 100).toFixed(0)}%)`
      )
      .join(", ");
    console.log(`- ${attr}: Top-1 LOO ${aciertos}/${total} (${accPct}%) | ${desglose}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { manifestDir, items } = cargarYValidarManifest(args.manifestPath);

  console.log(`Modelo embedder: ${args.modelId}`);
  console.log(`Manifiesto: ${path.resolve(args.manifestPath)} (${items.length} ítems)`);

  const embedder = await cargarEmbedderImagen(args.modelId, "cpu");

  const buckets: Partial<Record<AtributoVision, ReferenceAttributeBucket>> = {};
  let dim = 0;
  let imagenesProcesadas = 0;
  let imagenesOmitidas = 0;

  for (const item of items) {
    const absImg = path.resolve(manifestDir, item.file);
    if (!fs.existsSync(absImg)) {
      console.warn(`[OMITIDO] No se encontró imagen para '${item.id}': ${absImg}`);
      imagenesOmitidas++;
      continue;
    }

    const labelPairs = Object.entries(item.labels) as Array<[AtributoVision, string]>;
    if (labelPairs.length === 0) {
      console.warn(`[OMITIDO] El ítem '${item.id}' no tiene etiquetas.`);
      imagenesOmitidas++;
      continue;
    }

    const prep = await prepararRecortesDesdeArchivo(absImg);
    const cacheCrop = new Map<VisionCropKey, string>();

    for (const [attr, labelVal] of labelPairs) {
      if (!labelVal) continue;
      const cropKey = ATRIBUTO_A_RECORTE[attr];
      let vecB64 = cacheCrop.get(cropKey);
      if (!vecB64) {
        const rawImg = cropARawImage(prep.crops[cropKey]);
        const vec = await calcularEmbeddingImagen(embedder, rawImg);
        if (dim === 0) dim = vec.length;
        else if (vec.length !== dim) {
          throw new Error(
            `Dimensión inconsistente de embedding (${vec.length} != ${dim}) en ${item.id}`
          );
        }
        vecB64 = cuantizarVector(vec);
        cacheCrop.set(cropKey, vecB64);
      }

      if (!buckets[attr]) {
        buckets[attr] = { crop: cropKey, entries: [] };
      }
      buckets[attr]!.entries.push({
        id: item.id,
        label: labelVal,
        source: item.source,
        v: vecB64,
      });
    }

    imagenesProcesadas++;
  }

  const library: ReferenceLibraryFile = {
    version: 1,
    modelId: args.modelId,
    dim,
    quantization: "int8",
    createdAt: new Date().toISOString(),
    totalImagenes: imagenesProcesadas,
    attributes: buckets,
  };

  const absOut = path.resolve(args.outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  const jsonCompact = JSON.stringify(library);
  fs.writeFileSync(absOut, jsonCompact, "utf8");

  const sizeBytes = Buffer.byteLength(jsonCompact, "utf8");
  const sizeKb = (sizeBytes / 1024).toFixed(1);
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);

  console.log(`\nGuardado: ${absOut}`);
  console.log(
    `Imágenes procesadas: ${imagenesProcesadas} (omitidas: ${imagenesOmitidas}) | Dimensión: ${dim} | Tamaño: ${sizeKb} KB (${sizeMb} MB)`
  );
  if (sizeBytes > 1.5 * 1024 * 1024) {
    console.warn(
      `[AVISO] El archivo de referencia supera 1.5 MB (${sizeMb} MB). Evalúa reducir ejemplos por atributo o usar shard por atributo.`
    );
  }

  imprimirReporteCobertura(library);

  if (args.runLoo) {
    ejecutarLeaveOneOut(library);
  }
}

main().catch((err) => {
  console.error("Error construyendo biblioteca de referencia:", err);
  process.exit(1);
});
