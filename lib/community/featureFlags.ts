/**
 * Flags globales de lanzamiento incremental (Fases 13 a 23 + Fase 24 descartada).
 * Todo módulo nuevo vive detrás de un flag activable desde variables de entorno
 * o desde el panel administrativo local sin reescribir código.
 */

export type FlagModuloComunidad =
  | "fitFeedback"
  | "adjustmentsLibrary"
  | "projectLogs"
  | "pwaOffline"
  | "seamstressPortfolio"
  | "commissions"
  | "circles"
  | "mentorship"
  | "learningPathsGlossary"
  | "supplierDirectory"
  | "aiAssistant";

export type MapaFeatureFlags = Record<FlagModuloComunidad, boolean>;

export const FEATURE_FLAGS_POR_DEFECTO: MapaFeatureFlags = {
  fitFeedback: true,
  adjustmentsLibrary: true,
  projectLogs: true,
  pwaOffline: true,
  seamstressPortfolio: true,
  commissions: true,
  circles: true,
  mentorship: true,
  learningPathsGlossary: true,
  supplierDirectory: true,
  // Fase 24 descartada por decisión del producto
  aiAssistant: false,
};

function leerEnvFlag(nombre: string, fallback: boolean): boolean {
  const val = process.env[nombre];
  if (val === "false" || val === "0") return false;
  if (val === "true" || val === "1") return true;
  return fallback;
}

export function obtenerFeatureFlagsBase(): MapaFeatureFlags {
  return {
    fitFeedback: leerEnvFlag("NEXT_PUBLIC_FF_FIT_FEEDBACK", true),
    adjustmentsLibrary: leerEnvFlag("NEXT_PUBLIC_FF_ADJUSTMENTS_LIB", true),
    projectLogs: leerEnvFlag("NEXT_PUBLIC_FF_PROJECT_LOGS", true),
    pwaOffline: leerEnvFlag("NEXT_PUBLIC_FF_PWA_OFFLINE", true),
    seamstressPortfolio: leerEnvFlag("NEXT_PUBLIC_FF_PORTFOLIO", true),
    commissions: leerEnvFlag("NEXT_PUBLIC_FF_COMMISSIONS", true),
    circles: leerEnvFlag("NEXT_PUBLIC_FF_CIRCLES", true),
    mentorship: leerEnvFlag("NEXT_PUBLIC_FF_MENTORSHIP", true),
    learningPathsGlossary: leerEnvFlag("NEXT_PUBLIC_FF_PATHS_GLOSSARY", true),
    supplierDirectory: leerEnvFlag("NEXT_PUBLIC_FF_SUPPLIERS", true),
    aiAssistant: false,
  };
}