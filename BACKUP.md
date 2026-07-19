# Backup & Restore — ENDURANCE (produção)

Banco: PostgreSQL no **Neon** (schema `endurance_main`). Arquivos: **Cloudflare R2**.

## Camadas de proteção

1. **PITR do Neon (principal).** O Neon guarda o histórico do banco (WAL) e
   permite restaurar para qualquer instante dentro da janela de retenção.
   - Verifique/aumente a janela em: Console Neon → projeto → *Settings →
     Storage → History retention* (recomendado: **7 dias** ou mais no plano pago).
   - Restaurar: *Branches → Restore* → escolha data/hora → o Neon cria um
     branch com o estado daquele momento.
2. **Dump lógico semanal para o R2 (cinto e suspensório).** Protege contra
   perda da conta Neon e permite guardar retenção longa (90 dias).
   ```bash
   # requer pg_dump 16+ e as envs DATABASE_URL / STORAGE_S3_* do .env de produção
   node scripts/backup-db.mjs
   ```
   O script gera `backups/endurance-AAAA-MM-DD.sql.gz` e envia ao bucket R2
   em `backups/`. Agende semanalmente (Task Scheduler/cron de uma máquina de
   confiança, ou GitHub Actions com secrets).
3. **Arquivos (R2).** O bucket de uploads deve ter *versioning* ativado no
   painel da Cloudflare (Settings do bucket) — deleção acidental vira restore.

## Runbook de restore (incidente de dados)

1. **Congele escritas**: no Vercel, defina `MAINTENANCE=1` (ou pause o deploy)
   para evitar que dados novos se misturem ao restore.
2. **Identifique o instante** do incidente pelos logs (Sentry/ActivityLog).
3. **Restore pontual (preferido)**: Neon → *Restore* para o minuto anterior ao
   incidente, em um **branch novo**. Valide os dados no branch (Prisma Studio
   apontando para a connection string do branch).
4. **Corte**: aponte `DATABASE_URL` no Vercel para o branch restaurado
   (ou promova o branch a primary no Neon) e redeploye.
5. **Se o Neon estiver indisponível**: novo Postgres em qualquer provedor →
   `gunzip -c dump.sql.gz | psql $NOVA_URL` → `npx prisma migrate deploy` para
   conferir drift → atualizar `DATABASE_URL`.
6. **Pós-incidente**: registre no log de incidentes o que foi perdido entre o
   ponto de restore e o congelamento; comunique as organizações afetadas.

## Teste periódico (trimestral)

- Faça um restore PITR em branch descartável e rode
  `node scripts/health-db.mjs` (contagens por tabela) comparando com produção.
- Baixe o último dump do R2 e restaure em Postgres local. Backup que nunca foi
  restaurado não é backup.
