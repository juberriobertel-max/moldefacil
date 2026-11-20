"use client";

import React, { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  crearPublicacionComunidad,
  type EstadoComunidad,
  obtenerActorActivo,
} from "@/lib/community/communityStore";
import { RETO_MENSUAL_DEMO } from "@/lib/community/demoSeed";
import {
  procesarImagenClienteSinExif,
  sugerirTextoAlternativo,
} from "@/lib/community/imageSecurity";
import type { BorradorCompartirCreacion } from "@/lib/community/patternBridge";
import { construirConfigMoldeDesdeGenerador } from "@/lib/community/patternBridge";
import { DEFAULT_GARMENT_EXTRAS } from "@/lib/types";

interface FotoDraft {
  id: string;
  url: string;
  alt: string;
  ancho: number;
  alto: number;
  pesoKb: number;
  hash_perceptual?: string;
  exif_limpio: true;
  verificadaServidor: boolean;
}

const CONFIG_POR_DEFECTO = construirConfigMoldeDesdeGenerador({
  category: "dress",
  topSubStyle: "blouse",
  pantsSubStyle: "straight",
  skirtSubStyle: "a_line",
  dressSubStyle: "dress",
  twoPieceTopStyle: "crop_top",
  twoPieceBottomStyle: "aline_skirt",
  jumpsuitSubStyle: "romper_long",
  kidsSubStyle: "baby_bodysuit",
  loungewearSubStyle: "leggings",
  accessorySubStyle: "bucket_hat",
  necklineStyle: "round",
  sleeveStyle: "short",
  torsoFit: "fitted",
  seamAllowance: 1,
  fabricType: "woven",
  extras: { ...DEFAULT_GARMENT_EXTRAS },
  quickLength: "photo",
  styleVariant: "default",
  apariencia3D: {
    tela: "crepe",
    color: "#C85A32",
    estampado: "liso",
    mostrarCosturas: false,
  },
});

export default function PublishCreationModal({
  abierto,
  alCerrar,
  estado,
  borrador,
  onPublicacionCreada,
}: {
  abierto: boolean;
  alCerrar: () => void;
  estado: EstadoComunidad;
  borrador: BorradorCompartirCreacion | null;
  onPublicacionCreada: (
    siguienteEstado: EstadoComunidad,
    idCreado: string,
    enRevision: boolean
  ) => void;
}) {
  const actor = obtenerActorActivo(estado);
  const perfilActivo = estado.perfiles.find((p) => p.id === actor?.id);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [fotos, setFotos] = useState<FotoDraft[]>([]);
  const [recortarRostro, setRecortarRostro] = useState<boolean>(false);
  const [usarMarcaAgua, setUsarMarcaAgua] = useState<boolean>(true);
  const [procesandoFoto, setProcesandoFoto] = useState<boolean>(false);

  const [titulo, setTitulo] = useState<string>(
    borrador?.tituloSugerido ?? ""
  );
  const [tipoPublicacion, setTipoPublicacion] = useState<
    "molde_plataforma" | "moda_real"
  >("molde_plataforma");
  const [referenciaInspiracion, setReferenciaInspiracion] = useState<string>("");
  const [prenda, setPrenda] = useState<string>(
    borrador?.prendaLabel ?? "Vestido"
  );
  const [tela, setTela] = useState<string>(
    borrador?.telaLabel ?? "Lino / Gabardina"
  );
  const [dificultad, setDificultad] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [tiempoHoras, setTiempoHoras] = useState<string>("4.5");
  const [costoAprox, setCostoAprox] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
  const [aprendizajeNota, setAprendizajeNota] = useState<string>("");
  const [unirseReto, setUnirseReto] = useState<boolean>(false);
  const [permisoConfirmado, setPermisoConfirmado] = useState<boolean>(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", manejarEscape);
    return () => window.removeEventListener("keydown", manejarEscape);
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  const primeraPublicacion = (actor?.publicaciones_aprobadas_count ?? 0) === 0;

  const procesarArchivos = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setErrorForm(null);
    setProcesandoFoto(true);
    try {
      const disponibles = Math.max(0, 6 - fotos.length);
      const seleccionados = Array.from(lista).slice(0, disponibles);
      const nuevas: FotoDraft[] = [];

      for (let idx = 0; idx < seleccionados.length; idx++) {
        const archivo = seleccionados[idx];
        const procesada = await procesarImagenClienteSinExif(archivo, {
          maxLadoPx: 1600,
          maxBytes: 400 * 1024,
          recortarRostroSuperior: recortarRostro,
          marcaAguaTexto:
            usarMarcaAgua && perfilActivo
              ? `@${perfilActivo.usuario_unico} · MoldeFácil`
              : undefined,
        });

        let verificadaServidor = false;
        try {
          const resp = await fetch("/api/comunidad/validar-imagen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              base64Data: procesada.dataUrl,
              nombreArchivo: archivo.name,
            }),
          });
          if (resp.ok) {
            const payload = (await resp.json()) as {
              ok?: boolean;
              exif_limpio?: boolean;
            };
            verificadaServidor = Boolean(payload.ok && payload.exif_limpio);
          }
        } catch {
          // Si falla la red local, conservamos la limpieza garantizada por canvas
        }

        nuevas.push({
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          url: procesada.dataUrl,
          alt: sugerirTextoAlternativo({ prenda, tela, titulo }),
          ancho: procesada.ancho,
          alto: procesada.alto,
          pesoKb: Math.max(1, Math.round(procesada.pesoBytes / 1024)),
          hash_perceptual: procesada.hashPerceptual,
          exif_limpio: true,
          verificadaServidor,
        });
      }

      setFotos((prev) => [...prev, ...nuevas].slice(0, 6));
    } catch (err) {
      setErrorForm(
        err instanceof Error
          ? err.message
          : "No se pudo procesar la foto seleccionada."
      );
    } finally {
      setProcesandoFoto(false);
    }
  };

  const adjuntarCaptura3DComoFoto = async () => {
    if (!borrador?.captura3dUrl || fotos.length >= 6) return;
    setErrorForm(null);
    setProcesandoFoto(true);
    try {
      const procesada = await procesarImagenClienteSinExif(
        borrador.captura3dUrl,
        {
          maxLadoPx: 1400,
          maxBytes: 350 * 1024,
          marcaAguaTexto:
            usarMarcaAgua && perfilActivo
              ? `@${perfilActivo.usuario_unico} · Vista 3D`
              : undefined,
        }
      );
      setFotos((prev) => [
        ...prev,
        {
          id: `3d-${Date.now()}`,
          url: procesada.dataUrl,
          alt: `Vista previa 3D de ${prenda} en ${tela} lista para comparar con la confección`,
          ancho: procesada.ancho,
          alto: procesada.alto,
          pesoKb: Math.max(1, Math.round(procesada.pesoBytes / 1024)),
          hash_perceptual: procesada.hashPerceptual,
          exif_limpio: true,
          verificadaServidor: false,
        },
      ]);
    } catch {
      setErrorForm("No se pudo adjuntar la captura 3D.");
    } finally {
      setProcesandoFoto(false);
    }
  };

  const enviarPublicacion = () => {
    setErrorForm(null);
    if (!actor) {
      setErrorForm("Selecciona o crea tu perfil arriba antes de publicar.");
      return;
    }
    if (fotos.length === 0) {
      setPaso(1);
      setErrorForm("Agrega al menos 1 foto limpia de tu prenda.");
      return;
    }

    const res = crearPublicacionComunidad(estado, {
      tipo_publicacion: tipoPublicacion,
      titulo,
      descripcion,
      aprendizaje_nota: aprendizajeNota,
      prenda,
      tela,
      dificultad,
      tiempo_horas: Number(tiempoHoras) || 2,
      costo_aprox: costoAprox.trim() || undefined,
      config_molde:
        tipoPublicacion === "molde_plataforma"
          ? (borrador?.config_molde ?? CONFIG_POR_DEFECTO)
          : undefined,
      referencia_inspiracion:
        tipoPublicacion === "moda_real"
          ? referenciaInspiracion.trim() || undefined
          : undefined,
      captura_3d_url: borrador?.captura3dUrl,
      permiso_fotos_confirmado: permisoConfirmado,
      reto_id: unirseReto ? RETO_MENSUAL_DEMO.id : undefined,
      fotos: fotos.map((f, index) => ({
        url: f.url,
        alt: f.alt,
        orden: index,
        ancho: f.ancho,
        alto: f.alto,
        hash_perceptual: f.hash_perceptual,
        exif_limpio: true,
      })),
    });

    if (!res.ok || !res.idCreado) {
      setErrorForm(res.error ?? "Revisa los campos antes de publicar.");
      return;
    }

    const nuevaPub = res.estado.publicaciones.find((p) => p.id === res.idCreado);
    onPublicacionCreada(
      res.estado,
      res.idCreado,
      nuevaPub?.estado === "en_revision"
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-publicar"
      className="fixed inset-0 z-50 bg-[#2D2A26]/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-[#FAF6F0] border border-[#E2D6C8] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <header className="bg-white border-b border-[#E2D6C8] px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#B34720]">
              Paso {paso} de 3 · Galería Lo que cosieron
            </p>
            <h2
              id="titulo-modal-publicar"
              className="text-lg sm:text-xl font-extrabold text-[#2D2A26]"
            >
              Compartir mi creación con el taller
            </h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar asistente de publicación"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] flex items-center justify-center text-[#2D2A26] hover:border-[#B34720] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <div className="rounded-2xl bg-[#3B7A57]/10 border border-[#3B7A57]/30 px-4 py-3 flex items-start gap-2.5 text-xs text-[#28593D] font-semibold">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#3B7A57]" />
            <span>
              <strong>Privacidad activa:</strong>{" "}
              {borrador
                ? `adjuntamos la configuración visual de "${borrador.prendaLabel}". Tus 12 medidas corporales nunca se guardan ni se muestran.`
                : "tus medidas corporales nunca viajan en las publicaciones; otras modistas harán el molde usando sus propias medidas."}
            </span>
          </div>

          {errorForm && (
            <div
              role="alert"
              className="rounded-2xl bg-[#FFF1ED] border border-[#E0A996] px-4 py-3 text-sm font-bold text-[#8A3112]"
            >
              {errorForm}
            </div>
          )}

          {paso === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="rounded-2xl bg-white border border-[#E2D6C8] p-3.5 flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-[#2D2A26]">
                  <input
                    type="checkbox"
                    checked={recortarRostro}
                    onChange={(e) => setRecortarRostro(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#B34720]"
                  />
                  <span>
                    <strong className="block">Recortar zona superior (22 %)</strong>
                    Útil para ocultar el rostro automáticamente al subir fotos.
                  </span>
                </label>
                <label className="rounded-2xl bg-white border border-[#E2D6C8] p-3.5 flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-[#2D2A26]">
                  <input
                    type="checkbox"
                    checked={usarMarcaAgua}
                    onChange={(e) => setUsarMarcaAgua(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#3B7A57]"
                  />
                  <span>
                    <strong className="block">Firma discreta en la foto</strong>
                    Agrega @{perfilActivo?.usuario_unico ?? "tu_taller"} abajo a la derecha.
                  </span>
                </label>
              </div>

              <div className="rounded-2xl bg-white border-2 border-dashed border-[#C85A32]/50 p-5 text-center space-y-3">
                <Camera className="w-8 h-8 mx-auto text-[#B34720]" />
                <p className="text-sm font-extrabold text-[#2D2A26]">
                  Sube hasta 6 fotos de tu prenda (máx. 1600 px y ≤ 400 KB)
                </p>
                <p className="text-xs text-[#5C554E]">
                  En tu navegador borramos el 100 % de metadatos EXIF/GPS antes de guardar.
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <label className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {procesandoFoto ? "Limpiando EXIF..." : "Elegir o tomar fotos"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={procesandoFoto || fotos.length >= 6}
                      onChange={(e) => {
                        void procesarArchivos(e.target.files);
                        e.currentTarget.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  {borrador?.captura3dUrl && (
                    <button
                      type="button"
                      disabled={procesandoFoto || fotos.length >= 6}
                      onClick={() => void adjuntarCaptura3DComoFoto()}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EFE6DA] hover:bg-[#E4D6C4] text-[#2D2A26] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#3B7A57]" />
                      Adjuntar captura 3D
                    </button>
                  )}
                </div>
              </div>

              {fotos.length > 0 && (
                <div className="space-y-3">
                  {fotos.map((foto, i) => (
                    <div
                      key={foto.id}
                      className="rounded-2xl bg-white border border-[#E2D6C8] p-3 flex flex-col sm:flex-row gap-3 items-start"
                    >
                      <img
                        src={foto.url}
                        alt={foto.alt}
                        className="w-24 h-24 rounded-xl object-cover shrink-0 border border-[#E2D6C8]"
                      />
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#28593D] bg-[#3B7A57]/12 px-2.5 py-1 rounded-full">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            EXIF/GPS limpio · {foto.ancho}x{foto.alto}px · {foto.pesoKb} KB
                            {foto.verificadaServidor ? " · Verificada en servidor" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFotos((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            aria-label="Quitar esta foto"
                            className="min-h-[36px] px-2.5 rounded-lg bg-[#FFF1ED] text-[#8A3112] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Quitar
                          </button>
                        </div>
                        <label className="block text-xs font-bold text-[#5C554E]">
                          Texto alternativo accesible (obligatorio):
                          <input
                            type="text"
                            value={foto.alt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFotos((prev) =>
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, alt: val } : item
                                )
                              );
                            }}
                            className="mt-1 w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs text-[#2D2A26]"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTipoPublicacion("molde_plataforma")}
                  className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-xs font-extrabold cursor-pointer ${
                    tipoPublicacion === "molde_plataforma"
                      ? "bg-[#FFF5EE] border-[#B34720] text-[#8A3112]"
                      : "bg-white border-[#E2D6C8] text-[#5C554E]"
                  }`}
                >
                  Hecho con molde de MoldeFácil
                </button>
                <button
                  type="button"
                  onClick={() => setTipoPublicacion("moda_real")}
                  className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-xs font-extrabold cursor-pointer ${
                    tipoPublicacion === "moda_real"
                      ? "bg-[#EFF7F1] border-[#3B7A57] text-[#28593D]"
                      : "bg-white border-[#E2D6C8] text-[#5C554E]"
                  }`}
                >
                  Moda real / Creación libre (sin molde base)
                </button>
              </div>

              {tipoPublicacion === "moda_real" && (
                <label className="block text-xs font-extrabold text-[#28593D]">
                  Inspiración o técnica libre (opcional)
                  <input
                    type="text"
                    value={referenciaInspiracion}
                    onChange={(e) => setReferenciaInspiracion(e.target.value)}
                    placeholder="Ej. Sastrería libre, moda de calle o transformación personal"
                    className="mt-1 w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#B8D7C3] text-sm text-[#2D2A26]"
                  />
                </label>
              )}

              <label className="block text-xs font-extrabold text-[#2D2A26]">
                Título de tu creación
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Vestido envolvente de verano con ajuste en sisa"
                  className="mt-1 w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Prenda
                  <input
                    type="text"
                    value={prenda}
                    onChange={(e) => setPrenda(e.target.value)}
                    className="mt-1 w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                  />
                </label>
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Tela usada
                  <input
                    type="text"
                    value={tela}
                    onChange={(e) => setTela(e.target.value)}
                    className="mt-1 w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Dificultad percibida
                  <select
                    value={dificultad}
                    onChange={(e) =>
                      setDificultad(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                    }
                    className="mt-1 w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                  >
                    <option value={1}>1 - Muy fácil</option>
                    <option value={2}>2 - Principiante</option>
                    <option value={3}>3 - Intermedia</option>
                    <option value={4}>4 - Retadora</option>
                    <option value={5}>5 - Sastrería avanzada</option>
                  </select>
                </label>
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Horas dedicadas
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={tiempoHoras}
                    onChange={(e) => setTiempoHoras(e.target.value)}
                    className="mt-1 w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                  />
                </label>
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Costo aprox. (opcional)
                  <input
                    type="text"
                    value={costoAprox}
                    onChange={(e) => setCostoAprox(e.target.value)}
                    placeholder="Ej. $22 USD o $85.000"
                    className="mt-1 w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-extrabold text-[#2D2A26]">
                Historia y acabados (opcional)
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Cuéntanos qué entretela, puntada o ajuste aplicaste..."
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                />
              </label>

              <label className="block text-xs font-extrabold text-[#2D2A26]">
                ¿Qué aprendiste o ajustarías la próxima vez? (obligatorio)
                <textarea
                  rows={2}
                  value={aprendizajeNota}
                  onChange={(e) => setAprendizajeNota(e.target.value)}
                  placeholder="Ej. Asentar las vistas con pespunte invisible evitó que se giraran..."
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                />
              </label>

              <label className="rounded-2xl bg-white border border-[#E2D6C8] p-3.5 flex items-center gap-3 cursor-pointer text-xs font-bold text-[#2D2A26]">
                <input
                  type="checkbox"
                  checked={unirseReto}
                  onChange={(e) => setUnirseReto(e.target.checked)}
                  className="w-4 h-4 accent-[#B34720]"
                />
                <span>
                  Enviar también al reto mensual: <strong>{RETO_MENSUAL_DEMO.titulo}</strong>
                </span>
              </label>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-[#E2D6C8] p-4 space-y-2 text-xs sm:text-sm text-[#5C554E]">
                <h3 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-[#B34720]" />
                  Resumen antes de publicar
                </h3>
                <p>
                  <strong>Prenda:</strong> {titulo || "(Sin título)"} · {fotos.length} foto(s) sin EXIF.
                </p>
                {primeraPublicacion && (
                  <p className="text-[#8A3112] font-bold">
                    Como es tu primera publicación en la comunidad, quedará unos minutos en revisión antes de aparecer en la galería pública.
                  </p>
                )}
              </div>

              <label className="rounded-2xl bg-white border-2 border-[#E2D6C8] p-4 flex items-start gap-3 cursor-pointer text-xs sm:text-sm font-bold text-[#2D2A26]">
                <input
                  type="checkbox"
                  checked={permisoConfirmado}
                  onChange={(e) => setPermisoConfirmado(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-[#3B7A57]"
                />
                <span>
                  Confirmo que estas fotos me pertenecen (o tengo permiso explícito de quien aparece), no exponen menores sin autorización ni contienen patrones comerciales de pago escaneados.
                </span>
              </label>
            </div>
          )}
        </div>

        <footer className="bg-white border-t border-[#E2D6C8] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          {paso > 1 ? (
            <button
              type="button"
              onClick={() => setPaso((p) => (p === 3 ? 2 : 1))}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] cursor-pointer"
            >
              Paso anterior
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#5C554E]">
              Sin medidas · Limpieza EXIF automática
            </span>
          )}

          {paso < 3 ? (
            <button
              type="button"
              onClick={() => {
                setErrorForm(null);
                if (paso === 1 && fotos.length === 0) {
                  setErrorForm("Sube al menos una foto (o adjunta la captura 3D) para continuar.");
                  return;
                }
                if (paso === 2) {
                  if (titulo.trim().length < 5) {
                    setErrorForm("Escribe un título descriptivo (mínimo 5 caracteres).");
                    return;
                  }
                  if (aprendizajeNota.trim().length < 5) {
                    setErrorForm("Cuéntanos brevemente qué aprendiste o ajustarías la próxima vez.");
                    return;
                  }
                }
                setPaso((p) => (p === 1 ? 2 : 3));
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold cursor-pointer"
            >
              Siguiente paso
            </button>
          ) : (
            <button
              type="button"
              onClick={enviarPublicacion}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#3B7A57] hover:bg-[#2F6647] text-white text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publicar creación
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}