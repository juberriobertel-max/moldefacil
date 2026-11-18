"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  Copy,
  DollarSign,
  MessageCircle,
  Scissors,
  Sparkles,
} from "lucide-react";

type CurrencySymbol = "$" | "USD $" | "€";

function formatMoney(amount: number, symbol: CurrencySymbol): string {
  const rounded = Math.round(amount);
  return `${symbol} ${rounded.toLocaleString("es-CO")}`;
}

export default function PricingCalculator() {
  const [currency, setCurrency] = useState<CurrencySymbol>("$");
  const [garmentName, setGarmentName] = useState(
    "Vestido cruzado a medida"
  );
  const [deliveryDays, setDeliveryDays] = useState("5 días hábiles");

  // Fabric cost mode
  const [fabricMode, setFabricMode] = useState<"meters" | "direct">("meters");
  const [fabricMeters, setFabricMeters] = useState<number>(2.5);
  const [pricePerMeter, setPricePerMeter] = useState<number>(28000);
  const [directFabricCost, setDirectFabricCost] = useState<number>(70000);

  // Notions / avios
  const [threadCost, setThreadCost] = useState<number>(4000);
  const [zipperCost, setZipperCost] = useState<number>(6000);
  const [buttonsCost, setButtonsCost] = useState<number>(0);
  const [interfacingCost, setInterfacingCost] = useState<number>(3500);
  const [elasticCost, setElasticCost] = useState<number>(0);
  const [laceOtherCost, setLaceOtherCost] = useState<number>(0);

  // Labor time & hourly rate
  const [cuttingHours, setCuttingHours] = useState<number>(1.5);
  const [sewingHours, setSewingHours] = useState<number>(4);
  const [hourlyRate, setHourlyRate] = useState<number>(18000);

  // Sliders
  const [overheadPct, setOverheadPct] = useState<number>(15);
  const [profitPct, setProfitPct] = useState<number>(25);

  const [copied, setCopied] = useState(false);

  const breakdown = useMemo(() => {
    const safeMeters = Math.max(0, fabricMeters);
    const safePerMeter = Math.max(0, pricePerMeter);
    const fabricTotal =
      fabricMode === "meters"
        ? safeMeters * safePerMeter
        : Math.max(0, directFabricCost);

    const notionsTotal =
      Math.max(0, threadCost) +
      Math.max(0, zipperCost) +
      Math.max(0, buttonsCost) +
      Math.max(0, interfacingCost) +
      Math.max(0, elasticCost) +
      Math.max(0, laceOtherCost);

    const totalMaterials = fabricTotal + notionsTotal;
    const totalHours = Math.max(0, cuttingHours) + Math.max(0, sewingHours);
    const laborPay = totalHours * Math.max(0, hourlyRate);
    const baseCost = totalMaterials + laborPay;
    const overheadAmount = baseCost * (overheadPct / 100);
    const subtotalWithOverhead = baseCost + overheadAmount;
    const workshopNetProfit = subtotalWithOverhead * (profitPct / 100);
    const finalClientPrice = subtotalWithOverhead + workshopNetProfit;
    const suggestedDeposit = finalClientPrice * 0.5;

    return {
      fabricTotal,
      notionsTotal,
      totalMaterials,
      totalHours,
      laborPay,
      overheadAmount,
      workshopNetProfit,
      finalClientPrice,
      suggestedDeposit,
    };
  }, [
    fabricMode,
    fabricMeters,
    pricePerMeter,
    directFabricCost,
    threadCost,
    zipperCost,
    buttonsCost,
    interfacingCost,
    elasticCost,
    laceOtherCost,
    cuttingHours,
    sewingHours,
    hourlyRate,
    overheadPct,
    profitPct,
  ]);

  const buildClientQuoteText = () => {
    const title = garmentName.trim() || "Prenda confeccionada a medida";
    const delivery = deliveryDays.trim() || "Por confirmar";
    const totalText = formatMoney(breakdown.finalClientPrice, currency);
    const depositText = formatMoney(breakdown.suggestedDeposit, currency);

    return [
      `Hola 😊 Aquí tienes tu cotización de confección a medida:`,
      ``,
      `👗 *Prenda:* ${title}`,
      `✂️ *Incluye:* Toma de medidas / molde personalizado, corte, insumos de confección, armado, 1 prueba de entalle y planchado final.`,
      `📅 *Tiempo estimado de entrega:* ${delivery}`,
      `💰 *Valor total:* ${totalText}`,
      `📌 *Para agendar e iniciar:* Abono del 50% (${depositText}) y el saldo restante al entregar.`,
      ``,
      `¿Confirmamos medidas para separar tu espacio en el taller? 🧵✨`,
    ].join("\n");
  };

  const handleCopyQuote = async () => {
    try {
      await navigator.clipboard.writeText(buildClientQuoteText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  };

  const handleSendWhatsApp = () => {
    const text = buildClientQuoteText();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Form */}
      <div className="lg:col-span-7 space-y-5">
        {/* Garment + Currency */}
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                1. Datos del trabajo y moneda
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Esta información aparece en la cotización limpia para tu clienta.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-slate-200">
              {(["$", "USD $", "€"] as CurrencySymbol[]).map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setCurrency(sym)}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    currency === sym
                      ? "bg-rose-600 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Nombre de la prenda o encargo
              </label>
              <input
                type="text"
                value={garmentName}
                onChange={(e) => setGarmentName(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Tiempo estimado de entrega
              </label>
              <input
                type="text"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base text-slate-900"
              />
            </div>
          </div>
        </section>

        {/* Fabric Cost */}
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">
              2. Tela e insumos (avíos)
            </h2>
            <div className="flex gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFabricMode("meters")}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
                  fabricMode === "meters"
                    ? "bg-teal-600 text-white"
                    : "text-slate-600"
                }`}
              >
                Metros × Precio
              </button>
              <button
                type="button"
                onClick={() => setFabricMode("direct")}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
                  fabricMode === "direct"
                    ? "bg-teal-600 text-white"
                    : "text-slate-600"
                }`}
              >
                Total tela directo
              </button>
            </div>
          </div>

          {fabricMode === "meters" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Metros de tela usados (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={fabricMeters}
                  onChange={(e) => setFabricMeters(Number(e.target.value))}
                  className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Precio por metro ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  value={pricePerMeter}
                  onChange={(e) => setPricePerMeter(Number(e.target.value))}
                  className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Costo total de la tela ({currency})
              </label>
              <input
                type="number"
                min={0}
                value={directFabricCost}
                onChange={(e) => setDirectFabricCost(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">
                Insumos y avíos ({currency})
              </span>
              <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                Subtotal avíos: {formatMoney(breakdown.notionsTotal, currency)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { label: "Hilo", value: threadCost, set: setThreadCost },
                { label: "Cierre", value: zipperCost, set: setZipperCost },
                { label: "Botones", value: buttonsCost, set: setButtonsCost },
                {
                  label: "Entretela",
                  value: interfacingCost,
                  set: setInterfacingCost,
                },
                { label: "Elástico", value: elasticCost, set: setElasticCost },
                {
                  label: "Encaje / Otros",
                  value: laceOtherCost,
                  set: setLaceOtherCost,
                },
              ].map((item) => (
                <div key={item.label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={item.value}
                    onChange={(e) => item.set(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF8F5] border border-slate-300 text-sm font-bold text-slate-900"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Time & Margins */}
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            3. Tu tiempo, gastos del taller y ganancia
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Horas corte / molde
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                value={cuttingHours}
                onChange={(e) => setCuttingHours(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Horas costura / plancha
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                value={sewingHours}
                onChange={(e) => setSewingHours(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Valor por hora ({currency})
              </label>
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-base font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-800">
                  Costos fijos y desgaste (luz, agujas, máquina)
                </span>
                <strong className="text-teal-700">{overheadPct}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={overheadPct}
                onChange={(e) => setOverheadPct(Number(e.target.value))}
                className="w-full h-3 accent-teal-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-800">
                  Margen de ganancia del taller
                </span>
                <strong className="text-rose-700">{profitPct}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={profitPct}
                onChange={(e) => setProfitPct(Number(e.target.value))}
                className="w-full h-3 accent-rose-600 cursor-pointer"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Right Summary Card */}
      <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
        <div className="rounded-3xl bg-white border-2 border-rose-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Resumen de tu cotización
              </h2>
              <p className="text-xs text-slate-500">
                {breakdown.totalHours} horas totales de trabajo estimado
              </p>
            </div>
          </div>

          {/* 3 key breakdown boxes */}
          <div className="space-y-2.5">
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Costo total de materiales
              </span>
              <strong className="text-base text-slate-900">
                {formatMoney(breakdown.totalMaterials, currency)}
              </strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Pago por tu mano de obra
              </span>
              <strong className="text-base text-teal-700">
                {formatMoney(breakdown.laborPay, currency)}
              </strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Reserva fija / desgaste ({overheadPct}%)
              </span>
              <strong className="text-base text-slate-700">
                {formatMoney(breakdown.overheadAmount, currency)}
              </strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-700" />
                Ganancia neta del taller ({profitPct}%)
              </span>
              <strong className="text-base text-emerald-800">
                {formatMoney(breakdown.workshopNetProfit, currency)}
              </strong>
            </div>
          </div>

          {/* Giant Final Client Price */}
          <div className="rounded-3xl bg-gradient-to-br from-rose-600 to-rose-700 text-white p-5 text-center space-y-1 shadow-md">
            <span className="block text-xs font-extrabold uppercase tracking-wider text-rose-100">
              Precio Final Sugerido al Cliente
            </span>
            <p className="text-3xl sm:text-4xl font-black tracking-tight">
              {formatMoney(breakdown.finalClientPrice, currency)}
            </p>
            <p className="text-xs text-rose-100 pt-1">
              Anticipo sugerido (50%):{" "}
              <strong className="text-white">
                {formatMoney(breakdown.suggestedDeposit, currency)}
              </strong>
            </p>
          </div>

          {/* WhatsApp / Copy Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full min-h-[52px] px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span>Enviar cotización por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyQuote}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FAF8F5] hover:bg-slate-100 text-slate-800 border border-slate-300 text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-teal-600" />
                  <span className="text-teal-700">
                    ¡Cotización copiada al portapapeles!
                  </span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copiar mensaje para el cliente</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1.5">
            <Scissors className="h-3.5 w-3.5 text-rose-600" />
            El mensaje para tu clienta oculta tus márgenes internos.
          </p>
        </div>
      </aside>
    </div>
  );
}
