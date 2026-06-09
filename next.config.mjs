/** @type {import('next').NextConfig} */
const nextConfig = {
  // O SDK da Anthropic é um pacote Node puro; mantê-lo externo evita que o
  // bundler do Next tente empacotá-lo no servidor.
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@google/genai",
    "@prisma/client",
  ],
};

export default nextConfig;
