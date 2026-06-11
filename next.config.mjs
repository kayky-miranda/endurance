// Headers de segurança aplicados a todas as rotas. CSP completa exigiria
// nonces nos scripts inline do Next; aqui usamos só frame-ancestors (anti
// clickjacking), que não interfere em scripts/estilos.
const securityHeaders = [
  // Impede o navegador de "adivinhar" content-type (XSS via upload/download).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking: o app não pode ser embutido em iframes de terceiros.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Não vaza URLs internas (com slug do espaço) para sites externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Força HTTPS por 2 anos após o primeiro acesso (ignorado em http://localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // O app não usa câmera/microfone/geolocalização — nega para qualquer script.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // O SDK da Anthropic é um pacote Node puro; mantê-lo externo evita que o
  // bundler do Next tente empacotá-lo no servidor.
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@google/genai",
    "@prisma/client",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
