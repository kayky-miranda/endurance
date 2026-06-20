import type { MetadataRoute } from "next";

const BASE = process.env.APP_URL || "https://endurance.com.br";

/**
 * Sitemap apenas com rotas PÚBLICAS — /entrar, /espaco/* e /api/* não devem
 * ser indexadas (e o robots.ts confirma essa diretriz).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/precos`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
