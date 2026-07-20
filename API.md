# API pública — ENDURANCE (/api/v1)

Integração de sistemas externos (e-commerce, BI, automações) com os dados da
sua organização. Read-only nesta versão.

## Autenticação

Crie uma chave em **Configurações → API pública** (permissão
`integrations.config`). O token (`edk_…`) aparece uma única vez.

```
Authorization: Bearer edk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Limite: **120 requisições/minuto por chave** (HTTP 429 ao exceder).
- Revogação em Configurações tem efeito imediato.

## Paginação

Cursor-based: `?limit=` (1–100, padrão 50) e `?cursor=` (valor de
`next_cursor` da página anterior). `next_cursor: null` = fim.

```json
{ "data": [ … ], "next_cursor": "cmr…" }
```

## Endpoints

### GET /api/v1/products
Catálogo. Filtros: `q` (nome, código de barras, SKU).
Campos: `id, name, barcode, sku, category, unit, ncm, price, cost, stock, min_stock, created_at`.

### GET /api/v1/customers
Clientes. Filtros: `q` (nome, e-mail, documento).
Campos: `id, name, phone, email, document, created_at`.

### GET /api/v1/sales
Vendas com itens e pagamentos. Filtros: `since=AAAA-MM-DD` (padrão: 30 dias).
Campos: `id, code, created_at, subtotal, discount, total, change, customer{}, seller{}, items[], payments[]`.

## Exemplo

```bash
curl -s https://endurance-erp.com.br/api/v1/products?limit=10 \
  -H "Authorization: Bearer $ENDURANCE_API_KEY"
```

## Erros

| Código | Significado |
|---|---|
| 401 | Chave ausente, inválida ou revogada |
| 429 | Rate limit (aguarde `Retry-After`) |
