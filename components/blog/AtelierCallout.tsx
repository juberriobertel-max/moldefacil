import React from "react";
import { AlertTriangle, Lightbulb, Scissors } from "lucide-react";

interface AtelierCalloutProps {
  variant: "truco" | "alerta";
  title?: string;
  text: string;
}

export default function AtelierCallout({
  variant,
  title,
  text,
}: AtelierCalloutProps) {
  if (variant === "truco") {
    return (
      <aside
        aria-label="Truco de Taller"
        className="rounded-3xl bg-[#F2F7F4] border-2 border-[#C4DDD0] p-5 sm:p-6 shadow-2xs space-y-2"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#3B7A57] text-white flex items-center justify-center shrink-0">
            <Lightbulb className="h-5 w-5" />
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-[#1E3F2D]">
            {title || "💡 Truco de Taller"}
          </h3>
        </div>
        <p className="text-[16px] sm:text-[17px] text-[#264735] leading-relaxed pl-0 sm:pl-11">
          {text}
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Advertencia antes de cortar"
      className="rounded-3xl bg-[#FDF3EE] border-2 border-[#ECC5B4] p-5 sm:p-6 shadow-2xs space-y-2"
    >
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-[#C85A32] text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h3 className="text-base sm:text-lg font-extrabold text-[#6E2B14] flex items-center gap-2">
          <span>{title || "⚠️ ¡Cuidado antes de cortar!"}</span>
          <Scissors className="h-4 w-4 text-[#C85A32] hidden sm:inline" />
        </h3>
      </div>
      <p className="text-[16px] sm:text-[17px] text-[#5C2612] leading-relaxed pl-0 sm:pl-11">
        {text}
      </p>
    </aside>
  );
}
