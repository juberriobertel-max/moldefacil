import { NextResponse } from "next/server";
import { z } from "zod";
import { verificarArchivoImagenBinario } from "@/lib/community/imageSecurity";

const ValidarImagenSchema = z.object({
  base64Data: z.string().min(16, "Imagen vacía."),
  nombreArchivo: z.string().max(160).optional(),
});

/**
 * Valida una imagen en el servidor revisando firma binaria real (magic bytes),
 * peso máximo y ausencia total de metadatos EXIF/GPS.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = ValidarImagenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
        { status: 400 }
      );
    }

    const limpioBase64 = parsed.data.base64Data.includes(",")
      ? parsed.data.base64Data.split(",")[1] ?? ""
      : parsed.data.base64Data;

    const bytes = new Uint8Array(Buffer.from(limpioBase64, "base64"));
    const verificacion = verificarArchivoImagenBinario(bytes, 2 * 1024 * 1024);

    if (!verificacion.ok || !verificacion.bytesLimpios) {
      return NextResponse.json(
        { ok: false, error: verificacion.error ?? "Archivo rechazado por seguridad." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      mime: verificacion.mime,
      exif_limpio: true,
      exifDetectadoPrevio: Boolean(verificacion.exifDetectadoPrevio),
      bytesLength: verificacion.bytesLimpios.byteLength,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo procesar la verificación de imagen." },
      { status: 400 }
    );
  }
}