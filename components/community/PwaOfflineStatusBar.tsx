"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CloudOff,
  HardDrive,
  RefreshCw,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react";
import {
  limpiarEnviadosDeCola,
  listarColaOffline,
  sincronizarColaOffline,
  type ElementoColaOffline,
} from "@/lib/community/offlineQueue";

/**
 * Barra de estado PWA Offline + Modo Ahorro de Datos + Cola IndexedDB (Fase 16).
 * - Registra el Service Worker nativo (`/sw.js`) compatible con Next 16 Turbopack.
 * - Respeta `navigator.connection.saveData` automáticamente o activación manual.
 * - Reintenta borradores en IndexedDB al evento `online` y al abrir la app (soporte iOS Safari).
 */
export default function PwaOfflineStatusBar({
  ahorroDatos,
  alCambiarAhorroDatos,
  onSincronizarElemento,
}: {
  ahorroDatos: boolean;
  alCambiarAhorroDatos: (activo: boolean) => void;
  onSincronizarElemento?: (item: ElementoColaOffline) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [enLinea, setEnLinea] = useState<boolean>(true);
  const [cola, setCola] = useState<ElementoColaOffline[]>([]);
  const [pesoCacheKb, setPesoCacheKb] = useState<number | null>(null);
  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [avisoSync, setAvisoSync] = useState<string | null>(null);

  const cargarColaYCache = useCallback(async () => {
    const items = await listarColaOffline();
    setCola(items);

    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === "number") {
          setPesoCacheKb(Math.round(est.usage / 1024));
        }
      } catch {
        // Storage estimate opcional
      }
    }
  }, []);

  const ejecutarSincronizacion = useCallback(async () => {
    if (!onSincronizarElemento || !navigator.onLine) return;
    setSincronizando(true);
    try {
      const res = await sincronizarColaOffline(onSincronizarElemento);
      await cargarColaYCache();
      if (res.enviadas > 0) {
        setAvisoSync(`${res.enviadas} borrador(es) guardado(s) sincronizados.`);
      }
    } finally {
      setSincronizando(false);
    }
  }, [cargarColaYCache, onSincronizarElemento]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    queueMicrotask(() => {
      setEnLinea(navigator.onLine);
      const navConn = navigator as Navigator & {
        connection?: { saveData?: boolean };
      };
      if (navConn.connection?.saveData && !ahorroDatos) {
        alCambiarAhorroDatos(true);
      }
      void cargarColaYCache();
      if (navigator.onLine) {
        void ejecutarSincronizacion();
      }
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onOnline = () => {
      setEnLinea(true);
      void ejecutarSincronizacion();
    };
    const onOffline = () => setEnLinea(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [ahorroDatos, alCambiarAhorroDatos, cargarColaYCache, ejecutarSincronizacion]);

  const limpiarCacheYEnviados = async () => {
    await limpiarEnviadosDeCola();
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    await cargarColaYCache();
    setAvisoSync("Caché offline limpiada correctamente.");
  };

  const pendientes = cola.filter((i) => i.estado !== "enviada").length;

  return (
    <div className="rounded-2xl bg-white border border-[#E2D6C8] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-extrabold ${
            enLinea
              ? "bg-[#EFF7F1] text-[#28593D]"
              : "bg-[#FFF1ED] text-[#8A3112]"
          }`}
        >
          {enLinea ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <CloudOff className="w-3.5 h-3.5" />
          )}
          {enLinea ? "Conectada · PWA lista offline" : "Sin internet (modo offline activo)"}
        </span>

        {pendientes > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFF9F2] border border-[#E5C9A8] font-bold text-[#8A3112]">
            {pendientes} en cola IndexedDB
            {enLinea && (
              <button
                type="button"
                disabled={sincronizando}
                onClick={() => void ejecutarSincronizacion()}
                className="underline font-extrabold cursor-pointer ml-1 inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Sincronizar
              </button>
            )}
          </span>
        )}

        {pesoCacheKb !== null && (
          <span className="inline-flex items-center gap-1 text-[#5C554E] font-semibold">
            <HardDrive className="w-3.5 h-3.5" />
            Uso caché: {pesoCacheKb > 1024 ? `${(pesoCacheKb / 1024).toFixed(1)} MB` : `${pesoCacheKb} KB`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => alCambiarAhorroDatos(!ahorroDatos)}
          aria-pressed={ahorroDatos}
          className={`min-h-[38px] px-3 rounded-xl border font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
            ahorroDatos
              ? "bg-[#3B7A57] text-white border-[#3B7A57]"
              : "bg-[#FAF6F0] text-[#2D2A26] border-[#E2D6C8]"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          {ahorroDatos ? "Ahorro de datos: ACTIVO" : "Modo ahorro de datos"}
        </button>

        <button
          type="button"
          onClick={() => void limpiarCacheYEnviados()}
          className="min-h-[38px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-[#5C554E] hover:text-[#8A3112] font-bold inline-flex items-center gap-1 cursor-pointer"
          title="Borrar copias guardadas offline y liberar espacio"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpiar caché
        </button>
      </div>

      {avisoSync && (
        <p className="w-full text-[11px] font-bold text-[#28593D]">{avisoSync}</p>
      )}
    </div>
  );
}