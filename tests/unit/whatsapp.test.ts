import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizePhoneBR,
  createMetaCloudProvider,
} from "@/lib/endurance/whatsapp-providers/meta-cloud";
import { resolveWhatsAppProvider } from "@/lib/endurance/whatsapp-provider";

function fakeFetch(
  handler: (url: string) => { ok?: boolean; body?: unknown },
): typeof fetch {
  return (async (url: string) => {
    const r = handler(String(url));
    return { ok: r.ok ?? true, json: async () => r.body ?? {} } as Response;
  }) as unknown as typeof fetch;
}

describe("normalizePhoneBR", () => {
  it("acrescenta 55 quando vem sem país", () => {
    expect(normalizePhoneBR("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizePhoneBR("1133334444")).toBe("551133334444");
  });
  it("mantém quando já tem o país", () => {
    expect(normalizePhoneBR("5511999998888")).toBe("5511999998888");
  });
  it("vazio → vazio", () => {
    expect(normalizePhoneBR("")).toBe("");
  });
});

describe("createMetaCloudProvider", () => {
  const deps = {
    token: "tok",
    phoneNumberId: "123",
    baseUrl: "https://graph.facebook.com/v19.0",
  };

  it("sendText devolve providerRef no sucesso", async () => {
    const provider = createMetaCloudProvider({
      ...deps,
      fetchImpl: fakeFetch(() => ({ body: { messages: [{ id: "wamid.X" }] } })),
    });
    const r = await provider.sendText("11999998888", "Olá");
    expect(r.ok).toBe(true);
    expect(r.providerRef).toBe("wamid.X");
  });

  it("sendText propaga erro da Meta", async () => {
    const provider = createMetaCloudProvider({
      ...deps,
      fetchImpl: fakeFetch(() => ({
        ok: false,
        body: { error: { message: "número inválido" } },
      })),
    });
    const r = await provider.sendText("11999998888", "Olá");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("inválido");
  });

  it("recusa telefone inválido sem chamar a rede", async () => {
    const provider = createMetaCloudProvider({
      ...deps,
      fetchImpl: fakeFetch(() => {
        throw new Error("não deveria chamar");
      }),
    });
    const r = await provider.sendText("", "Olá");
    expect(r.ok).toBe(false);
  });
});

describe("resolveWhatsAppProvider (gating)", () => {
  const ENV = ["WHATSAPP_TOKEN", "WHATSAPP_ALLOW_SEND"];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
    ENV.forEach((k) => delete process.env[k]);
  });
  afterEach(() => {
    ENV.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  const meta = (enabled = true) => ({
    provider: "meta",
    phoneNumberId: "123",
    enabled,
  });

  it("provider vazio → simula", () => {
    expect(
      resolveWhatsAppProvider({ provider: "", phoneNumberId: "", enabled: true })
        .kind,
    ).toBe("simulate");
  });

  it("meta desabilitado → simula", () => {
    expect(resolveWhatsAppProvider(meta(false)).kind).toBe("simulate");
  });

  it("meta sem token → erro", () => {
    expect(resolveWhatsAppProvider(meta()).kind).toBe("error");
  });

  it("meta com token mas sem a flag de envio → erro", () => {
    process.env.WHATSAPP_TOKEN = "tok";
    expect(resolveWhatsAppProvider(meta()).kind).toBe("error");
  });

  it("meta liberado com token + flag", () => {
    process.env.WHATSAPP_TOKEN = "tok";
    process.env.WHATSAPP_ALLOW_SEND = "true";
    expect(resolveWhatsAppProvider(meta()).kind).toBe("provider");
  });
});
