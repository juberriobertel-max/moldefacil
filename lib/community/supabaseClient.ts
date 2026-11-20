import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export function estaSupabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function parseCookiesRaw(
  cookieHeader: string | null
): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx < 0) return null;
      return {
        name: part.slice(0, idx).trim(),
        value: decodeURIComponent(part.slice(idx + 1).trim()),
      };
    })
    .filter((entry): entry is { name: string; value: string } => entry !== null);
}

/**
 * Cliente Supabase para componentes Client (`'use client'`).
 * Devuelve `null` si las variables de entorno aún no están configuradas.
 */
export function crearClienteSupabaseNavegador(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}

export interface SupabaseCookieMutation {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export interface CookieStoreAdapter {
  getAll: () => Array<{ name: string; value: string }>;
  setAll?: (cookies: SupabaseCookieMutation[]) => void;
}

/**
 * Cliente Supabase para Server Components y Route Handlers de Next.js.
 */
export function crearClienteSupabaseServidor(
  cookieStore: CookieStoreAdapter
): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (cookieStore.setAll) {
          cookieStore.setAll(
            cookiesToSet.map((c) => ({
              name: c.name,
              value: c.value,
              options: c.options as Record<string, unknown> | undefined,
            }))
          );
        }
      },
    },
  });
}

/**
 * Crea un cliente Supabase SSR ligado al `Request` actual y devuelve un helper
 * `aplicarCookies(response)` para persistir las cookies PKCE / sesión en la respuesta HTTP.
 */
export function crearClienteSupabaseParaRoute(request: Request): {
  supa: SupabaseClient;
  aplicarCookies: (response: NextResponse) => NextResponse;
} | null {
  const pendingCookies: SupabaseCookieMutation[] = [];
  const supa = crearClienteSupabaseServidor({
    getAll: () => parseCookiesRaw(request.headers.get("cookie")),
    setAll: (list) => {
      pendingCookies.push(...list);
    },
  });
  if (!supa) return null;

  return {
    supa,
    aplicarCookies(response: NextResponse): NextResponse {
      for (const c of pendingCookies) {
        response.cookies.set(c.name, c.value, c.options);
      }
      return response;
    },
  };
}
