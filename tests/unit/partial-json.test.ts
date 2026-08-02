import { describe, it, expect } from "vitest";
import { parsePartialJson } from "@/lib/endurance/partial-json";

/**
 * O parser sustenta a renderização progressiva: precisa entregar o que já
 * chegou INTEIRO e nunca um valor pela metade (exibir "Paciente de 48 an" como
 * texto final seria pior do que não exibir nada).
 */
describe("parsePartialJson", () => {
  it("JSON completo passa direto", () => {
    expect(parsePartialJson('{"a":1,"b":[1,2]}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("descarta string cortada no meio", () => {
    const r = parsePartialJson('{"resumo":"Paciente de 48 an') as Record<string, unknown>;
    expect(r).toEqual({});
    expect(r.resumo).toBeUndefined();
  });

  it("mantém o campo já fechado e ignora o seguinte incompleto", () => {
    const r = parsePartialJson('{"resumo":"Cefaleia diária.","queixa":"dor de cab') as Record<string, unknown>;
    expect(r.resumo).toBe("Cefaleia diária.");
    expect(r.queixa).toBeUndefined();
  });

  it("array parcial mantém só os itens completos", () => {
    const r = parsePartialJson('{"alertas":["Alergia a dipirona","Perda de pe') as { alertas: string[] };
    expect(r.alertas).toEqual(["Alergia a dipirona"]);
  });

  it("array de objetos parcial nunca devolve texto cortado", () => {
    const raw = '{"itens":[{"text":"A","source":"registro"},{"text":"B","sou';
    const r = parsePartialJson(raw) as { itens: Record<string, unknown>[] };
    // O 1º item veio inteiro. O 2º pode aparecer sem o `source` (que ainda não
    // chegou) — o que importa é que o TEXTO nunca venha pela metade; quem
    // decide se o item está completo o bastante é a camada de domínio.
    expect(r.itens[0]).toEqual({ text: "A", source: "registro" });
    for (const item of r.itens) expect(typeof item.text).toBe("string");
  });

  it("texto cortado dentro de objeto de array nunca vaza", () => {
    const raw = '{"itens":[{"text":"A","source":"registro"},{"text":"Bra';
    const r = parsePartialJson(raw) as { itens: Record<string, unknown>[] };
    expect(r.itens[0]).toEqual({ text: "A", source: "registro" });
    // O 2º item vem vazio ({}) em vez de carregar o texto truncado "Bra".
    const textos = r.itens.map((i) => i.text).filter(Boolean);
    expect(textos).toEqual(["A"]);
  });

  it("remove chave sem valor", () => {
    const r = parsePartialJson('{"a":"x","b":') as Record<string, unknown>;
    expect(r).toEqual({ a: "x" });
  });

  it("remove vírgula solta", () => {
    const r = parsePartialJson('{"a":"x",') as Record<string, unknown>;
    expect(r).toEqual({ a: "x" });
  });

  it("lida com aspas escapadas dentro da string", () => {
    const r = parsePartialJson('{"a":"disse \\"oi\\" ontem","b":"cor') as Record<string, unknown>;
    expect(r.a).toBe('disse "oi" ontem');
    expect(r.b).toBeUndefined();
  });

  it("objetos aninhados incompletos são fechados com segurança", () => {
    const r = parsePartialJson('{"o":{"p":"v","q":"w"},"r":{"s"') as Record<string, unknown>;
    expect(r.o).toEqual({ p: "v", q: "w" });
  });

  it("entrada vazia ou lixo devolve null", () => {
    expect(parsePartialJson("")).toBeNull();
    expect(parsePartialJson("   ")).toBeNull();
  });

  it("prefixos sucessivos de um JSON real nunca quebram", () => {
    const full =
      '{"resumo":"Paciente com cefaleia.","alertas":[{"text":"Alergia","source":"registro"}],"prioridade":"alta","n":42}';
    for (let i = 1; i <= full.length; i++) {
      const out = parsePartialJson(full.slice(0, i));
      expect(out === null || typeof out === "object").toBe(true);
    }
    expect(parsePartialJson(full)).toEqual(JSON.parse(full));
  });
});
