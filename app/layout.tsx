import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ENDURANCE — ERP inteligente com IA",
    template: "%s · ENDURANCE",
  },
  description:
    "ERP completo com inteligência artificial: financeiro, vendas, estoque, compras, fiscal e mais em uma única plataforma.",
  metadataBase: new URL("https://endurance.com.br"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
