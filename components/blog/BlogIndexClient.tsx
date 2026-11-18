"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Search, Sparkles } from "lucide-react";
import { BLOG_CATEGORIES, BlogCategory, BlogPost } from "@/lib/blogPosts";

interface BlogIndexClientProps {
  posts: BlogPost[];
}

const CATEGORY_BADGE_STYLES: Record<BlogCategory, string> = {
  Patronaje: "bg-rose-50 text-rose-800 border-rose-200",
  "Telas y Materiales": "bg-teal-50 text-teal-800 border-teal-200",
  "Negocio y Precios": "bg-amber-50 text-amber-800 border-amber-200",
  "Trucos de Taller": "bg-slate-100 text-slate-800 border-slate-200",
};

export default function BlogIndexClient({ posts }: BlogIndexClientProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "Todas" | BlogCategory
  >("Todas");

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (
        selectedCategory !== "Todas" &&
        post.categoria !== selectedCategory
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = `${post.titulo} ${post.subtitulo} ${post.resumenSEO} ${post.palabrasClave.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, query, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Search + Category Filter Card */}
      <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="relative">
          <Search className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar guía (ej. cuánta tela comprar, falda circular, aguja, precio)..."
            className="w-full min-h-[50px] pl-12 pr-4 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {BLOG_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`min-h-[44px] px-4 py-2 rounded-2xl text-sm font-bold border transition cursor-pointer ${
                  active
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-[#FAF8F5] text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold text-slate-600">
          Mostrando {filteredPosts.length} de {posts.length} guías prácticas
        </p>
        <Link
          href="/taller"
          className="text-sm font-bold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
        >
          <span>Ir a calculadoras de Mi Taller</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Articles Grid */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
          <h2 className="text-lg font-extrabold text-slate-900">
            No encontramos guías con esa búsqueda
          </h2>
          <p className="text-sm text-slate-600">
            Prueba otra palabra clave o limpia los filtros para ver los 8 artículos completos.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("Todas");
            }}
            className="min-h-[44px] px-5 py-2 rounded-2xl bg-rose-600 text-white text-sm font-bold cursor-pointer"
          >
            Ver todas las guías
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPosts.map((post) => {
            const hasInteractive = post.contenidoEstructurado.some(
              (b) =>
                b.type === "interactiveFabricTable" || b.type === "svgDiagram"
            );
            return (
              <article
                key={post.slug}
                className="rounded-3xl bg-white border border-slate-200 hover:border-rose-300 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4 transition"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                        CATEGORY_BADGE_STYLES[post.categoria]
                      }`}
                    >
                      {post.categoria}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.tiempoLectura} lectura
                    </span>
                  </div>

                  <Link href={`/blog/${post.slug}`} className="block group">
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 group-hover:text-rose-700 transition leading-snug">
                      {post.titulo}
                    </h2>
                  </Link>

                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    {post.subtitulo}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  {hasInteractive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                      <Sparkles className="h-3.5 w-3.5" />
                      Incluye esquema / tabla práctica
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">{post.fecha}</span>
                  )}

                  <Link
                    href={`/blog/${post.slug}`}
                    className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FAF8F5] hover:bg-rose-600 text-slate-900 hover:text-white border border-slate-200 hover:border-rose-600 text-sm font-extrabold inline-flex items-center gap-1.5 transition"
                  >
                    <span>Leer guía</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
