import type { Metadata } from "next";
import LegalShell from "../(legais)/legal-shell";

export const metadata: Metadata = {
  title: "Política de Privacidade — ENDURANCE",
  description:
    "Como o ENDURANCE coleta, usa e protege seus dados pessoais, em conformidade com a LGPD (Lei 13.709/2018).",
};

/**
 * STUB JURÍDICO. Este texto cobre os elementos exigidos pela LGPD (art. 9º) e
 * pelo Guia da ANPD: titulares, dados coletados, finalidades, bases legais,
 * compartilhamento, prazo de retenção, direitos do titular e contato do DPO.
 * Revisão jurídica é OBRIGATÓRIA antes de ir pra produção.
 */
export default function PrivacidadePage() {
  return (
    <LegalShell title="Política de Privacidade" updatedAt="17/06/2026">
      <p>
        Esta Política descreve como a <strong>ENDURANCE</strong> coleta, utiliza, armazena, compartilha e protege dados pessoais dos titulares que utilizam a plataforma, em conformidade com a Lei nº 13.709/2018 (LGPD).
      </p>

      <h2>1. Quem somos</h2>
      <p>
        ENDURANCE é uma plataforma de gestão empresarial (ERP) com inteligência artificial integrada. Atuamos como <strong>operadora</strong> dos dados que nossos clientes (controladores) tratam para gerir seus negócios, e como <strong>controladora</strong> dos dados de cadastro e uso da própria plataforma.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <h3>Dados de cadastro</h3>
      <ul>
        <li>Nome completo, e-mail, telefone e cargo da pessoa responsável pelo cadastro.</li>
        <li>Dados da empresa: razão social, CNPJ, endereço, segmento de atuação.</li>
        <li>Senha criptografada (bcrypt 12 rounds — nunca temos acesso ao texto claro).</li>
      </ul>
      <h3>Dados de uso</h3>
      <ul>
        <li>Endereço IP, navegador, sistema operacional, datas de acesso.</li>
        <li>Páginas visitadas, recursos utilizados e ações executadas (auditoria).</li>
        <li>Dados de telemetria de erros (anonimizados via Sentry).</li>
      </ul>
      <h3>Dados que você insere na plataforma</h3>
      <p>
        Os dados de clientes finais, fornecedores, produtos, vendas e operações financeiras inseridos na plataforma pertencem ao <strong>cliente controlador</strong>. Tratamos esses dados em nome dele, conforme as instruções do Contrato de Uso e desta Política.
      </p>

      <h2>3. Para que finalidades</h2>
      <ul>
        <li><strong>Execução do contrato</strong> (art. 7º, V LGPD): operação da plataforma, autenticação, suporte.</li>
        <li><strong>Cumprimento de obrigação legal</strong> (art. 7º, II): emissão e guarda de documentos fiscais.</li>
        <li><strong>Legítimo interesse</strong> (art. 7º, IX): prevenção a fraude, melhoria contínua e segurança.</li>
        <li><strong>Consentimento</strong> (art. 7º, I): comunicações de marketing, cookies não-essenciais.</li>
      </ul>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><strong>Provedores de infraestrutura</strong>: Neon (banco), Vercel (hospedagem), Cloudflare (CDN). Mantidos em conformidade com LGPD/GDPR.</li>
        <li><strong>Provedores de IA</strong>: Anthropic (Claude) e Google (Gemini) — usados para análises e geração de conteúdo. Os dados não são utilizados para treinamento de modelos.</li>
        <li><strong>Provedores de pagamento</strong>: Mercado Pago (PIX). Recebem apenas o necessário para processar a transação.</li>
        <li><strong>Provedor de e-mail transacional</strong>: Resend.</li>
        <li><strong>Provedor de telemetria de erros</strong>: Sentry, com mascaramento de campos sensíveis.</li>
        <li><strong>Autoridades públicas</strong>: SEFAZ (NFC-e) e quando exigido por ordem judicial.</li>
      </ul>

      <h2>5. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados de cadastro: enquanto a conta estiver ativa + 5 anos após o encerramento (prazo prescricional comercial).</li>
        <li>Dados fiscais (NFC-e, NF-e): 5 anos após o último dia do exercício financeiro (CTN art. 173).</li>
        <li>Logs de auditoria: 12 meses.</li>
        <li>Backups: ciclos de 30 dias.</li>
      </ul>

      <h2>6. Direitos do titular</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>Confirmar a existência de tratamento.</li>
        <li>Acessar e <strong>exportar seus dados</strong> via Configurações &rarr; Minha conta &rarr; Exportar dados.</li>
        <li>Corrigir dados incorretos.</li>
        <li>Solicitar <strong>exclusão da conta</strong> via Configurações &rarr; Minha conta &rarr; Excluir conta. Dados fiscais permanecem pelo prazo legal de retenção.</li>
        <li>Revogar consentimento de comunicações de marketing.</li>
        <li>Apresentar reclamação à <strong>ANPD</strong>.</li>
      </ul>

      <h2>7. Segurança</h2>
      <ul>
        <li>Comunicações criptografadas em trânsito (TLS 1.3, HSTS preload).</li>
        <li>Dados em repouso em provedores certificados SOC 2 / ISO 27001.</li>
        <li>Senhas com hash bcrypt (12 rounds). Tokens de e-mail apenas como SHA-256.</li>
        <li>RBAC granular, auditoria de ações sensíveis, rate limiting.</li>
        <li>Validação criptográfica de webhooks (HMAC).</li>
      </ul>

      <h2>8. Cookies</h2>
      <p>
        Utilizamos cookies essenciais (sessão de autenticação, preferências) e, mediante consentimento, cookies de análise de uso. Você pode rejeitar os não-essenciais no banner exibido no primeiro acesso ou em <a href="#" className="text-cyan-400 hover:underline">Preferências de cookies</a>.
      </p>

      <h2>9. Encarregado pelo Tratamento (DPO)</h2>
      <p>
        Para qualquer solicitação relacionada aos seus dados, escreva para <strong>dpo@endurance.app</strong>. Respondemos em até 15 dias corridos.
      </p>

      <h2>10. Atualizações desta Política</h2>
      <p>
        Atualizações materiais serão comunicadas por e-mail com 30 dias de antecedência. A versão vigente está sempre disponível nesta página.
      </p>
    </LegalShell>
  );
}
