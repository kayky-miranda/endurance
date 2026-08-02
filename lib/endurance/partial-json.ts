/**
 * Leitura de JSON INCOMPLETO — PURO e sem dependências.
 *
 * O modelo devolve a análise em streaming: a cada pedaço temos um JSON cortado
 * no meio (`{"resumo":"Paciente de 48 an`). Para a tela ir preenchendo os
 * cartões conforme o texto chega, precisamos interpretar esse prefixo sem
 * quebrar — e sem NUNCA entregar um valor pela metade como se estivesse pronto.
 *
 * ALGORITMO: uma passada registra PONTOS DE RETOMADA — posições onde um valor
 * acabou de ser fechado (fim de string, de objeto, de array, de literal) ou
 * onde começa uma vírgula. Em cada ponto guardamos também quais delimitadores
 * estavam abertos. Depois tentamos, do ponto mais avançado para o mais antigo,
 * cortar ali e fechar o que ficou aberto, devolvendo o primeiro que fizer parse.
 *
 * Esse retrocesso resolve sozinho os casos chatos — chave sem valor
 * (`{"a":1,"b":`) simplesmente falha o parse e cai no ponto anterior — em vez
 * de exigir uma regra especial para cada formato de lixo no fim do buffer.
 */

const CLOSER: Record<string, string> = { "{": "}", "[": "]" };

interface Checkpoint {
  /** Índice exclusivo onde cortar. */
  end: number;
  /** Delimitadores abertos nesse ponto, na ordem de abertura. */
  openers: string;
}

const LITERAL_END = /[\d"eslnu]/; // fim plausível de número, true/false/null
const DELIMITER = /[\s,\]}]/;

export function parsePartialJson(raw: string): unknown | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // Caminho feliz: já chegou inteiro.
  try {
    return JSON.parse(s);
  } catch {
    // segue para o reparo
  }

  const checkpoints: Checkpoint[] = [];
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  const mark = (end: number) => checkpoints.push({ end, openers: stack.join("") });

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        mark(i + 1); // string fechada: chave ou valor completo
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      mark(i + 1); // container vazio também é um estado válido
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      mark(i + 1);
      continue;
    }
    if (ch === ",") {
      mark(i); // corta ANTES da vírgula
      continue;
    }
    // Número ou literal terminando logo antes de um delimitador.
    if (LITERAL_END.test(ch) && DELIMITER.test(s[i + 1] ?? " ")) mark(i + 1);
  }

  for (let k = checkpoints.length - 1; k >= 0; k--) {
    const { end, openers } = checkpoints[k];
    let candidate = s.slice(0, end).trimEnd();
    if (!candidate) continue;

    for (let j = openers.length - 1; j >= 0; j--) candidate += CLOSER[openers[j]];

    try {
      return JSON.parse(candidate);
    } catch {
      // ponto ruim (ex.: chave sem valor) — tenta o anterior
    }
  }
  return null;
}
