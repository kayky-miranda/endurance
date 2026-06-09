/**
 * Especificações da importação em massa (modelos padronizados CSV/Excel).
 * Fonte da verdade compartilhada pela rota de template, pela validação no
 * servidor e pela interface. Mantida sem dependências de servidor.
 */

export type ColumnKind = "text" | "number" | "int" | "enum" | "date";

export interface ImportColumn {
  key: string;
  label: string; // cabeçalho usado no modelo CSV
  required?: boolean;
  kind?: ColumnKind;
  enumValues?: string[];
  example: string;
  hint?: string;
}

export interface ImportEntitySpec {
  id: string;
  label: string;
  description: string;
  available: boolean; // false = listado como "em breve"
  /** Formato do arquivo: "csv" (padrão) ou "xml" (notas fiscais). */
  format?: "csv" | "xml";
  columns: ImportColumn[];
  /** Observação extra mostrada na interface (ex.: regra de correspondência). */
  note?: string;
}

export const IMPORT_ENTITIES: ImportEntitySpec[] = [
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro de fornecedores para compras e reposição.",
    available: true,
    columns: [
      { key: "name", label: "Nome", required: true, example: "Distribuidora Sul" },
      { key: "cnpj", label: "CNPJ", example: "11.222.333/0001-44" },
      { key: "phone", label: "Telefone", example: "(19) 3344-5566" },
      { key: "email", label: "Email", example: "vendas@distsul.com.br" },
    ],
  },
  {
    id: "produtos",
    label: "Produtos",
    description: "Catálogo com preço, custo, categoria e estoque.",
    available: true,
    columns: [
      { key: "name", label: "Nome", required: true, example: "Arroz 5kg" },
      { key: "sku", label: "SKU", example: "ARR5" },
      { key: "barcode", label: "Codigo de barras", example: "7891234567890" },
      { key: "category", label: "Categoria", example: "Mercearia" },
      { key: "price", label: "Preco", kind: "number", example: "29,90" },
      { key: "cost", label: "Custo", kind: "number", example: "21,50" },
      { key: "stock", label: "Estoque", kind: "int", example: "40" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    description: "Base de clientes (CRM) com contato e documento.",
    available: true,
    columns: [
      { key: "name", label: "Nome", required: true, example: "Maria Silva" },
      { key: "phone", label: "Telefone", example: "(19) 99999-0000" },
      { key: "email", label: "Email", example: "maria@email.com" },
      { key: "document", label: "CPF/CNPJ", example: "123.456.789-00" },
    ],
  },
  {
    id: "categorias",
    label: "Categorias",
    description: "Lista de categorias de produtos.",
    available: true,
    columns: [
      { key: "name", label: "Nome", required: true, example: "Bebidas" },
    ],
  },
  {
    id: "estoque",
    label: "Estoque inicial",
    description: "Ajusta o saldo de estoque de produtos já cadastrados.",
    available: true,
    note: "Correspondência por SKU ou código de barras (o produto precisa existir).",
    columns: [
      { key: "sku", label: "SKU", example: "ARR5" },
      { key: "barcode", label: "Codigo de barras", example: "7891234567890" },
      { key: "stock", label: "Estoque", required: true, kind: "int", example: "120" },
    ],
  },
  {
    id: "precos",
    label: "Tabela de preços",
    description: "Atualiza preço (e custo) de produtos já cadastrados.",
    available: true,
    note: "Correspondência por SKU ou código de barras (o produto precisa existir).",
    columns: [
      { key: "sku", label: "SKU", example: "ARR5" },
      { key: "barcode", label: "Codigo de barras", example: "7891234567890" },
      { key: "price", label: "Preco", required: true, kind: "number", example: "31,90" },
      { key: "cost", label: "Custo", kind: "number", example: "22,00" },
    ],
  },
  {
    id: "financeiro",
    label: "Dados financeiros",
    description: "Contas a receber e a pagar em lote.",
    available: true,
    columns: [
      {
        key: "kind",
        label: "Tipo",
        required: true,
        kind: "enum",
        enumValues: ["receber", "pagar"],
        example: "pagar",
      },
      { key: "description", label: "Descricao", required: true, example: "Aluguel da loja" },
      { key: "category", label: "Categoria", example: "Despesa fixa" },
      { key: "amount", label: "Valor", required: true, kind: "number", example: "3500,00" },
      { key: "dueDate", label: "Vencimento", required: true, kind: "date", example: "31/12/2026" },
    ],
  },
  {
    id: "notas",
    label: "Notas fiscais",
    description: "Importação de NF-e (modelo 55) e NFC-e (modelo 65) por XML.",
    available: true,
    format: "xml",
    note: "Envie um ou mais arquivos .xml (layout 4.00). A nota é registrada por chave de acesso.",
    columns: [],
  },
];

export function importSpec(id: string): ImportEntitySpec | undefined {
  return IMPORT_ENTITIES.find((e) => e.id === id);
}
