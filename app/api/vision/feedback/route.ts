import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validarOrigenCsrf } from "@/lib/auth/securityGuards";
import {
  contieneCamposProhibidosFeedback,
  VisionFeedbackPayloadSchema,
} from "@/lib/vision/feedbackSchema";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 25;
const LOCAL_QUEUE_REL = path.join("data", "vision", "feedback-queue.jsonl");
const GLOBAL_RATE_KEY = "__moldefacil_vision_feedback_rl_v1__";

type RateBucket = { count: number; resetAt: number };

function getRateMap(): Map<string, RateBucket> {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_RATE_KEY]) {
    g[GLOBAL_RATE_KEY] = new Map<string, RateBucket>();
  }
  return g[GLOBAL_RATE_KEY] as Map<string, RateBucket>;
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}

function verificarRateLimit(ip: string): boolean {
  const map = getRateMap();
  const now = Date.now();
  const cur = map.get(ip);
  if (!cur || now > cur.resetAt) {
    map.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX_REQUESTS) {
    return false;
  }
  cur.count += 1;
  return true;
}

function crearSupabaseEscritura() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function leerColaLocal(): Array<Record<string, unknown>> {
  const abs = path.resolve(LOCAL_QUEUE_REL);
  if (!fs.existsSync(abs)) return [];
  const raw = fs.readFileSync(abs, "utf8").trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/**
 * POST /api/vision/feedback
 * Guarda únicamente el vector cuantizado anónimo + etiqueta corregida (nunca fotos ni datos personales),
 * siempre bajo consentimiento explícito (`consentAccepted: true`) y en estado `"pendiente"` para moderación.
 */
export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  if (!verificarRateLimit(getClientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "Demasiados envíos recientes. Intenta más tarde." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    );
  }

  if (contieneCamposProhibidosFeedback(rawBody)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se aceptan imágenes, datos personales ni medidas en este endpoint.",
      },
      { status: 400 }
    );
  }

  const parsed = VisionFeedbackPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Datos de vector de corrección inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const feedbackId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const supa = crearSupabaseEscritura();
  if (supa) {
    const { error } = await supa.from("vision_feedback_vectors").insert({
      id: feedbackId,
      model_id: d.modelId,
      attribute: d.attribute,
      crop_key: d.cropKey,
      predicted_label: d.predictedLabel,
      corrected_label: d.correctedLabel,
      predicted_confidence: d.predictedConfidence ?? null,
      dim: d.dim,
      vector_int8_b64: d.vectorInt8B64,
      status: "pendiente",
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo registrar la corrección en la base de datos.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, id: feedbackId, storage: "supabase", status: "pendiente" },
      { status: 201 }
    );
  }

  // Fallback local en desarrollo si Supabase no está configurado
  const absQueue = path.resolve(LOCAL_QUEUE_REL);
  fs.mkdirSync(path.dirname(absQueue), { recursive: true });
  const record = {
    id: feedbackId,
    created_at: createdAt,
    model_id: d.modelId,
    attribute: d.attribute,
    crop_key: d.cropKey,
    predicted_label: d.predictedLabel,
    corrected_label: d.correctedLabel,
    predicted_confidence: d.predictedConfidence ?? null,
    dim: d.dim,
    vector_int8_b64: d.vectorInt8B64,
    status: "pendiente",
    moderated_at: null,
  };
  fs.appendFileSync(absQueue, `${JSON.stringify(record)}\n`, "utf8");

  return NextResponse.json(
    { ok: true, id: feedbackId, storage: "local_queue", status: "pendiente" },
    { status: 201 }
  );
}

/**
 * GET /api/vision/feedback
 * Resumen para moderación interna (protegido con `VISION_MODERATION_TOKEN`).
 */
export async function GET(request: Request) {
  const configuredToken = process.env.VISION_MODERATION_TOKEN;
  if (configuredToken) {
    const provided = request.headers.get("x-vision-moderation-token");
    if (provided !== configuredToken) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Token de moderación no configurado." },
      { status: 503 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const supa = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supa
      .from("vision_feedback_vectors")
      .select(
        "id, created_at, model_id, attribute, crop_key, predicted_label, corrected_label, predicted_confidence, dim, status"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "Error consultando cola de moderación." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, storage: "supabase", items: data ?? [] });
  }

  const rows = leerColaLocal().map((r) => {
    const copy = { ...r };
    delete copy.vector_int8_b64;
    return copy;
  });
  return NextResponse.json({ ok: true, storage: "local_queue", items: rows });
}
