import fs from "node:fs";
import path from "node:path";
import {
  ejecutarInferenciaEnCascada,
  obtenerMotorVision,
} from "../lib/vision/cascadeRunner";
import { HIGH_CONFIDENCE_THRESHOLD } from "../lib/vision/garmentPrompts";
import {
  calcularEmbeddingImagen,
  cargarEmbedderImagen,
  type LoadedImageEmbedder,
} from "../lib/vision/imageEmbedder";
import type { VisionCropKey } from "../lib/vision/imagePreprocessor";
import {
  decodificarCubetaReferencia,
  type DecodedReferenceEntry,
  mezclarProbabilidades,
  type ReferenceLibraryFile,
  topN,
  UMBRAL_SIN_COINCIDENCIA,
  votarKnn,
} from "../lib/vision/referenceMatcher";
import {
  ATRIBUTO_A_RECORTE,
  ATRIBUTOS_VISION,
  type AtributoVision,
  grupoDesdeEvaluacion,
  TITULOS_ATRIBUTO_ES,
} from "../lib/vision/visionAttributes";
import {
  calcularSha256Archivo,
  cargarYValidarManifest,
  cropARawImage,
  prepararRecortesDesdeArchivo,
  slugModeloVision,
  type VisionManifestItem,
} from "./lib/nodeVisionPreprocess";

type EvalMethod = "zeroshot" | "knn" | "blend";

interface CliArgs {
  manifestPath: string;
  refManifestPath: string;
  referencePath: string | null;
  methods: EvalMethod[];
  methodsExplicit: boolean;
  pesoKnn: number;
  limit: number | null;
}

interface PredictionErrorDetail {
  id: string;
  file: string;
  truth: string;
  predicted: string;
  confidence: number;
  maxSim?: number;
}

interface MethodAttributeStats {
  method: EvalMethod;
  attribute: AtributoVision;
  n: number;
  covered: number;
  coverage: number;
  top1Correct: number;
  top1Acc: number;
  top3Correct: number;
  top3Acc: number;
  highConfCount: number;
  highConfRate: number;
  highConfAcc: number | null;
  lowConfCount: number;
  lowConfAcc: number | null;
  noMatchCount: number;
  noMatchRate: number | null;
  confusionMatrix: Record<string, Record<string, number>>;
  errors: PredictionErrorDetail[];
}

interface AccumulatorItem {
  id: string;
  file: string;
  truth: string;
  probs: Record<string, number> | undefined;
  maxSim?: number;
  sinCoincidencia?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let manifestPath = "data/vision/eval/manifest.json";
  let refManifestPath = "data/vision/reference/manifest.json";
  let referencePath: string | null = null;
  let methods: EvalMethod[] = ["zeroshot"];
  let methodsExplicit = false;
  let pesoKnn = 0.6;
  let limit: number | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length).trim();
    } else if (arg.startsWith("--ref-manifest=")) {
      refManifestPath = arg.slice("--ref-manifest=".length).trim();
    } else if (arg.startsWith("--reference=")) {
      referencePath = arg.slice("--reference=".length).trim();
    } else if (arg.startsWith("--methods=")) {
      methodsExplicit = true;
      const raw = arg
        .slice("--methods=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const valid = raw.filter(
        (m): m is EvalMethod =>
          m === "zeroshot" || m === "knn" || m === "blend"
      );
      if (valid.length === 0) {
        throw new Error(
          `--methods debe contener al menos uno de: zeroshot, knn, blend.`
        );
      }
      methods = Array.from(new Set(valid));
    } else if (arg.startsWith("--peso-knn=")) {
      const parsed = Number(arg.slice("--peso-knn=".length));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        throw new Error(`--peso-knn debe estar entre 0 y 1.`);
      }
      pesoKnn = parsed;
    } else if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--limit debe ser un entero positivo.`);
      }
      limit = Math.floor(parsed);
    }
  }

  return {
    manifestPath,
    refManifestPath,
    referencePath,
    methods,
    methodsExplicit,
    pesoKnn,
    limit,
  };
}

function obtenerHashesReferencia(refManifestPath: string): Set<string> {
  const hashes = new Set<string>();
  const absRefManifest = path.resolve(refManifestPath);
  if (!fs.existsSync(absRefManifest)) return hashes;

  const { manifestDir, items } = cargarYValidarManifest(absRefManifest);
  for (const item of items) {
    const absFile = path.resolve(manifestDir, item.file);
    if (fs.existsSync(absFile)) {
      hashes.add(calcularSha256Archivo(absFile));
    }
  }
  return hashes;
}

function resumirStats(
  method: EvalMethod,
  attribute: AtributoVision,
  records: AccumulatorItem[]
): MethodAttributeStats {
  const n = records.length;
  let covered = 0;
  let top1Correct = 0;
  let top3Correct = 0;
  let highConfCount = 0;
  let highConfCorrect = 0;
  let lowConfCount = 0;
  let lowConfCorrect = 0;
  let noMatchCount = 0;
  const confusionMatrix: Record<string, Record<string, number>> = {};
  const errors: PredictionErrorDetail[] = [];

  for (const rec of records) {
    const hasProbs = Boolean(rec.probs && Object.keys(rec.probs).length > 0);
    const ranked = hasProbs ? topN(rec.probs!, 3) : [];
    const top1 = ranked[0];
    const predLabel = top1?.id ?? "_sin_prediccion";
    const conf = top1?.score ?? 0;

    if (hasProbs) covered++;
    if (method === "knn" && rec.sinCoincidencia) {
      noMatchCount++;
    }

    if (!confusionMatrix[rec.truth]) confusionMatrix[rec.truth] = {};
    confusionMatrix[rec.truth][predLabel] =
      (confusionMatrix[rec.truth][predLabel] ?? 0) + 1;

    const isTop1 = predLabel === rec.truth;
    const isTop3 = ranked.some((c) => c.id === rec.truth);

    if (isTop1) top1Correct++;
    if (isTop3) top3Correct++;

    if (hasProbs) {
      if (conf >= HIGH_CONFIDENCE_THRESHOLD) {
        highConfCount++;
        if (isTop1) highConfCorrect++;
      } else {
        lowConfCount++;
        if (isTop1) lowConfCorrect++;
      }
    }

    if (!isTop1) {
      errors.push({
        id: rec.id,
        file: rec.file,
        truth: rec.truth,
        predicted: predLabel,
        confidence: conf,
        ...(rec.maxSim !== undefined ? { maxSim: rec.maxSim } : {}),
      });
    }
  }

  errors.sort((a, b) => b.confidence - a.confidence);

  return {
    method,
    attribute,
    n,
    covered,
    coverage: n > 0 ? covered / n : 0,
    top1Correct,
    top1Acc: n > 0 ? top1Correct / n : 0,
    top3Correct,
    top3Acc: n > 0 ? top3Correct / n : 0,
    highConfCount,
    highConfRate: covered > 0 ? highConfCount / covered : 0,
    highConfAcc: highConfCount > 0 ? highConfCorrect / highConfCount : null,
    lowConfCount,
    lowConfAcc: lowConfCount > 0 ? lowConfCorrect / lowConfCount : null,
    noMatchCount,
    noMatchRate: method === "knn" && n > 0 ? noMatchCount / n : null,
    confusionMatrix,
    errors,
  };
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function generarMarkdownReporte(params: {
  createdAt: string;
  modelId: string;
  referencePath: string | null;
  pesoKnn: number;
  methods: EvalMethod[];
  totalEvalItems: number;
  excludedLeakage: Array<{ id: string; file: string; sha256: string }>;
  missingFiles: Array<{ id: string; file: string }>;
  aiGeneratedCount: number;
  stats: MethodAttributeStats[];
}): string {
  const lines: string[] = [];
  lines.push(`# Evaluación del detector visual de prendas`);
  lines.push("");
  lines.push(`- **Fecha:** ${params.createdAt}`);
  lines.push(`- **Modelo cascada:** \`${params.modelId}\``);
  lines.push(
    `- **Biblioteca de referencia:** ${params.referencePath ? `\`${params.referencePath}\`` : "No cargada"}`
  );
  lines.push(`- **Métodos evaluados:** ${params.methods.join(", ")} (peso kNN=${params.pesoKnn})`);
  lines.push(`- **Fotos evaluadas:** ${params.totalEvalItems}`);
  lines.push(
    `- **Excluidas por fuga (duplicado SHA-256 con reference/):** ${params.excludedLeakage.length}`
  );
  lines.push(`- **Omitidas por archivo faltante:** ${params.missingFiles.length}`);
  lines.push("");

  if (params.aiGeneratedCount > 0) {
    lines.push(
      `> **Set de humo con imágenes IA (${params.aiGeneratedCount}/${params.totalEvalItems}):** no es una medición real. Úsalo solo para comprobar el pipeline de punta a punta; para medir mejoras reales necesitas ~100 fotos reales apartadas en \`data/vision/eval/\`.`
    );
    lines.push("");
  }

  if (params.excludedLeakage.length > 0) {
    lines.push(`## Fugas excluidas (SHA-256 repetido en reference)`);
    for (const f of params.excludedLeakage) {
      lines.push(`- \`${f.id}\` (\`${f.file}\`) — \`${f.sha256.slice(0, 12)}...\``);
    }
    lines.push("");
  }

  lines.push(`## Resumen por atributo y método`);
  lines.push("");
  lines.push(
    `| Atributo | Método | N | Cobertura | Top-1 | Top-3 | >=60% Conf | Acc >=60% | Acc <60% | Sin coinc. (<${UMBRAL_SIN_COINCIDENCIA}) |`
  );
  lines.push(`|---|---|---:|---:|---:|---:|---:|---:|---:|---:|`);

  for (const st of params.stats) {
    lines.push(
      `| ${TITULOS_ATRIBUTO_ES[st.attribute]} (\`${st.attribute}\`) | \`${st.method}\` | ${st.n} | ${st.covered}/${st.n} (${fmtPct(st.coverage)}) | ${st.top1Correct}/${st.n} (${fmtPct(st.top1Acc)}) | ${st.top3Correct}/${st.n} (${fmtPct(st.top3Acc)}) | ${fmtPct(st.highConfRate)} | ${fmtPct(st.highConfAcc)} | ${fmtPct(st.lowConfAcc)} | ${fmtPct(st.noMatchRate)} |`
    );
  }
  lines.push("");

  lines.push(`## Errores principales y matrices de confusión`);
  lines.push("");
  for (const st of params.stats) {
    lines.push(`### ${TITULOS_ATRIBUTO_ES[st.attribute]} (\`${st.attribute}\`) — \`${st.method}\``);
    lines.push("");
    if (st.errors.length === 0) {
      lines.push(`Sin errores (0/${st.n}).`);
    } else {
      lines.push(`**Errores (ordenados por mayor confianza):**`);
      for (const err of st.errors.slice(0, 10)) {
        const simTxt =
          err.maxSim !== undefined ? `, maxSim=${err.maxSim.toFixed(3)}` : "";
        lines.push(
          `- \`${err.id}\` (\`${err.file}\`): real \`${err.truth}\` -> pred \`${err.predicted}\` (conf=${(err.confidence * 100).toFixed(1)}%${simTxt})`
        );
      }
    }
    lines.push("");
    lines.push(`**Matriz de confusión (real -> predicho):**`);
    lines.push("");
    for (const [truth, preds] of Object.entries(st.confusionMatrix)) {
      const detail = Object.entries(preds)
        .map(([p, c]) => `\`${p}\`: ${c}`)
        .join(", ");
      lines.push(`- \`${truth}\`: ${detail}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { manifestDir, items: rawItems } = cargarYValidarManifest(
    args.manifestPath
  );
  const items = args.limit ? rawItems.slice(0, args.limit) : rawItems;

  const refHashes = obtenerHashesReferencia(args.refManifestPath);
  console.log(
    `Manifiesto eval: ${path.resolve(args.manifestPath)} (${items.length} ítems) | Hashes en reference: ${refHashes.size}`
  );

  // Detectar fugas y archivos faltantes antes de correr inferencia
  const validItems: Array<{ item: VisionManifestItem; absPath: string }> = [];
  const excludedLeakage: Array<{ id: string; file: string; sha256: string }> =
    [];
  const missingFiles: Array<{ id: string; file: string }> = [];

  for (const item of items) {
    const absPath = path.resolve(manifestDir, item.file);
    if (!fs.existsSync(absPath)) {
      console.warn(`[OMITIDO] No existe archivo eval '${item.id}': ${absPath}`);
      missingFiles.push({ id: item.id, file: item.file });
      continue;
    }
    const sha = calcularSha256Archivo(absPath);
    if (refHashes.has(sha)) {
      console.error(
        `[FUGA DETECTADA — EXCLUIDA] '${item.id}' (${item.file}) tiene el mismo SHA-256 que una imagen de reference/.`
      );
      excludedLeakage.push({ id: item.id, file: item.file, sha256: sha });
      continue;
    }
    validItems.push({ item, absPath });
  }

  const aiGeneratedCount = validItems.filter(
    (v) => v.item.source === "ai_generated"
  ).length;
  if (aiGeneratedCount > 0) {
    console.log(
      `\n========================================================================`
    );
    console.log(
      `Set de humo con imágenes IA: no es una medición real (${aiGeneratedCount}/${validItems.length} fotos IA)`
    );
    console.log(
      `========================================================================\n`
    );
  }

  if (validItems.length === 0) {
    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/[:.]/g, "-");
    const reportsDir = path.resolve("data", "vision", "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const jsonReportPath = path.join(reportsDir, `eval-${stamp}.json`);
    const mdReportPath = path.join(reportsDir, "latest.md");
    const msg =
      excludedLeakage.length > 0
        ? `Todas las imágenes (${excludedLeakage.length}) fueron excluidas por fuga con reference/. No hay ítems para evaluar.`
        : "No hay imágenes válidas para evaluar en el manifiesto.";
    console.warn(`[AVISO] ${msg}`);

    fs.writeFileSync(
      jsonReportPath,
      JSON.stringify(
        {
          createdAt,
          modelId: "no-evaluado",
          referencePath: null,
          pesoKnn: args.pesoKnn,
          methods: args.methods,
          totalEvalItems: 0,
          excludedLeakage,
          missingFiles,
          aiGeneratedCount: 0,
          stats: [],
        },
        null,
        2
      ),
      "utf8"
    );
    fs.writeFileSync(
      mdReportPath,
      generarMarkdownReporte({
        createdAt,
        modelId: "no-evaluado",
        referencePath: null,
        pesoKnn: args.pesoKnn,
        methods: args.methods,
        totalEvalItems: 0,
        excludedLeakage,
        missingFiles,
        aiGeneratedCount: 0,
        stats: [],
      }),
      "utf8"
    );
    return;
  }

  // Cargar modelo zero-shot para conocer modelId efectivo
  const engine = await obtenerMotorVision();
  const modelId = engine.modelId;
  console.log(`Motor cascada cargado: ${modelId} (${engine.backend})`);

  // Resolver archivo de referencia
  const defaultRefPath = path.resolve(
    "public",
    "vision",
    "reference",
    `${slugModeloVision(modelId)}.json`
  );
  const resolvedRefPath = args.referencePath
    ? path.resolve(args.referencePath)
    : defaultRefPath;

  let methodsToRun: EvalMethod[] = [...args.methods];
  if (!args.methodsExplicit && fs.existsSync(resolvedRefPath)) {
    methodsToRun = ["zeroshot", "knn", "blend"];
  }

  let refLibrary: ReferenceLibraryFile | null = null;
  const decodedBuckets = new Map<AtributoVision, DecodedReferenceEntry[]>();
  let embedder: LoadedImageEmbedder | null = null;

  if (methodsToRun.includes("knn") || methodsToRun.includes("blend")) {
    if (!fs.existsSync(resolvedRefPath)) {
      console.warn(
        `[AVISO] No se encontró biblioteca de referencia en ${resolvedRefPath}; se omiten métodos knn/blend.`
      );
      methodsToRun = methodsToRun.filter((m) => m === "zeroshot");
    } else {
      const parsedRef = JSON.parse(
        fs.readFileSync(resolvedRefPath, "utf8")
      ) as ReferenceLibraryFile;
      if (parsedRef.modelId !== modelId) {
        console.warn(
          `[AVISO] La biblioteca (${parsedRef.modelId}) no coincide con el modelo activo (${modelId}); se omiten knn/blend.`
        );
        methodsToRun = methodsToRun.filter((m) => m === "zeroshot");
      } else {
        refLibrary = parsedRef;
        for (const attr of ATRIBUTOS_VISION) {
          const bucket = parsedRef.attributes[attr];
          if (bucket && bucket.entries.length > 0) {
            decodedBuckets.set(
              attr,
              decodificarCubetaReferencia(bucket, parsedRef.dim)
            );
          }
        }
        embedder = await cargarEmbedderImagen(modelId, "cpu");
      }
    }
  }

  if (methodsToRun.length === 0) {
    throw new Error("No quedó ningún método de evaluación activo.");
  }

  const accumulators = new Map<string, AccumulatorItem[]>();
  const pushRecord = (
    method: EvalMethod,
    attr: AtributoVision,
    rec: AccumulatorItem
  ) => {
    const key = `${method}::${attr}`;
    const arr = accumulators.get(key) ?? [];
    arr.push(rec);
    accumulators.set(key, arr);
  };

  for (let idx = 0; idx < validItems.length; idx++) {
    const { item, absPath } = validItems[idx];
    console.log(
      `[${idx + 1}/${validItems.length}] Evaluando ${item.id} (${item.file})...`
    );
    const prep = await prepararRecortesDesdeArchivo(absPath);
    const rawEval = await ejecutarInferenciaEnCascada(prep.crops);

    const cacheCropVec = new Map<VisionCropKey, Float32Array>();
    const labelPairs = Object.entries(item.labels) as Array<
      [AtributoVision, string]
    >;

    for (const [attr, truth] of labelPairs) {
      if (!truth) continue;

      const zsGroup = grupoDesdeEvaluacion(rawEval, attr);
      const zsProbs: Record<string, number> | undefined = zsGroup
        ? Object.fromEntries(zsGroup.all.map((c) => [c.id, c.confidence]))
        : undefined;

      if (methodsToRun.includes("zeroshot")) {
        pushRecord("zeroshot", attr, {
          id: item.id,
          file: item.file,
          truth,
          probs: zsProbs,
        });
      }

      let knnRes:
        | {
            probs: Record<string, number>;
            maxSim: number;
            sinCoincidencia: boolean;
          }
        | undefined;

      if (
        embedder &&
        refLibrary &&
        (methodsToRun.includes("knn") || methodsToRun.includes("blend"))
      ) {
        const refEntries = decodedBuckets.get(attr);
        if (refEntries && refEntries.length > 0) {
          const cropKey = ATRIBUTO_A_RECORTE[attr];
          let qVec = cacheCropVec.get(cropKey);
          if (!qVec) {
            qVec = await calcularEmbeddingImagen(
              embedder,
              cropARawImage(prep.crops[cropKey])
            );
            cacheCropVec.set(cropKey, qVec);
          }
          const vote = votarKnn(qVec, refEntries);
          knnRes = {
            probs: vote.probs,
            maxSim: vote.maxSim,
            sinCoincidencia: vote.sinCoincidencia,
          };
        }
      }

      if (methodsToRun.includes("knn")) {
        pushRecord("knn", attr, {
          id: item.id,
          file: item.file,
          truth,
          probs: knnRes?.probs,
          maxSim: knnRes?.maxSim,
          sinCoincidencia: knnRes?.sinCoincidencia ?? true,
        });
      }

      if (methodsToRun.includes("blend")) {
        const blended = mezclarProbabilidades(
          zsProbs,
          knnRes?.probs,
          args.pesoKnn
        );
        pushRecord("blend", attr, {
          id: item.id,
          file: item.file,
          truth,
          probs: Object.keys(blended).length > 0 ? blended : undefined,
        });
      }
    }
  }

  const allStats: MethodAttributeStats[] = [];
  for (const attr of ATRIBUTOS_VISION) {
    for (const method of methodsToRun) {
      const records = accumulators.get(`${method}::${attr}`);
      if (!records || records.length === 0) continue;
      allStats.push(resumirStats(method, attr, records));
    }
  }

  console.log("\n=== Resultados por atributo y método ===");
  for (const st of allStats) {
    const noMatchTxt =
      st.noMatchRate !== null ? ` | sinCoinc=${fmtPct(st.noMatchRate)}` : "";
    console.log(
      `${st.attribute.padEnd(10)} | ${st.method.padEnd(8)} | n=${String(st.n).padStart(3)} | cov=${fmtPct(st.coverage).padStart(6)} | top1=${fmtPct(st.top1Acc).padStart(6)} | top3=${fmtPct(st.top3Acc).padStart(6)} | >=60%:${fmtPct(st.highConfRate).padStart(6)} (acc ${fmtPct(st.highConfAcc)})${noMatchTxt}`
    );
  }

  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, "-");
  const reportsDir = path.resolve("data", "vision", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonReportPath = path.join(reportsDir, `eval-${stamp}.json`);
  const mdReportPath = path.join(reportsDir, "latest.md");

  const refPathShown = refLibrary
    ? path.relative(process.cwd(), resolvedRefPath).replace(/\\/g, "/")
    : null;

  fs.writeFileSync(
    jsonReportPath,
    JSON.stringify(
      {
        createdAt,
        modelId,
        referencePath: refPathShown,
        pesoKnn: args.pesoKnn,
        methods: methodsToRun,
        totalEvalItems: validItems.length,
        excludedLeakage,
        missingFiles,
        aiGeneratedCount,
        stats: allStats,
      },
      null,
      2
    ),
    "utf8"
  );

  const md = generarMarkdownReporte({
    createdAt,
    modelId,
    referencePath: refPathShown,
    pesoKnn: args.pesoKnn,
    methods: methodsToRun,
    totalEvalItems: validItems.length,
    excludedLeakage,
    missingFiles,
    aiGeneratedCount,
    stats: allStats,
  });
  fs.writeFileSync(mdReportPath, md, "utf8");

  console.log(`\nReportes escritos en:`);
  console.log(`- ${mdReportPath}`);
  console.log(`- ${jsonReportPath}`);
}

main().catch((err) => {
  console.error("Error ejecutando evaluación visual:", err);
  process.exit(1);
});
