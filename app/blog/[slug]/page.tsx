import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Scissors, Wrench } from "lucide-react";
import { BLOG_POSTS, getBlogPostBySlug } from "@/lib/blogPosts";
import SiteHeader from "@/components/SiteHeader";
import AdBanner from "@/components/AdBanner";
import BlogArticleRenderer from "@/components/blog/BlogArticleRenderer";
import BlogOfflineAndGlossaryBar from "@/components/blog/BlogOfflineAndGlossaryBar";
import BlogShareButtons from "@/components/blog/BlogShareButtons";
import ReadingProgressBar from "@/components/blog/ReadingProgressBar";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) {
    return {
      title: "Artículo no encontrado | MoldeFácil",
    };
  }

  return {
    title: `${post.titulo} | MoldeFácil`,
    description: post.resumenSEO,
    keywords: post.palabrasClave,
    openGraph: {
      title: post.titulo,
      description: post.resumenSEO,
      type: "article",
      publishedTime: post.fecha,
      locale: "es_ES",
      siteName: "MoldeFácil",
    },
    twitter: {
      card: "summary_large_image",
      title: post.titulo,
      description: post.resumenSEO,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(
    0,
    3
  );

  const siteBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://moldefacil-tawny.vercel.app");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.titulo,
    description: post.resumenSEO,
    datePublished: post.fecha,
    dateModified: post.fecha,
    inLanguage: "es",
    author: {
      "@type": "Organization",
      name: "MoldeFácil",
    },
    publisher: {
      "@type": "Organization",
      name: "MoldeFácil",
      url: siteBaseUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteBaseUrl}/blog/${post.slug}`,
    },
    keywords: post.palabrasClave.join(", "),
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#2D2A26] overflow-x-hidden">
      <ReadingProgressBar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader
        rightSlot={
          <Link
            href={post.accionGenerador.href}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs inline-flex items-center gap-2 transition"
          >
            <Scissors className="h-4 w-4" />
            <span>Abrir con esta prenda</span>
          </Link>
        }
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Top Ad Banner before article title */}
        <div className="flex justify-center md:hidden w-full">
          <AdBanner
            variant="mobile-banner"
            adSlotId={`blog-post-top-mobile-${post.slug}`}
            mediaQuery="(max-width: 767px)"
          />
        </div>
        <div className="hidden md:flex justify-center w-full">
          <AdBanner
            variant="horizontal-banner"
            adSlotId={`blog-post-top-728x90-${post.slug}`}
            mediaQuery="(min-width: 768px)"
          />
        </div>

        {/* Breadcrumb back */}
        <div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#C85A32] transition min-h-[40px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al cuaderno de guías</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Article Column */}
          <article className="lg:col-span-8 min-w-0 space-y-6 max-w-3xl">
            <header className="rounded-3xl bg-white border border-[#E5DCD0] p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
                <span className="px-3.5 py-1 rounded-full bg-[#FAF6F0] text-[#C85A32] border border-[#E5DCD0] font-extrabold">
                  {post.categoria}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                  <Clock className="h-4 w-4 text-[#C85A32]" />
                  {post.tiempoLectura} de lectura
                </span>
                <span className="text-slate-400">• {post.fecha}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-[#2D2A26] tracking-tight leading-tight">
                {post.titulo}
              </h1>

              <p className="text-[17px] sm:text-[18px] text-[#5C554E] leading-relaxed">
                {post.subtitulo}
              </p>

              <div className="pt-2 border-t border-slate-100">
                <BlogShareButtons
                  title={post.titulo}
                  slug={post.slug}
                  summary={post.resumenSEO}
                />
              </div>
            </header>

            <BlogArticleRenderer
              blocks={post.contenidoEstructurado}
              action={post.accionGenerador}
              slug={post.slug}
              readingTime={post.tiempoLectura}
            />

            <BlogOfflineAndGlossaryBar slug={post.slug} />

            {/* Bottom Share Box */}
            <div className="rounded-3xl bg-white border border-[#E5DCD0] p-5 sm:p-6 shadow-xs space-y-3 max-w-3xl">
              <h2 className="text-base font-extrabold text-[#2D2A26]">
                ¿Te sirvió esta guía en tu mesa de corte? Compártela o guárdala
              </h2>
              <BlogShareButtons
                title={post.titulo}
                slug={post.slug}
                summary={post.resumenSEO}
              />
            </div>
          </article>

          {/* Desktop Sidebar */}
          <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
            <div className="flex justify-center">
              <AdBanner
                variant="box-ad"
                adSlotId={`blog-post-sidebar-300x250-${post.slug}`}
              />
            </div>

            <div className="rounded-3xl bg-white border border-[#E5DCD0] p-5 shadow-xs space-y-3">
              <h2 className="text-base font-extrabold text-[#2D2A26] flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#3B7A57]" />
                <span>Herramientas de Mi Taller</span>
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Calcula cuánto cobrar, faldas circulares exactas, plan de corte sobre tela y lleva tus encargos al día.
              </p>
              <Link
                href="/taller"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#3B7A57] hover:bg-[#2F6346] text-white text-sm font-extrabold flex items-center justify-center gap-2 transition"
              >
                <span>Abrir Mi Taller</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl bg-white border border-[#E5DCD0] p-5 shadow-xs space-y-3">
              <h2 className="text-base font-extrabold text-[#2D2A26]">
                Otras guías del cuaderno
              </h2>
              <div className="space-y-3">
                {relatedPosts.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/blog/${rel.slug}`}
                    className="block p-3 rounded-2xl bg-[#FAF6F0] hover:bg-[#FDF3EE] border border-[#E5DCD0] hover:border-[#C85A32] transition"
                  >
                    <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[#C85A32] mb-1">
                      {rel.categoria}
                    </span>
                    <span className="block text-sm font-bold text-[#2D2A26] leading-snug">
                      {rel.titulo}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}