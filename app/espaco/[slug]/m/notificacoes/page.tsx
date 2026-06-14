import { getNotifications } from "@/lib/endurance/notifications";
import { getPixConfigView } from "@/lib/endurance/pix-service";
import { getWhatsAppConfigView } from "@/lib/endurance/whatsapp-service";
import NotificacoesClient from "../notificacoes-client";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";

// Notificações — central de alertas operacionais (estoque, financeiro, CRM)
// com envio por WhatsApp/e-mail + configuração das integrações PIX/WhatsApp.
export default async function NotificacoesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "notificacoes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const [data, pixConfig, whatsappConfig] = session
    ? await Promise.all([
        getNotifications(session.org),
        getPixConfigView(session.org),
        getWhatsAppConfigView(session.org),
      ])
    : [
        { items: [], counts: { estoque: 0, financeiro: 0, clientes: 0 } },
        null,
        null,
      ];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <NotificacoesClient
        items={data.items}
        counts={data.counts}
        pixConfig={pixConfig}
        whatsappConfig={whatsappConfig}
      />
    </div>
  );
}
