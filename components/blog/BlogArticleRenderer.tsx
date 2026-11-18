import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Lightbulb, Scissors } from "lucide-react";
import { BlogContentBlock, GeneratorAction } from "@/lib/blogPosts";
import AdBanner from "@/components/AdBanner";
import InteractiveFabricTable from "./InteractiveFabricTable";
import ArticleSvgDiagram from "./ArticleSvgDiagram";

interface BlogArticleRendererProps {
  blocks: BlogContentBlock[];
  action: GeneratorAction;
  slug: string;
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
      className={`rounded-3xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 shadow-xs ${
        compact ? "p-5" : "p-6 sm:p-7"
      } space-y-3`}
    >
      <div className="flex items-center gap-2.5 text-rose-700 font-extrabold text-sm uppercase tracking-wide">
        <Scissors className="h-4 w-4 shrink-0" />
        <span>Lleva esta guía a tu mesa de corte</span>
      </div>
      <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
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
            className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-teal-800 border-2 border-teal-200 text-sm font-bold inline-flex items-center gap-1.5 transition"
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
}: BlogArticleRendererProps) {
  const midPoint = Math.max(2, Math.floor(blocks.length / 2));

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        const showMidInsert = index === midPoint;
        return (
          <React.Fragment key={`${slug}-block-${index}`}>
            {block.type === "heading" && (
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 pt-2 leading-tight">
                {block.text}
              </h2>
            )}

            {block.type === "paragraph" && (
              <p className="text-base sm:text-[17px] text-slate-700 leading-relaxed">
                {block.text}
              </p>
            )}

            {block.type === "tip" && (
              <aside
                className={`rounded-3xl p-5 border-2 space-y-1.5 ${
                  block.tone === "rose"
                    ? "bg-rose-50 border-rose-200 text-rose-950"
                    : block.tone === "amber"
                      ? "bg-amber-50 border-amber-200 text-amber-950"
                      : "bg-teal-50 border-teal-200 text-teal-950"
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-base">
                  <Lightbulb className="h-5 w-5 shrink-0" />
                  <span>{block.title}</span>
                </div>
                <p className="text-sm sm:text-base leading-relaxed opacity-90">
                  {block.text}
                </p>
              </aside>
            )}

            {block.type === "checklist" && (
              <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {block.title}
                </h3>
                <ul className="space-y-2.5">
                  {block.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700 leading-relaxed"
                    >
                      <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {block.type === "table" && (
              <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  {block.caption}
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-sm sm:text-base">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {block.headers.map((header) => (
                          <th
                            key={header}
                            className="py-3 px-3.5 font-extrabold text-slate-800 whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {block.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="hover:bg-[#FAF8F5] transition"
                        >
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`py-3 px-3.5 align-top leading-snug ${
                                cellIdx === 0
                                  ? "font-bold text-slate-900"
                                  : "text-slate-700"
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

            {block.type === "interactiveFabricTable" && (
              <InteractiveFabricTable title={block.title} note={block.note} />
            )}

            {block.type === "svgDiagram" && (
              <ArticleSvgDiagram
                diagram={block.diagram}
                title={block.title}
                caption={block.caption}
              />
            )}

            {showMidInsert && (
              <div className="space-y-5 py-2">
                <GeneratorCtaCard action={action} compact />
                <div className="flex justify-center">
                  <AdBanner
                    variant="box-ad"
                    adSlotId={`blog-mid-300x250-${slug}`}
                  />
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Final Generator CTA */}
      <GeneratorCtaCard action={action} />
    </div>
  );
}
