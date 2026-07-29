import { describe, it, expect, beforeEach } from "vitest";
import { summarizeAnamnese } from "@/lib/endurance/anamnese-summary";

// Sem chave → caminho heurístico determinístico.
beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

describe("summarizeAnamnese (heurística)", () => {
  it("sem respostas preenchidas, avisa que não há o que resumir", async () => {
    const r = await summarizeAnamnese("João", [
      { question: "Queixa", answer: "" },
      { question: "", answer: "" },
    ]);
    expect(r.source).toBe("heuristic");
    expect(r.text).toMatch(/nenhuma resposta/i);
  });

  it("conta as respostas e cita uma amostra sem inventar", async () => {
    const r = await summarizeAnamnese("Maria", [
      { question: "Queixa principal", answer: "Insônia" },
      { question: "Alergias", answer: "Dipirona" },
    ]);
    expect(r.source).toBe("heuristic");
    expect(r.text).toContain("2 resposta");
    expect(r.text).toContain("Insônia");
    expect(r.text).toContain("Dipirona");
  });

  it("ignora perguntas sem resposta na contagem", async () => {
    const r = await summarizeAnamnese("Ana", [
      { question: "Queixa", answer: "Dor" },
      { question: "Histórico", answer: "" },
    ]);
    expect(r.text).toContain("1 resposta");
  });
});
