import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { validarOrigenCsrf } from "@/lib/auth/securityGuards";
import { obtenerSesionServidor } from "@/lib/auth/serverAuth";
import { PUBLICACIONES_DEMO } from "@/lib/community/demoSeed";
import {
  evaluarTextoModeracion,
  normalizarTextoEspanol,
} from "@/lib/community/moderationEngine";
import {
  resolverEstadoInicialPublicacion,
  puedeEditarContenido,
} from "@/lib/community/rlsPolicyEngine";
import {
  CrearPublicacionSchema,
  sanitizarConfigMoldeSinMedidas,
  tieneClavesDeMedidasProhibidas,
} from "@/lib/community/schemas";
import type { PublicacionComunidad } from "@/lib/community/types";

const GLOBAL_PUBS_KEY = "__moldefacil_server_publicaciones_v1__";

interface ServerPubsStore {
  creadas: Map<string, PublicacionComunidad>;
  eliminadas: Set<string>;
}

function getServerPubsStore(): ServerPubsStore {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_PUBS_KEY]) {
    g[GLOBAL_PUBS_KEY] = {
      creadas: new Map<string, PublicacionComunidad>(),
      eliminadas: new Set<string>(),
    } satisfies ServerPubsStore;
  }
  return g[GLOBAL_PUBS_KEY] as ServerPubsStore;
}

/**
 * GET /api/comunidad/publicaciones
 * Paginación por cursor, filtros por prenda, tela, tipo ("molde_plataforma" | "moda_real")
 * y garantía de cero exposición de medidas corporales sensibles.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prenda = searchParams.get("prenda")?.trim();
  const tela = searchParams.get("tela")?.trim();
  const tipo = searchParams.get("tipo")?.trim();
  const q = searchParams.get("q")?.trim();
  const cursor = searchParams.get("cursor");
  const limit = Math.min(24, Math.max(1, Number(searchParams.get("limit") ?? 12)));

  const st = getServerPubsStore();
  const todas = [
    ...Array.from(st.creadas.values()),
    ...PUBLICACIONES_DEMO,
  ].filter((p) => !st.eliminadas.has(p.id));

  let filtradas = todas.filter((p) => p.estado === "publicada");
  if (prenda && prenda !== "Todas") {
    filtradas = filtradas.filter((p) => p.prenda === prenda);
  }
  if (tela && tela !== "Todas") {
    filtradas = filtradas.filter((p) => p.tela === tela);
  }
  if (tipo === "moda_real" || tipo === "molde_plataforma") {
    filtradas = filtradas.filter(
      (p) => (p.tipo_publicacion ?? "molde_plataforma") === tipo
    );
  }
  if (q) {
    const qNorm = normalizarTextoEspanol(q);
    filtradas = filtradas.filter((p) =>
      normalizarTextoEspanol(
        `${p.titulo} ${p.descripcion} ${p.aprendizaje_nota} ${p.prenda} ${p.tela} ${p.referencia_inspiracion ?? ""}`
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

  const seguras = pagina.filter((p) =>
    p.config_molde ? !tieneClavesDeMedidasProhibidas(p.config_molde) : true
  );

  return NextResponse.json({
    items: seguras,
    nextCursor,
    total: filtradas.length,
  });
}

/**
 * POST /api/comunidad/publicaciones
 * Requiere sesión autenticada (401) + correo verificado (403) + CSRF válido.
 * Soporta tanto publicaciones con molde de MoldeFácil como "moda_real".
 */
export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Inicia sesión para publicar en la comunidad." },
      { status: 401 }
    );
  }

  if (!sesion.correoVerificado) {
    return NextResponse.json(
      {
        ok: false,
        error: "Verifica tu correo electrónico en Mi Cuenta antes de publicar o comentar.",
      },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tipoPublicacion =
      body.tipo_publicacion === "moda_real" ? "moda_real" : "molde_plataforma";

    const rawConfig =
      tipoPublicacion === "molde_plataforma" &&
      typeof body.config_molde === "object" &&
      body.config_molde !== null &&
      !Array.isArray(body.config_molde)
        ? sanitizarConfigMoldeSinMedidas(body.config_molde as Record<string, unknown>)
        : undefined;

    const parsed = CrearPublicacionSchema.safeParse({
      ...body,
      tipo_publicacion: tipoPublicacion,
      config_molde: rawConfig,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Entrada inválida." },
        { status: 400 }
      );
    }

    const mod = evaluarTextoModeracion(
      `${parsed.data.titulo} ${parsed.data.descripcion} ${parsed.data.aprendizaje_nota} ${parsed.data.referencia_inspiracion ?? ""}`
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
        id: sesion.usuariaId,
        rol: sesion.rol,
        publicaciones_aprobadas_count: publicacionesAprobadas,
      },
      "publicada"
    );

    const nuevaId = crypto.randomUUID();
    const nuevaPublicacion: PublicacionComunidad = {
      id: nuevaId,
      slug: `${parsed.data.titulo
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 48)}-${nuevaId.slice(0, 6)}`,
      autora_id: sesion.usuariaId,
      tipo_publicacion: parsed.data.tipo_publicacion,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion,
      aprendizaje_nota: parsed.data.aprendizaje_nota,
      prenda: parsed.data.prenda,
      tela: parsed.data.tela,
      dificultad: parsed.data.dificultad,
      tiempo_horas: parsed.data.tiempo_horas,
      costo_aprox: parsed.data.costo_aprox,
      config_molde: parsed.data.config_molde,
      referencia_inspiracion: parsed.data.referencia_inspiracion,
      version_config: 1,
      captura_3d_url: parsed.data.captura_3d_url,
      permiso_fotos_confirmado: true,
      reto_id: parsed.data.reto_id,
      estado: estadoAsignado,
      conteo_reacciones: 0,
      conteo_comentarios: 0,
      conteo_guardados: 0,
      conteo_remixes: 0,
      es_demo: false,
      creado_en: new Date().toISOString(),
      fotos: parsed.data.fotos.map((f, idx) => ({
        id: crypto.randomUUID(),
        publicacion_id: nuevaId,
        url: f.url,
        alt: f.alt,
        orden: idx,
        ancho: f.ancho,
        alto: f.alto,
        exif_limpio: true,
      })),
    };

    getServerPubsStore().creadas.set(nuevaId, nuevaPublicacion);

    return NextResponse.json(
      {
        ok: true,
        publicacion: nuevaPublicacion,
        estado: estadoAsignado,
        config_molde: parsed.data.config_molde ?? null,
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

/**
 * DELETE /api/comunidad/publicaciones?id=<uuid>
 * Permite eliminar una publicación únicamente a su autora o a moderación/admin.
 */
export async function DELETE(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Inicia sesión para eliminar una publicación." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Falta el identificador de la publicación." },
      { status: 400 }
    );
  }

  const st = getServerPubsStore();
  const encontrada =
    st.creadas.get(id) ?? PUBLICACIONES_DEMO.find((p) => p.id === id);

  if (!encontrada) {
    return NextResponse.json(
      { ok: false, error: "Publicación no encontrada." },
      { status: 404 }
    );
  }

  if (
    !puedeEditarContenido(
      { id: sesion.usuariaId, rol: sesion.rol },
      encontrada.autora_id
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "No tienes permiso para eliminar una publicación ajena." },
      { status: 403 }
    );
  }

  st.creadas.delete(id);
  st.eliminadas.add(id);

  return NextResponse.json({ ok: true, idEliminado: id });
}