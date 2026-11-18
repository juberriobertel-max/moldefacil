import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blogPosts";

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
  ];

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.fecha,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  return [...staticPages, ...blogEntries];
}
