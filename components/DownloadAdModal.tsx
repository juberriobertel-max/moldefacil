"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, CheckCircle2, X, ExternalLink, Clock } from "lucide-react";
import AdBanner from "./AdBanner";

interface DownloadAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerDownload: () => void;
  paperLabel: string;
  pageCount: number;
}

const COUNTDOWN_SECONDS = 5;

export default function DownloadAdModal({
  isOpen,
  onClose,
  onTriggerDownload,
  paperLabel,
  pageCount,
}: DownloadAdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(COUNTDOWN_SECONDS);
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const triggeredRef = useRef(false);
  const downloadFnRef = useRef(onTriggerDownload);

  useEffect(() => {
    downloadFnRef.current = onTriggerDownload;
  }, [onTriggerDownload]);

  useEffect(() => {
    if (!isOpen) {
      triggeredRef.current = false;
      return;
    }

    triggeredRef.current = false;
    const resetTimer = setTimeout(() => {
      setSecondsLeft(COUNTDOWN_SECONDS);
      setDownloaded(false);
    }, 0);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!triggeredRef.current) {
            triggeredRef.current = true;
            downloadFnRef.current();
            setDownloaded(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(resetTimer);
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const progressPct = Math.min(
    100,
    Math.round(((COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-2xl text-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-4 pr-8">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              downloaded
                ? "bg-teal-100 text-teal-700"
                : "bg-rose-100 text-rose-600"
            }`}
          >
            {downloaded ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Clock className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3
              id="download-modal-title"
              className="text-lg font-bold text-slate-900 leading-snug"
            >
              {downloaded
                ? "¡Tu molde PDF ya se descargó!"
                : `¡Tu molde está listo! Tu descarga comenzará en ${secondsLeft} ${
                    secondsLeft === 1 ? "segundo" : "segundos"
                  }...`}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Formato {paperLabel} • {pageCount} páginas listas para imprimir
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-5 border border-slate-200">
          <div
            style={{ width: `${progressPct}%` }}
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              downloaded ? "bg-teal-600" : "bg-rose-600"
            }`}
          />
        </div>

        {/* Center 336x280 Ad Space */}
        <div className="mb-5">
          <AdBanner variant="large-box" adSlotId="download-modal-336x280" />
        </div>

        {/* Action Button once countdown finishes */}
        {downloaded && (
          <button
            type="button"
            onClick={() => downloadFnRef.current()}
            className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-base font-bold shadow-md flex items-center justify-center gap-2 transition cursor-pointer mb-4"
          >
            <Download className="h-5 w-5" />
            Descargar de nuevo
          </button>
        )}

        {/* Secondary Ad-Free Option */}
        <div className="text-center pt-3 border-t border-slate-100">
          <a
            href="[PEGA_AQUI_TU_LINK_DE_PAGO]"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-rose-600 underline underline-offset-4 transition"
          >
            ¿Prefieres descargar al instante sin ver anuncios? Desbloquea la versión Sin Publicidad (Pago único)
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}
