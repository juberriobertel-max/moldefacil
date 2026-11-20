import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, HeartHandshake, Scale, ShieldAlert, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Normas de Convivencia y Derechos de Autor | Comunidad MoldeFácil",
  description:
    "Acuerdos de respeto, apoyo mutuo entre modistas, cuidado con moldes comerciales y proceso de retiro por reclamos de derechos de autor.",
};

export default function NormasComunidadPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#2D2A26]">
      <SiteHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/comunidad"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] hover:border-[#C85A32] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]"
          >
            <ArrowLeft className="w-4 h-4 text-[#B34720]" />
            Volver a la Comunidad
          </Link>
          <Link
            href="/comunidad/privacidad"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#EFE6DA] text-sm font-bold text-[#2D2A26] hover:bg-[#E5D7C5] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]"
          >
            Ver Política de Privacidad
          </Link>
        </div>

        <section className="rounded-3xl bg-white border border-[#E2D6C8] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-xs font-extrabold">
            <HeartHandshake className="w-4 h-4" />
            Espacio seguro de costura y patronaje
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2D2A26]">
            Normas de Convivencia de la Comunidad
          </h1>
          <p className="text-sm sm:text-base text-[#5C554E] leading-relaxed">
            Queremos que cualquier persona —desde quien da su primera puntada hasta modistas con décadas de oficio— pueda mostrar sus avances, hacer preguntas sin miedo y compartir su saber en un ambiente cálido y seguro.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-[#2D2A26]">
                <Sparkles className="w-4 h-4 text-[#B34720]" />
                1. Amabilidad y cero burlas
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Cada prenda tiene detrás tiempo, aprendizaje e ilusión. Las sugerencias técnicas sobre pinzas, sisas o acabados son muy bienvenidas cuando se hacen con respeto y soluciones concretas. No se toleran burlas, acoso ni descalificaciones.
              </p>
            </article>

            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-[#2D2A26]">
                <ShieldAlert className="w-4 h-4 text-[#B34720]" />
                2. Primera publicación con revisión
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Para prevenir spam y enlaces engañosos, la primera publicación de cada cuenta nueva pasa por una revisión rápida de moderación antes de hacerse visible para toda la comunidad.
              </p>
            </article>

            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-[#2D2A26]">
                <Scale className="w-4 h-4 text-[#3B7A57]" />
                3. Derechos de autor y moldes propios
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Publica únicamente fotografías tomadas por ti (o con autorización expresa de quien confeccionó y aparece en la imagen). Está prohibido subir escaneos, PDFs o fotografías de revistas o patrones comerciales de pago sin licencia.
              </p>
            </article>

            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-[#2D2A26]">
                <HeartHandshake className="w-4 h-4 text-[#3B7A57]" />
                4. Modistas por encargo, Verificada y Directorio de Telas
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                MoldeFácil no cobra comisiones ni procesa pagos. La etiqueta manual <strong>“Verificada”</strong> indica que revisamos la actividad del perfil, pero <strong>no es una garantía comercial ni un seguro</strong>. En el directorio de tiendas, solo cuentas con más de 30 días y participación previa pueden reseñar, y toda relación comercial debe declararse de forma transparente.
              </p>
            </article>
          </div>

          <div className="rounded-2xl bg-[#FFF6F2] border border-[#F1D2C5] p-5 space-y-2">
            <h2 className="text-base font-extrabold text-[#8A3112]">
              Retiro por reclamo de derechos de autor o privacidad
            </h2>
            <p className="text-sm text-[#5C554E] leading-relaxed">
              Si ves una fotografía tuya publicada sin tu consentimiento, una captura de un patrón con derechos reservados o contenido inadecuado, pulsa el botón <strong>Reportar</strong> en cualquier tarjeta y selecciona el motivo correspondiente. Nuestro equipo de moderación oculta preventivamente el contenido mientras se verifica el reclamo y responde con mensajes claros y respetuosos.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}