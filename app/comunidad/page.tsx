import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import CommunityHubClient from "@/components/community/CommunityHubClient";
import {
  PREGUNTAS_DEMO,
  PUBLICACIONES_DEMO,
  RESPUESTAS_DEMO,
} from "@/lib/community/demoSeed";

export const metadata: Metadata = {
  title:
    "Comunidad de Modistas: Lo que cosieron y Pregúntale a la modista | MoldeFácil",
  description:
    "Muestra tus prendas confeccionadas, haz preguntas técnicas de costura y abre moldes compartidos con tus propias medidas sin exponer datos sensibles.",
  openGraph: {
    title: "Comunidad de Modistas | MoldeFácil",
    description:
      "Galería colaborativa de costura, preguntas y respuestas de patronaje, retos mensuales y guías PDF imprimibles.",
    type: "website",
  },
};

export default function ComunidadPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ...PUBLICACIONES_DEMO.slice(0, 4).map((pub) => ({
        "@type": "ImageObject",
        name: pub.titulo,
        caption: pub.aprendizaje_nota,
        contentUrl: pub.fotos[0]?.url,
      })),
      ...PREGUNTAS_DEMO.slice(0, 3).map((preg) => {
        const resp = RESPUESTAS_DEMO.find(
          (r) => r.pregunta_id === preg.id && r.es_aceptada
        );
        return {
          "@type": "QAPage",
          mainEntity: {
            "@type": "Question",
            name: preg.titulo,
            text: preg.detalle,
            answerCount: preg.conteo_respuestas,
            ...(resp
              ? {
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: resp.contenido,
                  },
                }
              : {}),
          },
        };
      }),
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#2D2A26]">
      <SiteHeader />
      <main className="flex-1">
        <CommunityHubClient />
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}