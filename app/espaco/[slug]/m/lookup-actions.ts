"use server";

import { getSession } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import {
  lookupCnpj,
  lookupCep,
  type CnpjLookupResult,
  type CepLookupResult,
} from "@/lib/endurance/cnpj-lookup";

/**
 * Consultas públicas (CNPJ/CEP) para auto-preencher formulários. Exigem
 * sessão (qualquer papel — é leitura de dado público, sem tocar no banco)
 * e têm rate limit por usuário para não abusar das APIs gratuitas.
 */

export async function lookupCnpjAction(cnpj: string): Promise<CnpjLookupResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  if (!(await hit(`lookup:cnpj:${session.sub}`, 20, 60_000)).ok)
    return { ok: false, error: "Muitas consultas seguidas. Aguarde um instante." };
  return lookupCnpj(cnpj);
}

export async function lookupCepAction(cep: string): Promise<CepLookupResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  if (!(await hit(`lookup:cep:${session.sub}`, 30, 60_000)).ok)
    return { ok: false, error: "Muitas consultas seguidas. Aguarde um instante." };
  return lookupCep(cep);
}
