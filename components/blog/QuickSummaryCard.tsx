import React from "react";
import { Clock, Scissors } from "lucide-react";

interface QuickSummaryCardProps {
  points: string[];
  readingTime?: string;
}

export default function QuickSummaryCard({
  points,
  readingTime,
}: QuickSummaryCardProps) {
  return (
    <section
      aria-label="Resumen rápido en 15 segundos"
      className="rounded-3xl bg-[#FAF6F0] border border-[#E8DFD3] border-l-[6px] border-l-[#C85A32] p-5 sm:p-6 shadow-xs space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center shrink-0">
            <Scissors className="h-5 w-5" />
          </span>
          <h2 className="text-base sm:text-lg font-extrabold text-[#2D2A26] tracking-tight">
            ⚡ En 15 segundos (Lo esencial)
          </h2>
        </div>

        {readingTime && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-[#E8DFD3] text-xs font-bold text-[#5C554E]">
            <Clock className="h-3.5 w-3.5 text-[#C85A32]" />
            Lectura completa: {readingTime}
          </span>
        )}
      </div>

      <ul className="space-y-2.5 pt-1">
        {points.map((point, index) => (
          <li
            key={index}
            className="flex items-start gap-3 text-[16px] sm:text-[17px] text-[#2D2A26] leading-snug"
          >
            <span className="w-6 h-6 rounded-full bg-[#C85A32] text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
              {index + 1}
            </span>
            <span className="font-medium">{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
