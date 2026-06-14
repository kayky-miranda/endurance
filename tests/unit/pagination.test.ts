import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  clampPage,
  pageMeta,
  parsePage,
} from "@/lib/endurance/pagination";

describe("clampPage", () => {
  it("normaliza entradas inválidas para 1", () => {
    expect(clampPage(undefined, 100)).toBe(1);
    expect(clampPage(0, 100)).toBe(1);
    expect(clampPage(-5, 100)).toBe(1);
    expect(clampPage(NaN, 100)).toBe(1);
  });

  it("limita à última página", () => {
    // 45 registros → 3 páginas de PAGE_SIZE (20).
    expect(clampPage(99, 45)).toBe(3);
    expect(clampPage(3, 45)).toBe(3);
    expect(clampPage(2, 45)).toBe(2);
  });

  it("com zero registros sempre devolve 1", () => {
    expect(clampPage(7, 0)).toBe(1);
  });
});

describe("pageMeta", () => {
  it("calcula pageCount por teto e nunca abaixo de 1", () => {
    expect(pageMeta(1, 0)).toEqual({ page: 1, pageCount: 1, total: 0 });
    expect(pageMeta(1, PAGE_SIZE)).toEqual({
      page: 1,
      pageCount: 1,
      total: PAGE_SIZE,
    });
    expect(pageMeta(2, PAGE_SIZE + 1).pageCount).toBe(2);
  });
});

describe("parsePage", () => {
  it("lê números válidos da query string", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage(["3", "9"])).toBe(3); // repete o param → usa o primeiro
  });

  it("entradas inválidas viram página 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
  });
});
