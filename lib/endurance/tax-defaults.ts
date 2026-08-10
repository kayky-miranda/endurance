/**
 * Códigos tributários padrão da empresa — regra PURA, testável sem banco.
 *
 * O QUE ESTE MÓDULO NÃO FAZ: não calcula imposto, não decide alíquota, não
 * escolhe tributação por produto. Alíquota e enquadramento são do contador da
 * empresa; inventar isso aqui seria a "regra tributária arbitrária" que não
 * pode existir num ERP.
 *
 * O QUE ELE FAZ: garante que os CÓDIGOS enviados no XML sejam ESTRUTURALMENTE
 * coerentes com o regime. Isso não é opinião fiscal, é formato — a SEFAZ
 * rejeita na origem quando o código não corresponde ao CRT declarado.
 */

export type TributacaoIcms = "csosn" | "cst";

export interface TaxConfig {
  cfopPadrao: string;
  icmsOrigem: string;
  csosn: string;
  cstIcms: string;
  pisSituacao: string;
  cofinsSituacao: string;
  finalidade: string;
  consumidorFinal: string;
  presencaComprador: string;
}

const digits = (s: string) => (s ?? "").replace(/\D/g, "");

/**
 * Simples Nacional (CRT 1 e 2) usa CSOSN; Regime Normal (CRT 3) usa CST.
 *
 * É a regra que mais gera rejeição em ERP mal feito: manda-se CSOSN 102 para
 * uma empresa de Lucro Presumido e a SEFAZ recusa a nota inteira, com uma
 * mensagem que não diz que a causa foi o regime.
 */
export function tributacaoIcms(crt: string): TributacaoIcms {
  return crt === "3" ? "cst" : "csosn";
}

/** Código de ICMS a enviar, já resolvido pelo regime da empresa. */
export function icmsCodigo(
  crt: string,
  cfg: Pick<TaxConfig, "csosn" | "cstIcms">,
): { tipo: TributacaoIcms; codigo: string } {
  const tipo = tributacaoIcms(crt);
  return {
    tipo,
    codigo: tipo === "csosn" ? cfg.csosn : cfg.cstIcms,
  };
}

/** CFOP tem 4 dígitos e começa em 1..7 (o 1º indica a natureza da operação). */
export function isValidCfop(cfop: string): boolean {
  const d = digits(cfop);
  return d.length === 4 && /^[1-7]/.test(d);
}

/** 5xxx = dentro do estado; 6xxx = interestadual. */
export function cfopInterestadual(cfop: string): boolean {
  return digits(cfop).startsWith("6");
}

export interface ConfigIssue {
  field: keyof TaxConfig;
  message: string;
  /** Impede emitir, ou só chama atenção? */
  blocking: boolean;
}

/**
 * Confere a coerência do conjunto — não a correção fiscal, que é do contador.
 *
 * `modelo` importa: a NFC-e é venda presencial ao consumidor no próprio
 * estado. CFOP interestadual ou "não presencial" numa NFC-e é sinal de que o
 * cliente copiou a configuração da NF-e, e a SEFAZ vai recusar.
 */
export function validateTaxConfig(
  cfg: TaxConfig,
  crt: string,
  modelo: "65" | "55" = "65",
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (!isValidCfop(cfg.cfopPadrao))
    issues.push({
      field: "cfopPadrao",
      message: "O CFOP tem 4 dígitos e começa entre 1 e 7 (ex.: 5102).",
      blocking: true,
    });
  else if (modelo === "65" && cfgInterestadualEmNfce(cfg))
    issues.push({
      field: "cfopPadrao",
      message:
        "CFOP interestadual (6xxx) na NFC-e: o cupom é venda presencial no próprio estado. Para operação interestadual, emita NF-e.",
      blocking: true,
    });

  const { tipo, codigo } = icmsCodigo(crt, cfg);
  if (!digits(codigo))
    issues.push({
      field: tipo === "csosn" ? "csosn" : "cstIcms",
      message:
        tipo === "csosn"
          ? "Informe o CSOSN — o Simples Nacional exige este código."
          : "Informe o CST de ICMS — o Regime Normal exige este código.",
      blocking: true,
    });

  if (!digits(cfg.icmsOrigem))
    issues.push({
      field: "icmsOrigem",
      message: "Informe a origem da mercadoria (0 = nacional).",
      blocking: true,
    });

  if (modelo === "65" && cfg.presencaComprador === "9")
    issues.push({
      field: "presencaComprador",
      message:
        "A NFC-e é venda presencial — 'não presencial' costuma ser recusado.",
      blocking: false,
    });

  if (modelo === "65" && cfg.consumidorFinal !== "1")
    issues.push({
      field: "consumidorFinal",
      message: "A NFC-e é sempre para consumidor final.",
      blocking: false,
    });

  return issues;
}

function cfgInterestadualEmNfce(cfg: TaxConfig): boolean {
  return cfopInterestadual(cfg.cfopPadrao);
}

// ---------------------------------------------------------------------------
// Opções para a interface. Rótulos oficiais, sem interpretação nossa.
// ---------------------------------------------------------------------------

export const ORIGEM_OPTIONS = [
  { value: "0", label: "0 — Nacional" },
  { value: "1", label: "1 — Estrangeira, importação direta" },
  { value: "2", label: "2 — Estrangeira, adquirida no mercado interno" },
  { value: "3", label: "3 — Nacional, conteúdo de importação > 40%" },
  { value: "4", label: "4 — Nacional, processos produtivos básicos" },
  { value: "5", label: "5 — Nacional, conteúdo de importação ≤ 40%" },
  { value: "6", label: "6 — Estrangeira, importação direta, sem similar" },
  { value: "7", label: "7 — Estrangeira, mercado interno, sem similar" },
  { value: "8", label: "8 — Nacional, conteúdo de importação > 70%" },
];

export const FINALIDADE_OPTIONS = [
  { value: "1", label: "1 — Normal" },
  { value: "2", label: "2 — Complementar" },
  { value: "3", label: "3 — Ajuste" },
  { value: "4", label: "4 — Devolução" },
];

export const PRESENCA_OPTIONS = [
  { value: "1", label: "1 — Presencial" },
  { value: "2", label: "2 — Internet" },
  { value: "3", label: "3 — Teleatendimento" },
  { value: "4", label: "4 — Entrega a domicílio" },
  { value: "9", label: "9 — Não presencial, outros" },
];

export const CONSUMIDOR_OPTIONS = [
  { value: "1", label: "1 — Consumidor final" },
  { value: "0", label: "0 — Normal (revenda)" },
];
