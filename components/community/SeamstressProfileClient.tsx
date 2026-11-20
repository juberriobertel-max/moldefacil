"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Ban,
  Briefcase,
  Check,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Scissors,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  alternarBloqueoUsuaria,
  alternarSeguirModista,
  cambiarUsuariaActiva,
  getComunidadServerSnapshot,
  INSIGNIAS_CATALOGO,
  loadComunidadEstado,
  obtenerActorActivo,
  registrarRemixMolde,
  saveComunidadEstado,
  subscribeComunidad,
} from "@/lib/community/communityStore";
import { codificarConfigMoldeParaUrl } from "@/lib/community/patternBridge";
import {
  puedeLeerPerfil,
  puedeLeerPublicacion,
  sanitizarPerfilPublico,
} from "@/lib/community/rlsPolicyEngine";
import type { NivelModista } from "@/lib/community/types";

const ETIQUETAS_NIVEL: Record<NivelModista, string> = {
  aprendiz: "Aprendiz",
  intermedia: "Intermedia",
  profesional: "Profesional",
};

function normalizarEnlaceSeguro(
  valor: string | undefined,
  tipo: "whatsapp" | "instagram"
): string | null {
  if (!valor) return null;
  const limpio = valor.trim();
  if (!limpio) return null;
  if (/^https:\/\//i.test(limpio)) {
    return limpio;
  }
  if (tipo === "whatsapp") {
    const digitos = limpio.replace(/[^0-9]/g, "");
    if (digitos.length >= 7) return `https://wa.me/${digitos}`;
    return null;
  }
  const handle = limpio.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

export default function SeamstressProfileClient({
  usuarioSlug,
}: {
  usuarioSlug: string;
}) {
  const router = useRouter();
  const estado = useSyncExternalStore(
    subscribeComunidad,
    loadComunidadEstado,
    getComunidadServerSnapshot
  );
  const [aviso, setAviso] = useState<string | null>(null);

  const actor = useMemo(() => obtenerActorActivo(estado), [estado]);

  const perfil = useMemo(
    () =>
      estado.perfiles.find(
        (p) => p.usuario_unico.toLowerCase() === usuarioSlug.toLowerCase()
      ) ?? null,
    [estado.perfiles, usuarioSlug]
  );

  const puedeVer = useMemo(() => {
    if (!perfil) return false;
    return puedeLeerPerfil(actor, perfil, { bloqueos: estado.bloqueos });
  }, [actor, perfil, estado.bloqueos]);

  const perfilSeguro = useMemo(() => {
    if (!perfil) return null;
    return sanitizarPerfilPublico(perfil, actor);
  }, [perfil, actor]);

  const publicacionesVisibles = useMemo(() => {
    if (!perfil) return [];
    return estado.publicaciones.filter(
      (pub) =>
        pub.autora_id === perfil.id &&
        puedeLeerPublicacion(actor, pub, { bloqueos: estado.bloqueos })
    );
  }, [actor, estado.bloqueos, estado.publicaciones, perfil]);

  const insignias = useMemo(() => {
    if (!perfil) return [];
    const ids = estado.insigniasPorUsuaria[perfil.id] ?? [];
    return INSIGNIAS_CATALOGO.filter((i) => ids.includes(i.id));
  }, [estado.insigniasPorUsuaria, perfil]);

  const conteoSeguidoras = useMemo(() => {
    if (!perfil) return 0;
    return estado.seguidores.filter((s) => s.seguida_id === perfil.id).length;
  }, [estado.seguidores, perfil]);

  const siguiendo = useMemo(() => {
    if (!actor || !perfil) return false;
    return estado.seguidores.some(
      (s) => s.seguidora_id === actor.id && s.seguida_id === perfil.id
    );
  }, [actor, estado.seguidores, perfil]);

  const bloqueada = useMemo(() => {
    if (!actor || !perfil) return false;
    return estado.bloqueos.some(
      (b) => b.bloqueadora_id === actor.id && b.bloqueada_id === perfil.id
    );
  }, [actor, estado.bloqueos, perfil]);

  if (!perfil || !perfilSeguro) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Link
          href="/comunidad"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] hover:border-[#C85A32]"
        >
          <ArrowLeft className="w-4 h-4 text-[#B34720]" />
          Volver a la Comunidad
        </Link>
        <div className="rounded-3xl bg-white border border-[#E2D6C8] p-8 text-center space-y-2">
          <h1 className="text-xl font-extrabold text-[#2D2A26]">
            No encontramos este perfil de modista
          </h1>
          <p className="text-sm text-[#5C554E]">
            Puede que el usuario haya cambiado o la cuenta haya sido eliminada.
          </p>
        </div>
      </div>
    );
  }

  if (!puedeVer) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Link
          href="/comunidad"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] hover:border-[#C85A32]"
        >
          <ArrowLeft className="w-4 h-4 text-[#B34720]" />
          Volver a la Comunidad
        </Link>
        <div className="rounded-3xl bg-white border border-[#E2D6C8] p-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF6F2] text-[#8A3112] text-xs font-extrabold">
            <ShieldAlert className="w-4 h-4" />
            Privacidad del perfil
          </div>
          <h1 className="text-xl font-extrabold text-[#2D2A26]">
            Este perfil está reservado para usuarias registradas o no está disponible
          </h1>
          <p className="text-sm text-[#5C554E]">
            La modista configuró su visibilidad solo para integrantes con sesión activa, o existe un bloqueo vigente.
          </p>
          <div className="flex flex-wrap gap-3">
            {!actor && (
              <button
                type="button"
                onClick={() => {
                  const primera = estado.perfiles[1] ?? estado.perfiles[0];
                  if (primera) {
                    saveComunidadEstado(cambiarUsuariaActiva(estado, primera.id));
                  }
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold cursor-pointer"
              >
                Entrar con sesión de taller
              </button>
            )}
            {bloqueada && (
              <button
                type="button"
                onClick={() => {
                  const res = alternarBloqueoUsuaria(estado, perfil.id);
                  saveComunidadEstado(res.estado);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] cursor-pointer"
              >
                Quitar bloqueo a @{perfil.usuario_unico}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const whatsappUrl = normalizarEnlaceSeguro(
    perfilSeguro.enlace_whatsapp,
    "whatsapp"
  );
  const instagramUrl = normalizarEnlaceSeguro(
    perfilSeguro.enlace_instagram,
    "instagram"
  );
  const esMiPerfil = actor?.id === perfil.id;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/comunidad"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] hover:border-[#C85A32] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]"
        >
          <ArrowLeft className="w-4 h-4 text-[#B34720]" />
          Volver a la Comunidad
        </Link>
        {perfil.es_demo && (
          <span className="px-3 py-1.5 rounded-full bg-[#EFE6DA] text-[#5C554E] text-xs font-extrabold">
            Perfil de demostración
          </span>
        )}
      </div>

      {aviso && (
        <div
          role="status"
          className="rounded-2xl bg-[#3B7A57]/12 border border-[#3B7A57]/35 px-4 py-3 text-sm font-bold text-[#28593D]"
        >
          {aviso}
        </div>
      )}

      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#B34720] text-white flex items-center justify-center text-2xl font-extrabold shrink-0 shadow-xs">
              {perfilSeguro.nombre_publico.slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2A26]">
                  {perfilSeguro.nombre_publico}
                </h1>
                <span className="px-2.5 py-1 rounded-full bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#5C554E]">
                  {ETIQUETAS_NIVEL[perfilSeguro.nivel]}
                </span>
                {perfilSeguro.vende_por_encargo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#3B7A57]/15 text-[#28593D] text-xs font-extrabold">
                    <Briefcase className="w-3.5 h-3.5" />
                    Modista por encargo
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-[#B34720]">
                @{perfilSeguro.usuario_unico}
              </p>
              {perfilSeguro.ciudad_pais && (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C554E]">
                  <MapPin className="w-3.5 h-3.5 text-[#3B7A57]" />
                  {perfilSeguro.ciudad_pais}
                </p>
              )}
              {perfilSeguro.bio && (
                <p className="text-sm text-[#2D2A26] leading-relaxed max-w-2xl pt-1">
                  {perfilSeguro.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {esMiPerfil ? (
              <Link
                href="/comunidad?tab=perfil"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold inline-flex items-center gap-2"
              >
                Editar mi perfil y privacidad
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const res = alternarSeguirModista(estado, perfil.id);
                    if (!res.ok) {
                      setAviso(res.error ?? "Inicia sesión para seguir.");
                      return;
                    }
                    saveComunidadEstado(res.estado);
                    setAviso(
                      siguiendo
                        ? `Dejaste de seguir a @${perfil.usuario_unico}.`
                        : `Ahora sigues el taller de @${perfil.usuario_unico}.`
                    );
                  }}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition ${siguiendo
                    ? "bg-[#3B7A57] text-white"
                    : "bg-[#B34720] hover:bg-[#973B1A] text-white"
                    }`}
                >
                  {siguiendo ? (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Siguiendo
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Seguir
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = alternarBloqueoUsuaria(estado, perfil.id);
                    if (!res.ok) {
                      setAviso(res.error ?? "Inicia sesión para gestionar bloqueos.");
                      return;
                    }
                    saveComunidadEstado(res.estado);
                    setAviso("Lista de bloqueos actualizada.");
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#5C554E] hover:border-[#B34720] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Bloquear
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#EFE6DA]">
          <div className="rounded-2xl bg-[#FAF6F0] px-4 py-3">
            <p className="text-xs font-bold text-[#5C554E]">Seguidoras</p>
            <p className="text-lg font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#3B7A57]" />
              {conteoSeguidoras}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] px-4 py-3">
            <p className="text-xs font-bold text-[#5C554E]">Prendas publicadas</p>
            <p className="text-lg font-extrabold text-[#2D2A26]">
              {publicacionesVisibles.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] px-4 py-3">
            <p className="text-xs font-bold text-[#5C554E]">Insignias</p>
            <p className="text-lg font-extrabold text-[#2D2A26]">
              {insignias.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FAF6F0] px-4 py-3">
            <p className="text-xs font-bold text-[#5C554E]">Contacto directo</p>
            <p className="text-xs font-extrabold text-[#2D2A26] pt-1">
              {perfilSeguro.mostrar_contacto
                ? "Activado por la modista"
                : "Oculto por privacidad"}
            </p>
          </div>
        </div>

        {perfilSeguro.especialidades.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-[#5C554E]">
              Especialidades:
            </span>
            {perfilSeguro.especialidades.map((esp) => (
              <span
                key={esp}
                className="px-3 py-1 rounded-full bg-[#EFE6DA] text-xs font-bold text-[#2D2A26]"
              >
                {esp}
              </span>
            ))}
          </div>
        )}

        {perfilSeguro.mostrar_contacto && (whatsappUrl || instagramUrl) && (
          <div className="rounded-2xl bg-[#3B7A57]/8 border border-[#3B7A57]/25 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-[#28593D] font-semibold">
              Canales habilitados voluntariamente por la modista (no procesamos pagos dentro de la plataforma).
            </div>
            <div className="flex flex-wrap gap-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5"
                >
                  Instagram
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {insignias.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#B34720]" />
              Reconocimientos en la comunidad
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {insignias.map((ins) => (
                <div
                  key={ins.id}
                  className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-3 flex items-start gap-2.5"
                >
                  <Check className="w-4 h-4 text-[#3B7A57] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-extrabold text-[#2D2A26]">
                      {ins.nombre}
                    </p>
                    <p className="text-[11px] text-[#5C554E] leading-snug">
                      {ins.descripcion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold text-[#2D2A26] flex items-center gap-2">
          <Scissors className="w-5 h-5 text-[#B34720]" />
          Lo que cosió @{perfilSeguro.usuario_unico}
        </h2>

        {publicacionesVisibles.length === 0 ? (
          <div className="rounded-3xl bg-white border border-[#E2D6C8] p-8 text-center text-sm text-[#5C554E]">
            Aún no hay prendas públicas en este perfil.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {publicacionesVisibles.map((pub) => {
              const foto = pub.fotos[0];
              return (
                <article
                  key={pub.id}
                  className="rounded-3xl bg-white border border-[#E2D6C8] overflow-hidden shadow-xs flex flex-col"
                >
                  {foto && (
                    <div className="relative aspect-[4/3] bg-[#FAF6F0] overflow-hidden">
                      <img
                        src={foto.url}
                        alt={foto.alt}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {pub.es_demo && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 text-[#5C554E] text-[11px] font-extrabold shadow-xs">
                          Ejemplo ilustrativo
                        </span>
                      )}
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#5C554E]">
                        <span>
                          {pub.prenda} · {pub.tela}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#3B7A57]" />
                          {pub.tiempo_horas}h
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#2D2A26]">
                        {pub.titulo}
                      </h3>
                      <p className="text-xs text-[#5C554E] line-clamp-2">
                        {pub.aprendizaje_nota}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#EFE6DA]">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#5C554E]">
                        <Heart className="w-3.5 h-3.5 text-[#B34720]" />
                        {pub.conteo_reacciones}
                      </span>
                      {pub.config_molde ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!pub.config_molde) return;
                            const token = codificarConfigMoldeParaUrl(pub.config_molde);
                            saveComunidadEstado(registrarRemixMolde(estado, pub.id));
                            router.push(`/?molde_comunidad=${encodeURIComponent(token)}`);
                          }}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Hacer este molde
                        </button>
                      ) : (
                        <Link
                          href={`/comunidad#${pub.slug}`}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EFF7F1] border border-[#B8D7C3] text-[#28593D] text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          Moda real
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}