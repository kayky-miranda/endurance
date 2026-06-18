// CSP — Next 15 com Turbopack precisa de 'unsafe-inline' para CSS-in-JS de
// terceiros (Recharts) e para o runtime do React. 'unsafe-eval' fica fora em
// produção para barrar a maior parte das técnicas de XSS. APIs externas
// liberadas em connect-src: Anthropic/Gemini (server-side, mas o fetch pode
// vazar caso movido pro client), Mercado Pago, Meta WhatsApp, fonts.
const cspProd = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://api.anthropic.com https://generativelanguage.googleapis.com https://api.mercadopago.com https://graph.facebook.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Em dev o CSP fica mais frouxo pra não brigar com HMR e Fast Refresh.
const cspDev = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' ws: wss: https:",
  "frame-ancestors 'none'",
].join("; ");

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Impede o navegador de "adivinhar" content-type (XSS via upload/download).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking: o app não pode ser embutido em iframes de terceiros.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: isProd ? cspProd : cspDev },
  // Não vaza URLs internas (com slug do espaço) para sites externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Força HTTPS por 2 anos após o primeiro acesso (ignorado em http://localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // O app não usa câmera/microfone/geolocalização — nega para qualquer script.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Isolamento de origem (defense-in-depth contra Spectre).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
    "playwright",
    "playwright-core",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
