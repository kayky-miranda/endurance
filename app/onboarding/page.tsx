import type { Metadata } from "next";
import { MODULES, NICHES } from "@/lib/endurance/catalog";
import { isOnboardingAIEnabled } from "@/lib/endurance/onboarding";
import OnboardingClient from "../onboarding-client";

export const metadata: Metadata = {
  title: "ENDURANCE — comece em 1 minuto",
  description:
    "Descreva seu negócio e a IA pré-configura o ERP com os módulos certos.",
};

export default function OnboardingPage() {
  // Catálogo é estático e seguro para enviar ao cliente (rótulos/descrições).
  return (
    <OnboardingClient
      niches={NICHES.map((n) => ({
        id: n.id,
        label: n.label,
        example: n.example,
      }))}
      modules={MODULES.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        scope: m.scope,
      }))}
      aiEnabled={isOnboardingAIEnabled()}
    />
  );
}
