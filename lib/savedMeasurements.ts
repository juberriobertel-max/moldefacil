import { Measurements, PatternResult } from "./types";
import { CurrencyCode } from "./currency";

export const PROFILES_STORAGE_KEY = "moldefacil_perfiles_medidas";
export const ORDERS_STORAGE_KEY = "moldefacil_pedidos_taller";
export const LAST_PATTERN_STORAGE_KEY = "moldefacil_ultimo_patron";

export interface SavedMeasurementProfile {
  id: string;
  clientName: string;
  phone?: string;
  notes?: string;
  measurements: Measurements;
  updatedAt: string;
}

export type ClientOrderStatus =
  | "En proceso"
  | "Lista para prueba"
  | "Entregada";

export interface ClientOrder {
  id: string;
  clientName: string;
  phone?: string;
  profileId?: string;
  garmentDescription: string;
  fabricNotes: string;
  deliveryDate: string;
  totalPrice: number;
  depositPaid: number;
  currency?: CurrencyCode;
  status: ClientOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PROFILE_MEASUREMENTS: Measurements = {
  bust: 92,
  waist: 72,
  hip: 98,
  backWidth: 37,
  bodiceLength: 42,
  sleeveLength: 58,
  skirtLength: 58,
  crotchDepth: 27,
  thigh: 58,
  inseam: 76,
  hemWidth: 38,
  headCircumference: 57,
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const storageListeners = new Set<() => void>();

export function subscribeWorkshopStorage(listener: () => void): () => void {
  storageListeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    storageListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

function notifyWorkshopStorage(): void {
  storageListeners.forEach((listener) => listener());
}

const EMPTY_PROFILES: SavedMeasurementProfile[] = [];
const EMPTY_ORDERS: ClientOrder[] = [];

let cachedProfilesRaw: string | null = null;
let cachedProfilesVal: SavedMeasurementProfile[] = EMPTY_PROFILES;

let cachedOrdersRaw: string | null = null;
let cachedOrdersVal: ClientOrder[] = EMPTY_ORDERS;

let cachedPatternRaw: string | null = null;
let cachedPatternVal: StoredPatternSnapshot | null = null;

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createLocalId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function getMeasurementProfilesServerSnapshot(): SavedMeasurementProfile[] {
  return EMPTY_PROFILES;
}

export function loadMeasurementProfiles(): SavedMeasurementProfile[] {
  if (!canUseStorage()) return EMPTY_PROFILES;
  const raw = window.localStorage.getItem(PROFILES_STORAGE_KEY);
  if (raw === cachedProfilesRaw) return cachedProfilesVal;
  cachedProfilesRaw = raw;
  const parsed = safeParseJson<SavedMeasurementProfile[]>(raw, EMPTY_PROFILES);
  cachedProfilesVal = Array.isArray(parsed) ? parsed : EMPTY_PROFILES;
  return cachedProfilesVal;
}

export function saveMeasurementProfiles(
  profiles: SavedMeasurementProfile[]
): void {
  if (!canUseStorage()) return;
  const serialized = JSON.stringify(profiles);
  cachedProfilesRaw = serialized;
  cachedProfilesVal = profiles;
  window.localStorage.setItem(PROFILES_STORAGE_KEY, serialized);
  notifyWorkshopStorage();
}

export function upsertMeasurementProfile(
  profile: Omit<SavedMeasurementProfile, "id" | "updatedAt"> & { id?: string }
): SavedMeasurementProfile[] {
  const current = loadMeasurementProfiles();
  const now = new Date().toISOString();
  const id = profile.id || createLocalId("perfil");
  const nextItem: SavedMeasurementProfile = {
    id,
    clientName: profile.clientName.trim(),
    phone: profile.phone?.trim() || undefined,
    notes: profile.notes?.trim() || undefined,
    measurements: { ...DEFAULT_PROFILE_MEASUREMENTS, ...profile.measurements },
    updatedAt: now,
  };

  const existsIdx = current.findIndex((p) => p.id === id);
  const updated =
    existsIdx >= 0
      ? current.map((p, idx) => (idx === existsIdx ? nextItem : p))
      : [nextItem, ...current];

  saveMeasurementProfiles(updated);
  return updated;
}

export function deleteMeasurementProfile(
  profileId: string
): SavedMeasurementProfile[] {
  const updated = loadMeasurementProfiles().filter((p) => p.id !== profileId);
  saveMeasurementProfiles(updated);
  return updated;
}

export function getClientOrdersServerSnapshot(): ClientOrder[] {
  return EMPTY_ORDERS;
}

export function loadClientOrders(): ClientOrder[] {
  if (!canUseStorage()) return EMPTY_ORDERS;
  const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
  if (raw === cachedOrdersRaw) return cachedOrdersVal;
  cachedOrdersRaw = raw;
  const parsed = safeParseJson<ClientOrder[]>(raw, EMPTY_ORDERS);
  cachedOrdersVal = Array.isArray(parsed) ? parsed : EMPTY_ORDERS;
  return cachedOrdersVal;
}

export function saveClientOrders(orders: ClientOrder[]): void {
  if (!canUseStorage()) return;
  const serialized = JSON.stringify(orders);
  cachedOrdersRaw = serialized;
  cachedOrdersVal = orders;
  window.localStorage.setItem(ORDERS_STORAGE_KEY, serialized);
  notifyWorkshopStorage();
}

export function upsertClientOrder(
  order: Omit<ClientOrder, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
  }
): ClientOrder[] {
  const current = loadClientOrders();
  const now = new Date().toISOString();
  const id = order.id || createLocalId("pedido");
  const existing = current.find((o) => o.id === id);

  const nextOrder: ClientOrder = {
    id,
    clientName: order.clientName.trim(),
    phone: order.phone?.trim() || undefined,
    profileId: order.profileId || undefined,
    garmentDescription: order.garmentDescription.trim(),
    fabricNotes: order.fabricNotes.trim(),
    deliveryDate: order.deliveryDate,
    totalPrice: Math.max(0, Number(order.totalPrice) || 0),
    depositPaid: Math.max(0, Number(order.depositPaid) || 0),
    currency: order.currency || existing?.currency,
    status: order.status,
    createdAt: existing?.createdAt || order.createdAt || now,
    updatedAt: now,
  };

  const updated = existing
    ? current.map((o) => (o.id === id ? nextOrder : o))
    : [nextOrder, ...current];

  saveClientOrders(updated);
  return updated;
}

export function deleteClientOrder(orderId: string): ClientOrder[] {
  const updated = loadClientOrders().filter((o) => o.id !== orderId);
  saveClientOrders(updated);
  return updated;
}

export interface StoredPatternSnapshot {
  savedAt: string;
  pattern: PatternResult;
}

export function saveLastGeneratedPattern(pattern: PatternResult): void {
  if (!canUseStorage()) return;
  const payload: StoredPatternSnapshot = {
    savedAt: new Date().toISOString(),
    pattern,
  };
  try {
    const serialized = JSON.stringify(payload);
    cachedPatternRaw = serialized;
    cachedPatternVal = payload;
    window.localStorage.setItem(LAST_PATTERN_STORAGE_KEY, serialized);
    notifyWorkshopStorage();
  } catch {
    // Ignoramos si el almacenamiento local está lleno
  }
}

export function getLastPatternServerSnapshot(): StoredPatternSnapshot | null {
  return null;
}

export function loadLastGeneratedPattern(): StoredPatternSnapshot | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(LAST_PATTERN_STORAGE_KEY);
  if (raw === cachedPatternRaw) return cachedPatternVal;
  cachedPatternRaw = raw;
  const parsed = safeParseJson<StoredPatternSnapshot | null>(raw, null);
  if (!parsed || !parsed.pattern || !Array.isArray(parsed.pattern.pieces)) {
    cachedPatternVal = null;
    return null;
  }
  cachedPatternVal = parsed;
  return cachedPatternVal;
}
