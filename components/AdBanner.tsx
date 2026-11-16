"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export type AdVariant = "horizontal-banner" | "box-ad" | "large-box";

interface AdBannerProps {
  variant: AdVariant;
  adSlotId?: string;
  className?: string;
}

const VARIANT_CONFIG: Record<
  AdVariant,
  { sizeClass: string; dimensionsLabel: string; copy: string }
> = {
  "horizontal-banner": {
    sizeClass: "w-full min-h-[90px] max-w-[728px] mx-auto",
    dimensionsLabel: "728 × 90",
    copy: "Espacio listo para Google AdSense (Banner Horizontal)",
  },
  "box-ad": {
    sizeClass: "w-full max-w-[300px] min-h-[250px] mx-auto",
    dimensionsLabel: "300 × 250",
    copy: "Espacio listo para Google AdSense (Cuadro Lateral)",
  },
  "large-box": {
    sizeClass: "w-full max-w-[336px] min-h-[280px] mx-auto",
    dimensionsLabel: "336 × 280",
    copy: "Espacio listo para Google AdSense (Anuncio de Descarga)",
  },
};

/**
 * Reusable AdSense-ready banner container.
 * Replace the inner placeholder with `<ins className="adsbygoogle" ... />`
 * when connecting your Google AdSense publisher ID.
 */
export default function AdBanner({
  variant,
  adSlotId = "0000000000",
  className = "",
}: AdBannerProps) {
  const cfg = VARIANT_CONFIG[variant];

  return (
    <aside
      aria-label="Espacio publicitario"
      data-ad-variant={variant}
      data-ad-slot={adSlotId}
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br from-[#FBF9F6] to-[#F3EFE8] flex flex-col items-center justify-center p-3 text-center shadow-xs ${cfg.sizeClass} ${className}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1.5">
        Publicidad / Espacio Patrocinado
      </span>

      <div className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl border border-dashed border-slate-300/80 bg-white/70 w-full flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <Sparkles className="h-4 w-4 text-teal-600" />
          <span>Anuncio {cfg.dimensionsLabel}</span>
        </div>
        <p className="text-xs text-slate-500 max-w-[260px]">{cfg.copy}</p>
      </div>
    </aside>
  );
}
