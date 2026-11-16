import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "MoldeFácil — Patrones de costura a medida",
  description:
    "Crea moldes de costura a medida en segundos desde una foto, estilos de moda o plantillas base. Descarga gratis tu patrón en PDF a escala real 1:1 listo para imprimir en casa.",
  keywords: [
    "moldes de costura",
    "patrones de costura gratis",
    "patronaje a medida",
    "moldes PDF escala 1:1",
    "patrones vestido cruzado",
    "costura casera",
    "MoldeFácil",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "MoldeFácil — Patrones de costura a medida",
    description:
      "Diseña moldes de vestido, blusa, falda, pantalón o conjunto a tu talla exacta y descárgalos gratis en PDF 1:1 listo para imprimir en hojas Carta o A4.",
    type: "website",
    locale: "es_ES",
    siteName: "MoldeFácil",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoldeFácil — Patrones de costura a medida",
    description:
      "Crea tus moldes de costura a medida desde una foto o estilo de moda e imprímelos en escala real 1:1.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF8F5] text-slate-800 text-base">
        {children}
      </body>
    </html>
  );
}
