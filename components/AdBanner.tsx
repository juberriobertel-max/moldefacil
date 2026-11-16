"use client";

import React, { useEffect, useId, useRef, useSyncExternalStore } from "react";

export type AdVariant =
  | "horizontal-banner"
  | "mobile-banner"
  | "box-ad"
  | "large-box";

interface AdBannerProps {
  variant: AdVariant;
  adSlotId?: string;
  className?: string;
  mediaQuery?: string;
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
  containerClass: "w-full max-w-[336px] mx-auto py-1.5 px-0 sm:px-2",
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

interface AtOptionsPayload {
  key: string;
  format: "iframe";
  height: number;
  width: number;
  container: string;
  async: boolean;
  params: Record<string, unknown>;
}

type WindowWithAdsterra = Window & {
  atOptions?: AtOptionsPayload;
};

let adLoadQueue: Promise<void> = Promise.resolve();

function enqueueAdScriptLoad(task: () => Promise<void>): void {
  adLoadQueue = adLoadQueue
    .catch(() => undefined)
    .then(task)
    .catch(() => undefined);
}

function useMediaQueryMatch(mediaQuery?: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!mediaQuery || typeof window === "undefined") {
        return () => {};
      }
      const mql = window.matchMedia(mediaQuery);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => {
      if (!mediaQuery || typeof window === "undefined") {
        return true;
      }
      return window.matchMedia(mediaQuery).matches;
    },
    () => !mediaQuery
  );
}

/**
 * Contenedor publicitario para Adsterra (728x90, 320x50 y 300x250).
 * Usa el modo asíncrono oficial (`async: true` + `container`) ejecutado en cola
 * secuencial para evitar colisiones de `window.atOptions` y preservar el dominio
 * y referrer reales en navegadores móviles (Android, iOS Safari y WebViews).
 */
export default function AdBanner({
  variant,
  adSlotId = "0000000000",
  className = "",
  mediaQuery,
}: AdBannerProps) {
  const unit = VARIANT_CONFIG[variant];
  const rawId = useId();
  const containerId = `adsterra-${adSlotId}-${rawId}`.replace(/[^a-zA-Z0-9_-]/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const matchesMedia = useMediaQueryMatch(mediaQuery);

  useEffect(() => {
    const hostEl = containerRef.current;
    if (!matchesMedia) {
      if (hostEl) {
        hostEl.innerHTML = "";
      }
      return;
    }

    let cancelled = false;

    enqueueAdScriptLoad(
      () =>
        new Promise<void>((resolve) => {
          const host = containerRef.current;
          if (cancelled || !host || !host.isConnected) {
            resolve();
            return;
          }

          host.innerHTML = "";
          const win = window as WindowWithAdsterra;
          win.atOptions = {
            key: unit.key,
            format: "iframe",
            height: unit.height,
            width: unit.width,
            container: containerId,
            async: true,
            params: {},
          };

          const script = document.createElement("script");
          script.async = true;
          script.src = `https://bauval.org/22/${unit.key}`;

          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(safetyTimer);
            resolve();
          };

          const safetyTimer = setTimeout(finish, 4000);
          script.onload = finish;
          script.onerror = finish;

          host.appendChild(script);
        })
    );

    return () => {
      cancelled = true;
      if (hostEl) {
        hostEl.innerHTML = "";
      }
    };
  }, [matchesMedia, unit.key, unit.height, unit.width, containerId]);

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
        <div
          id={containerId}
          ref={containerRef}
          style={{
            width: `${unit.width}px`,
            height: `${unit.height}px`,
          }}
          className="shrink-0 overflow-hidden flex items-center justify-center"
        />
      </div>
    </aside>
  );
}
