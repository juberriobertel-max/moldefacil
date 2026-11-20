import { NextResponse } from "next/server";
import {
  crearClienteSupabaseParaRoute,
  estaSupabaseConfigurado,
} from "@/lib/community/supabaseClient";

function sanitizarDestinoInterno(nextRaw: string | null): string {
  if (!nextRaw) return "/cuenta";
  const trimmed = nextRaw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/cuenta";
  }
  return trimmed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = sanitizarDestinoInterno(url.searchParams.get("next"));
  const errorDesc =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(
        `/cuenta?auth_error=${encodeURIComponent(errorDesc.slice(0, 180))}`,
        url.origin
      )
    );
  }

  if (!estaSupabaseConfigurado() || !code) {
    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  const cliente = crearClienteSupabaseParaRoute(request);
  if (!cliente) {
    return NextResponse.redirect(new URL("/cuenta", url.origin));
  }

  const { data, error } = await cliente.supa.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/cuenta?auth_error=${encodeURIComponent("No se pudo completar el inicio con Google. Intenta de nuevo.")}`,
        url.origin
      )
    );
  }

  // Si viene de OAuth (ej. Google), sincroniza nombre público visible si el trigger usó el genérico
  const user = data.user;
  if (user) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nombreOAuth =
      typeof meta.nombre_publico === "string"
        ? meta.nombre_publico
        : typeof meta.full_name === "string"
          ? meta.full_name
          : typeof meta.name === "string"
            ? meta.name
            : null;
    if (nombreOAuth && nombreOAuth.trim().length >= 2) {
      await cliente.supa
        .from("perfiles")
        .update({
          nombre_publico: nombreOAuth.trim().slice(0, 80),
          correo_verificado: Boolean(user.email_confirmed_at),
        })
        .eq("id", user.id)
        .eq("nombre_publico", "Modista del taller");
    }
  }

  const redirectRes = NextResponse.redirect(new URL(nextPath, url.origin));
  return cliente.aplicarCookies(redirectRes);
}
