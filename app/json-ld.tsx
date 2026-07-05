import { PLAN_CATALOG } from "@/lib/endurance/billing";

const BASE = process.env.APP_URL || "https://endurance.com.br";

/**
 * JSON-LD `SoftwareApplication` + `Offer` para o Google entender que o
 * ENDURANCE é um SaaS empresarial pago em BRL. Vai no <head> da landing
 * e da /precos via <script>. Não é exibido para o usuário.
 */
export function SoftwareJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ENDURANCE",
    description:
      "ERP em nuvem com inteligência artificial para gestão financeira, vendas, estoque, compras, fiscal e marketing — feito para PMEs brasileiras.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: BASE,
    inLanguage: "pt-BR",
    provider: {
      "@type": "Organization",
      name: "ENDURANCE",
      url: BASE,
    },
    offers: PLAN_CATALOG.filter(
      (p) => p.priceMonthly !== null && p.priceMonthly > 0,
    ).map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.priceMonthly,
      priceCurrency: "BRL",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.priceMonthly,
        priceCurrency: "BRL",
        unitText: "MES",
        billingIncrement: 1,
      },
      url: `${BASE}/precos`,
      availability: "https://schema.org/InStock",
    })),
    aggregateRating: undefined, // ative quando tiver avaliações reais
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ENDURANCE",
    url: BASE,
    logo: `${BASE}/icon.png`,
    sameAs: [],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "suporte@endurance.app",
        areaServed: "BR",
        availableLanguage: ["Portuguese"],
      },
      {
        "@type": "ContactPoint",
        contactType: "data protection officer",
        email: "dpo@endurance.app",
        areaServed: "BR",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
