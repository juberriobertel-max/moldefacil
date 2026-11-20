import crypto from "node:crypto";
import { z } from "zod";
import {
  crearClienteSupabaseServidor,
  estaSupabaseConfigurado,
  type CookieStoreAdapter,
} from "@/lib/community/supabaseClient";
import {
  evaluarFortalezaContrasena,
} from "./passwordSecurity";
import {
  firmarCookieSesion,
  NOMBRE_COOKIE_SESION,
  verificarCookieSesion,
  extraerCookieDeHeader,
  type PayloadCookieSesion,
} from "./securityGuards";

export const VERSION_TERMINOS_ACTUAL = "2026-11-19";
export const VERSION_DATOS_ACTUAL = "2026-11-19";

export const RegistroSchema = z.object({
  nombre_publico: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre público (mínimo 2 caracteres).")
    .max(80, "El nombre no debe superar los 80 caracteres."),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .email("Escribe un correo electrónico válido."),
  contrasena: z
    .string()
    .min(10, "Usa al menos 10 caracteres para tu contraseña.")
    .max(128),
  acepto_terminos: z.literal(true, {
    error: "Debes aceptar las normas y términos de la comunidad.",
  }),
  autorizo_datos: z.literal(true, {
    error: "Debes autorizar el tratamiento de tus datos.",
  }),
  mayor_edad_confirmada: z.literal(true, {
    error: "Confirma que cumples con la edad mínima legal de tu país.",
  }),
  turnstile_token: z.string().optional(),
});

export const LoginSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo inválido."),
  contrasena: z.string().min(1, "Ingresa tu contraseña."),
  codigo_totp: z.string().trim().optional(),
  turnstile_token: z.string().optional(),
});

export const MigrarLocalSchema = z.object({
  medidas: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        clientName: z.string().trim().min(1).max(80),
        phone: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(300).optional(),
        measurements: z.record(z.string(), z.number().finite()),
        updatedAt: z.string(),
      })
    )
    .max(200)
    .default([]),
  pedidos: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        clientName: z.string().trim().min(1).max(80),
        garmentDescription: z.string().trim().min(1).max(240),
        deliveryDate: z.string().optional(),
        totalPrice: z.number().nonnegative(),
        depositPaid: z.number().nonnegative(),
        currency: z.string().max(8).optional(),
        status: z.string().max(40),
      })
    )
    .max(300)
    .default([]),
  ultimoPatronTitulo: z.string().trim().max(120).optional(),
});

export type TipoEventoSeguridad =
  | "registro"
  | "inicio_sesion"
  | "inicio_sospechoso"
  | "cierre_global"
  | "cambio_contrasena"
  | "recuperacion_contrasena"
  | "cambio_correo"
  | "vinculacion_google"
  | "activacion_2fa"
  | "solicitud_eliminacion"
  | "cancelacion_eliminacion"
  | "migracion_datos_locales";

export interface EventoSeguridadRegistro {
  id: string;
  usuariaId: string;
  tipo: TipoEventoSeguridad;
  descripcion: string;
  ipEnmascarada: string;
  dispositivo: string;
  creadoEn: string;
}

export interface SesionActivaRegistro {
  sesionId: string;
  usuariaId: string;
  dispositivo: string;
  ipEnmascarada: string;
  creadoEn: string;
  ultimoUso: string;
}

export interface CuentaPreviewRegistro {
  id: string;
  nombrePublico: string;
  usuarioUnico: string;
  correo: string;
  salHex: string;
  hashScryptHex: string;
  rol: "usuaria" | "moderadora" | "admin";
  correoVerificado: boolean;
  googleVinculado: boolean;
  dosFaActivo: boolean;
  secretoTotpBase32?: string;
  aceptoTerminosEn: string;
  versionTerminos: string;
  aceptoDatosEn: string;
  versionDatos: string;
  mayorEdadConfirmada: boolean;
  pendienteEliminacionHasta?: string;
  creadoEn: string;
}

interface TokenVerificacionRegistro {
  token: string;
  usuariaId: string;
  expiraMs: number;
  usado: boolean;
}

interface TokenRecuperacionRegistro {
  token: string;
  usuariaId: string;
  expiraMs: number;
  usado: boolean;
}

interface PreviewAuthState {
  cuentas: Map<string, CuentaPreviewRegistro>;
  sesiones: Map<string, SesionActivaRegistro>;
  tokensVerificacion: Map<string, TokenVerificacionRegistro>;
  tokensRecuperacion: Map<string, TokenRecuperacionRegistro>;
  reenviosPorCorreo: Map<string, number[]>;
  eventos: EventoSeguridadRegistro[];
  medidasPorUsuaria: Map<
    string,
    Array<{
      origenLocalId: string;
      clientName: string;
      phone?: string;
      notes?: string;
      measurements: Record<string, number>;
      updatedAt: string;
    }>
  >;
  pedidosPorUsuaria: Map<
    string,
    Array<{
      origenLocalId: string;
      clientName: string;
      garmentDescription: string;
      deliveryDate?: string;
      totalPrice: number;
      depositPaid: number;
      currency?: string;
      status: string;
    }>
  >;
}

const GLOBAL_KEY = "__moldefacil_preview_auth_v1__";

function hashScrypt(contrasena: string, salHex: string): string {
  return crypto
    .scryptSync(contrasena, salHex, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
}

export function verificarHashScrypt(
  contrasena: string,
  salHex: string,
  esperadoHex: string
): boolean {
  const actual = Buffer.from(hashScrypt(contrasena, salHex), "hex");
  const esperado = Buffer.from(esperadoHex, "hex");
  if (actual.length !== esperado.length) return false;
  return crypto.timingSafeEqual(actual, esperado);
}

export function crearHashContrasenaPreview(contrasena: string): {
  salHex: string;
  hashScryptHex: string;
} {
  const salHex = crypto.randomBytes(16).toString("hex");
  return {
    salHex,
    hashScryptHex: hashScrypt(contrasena, salHex),
  };
}

export function generarSecretoTotpBase32(): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(20);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alfabeto[bytes[i] % alfabeto.length];
  }
  return out;
}

function base32ABuffer(base32: string): Buffer {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const limpio = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of limpio) {
    const idx = alfabeto.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generarCodigoTotp(
  secretoBase32: string,
  ahoraMs = Date.now(),
  pasoOffset = 0
): string {
  const key = base32ABuffer(secretoBase32);
  const counter = Math.floor(ahoraMs / 30_000) + pasoOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verificarCodigoTotp(
  secretoBase32: string,
  codigo: string,
  ahoraMs = Date.now()
): boolean {
  const limpio = codigo.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(limpio)) return false;
  for (const offset of [-1, 0, 1]) {
    if (generarCodigoTotp(secretoBase32, ahoraMs, offset) === limpio) {
      return true;
    }
  }
  return false;
}

function inicializarStorePreview(): PreviewAuthState {
  const state: PreviewAuthState = {
    cuentas: new Map(),
    sesiones: new Map(),
    tokensVerificacion: new Map(),
    tokensRecuperacion: new Map(),
    reenviosPorCorreo: new Map(),
    eventos: [],
    medidasPorUsuaria: new Map(),
    pedidosPorUsuaria: new Map(),
  };

  // Cuenta demo moderadora pre-sembrada en memoria para flujos de verificación 2FA
  const modSecret = "MFRGGZDFMZTWQ2LK";
  const credMod = crearHashContrasenaPreview("TallerSeguro2026!");
  state.cuentas.set("00000000-0000-4000-8000-000000000101", {
    id: "00000000-0000-4000-8000-000000000101",
    nombrePublico: "Marta Elena Ríos (Moderadora)",
    usuarioUnico: "marta_costura",
    correo: "marta@moldefacil.demo",
    salHex: credMod.salHex,
    hashScryptHex: credMod.hashScryptHex,
    rol: "moderadora",
    correoVerificado: true,
    googleVinculado: false,
    dosFaActivo: true,
    secretoTotpBase32: modSecret,
    aceptoTerminosEn: "2026-11-01T10:00:00.000Z",
    versionTerminos: VERSION_TERMINOS_ACTUAL,
    aceptoDatosEn: "2026-11-01T10:00:00.000Z",
    versionDatos: VERSION_DATOS_ACTUAL,
    mayorEdadConfirmada: true,
    creadoEn: "2026-11-01T10:00:00.000Z",
  });

  return state;
}

export function getPreviewAuthStore(): PreviewAuthState {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = inicializarStorePreview();
  }
  return g[GLOBAL_KEY] as PreviewAuthState;
}

export function registrarEventoSeguridad(
  usuariaId: string,
  tipo: TipoEventoSeguridad,
  descripcion: string,
  ipEnmascarada = "127.0.*.*",
  dispositivo = "Navegador web"
): void {
  const st = getPreviewAuthStore();
  st.eventos.unshift({
    id: crypto.randomUUID(),
    usuariaId,
    tipo,
    descripcion,
    ipEnmascarada,
    dispositivo: dispositivo.slice(0, 80),
    creadoEn: new Date().toISOString(),
  });
  if (st.eventos.length > 500) st.eventos.length = 500;
}

export function crearCookieHeaderSesion(
  payload: PayloadCookieSesion,
  maxAgeSeg = 7 * 24 * 60 * 60
): string {
  const token = firmarCookieSesion(payload);
  const secureFlag =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NOMBRE_COOKIE_SESION}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeg}${secureFlag}`;
}

export function crearCookieHeaderCerrada(): string {
  const secureFlag =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NOMBRE_COOKIE_SESION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

export interface SesionAutenticada {
  usuariaId: string;
  sesionId: string;
  correo: string;
  nombrePublico: string;
  usuarioUnico: string;
  correoVerificado: boolean;
  rol: "usuaria" | "moderadora" | "admin";
  dosFaActivo: boolean;
  dosFaVerificado: boolean;
  fuente: "supabase" | "preview";
}

function parseCookiesRaw(cookieHeader: string | null): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((p) => {
      const idx = p.indexOf("=");
      if (idx < 0) return null;
      return {
        name: p.slice(0, idx).trim(),
        value: decodeURIComponent(p.slice(idx + 1).trim()),
      };
    })
    .filter((x): x is { name: string; value: string } => x !== null);
}

/**
 * Obtiene la sesión autenticada real en el servidor desde Supabase Auth o desde la cookie httpOnly firmada.
 */
export async function obtenerSesionServidor(
  request: Request
): Promise<SesionAutenticada | null> {
  const rawCookieHeader = request.headers.get("cookie");

  if (estaSupabaseConfigurado()) {
    const adapter: CookieStoreAdapter = {
      getAll: () => parseCookiesRaw(rawCookieHeader),
    };
    const supa = crearClienteSupabaseServidor(adapter);
    if (supa) {
      const { data, error } = await supa.auth.getUser();
      if (!error && data.user) {
        const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        return {
          usuariaId: data.user.id,
          sesionId: `supa_${data.user.id.slice(0, 8)}`,
          correo: data.user.email ?? "",
          nombrePublico:
            typeof meta.nombre_publico === "string"
              ? meta.nombre_publico
              : "Modista",
          usuarioUnico:
            typeof meta.usuario_unico === "string"
              ? meta.usuario_unico
              : `modista_${data.user.id.slice(0, 6)}`,
          correoVerificado: Boolean(data.user.email_confirmed_at),
          rol:
            meta.rol === "moderadora" || meta.rol === "admin"
              ? meta.rol
              : "usuaria",
          dosFaActivo: Boolean(data.user.factors && data.user.factors.length > 0),
          dosFaVerificado: true,
          fuente: "supabase",
        };
      }
      return null;
    }
  }

  const rawToken = extraerCookieDeHeader(rawCookieHeader, NOMBRE_COOKIE_SESION);
  const payload = verificarCookieSesion(rawToken);
  if (!payload) return null;

  const st = getPreviewAuthStore();
  if (!st.sesiones.has(payload.sesionId)) {
    return null;
  }
  const cuenta = st.cuentas.get(payload.usuariaId);
  if (!cuenta) return null;

  return {
    usuariaId: cuenta.id,
    sesionId: payload.sesionId,
    correo: cuenta.correo,
    nombrePublico: cuenta.nombrePublico,
    usuarioUnico: cuenta.usuarioUnico,
    correoVerificado: cuenta.correoVerificado,
    rol: cuenta.rol,
    dosFaActivo: cuenta.dosFaActivo,
    dosFaVerificado: payload.dosFaVerificado,
    fuente: "preview",
  };
}

export function validarPoliticaPasswordCompleta(pass: string): {
  ok: boolean;
  error?: string;
} {
  const f = evaluarFortalezaContrasena(pass);
  if (!f.valida) return { ok: false, error: f.mensaje };
  return { ok: true };
}