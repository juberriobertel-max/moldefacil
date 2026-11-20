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
  crearCookieHeaderSesion,
  crearHashContrasenaPreview,
  getPreviewAuthStore,
  registrarEventoSeguridad,
  RegistroSchema,
  validarPoliticaPasswordCompleta,
  VERSION_DATOS_ACTUAL,
  VERSION_TERMINOS_ACTUAL,
} from "@/lib/auth/serverAuth";
import {
  crearClienteSupabaseParaRoute,
  estaSupabaseConfigurado,
} from "@/lib/community/supabaseClient";

const MENSAJE_NO_ENUMERANTE =
  "Si el correo es válido, te enviamos un enlace de confirmación (vence en 24 horas). Revisa tu bandeja de entrada o correo no deseado.";

export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const ip = extraerIpCliente(request);
  const rl = verificarRateLimitIp(ip, "registro", 8, 10 * 60_000);
  if (!rl.permitido) {
    return NextResponse.json(
      {
        ok: false,
        error: `Demasiados intentos desde esta conexión. Espera ${rl.segundosRestantes} s.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = RegistroSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Revisa los campos del formulario.",
        },
        { status: 400 }
      );
    }

    const turnstile = await verificarTurnstileServidor(
      parsed.data.turnstile_token,
      ip
    );
    if (!turnstile.ok) {
      return NextResponse.json(
        { ok: false, error: turnstile.motivo },
        { status: 400 }
      );
    }

    const fuerza = validarPoliticaPasswordCompleta(parsed.data.contrasena);
    if (!fuerza.ok) {
      return NextResponse.json({ ok: false, error: fuerza.error }, { status: 400 });
    }

    const hibp = await verificarContrasenaFiltradaHIBP(parsed.data.contrasena);
    if (hibp.filtrada) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esa contraseña apareció en filtraciones públicas conocidas. Elige otra combinación única (por ejemplo 3 palabras cotidianas).",
        },
        { status: 400 }
      );
    }

    const ahoraIso = new Date().toISOString();

    if (estaSupabaseConfigurado()) {
      const cliente = crearClienteSupabaseParaRoute(request);
      if (cliente) {
        const origin = new URL(request.url).origin;
        await cliente.supa.auth.signUp({
          email: parsed.data.correo,
          password: parsed.data.contrasena,
          options: {
            emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/cuenta?verificado=1")}`,
            data: {
              nombre_publico: parsed.data.nombre_publico,
              acepto_terminos_en: ahoraIso,
              version_terminos: VERSION_TERMINOS_ACTUAL,
              acepto_datos_en: ahoraIso,
              version_datos: VERSION_DATOS_ACTUAL,
              mayor_edad_confirmada: true,
            },
          },
        });
        return cliente.aplicarCookies(
          NextResponse.json({
            ok: true,
            mensaje: MENSAJE_NO_ENUMERANTE,
            verificacionPendiente: true,
          })
        );
      }
    }

    // Modo vista previa sin credenciales Supabase: nunca revela si el correo ya existe
    const st = getPreviewAuthStore();
    const existente = Array.from(st.cuentas.values()).find(
      (c) => c.correo === parsed.data.correo
    );
    if (existente) {
      // Misma respuesta no enumerante
      return NextResponse.json({
        ok: true,
        mensaje: MENSAJE_NO_ENUMERANTE,
        verificacionPendiente: true,
      });
    }

    const userId = crypto.randomUUID();
    const baseUser = parsed.data.nombre_publico
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 18);
    const usuarioUnico = `${baseUser.length >= 3 ? baseUser : "modista"}_${userId.slice(0, 5)}`;

    const cred = crearHashContrasenaPreview(parsed.data.contrasena);
    st.cuentas.set(userId, {
      id: userId,
      nombrePublico: parsed.data.nombre_publico,
      usuarioUnico,
      correo: parsed.data.correo,
      salHex: cred.salHex,
      hashScryptHex: cred.hashScryptHex,
      rol: "usuaria",
      correoVerificado: false,
      googleVinculado: false,
      dosFaActivo: false,
      aceptoTerminosEn: ahoraIso,
      versionTerminos: VERSION_TERMINOS_ACTUAL,
      aceptoDatosEn: ahoraIso,
      versionDatos: VERSION_DATOS_ACTUAL,
      mayorEdadConfirmada: true,
      creadoEn: ahoraIso,
    });

    const tokenVerif = crypto.randomBytes(24).toString("base64url");
    st.tokensVerificacion.set(tokenVerif, {
      token: tokenVerif,
      usuariaId: userId,
      expiraMs: Date.now() + 24 * 60 * 60_000,
      usado: false,
    });

    const sesionId = crypto.randomUUID();
    const ipMask = enmascararIp(ip);
    const ua = request.headers.get("user-agent") || "Navegador";
    st.sesiones.set(sesionId, {
      sesionId,
      usuariaId: userId,
      dispositivo: ua.slice(0, 72),
      ipEnmascarada: ipMask,
      creadoEn: ahoraIso,
      ultimoUso: ahoraIso,
    });

    registrarEventoSeguridad(
      userId,
      "registro",
      `Registro inicial con consentimiento v${VERSION_DATOS_ACTUAL}`,
      ipMask,
      ua
    );

    const origin = new URL(request.url).origin;
    const correoRes = await enviarCorreoTransaccional({
      para: parsed.data.correo,
      tipo: "verificacion",
      nombrePublico: parsed.data.nombre_publico,
      enlace: `${origin}/cuenta?token_verificacion=${encodeURIComponent(tokenVerif)}`,
    });

    const resp = NextResponse.json({
      ok: true,
      mensaje: MENSAJE_NO_ENUMERANTE,
      verificacionPendiente: true,
      usuaria: {
        id: userId,
        nombrePublico: parsed.data.nombre_publico,
        usuarioUnico,
        correoVerificado: false,
      },
      previewCorreoModo: correoRes.modo,
      previewTokenVerificacion:
        process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY
          ? tokenVerif
          : undefined,
    });

    resp.headers.set(
      "Set-Cookie",
      crearCookieHeaderSesion({
        usuariaId: userId,
        sesionId,
        correo: parsed.data.correo,
        correoVerificado: false,
        rol: "usuaria",
        dosFaVerificado: false,
        emitidoMs: Date.now(),
        expiraMs: Date.now() + 7 * 24 * 60 * 60_000,
      })
    );
    return resp;
  } catch {
    return NextResponse.json(
      { ok: false, error: "No pudimos completar el registro. Inténtalo de nuevo." },
      { status: 400 }
    );
  }
}
