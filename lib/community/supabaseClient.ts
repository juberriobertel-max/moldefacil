import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function estaSupabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
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

export interface CookieStoreAdapter {
  getAll: () => Array<{ name: string; value: string }>;
  setAll?: (
    cookies: Array<{
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }>
  ) => void;
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
