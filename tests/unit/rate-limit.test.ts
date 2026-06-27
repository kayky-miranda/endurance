import { describe, it, expect, beforeEach } from "vitest";

// Sem UPSTASH_* no ambiente de teste, `hit` usa o backend em memória.
import { hit, peek, record } from "@/lib/rate-limit";

describe("rate-limit (memória)", () => {
  beforeEach(() => {
    // Chaves únicas por teste evitam vazamento de estado entre casos.
  });

  it("libera dentro do limite e bloqueia ao exceder", async () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      const v = await hit(key, 3, 60_000);
      expect(v.ok).toBe(true);
    }
    const blocked = await hit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("janelas distintas (keys distintas) não interferem", async () => {
    const a = await hit(`a:${Math.random()}`, 1, 60_000);
    const b = await hit(`b:${Math.random()}`, 1, 60_000);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("peek não consome; record incrementa até o lockout", () => {
    const key = `lock:${Math.random()}`;
    expect(peek(key, 3).ok).toBe(true);
    record(key, 60_000);
    record(key, 60_000);
    record(key, 60_000);
    // 3 ocorrências, limite 3 → peek considera atingido (count >= limit).
    expect(peek(key, 3).ok).toBe(false);
  });
});
