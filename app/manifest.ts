import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA). O Next injeta <link rel="manifest"> automaticamente.
 * Ícones gerados por scripts/gen-brand.mjs a partir da bússola ENDURANCE.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ENDURANCE — ERP inteligente com IA",
    short_name: "ENDURANCE",
    description:
      "ERP completo com IA: financeiro, vendas, estoque, compras e fiscal em uma única plataforma.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1117",
    theme_color: "#0f1117",
    lang: "pt-BR",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
