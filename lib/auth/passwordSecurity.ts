export interface ResultadoFortalezaContrasena {
  valida: boolean;
  puntaje: 0 | 1 | 2 | 3 | 4;
  etiqueta: "Muy débil" | "Débil" | "Aceptable" | "Fuerte" | "Excelente";
  mensaje: string;
  esComun: boolean;
}

export interface ResultadoHIBP {
  filtrada: boolean;
  coincidencias: number;
  consultada: boolean;
}

const CONTRASENAS_COMUNES = new Set([
  "1234567890",
  "12345678901",
  "0123456789",
  "contrasena",
  "contrasena123",
  "password123",
  "password1234",
  "qwerty12345",
  "qwertyuiop",
  "modista123",
  "costura123",
  "moldefacil",
  "moldefacil123",
  "abcdef1234",
  "iloveyou12",
  "admin12345",
  "welcome123",
  "colombia123",
  "mexico1234",
]);

function esSecuencialORepetida(pass: string): boolean {
  const lower = pass.toLowerCase().trim();
  if (/^(.)\1{5,}$/.test(lower)) return true;
  if (
    "01234567890123456789".includes(lower) ||
    "98765432109876543210".includes(lower) ||
    "abcdefghijklmnopqrstuvwxyz".includes(lower)
  ) {
    return true;
  }
  return false;
}

/**
 * Evalúa contraseñas bajo reglas modernas: mínimo 10 caracteres,
 * sin exigir símbolos ni mayúsculas obligatorias, rechazando comunes o secuencias.
 */
export function evaluarFortalezaContrasena(
  contrasena: string
): ResultadoFortalezaContrasena {
  const limpia = contrasena.trim();
  const norm = limpia.toLowerCase();

  if (limpia.length < 10) {
    return {
      valida: false,
      puntaje: 0,
      etiqueta: "Muy débil",
      mensaje: "Usa al menos 10 caracteres. Una frase fácil de recordar funciona genial.",
      esComun: false,
    };
  }

  if (CONTRASENAS_COMUNES.has(norm) || esSecuencialORepetida(limpia)) {
    return {
      valida: false,
      puntaje: 1,
      etiqueta: "Débil",
      mensaje: "Esa contraseña es muy común, prueba con una frase más larga.",
      esComun: true,
    };
  }

  const caracteresUnicos = new Set(limpia).size;
  if (caracteresUnicos < 5) {
    return {
      valida: false,
      puntaje: 1,
      etiqueta: "Débil",
      mensaje: "Repite pocos caracteres distintos. Combina 3 o 4 palabras cotidianas.",
      esComun: false,
    };
  }

  let puntos = 2;
  if (limpia.length >= 14) puntos += 1;
  if (caracteresUnicos >= 8 || /\s/.test(limpia) || /\d/.test(limpia)) {
    puntos += 1;
  }

  const puntaje = Math.min(4, Math.max(2, puntos)) as 2 | 3 | 4;
  if (puntaje === 2) {
    return {
      valida: true,
      puntaje,
      etiqueta: "Aceptable",
      mensaje: "Cumple el mínimo seguro. Si añades otra palabra será aún más fuerte.",
      esComun: false,
    };
  }
  if (puntaje === 3) {
    return {
      valida: true,
      puntaje,
      etiqueta: "Fuerte",
      mensaje: "Buena contraseña, fácil de recordar en tu gestor y difícil de adivinar.",
      esComun: false,
    };
  }
  return {
    valida: true,
    puntaje: 4,
    etiqueta: "Excelente",
    mensaje: "Contraseña excelente y resistente a ataques automáticos.",
    esComun: false,
  };
}

async function sha1HexMayuscula(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
}

/**
 * Verifica si una contraseña aparece en filtraciones conocidas usando
 * la API de Have I Been Pwned por k-anonimato (solo envía los primeros 5 caracteres SHA-1).
 */
export async function verificarContrasenaFiltradaHIBP(
  contrasena: string,
  fetchFn: typeof fetch = fetch
): Promise<ResultadoHIBP> {
  try {
    const hash = await sha1HexMayuscula(contrasena);
    const prefijo = hash.slice(0, 5);
    const sufijo = hash.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetchFn(
      `https://api.pwnedpasswords.com/range/${prefijo}`,
      {
        method: "GET",
        headers: { "Add-Padding": "true" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!resp.ok) {
      return { filtrada: false, coincidencias: 0, consultada: false };
    }

    const cuerpo = await resp.text();
    const lineas = cuerpo.split(/\r?\n/);
    for (const ln of lineas) {
      const [candidatoSufijo, conteoStr] = ln.split(":");
      if (candidatoSufijo?.trim().toUpperCase() === sufijo) {
        const coincidencias = Number(conteoStr?.trim() ?? 0) || 1;
        return { filtrada: true, coincidencias, consultada: true };
      }
    }

    return { filtrada: false, coincidencias: 0, consultada: true };
  } catch {
    return { filtrada: false, coincidencias: 0, consultada: false };
  }
}