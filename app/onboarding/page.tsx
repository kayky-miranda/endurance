import type { Metadata } from "next";
import { MODULES, availableNiches } from "@/lib/endurance/catalog";
import {
  modulePlanFeature,
  planRequiredFor,
  planLabel,
} from "@/lib/endurance/billing";
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
      niches={availableNiches().map((n) => ({
        id: n.id,
        label: n.label,
        example: n.example,
      }))}
      modules={MODULES.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        scope: m.scope,
        // Módulo que existe mas depende de plano superior. Sem esta marca o
        // cliente via o item na lista de "o que você recebe" no momento da
        // adesão e encontrava cadeado depois de entrar.
        requiresPlan: modulePlanFeature(m.id)
          ? planLabel(planRequiredFor(modulePlanFeature(m.id)!) ?? "business")
          : null,
      }))}
      aiEnabled={isOnboardingAIEnabled()}
    />
  );
}
