import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BookOpen, Scissors, Wrench } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import AdBanner from "@/components/AdBanner";
import TallerWorkspaceClient from "@/components/taller/TallerWorkspaceClient";

export const metadata: Metadata = {
  title: "Mi Taller de Costura — Cotizador, Faldas Circulares, Corte y Clientas | MoldeFácil",
  description:
    "Suite gratuita de herramientas diarias para modistas: cotizador de precios, calculadora de faldas circulares, simulador de acomodo sobre tela y libreta digital de encargos.",
  keywords: [
    "cotizador de costura",
    "cuánto cobrar por coser",
    "calculadora falda circular",
    "plan de corte tela",
    "libreta digital modista",
  ],
  openGraph: {
    title: "Mi Taller de Costura | MoldeFácil",
    description:
      "4 herramientas gratuitas en tu navegador para cotizar prendas, calcular faldas circulares, planear cortes y organizar pedidos.",
    type: "website",
    locale: "es_ES",
    siteName: "MoldeFácil",
  },
};

export default function TallerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-slate-800 overflow-x-hidden">
      <SiteHeader
        rightSlot={
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs inline-flex items-center gap-2 transition"
          >
            <Scissors className="h-4 w-4" />
            <span>Ir al Generador</span>
          </Link>
        }
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Top Ad Banner */}
        <div className="flex justify-center md:hidden w-full">
          <AdBanner
            variant="mobile-banner"
            adSlotId="taller-top-mobile-320x50"
            mediaQuery="(max-width: 767px)"
          />
        </div>
        <div className="hidden md:flex justify-center w-full">
          <AdBanner
            variant="horizontal-banner"
            adSlotId="taller-top-728x90"
            mediaQuery="(min-width: 768px)"
          />
        </div>

        {/* Hero */}
        <section className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-extrabold uppercase tracking-wide">
              <Wrench className="h-3.5 w-3.5" />
              Suite Mi Taller de Costura
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tus 4 herramientas prácticas para el trabajo diario
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Cotiza precios justos, calcula faldas circulares con dibujo técnico, simula el acomodo sobre tela y organiza los encargos de tus clientas 100% gratis en tu navegador.
            </p>
          </div>

          <Link
            href="/blog"
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#FAF8F5] hover:bg-slate-100 text-slate-800 border border-slate-200 text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 transition"
          >
            <BookOpen className="h-4 w-4 text-rose-600" />
            <span>Leer Guías de Costura</span>
          </Link>
        </section>

        <TallerWorkspaceClient />

        {/* Bottom Ad Banner */}
        <div className="flex justify-center pt-2">
          <div className="md:hidden">
            <AdBanner
              variant="mobile-banner"
              adSlotId="taller-bottom-mobile-320x50"
              mediaQuery="(max-width: 767px)"
            />
          </div>
          <div className="hidden md:block">
            <AdBanner
              variant="horizontal-banner"
              adSlotId="taller-bottom-728x90"
              mediaQuery="(min-width: 768px)"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
