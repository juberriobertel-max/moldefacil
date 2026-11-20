import crypto from "node:crypto";

export const NOMBRE_COOKIE_SESION = "moldefacil_sesion_v1";

export interface PayloadCookieSesion {
  usuariaId: string;
  sesionId: string;
  correo: string;
  correoVerificado: boolean;
  rol: "usuaria" | "moderadora" | "admin";
  dosFaVerificado: boolean;
  emitidoMs: number;
  expiraMs: number;
}

interface RegistroBloqueo {
  intentosFallidos: number;
  bloqueadoHastaMs: number;
  ultimaIp?: string;
}

const historialBloqueo = new Map<string, RegistroBloqueo>();
const historialIpIntentos = new Map<string, number[]>();

const SECRET_DESARROLLO_EFIMERO = crypto.randomBytes(32).toString("hex");

function obtenerSecretoCookie(): string {
  return process.env.AUTH_COOKIE_SECRET || SECRET_DESARROLLO_EFIMERO;
}

/**
 * Valida origen CSRF para endpoints mutables (`POST`, `PATCH`, `DELETE`).
 */
export function validarOrigenCsrf(request: Request): {
  valido: boolean;
  motivo?: string;
} {
  const metodo = request.method.toUpperCase();
  if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") {
    return { valido: true };
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) {
    // Peticiones server-to-server o tests locales sin header Origin
    return { valido: true };
  }
  if (!host) {
    return { valido: false, motivo: "Cabecera de host ausente." };
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return {
        valido: false,
        motivo: "Solicitud bloqueada por protección CSRF de origen cruzado.",
      };
    }
    return { valido: true };
  } catch {
    return { valido: false, motivo: "Origen de solicitud inválido." };
  }
}

/**
 * Verifica Cloudflare Turnstile en servidor cuando `TURNSTILE_SECRET_KEY` está configurada.
 */
export async function verificarTurnstileServidor(
  token: string | undefined,
  ip?: string
): Promise<{ ok: boolean; motivo?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Modo sin clave en desarrollo/preview: exige al menos token de prueba del widget cliente
    if (!token || token.trim().length < 4) {
      return {
        ok: false,
        motivo: "Completa la verificación anti-bots antes de continuar.",
      };
    }
    return { ok: true };
  }

  if (!token || token.trim().length < 10) {
    return {
      ok: false,
      motivo: "Completa la verificación de seguridad anti-bots.",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.set("secret", secret);
    formData.set("response", token);
    if (ip) formData.set("remoteip", ip);

    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );
    const data = (await resp.json()) as { success?: boolean };
    if (!data.success) {
      return {
        ok: false,
        motivo: "No pudimos validar el control anti-bots. Intenta nuevamente.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      motivo: "Error verificando el control anti-bots.",
    };
  }
}

export function enmascararIp(ip: string | null | undefined): string {
  if (!ip) return "desconocida";
  const trimmed = ip.split(",")[0]?.trim() ?? "";
  if (trimmed.includes(".")) {
    const parts = trimmed.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  return `${trimmed.slice(0, 8)}***`;
}

export function extraerIpCliente(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "127.0.0.1";
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Control de frecuencia por IP para registro/recuperación/verificación.
 */
export function verificarRateLimitIp(
  ip: string,
  accion: string,
  maxIntentos = 10,
  ventanaMs = 10 * 60_000,
  ahoraMs = Date.now()
): { permitido: boolean; segundosRestantes: number } {
  const clave = `${accion}:${ip}`;
  const lista = (historialIpIntentos.get(clave) ?? []).filter(
    (t) => ahoraMs - t <= ventanaMs
  );
  if (lista.length >= maxIntentos) {
    const oldest = Math.min(...lista);
    const faltan = Math.max(1000, ventanaMs - (ahoraMs - oldest));
    return { permitido: false, segundosRestantes: Math.ceil(faltan / 1000) };
  }
  lista.push(ahoraMs);
  historialIpIntentos.set(clave, lista);
  return { permitido: true, segundosRestantes: 0 };
}

/**
 * Evalúa si un correo o IP está bajo bloqueo temporal progresivo tras intentos fallidos.
 */
export function evaluarBloqueoLogin(
  correo: string,
  ip: string,
  ahoraMs = Date.now()
): { bloqueado: boolean; segundosRestantes: number } {
  const key = `${correo.trim().toLowerCase()}::${ip}`;
  const reg = historialBloqueo.get(key);
  if (!reg) return { bloqueado: false, segundosRestantes: 0 };
  if (reg.bloqueadoHastaMs > ahoraMs) {
    return {
      bloqueado: true,
      segundosRestantes: Math.ceil((reg.bloqueadoHastaMs - ahoraMs) / 1000),
    };
  }
  return { bloqueado: false, segundosRestantes: 0 };
}

export function registrarIntentoLoginFallido(
  correo: string,
  ip: string,
  ahoraMs = Date.now()
): { bloqueado: boolean; segundosRestantes: number; intentos: number } {
  const key = `${correo.trim().toLowerCase()}::${ip}`;
  const actual = historialBloqueo.get(key) ?? {
    intentosFallidos: 0,
    bloqueadoHastaMs: 0,
  };
  const intentos = actual.intentosFallidos + 1;

  let duracionBloqueoMs = 0;
  if (intentos >= 10) {
    duracionBloqueoMs = 30 * 60_000;
  } else if (intentos >= 7) {
    duracionBloqueoMs = 5 * 60_000;
  } else if (intentos >= 5) {
    duracionBloqueoMs = 60_000;
  }

  const bloqueadoHastaMs =
    duracionBloqueoMs > 0 ? ahoraMs + duracionBloqueoMs : 0;

  historialBloqueo.set(key, {
    intentosFallidos: intentos,
    bloqueadoHastaMs,
    ultimaIp: ip,
  });

  return {
    bloqueado: bloqueadoHastaMs > ahoraMs,
    segundosRestantes: Math.ceil(duracionBloqueoMs / 1000),
    intentos,
  };
}

export function limpiarIntentosLoginExitoso(correo: string, ip: string): void {
  const key = `${correo.trim().toLowerCase()}::${ip}`;
  historialBloqueo.delete(key);
}

/**
 * Firma y verifica payloads de sesión para cookies `httpOnly`.
 */
export function firmarCookieSesion(payload: PayloadCookieSesion): string {
  const jsonB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", obtenerSecretoCookie())
    .update(jsonB64)
    .digest("base64url");
  return `${jsonB64}.${sig}`;
}

export function verificarCookieSesion(
  valor: string | undefined,
  ahoraMs = Date.now()
): PayloadCookieSesion | null {
  if (!valor || !valor.includes(".")) return null;
  const [jsonB64, sigRecibida] = valor.split(".");
  if (!jsonB64 || !sigRecibida) return null;

  const sigEsperada = crypto
    .createHmac("sha256", obtenerSecretoCookie())
    .update(jsonB64)
    .digest("base64url");

  const a = Buffer.from(sigRecibida);
  const b = Buffer.from(sigEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(jsonB64, "base64url").toString("utf8")
    ) as PayloadCookieSesion;
    if (!parsed || !parsed.usuariaId || parsed.expiraMs <= ahoraMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function extraerCookieDeHeader(
  cookieHeader: string | null,
  nombre: string
): string | undefined {
  if (!cookieHeader) return undefined;
  const partes = cookieHeader.split(";");
  for (const p of partes) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k === nombre) {
      return decodeURIComponent(p.slice(idx + 1).trim());
    }
  }
  return undefined;
}