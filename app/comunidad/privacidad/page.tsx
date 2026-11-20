import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, EyeOff, Lock, ShieldCheck, Trash2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Privacidad y Protección de Datos | Comunidad MoldeFácil",
  description:
    "Cómo protegemos tus medidas corporales, eliminamos metadatos EXIF/GPS de tus fotos y te damos control total para exportar o borrar tu cuenta.",
};

export default function PrivacidadComunidadPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#2D2A26]">
      <SiteHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/comunidad"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2D6C8] text-sm font-bold text-[#2D2A26] hover:border-[#C85A32] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]"
          >
            <ArrowLeft className="w-4 h-4 text-[#B34720]" />
            Volver a la Comunidad
          </Link>
          <Link
            href="/comunidad/normas"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#EFE6DA] text-sm font-bold text-[#2D2A26] hover:bg-[#E5D7C5] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]"
          >
            Ver Normas de Convivencia
          </Link>
        </div>

        <section className="rounded-3xl bg-white border border-[#E2D6C8] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3B7A57]/12 text-[#28593D] text-xs font-extrabold">
            <ShieldCheck className="w-4 h-4" />
            Privacidad por diseño
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2D2A26]">
            Tu Privacidad en la Comunidad de Modistas
          </h1>
          <p className="text-sm sm:text-base text-[#5C554E] leading-relaxed">
            Creemos que compartir el diseño de un molde nunca debe significar exponer tu cuerpo ni tu ubicación. Por eso aplicamos controles automáticos tanto en tu navegador como en la validación del servidor.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#3B7A57]" />
                Medidas corporales nunca públicas
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Al compartir un molde solo se guarda el estilo (categoría, escote, manga, holgura, largo, margen de costura y tela 3D). Las 12 medidas corporales se eliminan y bloquean por esquema antes de guardar o enviar. Cuando alguien pulsa “Hacer este molde”, el patrón se abre con <strong>sus propias medidas</strong>.
              </p>
            </article>

            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-[#B34720]" />
                Limpieza de EXIF, GPS y recorte
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Cada foto que subes se vuelve a codificar en tu dispositivo (máximo 1600 px, objetivo ≤ 400 KB) eliminando por completo metadatos de cámara y coordenadas GPS. Además, el servidor vuelve a comprobar la firma binaria y rechaza imágenes con bloques EXIF residuales. También puedes recortar para no mostrar el rostro y activar marca de agua.
              </p>
            </article>

            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-[#3B7A57]" />
                Portabilidad en JSON
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Desde la pestaña “Mi Perfil y Ajustes” puedes descargar en cualquier momento un archivo JSON completo con tu perfil, publicaciones, comentarios y preguntas en un clic.
              </p>
            </article>

            <article className="rounded-2xl bg-[#FAF6F0] border border-[#E2D6C8] p-5 space-y-2">
              <h2 className="font-extrabold text-base flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-[#B34720]" />
                Borrado real, cuentas seguras y encargos (30 días revocable)
              </h2>
              <p className="text-sm text-[#5C554E] leading-relaxed">
                Tu cuenta usa cookies <code>httpOnly</code>, verificación anti-contraseñas filtradas (HIBP k-anonimato), 2FA opcional (obligatorio para moderación) y borrado con 14 días de gracia. En las estadísticas de calce (<strong>k ≥ 5</strong>) agrupamos medidas en rangos de 5 cm sin mostrar números exactos. En encargos, tus medidas están ocultas por defecto y si decides compartirlas con una modista el permiso caduca a los 30 días o cuando tú lo revoques (con registro de auditoría de cada consulta).
              </p>
            </article>
          </div>

          <div
            role="note"
            className="rounded-2xl bg-[#FFF6F2] border-2 border-[#E6B8A5] p-5 space-y-2"
          >
            <h2 className="text-base font-extrabold text-[#8A3112]">
              Aspectos recomendados para revisar con asesoría legal antes de escalar
            </h2>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#5C554E] space-y-1">
              <li>Edad mínima legal de consentimiento digital según país de destino (Colombia, México, Argentina, España: 14 a 18 años según jurisdicción).</li>
              <li>Aviso explícito de intermediación gratuita sin pasarela de pagos ni responsabilidad por acuerdos privados entre clientas y modistas.</li>
              <li>Conservación de logs de seguridad IP enmascarados y plazos reales de eliminación definitiva (14 días).</li>
            </ul>
            <p className="text-sm text-[#5C554E] leading-relaxed">
              Estos textos reflejan el funcionamiento técnico real de la aplicación. Antes de lanzar campañas masivas o recibir usuarias de distintos países, <strong>revisa y adapta este aviso de privacidad y términos de uso con un profesional legal especializado en protección de datos de tu país</strong> (por ejemplo Ley 1581 en Colombia, LFPDPPP en México, LGPD en Brasil o RGPD en Europa).
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}