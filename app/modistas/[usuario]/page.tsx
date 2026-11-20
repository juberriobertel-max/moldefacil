import React, { Suspense } from "react";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SeamstressProfileClient from "@/components/community/SeamstressProfileClient";
import { PERFILES_DEMO } from "@/lib/community/demoSeed";

export function generateStaticParams() {
  return PERFILES_DEMO.map((p) => ({
    usuario: p.usuario_unico,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ usuario: string }>;
}): Promise<Metadata> {
  const { usuario } = await params;
  const perfil = PERFILES_DEMO.find(
    (p) => p.usuario_unico.toLowerCase() === usuario.toLowerCase()
  );

  return {
    title: perfil
      ? `${perfil.nombre_publico} (@${perfil.usuario_unico}) | Comunidad MoldeFácil`
      : `@${usuario} | Perfil de Modista en MoldeFácil`,
    description:
      perfil?.bio ||
      "Taller y creaciones compartidas en la Comunidad de Modistas de MoldeFácil.",
    openGraph: {
      title: perfil
        ? `${perfil.nombre_publico} · Modista en MoldeFácil`
        : `Taller @${usuario} · MoldeFácil`,
      description:
        perfil?.bio || "Descubre prendas cosidas y moldes listos para adaptar.",
      type: "profile",
    },
  };
}

async function ModistaPerfilContenido({
  params,
}: {
  params: Promise<{ usuario: string }>;
}) {
  const { usuario } = await params;
  return <SeamstressProfileClient usuarioSlug={usuario} />;
}

export default function ModistaPerfilPage({
  params,
}: {
  params: Promise<{ usuario: string }>;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#2D2A26]">
      <SiteHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-4xl mx-auto px-4 py-12 text-center text-sm font-bold text-[#5C554E]">
              Cargando taller de la modista...
            </div>
          }
        >
          <ModistaPerfilContenido params={params} />
        </Suspense>
      </main>
    </div>
  );
}