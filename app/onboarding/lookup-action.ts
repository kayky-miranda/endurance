"use server";

import { lookupCnpj, type CnpjData } from "@/lib/endurance/cnpj-lookup";
import { hit, clientIp } from "@/lib/rate-limit";

/**
 * Consulta pública de CNPJ para a tela de cadastro.
 *
 * Existe separada da action equivalente do espaço porque esta roda SEM
 * sessão: quem está criando a conta ainda não tem uma. Por isso o limite por
 * IP, que a versão autenticada não precisa.
 */
export async function lookupCnpjPublicAction(
  cnpj: string,
): Promise<{ ok: true; data: CnpjData } | { ok: false; error: string }> {
  const rl = await hit(`cnpj:${await clientIp()}`, 15, 60_000);
  if (!rl.ok)
    return { ok: false, error: "Muitas consultas. Aguarde um instante." };
  return lookupCnpj(cnpj);
}
