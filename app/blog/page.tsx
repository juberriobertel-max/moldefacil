import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Scissors } from "lucide-react";
import { BLOG_POSTS } from "@/lib/blogPosts";
import SiteHeader from "@/components/SiteHeader";
import AdBanner from "@/components/AdBanner";
import BlogIndexClient from "@/components/blog/BlogIndexClient";

export const metadata: Metadata = {
  title: "Revista y Guías de Costura | MoldeFácil",
  description:
    "Guías prácticas de patronaje, tablas de cuánta tela comprar, toma de medidas, agujas, impresión de PDFs y cómo poner precio a tu trabajo de costura.",
  keywords: [
    "revista de costura",
    "guías de patronaje",
    "cuánta tela comprar",
    "cómo tomar medidas costura",
    "faldas circulares fórmula",
    "MoldeFácil blog",
  ],
  openGraph: {
    title: "Revista y Guías de Costura | MoldeFácil",
    description:
      "Aprende patronaje, cálculo de telas, acabados limpios y gestión de taller con guías ilustradas paso a paso.",
    type: "website",
    locale: "es_ES",
    siteName: "MoldeFácil",
  },
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-slate-800 overflow-x-hidden">
      <SiteHeader
        rightSlot={
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs inline-flex items-center gap-2 transition"
          >
            <Scissors className="h-4 w-4" />
            <span>Crear Molde Gratis</span>
          </Link>
        }
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Top Ad Banner: 728x90 Desktop / 320x50 Mobile */}
        <div className="flex justify-center md:hidden w-full">
          <AdBanner
            variant="mobile-banner"
            adSlotId="blog-index-top-mobile-320x50"
            mediaQuery="(max-width: 767px)"
          />
        </div>
        <div className="hidden md:flex justify-center w-full">
          <AdBanner
            variant="horizontal-banner"
            adSlotId="blog-index-top-728x90"
            mediaQuery="(min-width: 768px)"
          />
        </div>

        {/* Hero Section */}
        <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs sm:text-sm font-extrabold uppercase tracking-wide">
              <BookOpen className="h-4 w-4" />
              Revista Editorial de Costura
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Guías prácticas para cortar, coser y vivir de tu taller sin complicaciones
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Explicaciones claras en español cotidiano, tablas interactivas de telas, diagramas de medidas y conexión directa con nuestro generador gratuito de moldes en PDF 1:1.
            </p>
          </div>
        </section>

        {/* Main Content + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 xl:col-span-9 min-w-0">
            <BlogIndexClient posts={BLOG_POSTS} />
          </section>

          <aside className="lg:col-span-4 xl:col-span-3 space-y-5 lg:sticky lg:top-24">
            <div className="flex justify-center">
              <AdBanner
                variant="box-ad"
                adSlotId="blog-index-sidebar-300x250"
              />
            </div>

            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-base font-extrabold text-slate-900">
                ¿Lista para cortar tu próxima prenda?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Pasa directamente a nuestras herramientas gratuitas de taller: cotizador, calculadora de falda circular, plan de corte y libreta de clientas.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/taller"
                  className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-extrabold text-center transition"
                >
                  Abrir Mi Taller de Costura
                </Link>
                <Link
                  href="/"
                  className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#FAF8F5] hover:bg-slate-100 text-slate-800 border border-slate-200 text-sm font-bold text-center transition"
                >
                  Ir al Generador de Moldes
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
