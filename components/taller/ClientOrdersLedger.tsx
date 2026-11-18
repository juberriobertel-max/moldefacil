"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Plus,
  Ruler,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  ClientOrder,
  ClientOrderStatus,
  DEFAULT_PROFILE_MEASUREMENTS,
  deleteClientOrder,
  deleteMeasurementProfile,
  getClientOrdersServerSnapshot,
  getMeasurementProfilesServerSnapshot,
  loadClientOrders,
  loadMeasurementProfiles,
  subscribeWorkshopStorage,
  upsertClientOrder,
  upsertMeasurementProfile,
} from "@/lib/savedMeasurements";
import { Measurements } from "@/lib/types";

const ORDER_STATUSES: ClientOrderStatus[] = [
  "En proceso",
  "Lista para prueba",
  "Entregada",
];

const STATUS_BADGE_CLASS: Record<ClientOrderStatus, string> = {
  "En proceso": "bg-amber-50 text-amber-800 border-amber-200",
  "Lista para prueba": "bg-rose-50 text-rose-800 border-rose-200",
  Entregada: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function formatCurrency(val: number): string {
  return `$ ${Math.round(val).toLocaleString("es-CO")}`;
}

const emptySubscribe = () => () => {};

export default function ClientOrdersLedger() {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [statusFilter, setStatusFilter] = useState<"Todos" | ClientOrderStatus>(
    "Todos"
  );

  const orders = useSyncExternalStore(
    subscribeWorkshopStorage,
    loadClientOrders,
    getClientOrdersServerSnapshot
  );
  const profiles = useSyncExternalStore(
    subscribeWorkshopStorage,
    loadMeasurementProfiles,
    getMeasurementProfilesServerSnapshot
  );

  // New Order Form State
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [garmentDescription, setGarmentDescription] = useState("");
  const [fabricNotes, setFabricNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [totalPrice, setTotalPrice] = useState<string>("120000");
  const [depositPaid, setDepositPaid] = useState<string>("60000");
  const [status, setStatus] = useState<ClientOrderStatus>("En proceso");

  // Quick New Measurement Profile modal/inline panel
  const [showQuickProfile, setShowQuickProfile] = useState(false);
  const [quickMeasurements, setQuickMeasurements] = useState<Measurements>(
    DEFAULT_PROFILE_MEASUREMENTS
  );

  const summary = useMemo(() => {
    const active = orders.filter((o) => o.status !== "Entregada");
    const readyFitting = orders.filter(
      (o) => o.status === "Lista para prueba"
    ).length;
    const pendingBalance = orders.reduce(
      (acc, o) => acc + Math.max(0, o.totalPrice - o.depositPaid),
      0
    );
    return {
      activeCount: active.length,
      readyFitting,
      pendingBalance,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "Todos") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const handleSaveQuickProfile = () => {
    const name = clientName.trim() || "Clienta sin nombre";
    const nextProfiles = upsertMeasurementProfile({
      clientName: name,
      phone,
      measurements: quickMeasurements,
    });
    if (nextProfiles[0]) {
      setSelectedProfileId(nextProfiles[0].id);
    }
    setShowQuickProfile(false);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !garmentDescription.trim()) return;

    let profileIdToUse = selectedProfileId || undefined;
    if (showQuickProfile && !profileIdToUse) {
      const nextProfiles = upsertMeasurementProfile({
        clientName: clientName.trim(),
        phone,
        measurements: quickMeasurements,
      });
      profileIdToUse = nextProfiles[0]?.id;
    }

    upsertClientOrder({
      clientName,
      phone,
      profileId: profileIdToUse,
      garmentDescription,
      fabricNotes,
      deliveryDate,
      totalPrice: Number(totalPrice) || 0,
      depositPaid: Number(depositPaid) || 0,
      status,
    });

    // Reset order fields
    setClientName("");
    setPhone("");
    setSelectedProfileId("");
    setGarmentDescription("");
    setFabricNotes("");
    setDeliveryDate("");
    setTotalPrice("120000");
    setDepositPaid("60000");
    setStatus("En proceso");
    setShowQuickProfile(false);
  };

  const handleChangeOrderStatus = (
    order: ClientOrder,
    nextStatus: ClientOrderStatus
  ) => {
    upsertClientOrder({
      ...order,
      status: nextStatus,
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteClientOrder(orderId);
  };

  const handleDeleteProfile = (profileId: string) => {
    deleteMeasurementProfile(profileId);
    if (selectedProfileId === profileId) {
      setSelectedProfileId("");
    }
  };

  const handleSendReminderWhatsApp = (order: ClientOrder) => {
    const pending = Math.max(0, order.totalPrice - order.depositPaid);
    const cleanPhone = (order.phone || "").replace(/[^0-9]/g, "");
    const statusLine =
      order.status === "Lista para prueba"
        ? `Tu prenda (*${order.garmentDescription}*) ya está *lista para prueba* en el taller 😊`
        : order.status === "Entregada"
          ? `Gracias por confiar en el taller para tu prenda (*${order.garmentDescription}*). ¡Que la disfrutes!`
          : `Te recuerdo el seguimiento de tu prenda (*${order.garmentDescription}*)${
              order.deliveryDate ? ` con entrega estimada para el ${order.deliveryDate}` : ""
            }.`;

    const balanceLine =
      pending > 0
        ? `\n💳 Saldo pendiente al entregar: ${formatCurrency(pending)}`
        : "\n✅ Pago completado en su totalidad.";

    const message = `Hola ${order.clientName} 👋\n${statusLine}${balanceLine}\n¿A qué hora te queda bien pasar por el taller? ✂️🧵`;
    const base = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=`
      : `https://wa.me/?text=`;
    window.open(
      `${base}${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
          <span className="block text-xs font-bold text-slate-500">
            Encargos activos
          </span>
          <strong className="text-2xl font-black text-slate-900">
            {summary.activeCount}
          </strong>
        </div>
        <div className="rounded-2xl bg-white border border-rose-200 p-4 shadow-xs">
          <span className="block text-xs font-bold text-rose-700">
            Listas para prueba
          </span>
          <strong className="text-2xl font-black text-rose-600">
            {summary.readyFitting}
          </strong>
        </div>
        <div className="rounded-2xl bg-white border border-teal-200 p-4 shadow-xs">
          <span className="block text-xs font-bold text-teal-700">
            Saldo total por cobrar
          </span>
          <strong className="text-2xl font-black text-teal-700">
            {formatCurrency(summary.pendingBalance)}
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Register New Order Form */}
        <form
          onSubmit={handleCreateOrder}
          className="lg:col-span-5 rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Registrar nuevo encargo
              </h2>
              <p className="text-xs text-slate-500">
                Se guarda automáticamente en tu dispositivo (sin internet).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Nombre de la clienta *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Laura Gómez"
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm sm:text-base text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                WhatsApp (opcional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 573001234567"
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm sm:text-base text-slate-900"
              />
            </div>
          </div>

          {/* Measurement Profile Link / Quick Create */}
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 text-teal-600" />
                Perfil de medidas vinculado
              </label>
              <button
                type="button"
                onClick={() => setShowQuickProfile((v) => !v)}
                className="text-xs font-extrabold text-rose-700 hover:text-rose-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>
                  {showQuickProfile ? "Cerrar ficha rápida" : "Crear perfil rápido"}
                </span>
              </button>
            </div>

            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-800"
            >
              <option value="">Sin perfil de medidas asignado</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} (Busto {p.measurements.bust} • Cintura{" "}
                  {p.measurements.waist} • Cadera {p.measurements.hip} cm)
                </option>
              ))}
            </select>

            {showQuickProfile && (
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "bust", label: "Busto (cm)" },
                    { key: "waist", label: "Cintura (cm)" },
                    { key: "hip", label: "Cadera (cm)" },
                    { key: "skirtLength", label: "Largo (cm)" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-bold text-slate-600">
                        {field.label}
                      </label>
                      <input
                        type="number"
                        value={
                          quickMeasurements[field.key as keyof Measurements] ?? 0
                        }
                        onChange={(e) =>
                          setQuickMeasurements((prev) => ({
                            ...prev,
                            [field.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSaveQuickProfile}
                  className="w-full min-h-[42px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  Guardar medidas de esta clienta
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Prenda a confeccionar *
            </label>
            <input
              type="text"
              required
              value={garmentDescription}
              onChange={(e) => setGarmentDescription(e.target.value)}
              placeholder="Ej. Vestido cruzado midi escote V"
              className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm sm:text-base text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Detalles de tela / color
              </label>
              <input
                type="text"
                value={fabricNotes}
                onChange={(e) => setFabricNotes(e.target.value)}
                placeholder="Ej. Lino beige 2.5 m"
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Fecha de entrega
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Precio total ($)
              </label>
              <input
                type="number"
                min={0}
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Abono recibido ($)
              </label>
              <input
                type="number"
                min={0}
                value={depositPaid}
                onChange={(e) => setDepositPaid(e.target.value)}
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#FAF8F5] border border-slate-300 text-sm font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between text-sm">
            <span className="font-bold text-teal-900">Saldo pendiente automático:</span>
            <strong className="text-base text-teal-800">
              {formatCurrency(
                Math.max(
                  0,
                  (Number(totalPrice) || 0) - (Number(depositPaid) || 0)
                )
              )}
            </strong>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Estado inicial
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ORDER_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    status === st
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-[#FAF8F5] text-slate-700 border-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-extrabold shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            <span>Guardar encargo en mi libreta</span>
          </button>
        </form>

        {/* Right: Orders List + Saved Client Profiles */}
        <div className="lg:col-span-7 space-y-5">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(["Todos", ...ORDER_STATUSES] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`min-h-[42px] px-4 py-1.5 rounded-2xl text-sm font-bold border transition cursor-pointer ${
                  statusFilter === tab
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {!hydrated ? (
            <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">
              Cargando libreta del taller...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-teal-600 mx-auto" />
              <h3 className="text-lg font-extrabold text-slate-900">
                Aún no tienes encargos en esta vista
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Registra tu primer pedido en el formulario de la izquierda para controlar abonos, saldos pendientes, medidas y envíos por WhatsApp.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const pending = Math.max(
                  0,
                  order.totalPrice - order.depositPaid
                );
                const linkedProfile = profiles.find(
                  (p) => p.id === order.profileId
                );

                return (
                  <article
                    key={order.id}
                    className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {order.clientName}
                        </h3>
                        <p className="text-sm font-bold text-rose-700">
                          {order.garmentDescription}
                        </p>
                        {order.fabricNotes && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Tela / Notas: {order.fabricNotes}
                          </p>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                          STATUS_BADGE_CLASS[order.status]
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    {linkedProfile && (
                      <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-700">
                          Medidas ({linkedProfile.clientName}): Busto{" "}
                          {linkedProfile.measurements.bust} • Cintura{" "}
                          {linkedProfile.measurements.waist} • Cadera{" "}
                          {linkedProfile.measurements.hip} cm
                        </span>
                        <Link
                          href={`/?bust=${linkedProfile.measurements.bust}&waist=${linkedProfile.measurements.waist}&hip=${linkedProfile.measurements.hip}`}
                          className="font-extrabold text-rose-700 hover:text-rose-800 inline-flex items-center gap-1"
                        >
                          <span>Abrir en Generador</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}

                    {/* Money + Date grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="block text-slate-500 text-[11px]">
                          Total
                        </span>
                        <strong className="text-slate-900">
                          {formatCurrency(order.totalPrice)}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="block text-slate-500 text-[11px]">
                          Abonado
                        </span>
                        <strong className="text-emerald-700">
                          {formatCurrency(order.depositPaid)}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                        <span className="block text-teal-800 text-[11px]">
                          Saldo
                        </span>
                        <strong className="text-teal-900">
                          {formatCurrency(pending)}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="block text-slate-500 text-[11px] flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Entrega
                        </span>
                        <strong className="text-slate-900">
                          {order.deliveryDate || "Sin fecha"}
                        </strong>
                      </div>
                    </div>

                    {/* Quick Status Switcher + WhatsApp + Delete */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {ORDER_STATUSES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleChangeOrderStatus(order, st)}
                            className={`min-h-[38px] px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              order.status === st
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-[#FAF8F5] text-slate-600 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendReminderWhatsApp(order)}
                          className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <MessageCircle className="h-4 w-4 shrink-0" />
                          <span>Recordatorio WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          aria-label={`Eliminar encargo de ${order.clientName}`}
                          className="min-h-[42px] w-[42px] rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 flex items-center justify-center transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Saved Measurement Profiles Summary */}
          {profiles.length > 0 && (
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Perfiles de medidas guardados ({profiles.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {profiles.map((prof) => (
                  <div
                    key={prof.id}
                    className="p-3 rounded-2xl bg-[#FAF8F5] border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-extrabold text-slate-900 truncate">
                        {prof.clientName}
                      </span>
                      <span className="block text-xs text-slate-600">
                        B {prof.measurements.bust} • C{" "}
                        {prof.measurements.waist} • Cad{" "}
                        {prof.measurements.hip} cm
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProfile(prof.id)}
                      aria-label={`Eliminar perfil de ${prof.clientName}`}
                      className="min-h-[38px] w-[38px] rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
