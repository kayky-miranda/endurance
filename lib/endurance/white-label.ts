import "server-only";
import { checkPlanFeature } from "./plan-limits";

/**
 * Marca própria: esconder o ENDURANCE do que o CLIENTE FINAL vê.
 *
 * A capacidade era anunciada como "documentos e portal com a identidade da sua
 * marca" — e o timbre (logo, cor, endereço, rodapé) já funcionava em TODO plano,
 * via `DocumentShell`. Ou seja: a promessa já estava entregue de graça, e
 * cobrá-la exigiria tirar de quem já usa. Documento de paciente sem identidade
 * da clínica é higiene profissional, não recurso premium.
 *
 * O que sobrava de fato para diferenciar era a assinatura do FORNECEDOR — o
 * "Gerado por ENDURANCE" no pé do recibo, do pedido ao fornecedor e dos
 * relatórios. Esses papéis saem da clínica e chegam ao cliente dela, ao
 * fornecedor dela, ao contador dela. Para uma rede ou franquia, aparecer como
 * revenda de um sistema de terceiros é exatamente o que se quer evitar — e é
 * uma diferença real, que ninguém perde ao não contratar.
 */
export async function hidesVendorBrand(orgId: string): Promise<boolean> {
  return (await checkPlanFeature(orgId, "white.label")).ok;
}

/**
 * Texto de rodapé do fornecedor, ou `null` quando a organização tem marca
 * própria. Devolver null (e não string vazia) obriga o call-site a decidir se
 * remove a linha inteira — um rodapé vazio deixaria um espaço órfão na folha.
 */
export async function vendorFooter(
  orgId: string,
  text: string,
): Promise<string | null> {
  return (await hidesVendorBrand(orgId)) ? null : text;
}
