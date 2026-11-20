"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Scissors, ShieldCheck, Users, Wrench } from "lucide-react";

interface SiteHeaderProps {
  rightSlot?: React.ReactNode;
}

const NAV_ITEMS = [
  {
    href: "/",
    label: "Generador de Moldes",
    shortLabel: "Generador",
    icon: Scissors,
    match: (pathname: string) => pathname === "/",
  },
  {
    href: "/comunidad",
    label: "Comunidad de Modistas",
    shortLabel: "Comunidad",
    icon: Users,
    match: (pathname: string) =>
      pathname === "/comunidad" ||
      pathname.startsWith("/comunidad/") ||
      pathname.startsWith("/modistas/"),
  },
  {
    href: "/blog",
    label: "Revista y Guías",
    shortLabel: "Revista",
    icon: BookOpen,
    match: (pathname: string) =>
      pathname === "/blog" || pathname.startsWith("/blog/"),
  },
  {
    href: "/taller",
    label: "Mi Taller",
    shortLabel: "Mi Taller",
    icon: Wrench,
    match: (pathname: string) =>
      pathname === "/taller" || pathname.startsWith("/taller/"),
  },
  {
    href: "/cuenta",
    label: "Mi Cuenta",
    shortLabel: "Cuenta",
    icon: ShieldCheck,
    match: (pathname: string) => pathname === "/cuenta",
  },
];

export default function SiteHeader({ rightSlot }: SiteHeaderProps) {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-4 lg:px-8 py-3 shadow-2xs">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        {/* Brand + Right CTA on top row for tablet/mobile */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="w-11 h-11 rounded-2xl bg-rose-600 group-hover:bg-rose-700 flex items-center justify-center shadow-sm text-white shrink-0 transition">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                MoldeFácil — Tus patrones de costura a medida
              </span>
              <span className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                Moldes gratis en PDF 1:1, revista de costura y herramientas de taller
              </span>
            </div>
          </Link>

          {rightSlot && <div className="xl:hidden shrink-0">{rightSlot}</div>}
        </div>

        {/* Navigation Links + Desktop CTA */}
        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5">
          <nav
            aria-label="Navegación principal"
            className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-2 bg-[#FAF8F5] p-1.5 rounded-2xl border border-slate-200"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition whitespace-nowrap ${
                    isActive
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="md:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>

          {rightSlot && (
            <div className="hidden xl:block shrink-0">{rightSlot}</div>
          )}
        </div>
      </div>
    </header>
  );
}