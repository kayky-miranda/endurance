import "server-only";
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
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
