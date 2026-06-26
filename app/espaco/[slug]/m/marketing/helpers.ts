/** Formata um número como moeda BRL (R$ 1.234,56). */
export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
