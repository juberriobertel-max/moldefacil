"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  FASHION_STYLES_CATALOG,
  FashionStylePreset,
} from "@/lib/fashionStylesCatalog";
import { GarmentCategory, Measurements } from "@/lib/types";

interface HomeQueryParamsSyncProps {
  onApplyPreset: (preset: FashionStylePreset) => void;
  onSelectCategory: (cat: GarmentCategory) => void;
  onUpdateMeasurements: (patch: Partial<Measurements>) => void;
  onSelectMode: (mode: "styles" | "scanner" | "template") => void;
}

const STYLE_ALIAS_MAP: Record<string, string> = {
  cruzado: "wrap_dress",
  wrap_dress: "wrap_dress",
  imperio: "empire_dress",
  empire_dress: "empire_dress",
  camisero: "shirt_dress",
  shirt_dress: "shirt_dress",
  boho: "boho_ruffle_dress",
  boho_ruffle_dress: "boho_ruffle_dress",
  veraniego: "summer_two_piece",
  summer_two_piece: "summer_two_piece",
  sastre: "tailored_two_piece",
  tailored_two_piece: "tailored_two_piece",
  campesina: "peasant_blouse",
  peasant_blouse: "peasant_blouse",
  oficina: "office_blouse",
  office_blouse: "office_blouse",
  circular: "circle_skirt",
  circle_skirt: "circle_skirt",
  lapiz: "pencil_skirt",
  pencil_skirt: "pencil_skirt",
  palazzo: "palazzo_pants",
  palazzo_pants: "palazzo_pants",
  short: "high_waist_shorts",
  high_waist_shorts: "high_waist_shorts",
};

const PRENDA_CATEGORY_MAP: Record<string, GarmentCategory> = {
  blusa: "top",
  top: "top",
  vestido: "dress",
  dress: "dress",
  falda: "skirt",
  skirt: "skirt",
  pantalon: "pants",
  pants: "pants",
  conjunto: "two_piece",
  two_piece: "two_piece",
  enterizo: "jumpsuit",
  jumpsuit: "jumpsuit",
  ninos: "kids",
  kids: "kids",
  pijama: "loungewear",
  loungewear: "loungewear",
  accesorios: "accessories",
  accessories: "accessories",
};

export default function HomeQueryParamsSync({
  onApplyPreset,
  onSelectCategory,
  onUpdateMeasurements,
  onSelectMode,
}: HomeQueryParamsSyncProps) {
  const searchParams = useSearchParams();
  const appliedKeyRef = useRef<string>("");

  useEffect(() => {
    const queryKey = searchParams.toString();
    if (!queryKey || appliedKeyRef.current === queryKey) return;
    appliedKeyRef.current = queryKey;

    const estiloParam = searchParams.get("estilo")?.toLowerCase() ?? "";
    const prendaParam = searchParams.get("prenda")?.toLowerCase() ?? "";

    const mappedStyleId = STYLE_ALIAS_MAP[estiloParam];
    if (mappedStyleId) {
      const preset = FASHION_STYLES_CATALOG.find((s) => s.id === mappedStyleId);
      if (preset) {
        onApplyPreset(preset);
        onSelectMode("styles");
      }
    } else if (prendaParam && PRENDA_CATEGORY_MAP[prendaParam]) {
      onSelectCategory(PRENDA_CATEGORY_MAP[prendaParam]);
      onSelectMode("template");
    }

    const patch: Partial<Measurements> = {};
    const numParam = (name: string) => {
      const raw = searchParams.get(name);
      if (!raw) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    const bust = numParam("bust");
    const waist = numParam("waist");
    const hip = numParam("hip");
    const skirtLength = numParam("skirtLength");
    if (bust) patch.bust = bust;
    if (waist) patch.waist = waist;
    if (hip) patch.hip = hip;
    if (skirtLength) patch.skirtLength = skirtLength;

    if (Object.keys(patch).length > 0) {
      onUpdateMeasurements(patch);
    }
  }, [
    searchParams,
    onApplyPreset,
    onSelectCategory,
    onUpdateMeasurements,
    onSelectMode,
  ]);

  return null;
}
