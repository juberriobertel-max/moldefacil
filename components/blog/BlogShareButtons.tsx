"use client";

import React, { useState } from "react";
import { Bookmark, Check, Copy, MessageCircle } from "lucide-react";

interface BlogShareButtonsProps {
  title: string;
  slug: string;
  summary: string;
}

export default function BlogShareButtons({
  title,
  slug,
  summary,
}: BlogShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const getArticleUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/blog/${slug}`;
    }
    return `https://moldefacil-tawny.vercel.app/blog/${slug}`;
  };

  const handleShareWhatsApp = () => {
    const url = getArticleUrl();
    const message = `Mira esta guía de costura de MoldeFácil: "${title}" ✂️🧵\n${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleSavePinterest = () => {
    const url = getArticleUrl();
    const ogImage =
      typeof window !== "undefined"
        ? `${window.location.origin}/opengraph-image`
        : "https://moldefacil-tawny.vercel.app/opengraph-image";
    const description = `${title} — ${summary}`;
    window.open(
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
        url
      )}&media=${encodeURIComponent(ogImage)}&description=${encodeURIComponent(
        description
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleCopyLink = async () => {
    const url = getArticleUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback silencioso
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={handleShareWhatsApp}
        className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
      >
        <MessageCircle className="h-4 w-4 shrink-0" />
        <span>Compartir guía por WhatsApp</span>
      </button>

      <button
        type="button"
        onClick={handleSavePinterest}
        className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
      >
        <Bookmark className="h-4 w-4 shrink-0" />
        <span>Guardar idea en Pinterest</span>
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-bold flex items-center gap-2 transition cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-teal-700">¡Enlace copiado!</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 shrink-0" />
            <span>Copiar enlace</span>
          </>
        )}
      </button>
    </div>
  );
}
