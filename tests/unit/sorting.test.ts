import { describe, it, expect } from "vitest";
import { parseSort } from "@/lib/endurance/sorting";

/**
 * `parseSort` alimenta o `orderBy` do Prisma com um valor vindo da URL — é
 * uma fronteira de segurança. Só campos da whitelist podem passar.
 */

const ALLOWED = ["name", "price", "stock"] as const;
const FALLBACK = { field: "createdAt", dir: "desc" } as const;

describe("parseSort — whitelist de ordenação", () => {
  it("aceita campo e direção válidos", () => {
    expect(parseSort({ ord: "price", dir: "asc" }, ALLOWED, FALLBACK)).toEqual({
      field: "price",
      dir: "asc",
    });
  });

  it("campo fora da whitelist cai no padrão", () => {
    expect(
      parseSort({ ord: "passwordHash", dir: "asc" }, ALLOWED, FALLBACK).field,
    ).toBe("createdAt");
  });

  it("tentativa de injeção cai no padrão (não vaza para o orderBy)", () => {
    for (const malicioso of [
      "id; DROP TABLE Product",
      "../../secret",
      "organization.users.passwordHash",
      "__proto__",
    ]) {
      const r = parseSort({ ord: malicioso, dir: "asc" }, ALLOWED, FALLBACK);
      expect(ALLOWED.includes(r.field as (typeof ALLOWED)[number])).toBe(false);
      expect(r.field).toBe("createdAt");
    }
  });

  it("direção inválida cai no padrão", () => {
    expect(parseSort({ ord: "name", dir: "sideways" }, ALLOWED, FALLBACK)).toEqual({
      field: "name",
      dir: "desc",
    });
  });

  it("sem parâmetros usa o padrão da tela", () => {
    expect(parseSort({}, ALLOWED, FALLBACK)).toEqual(FALLBACK);
  });

  it("preserva a direção quando só o campo é informado", () => {
    expect(parseSort({ ord: "stock" }, ALLOWED, FALLBACK)).toEqual({
      field: "stock",
      dir: "desc",
    });
  });
});
