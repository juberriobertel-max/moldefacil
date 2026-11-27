import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PRIMARY_VISION_MODEL } from "../lib/vision/garmentPrompts";
import type { VisionCropKey } from "../lib/vision/imagePreprocessor";
import type { ReferenceLibraryFile } from "../lib/vision/referenceMatcher";
import { ATRIBUTO_A_RECORTE, type AtributoVision } from "../lib/vision/visionAttributes";
import { slugModeloVision } from "./lib/nodeVisionPreprocess";

interface FeedbackRow {
  id: string;
  created_at: string;
  model_id: string;
  attribute: AtributoVision;
  crop_key: VisionCropKey;
  predicted_label: string;
  corrected_label: string;
  predicted_confidence: number | null;
  dim: number;
  vector_int8_b64: string;
  status: "pendiente" | "aprobado" | "rechazado";
  moderated_at: string | null;
}

const LOCAL_QUEUE_REL = path.join("data", "vision", "feedback-queue.jsonl");

function parseArgs(argv: string[]) {
  let list = false;
  let approveArg: string | null = null;
  let rejectArg: string | null = null;
  let mergeInto: string | null = null;
  let modelId = PRIMARY_VISION_MODEL;

  for (const arg of argv) {
    if (arg === "--list") list = true;
    else if (arg.startsWith("--approve=")) approveArg = arg.slice("--approve=".length).trim();
    else if (arg.startsWith("--reject=")) rejectArg = arg.slice("--reject=".length).trim();
    else if (arg.startsWith("--merge-into=")) mergeInto = arg.slice("--merge-into=".length).trim();
    else if (arg.startsWith("--model=")) modelId = arg.slice("--model=".length).trim();
  }

  if (!list && !approveArg && !rejectArg && !mergeInto) {
    list = true;
  }

  return { list, approveArg, rejectArg, mergeInto, modelId };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function leerColaLocal(): FeedbackRow[] {
  const abs = path.resolve(LOCAL_QUEUE_REL);
  if (!fs.existsSync(abs)) return [];
  const raw = fs.readFileSync(abs, "utf8").trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as FeedbackRow);
}

function escribirColaLocal(rows: FeedbackRow[]): void {
  const abs = path.resolve(LOCAL_QUEUE_REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(
    abs,
    rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length > 0 ? "\n" : ""),
    "utf8"
  );
}

async function cargarFilas(): Promise<{
  storage: "supabase" | "local_queue";
  rows: FeedbackRow[];
}> {
  const supa = getSupabaseAdmin();
  if (supa) {
    const { data, error } = await supa
      .from("vision_feedback_vectors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Error leyendo Supabase: ${error.message}`);
    return { storage: "supabase", rows: (data ?? []) as FeedbackRow[] };
  }
  return { storage: "local_queue", rows: leerColaLocal() };
}

async function actualizarEstado(
  idsArg: string,
  newStatus: "aprobado" | "rechazado",
  rows: FeedbackRow[]
): Promise<number> {
  const targetIds =
    idsArg === "all"
      ? rows.filter((r) => r.status === "pendiente").map((r) => r.id)
      : idsArg
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  if (targetIds.length === 0) return 0;
  const nowIso = new Date().toISOString();
  const supa = getSupabaseAdmin();

  if (supa) {
    const { error } = await supa
      .from("vision_feedback_vectors")
      .update({ status: newStatus, moderated_at: nowIso })
      .in("id", targetIds);
    if (error) throw new Error(`Error actualizando Supabase: ${error.message}`);
    return targetIds.length;
  }

  const idSet = new Set(targetIds);
  let updated = 0;
  const nextRows = rows.map((r) => {
    if (!idSet.has(r.id)) return r;
    updated++;
    return { ...r, status: newStatus, moderated_at: nowIso };
  });
  escribirColaLocal(nextRows);
  return updated;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { storage, rows } = await cargarFilas();
  console.log(`Fuente de feedback: ${storage} (${rows.length} registros totales)`);

  if (args.approveArg) {
    const n = await actualizarEstado(args.approveArg, "aprobado", rows);
    console.log(`Aprobados: ${n} registro(s).`);
  }

  if (args.rejectArg) {
    const n = await actualizarEstado(args.rejectArg, "rechazado", rows);
    console.log(`Rechazados: ${n} registro(s).`);
  }

  const fresh = args.approveArg || args.rejectArg ? await cargarFilas() : { storage, rows };

  if (args.list) {
    const counts = { pendiente: 0, aprobado: 0, rechazado: 0 };
    for (const r of fresh.rows) counts[r.status]++;
    console.log(
      `Resumen -> pendientes: ${counts.pendiente} | aprobados: ${counts.aprobado} | rechazados: ${counts.rechazado}`
    );
    const pendientes = fresh.rows.filter((r) => r.status === "pendiente");
    for (const r of pendientes.slice(0, 25)) {
      console.log(
        `  - ${r.id} | ${r.attribute}: ${r.predicted_label} -> ${r.corrected_label} | ${r.model_id} (dim=${r.dim})`
      );
    }
  }

  if (args.mergeInto) {
    const targetPath =
      args.mergeInto === "default"
        ? path.resolve(
            "public",
            "vision",
            "reference",
            `${slugModeloVision(args.modelId)}.json`
          )
        : path.resolve(args.mergeInto);

    if (!fs.existsSync(targetPath)) {
      throw new Error(
        `No existe la biblioteca destino: ${targetPath}. Ejecuta primero 'npm run vision:ref'.`
      );
    }

    const lib = JSON.parse(
      fs.readFileSync(targetPath, "utf8")
    ) as ReferenceLibraryFile;

    const aprobados = fresh.rows.filter(
      (r) =>
        r.status === "aprobado" &&
        r.model_id === lib.modelId &&
        r.dim === lib.dim
    );

    let agregados = 0;
    for (const row of aprobados) {
      const attr = row.attribute;
      if (!lib.attributes[attr]) {
        lib.attributes[attr] = {
          crop: ATRIBUTO_A_RECORTE[attr],
          entries: [],
        };
      }
      const bucket = lib.attributes[attr]!;
      const fbId = `fb-${row.id}`;
      if (bucket.entries.some((e) => e.id === fbId)) continue;
      bucket.entries.push({
        id: fbId,
        label: row.corrected_label,
        source: "feedback_usuario",
        v: row.vector_int8_b64,
      });
      agregados++;
    }

    if (agregados > 0) {
      lib.totalImagenes += agregados;
      lib.createdAt = new Date().toISOString();
      fs.writeFileSync(targetPath, JSON.stringify(lib), "utf8");
    }

    console.log(
      `Fusionados ${agregados} vector(es) aprobados en ${targetPath}.`
    );
    console.log(
      `Recuerda correr 'npm run vision:eval' sobre tus fotos apartadas antes de subir a producción.`
    );
  }
}

main().catch((err) => {
  console.error("Error gestionando feedback visual:", err);
  process.exit(1);
});
