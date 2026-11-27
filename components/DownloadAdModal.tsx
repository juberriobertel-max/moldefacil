"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  CheckCircle2,
  X,
  ExternalLink,
  Clock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import type { SeamValidationReport } from "@/lib/types";
import AdBanner from "./AdBanner";

interface DownloadAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerDownload: () => void;
  paperLabel: string;
  pageCount: number;
  seamValidation?: SeamValidationReport;
}

const COUNTDOWN_SECONDS = 5;

export default function DownloadAdModal({
  isOpen,
  onClose,
  onTriggerDownload,
  paperLabel,
  pageCount,
  seamValidation,
}: DownloadAdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(COUNTDOWN_SECONDS);
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [confirmedWithWarnings, setConfirmedWithWarnings] =
    useState<boolean>(false);
  const triggeredRef = useRef(false);
  const downloadFnRef = useRef(onTriggerDownload);

  const failedChecks = seamValidation?.checks.filter((c) => !c.passed) ?? [];
  const hasValidationWarnings = Boolean(
    seamValidation && !seamValidation.verified && failedChecks.length > 0
  );
  const awaitingWarningConfirm =
    hasValidationWarnings && !confirmedWithWarnings;

  useEffect(() => {
    downloadFnRef.current = onTriggerDownload;
  }, [onTriggerDownload]);

  useEffect(() => {
    if (!isOpen) {
      triggeredRef.current = false;
      const clearWarn = setTimeout(() => {
        setConfirmedWithWarnings(false);
      }, 0);
      return () => clearTimeout(clearWarn);
    }

    if (awaitingWarningConfirm) {
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
  }, [isOpen, awaitingWarningConfirm]);

  if (!isOpen) return null;

  const progressPct = Math.min(
    100,
    Math.round(((COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-4 sm:p-7 shadow-2xl text-slate-800">
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
              awaitingWarningConfirm
                ? "bg-amber-100 text-amber-700"
                : downloaded
                  ? "bg-teal-100 text-teal-700"
                  : "bg-rose-100 text-rose-600"
            }`}
          >
            {awaitingWarningConfirm ? (
              <AlertTriangle className="h-6 w-6" />
            ) : downloaded ? (
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
              {awaitingWarningConfirm
                ? "Revisa estas alertas antes de cortar el molde"
                : downloaded
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

        {seamValidation?.verified && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2 text-xs font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>Empate de costuras, simetría y pinzas verificado</span>
          </div>
        )}

        {awaitingWarningConfirm ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3.5 space-y-2 text-xs sm:text-sm text-amber-950">
              <p className="font-bold">
                La auditoría detectó {failedChecks.length} detalle(s) fuera de tolerancia:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-amber-900">
                {failedChecks.map((chk) => (
                  <li key={chk.id}>
                    <strong>{chk.label}:</strong> {chk.detail}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-800 pt-1">
                Te recomendamos ajustar tus medidas antes de imprimir y cortar la tela.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm sm:text-base font-bold transition cursor-pointer"
              >
                Volver y revisar medidas
              </button>
              <button
                type="button"
                onClick={() => setConfirmedWithWarnings(true)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 text-sm font-bold transition cursor-pointer"
              >
                Entiendo, descargar PDF de todas formas
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-5 border border-slate-200">
              <div
                style={{ width: `${progressPct}%` }}
                className={`h-full transition-all duration-700 ease-out rounded-full ${
                  downloaded ? "bg-teal-600" : "bg-rose-600"
                }`}
              />
            </div>

            {/* Center 300x250 Ad Space */}
            <div className="mb-5 w-full flex justify-center">
              <AdBanner variant="large-box" adSlotId="download-modal-300x250" />
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
          </>
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
