"use client";

import React from "react";

export type AdVariant =
  | "horizontal-banner"
  | "mobile-banner"
  | "box-ad"
  | "large-box";

interface AdBannerProps {
  variant: AdVariant;
  adSlotId?: string;
  className?: string;
}

interface AdsterraUnitConfig {
  key: string;
  width: number;
  height: number;
  containerClass: string;
}

const ADSTERRA_728X90: AdsterraUnitConfig = {
  key: "569b1ab7d716009020b4a7eb7ddcb905",
  width: 728,
  height: 90,
  containerClass: "w-full max-w-[752px] mx-auto p-2.5",
};

const ADSTERRA_320X50: AdsterraUnitConfig = {
  key: "0fd4d8a023c84ccea8217c24b03449b5",
  width: 320,
  height: 50,
  containerClass: "w-full max-w-[336px] mx-auto py-1.5 px-1 sm:px-2",
};

const ADSTERRA_300X250: AdsterraUnitConfig = {
  key: "935987eeb79ab07c6e97e35002fb794d",
  width: 300,
  height: 250,
  containerClass: "w-full max-w-[324px] mx-auto p-1.5 sm:p-2.5",
};

const VARIANT_CONFIG: Record<AdVariant, AdsterraUnitConfig> = {
  "horizontal-banner": ADSTERRA_728X90,
  "mobile-banner": ADSTERRA_320X50,
  "box-ad": ADSTERRA_300X250,
  "large-box": ADSTERRA_300X250,
};

function buildAdsterraSrcDoc(unit: AdsterraUnitConfig): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        'key' : '${unit.key}',
        'format' : 'iframe',
        'height' : ${unit.height},
        'width' : ${unit.width},
        'params' : {}
      };
    </script>
    <script src="https://bauval.org/22/${unit.key}"></script>
  </body>
</html>`;
}

/**
 * Contenedor publicitario aislado por iframe para Adsterra (728x90, 320x50 y 300x250).
 */
export default function AdBanner({
  variant,
  adSlotId = "0000000000",
  className = "",
}: AdBannerProps) {
  const unit = VARIANT_CONFIG[variant];
  const srcDoc = buildAdsterraSrcDoc(unit);

  return (
    <aside
      aria-label="Espacio publicitario"
      data-ad-variant={variant}
      data-ad-slot={adSlotId}
      data-adsterra-key={unit.key}
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br from-[#FBF9F6] to-[#F3EFE8] flex flex-col items-center justify-center text-center shadow-xs ${unit.containerClass} ${className}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">
        Publicidad
      </span>

      <div className="w-full max-w-full overflow-x-auto flex items-center justify-center">
        <iframe
          title={`Publicidad ${unit.width}x${unit.height}`}
          srcDoc={srcDoc}
          width={unit.width}
          height={unit.height}
          scrolling="no"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{
            width: `${unit.width}px`,
            height: `${unit.height}px`,
            border: "none",
            overflow: "hidden",
            display: "block",
            flexShrink: 0,
          }}
        />
      </div>
    </aside>
  );
}
