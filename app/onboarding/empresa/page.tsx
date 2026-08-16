import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MODULES } from "@/lib/endurance/catalog";
import AnalysisClient from "./analysis-client";

export const metadata: Metadata = {
  title: "ENDURANCE — conte sobre sua empresa",
  description:
    "Descreva sua operação para configurarmos a plataforma de acordo com ela.",
};

export default async function EmpresaPage() {
  // Esta etapa só existe depois da conta criada.
  const session = await getSession();
  if (!session) redirect("/onboarding");

  // Rótulos do catálogo para a lista de módulos sugeridos. O cliente recebe
  // só nome, nunca a regra de quem pode ligar o quê.
  const moduleLabels = Object.fromEntries(
    MODULES.map((m) => [m.id, m.label]),
  ) as Record<string, string>;

  return <AnalysisClient slug={session.slug} moduleLabels={moduleLabels} />;
}
