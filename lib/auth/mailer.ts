import {
  generarCorreoTransaccional,
  type TipoCorreoTransaccional,
} from "./emailTemplates";

export interface ResultadoEnvioCorreo {
  enviado: boolean;
  modo: "resend" | "simulado_preview";
  idExterno?: string;
  asunto: string;
}

/**
 * Envía correos transaccionales vía Resend cuando `RESEND_API_KEY` está configurada,
 * o devuelve una confirmación segura en modo vista previa local sin exponer secretos.
 */
export async function enviarCorreoTransaccional(params: {
  para: string;
  tipo: TipoCorreoTransaccional;
  nombrePublico?: string;
  enlace?: string;
  detalle?: string;
}): Promise<ResultadoEnvioCorreo> {
  const plantilla = generarCorreoTransaccional({
    tipo: params.tipo,
    nombrePublico: params.nombrePublico,
    enlace: params.enlace,
    detalle: params.detalle,
  });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "MoldeFácil <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      enviado: false,
      modo: "simulado_preview",
      asunto: plantilla.asunto,
    };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.para],
        subject: plantilla.asunto,
        html: plantilla.html,
        text: plantilla.texto,
      }),
    });
    if (!resp.ok) {
      return {
        enviado: false,
        modo: "resend",
        asunto: plantilla.asunto,
      };
    }
    const payload = (await resp.json()) as { id?: string };
    return {
      enviado: true,
      modo: "resend",
      idExterno: payload.id,
      asunto: plantilla.asunto,
    };
  } catch {
    return {
      enviado: false,
      modo: "resend",
      asunto: plantilla.asunto,
    };
  }
}