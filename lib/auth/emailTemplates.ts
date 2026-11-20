export type TipoCorreoTransaccional =
  | "verificacion"
  | "bienvenida"
  | "recuperacion"
  | "cambio_contrasena"
  | "inicio_sospechoso"
  | "eliminacion_cuenta";

export interface PlantillaCorreoRenderizada {
  asunto: string;
  texto: string;
  html: string;
}

function envolverPlantillaHtml(params: {
  titulo: string;
  saludo: string;
  cuerpoHtml: string;
  notaPie: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background-color:#FAF6F0;font-family:Arial,Helvetica,sans-serif;color:#2D2A26;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2D6C8;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background-color:#B34720;padding:18px 24px;color:#FFFFFF;font-weight:bold;font-size:18px;">
        MoldeFácil · Taller y Comunidad de Modistas
      </td>
    </tr>
    <tr>
      <td style="padding:24px;line-height:1.6;font-size:15px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;color:#2D2A26;">${params.titulo}</h1>
        <p style="margin:0 0 12px 0;">${params.saludo}</p>
        ${params.cuerpoHtml}
      </td>
    </tr>
    <tr>
      <td style="background:#FAF6F0;border-top:1px solid #E2D6C8;padding:16px 24px;font-size:12px;color:#5C554E;">
        ${params.notaPie}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generarCorreoTransaccional(params: {
  tipo: TipoCorreoTransaccional;
  nombrePublico?: string;
  enlace?: string;
  detalle?: string;
}): PlantillaCorreoRenderizada {
  const nombre = params.nombrePublico?.trim() || "modista";

  switch (params.tipo) {
    case "verificacion": {
      const url = params.enlace || "#";
      return {
        asunto: "Confirma tu correo para activar tu cuenta en MoldeFácil",
        texto: `Hola ${nombre}, confirma tu correo en MoldeFácil usando este enlace (vence en 24 horas): ${url}`,
        html: envolverPlantillaHtml({
          titulo: "Confirma tu dirección de correo",
          saludo: `Hola ${nombre}, qué gusto recibirte en el taller.`,
          cuerpoHtml: `
            <p>Para empezar a publicar prendas, hacer preguntas o guardar tus medidas privadas en la nube, confirma tu correo electrónico. Este enlace es válido durante <strong>24 horas</strong>.</p>
            <p style="margin:20px 0;">
              <a href="${url}" style="display:inline-block;background:#3B7A57;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px;">Verificar mi correo</a>
            </p>
            <p style="font-size:13px;color:#5C554E;">Si no creaste esta cuenta, puedes ignorar este mensaje sin problema.</p>
          `,
          notaPie:
            "El generador de moldes y descarga de PDF siempre funcionan gratis incluso sin cuenta.",
        }),
      };
    }

    case "bienvenida":
      return {
        asunto: "¡Bienvenida a la Comunidad de Modistas de MoldeFácil!",
        texto: `Hola ${nombre}, tu correo quedó verificado. Tus medidas siguen siendo privadas por defecto.`,
        html: envolverPlantillaHtml({
          titulo: "¡Bienvenida al taller!",
          saludo: `Hola ${nombre}, tu cuenta ya está verificada.`,
          cuerpoHtml: `
            <p>Ya puedes mostrar lo que coses, resolver dudas en <em>Pregúntale a la modista</em> y guardar tus fichas en la nube.</p>
            <p><strong>Compromiso de privacidad:</strong> tus medidas corporales son privadas por defecto y eliminamos los metadatos EXIF/GPS de tus fotos automáticamente.</p>
          `,
          notaPie: "Equipo MoldeFácil · Espacio seguro de costura y patronaje.",
        }),
      };

    case "recuperacion": {
      const url = params.enlace || "#";
      return {
        asunto: "Recuperación de contraseña (enlace válido por 1 hora)",
        texto: `Hola ${nombre}, usa este enlace de un solo uso para crear una nueva contraseña (vence en 1 hora): ${url}`,
        html: envolverPlantillaHtml({
          titulo: "Restablecer tu contraseña",
          saludo: `Hola ${nombre}, recibimos una solicitud para cambiar tu contraseña.`,
          cuerpoHtml: `
            <p>Este enlace sirve <strong>una sola vez</strong> y vence en <strong>1 hora</strong>. Al guardar la nueva contraseña cerraremos todas tus sesiones abiertas en otros dispositivos.</p>
            <p style="margin:20px 0;">
              <a href="${url}" style="display:inline-block;background:#B34720;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px;">Crear nueva contraseña</a>
            </p>
          `,
          notaPie: "Si no solicitaste este cambio, te recomendamos revisar tu seguridad.",
        }),
      };
    }

    case "cambio_contrasena":
      return {
        asunto: "Aviso de seguridad: tu contraseña de MoldeFácil fue actualizada",
        texto: `Hola ${nombre}, tu contraseña se actualizó y cerramos tus demás sesiones activas.`,
        html: envolverPlantillaHtml({
          titulo: "Contraseña actualizada",
          saludo: `Hola ${nombre}, confirmamos que tu contraseña cambió recientemente.`,
          cuerpoHtml: `
            <p>Por seguridad, cerramos la sesión en todos los demás dispositivos conectados.</p>
            <p>Si no fuiste tú, usa de inmediato la opción <em>Olvidé mi contraseña</em> o contáctanos.</p>
          `,
          notaPie: "Registro automático de seguridad · MoldeFácil.",
        }),
      };

    case "inicio_sospechoso":
      return {
        asunto: "Aviso: detectamos varios intentos o un acceso inusual en tu cuenta",
        texto: `Hola ${nombre}, detectamos actividad inusual (${params.detalle || "intentos fallidos"}). Si no fuiste tú, cambia tu contraseña.`,
        html: envolverPlantillaHtml({
          titulo: "Alerta de actividad inusual",
          saludo: `Hola ${nombre}, cuidamos el acceso a tus medidas y tu cuenta.`,
          cuerpoHtml: `
            <p>Detectamos actividad inusual en tu cuenta: <strong>${params.detalle || "múltiples intentos fallidos o nuevo dispositivo"}</strong>.</p>
            <p>Si fuiste tú, no necesitas hacer nada. De lo contrario, cambia tu contraseña y cierra todas tus sesiones desde Ajustes de Cuenta.</p>
          `,
          notaPie: "Protección preventiva de sesiones · MoldeFácil.",
        }),
      };

    case "eliminacion_cuenta":
      return {
        asunto: "Confirmación de solicitud de eliminación (14 días de gracia)",
        texto: `Hola ${nombre}, programamos la eliminación definitiva de tu cuenta en 14 días. Puedes cancelarla antes desde tu cuenta.`,
        html: envolverPlantillaHtml({
          titulo: "Solicitud de eliminación de cuenta recibida",
          saludo: `Hola ${nombre}, recibimos tu solicitud para eliminar tu cuenta.`,
          cuerpoHtml: `
            <p>Tus datos personales, medidas y publicaciones quedaron programados para borrado definitivo en <strong>14 días calendario</strong>.</p>
            <p>Si cambias de opinión antes de cumplirse el plazo, puedes iniciar sesión y pulsar <strong>Cancelar eliminación</strong> sin perder tus avances.</p>
          `,
          notaPie: "Derecho de supresión y portabilidad · MoldeFácil.",
        }),
      };
  }
}