# ENDURANCE

ERP em SaaS **multi-nicho** para pequenos negócios brasileiros. O cliente
descreve o negócio em texto livre ("tenho um mercadinho em Campinas"), a IA
classifica o nicho, extrai os dados e pré-configura os módulos certos — e a
partir daí o espaço já nasce funcionando: PDV, estoque, financeiro, fiscal,
CRM e equipe com permissões granulares.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** (tema escuro, paleta ardósia + esmeralda)
- **Prisma 6** + **PostgreSQL** (testado com Neon; qualquer Postgres serve)
- Sessões **JWT** em cookie httpOnly (`jose`) + senhas com **bcrypt**
- IA: **Claude API** (`claude-opus-4-8`, saída estruturada + prompt caching)
  ou **Google Gemini** (tier gratuito) — com modo offline sem nenhuma chave

## Funcionalidades

### Onboarding com IA

`POST /api/onboarding` recebe `{ description }` e devolve um
[`OnboardingResult`](lib/endurance/types.ts): nicho classificado (+ confiança),
dados extraídos (nome, cidade, UF, segmento) e os módulos a ativar. A lógica
está em [`lib/endurance/onboarding.ts`](lib/endurance/onboarding.ts) e a fonte
da verdade de nichos/módulos em [`lib/endurance/catalog.ts`](lib/endurance/catalog.ts).

Nichos do MVP: **Mercado/Varejo** (foco), **Academia**, **Cabeleireiro/Salão**
e **Nutricionista**. Cada um liga um conjunto próprio de módulos sobre o núcleo
comum (financeiro, CRM, relatórios, equipe, notificações, importação).

### Módulos do ERP (varejo)

- **PDV** — carrinho com leitor de código de barras, desconto, split de
  pagamento (dinheiro/crédito/débito/pix), troco registrado, cliente vinculado
  e sugestões de venda cruzada por IA. Venda idempotente (token) e atômica:
  baixa condicional de estoque + recebíveis na mesma transação.
- **Caixa** — multi-caixa por operador: abertura com fundo de troco,
  suprimento/sangria, fechamento com conferência (esperado × contado).
- **Produtos / Estoque / Precificação** — cadastro, ajustes de estoque,
  análise de margem com conselhos de IA e simulador de preços.
- **Financeiro** — contas a pagar/receber; recebíveis gerados automaticamente
  pelas vendas (crédito vira conta a receber com D+30).
- **Fiscal** — emissão e cancelamento de **NFC-e** e **NF-e** (simulado,
  com DANFE/QR code) a partir das vendas.
- **Clientes (CRM)** — segmentação automática (ativo/em risco/inativo),
  previsão de recompra, campanhas sugeridas por IA e edição cadastral.
- **Fornecedores & Compras** — pedidos de compra com recebimento que
  alimenta o estoque.
- **Relatórios** — KPIs, gráficos e insights de vendas/estoque/CRM/preços
  gerados por IA (com fallback heurístico sem chave).
- **Equipe (RBAC granular)** — perfis pré-configurados (Administrador,
  Gerente, Financeiro, Estoque, Caixa, Vendedor, Operador) sobre um catálogo
  de permissões ([`lib/endurance/permissions.ts`](lib/endurance/permissions.ts)),
  com bloqueio de usuários e trilha de auditoria.
- **Assistente IA** — widget de chat com contexto do negócio em todas as
  telas do espaço.
- **Importação em massa** — produtos/clientes via CSV e XML de NF-e.

### Segurança

- Toda server action **mutante** abre com `requirePermission(...)`
  ([`lib/auth.ts`](lib/auth.ts)) — a UI esconder um botão não é autorização.
- Autorização relida do banco a cada request (bloqueio vale na hora);
  isolamento multi-tenant por `organizationId` em todas as consultas.
- **Rate limit** no login (por IP e por e-mail, só falhas) e no cadastro
  ([`lib/rate-limit.ts`](lib/rate-limit.ts)).
- **Security headers** globais (CSP frame-ancestors, HSTS, nosniff etc.)
  em [`next.config.mjs`](next.config.mjs).

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL e AUTH_SECRET (obrigatórios)
npm run db:push        # cria as tabelas no Postgres
npm run dev            # http://localhost:3000
```

As chaves de IA são opcionais — sem nenhuma, o onboarding usa um classificador
por palavras-chave e os painéis de IA caem em heurísticas. Com chave:

| Variável | Para quê |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini (tier gratuito) — tem prioridade |
| `ANTHROPIC_API_KEY` | Claude (`claude-opus-4-8`) |
| `AI_PROVIDER` | força `gemini` ou `anthropic` (opcional) |

`npm run check:ai` testa a configuração de IA pela linha de comando.

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | `prisma generate` + build de produção |
| `npm run start` | serve o build |
| `npm run lint` | ESLint |
| `npm run db:push` | sincroniza o schema Prisma com o banco |
| `npm run db:studio` | Prisma Studio (GUI do banco) |
| `npm run check:ai` | smoke test do provedor de IA |

CI no GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):
typecheck + lint + build em todo push/PR para `main`.

## Como a IA é chamada (e o caching validado)

No provedor Anthropic, o catálogo + regras (estáveis) ficam no _system prompt_
com `cache_control: {type: "ephemeral"}`; a descrição do cliente (volátil) vai
no turno do usuário, depois do ponto de cache. A saída é restrita por JSON
Schema, então a IA só liga módulos que existem no catálogo.

Cada chamada loga o `usage` retornado pela API para validar o caching em
produção:

```
[onboarding:anthropic] usage: input=214 cache_write=1893 cache_read=0 output=187   ← 1ª chamada (grava o cache)
[onboarding:anthropic] usage: input=214 cache_write=0 cache_read=1893 output=190   ← seguintes (lê o cache, ~10% do custo)
```

`cache_read` sempre `0`? Ou o prefixo está abaixo do mínimo cacheável do
modelo, ou algo volátil entrou no system prompt e invalidou o prefixo.

## Testando o onboarding direto

```bash
curl -s 
api/onboarding \
  -H "Content-Type: application/json" \
  -d '{"description":"Tenho um mercadinho de bairro em Campinas, SP."}'
```
