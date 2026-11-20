/**
 * Cola diferida en IndexedDB para Fase 16 (Offline-first / Baja conectividad):
 * Permite redactar dudas, bitácoras y borradores sin conexión y reintentar
 * automáticamente al volver la red o al reabrir la app (soporte iOS Safari sin Background Sync).
 */

export interface ElementoColaOffline {
  id: string;
  idempotencyKey: string;
  tipo: "pregunta" | "bitacora" | "calce";
  titulo: string;
  payload: Record<string, unknown>;
  estado: "pendiente" | "enviando" | "enviada" | "error";
  intentos: number;
  errorUltimo?: string;
  creadoEn: string;
}

const DB_NAME = "moldefacil_offline_v1";
const STORE_NAME = "cola_pendientes";
const FALLBACK_KEY = "moldefacil_cola_offline_fallback_v1";

function abrirDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function leerFallbackLocal(): ElementoColaOffline[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as ElementoColaOffline[]) : [];
  } catch {
    return [];
  }
}

function guardarFallbackLocal(items: ElementoColaOffline[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // Sin espacio disponible
  }
}

export async function listarColaOffline(): Promise<ElementoColaOffline[]> {
  const db = await abrirDb();
  if (!db) return leerFallbackLocal();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(((req.result as ElementoColaOffline[]) ?? []).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)));
    req.onerror = () => resolve(leerFallbackLocal());
  });
}

export async function encolarOperacionOffline(
  tipo: ElementoColaOffline["tipo"],
  titulo: string,
  payload: Record<string, unknown>,
  idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
): Promise<ElementoColaOffline> {
  const actual = await listarColaOffline();
  const yaExiste = actual.find((e) => e.idempotencyKey === idempotencyKey);
  if (yaExiste) return yaExiste;

  const nuevo: ElementoColaOffline = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    idempotencyKey,
    tipo,
    titulo,
    payload,
    estado: "pendiente",
    intentos: 0,
    creadoEn: new Date().toISOString(),
  };

  const db = await abrirDb();
  if (!db) {
    guardarFallbackLocal([...actual, nuevo]);
    return nuevo;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(nuevo);
    tx.oncomplete = () => resolve(nuevo);
    tx.onerror = () => {
      guardarFallbackLocal([...actual, nuevo]);
      resolve(nuevo);
    };
  });
}

export async function actualizarElementoCola(
  item: ElementoColaOffline
): Promise<void> {
  const db = await abrirDb();
  if (!db) {
    const prev = leerFallbackLocal();
    guardarFallbackLocal(prev.map((x) => (x.id === item.id ? item : x)));
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function limpiarEnviadosDeCola(): Promise<void> {
  const items = await listarColaOffline();
  const pendientes = items.filter((i) => i.estado !== "enviada");
  const db = await abrirDb();
  if (!db) {
    guardarFallbackLocal(pendientes);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const p of pendientes) store.put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * Procesa los borradores pendientes de forma idempotente (nunca duplica un mismo idempotencyKey).
 */
export async function sincronizarColaOffline(
  ejecutor: (item: ElementoColaOffline) => Promise<{ ok: boolean; error?: string }>
): Promise<{ enviadas: number; errores: number }> {
  const items = await listarColaOffline();
  let enviadas = 0;
  let errores = 0;

  for (const item of items) {
    if (item.estado === "enviada" || item.estado === "enviando") continue;
    await actualizarElementoCola({ ...item, estado: "enviando" });
    try {
      const res = await ejecutor(item);
      if (res.ok) {
        enviadas++;
        await actualizarElementoCola({
          ...item,
          estado: "enviada",
          intentos: item.intentos + 1,
          errorUltimo: undefined,
        });
      } else {
        errores++;
        await actualizarElementoCola({
          ...item,
          estado: "error",
          intentos: item.intentos + 1,
          errorUltimo: res.error ?? "No se pudo sincronizar.",
        });
      }
    } catch {
      errores++;
      await actualizarElementoCola({
        ...item,
        estado: "error",
        intentos: item.intentos + 1,
        errorUltimo: "Sin conexión estable.",
      });
    }
  }

  return { enviadas, errores };
}