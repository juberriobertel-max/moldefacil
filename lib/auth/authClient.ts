"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadClientOrders,
  loadMeasurementProfiles,
  type ClientOrder,
  type SavedMeasurementProfile,
} from "@/lib/savedMeasurements";

export interface SesionClientePublica {
  usuariaId: string;
  sesionId: string;
  correo: string;
  nombrePublico: string;
  usuarioUnico: string;
  correoVerificado: boolean;
  rol: "usuaria" | "moderadora" | "admin";
  dosFaActivo: boolean;
  dosFaVerificado: boolean;
  fuente: "supabase" | "preview";
}

export interface EstadoAuthCliente {
  cargando: boolean;
  autenticada: boolean;
  sesion: SesionClientePublica | null;
  googleVinculado: boolean;
  pendienteEliminacionHasta?: string | null;
  sesionesActivas: Array<{
    sesionId: string;
    dispositivo: string;
    ipEnmascarada: string;
    creadoEn: string;
    ultimoUso: string;
  }>;
  eventosSeguridad: Array<{
    id: string;
    tipo: string;
    descripcion: string;
    ipEnmascarada: string;
    dispositivo: string;
    creadoEn: string;
  }>;
}

const ESTADO_INICIAL_AUTH: EstadoAuthCliente = {
  cargando: true,
  autenticada: false,
  sesion: null,
  googleVinculado: false,
  pendienteEliminacionHasta: null,
  sesionesActivas: [],
  eventosSeguridad: [],
};

/**
 * Hook liviano que consulta la sesión httpOnly en el servidor sin guardar tokens en localStorage.
 */
export function useAuthClient() {
  const [estado, setEstado] = useState<EstadoAuthCliente>(ESTADO_INICIAL_AUTH);

  const recargar = useCallback(async () => {
    try {
      const resp = await fetch("/api/auth/sesion", { cache: "no-store" });
      if (!resp.ok) {
        setEstado({ ...ESTADO_INICIAL_AUTH, cargando: false });
        return;
      }
      const data = (await resp.json()) as {
        autenticada: boolean;
        sesion: SesionClientePublica | null;
        cuenta?: {
          googleVinculado?: boolean;
          pendienteEliminacionHasta?: string | null;
        };
        sesionesActivas?: EstadoAuthCliente["sesionesActivas"];
        eventosSeguridad?: EstadoAuthCliente["eventosSeguridad"];
      };
      setEstado({
        cargando: false,
        autenticada: Boolean(data.autenticada && data.sesion),
        sesion: data.sesion,
        googleVinculado: Boolean(data.cuenta?.googleVinculado),
        pendienteEliminacionHasta: data.cuenta?.pendienteEliminacionHasta ?? null,
        sesionesActivas: data.sesionesActivas ?? [],
        eventosSeguridad: data.eventosSeguridad ?? [],
      });
    } catch {
      setEstado({ ...ESTADO_INICIAL_AUTH, cargando: false });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void recargar();
    });
  }, [recargar]);

  return { ...estado, recargar };
}

export interface ResumenDatosLocales {
  medidas: SavedMeasurementProfile[];
  pedidos: ClientOrder[];
}

export function leerResumenDatosLocalesNavegador(): ResumenDatosLocales {
  if (typeof window === "undefined") return { medidas: [], pedidos: [] };
  return {
    medidas: loadMeasurementProfiles(),
    pedidos: loadClientOrders(),
  };
}
