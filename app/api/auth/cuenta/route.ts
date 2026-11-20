import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { enviarCorreoTransaccional } from "@/lib/auth/mailer";
import { verificarContrasenaFiltradaHIBP } from "@/lib/auth/passwordSecurity";
import {
  enmascararIp,
  extraerIpCliente,
  validarOrigenCsrf,
} from "@/lib/auth/securityGuards";
import {
  crearCookieHeaderCerrada,
  crearCookieHeaderSesion,
  crearHashContrasenaPreview,
  generarSecretoTotpBase32,
  getPreviewAuthStore,
  obtenerSesionServidor,
  registrarEventoSeguridad,
  validarPoliticaPasswordCompleta,
  verificarCodigoTotp,
  verificarHashScrypt,
} from "@/lib/auth/serverAuth";

const DIAS_GRACIA_ELIMINACION = 14;

/**
 * GET /api/auth/cuenta
 * Exporta todos los datos de la usuaria autenticada (perfil, sesiones, eventos,
 * medidas privadas migradas y pedidos de taller privados).
 */
export async function GET(request: Request) {
  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para consultar o exportar tu cuenta." },
      { status: 401 }
    );
  }

  const st = getPreviewAuthStore();
  const cuenta = st.cuentas.get(sesion.usuariaId);
  const sesiones = Array.from(st.sesiones.values()).filter(
    (s) => s.usuariaId === sesion.usuariaId
  );
  const eventos = st.eventos.filter((e) => e.usuariaId === sesion.usuariaId);
  const medidasPrivadas = st.medidasPorUsuaria.get(sesion.usuariaId) ?? [];
  const pedidosPrivados = st.pedidosPorUsuaria.get(sesion.usuariaId) ?? [];

  return NextResponse.json({
    ok: true,
    exportadoEn: new Date().toISOString(),
    cuenta: {
      id: sesion.usuariaId,
      nombrePublico: sesion.nombrePublico,
      usuarioUnico: sesion.usuarioUnico,
      correo: sesion.correo,
      rol: sesion.rol,
      correoVerificado: sesion.correoVerificado,
      googleVinculado: cuenta?.googleVinculado ?? false,
      dosFaActivo: cuenta?.dosFaActivo ?? sesion.dosFaActivo,
      pendienteEliminacionHasta: cuenta?.pendienteEliminacionHasta ?? null,
      versionTerminos: cuenta?.versionTerminos ?? "2026-11-19",
      versionDatos: cuenta?.versionDatos ?? "2026-11-19",
    },
    sesionesActivas: sesiones,
    eventosSeguridad: eventos,
    medidasPrivadas,
    pedidosPrivados,
  });
}

/**
 * PATCH /api/auth/cuenta
 * Acciones de gestión autenticada:
 * - cambiar_contrasena (requiere actual + política + HIBP, cierra otras sesiones)
 * - solicitar_cambio_correo (notifica a ambos correos)
 * - vincular_google / desvincular_google
 * - generar_2fa / confirmar_2fa / desactivar_2fa (2FA obligatorio para moderadoras/admin)
 * - cancelar_eliminacion
 */
export async function PATCH(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Inicia sesión para modificar la configuración de tu cuenta." },
      { status: 401 }
    );
  }

  const ip = extraerIpCliente(request);
  const st = getPreviewAuthStore();
  const cuenta = st.cuentas.get(sesion.usuariaId);
  if (!cuenta) {
    return NextResponse.json(
      { ok: false, error: "Cuenta no encontrada en este entorno." },
      { status: 404 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const accion = String(body.accion ?? "");

    if (accion === "cambiar_contrasena") {
      const actual = String(body.contrasena_actual ?? "");
      const nueva = String(body.nueva_contrasena ?? "");

      if (!verificarHashScrypt(actual, cuenta.salHex, cuenta.hashScryptHex)) {
        return NextResponse.json(
          { ok: false, error: "La contraseña actual no coincide." },
          { status: 400 }
        );
      }

      const fuerza = validarPoliticaPasswordCompleta(nueva);
      if (!fuerza.ok) {
        return NextResponse.json({ ok: false, error: fuerza.error }, { status: 400 });
      }

      const hibp = await verificarContrasenaFiltradaHIBP(nueva);
      if (hibp.filtrada) {
        return NextResponse.json(
          {
            ok: false,
            error: "Esa nueva contraseña aparece en filtraciones públicas. Elige otra.",
          },
          { status: 400 }
        );
      }

      const cred = crearHashContrasenaPreview(nueva);
      cuenta.salHex = cred.salHex;
      cuenta.hashScryptHex = cred.hashScryptHex;

      // Cerrar todas las demás sesiones dejando viva la actual
      for (const [sid, s] of st.sesiones) {
        if (s.usuariaId === cuenta.id && sid !== sesion.sesionId) {
          st.sesiones.delete(sid);
        }
      }

      registrarEventoSeguridad(
        cuenta.id,
        "cambio_contrasena",
        "Contraseña actualizada desde ajustes y otras sesiones cerradas.",
        enmascararIp(ip)
      );

      await enviarCorreoTransaccional({
        para: cuenta.correo,
        tipo: "cambio_contrasena",
        nombrePublico: cuenta.nombrePublico,
        detalle: "Actualizaste tu contraseña desde tu cuenta y cerramos otros dispositivos.",
      });

      return NextResponse.json({
        ok: true,
        mensaje: "Contraseña actualizada y demás sesiones cerradas.",
      });
    }

    if (accion === "solicitar_cambio_correo") {
      const nuevoCorreo = String(body.nuevo_correo ?? "").trim().toLowerCase();
      const confirmarCorreo = String(body.confirmar_correo ?? "").trim().toLowerCase();
      const contrasenaActual = String(body.contrasena_actual ?? "");

      if (!nuevoCorreo || !nuevoCorreo.includes("@") || nuevoCorreo !== confirmarCorreo) {
        return NextResponse.json(
          { ok: false, error: "Verifica que ambos correos nuevos coincidan y sean válidos." },
          { status: 400 }
        );
      }
      if (!verificarHashScrypt(contrasenaActual, cuenta.salHex, cuenta.hashScryptHex)) {
        return NextResponse.json(
          { ok: false, error: "Confirma tu contraseña actual para cambiar el correo." },
          { status: 400 }
        );
      }

      const yaExiste = Array.from(st.cuentas.values()).some(
        (c) => c.correo === nuevoCorreo && c.id !== cuenta.id
      );
      if (yaExiste) {
        return NextResponse.json(
          {
            ok: true,
            mensaje:
              "Si el nuevo correo puede utilizarse, enviamos confirmación tanto a tu correo anterior como al nuevo.",
          },
          { status: 200 }
        );
      }

      const correoAnterior = cuenta.correo;
      cuenta.correo = nuevoCorreo;
      cuenta.correoVerificado = false;

      const token = crypto.randomBytes(24).toString("hex");
      st.tokensVerificacion.set(token, {
        token,
        usuariaId: cuenta.id,
        expiraMs: Date.now() + 24 * 60 * 60 * 1000,
        usado: false,
      });

      registrarEventoSeguridad(
        cuenta.id,
        "cambio_correo",
        `Solicitud de cambio de correo a ${nuevoCorreo.replace(/(^.).*(@.*$)/, "$1***$2")}.`,
        enmascararIp(ip)
      );

      const origin = new URL(request.url).origin;
      await enviarCorreoTransaccional({
        para: correoAnterior,
        tipo: "cambio_contrasena",
        nombrePublico: cuenta.nombrePublico,
        detalle: `Se solicitó cambiar tu correo de MoldeFácil a ${nuevoCorreo}. Si no fuiste tú, recupera tu cuenta de inmediato.`,
      });
      await enviarCorreoTransaccional({
        para: nuevoCorreo,
        tipo: "verificacion",
        nombrePublico: cuenta.nombrePublico,
        enlace: `${origin}/cuenta?verificar=${token}`,
      });

      const ahoraMs = Date.now();
      const cookie = crearCookieHeaderSesion({
        usuariaId: cuenta.id,
        sesionId: sesion.sesionId,
        correo: cuenta.correo,
        rol: cuenta.rol,
        correoVerificado: false,
        dosFaVerificado: sesion.dosFaVerificado,
        emitidoMs: ahoraMs,
        expiraMs: ahoraMs + 7 * 24 * 60 * 60 * 1000,
      });

      const res = NextResponse.json({
        ok: true,
        mensaje:
          "Enviamos un aviso al correo anterior y un enlace de confirmación (24 h) al nuevo correo.",
        previewTokenVerificacion:
          process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY
            ? token
            : undefined,
      });
      res.headers.append("Set-Cookie", cookie);
      return res;
    }

    if (accion === "vincular_google" || accion === "desvincular_google") {
      const activar = accion === "vincular_google";
      cuenta.googleVinculado = activar;
      registrarEventoSeguridad(
        cuenta.id,
        "vinculacion_google",
        activar
          ? "Acceso rápido con Google marcado como vinculado en este entorno."
          : "Desvinculaste el acceso con Google.",
        enmascararIp(ip)
      );
      return NextResponse.json({
        ok: true,
        googleVinculado: cuenta.googleVinculado,
        mensaje: activar
          ? "Google quedó vinculado (en producción usará OAuth oficial de Supabase)."
          : "Google desvinculado.",
      });
    }

    if (accion === "generar_2fa") {
      const secreto = cuenta.secretoTotpBase32 ?? generarSecretoTotpBase32();
      cuenta.secretoTotpBase32 = secreto;
      const label = encodeURIComponent(`MoldeFacil:${cuenta.correo}`);
      const otpauthUrl = `otpauth://totp/${label}?secret=${secreto}&issuer=MoldeFacil`;
      return NextResponse.json({
        ok: true,
        secretoBase32: secreto,
        otpauthUrl,
      });
    }

    if (accion === "confirmar_2fa") {
      const codigo = String(body.codigo_totp ?? "");
      if (!cuenta.secretoTotpBase32) {
        return NextResponse.json(
          { ok: false, error: "Primero genera tu clave secreta de 2FA." },
          { status: 400 }
        );
      }
      if (!verificarCodigoTotp(cuenta.secretoTotpBase32, codigo)) {
        return NextResponse.json(
          { ok: false, error: "Código de 6 dígitos incorrecto o vencido." },
          { status: 400 }
        );
      }
      cuenta.dosFaActivo = true;
      registrarEventoSeguridad(
        cuenta.id,
        "activacion_2fa",
        "Verificación en dos pasos (2FA con app autenticadora) activada.",
        enmascararIp(ip)
      );
      const ahoraMs = Date.now();
      const cookie = crearCookieHeaderSesion({
        usuariaId: cuenta.id,
        sesionId: sesion.sesionId,
        correo: cuenta.correo,
        rol: cuenta.rol,
        correoVerificado: cuenta.correoVerificado,
        dosFaVerificado: true,
        emitidoMs: ahoraMs,
        expiraMs: ahoraMs + 7 * 24 * 60 * 60 * 1000,
      });
      const res = NextResponse.json({
        ok: true,
        dosFaActivo: true,
        mensaje: "Verificación en dos pasos activada correctamente.",
      });
      res.headers.append("Set-Cookie", cookie);
      return res;
    }

    if (accion === "desactivar_2fa") {
      if (cuenta.rol === "moderadora" || cuenta.rol === "admin") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "La verificación en dos pasos (2FA) es obligatoria para moderadoras y administradoras.",
          },
          { status: 403 }
        );
      }
      cuenta.dosFaActivo = false;
      return NextResponse.json({
        ok: true,
        dosFaActivo: false,
        mensaje: "Verificación en dos pasos desactivada.",
      });
    }

    if (accion === "cancelar_eliminacion") {
      cuenta.pendienteEliminacionHasta = undefined;
      registrarEventoSeguridad(
        cuenta.id,
        "cancelacion_eliminacion",
        "Cancelaste la solicitud de eliminación de cuenta dentro del periodo de gracia.",
        enmascararIp(ip)
      );
      return NextResponse.json({
        ok: true,
        pendienteEliminacionHasta: null,
        mensaje: "Eliminación cancelada. Tu cuenta sigue activa.",
      });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida." },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error procesando la solicitud de cuenta." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/auth/cuenta
 * Programa el borrado definitivo con periodo de gracia de 14 días (requiere confirmación textual y contraseña).
 */
export async function DELETE(request: Request) {
  const csrf = validarOrigenCsrf(request);
  if (!csrf.valido) {
    return NextResponse.json({ ok: false, error: csrf.motivo }, { status: 403 });
  }

  const sesion = await obtenerSesionServidor(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para eliminar tu cuenta." },
      { status: 401 }
    );
  }

  const ip = extraerIpCliente(request);
  const st = getPreviewAuthStore();
  const cuenta = st.cuentas.get(sesion.usuariaId);
  if (!cuenta) {
    return NextResponse.json(
      { ok: false, error: "Cuenta no encontrada." },
      { status: 404 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const confirmacion = String(body.confirmacion ?? "").trim().toUpperCase();
    const contrasena = String(body.contrasena_actual ?? "");

    if (confirmacion !== "ELIMINAR MI CUENTA") {
      return NextResponse.json(
        {
          ok: false,
          error: 'Escribe exactamente "ELIMINAR MI CUENTA" para confirmar.',
        },
        { status: 400 }
      );
    }

    if (!verificarHashScrypt(contrasena, cuenta.salHex, cuenta.hashScryptHex)) {
      return NextResponse.json(
        { ok: false, error: "Contraseña incorrecta." },
        { status: 400 }
      );
    }

    const fechaBorrado = new Date(
      Date.now() + DIAS_GRACIA_ELIMINACION * 24 * 60 * 60 * 1000
    ).toISOString();
    cuenta.pendienteEliminacionHasta = fechaBorrado;

    // Cerrar sesiones por seguridad dejando aviso enviado
    for (const [sid, s] of st.sesiones) {
      if (s.usuariaId === cuenta.id) {
        st.sesiones.delete(sid);
      }
    }

    registrarEventoSeguridad(
      cuenta.id,
      "solicitud_eliminacion",
      `Eliminación programada con ${DIAS_GRACIA_ELIMINACION} días de gracia.`,
      enmascararIp(ip)
    );

    await enviarCorreoTransaccional({
      para: cuenta.correo,
      tipo: "eliminacion_cuenta",
      nombrePublico: cuenta.nombrePublico,
      detalle: `Fecha límite para cancelar: ${new Date(fechaBorrado).toLocaleDateString("es-CO")}.`,
    });

    const res = NextResponse.json({
      ok: true,
      pendienteEliminacionHasta: fechaBorrado,
      mensaje: `Tu cuenta se programó para eliminación definitiva dentro de ${DIAS_GRACIA_ELIMINACION} días. Puedes cancelarla iniciando sesión antes de esa fecha.`,
    });
    res.headers.append("Set-Cookie", crearCookieHeaderCerrada());
    return res;
  } catch {
    return NextResponse.json(
      { ok: false, error: "No pudimos procesar la solicitud de eliminación." },
      { status: 400 }
    );
  }
}