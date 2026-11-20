import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { enviarCorreoTransaccional } from "@/lib/auth/mailer";
import {
  enmascararIp,
  evaluarBloqueoLogin,
  extraerIpCliente,
  limpiarIntentosLoginExitoso,
  registrarIntentoLoginFallido,
  validarOrigenCsrf,
  verificarTurnstileServidor,
} from "@/lib/auth/securityGuards";
import {
  crearCookieHeaderCerrada,
  crearCookieHeaderSesion,
  getPreviewAuthStore,
  LoginSchema,
  obtenerSesionServidor,
  registrarEventoSeguridad,
  verificarCodigoTotp,
  verificarHashScrypt,
} from "@/lib/auth/serverAuth";
import {
  crearClienteSupabaseParaRoute,
  estaSupabaseConfigurado,
} from "@/lib/community/supabaseClient";

export async function GET(request: Request) {
  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json({ autenticada: false, sesion: null });
  }

  const st = getPreviewAuthStore();
  const cuenta = st.cuentas.get(sesion.usuariaId);
  const sesionesActivas = Array.from(st.sesiones.values()).filter(
    (s) => s.usuariaId === sesion.usuariaId
  );
  const eventosSeguridad = st.eventos
    .filter((e) => e.usuariaId === sesion.usuariaId)
    .slice(0, 20);

  return NextResponse.json({
    autenticada: true,
    sesion,
    cuenta: cuenta
      ? {
          googleVinculado: cuenta.googleVinculado,
          pendienteEliminacionHasta: cuenta.pendienteEliminacionHasta,
        }
      : { googleVinculado: false },
    sesionesActivas,
    eventosSeguridad,
  });
}

export async function POST(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const ip = extraerIpCliente(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const modo = typeof body.modo === "string" ? body.modo : "password";

    if (modo === "google_oauth") {
      if (estaSupabaseConfigurado()) {
        const cliente = crearClienteSupabaseParaRoute(request);
        if (cliente) {
          const origin = new URL(request.url).origin;
          const { data, error } = await cliente.supa.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${origin}/api/auth/callback?next=/cuenta` },
          });
          if (error || !data?.url) {
            return NextResponse.json(
              {
                ok: false,
                error:
                  "Supabase Auth aún no tiene habilitado el proveedor Google OAuth.",
              },
              { status: 502 }
            );
          }
          return cliente.aplicarCookies(
            NextResponse.json({ ok: true, redirectUrl: data.url })
          );
        }
      }
      return NextResponse.json(
        {
          ok: false,
          error:
            "Para activar 'Continuar con Google' conecta tu proyecto Supabase y habilita Google OAuth en Supabase Auth.",
        },
        { status: 501 }
      );
    }

    if (modo === "magic_link") {
      const correo = String(body.correo ?? "").trim().toLowerCase();
      if (!correo || !correo.includes("@")) {
        return NextResponse.json(
          { ok: false, error: "Escribe un correo válido." },
          { status: 400 }
        );
      }
      if (estaSupabaseConfigurado()) {
        const cliente = crearClienteSupabaseParaRoute(request);
        if (cliente) {
          const origin = new URL(request.url).origin;
          await cliente.supa.auth.signInWithOtp({
            email: correo,
            options: {
              emailRedirectTo: `${origin}/api/auth/callback?next=/cuenta`,
            },
          });
          return cliente.aplicarCookies(
            NextResponse.json({
              ok: true,
              mensaje:
                "Si el correo existe en MoldeFácil, enviamos un enlace mágico de ingreso rápido.",
            })
          );
        }
      }
      return NextResponse.json({
        ok: true,
        mensaje:
          "Si el correo existe en MoldeFácil, enviamos un enlace mágico de ingreso rápido.",
      });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 }
      );
    }

    const bloqueo = evaluarBloqueoLogin(parsed.data.correo, ip);
    if (bloqueo.bloqueado) {
      return NextResponse.json(
        {
          ok: false,
          error: `Por tu seguridad pausamos los intentos temporalmente. Vuelve a intentar en ${bloqueo.segundosRestantes} segundos.`,
        },
        { status: 429 }
      );
    }

    if (estaSupabaseConfigurado()) {
      const cliente = crearClienteSupabaseParaRoute(request);
      if (cliente) {
        const { data, error } = await cliente.supa.auth.signInWithPassword({
          email: parsed.data.correo,
          password: parsed.data.contrasena,
        });
        if (error || !data.user) {
          registrarIntentoLoginFallido(parsed.data.correo, ip);
          return NextResponse.json(
            { ok: false, error: "Correo o contraseña incorrectos." },
            { status: 401 }
          );
        }
        limpiarIntentosLoginExitoso(parsed.data.correo, ip);
        return cliente.aplicarCookies(
          NextResponse.json({ ok: true, fuente: "supabase" })
        );
      }
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

    const st = getPreviewAuthStore();
    const cuenta = Array.from(st.cuentas.values()).find(
      (c) => c.correo === parsed.data.correo
    );
    const ipMask = enmascararIp(ip);
    const ua = request.headers.get("user-agent") || "Navegador";

    if (
      !cuenta ||
      !verificarHashScrypt(parsed.data.contrasena, cuenta.salHex, cuenta.hashScryptHex)
    ) {
      const fallo = registrarIntentoLoginFallido(parsed.data.correo, ip);
      if (cuenta && fallo.intentos >= 5) {
        registrarEventoSeguridad(
          cuenta.id,
          "inicio_sospechoso",
          `${fallo.intentos} intentos fallidos consecutivos de ingreso`,
          ipMask,
          ua
        );
        await enviarCorreoTransaccional({
          para: cuenta.correo,
          tipo: "inicio_sospechoso",
          nombrePublico: cuenta.nombrePublico,
          detalle: `${fallo.intentos} intentos fallidos consecutivos`,
        });
      }
      return NextResponse.json(
        { ok: false, error: "Correo o contraseña incorrectos." },
        { status: 401 }
      );
    }

    // 2FA obligatorio para moderadora y admin
    const requiere2FA =
      cuenta.rol === "moderadora" || cuenta.rol === "admin" || cuenta.dosFaActivo;
    let dosFaOk = !requiere2FA;
    if (requiere2FA) {
      if (!parsed.data.codigo_totp) {
        return NextResponse.json(
          {
            ok: false,
            requiere2FA: true,
            error:
              "Tu cuenta tiene verificación en dos pasos activa. Ingresa tu código de 6 dígitos.",
          },
          { status: 403 }
        );
      }
      if (
        !cuenta.secretoTotpBase32 ||
        !verificarCodigoTotp(cuenta.secretoTotpBase32, parsed.data.codigo_totp)
      ) {
        registrarIntentoLoginFallido(parsed.data.correo, ip);
        return NextResponse.json(
          {
            ok: false,
            requiere2FA: true,
            error: "El código de autenticación (2FA) es incorrecto o venció.",
          },
          { status: 401 }
        );
      }
      dosFaOk = true;
    }

    limpiarIntentosLoginExitoso(parsed.data.correo, ip);
    const sesionId = crypto.randomUUID();
    const ahoraIso = new Date().toISOString();
    st.sesiones.set(sesionId, {
      sesionId,
      usuariaId: cuenta.id,
      dispositivo: ua.slice(0, 72),
      ipEnmascarada: ipMask,
      creadoEn: ahoraIso,
      ultimoUso: ahoraIso,
    });

    registrarEventoSeguridad(
      cuenta.id,
      "inicio_sesion",
      "Inicio de sesión exitoso",
      ipMask,
      ua
    );

    const resp = NextResponse.json({
      ok: true,
      sesion: {
        usuariaId: cuenta.id,
        sesionId,
        correo: cuenta.correo,
        nombrePublico: cuenta.nombrePublico,
        usuarioUnico: cuenta.usuarioUnico,
        correoVerificado: cuenta.correoVerificado,
        rol: cuenta.rol,
        dosFaActivo: cuenta.dosFaActivo,
        dosFaVerificado: dosFaOk,
      },
    });

    resp.headers.set(
      "Set-Cookie",
      crearCookieHeaderSesion({
        usuariaId: cuenta.id,
        sesionId,
        correo: cuenta.correo,
        correoVerificado: cuenta.correoVerificado,
        rol: cuenta.rol,
        dosFaVerificado: dosFaOk,
        emitidoMs: Date.now(),
        expiraMs: Date.now() + 7 * 24 * 60 * 60_000,
      })
    );
    return resp;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error procesando el inicio de sesión." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const sesion = await obtenerSesionServidor(request);
  const { searchParams } = new URL(request.url);
  const alcance = searchParams.get("alcance") === "todos" ? "todos" : "actual";

  const clienteSupa = estaSupabaseConfigurado()
    ? crearClienteSupabaseParaRoute(request)
    : null;
  if (clienteSupa) {
    await clienteSupa.supa.auth.signOut({
      scope: alcance === "todos" ? "global" : "local",
    });
  }

  if (sesion) {
    const st = getPreviewAuthStore();
    if (alcance === "todos") {
      for (const [sid, s] of st.sesiones.entries()) {
        if (s.usuariaId === sesion.usuariaId) st.sesiones.delete(sid);
      }
      registrarEventoSeguridad(
        sesion.usuariaId,
        "cierre_global",
        "Se cerraron todas las sesiones activas en otros dispositivos",
        enmascararIp(extraerIpCliente(request))
      );
    } else {
      st.sesiones.delete(sesion.sesionId);
    }
  }

  const resp = NextResponse.json({ ok: true, alcance });
  resp.headers.set("Set-Cookie", crearCookieHeaderCerrada());
  return clienteSupa ? clienteSupa.aplicarCookies(resp) : resp;
}
