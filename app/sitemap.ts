import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blogPosts";
import { PERFILES_DEMO } from "@/lib/community/demoSeed";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://moldefacil-tawny.vercel.app");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: "2026-11-18",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: "2026-11-18",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/taller`,
      lastModified: "2026-11-18",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/comunidad`,
      lastModified: "2026-11-19",
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/comunidad/normas`,
      lastModified: "2026-11-19",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/comunidad/privacidad`,
      lastModified: "2026-11-19",
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.fecha,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  const modistaEntries: MetadataRoute.Sitemap = PERFILES_DEMO.map((p) => ({
    url: `${BASE_URL}/modistas/${p.usuario_unico}`,
    lastModified: "2026-11-19",
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticPages, ...blogEntries, ...modistaEntries];
}