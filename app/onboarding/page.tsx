import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SignupClient from "./signup-client";

export const metadata: Metadata = {
  title: "ENDURANCE — crie sua conta",
  description:
    "Cadastre sua empresa e configure a plataforma de acordo com a sua operação.",
};

export default async function OnboardingPage() {
  // Quem já tem sessão não precisa se cadastrar de novo.
  const session = await getSession();
  if (session) redirect(`/espaco/${session.slug}`);
  return <SignupClient />;
}
