import type { MetadataRoute } from "next";

const BASE = process.env.APP_URL || "https://endurance.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // Áreas privadas e endpoints internos não devem ser indexados.
        disallow: [
          "/espaco/",
          "/entrar",
          "/recuperar",
          "/redefinir/",
          "/convite/",
          "/api/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
