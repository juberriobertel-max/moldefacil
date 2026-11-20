export type MimeImagenPermitido = "image/jpeg" | "image/png" | "image/webp";

export interface ResultadoMagicBytes {
  valido: boolean;
  mime?: MimeImagenPermitido;
  motivo?: string;
}

export interface ResultadoVerificacionImagen {
  ok: boolean;
  mime?: MimeImagenPermitido;
  bytesLimpios?: Uint8Array;
  exifDetectadoPrevio?: boolean;
  error?: string;
}

export interface ResultadoProcesamientoCliente {
  dataUrl: string;
  ancho: number;
  alto: number;
  pesoBytes: number;
  hashPerceptual: string;
  exif_limpio: true;
}

const ASCII = (bytes: Uint8Array, start: number, len: number): string => {
  let out = "";
  const end = Math.min(bytes.length, start + len);
  for (let i = start; i < end; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
};

/**
 * Verifica la firma binaria real (magic bytes) del archivo, ignorando extensión y Content-Type del cliente.
 */
export function verificarMagicBytesImagen(
  bytes: Uint8Array
): ResultadoMagicBytes {
  if (!bytes || bytes.length < 12) {
    return { valido: false, motivo: "El archivo está vacío o truncado." };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valido: true, mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valido: true, mime: "image/png" };
  }

  // WebP: "RIFF" .... "WEBP"
  if (ASCII(bytes, 0, 4) === "RIFF" && ASCII(bytes, 8, 4) === "WEBP") {
    return { valido: true, mime: "image/webp" };
  }

  return {
    valido: false,
    motivo: "Formato binario no permitido. Solo se aceptan fotos JPEG, PNG o WebP reales.",
  };
}

/**
 * Detecta presencia de segmentos EXIF/GPS/XMP/IPTC en binarios JPEG, PNG o WebP.
 */
export function tieneMetadatosExif(bytes: Uint8Array): boolean {
  const magic = verificarMagicBytesImagen(bytes);
  if (!magic.valido) return false;

  if (magic.mime === "image/jpeg") {
    let pos = 2;
    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xff) break;
      while (pos < bytes.length && bytes[pos] === 0xff) pos++;
      if (pos >= bytes.length) break;
      const marker = bytes[pos];
      pos++;
      if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        continue;
      }
      if (pos + 1 >= bytes.length) break;
      const segLen = (bytes[pos] << 8) | bytes[pos + 1];
      if (
        marker === 0xe1 || // APP1 (EXIF / GPS / XMP)
        marker === 0xed || // APP13 (IPTC)
        marker === 0xfe // COM
      ) {
        return true;
      }
      if (segLen < 2) break;
      pos += segLen;
    }
    return false;
  }

  if (magic.mime === "image/png") {
    let pos = 8;
    while (pos + 8 <= bytes.length) {
      const len =
        ((bytes[pos] << 24) |
          (bytes[pos + 1] << 16) |
          (bytes[pos + 2] << 8) |
          bytes[pos + 3]) >>>
        0;
      const chunkType = ASCII(bytes, pos + 4, 4);
      if (chunkType === "eXIf" || chunkType === "tEXt" || chunkType === "iTXt") {
        return true;
      }
      pos += 12 + len;
    }
    return false;
  }

  if (magic.mime === "image/webp") {
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const fourcc = ASCII(bytes, pos, 4);
      const chunkSize =
        (bytes[pos + 4] |
          (bytes[pos + 5] << 8) |
          (bytes[pos + 6] << 16) |
          (bytes[pos + 7] << 24)) >>>
        0;
      if (fourcc === "EXIF" || fourcc === "XMP ") {
        return true;
      }
      pos += 8 + chunkSize + (chunkSize % 2);
    }
    return false;
  }

  return false;
}

/**
 * Elimina de forma binaria y determinista todos los segmentos APP1..APP15 (incluido EXIF/GPS/XMP)
 * y comentarios de un JPEG sin recodificar ni dañar los datos de imagen.
 */
export function eliminarExifJpegBinario(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes;
  }

  const partes: Uint8Array[] = [bytes.slice(0, 2)]; // SOI
  let pos = 2;

  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) {
      partes.push(bytes.slice(pos));
      break;
    }
    const markerStart = pos;
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    if (pos >= bytes.length) break;

    const marker = bytes[pos];
    pos++;

    if (marker === 0xda) {
      partes.push(bytes.slice(markerStart));
      break;
    }
    if (marker === 0xd9) {
      partes.push(bytes.slice(markerStart, pos));
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      partes.push(bytes.slice(markerStart, pos));
      continue;
    }

    if (pos + 1 >= bytes.length) break;
    const segLen = (bytes[pos] << 8) | bytes[pos + 1];
    const segEnd = Math.min(bytes.length, pos + segLen);

    const esMetadatoProhibido =
      (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!esMetadatoProhibido) {
      partes.push(bytes.slice(markerStart, segEnd));
    }

    if (segLen < 2) break;
    pos = segEnd;
  }

  const totalLen = partes.reduce((acc, p) => acc + p.length, 0);
  const limpio = new Uint8Array(totalLen);
  let cursor = 0;
  for (const p of partes) {
    limpio.set(p, cursor);
    cursor += p.length;
  }
  return limpio;
}

/**
 * Validación de archivo en servidor: verifica firma binaria real, tamaño máximo
 * y elimina metadatos EXIF/GPS antes de aceptar la imagen.
 */
export function verificarArchivoImagenBinario(
  bytes: Uint8Array,
  maxBytes = 2 * 1024 * 1024
): ResultadoVerificacionImagen {
  if (!bytes || bytes.length === 0) {
    return { ok: false, error: "El archivo enviado está vacío." };
  }
  if (bytes.length > maxBytes) {
    return {
      ok: false,
      error: `La imagen supera el límite permitido de ${Math.round(maxBytes / 1024)} KB.`,
    };
  }

  const magic = verificarMagicBytesImagen(bytes);
  if (!magic.valido || !magic.mime) {
    return { ok: false, error: magic.motivo ?? "Archivo inválido." };
  }

  const teniaExif = tieneMetadatosExif(bytes);
  let bytesLimpios = bytes;
  if (teniaExif) {
    if (magic.mime === "image/jpeg") {
      bytesLimpios = eliminarExifJpegBinario(bytes);
    } else {
      return {
        ok: false,
        error:
          "La imagen aún contiene metadatos EXIF/GPS. Reprocésala desde la app para limpiar metadatos.",
      };
    }
  }

  if (tieneMetadatosExif(bytesLimpios)) {
    return {
      ok: false,
      error: "No se pudieron depurar completamente los metadatos EXIF de la imagen.",
    };
  }

  return {
    ok: true,
    mime: magic.mime,
    bytesLimpios,
    exifDetectadoPrevio: teniaExif,
  };
}

/**
 * Calcula un hash perceptual dHash de 64 bits (16 dígitos hex) a partir de
 * 72 muestras de luminancia (grid 9 columnas × 8 filas) para detectar fotos duplicadas.
 */
export function calcularHashPerceptual64(muestrasGris72: readonly number[]): string {
  if (muestrasGris72.length < 72) {
    return "0000000000000000";
  }
  let hex = "";
  let nibble = 0;
  let bitIdx = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const idx = y * 9 + x;
      const bit = muestrasGris72[idx] > muestrasGris72[idx + 1] ? 1 : 0;
      nibble = (nibble << 1) | bit;
      bitIdx++;
      if (bitIdx === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bitIdx = 0;
      }
    }
  }
  return hex.padEnd(16, "0");
}

export function distanciaHammingHash(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const va = parseInt(a[i], 16);
    const vb = parseInt(b[i], 16);
    if (Number.isNaN(va) || Number.isNaN(vb)) return 64;
    let xor = va ^ vb;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Sugiere automáticamente un texto alternativo (`alt`) accesible en español
 * basado en prenda y tela.
 */
export function sugerirTextoAlternativo(params: {
  prenda: string;
  tela: string;
  titulo?: string;
  autoraNombre?: string;
}): string {
  const prenda = params.prenda.trim() || "prenda";
  const tela = params.tela.trim() || "tela de taller";
  const titulo = params.titulo?.trim();
  if (titulo) {
    return `${prenda} confeccionada en ${tela}: ${titulo}`.slice(0, 180);
  }
  return `Prenda terminada (${prenda}) confeccionada en ${tela} sobre maniquí o persona`.slice(
    0,
    180
  );
}

/**
 * Procesa una imagen en el navegador mediante `<canvas>`:
 * - Recorte superior opcional del 22 % para fotos sin rostro.
 * - Redimensionamiento a lado largo máximo `1600 px`.
 * - Compresión objetivo `<= 400 KB` en WebP/JPEG (lo cual elimina el 100 % de EXIF/GPS).
 * - Marca de agua opcional discreta en la esquina inferior.
 */
export async function procesarImagenClienteSinExif(
  origen: File | string,
  opciones: {
    maxLadoPx?: number;
    maxBytes?: number;
    recortarRostroSuperior?: boolean;
    marcaAguaTexto?: string;
  } = {}
): Promise<ResultadoProcesamientoCliente> {
  const maxLadoPx = opciones.maxLadoPx ?? 1600;
  const maxBytes = opciones.maxBytes ?? 400 * 1024;

  const dataUrlEntrada =
    typeof origen === "string"
      ? origen
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
          reader.readAsDataURL(origen);
        });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("La imagen no es válida o está dañada."));
    el.src = dataUrlEntrada;
  });

  const srcY = opciones.recortarRostroSuperior
    ? Math.round(img.naturalHeight * 0.22)
    : 0;
  const srcH = Math.max(100, img.naturalHeight - srcY);
  const srcW = Math.max(100, img.naturalWidth);

  const escala = Math.min(1, maxLadoPx / Math.max(srcW, srcH));
  const ancho = Math.max(100, Math.round(srcW * escala));
  const alto = Math.max(100, Math.round(srcH * escala));

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Tu navegador no pudo procesar el lienzo de la imagen.");
  }

  ctx.drawImage(img, 0, srcY, srcW, srcH, 0, 0, ancho, alto);

  if (opciones.marcaAguaTexto && opciones.marcaAguaTexto.trim().length > 0) {
    const texto = opciones.marcaAguaTexto.trim().slice(0, 48);
    ctx.save();
    ctx.font = `600 ${Math.max(14, Math.round(ancho * 0.022))}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(45, 42, 38, 0.55)";
    ctx.fillRect(
      Math.max(0, ancho - ctx.measureText(texto).width - 28),
      alto - 34,
      ctx.measureText(texto).width + 20,
      26
    );
    ctx.fillStyle = "rgba(250, 246, 240, 0.96)";
    ctx.fillText(texto, ancho - 16, alto - 14);
    ctx.restore();
  }

  const miniCanvas = document.createElement("canvas");
  miniCanvas.width = 9;
  miniCanvas.height = 8;
  const mCtx = miniCanvas.getContext("2d");
  const muestras: number[] = [];
  if (mCtx) {
    mCtx.drawImage(canvas, 0, 0, 9, 8);
    const data = mCtx.getImageData(0, 0, 9, 8).data;
    for (let i = 0; i < data.length; i += 4) {
      muestras.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
  }
  const hashPerceptual = calcularHashPerceptual64(muestras);

  let mejorDataUrl = canvas.toDataURL("image/webp", 0.84);
  if (!mejorDataUrl.startsWith("data:image/webp")) {
    mejorDataUrl = canvas.toDataURL("image/jpeg", 0.84);
  }
  for (const calidad of [0.76, 0.68, 0.58, 0.48]) {
    const pesoEst = Math.round((mejorDataUrl.length * 3) / 4);
    if (pesoEst <= maxBytes) break;
    const fmt = mejorDataUrl.startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
    mejorDataUrl = canvas.toDataURL(fmt, calidad);
  }

  const base64Part = mejorDataUrl.split(",")[1] ?? "";
  const pesoBytes = Math.round((base64Part.length * 3) / 4);

  return {
    dataUrl: mejorDataUrl,
    ancho,
    alto,
    pesoBytes,
    hashPerceptual,
    exif_limpio: true,
  };
}