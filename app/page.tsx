import type { Metadata } from "next";
import Landing from "./landing";

export const metadata: Metadata = {
  title: {
    absolute: "ENDURANCE — ERP inteligente com IA para a gestão da sua empresa",
  },
  description:
    "Financeiro, vendas, estoque, compras, fiscal e mais em uma única plataforma com inteligência artificial. Centralize a operação, automatize tarefas e decida com dados.",
  keywords: [
    "ERP",
    "sistema de gestão",
    "ERP com IA",
    "gestão empresarial",
    "financeiro",
    "estoque",
    "fiscal",
    "NF-e",
    "automação",
  ],
  openGraph: {
    title: "ENDURANCE — ERP inteligente com IA",
    description:
      "A gestão completa da sua empresa, guiada por inteligência. Centralize a operação e automatize decisões.",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "ENDURANCE — ERP inteligente com IA",
    description:
      "A gestão completa da sua empresa, guiada por inteligência artificial.",
  },
};

export default function Home() {
  return <Landing />;
}
