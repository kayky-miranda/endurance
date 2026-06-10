# ENDURANCE — 0.1v

ERP em SaaS multi-nicho para pequenos negócios brasileiros. Este repositório
contém o **primeiro entregável**: o protótipo do **onboarding com IA**.

> O cliente descreve o negócio em texto livre ("tenho um mercadinho em
> Campinas") e o sistema classifica o nicho, extrai os dados e pré-configura os
> módulos certos do ERP. É o momento "uau" do produto — validado primeiro,
> antes de qualquer módulo de verdade.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** (tema escuro, paleta ardósia + esmeralda)
- **Claude API** (`claude-opus-4-8`) com **saída estruturada** + **prompt caching**
- Sem banco ainda — o protótipo classifica e mostra; o provisionamento real
  do workspace entra na próxima etapa.

## Como roda a IA de onboarding

`POST /api/onboarding` recebe `{ description }` e devolve um
[`OnboardingResult`](lib/endurance/types.ts):

- `niche` + `confidence` — nicho classificado (1 de 4 no MVP, ou `outro`)
- `businessName`, `city`, `state`, `country`, `segment` — dados extraídos
- `summary` — explicação curta em pt-BR
- `suggestedModules` — ids de módulos a ligar (núcleo + nicho)

A lógica está em [`lib/endurance/onboarding.ts`](lib/endurance/onboarding.ts):

- **Com `ANTHROPIC_API_KEY`**: chama o Claude. O catálogo de nichos/módulos
  (estável) fica no _system prompt_ com `cache_control` (prefix caching); a
  descrição (volátil) vai no turno do usuário. A saída é restrita por JSON
  Schema, então a IA só liga módulos que existem no catálogo.
- **Sem chave (modo offline)**: cai num classificador por palavras-chave, para
  o protótipo rodar sem custo. O resultado mostra a origem (`ai` vs `fallback`).

O catálogo de nichos e módulos — a "fonte da verdade" compartilhada pela IA,
pelo fallback e pela interface — está em
[`lib/endurance/catalog.ts`](lib/endurance/catalog.ts). É um **registry de
módulos** (schema fixo por módulo, ligado por nicho), não um schema dinâmico.

## Nichos no MVP

Mercado/Varejo (foco), Academia, Cabeleireiro/Salão, Nutricionista.

## Rodando localmente

```bash
npm install
# opcional: ative a IA
echo ANTHROPIC_API_KEY="sk-ant-..." > .env
npm run dev   # http://localhost:3000
```

Atalho na interface: `Ctrl/Cmd + Enter` no campo de texto dispara a análise.

## Testando o endpoint direto

```bash
curl -s http://localhost:3000/api/onboarding \
  -H "Content-Type: application/json" \
  -d '{"description":"Tenho um mercadinho de bairro em Campinas, SP."}'
```
