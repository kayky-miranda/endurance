# Testes do ENDURANCE

## Unitários (Vitest)

Regras de negócio puras, sem banco e sem rede:

- `unit/fiscal.test.ts` — chave de acesso NFC-e (módulo 11), QR Code (SHA-1 da
  NT 2015.002), XML 4.00 (escape, totais, tPag) e protocolo.
- `unit/permissions.test.ts` — RBAC granular: acesso por papel/permissão,
  sanitização, gating de módulos e coerência do catálogo de perfis.
- `unit/pagination.test.ts` — clamp/parse de página e metadados.
- `unit/money.test.ts` — conversão Decimal → number na borda de leitura.
- `unit/catalog.test.ts` — unicidade e consistência do catálogo de módulos.

```
npm test          # uma rodada
npm run test:watch
```

## E2E (Playwright)

Três fluxos de negócio completos, dirigidos pela interface real:

1. `e2e/onboarding.spec.ts` — descrição do negócio → classificação →
   conta/espaço criados → visão geral com os módulos do nicho.
2. `e2e/venda-nfce-financeiro.spec.ts` — cadastro de produto → venda no PDV →
   emissão da NFC-e → recebível compensado no financeiro.
3. `e2e/fechamento-caixa.spec.ts` — abertura do caixa → venda em dinheiro →
   sangria → conferência e fechamento com diferença zero.

```
npx playwright install chromium   # uma vez
npm run test:e2e
```

Notas de infraestrutura:

- O `playwright.config.ts` sobe o `next dev` sozinho e **zera as chaves de IA**
  no ambiente do servidor — o onboarding usa o classificador offline e os
  painéis de IA caem nas heurísticas, então os testes são determinísticos e
  não fazem chamadas externas.
- Os testes usam o banco do `DATABASE_URL` do `.env`. Cada fluxo cria a sua
  própria organização (dono com e-mail `@e2e.endurance.test`) e o
  `global-teardown` apaga essas organizações ao final (cascade limpa vendas,
  documentos, financeiro etc.).
