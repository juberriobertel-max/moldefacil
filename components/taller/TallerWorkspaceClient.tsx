"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Compass, DollarSign, Layers } from "lucide-react";
import PricingCalculator from "./PricingCalculator";
import CircleSkirtCalculator from "./CircleSkirtCalculator";
import FabricLayoutPlanner from "./FabricLayoutPlanner";
import ClientOrdersLedger from "./ClientOrdersLedger";

export type TallerTabId = "cotizador" | "falda" | "corte" | "libreta";

const TABS: {
  id: TallerTabId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "cotizador",
    title: "Cotizador de Precios",
    subtitle: "¿Cuánto cobrar por coser?",
    icon: DollarSign,
  },
  {
    id: "falda",
    title: "Faldas Circulares",
    subtitle: "Radio exacto y metros de tela",
    icon: Compass,
  },
  {
    id: "corte",
    title: "Plan de Corte",
    subtitle: "Acomodo visual sobre el rollo",
    icon: Layers,
  },
  {
    id: "libreta",
    title: "Libreta de Clientas",
    subtitle: "Encargos, abonos y medidas",
    icon: ClipboardList,
  },
];

function isValidTab(value: string | null): value is TallerTabId {
  return (
    value === "cotizador" ||
    value === "falda" ||
    value === "corte" ||
    value === "libreta"
  );
}

function TallerTabQuerySync({
  onSyncTab,
}: {
  onSyncTab: (tab: TallerTabId) => void;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const lastTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (tabParam !== lastTabRef.current) {
      lastTabRef.current = tabParam;
      if (isValidTab(tabParam)) {
        onSyncTab(tabParam);
      }
    }
  }, [tabParam, onSyncTab]);

  return null;
}

export default function TallerWorkspaceClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TallerTabId>("cotizador");

  const handleSelectTab = (tabId: TallerTabId) => {
    setActiveTab(tabId);
    router.replace(`/taller?tab=${tabId}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <TallerTabQuerySync onSyncTab={setActiveTab} />
      </Suspense>

      {/* 4 Big Thumb-Friendly Tabs */}
      <div
        role="tablist"
        aria-label="Herramientas de Mi Taller de Costura"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectTab(tab.id)}
              className={`min-h-[78px] p-4 rounded-3xl border-2 text-left flex items-center gap-3.5 transition cursor-pointer ${
                active
                  ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-white border-slate-200 text-slate-800 hover:border-rose-300"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[#FAF8F5] text-rose-600 border border-slate-200"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="block text-base font-extrabold leading-tight truncate">
                  {tab.title}
                </span>
                <span
                  className={`block text-xs mt-0.5 truncate ${
                    active ? "text-rose-100" : "text-slate-500"
                  }`}
                >
                  {tab.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Tool Panel */}
      <div role="tabpanel">
        {activeTab === "cotizador" && <PricingCalculator />}
        {activeTab === "falda" && <CircleSkirtCalculator />}
        {activeTab === "corte" && <FabricLayoutPlanner />}
        {activeTab === "libreta" && <ClientOrdersLedger />}
      </div>
    </div>
  );
}
