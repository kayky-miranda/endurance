# Deploy do ENDURANCE na Vercel

Stack: Next.js 15 (App Router) + Prisma + **PostgreSQL**.

> SQLite **não** funciona na Vercel (filesystem serverless é efêmero). Por isso o
> `datasource` do Prisma já está em `postgresql`. Use um Postgres hospedado
> (Neon, Supabase, Vercel Postgres, etc.).

## 1. Banco (uma vez)

1. Tenha a connection string Postgres em mãos. Para serverless, prefira a URL
   **com pooling** (Neon: `...-pooler...`; Supabase: porta `6543` / `pgbouncer=true`).
2. No seu `.env` local (NÃO commitar — já está no `.gitignore`):
   ```env
   DATABASE_URL="postgresql://USUARIO:SENHA@HOST:5432/DB?sslmode=require"
   ```
3. Crie as tabelas no Postgres:
   ```bash
   npm run db:push
   ```
   (Opcional) popular dados de demonstração: rode os scripts em `scripts/seed-*.mjs`.

## 2. Variáveis de ambiente (na Vercel)

Em **Project → Settings → Environment Variables**, adicione (Production + Preview):

| Variável          | Obrigatória | Observação                                                        |
| ----------------- | ----------- | ----------------------------------------------------------------- |
| `DATABASE_URL`    | ✅          | Mesma string Postgres (use a URL com pooling).                    |
| `AUTH_SECRET`     | ✅          | Segredo aleatório p/ assinar o JWT de sessão. Gere com o comando abaixo. |
| `GEMINI_API_KEY`  | ⛔ opcional | IA do onboarding (tier grátis). Sem ela, roda em modo demonstração. |
| `ANTHROPIC_API_KEY` | ⛔ opcional | Alternativa de IA (Claude).                                     |
| `RESEND_API_KEY`  | ⚠️ recomendada | E-mail transacional (verificação, reset, convite). Sem ela, e-mails ficam em **modo stub** (logam no console, não são entregues). Veja a seção 4. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ⚠️ recomendada | Rate limit **global** entre instâncias serverless. Sem elas, o limite é por processo (fraco em produção). Banco grátis em [upstash.com](https://upstash.com). |
| `STORAGE_S3_*` + `STORAGE_PUBLIC_BASE_URL` | ✅ **obrigatória em prod** | Storage durável (S3/R2) para carrosséis, logos e XML fiscal. Sem elas, grava em `public/` — **efêmero no serverless** (some no deploy). Use Cloudflare R2 (barato) ou AWS S3. |
| `ASAAS_API_KEY` + `ASAAS_ENV` + `ASAAS_WEBHOOK_TOKEN` | 🟡 cobrança | Assinatura recorrente via Asaas (PIX/boleto/cartão). Sem a chave, cobrança fica em modo manual (auto-gerido). Cadastre o webhook no painel Asaas apontando para `/api/billing/webhook` com o mesmo `ASAAS_WEBHOOK_TOKEN`. |
| `EMAIL_FROM`      | ⛔ opcional | Remetente. Padrão `ENDURANCE <noreply@endurance.app>`. O domínio precisa estar verificado no Resend. |
| `APP_URL`         | ✅ (se usar e-mail) | URL pública (ex.: `https://endurance.app`). Compõe os links dos e-mails; em dev cai em `http://localhost:3200`. |

Gerar um `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. GitHub + Vercel

1. Crie um repositório **privado** vazio no GitHub (sem README/.gitignore).
2. Conecte o remoto e faça o push:
   ```bash
   git remote add origin https://github.com/<voce>/<repo>.git
   git branch -M main
   git push -u origin main
   ```
3. Na Vercel: **Add New → Project → Import** o repositório.
   - Framework: Next.js (detectado automaticamente).
   - Build Command: `npm run build` (já roda `prisma generate && next build`).
   - Defina as variáveis da seção 2 antes do primeiro deploy.
4. **Deploy**. A cada push na `main`, a Vercel publica automaticamente.

## 4. E-mail transacional (Resend) — para enviar de verdade

Sem `RESEND_API_KEY` o app funciona, mas os e-mails de verificação, reset de
senha e convite ficam em **modo stub** (apenas logados no servidor). Para
entregar de verdade:

1. Crie uma conta em [resend.com](https://resend.com) e gere uma API key em
   **API Keys**. Coloque-a em `RESEND_API_KEY` (seção 2).
2. **Verifique o domínio** em **Domains → Add Domain** (`endurance.app`). O
   Resend mostra os registros **DNS** (SPF/`TXT` e DKIM/`CNAME` ou `TXT`) que
   você precisa adicionar no seu provedor de DNS. Essa etapa é manual e só você
   consegue fazer (acesso ao DNS do domínio). Sem domínio verificado, o Resend
   recusa o envio com `403` — o app trata isso como falha permanente e não fica
   tentando.
3. Ajuste `EMAIL_FROM` para um endereço **no domínio verificado**
   (ex.: `ENDURANCE <noreply@endurance.app>`) e `APP_URL` para a URL pública.
4. Faça um envio de teste: use "Esqueci minha senha" com um e-mail real e
   confirme a chegada. Em caso de falha transitória (rede/`5xx`/`429`), o envio
   tenta de novo até 3 vezes com backoff antes de desistir.

> O tier grátis do Resend cobre 100 e-mails/dia (3.000/mês), suficiente para
> começar. A verificação de domínio costuma propagar em minutos.

## 5. Checklist final de produção (ops)

Passos manuais, um por serviço — o código já degrada graciosamente sem eles,
mas em produção todos devem estar ligados:

| # | Serviço | O que fazer |
|---|---------|-------------|
| 1 | **Upstash** (rate limit global) | Criar banco Redis grátis em upstash.com → copiar `UPSTASH_REDIS_REST_URL` + `TOKEN` para as envs. |
| 2 | **Cloudflare R2** (storage) | Criar bucket + API token → preencher `STORAGE_S3_*`; habilitar o domínio público do bucket e apontar `STORAGE_PUBLIC_BASE_URL`. |
| 3 | **Sentry** (monitoramento) | Criar projeto Next.js → colocar `SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`) nas envs. O código já está instrumentado (no-op sem DSN). |
| 4 | **Uptime** | Monitor externo (UptimeRobot/BetterStack) apontando para `/api/health` — retorna 503 se o banco cair. |
| 5 | **Backups** (Neon) | Conferir retenção de PITR no projeto Neon (Settings → Storage) e **ensaiar um restore** em branch separado — backup não testado não é backup. |
| 6 | **Asaas** (cobrança) | Cadastrar o webhook no painel (Integrações → Webhooks) apontando para `https://<dominio>/api/billing/webhook`, com um token forte no header e o mesmo valor em `ASAAS_WEBHOOK_TOKEN`. Em produção, trocar `ASAAS_ENV="production"` + chave de produção. ⚠️ A chave começa com `$` — escape como `\$aact_...` no `.env` local (o dotenv-expand do Next expande `$var`). Na Vercel (UI de envs) não precisa escapar. |
| 7 | **Focus NFe** (fiscal) | Contratar o plano, subir o certificado A1 no painel do Focus e trocar o token de homologação pelo de produção. |
| 8 | **Cron** | Os 3 crons (`expire-trials`, `housekeeping`, `stock-digest`) já estão no `vercel.json` — conferir em Vercel → Settings → Cron Jobs após o primeiro deploy, e definir `CRON_SECRET`. |

## Notas

- `npm run build` = `prisma generate && next build`. O `prisma generate` roda no
  build da Vercel (Linux), gerando o engine correto — não dependa do client gerado localmente.
- Rotas `/` e `/onboarding` são estáticas; todo o `/espaco/*` é dinâmico (sessão por cookie).
- O `DATABASE_URL` nunca vai para o repositório — fica só no `.env` local e nas
  Environment Variables da Vercel.
