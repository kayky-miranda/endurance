import { describe, it, expect } from "vitest";
import {
  buildConfirmationMessage,
  waLink,
} from "@/lib/endurance/appointment-message";

describe("buildConfirmationMessage", () => {
  it("usa o primeiro nome e inclui data/hora, serviço e profissional", () => {
    const msg = buildConfirmationMessage({
      orgName: "Clínica Vida",
      customerName: "Maria Silva Souza",
      service: "Consulta de retorno",
      dateLabel: "quinta, 30/07",
      timeLabel: "14:30",
      professional: "Dra. Ana",
    });
    expect(msg).toContain("Olá, Maria!");
    expect(msg).toContain("Clínica Vida");
    expect(msg).toContain("quinta, 30/07 às 14:30");
    expect(msg).toContain("Consulta de retorno");
    expect(msg).toContain("Dra. Ana");
  });

  it("funciona sem nome, serviço ou profissional", () => {
    const msg = buildConfirmationMessage({
      orgName: "Consultório X",
      customerName: "",
      dateLabel: "sexta, 01/08",
      timeLabel: "09:00",
    });
    expect(msg).toContain("Olá!");
    expect(msg).toContain("sexta, 01/08 às 09:00");
    expect(msg).not.toContain("🩺");
    expect(msg).not.toContain("👤");
  });
});

describe("waLink", () => {
  it("prefixa 55 quando falta DDI e codifica o texto", () => {
    const url = waLink("(19) 99999-8888", "oi mundo");
    expect(url).toBe("https://wa.me/5519999998888?text=oi%20mundo");
  });

  it("mantém o DDI quando já vem no telefone", () => {
    const url = waLink("5511987654321", "x");
    expect(url).toBe("https://wa.me/5511987654321?text=x");
  });

  it("retorna null para telefone curto/ausente", () => {
    expect(waLink("", "x")).toBeNull();
    expect(waLink("1234", "x")).toBeNull();
  });
});
