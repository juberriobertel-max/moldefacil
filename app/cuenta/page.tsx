import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import AuthCenterClient from "@/components/auth/AuthCenterClient";

export const metadata: Metadata = {
  title: "Mi Cuenta Segura · MoldeFácil",
  description:
    "Inicia sesión, verifica tu correo, migra tus medidas locales privadas y configura autenticación en dos pasos (2FA) en MoldeFácil.",
};

export default function CuentaPage() {
  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2D2A26] flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-4xl mx-auto px-4 py-12 text-center text-sm text-[#5C554E]">
              Cargando centro de cuenta segura...
            </div>
          }
        >
          <AuthCenterClient />
        </Suspense>
      </main>
    </div>
  );
}
