import React from "react";
import Link from "next/link";
import { ArrowRight, Scissors } from "lucide-react";
import { ContentBlock, GeneratorAction } from "@/lib/blogPosts";
import AdBanner from "@/components/AdBanner";
import QuickSummaryCard from "./QuickSummaryCard";
import AtelierCallout from "./AtelierCallout";
import SewingIllustration from "./SewingIllustration";
import ArticleWidget from "./ArticleWidgets";

interface BlogArticleRendererProps {
  blocks: ContentBlock[];
  action: GeneratorAction;
  slug: string;
  readingTime?: string;
}

function GeneratorCtaCard({
  action,
  compact = false,
}: {
  action: GeneratorAction;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border-2 border-[#C85A32]/35 bg-gradient-to-br from-[#FAF6F0] via-white to-[#FDF3EE] shadow-xs ${
        compact ? "p-5" : "p-6 sm:p-7"
      } space-y-3`}
    >
      <div className="flex items-center gap-2.5 text-[#C85A32] font-extrabold text-xs sm:text-sm uppercase tracking-wider">
        <Scissors className="h-4 w-4 shrink-0" />
        <span>De la guía a tu mesa de corte</span>
      </div>
      <p className="text-base sm:text-lg font-extrabold text-[#2D2A26] leading-snug">
        {action.description}
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href={action.href}
          className="min-h-[50px] px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-base font-extrabold shadow-md shadow-rose-600/20 inline-flex items-center gap-2 transition"
        >
          <span>{action.label}</span>
        </Link>
        {action.secondaryLink && (
          <Link
            href={action.secondaryLink.href}
            className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white hover:bg-[#F2F7F4] text-[#1E3F2D] border-2 border-[#3B7A57]/35 text-sm font-bold inline-flex items-center gap-1.5 transition"
          >
            <span>{action.secondaryLink.label}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function BlogArticleRenderer({
  blocks,
  action,
  slug,
  readingTime,
}: BlogArticleRendererProps) {
  const midPoint = Math.max(2, Math.floor(blocks.length / 2));

  return (
    <div className="space-y-6 max-w-3xl">
      {blocks.map((block, index) => {
        const showMidInsert = index === midPoint;
        return (
          <React.Fragment key={`${slug}-block-${index}`}>
            {block.type === "resumen_rapido" && (
              <QuickSummaryCard
                points={block.puntos}
                readingTime={readingTime}
              />
            )}

            {block.type === "subtitulo" && (
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#2D2A26] pt-2 leading-tight">
                {block.texto}
              </h2>
            )}

            {block.type === "parrafo" && (
              <p className="text-[17px] sm:text-[18px] text-[#2D2A26]/90 leading-relaxed">
                {block.texto}
              </p>
            )}

            {block.type === "truco_taller" && (
              <AtelierCallout
                variant="truco"
                title={block.titulo}
                text={block.texto}
              />
            )}

            {block.type === "alerta_tijera" && (
              <AtelierCallout
                variant="alerta"
                title={block.titulo}
                text={block.texto}
              />
            )}

            {block.type === "ilustracion_svg" && (
              <SewingIllustration
                tipo={block.tipo}
                titulo={block.titulo}
                nota={block.nota}
              />
            )}

            {block.type === "widget_interactivo" && (
              <ArticleWidget widget={block.widget} />
            )}

            {block.type === "tabla_comparativa" && (
              <div className="rounded-3xl bg-white border border-[#E5DCD0] p-4 sm:p-5 shadow-xs space-y-3">
                <h3 className="text-base sm:text-lg font-extrabold text-[#2D2A26]">
                  {block.titulo}
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-[#E5DCD0]">
                  <table className="w-full text-left border-collapse text-sm sm:text-base">
                    <thead>
                      <tr className="bg-[#FAF6F0] border-b border-[#E5DCD0]">
                        {block.encabezados.map((header) => (
                          <th
                            key={header}
                            className="py-3 px-3.5 font-extrabold text-[#2D2A26] whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EAE1]">
                      {block.filas.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="hover:bg-[#FAF6F0]/60 transition"
                        >
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`py-3 px-3.5 align-top leading-snug ${
                                cellIdx === 0
                                  ? "font-bold text-[#2D2A26]"
                                  : "text-[#4A453F]"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showMidInsert && (
              <div className="rounded-3xl bg-[#FAF6F0] border border-[#E5DCD0] p-4 sm:p-5 flex justify-center">
                <AdBanner
                  variant="box-ad"
                  adSlotId={`blog-mid-300x250-${slug}`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Puente directo al Generador al final de la guía */}
      <GeneratorCtaCard action={action} />
    </div>
  );
}
