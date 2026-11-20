import { NextResponse } from "next/server";
import { PUBLICACIONES_DEMO } from "@/lib/community/demoSeed";
import { evaluarTextoModeracion, normalizarTextoEspanol } from "@/lib/community/moderationEngine";
import { resolverEstadoInicialPublicacion } from "@/lib/community/rlsPolicyEngine";
import {
  CrearPublicacionSchema,
  sanitizarConfigMoldeSinMedidas,
  tieneClavesDeMedidasProhibidas,
} from "@/lib/community/schemas";

/**
 * GET /api/comunidad/publicaciones
 * Paginación por cursor, filtros básicos y garantía de que ninguna respuesta pública
 * exponga medidas corporales sensibles.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prenda = searchParams.get("prenda")?.trim();
  const tela = searchParams.get("tela")?.trim();
  const q = searchParams.get("q")?.trim();
  const cursor = searchParams.get("cursor");
  const limit = Math.min(24, Math.max(1, Number(searchParams.get("limit") ?? 12)));

  let filtradas = PUBLICACIONES_DEMO.filter((p) => p.estado === "publicada");
  if (prenda && prenda !== "Todas") {
    filtradas = filtradas.filter((p) => p.prenda === prenda);
  }
  if (tela && tela !== "Todas") {
    filtradas = filtradas.filter((p) => p.tela === tela);
  }
  if (q) {
    const qNorm = normalizarTextoEspanol(q);
    filtradas = filtradas.filter((p) =>
      normalizarTextoEspanol(
        `${p.titulo} ${p.descripcion} ${p.aprendizaje_nota} ${p.prenda} ${p.tela}`
      ).includes(qNorm)
    );
  }

  let inicio = 0;
  if (cursor) {
    const idx = filtradas.findIndex((p) => p.id === cursor);
    if (idx >= 0) inicio = idx + 1;
  }

  const pagina = filtradas.slice(inicio, inicio + limit);
  const nextCursor =
    inicio + limit < filtradas.length ? pagina[pagina.length - 1]?.id ?? null : null;

  const seguras = pagina.filter((p) => !tieneClavesDeMedidasProhibidas(p.config_molde));

  return NextResponse.json({
    items: seguras,
    nextCursor,
    total: filtradas.length,
  });
}

/**
 * POST /api/comunidad/publicaciones
 * Valida en servidor esquema Zod sin medidas, filtro de lenguaje y estado inicial.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawConfig =
      typeof body.config_molde === "object" &&
      body.config_molde !== null &&
      !Array.isArray(body.config_molde)
        ? (body.config_molde as Record<string, unknown>)
        : {};

    const parsed = CrearPublicacionSchema.safeParse({
      ...body,
      config_molde: sanitizarConfigMoldeSinMedidas(rawConfig),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Entrada inválida." },
        { status: 400 }
      );
    }

    const mod = evaluarTextoModeracion(
      `${parsed.data.titulo} ${parsed.data.descripcion} ${parsed.data.aprendizaje_nota}`
    );
    if (!mod.aprobado) {
      return NextResponse.json({ ok: false, error: mod.motivo }, { status: 400 });
    }

    const publicacionesAprobadas = Math.max(
      0,
      Number(body.publicaciones_aprobadas_count ?? 0) || 0
    );
    const estadoAsignado = resolverEstadoInicialPublicacion(
      {
        id: "server-validated-user",
        rol: "usuaria",
        publicaciones_aprobadas_count: publicacionesAprobadas,
      },
      "publicada"
    );

    return NextResponse.json(
      {
        ok: true,
        estado: estadoAsignado,
        config_molde: parsed.data.config_molde,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error procesando la publicación." },
      { status: 400 }
    );
  }
}