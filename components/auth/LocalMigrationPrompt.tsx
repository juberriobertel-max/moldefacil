"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Lock, UploadCloud } from "lucide-react";
import { leerResumenDatosLocalesNavegador } from "@/lib/auth/authClient";

/**
 * Ofrece guardar de forma explícita (y nunca automática sin aceptación)
 * las medidas corporales y pedidos de taller que la usuaria tenía en localStorage
 * dentro de su nueva cuenta privada.
 */
export default function LocalMigrationPrompt({
  autenticada,
  onMigracionCompleta,
}: {
  autenticada: boolean;
  onMigracionCompleta?: () => void;
}) {
  const [medidasCount, setMedidasCount] = useState<number>(0);
  const [pedidosCount, setPedidosCount] = useState<number>(0);
  const [enCuentaMedidas, setEnCuentaMedidas] = useState<number | null>(null);
  const [enCuentaPedidos, setEnCuentaPedidos] = useState<number | null>(null);
  const [migrando, setMigrando] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [omitido, setOmitido] = useState<boolean>(false);

  useEffect(() => {
    if (!autenticada) return;
    queueMicrotask(() => {
      const local = leerResumenDatosLocalesNavegador();
      setMedidasCount(local.medidas.length);
      setPedidosCount(local.pedidos.length);
    });
    void fetch("/api/auth/migrar-local")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { medidasGuardadas?: number; pedidosGuardados?: number } | null) => {
        if (d) {
          setEnCuentaMedidas(d.medidasGuardadas ?? 0);
          setEnCuentaPedidos(d.pedidosGuardados ?? 0);
        }
      })
      .catch(() => {});
  }, [autenticada]);

  if (!autenticada || omitido || (medidasCount === 0 && pedidosCount === 0)) {
    return null;
  }

  const ejecutarMigracion = async () => {
    setMigrando(true);
    setMensaje(null);
    try {
      const local = leerResumenDatosLocalesNavegador();
      const resp = await fetch("/api/auth/migrar-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medidas: local.medidas.map((m) => ({
            id: m.id,
            clientName: m.clientName,
            phone: m.phone,
            notes: m.notes,
            measurements: m.measurements,
            updatedAt: m.updatedAt,
          })),
          pedidos: local.pedidos.map((p) => ({
            id: p.id,
            clientName: p.clientName,
            garmentDescription: p.garmentDescription,
            deliveryDate: p.deliveryDate,
            totalPrice: p.totalPrice,
            depositPaid: p.depositPaid,
            currency: p.currency,
            status: p.status,
          })),
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        mensaje?: string;
        error?: string;
        totalMedidasCuenta?: number;
        totalPedidosCuenta?: number;
      };
      if (!resp.ok || !data.ok) {
        setMensaje(data.error ?? "No se pudo migrar los datos locales.");
        return;
      }
      setEnCuentaMedidas(data.totalMedidasCuenta ?? enCuentaMedidas);
      setEnCuentaPedidos(data.totalPedidosCuenta ?? enCuentaPedidos);
      setMensaje(
        data.mensaje ?? "Tus medidas privadas quedaron guardadas en tu cuenta."
      );
      onMigracionCompleta?.();
    } catch {
      setMensaje("Error de conexión al guardar en tu cuenta.");
    } finally {
      setMigrando(false);
    }
  };

  return (
    <section className="rounded-3xl bg-[#EFF7F1] border border-[#B8D7C3] p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-xl">
          <p className="text-xs font-extrabold text-[#28593D] inline-flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            Guardar lo que ya hiciste en tu cuenta (100% privado)
          </p>
          <h2 className="text-base font-extrabold text-[#2D2A26]">
            Encontramos {medidasCount} perfil(es) de medidas y {pedidosCount}{" "}
            pedido(s) en este navegador
          </h2>
          <p className="text-xs text-[#3C4A40] leading-relaxed">
            Nada se sube automáticamente sin tu confirmación. Si aceptas, quedarán
            ligados solo a tu cuenta bajo Row Level Security y nunca aparecerán en
            la comunidad pública.
          </p>
          {enCuentaMedidas !== null && (
            <p className="text-[11px] font-bold text-[#28593D]">
              Ya respaldados en cuenta: {enCuentaMedidas} perfiles de medidas y{" "}
              {enCuentaPedidos} pedidos.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={migrando}
            onClick={ejecutarMigracion}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#3B7A57] hover:bg-[#2F6446] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <UploadCloud className="w-4 h-4" />
            {migrando ? "Guardando..." : "Guardar en mi cuenta"}
          </button>
          <button
            type="button"
            onClick={() => setOmitido(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#C6DFCD] text-xs font-bold text-[#2D2A26] cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>

      {mensaje && (
        <p className="rounded-xl bg-white border border-[#C6DFCD] px-3.5 py-2.5 text-xs font-bold text-[#28593D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{mensaje}</span>
        </p>
      )}
    </section>
  );
}