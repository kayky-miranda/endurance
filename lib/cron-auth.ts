import "server-only";
import { timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";

/**
 * Autenticação dos endpoints de cron. Vercel Cron envia automaticamente o
 * header `Authorization: Bearer ${CRON_SECRET}` se a env existir — sem isso,
 * qualquer um poderia disparar o cron via HTTP público.
 *
 * Para chamadas manuais (ex.: rodar housekeeping ad-hoc), também aceita o
 * mesmo bearer.
 *
 * Em dev sem CRON_SECRET, libera com warning.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.error("Cron endpoint chamado sem CRON_SECRET definido — bloqueando");
      return false;
    }
    logger.warn("Cron endpoint sem CRON_SECRET — liberando em dev");
    return true;
  }
  const auth = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secret}`;
  // Comparação de tempo constante: `===` sai no primeiro byte diferente e, em
  // tese, deixa o tempo de resposta contar quantos caracteres do segredo já
  // estão certos. O ruído da rede torna o ataque impraticável na prática, mas
  // a comparação certa não custa nada. Os comprimentos precisam bater antes,
  // porque timingSafeEqual lança com buffers de tamanhos diferentes — e o
  // tamanho por si só não revela o segredo.
  const a = Buffer.from(auth);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
