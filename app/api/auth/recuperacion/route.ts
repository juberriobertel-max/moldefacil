import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { enviarCorreoTransaccional } from "@/lib/auth/mailer";
import { verificarContrasenaFiltradaHIBP } from "@/lib/auth/passwordSecurity";
import {
  enmascararIp,
  extraerIpCliente,
  validarOrigenCsrf,
  verificarRateLimitIp,
  verificarTurnstileServidor,
} from "@/lib/auth/securityGuards";
import {
  crearHashContrasenaPreview,
  getPreviewAuthStore,
  registrarEventoSeguridad,
  validarPoliticaPasswordCompleta,
} from "@/lib/auth/serverAuth";
import {
  crearClienteSupabaseServidor,
  estaSupabaseConfigurado,
} from "@/lib/community/supabaseClient";

const MENSAJE_SOLICITUD_NEUTRO =
  "Si el correo corresponde a una cuenta registrada, te enviamos un enlace de recuperación de un solo uso válido por 1 hora.";

/**
 * POST /api/auth/recuperacion
 * Genera un enlace de un solo uso (expira en 1 hora) sin revelar si el correo existe.
 */
export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const ip = extraerIpCliente(request);
  const rl = verificarRateLimitIp(ip, "recuperacion", 6, 15 * 60_000);
  if (!rl.permitido) {
    return NextResponse.json(
      {
        ok: false,
        error: `Demasiadas solicitudes de recuperación. Espera ${rl.segundosRestantes} s.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const correo = String(body.correo ?? "").trim().toLowerCase();
    const turnstileToken =
      typeof body.turnstile_token === "string" ? body.turnstile_token : undefined;

    if (!correo || !correo.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Escribe un correo electrónico válido." },
        { status: 400 }
      );
    }

    const turnstile = await verificarTurnstileServidor(turnstileToken, ip);
    if (!turnstile.ok) {
      return NextResponse.json(
        { ok: false, error: turnstile.motivo },
        { status: 400 }
      );
    }

    if (estaSupabaseConfigurado()) {
      const supa = crearClienteSupabaseServidor({ getAll: () => [] });
      if (supa) {
        const origin = new URL(request.url).origin;
        await supa.auth.resetPasswordForEmail(correo, {
          redirectTo: `${origin}/cuenta?modo=recuperar`,
        });
        return NextResponse.json({
          ok: true,
          mensaje: MENSAJE_SOLICITUD_NEUTRO,
        });
      }
    }

    const st = getPreviewAuthStore();
    const cuenta = Array.from(st.cuentas.values()).find((c) => c.correo === correo);
    let previewResetToken: string | undefined;

    if (cuenta) {
      // Invalidar tokens anteriores del mismo usuario antes de emitir uno nuevo
      for (const [, reg] of st.tokensRecuperacion) {
        if (reg.usuariaId === cuenta.id) reg.usado = true;
      }

      const token = crypto.randomBytes(24).toString("hex");
      st.tokensRecuperacion.set(token, {
        token,
        usuariaId: cuenta.id,
        expiraMs: Date.now() + 60 * 60 * 1000, // 1 hora exacta
        usado: false,
      });

      const origin = new URL(request.url).origin;
      await enviarCorreoTransaccional({
        para: correo,
        tipo: "recuperacion",
        nombrePublico: cuenta.nombrePublico,
        enlace: `${origin}/cuenta?modo=recuperar&token=${token}`,
      });

      if (process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY) {
        previewResetToken = token;
      }
    }

    return NextResponse.json({
      ok: true,
      mensaje: MENSAJE_SOLICITUD_NEUTRO,
      previewResetToken,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No pudimos procesar la solicitud de recuperación." },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/auth/recuperacion
 * Consume token de un solo uso (< 1 h), valida política + HIBP, actualiza contraseña,
 * cierra todas las demás sesiones activas y envía aviso por correo.
 */
export async function PATCH(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const ip = extraerIpCliente(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const nuevaContrasena = String(body.nueva_contrasena ?? "");

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "El enlace de recuperación es inválido." },
        { status: 400 }
      );
    }

    const fuerza = validarPoliticaPasswordCompleta(nuevaContrasena);
    if (!fuerza.ok) {
      return NextResponse.json({ ok: false, error: fuerza.error }, { status: 400 });
    }

    const hibp = await verificarContrasenaFiltradaHIBP(nuevaContrasena);
    if (hibp.filtrada) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esa contraseña apareció en filtraciones públicas conocidas. Elige otra diferente.",
        },
        { status: 400 }
      );
    }

    if (estaSupabaseConfigurado()) {
      const supa = crearClienteSupabaseServidor({ getAll: () => [] });
      if (supa) {
        const { error } = await supa.auth.updateUser({ password: nuevaContrasena });
        if (error) {
          return NextResponse.json(
            { ok: false, error: "El enlace expiró o ya fue utilizado." },
            { status: 400 }
          );
        }
        return NextResponse.json({
          ok: true,
          mensaje: "Contraseña actualizada correctamente.",
        });
      }
    }

    const st = getPreviewAuthStore();
    const registro = st.tokensRecuperacion.get(token);
    if (!registro || registro.usado || Date.now() > registro.expiraMs) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este enlace ya fue utilizado o venció (recuerda que dura 1 hora). Solicita uno nuevo.",
        },
        { status: 400 }
      );
    }

    const cuenta = st.cuentas.get(registro.usuariaId);
    if (!cuenta) {
      return NextResponse.json(
        { ok: false, error: "La cuenta asociada ya no está disponible." },
        { status: 404 }
      );
    }

    // Marcar como usado inmediatamente (un solo uso)
    registro.usado = true;

    const cred = crearHashContrasenaPreview(nuevaContrasena);
    cuenta.salHex = cred.salHex;
    cuenta.hashScryptHex = cred.hashScryptHex;

    // Cerrar TODAS las sesiones activas de esta cuenta al recuperar contraseña
    for (const [sid, s] of st.sesiones) {
      if (s.usuariaId === cuenta.id) {
        st.sesiones.delete(sid);
      }
    }

    registrarEventoSeguridad(
      cuenta.id,
      "recuperacion_contrasena",
      "Contraseña restablecida con enlace de un solo uso y sesiones cerradas.",
      enmascararIp(ip),
      request.headers.get("user-agent") ?? "Navegador"
    );

    await enviarCorreoTransaccional({
      para: cuenta.correo,
      tipo: "cambio_contrasena",
      nombrePublico: cuenta.nombrePublico,
      detalle: "Tu contraseña se restableció y cerramos todas tus sesiones activas por seguridad.",
    });

    return NextResponse.json({
      ok: true,
      mensaje:
        "Contraseña actualizada. Cerramos todas tus sesiones anteriores; inicia sesión con tu nueva clave.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No pudimos actualizar la contraseña." },
      { status: 400 }
    );
  }
}