import type { Metadata } from "next";
import LegalShell from "../(legais)/legal-shell";

export const metadata: Metadata = {
  title: "Termos de Uso — ENDURANCE",
  description: "Condições de uso da plataforma ENDURANCE para empresas brasileiras.",
};

/**
 * STUB JURÍDICO. Cobre o essencial: aceitação, objeto, planos, SLA, propriedade
 * intelectual, limitação de responsabilidade, rescisão, foro. Revisão de
 * advogado é OBRIGATÓRIA antes de produção.
 */
export default function TermosPage() {
  return (
    <LegalShell title="Termos de Uso" updatedAt="17/06/2026">
      <p>
        Estes Termos regulam o uso da plataforma <strong>ENDURANCE</strong>, oferecida pela [RAZÃO SOCIAL], CNPJ [00.000.000/0001-00], com sede em [ENDEREÇO]. Ao criar uma conta, você concorda com estas condições.
      </p>

      <h2>1. Objeto</h2>
      <p>
        ENDURANCE é uma plataforma de gestão empresarial (ERP) entregue como Software como Serviço (SaaS), com módulos de PDV, estoque, financeiro, fiscal, CRM, compras e marketing assistido por IA.
      </p>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>É necessário cadastrar uma empresa com CNPJ válido e um usuário responsável (OWNER).</li>
        <li>O e-mail deve ser confirmado para liberação de funções sensíveis (emissão fiscal, troca de plano).</li>
        <li>Você é responsável pela confidencialidade da senha. Recomendamos ativação de 2FA quando disponível.</li>
        <li>Usuários adicionais podem ser convidados; cada um tem responsabilidades pelas próprias ações.</li>
      </ul>

      <h2>3. Planos e cobrança</h2>
      <ul>
        <li><strong>Trial</strong>: 7 dias gratuitos, sem cartão de crédito. Acesso completo aos módulos contratados.</li>
        <li><strong>Planos pagos</strong>: cobrança recorrente mensal ou anual, conforme escolhido no cadastro.</li>
        <li>Faturas são emitidas pelo ciclo contratado. Atrasos podem suspender o acesso conforme prazo definido na fatura.</li>
        <li>Cancelamento pode ser feito a qualquer momento; o serviço continua disponível até o fim do ciclo já pago.</li>
        <li>Tributos são acrescidos conforme legislação vigente.</li>
      </ul>

      <h2>4. Uso aceitável</h2>
      <p>É vedado:</p>
      <ul>
        <li>Utilizar a plataforma para finalidades ilícitas, fraude ou lavagem.</li>
        <li>Tentar acessar dados de outros clientes (tentativas serão registradas e podem gerar exclusão imediata).</li>
        <li>Executar engenharia reversa, scraping intensivo ou ataques de carga.</li>
        <li>Revender ou redistribuir o serviço sem autorização escrita.</li>
      </ul>

      <h2>5. Disponibilidade e SLA</h2>
      <p>
        Trabalhamos para manter <strong>99,5%</strong> de disponibilidade mensal, excluídas janelas de manutenção comunicadas. Indisponibilidades superiores geram créditos em fatura conforme tabela:
      </p>
      <ul>
        <li>99,0–99,4% &rarr; 5% de crédito.</li>
        <li>97,0–98,9% &rarr; 10% de crédito.</li>
        <li>Abaixo de 97,0% &rarr; 25% de crédito.</li>
      </ul>

      <h2>6. Propriedade intelectual</h2>
      <p>
        O software, marca, código-fonte, design e materiais da plataforma são de titularidade da ENDURANCE. Os <strong>dados inseridos pelo cliente</strong> permanecem sob propriedade exclusiva dele.
      </p>

      <h2>7. Integrações de terceiros</h2>
      <p>
        Integrações com SEFAZ (NFC-e/NF-e), Mercado Pago (PIX), Meta WhatsApp, Anthropic e Google Gemini são oferecidas como facilidade e dependem da disponibilidade dos respectivos provedores. Indisponibilidades de terceiros não são contabilizadas no SLA da ENDURANCE.
      </p>

      <h2>8. Limitação de responsabilidade</h2>
      <p>
        A responsabilidade da ENDURANCE, em qualquer hipótese, fica limitada ao valor pago pelo cliente nos 12 meses anteriores ao evento gerador. Não respondemos por lucros cessantes ou danos indiretos.
      </p>

      <h2>9. Rescisão</h2>
      <p>
        O cliente pode encerrar a conta a qualquer momento via Minha conta &rarr; Excluir conta. A ENDURANCE pode encerrar com aviso de 30 dias ou imediatamente em caso de fraude/inadimplência grave/violação destes Termos. Após o encerramento, os dados ficam disponíveis para exportação por 30 dias e depois são eliminados ou anonimizados.
      </p>

      <h2>10. Alterações</h2>
      <p>
        Mudanças materiais nestes Termos serão comunicadas com 30 dias de antecedência. Continuar usando após esse prazo significa aceitar as novas condições.
      </p>

      <h2>11. Foro e legislação</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de [CIDADE/UF], com renúncia a qualquer outro.
      </p>
    </LegalShell>
  );
}
