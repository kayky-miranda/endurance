import { describe, it, expect, vi } from "vitest";
import { fetchXmlContent } from "@/lib/endurance/fiscal-xml";

const XML = '<?xml version="1.0"?><nfeProc><NFe>...</NFe></nfeProc>';

function okFetch(body: string, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => body,
  }) as unknown as typeof fetch;
}

describe("fetchXmlContent", () => {
  it("retorna o XML quando o download dá 200 e parece XML", async () => {
    const xml = await fetchXmlContent("https://x/nota.xml", {
      fetchImpl: okFetch(XML),
    });
    expect(xml).toBe(XML);
  });

  it("retorna '' quando a URL é vazia/ausente", async () => {
    expect(await fetchXmlContent(undefined)).toBe("");
    expect(await fetchXmlContent("")).toBe("");
  });

  it("retorna '' em resposta não-ok (ex.: 403 autenticação)", async () => {
    const xml = await fetchXmlContent("https://x/nota.xml", {
      fetchImpl: okFetch("forbidden", false, 403),
    });
    expect(xml).toBe("");
  });

  it("retorna '' quando o corpo não parece XML (HTML/JSON de erro)", async () => {
    const xml = await fetchXmlContent("https://x/nota.xml", {
      fetchImpl: okFetch('{"erro":"x"}'),
    });
    expect(xml).toBe("");
  });

  it("retorna '' em erro de rede/timeout (não propaga)", async () => {
    const boom = vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) as unknown as typeof fetch;
    const xml = await fetchXmlContent("https://x/nota.xml", { fetchImpl: boom });
    expect(xml).toBe("");
  });
});
