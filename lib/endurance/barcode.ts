/**
 * Gerador de código de barras Code128-B (puro, sem dependências e sem
 * "server-only" — usado tanto no servidor quanto no cliente).
 *
 * Code128 codifica o valor exato do produto (EAN de 13 dígitos, SKU
 * alfanumérico, etc.) e é lido por qualquer leitor — o mesmo valor volta no PDV.
 */

// Tabela canônica de padrões Code128 (índices 0..106). Cada string são as
// larguras de barras/espaços alternados (começa por barra).
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];
const START_B = 104;
const STOP = 106;

/** Codifica `value` em Code128-B e devolve a string de bits (1 = barra). */
export function encodeCode128(value: string): string {
  // Mantém apenas ASCII imprimível (32..126); fora disso vira "?".
  const chars = [...value].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 32 && code <= 126 ? code : 63;
  });

  const codes: number[] = [START_B];
  for (const code of chars) codes.push(code - 32);

  let sum = START_B;
  for (let i = 0; i < chars.length; i++) sum += (chars[i] - 32) * (i + 1);
  codes.push(sum % 103); // dígito verificador
  codes.push(STOP);

  let bits = "";
  for (const code of codes) {
    const pattern = PATTERNS[code];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      bits += (i % 2 === 0 ? "1" : "0").repeat(width);
    }
  }
  return bits;
}

/** Converte a string de bits em retângulos (barras) para um SVG. */
export function barcodeBars(
  bits: string,
  moduleWidth = 2,
  height = 60,
): { rects: { x: number; w: number }[]; width: number; height: number } {
  const rects: { x: number; w: number }[] = [];
  let x = 0;
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let run = 0;
      while (i < bits.length && bits[i] === "1") {
        run++;
        i++;
      }
      rects.push({ x: x, w: run * moduleWidth });
      x += run * moduleWidth;
    } else {
      x += moduleWidth;
      i++;
    }
  }
  return { rects, width: x, height };
}

/**
 * Gera um EAN-13 interno (prefixo 200 — faixa de uso interno) a partir de uma
 * semente, com dígito verificador válido. Usado para produtos sem código.
 */
export function internalEan13(seed: string): string {
  const digits = (seed.replace(/\D/g, "") + "000000000000").slice(0, 9);
  const base = "200" + digits.slice(0, 9); // 12 dígitos
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  const dv = (10 - (soma % 10)) % 10;
  return base + String(dv);
}
