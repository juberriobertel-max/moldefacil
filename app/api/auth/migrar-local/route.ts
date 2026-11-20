import { NextResponse } from "next/server";
import {
  enmascararIp,
  extraerIpCliente,
  validarOrigenCsrf,
} from "@/lib/auth/securityGuards";
import {
  getPreviewAuthStore,
  MigrarLocalSchema,
  obtenerSesionServidor,
  registrarEventoSeguridad,
} from "@/lib/auth/serverAuth";

/**
 * GET /api/auth/migrar-local
 * Devuelve el conteo actual de medidas/pedidos privados sincronizados en la cuenta.
 */
export async function GET(request: Request) {
  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Inicia sesión para ver tus datos sincronizados." },
      { status: 401 }
    );
  }

  const st = getPreviewAuthStore();
  const medidas = st.medidasPorUsuaria.get(sesion.usuariaId) ?? [];
  const pedidos = st.pedidosPorUsuaria.get(sesion.usuariaId) ?? [];

  return NextResponse.json({
    ok: true,
    medidasGuardadas: medidas.length,
    pedidosGuardados: pedidos.length,
  });
}

/**
 * POST /api/auth/migrar-local
 * Migra de forma idempotente (por `origenLocalId`) medidas y pedidos del navegador hacia la cuenta autenticada.
 * Las medidas permanecen estrictamente privadas y ligadas al `usuariaId`.
 */
export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para migrar tus medidas locales." },
      { status: 401 }
    );
  }

  const ip = extraerIpCliente(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = MigrarLocalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ?? "Formato inválido en los datos a migrar.",
        },
        { status: 400 }
      );
    }

    const st = getPreviewAuthStore();
    const existentesMedidas = st.medidasPorUsuaria.get(sesion.usuariaId) ?? [];
    const existentesPedidos = st.pedidosPorUsuaria.get(sesion.usuariaId) ?? [];

    const idsMedidas = new Set(existentesMedidas.map((m) => m.origenLocalId));
    const idsPedidos = new Set(existentesPedidos.map((p) => p.origenLocalId));

    let medidasNuevas = 0;
    let pedidosNuevos = 0;

    for (const m of parsed.data.medidas) {
      if (!idsMedidas.has(m.id)) {
        idsMedidas.add(m.id);
        existentesMedidas.push({
          origenLocalId: m.id,
          clientName: m.clientName,
          phone: m.phone,
          notes: m.notes,
          measurements: m.measurements,
          updatedAt: m.updatedAt,
        });
        medidasNuevas++;
      }
    }

    for (const p of parsed.data.pedidos) {
      if (!idsPedidos.has(p.id)) {
        idsPedidos.add(p.id);
        existentesPedidos.push({
          origenLocalId: p.id,
          clientName: p.clientName,
          garmentDescription: p.garmentDescription,
          deliveryDate: p.deliveryDate,
          totalPrice: p.totalPrice,
          depositPaid: p.depositPaid,
          currency: p.currency,
          status: p.status,
        });
        pedidosNuevos++;
      }
    }

    st.medidasPorUsuaria.set(sesion.usuariaId, existentesMedidas);
    st.pedidosPorUsuaria.set(sesion.usuariaId, existentesPedidos);

    if (medidasNuevas > 0 || pedidosNuevos > 0) {
      registrarEventoSeguridad(
        sesion.usuariaId,
        "migracion_datos_locales",
        `Migrados ${medidasNuevas} perfiles privados y ${pedidosNuevos} pedidos de taller de forma privada.`,
        enmascararIp(ip)
      );
    }

    return NextResponse.json({
      ok: true,
      medidasNuevas,
      pedidosNuevos,
      totalMedidasCuenta: existentesMedidas.length,
      totalPedidosCuenta: existentesPedidos.length,
      mensaje:
        medidasNuevas + pedidosNuevos > 0
          ? `Guardamos ${medidasNuevas} perfiles de medidas privados y ${pedidosNuevos} pedidos en tu cuenta.`
          : "Tus datos locales ya estaban sincronizados (operación idempotente).",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error procesando la migración local." },
      { status: 400 }
    );
  }
}