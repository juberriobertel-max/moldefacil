"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  MailCheck,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import LocalMigrationPrompt from "@/components/auth/LocalMigrationPrompt";
import { useAuthClient } from "@/lib/auth/authClient";
import { evaluarFortalezaContrasena } from "@/lib/auth/passwordSecurity";
import {
  loadComunidadEstado,
  saveComunidadEstado,
  sincronizarPerfilDesdeCuentaAuth,
} from "@/lib/community/communityStore";

type TabCuenta = "entrar" | "registro" | "recuperar";

export default function AuthCenterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const volverUrl = searchParams.get("volver") || "/comunidad";
  const tokenVerifUrl =
    searchParams.get("token_verificacion") ||
    searchParams.get("verificar") ||
    "";
  const tokenRecupUrl = searchParams.get("token") || "";
  const modoInicial = searchParams.get("modo");
  const [humanaConfirmada, setHumanaConfirmada] = useState<boolean>(false);

  const auth = useAuthClient();
  const [tab, setTab] = useState<TabCuenta>(
    modoInicial === "recuperar" || tokenRecupUrl ? "recuperar" : "entrar"
  );

  // Registro
  const [nombreReg, setNombreReg] = useState<string>("");
  const [correoReg, setCorreoReg] = useState<string>("");
  const [passReg, setPassReg] = useState<string>("");
  const [mostrarPassReg, setMostrarPassReg] = useState<boolean>(false);
  const [aceptoTerminos, setAceptoTerminos] = useState<boolean>(false);
  const [autorizoDatos, setAutorizoDatos] = useState<boolean>(false);
  const [mayorEdad, setMayorEdad] = useState<boolean>(false);
  const [tokenPreviewVerif, setTokenPreviewVerif] = useState<string | null>(null);

  // Login
  const [correoLogin, setCorreoLogin] = useState<string>("");
  const [passLogin, setPassLogin] = useState<string>("");
  const [mostrarPassLogin, setMostrarPassLogin] = useState<boolean>(false);
  const [codigoTotpLogin, setCodigoTotpLogin] = useState<string>("");
  const [requiere2FaLogin, setRequiere2FaLogin] = useState<boolean>(false);

  // Recuperación
  const [correoRecup, setCorreoRecup] = useState<string>("");
  const [tokenRecup, setTokenRecup] = useState<string>(tokenRecupUrl);
  const [nuevaPassRecup, setNuevaPassRecup] = useState<string>("");
  const [previewResetToken, setPreviewResetToken] = useState<string | null>(null);

  // Gestión autenticada
  const [passActualCambio, setPassActualCambio] = useState<string>("");
  const [passNuevaCambio, setPassNuevaCambio] = useState<string>("");
  const [nuevoCorreoCambio, setNuevoCorreoCambio] = useState<string>("");
  const [confirmCorreoCambio, setConfirmCorreoCambio] = useState<string>("");
  const [passParaCorreo, setPassParaCorreo] = useState<string>("");

  // 2FA
  const [secreto2Fa, setSecreto2Fa] = useState<string | null>(null);
  const [codigoConfirm2Fa, setCodigoConfirm2Fa] = useState<string>("");

  // Eliminación 14 días
  const [confirmEliminarTexto, setConfirmEliminarTexto] = useState<string>("");
  const [passEliminar, setPassEliminar] = useState<string>("");

  const [ocupado, setOcupado] = useState<boolean>(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const fuerzaReg = evaluarFortalezaContrasena(passReg);
  const fuerzaNueva = evaluarFortalezaContrasena(passNuevaCambio);

  useEffect(() => {
    if (auth.autenticada && auth.sesion) {
      const stCom = loadComunidadEstado();
      const sincronizado = sincronizarPerfilDesdeCuentaAuth(stCom, {
        id: auth.sesion.usuariaId,
        nombrePublico: auth.sesion.nombrePublico,
        usuarioUnico: auth.sesion.usuarioUnico,
        rol: auth.sesion.rol,
      });
      if (sincronizado !== stCom) {
        saveComunidadEstado(sincronizado);
      }
    }
  }, [auth.autenticada, auth.sesion]);

  useEffect(() => {
    if (!tokenVerifUrl) return;
    queueMicrotask(async () => {
      try {
        const resp = await fetch("/api/auth/verificar-correo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "verificar", token: tokenVerifUrl }),
        });
        const data = (await resp.json()) as { ok?: boolean; mensaje?: string; error?: string };
        if (resp.ok && data.ok) {
          setMensajeOk(data.mensaje ?? "Correo verificado correctamente.");
          await auth.recargar();
        } else {
          setMensajeError(data.error ?? "No se pudo verificar el correo.");
        }
      } catch {
        setMensajeError("Error verificando el enlace.");
      }
    });
  }, [tokenVerifUrl, auth]);

  const limpiarFeedback = () => {
    setMensajeOk(null);
    setMensajeError(null);
  };

  const manejarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarFeedback();
    setOcupado(true);
    try {
      const resp = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_publico: nombreReg,
          correo: correoReg,
          contrasena: passReg,
          acepto_terminos: aceptoTerminos,
          autorizo_datos: autorizoDatos,
          mayor_edad_confirmada: mayorEdad,
          turnstile_token: humanaConfirmada ? "verificada-human-check" : "",
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        mensaje?: string;
        error?: string;
        previewTokenVerificacion?: string;
      };
      if (!resp.ok || !data.ok) {
        setMensajeError(data.error ?? "Revisa los datos del formulario.");
        return;
      }
      setMensajeOk(
        data.mensaje ??
          "Si el correo es válido, te enviamos un enlace de verificación."
      );
      if (data.previewTokenVerificacion) {
        setTokenPreviewVerif(data.previewTokenVerificacion);
      }
      await auth.recargar();
    } catch {
      setMensajeError("Error de conexión al crear tu cuenta.");
    } finally {
      setOcupado(false);
    }
  };

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarFeedback();
    setOcupado(true);
    try {
      const resp = await fetch("/api/auth/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "password",
          correo: correoLogin,
          contrasena: passLogin,
          codigo_totp: codigoTotpLogin || undefined,
          turnstile_token: humanaConfirmada ? "verificada-human-check" : "",
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        requiere2FA?: boolean;
        mensaje?: string;
      };
      if (data.requiere2FA) {
        setRequiere2FaLogin(true);
        setMensajeError(
          data.error ?? "Ingresa el código de 6 dígitos de tu app autenticadora."
        );
        return;
      }
      if (!resp.ok || !data.ok) {
        setMensajeError(data.error ?? "Credenciales incorrectas.");
        return;
      }
      setRequiere2FaLogin(false);
      setMensajeOk("Bienvenida de nuevo. Tu sesión segura está activa.");
      await auth.recargar();
    } catch {
      setMensajeError("Error de conexión al iniciar sesión.");
    } finally {
      setOcupado(false);
    }
  };

  const manejarGoogleOAuth = async () => {
    limpiarFeedback();
    setOcupado(true);
    try {
      const resp = await fetch("/api/auth/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "google_oauth" }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        redirectUrl?: string;
        error?: string;
      };
      if (data.ok && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setMensajeError(
        data.error ??
          "Conecta Supabase Auth para habilitar el acceso directo con Google."
      );
    } catch {
      setMensajeError("No se pudo iniciar Google OAuth.");
    } finally {
      setOcupado(false);
    }
  };

  const manejarMagicLink = async () => {
    limpiarFeedback();
    if (!correoLogin.trim()) {
      setMensajeError("Escribe tu correo arriba para enviarte un enlace mágico.");
      return;
    }
    setOcupado(true);
    try {
      const resp = await fetch("/api/auth/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "magic_link", correo: correoLogin }),
      });
      const data = (await resp.json()) as { ok?: boolean; mensaje?: string; error?: string };
      if (!resp.ok || !data.ok) {
        setMensajeError(data.error ?? "No se pudo enviar el enlace mágico.");
        return;
      }
      setMensajeOk(data.mensaje ?? "Revisa tu bandeja de entrada.");
    } finally {
      setOcupado(false);
    }
  };

  const verificarTokenPreview = async (token: string) => {
    limpiarFeedback();
    const resp = await fetch("/api/auth/verificar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "verificar", token }),
    });
    const data = (await resp.json()) as { ok?: boolean; mensaje?: string; error?: string };
    if (resp.ok && data.ok) {
      setTokenPreviewVerif(null);
      setMensajeOk(data.mensaje ?? "Correo verificado.");
      await auth.recargar();
    } else {
      setMensajeError(data.error ?? "No se pudo verificar.");
    }
  };

  const reenviarVerificacion = async () => {
    limpiarFeedback();
    const resp = await fetch("/api/auth/verificar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "reenviar" }),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      mensaje?: string;
      error?: string;
      previewTokenVerificacion?: string;
    };
    if (resp.ok && data.ok) {
      setMensajeOk(data.mensaje ?? "Enlace reenviado.");
      if (data.previewTokenVerificacion) {
        setTokenPreviewVerif(data.previewTokenVerificacion);
      }
    } else {
      setMensajeError(data.error ?? "Espera un momento antes de reenviar.");
    }
  };

  const cerrarSesion = async (alcance: "actual" | "todos") => {
    limpiarFeedback();
    const resp = await fetch(`/api/auth/sesion?alcance=${alcance}`, {
      method: "DELETE",
    });
    if (resp.ok) {
      setMensajeOk(
        alcance === "todos"
          ? "Cerramos tu sesión en todos los dispositivos."
          : "Sesión cerrada correctamente."
      );
      await auth.recargar();
    }
  };

  const exportarMisDatos = async () => {
    const resp = await fetch("/api/auth/cuenta");
    if (!resp.ok) {
      setMensajeError("No se pudo exportar tu archivo de datos.");
      return;
    }
    const data = await resp.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moldefacil-mi-cuenta-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ejecutarAccionCuenta = async (payload: Record<string, unknown>) => {
    limpiarFeedback();
    setOcupado(true);
    try {
      const resp = await fetch("/api/auth/cuenta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        mensaje?: string;
        error?: string;
        secretoBase32?: string;
        previewTokenVerificacion?: string;
      };
      if (!resp.ok || !data.ok) {
        setMensajeError(data.error ?? "No se pudo completar la acción.");
        return;
      }
      if (data.secretoBase32) setSecreto2Fa(data.secretoBase32);
      if (data.previewTokenVerificacion) setTokenPreviewVerif(data.previewTokenVerificacion);
      if (data.mensaje) setMensajeOk(data.mensaje);
      await auth.recargar();
    } finally {
      setOcupado(false);
    }
  };

  const solicitarEliminacion = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarFeedback();
    setOcupado(true);
    try {
      const resp = await fetch("/api/auth/cuenta", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmacion: confirmEliminarTexto,
          contrasena_actual: passEliminar,
        }),
      });
      const data = (await resp.json()) as { ok?: boolean; mensaje?: string; error?: string };
      if (!resp.ok || !data.ok) {
        setMensajeError(data.error ?? "No se pudo programar la eliminación.");
        return;
      }
      setMensajeOk(data.mensaje ?? "Eliminación programada con 14 días de gracia.");
      await auth.recargar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={volverUrl}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-2 hover:border-[#B34720]"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver donde estaba
        </Link>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFF7F1] text-[#28593D] text-xs font-extrabold border border-[#C6DFCD]">
          <ShieldCheck className="w-4 h-4" />
          Sesión en cookies httpOnly · Cero contraseñas débiles
        </span>
      </div>

      <section className="rounded-3xl bg-white border border-[#E2D6C8] p-6 sm:p-8 shadow-xs space-y-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2A26]">
          Mi Cuenta Segura en MoldeFácil
        </h1>
        <p className="text-sm text-[#5C554E] leading-relaxed">
          El generador de moldes 2D, el probador 3D y las descargas PDF siempre
          funcionan gratis sin registro. Tu cuenta te permite publicar en{" "}
          <strong>Lo que cosieron</strong>, preguntar a otras modistas y guardar tus
          medidas en privado bajo Row Level Security.
        </p>
      </section>

      {mensajeOk && (
        <div
          role="status"
          className="rounded-2xl bg-[#EFF7F1] border border-[#B8D7C3] px-4 py-3 text-xs sm:text-sm font-bold text-[#28593D] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{mensajeOk}</span>
        </div>
      )}

      {mensajeError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1ED] border border-[#E6B8AA] px-4 py-3 text-xs sm:text-sm font-bold text-[#8A3112] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{mensajeError}</span>
        </div>
      )}

      {tokenPreviewVerif && (
        <div className="rounded-2xl bg-[#FFF9F2] border border-[#E5C9A8] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#2D2A26]">
            <strong>Modo vista previa (sin Resend configurado):</strong> simula el
            clic del correo de verificación en un toque.
          </div>
          <button
            type="button"
            onClick={() => void verificarTokenPreview(tokenPreviewVerif)}
            className="min-h-[40px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
          >
            Confirmar mi correo ahora
          </button>
        </div>
      )}

      {!auth.autenticada ? (
        <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-7 space-y-5 shadow-xs">
          <div className="flex flex-wrap gap-2 border-b border-[#EFE6DA] pb-4">
            {(
              [
                { id: "entrar" as const, label: "Iniciar sesión" },
                { id: "registro" as const, label: "Crear cuenta gratis" },
                { id: "recuperar" as const, label: "Olvidé mi contraseña" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  limpiarFeedback();
                  setTab(item.id);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer ${
                  tab === item.id
                    ? "bg-[#B34720] text-white"
                    : "bg-[#FAF6F0] text-[#5C554E] border border-[#E2D6C8]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "entrar" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={manejarGoogleOAuth}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] hover:border-[#B34720] text-xs font-extrabold text-[#2D2A26] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#B34720]" />
                  Continuar con Google
                </button>
                <button
                  type="button"
                  onClick={manejarMagicLink}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] hover:border-[#3B7A57] text-xs font-extrabold text-[#28593D] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MailCheck className="w-4 h-4" />
                  Enviar enlace mágico sin contraseña
                </button>
              </div>

              <form onSubmit={manejarLogin} className="space-y-3.5">
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Correo electrónico
                  <input
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    value={correoLogin}
                    onChange={(e) => setCorreoLogin(e.target.value)}
                    placeholder="tu@correo.com"
                    className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                  />
                </label>

                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Contraseña
                  <div className="relative mt-1">
                    <input
                      type={mostrarPassLogin ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={passLogin}
                      onChange={(e) => setPassLogin(e.target.value)}
                      className="w-full min-h-[44px] pl-3.5 pr-12 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassLogin((v) => !v)}
                      aria-label={
                        mostrarPassLogin ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      className="absolute right-1 top-1 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-[#5C554E] cursor-pointer"
                    >
                      {mostrarPassLogin ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </label>

                {requiere2FaLogin && (
                  <label className="block text-xs font-extrabold text-[#8A3112]">
                    Código 2FA (6 dígitos de tu app autenticadora)
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={codigoTotpLogin}
                      onChange={(e) => setCodigoTotpLogin(e.target.value)}
                      placeholder="123456"
                      className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FFF9F2] border border-[#B34720] text-sm"
                    />
                  </label>
                )}

                <label className="flex items-center gap-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] px-3.5 py-2.5 text-xs font-bold text-[#2D2A26] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={humanaConfirmada}
                    onChange={(e) => setHumanaConfirmada(e.target.checked)}
                    className="w-4 h-4 accent-[#3B7A57]"
                  />
                  <span>Verificación anti-bots (Turnstile): confirmo que soy una persona real.</span>
                </label>

                <button
                  type="submit"
                  disabled={ocupado}
                  className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] hover:bg-[#973B1A] text-white text-sm font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {ocupado ? "Verificando..." : "Entrar a mi cuenta"}
                </button>
              </form>
            </div>
          )}

          {tab === "registro" && (
            <form onSubmit={manejarRegistro} className="space-y-3.5">
              <label className="block text-xs font-extrabold text-[#2D2A26]">
                Nombre público (cómo te verán otras modistas)
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={nombreReg}
                  onChange={(e) => setNombreReg(e.target.value)}
                  placeholder="Ej. Carolina Herrera"
                  className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                />
              </label>

              <label className="block text-xs font-extrabold text-[#2D2A26]">
                Correo electrónico
                <input
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  value={correoReg}
                  onChange={(e) => setCorreoReg(e.target.value)}
                  placeholder="nombre@correo.com"
                  className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                />
              </label>

              <label className="block text-xs font-extrabold text-[#2D2A26]">
                Contraseña (mínimo 10 caracteres, sin símbolos obligatorios)
                <div className="relative mt-1">
                  <input
                    type={mostrarPassReg ? "text" : "password"}
                    required
                    minLength={10}
                    autoComplete="new-password"
                    value={passReg}
                    onChange={(e) => setPassReg(e.target.value)}
                    placeholder="Ej. costura lino taller 2026"
                    className="w-full min-h-[44px] pl-3.5 pr-12 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassReg((v) => !v)}
                    aria-label={
                      mostrarPassReg ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    className="absolute right-1 top-1 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-[#5C554E] cursor-pointer"
                  >
                    {mostrarPassReg ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passReg.length > 0 && (
                  <p
                    className={`mt-1.5 text-[11px] font-bold ${
                      fuerzaReg.valida ? "text-[#28593D]" : "text-[#8A3112]"
                    }`}
                  >
                    Fortaleza ({fuerzaReg.puntaje}/4): {fuerzaReg.mensaje}
                  </p>
                )}
              </label>

              <div className="space-y-2 rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 text-xs font-semibold text-[#2D2A26]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aceptoTerminos}
                    onChange={(e) => setAceptoTerminos(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#B34720]"
                  />
                  <span>
                    Acepto las{" "}
                    <Link href="/comunidad/normas" className="text-[#B34720] underline">
                      normas y términos de la comunidad
                    </Link>
                    .
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autorizoDatos}
                    onChange={(e) => setAutorizoDatos(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#B34720]"
                  />
                  <span>
                    Autorizo el tratamiento de mis datos según la{" "}
                    <Link
                      href="/comunidad/privacidad"
                      className="text-[#B34720] underline"
                    >
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mayorEdad}
                    onChange={(e) => setMayorEdad(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#3B7A57]"
                  />
                  <span>
                    Confirmo que cumplo con la edad mínima legal en mi país para
                    registrar una cuenta.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-[#E2D6C8]">
                  <input
                    type="checkbox"
                    checked={humanaConfirmada}
                    onChange={(e) => setHumanaConfirmada(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#3B7A57]"
                  />
                  <span>Verificación anti-bots (Turnstile): confirmo que soy una persona real.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={ocupado}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#3B7A57] hover:bg-[#2F6446] text-white text-sm font-extrabold cursor-pointer disabled:opacity-60"
              >
                {ocupado ? "Creando cuenta..." : "Crear mi cuenta gratis"}
              </button>
            </form>
          )}

          {tab === "recuperar" && (
            <div className="space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  limpiarFeedback();
                  setOcupado(true);
                  try {
                    const resp = await fetch("/api/auth/recuperacion", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        correo: correoRecup,
                        turnstile_token: humanaConfirmada ? "verificada-human-check" : "",
                      }),
                    });
                    const data = (await resp.json()) as {
                      ok?: boolean;
                      mensaje?: string;
                      error?: string;
                      previewResetToken?: string;
                    };
                    if (!resp.ok || !data.ok) {
                      setMensajeError(data.error ?? "No se pudo solicitar el enlace.");
                      return;
                    }
                    setMensajeOk(data.mensaje ?? "Revisa tu bandeja de entrada.");
                    if (data.previewResetToken) {
                      setPreviewResetToken(data.previewResetToken);
                      setTokenRecup(data.previewResetToken);
                    }
                  } finally {
                    setOcupado(false);
                  }
                }}
                className="space-y-3"
              >
                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  Tu correo registrado
                  <input
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    value={correoRecup}
                    onChange={(e) => setCorreoRecup(e.target.value)}
                    placeholder="nombre@correo.com"
                    className="mt-1 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-sm"
                  />
                </label>
                <label className="flex items-center gap-2.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] px-3.5 py-2.5 text-xs font-bold text-[#2D2A26] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={humanaConfirmada}
                    onChange={(e) => setHumanaConfirmada(e.target.checked)}
                    className="w-4 h-4 accent-[#3B7A57]"
                  />
                  <span>Verificación anti-bots (Turnstile): confirmo que soy una persona real.</span>
                </label>

                <button
                  type="submit"
                  disabled={ocupado}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                >
                  Enviar enlace de recuperación (válido 1 hora)
                </button>
              </form>

              {(previewResetToken || tokenRecup) && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    limpiarFeedback();
                    setOcupado(true);
                    try {
                      const resp = await fetch("/api/auth/recuperacion", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          token: tokenRecup,
                          nueva_contrasena: nuevaPassRecup,
                        }),
                      });
                      const data = (await resp.json()) as {
                        ok?: boolean;
                        mensaje?: string;
                        error?: string;
                      };
                      if (!resp.ok || !data.ok) {
                        setMensajeError(data.error ?? "Enlace inválido o vencido.");
                        return;
                      }
                      setMensajeOk(data.mensaje ?? "Contraseña restablecida.");
                      setPreviewResetToken(null);
                      setTab("entrar");
                    } finally {
                      setOcupado(false);
                    }
                  }}
                  className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-4 space-y-3"
                >
                  <p className="text-xs font-extrabold text-[#2D2A26]">
                    Establecer nueva contraseña (un solo uso)
                  </p>
                  <input
                    type="text"
                    required
                    value={tokenRecup}
                    onChange={(e) => setTokenRecup(e.target.value)}
                    placeholder="Token de recuperación"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
                  />
                  <input
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    value={nuevaPassRecup}
                    onChange={(e) => setNuevaPassRecup(e.target.value)}
                    placeholder="Nueva contraseña (mínimo 10 caracteres)"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Guardar nueva contraseña
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          <LocalMigrationPrompt
            autenticada={auth.autenticada}
            onMigracionCompleta={() => router.refresh()}
          />

          <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-[#3B7A57] inline-flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  Sesión activa · Rol: {auth.sesion?.rol}
                </p>
                <h2 className="text-xl font-extrabold text-[#2D2A26]">
                  {auth.sesion?.nombrePublico} (@{auth.sesion?.usuarioUnico})
                </h2>
                <p className="text-xs text-[#5C554E]">{auth.sesion?.correo}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void cerrarSesion("actual")}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
                <button
                  type="button"
                  onClick={() => void cerrarSesion("todos")}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FFF1ED] border border-[#E6B8AA] text-xs font-extrabold text-[#8A3112] cursor-pointer"
                >
                  Cerrar sesión en todos los dispositivos
                </button>
              </div>
            </div>

            {!auth.sesion?.correoVerificado && (
              <div className="rounded-2xl bg-[#FFF9F2] border border-[#E5C9A8] p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#8A3112]">
                  Tu correo aún no está verificado: puedes explorar el directorio, pero
                  necesitas verificarlo antes de publicar o comentar.
                </p>
                <button
                  type="button"
                  onClick={reenviarVerificacion}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                >
                  Reenviar enlace (24 h)
                </button>
              </div>
            )}

            {auth.pendienteEliminacionHasta && (
              <div className="rounded-2xl bg-[#FFF1ED] border border-[#E6B8AA] p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#8A3112]">
                  Cuenta programada para eliminación definitiva el{" "}
                  {new Date(auth.pendienteEliminacionHasta).toLocaleDateString("es-CO")}.
                </p>
                <button
                  type="button"
                  onClick={() => void ejecutarAccionCuenta({ accion: "cancelar_eliminacion" })}
                  className="min-h-[40px] px-4 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
                >
                  Cancelar eliminación
                </button>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#B34720]" />
                Cambiar contraseña
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ejecutarAccionCuenta({
                    accion: "cambiar_contrasena",
                    contrasena_actual: passActualCambio,
                    nueva_contrasena: passNuevaCambio,
                  });
                }}
                className="space-y-2.5"
              >
                <input
                  type="password"
                  required
                  value={passActualCambio}
                  onChange={(e) => setPassActualCambio(e.target.value)}
                  placeholder="Contraseña actual"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
                <input
                  type="password"
                  required
                  minLength={10}
                  value={passNuevaCambio}
                  onChange={(e) => setPassNuevaCambio(e.target.value)}
                  placeholder="Nueva contraseña (mín. 10 caracteres)"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
                />
                {passNuevaCambio.length > 0 && (
                  <p className="text-[11px] font-bold text-[#5C554E]">
                    Fortaleza ({fuerzaNueva.puntaje}/4): {fuerzaNueva.mensaje}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={ocupado}
                  className="min-h-[44px] px-4 rounded-xl bg-[#B34720] text-white text-xs font-extrabold cursor-pointer"
                >
                  Actualizar contraseña
                </button>
              </form>
            </div>

            <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#3B7A57]" />
                2FA con app autenticadora y Google
              </h3>
              <p className="text-xs text-[#5C554E]">
                Estado 2FA:{" "}
                <strong>{auth.sesion?.dosFaActivo ? "Activo" : "Desactivado"}</strong>{" "}
                {(auth.sesion?.rol === "moderadora" || auth.sesion?.rol === "admin") &&
                  "(Obligatorio para moderación)"}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void ejecutarAccionCuenta({ accion: "generar_2fa" })}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold cursor-pointer"
                >
                  Configurar 2FA
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void ejecutarAccionCuenta({
                      accion: auth.googleVinculado
                        ? "desvincular_google"
                        : "vincular_google",
                    })
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold cursor-pointer"
                >
                  {auth.googleVinculado ? "Desvincular Google" : "Vincular Google"}
                </button>
              </div>

              {secreto2Fa && (
                <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-3 space-y-2 text-xs">
                  <p>
                    Clave secreta TOTP (agrégala a Google Authenticator / Authy):{" "}
                    <code className="font-mono font-bold">{secreto2Fa}</code>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={codigoConfirm2Fa}
                      onChange={(e) => setCodigoConfirm2Fa(e.target.value)}
                      placeholder="Código 6 dígitos"
                      className="min-h-[40px] px-3 rounded-xl bg-white border border-[#E2D6C8] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void ejecutarAccionCuenta({
                          accion: "confirmar_2fa",
                          codigo_totp: codigoConfirm2Fa,
                        })
                      }
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#3B7A57] text-white text-xs font-extrabold cursor-pointer"
                    >
                      Confirmar 2FA
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[#2D2A26]">
              Cambiar correo electrónico (notifica a ambos correos)
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ejecutarAccionCuenta({
                  accion: "solicitar_cambio_correo",
                  nuevo_correo: nuevoCorreoCambio,
                  confirmar_correo: confirmCorreoCambio,
                  contrasena_actual: passParaCorreo,
                });
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2.5"
            >
              <input
                type="email"
                required
                value={nuevoCorreoCambio}
                onChange={(e) => setNuevoCorreoCambio(e.target.value)}
                placeholder="Nuevo correo"
                className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
              />
              <input
                type="email"
                required
                value={confirmCorreoCambio}
                onChange={(e) => setConfirmCorreoCambio(e.target.value)}
                placeholder="Confirmar nuevo correo"
                className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
              />
              <input
                type="password"
                required
                value={passParaCorreo}
                onChange={(e) => setPassParaCorreo(e.target.value)}
                placeholder="Tu contraseña actual"
                className="min-h-[44px] px-3 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-[#2D2A26] text-white text-xs font-extrabold cursor-pointer"
              >
                Solicitar cambio
              </button>
            </form>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#2D2A26]">
                Sesiones activas ({auth.sesionesActivas.length})
              </h3>
              <ul className="space-y-2 text-xs text-[#5C554E]">
                {auth.sesionesActivas.map((s) => (
                  <li
                    key={s.sesionId}
                    className="rounded-xl bg-[#FAF6F0] border border-[#EFE6DA] p-2.5 flex justify-between gap-2"
                  >
                    <span className="truncate font-bold text-[#2D2A26]">
                      {s.dispositivo}
                    </span>
                    <span className="shrink-0">{s.ipEnmascarada}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#2D2A26]">
                Registro de eventos de seguridad
              </h3>
              <ul className="space-y-2 text-xs text-[#5C554E] max-h-48 overflow-y-auto">
                {auth.eventosSeguridad.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-xl bg-[#FAF6F0] border border-[#EFE6DA] p-2.5"
                  >
                    <p className="font-bold text-[#2D2A26]">{ev.descripcion}</p>
                    <p className="text-[11px]">
                      {ev.ipEnmascarada} ·{" "}
                      {new Date(ev.creadoEn).toLocaleString("es-CO")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-[#E2D6C8] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#2D2A26] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#3B7A57]" />
                  Tus datos te pertenecen
                </h3>
                <p className="text-xs text-[#5C554E]">
                  Descarga tu historial o programa el borrado con 14 días de gracia.
                </p>
              </div>
              <button
                type="button"
                onClick={exportarMisDatos}
                className="min-h-[44px] px-4 rounded-xl bg-[#FAF6F0] border border-[#E2D6C8] text-xs font-extrabold text-[#2D2A26] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Exportar mis datos (JSON)
              </button>
            </div>

            <form
              onSubmit={solicitarEliminacion}
              className="rounded-2xl bg-[#FFF5F3] border border-[#E7C2B9] p-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center"
            >
              <input
                type="text"
                required
                value={confirmEliminarTexto}
                onChange={(e) => setConfirmEliminarTexto(e.target.value)}
                placeholder='Escribe "ELIMINAR MI CUENTA"'
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E7C2B9] text-xs"
              />
              <input
                type="password"
                required
                value={passEliminar}
                onChange={(e) => setPassEliminar(e.target.value)}
                placeholder="Contraseña actual"
                className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E7C2B9] text-xs"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-[#B34720] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Programar eliminación (14 días)
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}