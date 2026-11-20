import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { enviarCorreoTransaccional } from "@/lib/auth/mailer";
import {
  extraerIpCliente,
  validarOrigenCsrf,
  verificarRateLimitIp,
} from "@/lib/auth/securityGuards";
import {
  crearCookieHeaderSesion,
  getPreviewAuthStore,
  obtenerSesionServidor,
} from "@/lib/auth/serverAuth";

export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const ip = extraerIpCliente(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const accion = typeof body.accion === "string" ? body.accion : "confirmar";
    const st = getPreviewAuthStore();

    if (accion === "reenviar") {
      const sesion = await obtenerSesionServidor(request);
      if (!sesion) {
        return NextResponse.json(
          { ok: false, error: "Inicia sesión para reenviar tu enlace." },
          { status: 401 }
        );
      }
      const rl = verificarRateLimitIp(ip, `reenvio:${sesion.correo}`, 3, 15 * 60_000);
      if (!rl.permitido) {
        return NextResponse.json(
          {
            ok: false,
            error: `Espera ${rl.segundosRestantes} s antes de solicitar otro correo de verificación.`,
          },
          { status: 429 }
        );
      }
      const tokenVerif = crypto.randomBytes(24).toString("base64url");
      st.tokensVerificacion.set(tokenVerif, {
        token: tokenVerif,
        usuariaId: sesion.usuariaId,
        expiraMs: Date.now() + 24 * 60 * 60_000,
        usado: false,
      });
      const origin = new URL(request.url).origin;
      await enviarCorreoTransaccional({
        para: sesion.correo,
        tipo: "verificacion",
        nombrePublico: sesion.nombrePublico,
        enlace: `${origin}/cuenta?token_verificacion=${encodeURIComponent(tokenVerif)}`,
      });
      return NextResponse.json({
        ok: true,
        mensaje: "Enviamos un nuevo enlace de verificación válido por 24 horas.",
        previewTokenVerificacion:
          process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY
            ? tokenVerif
            : undefined,
      });
    }

    const token = String(body.token ?? "").trim();
    const reg = st.tokensVerificacion.get(token);
    if (!reg || reg.usado || reg.expiraMs <= Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          error: "El enlace de verificación no es válido o ya expiró (24 h).",
        },
        { status: 400 }
      );
    }

    const cuenta = st.cuentas.get(reg.usuariaId);
    if (!cuenta) {
      return NextResponse.json(
        { ok: false, error: "Cuenta no encontrada." },
        { status: 404 }
      );
    }

    reg.usado = true;
    cuenta.correoVerificado = true;
    await enviarCorreoTransaccional({
      para: cuenta.correo,
      tipo: "bienvenida",
      nombrePublico: cuenta.nombrePublico,
    });

    const sesionActual = await obtenerSesionServidor(request);
    const resp = NextResponse.json({
      ok: true,
      correoVerificado: true,
      mensaje: "¡Correo verificado! Ya puedes publicar y comentar en la comunidad.",
    });

    if (sesionActual && sesionActual.usuariaId === cuenta.id) {
      resp.headers.set(
        "Set-Cookie",
        crearCookieHeaderSesion({
          usuariaId: cuenta.id,
          sesionId: sesionActual.sesionId,
          correo: cuenta.correo,
          correoVerificado: true,
          rol: cuenta.rol,
          dosFaVerificado: sesionActual.dosFaVerificado,
          emitidoMs: Date.now(),
          expiraMs: Date.now() + 7 * 24 * 60 * 60_000,
        })
      );
    }

    return resp;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error verificando el correo." },
      { status: 400 }
    );
  }
}