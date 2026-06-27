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

## Notas

- `npm run build` = `prisma generate && next build`. O `prisma generate` roda no
  build da Vercel (Linux), gerando o engine correto — não dependa do client gerado localmente.
- Rotas `/` e `/onboarding` são estáticas; todo o `/espaco/*` é dinâmico (sessão por cookie).
- O `DATABASE_URL` nunca vai para o repositório — fica só no `.env` local e nas
  Environment Variables da Vercel.
