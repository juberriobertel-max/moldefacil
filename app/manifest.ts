import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoldeFácil — Patronaje a Medida y Comunidad",
    short_name: "MoldeFácil",
    description:
      "Genera moldes de costura gratis en PDF 1:1, consulta guías sin conexión y comparte tus prendas en la comunidad de modistas.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF6F0",
    theme_color: "#C85A32",
    lang: "es",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
