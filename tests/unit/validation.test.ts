import { describe, it, expect } from "vitest";
import {
  SignupSchema,
  CreateUserSchema,
  CreateInviteSchema,
  AcceptInviteSchema,
  ProductSchema,
  StockAdjustSchema,
  FinanceEntrySchema,
  FiscalConfigSchema,
  firstError,
} from "@/lib/validation";

const validSignup = {
  name: "Mercadinho",
  niche: "mercado_varejo",
  moduleIds: ["pdv"],
  ownerName: "Maria",
  email: "MARIA@TESTE.COM",
  password: "secret12",
};

describe("SignupSchema", () => {
  it("aceita payload válido e normaliza o e-mail para lowercase", () => {
    const r = SignupSchema.safeParse(validSignup);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("maria@teste.com");
      expect(r.data.ownerName).toBe("Maria");
    }
  });

  it("rejeita senha curta", () => {
    const r = SignupSchema.safeParse({ ...validSignup, password: "abc1" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/8 caracteres/);
  });

  it("rejeita senha sem número", () => {
    const r = SignupSchema.safeParse({ ...validSignup, password: "semnumero" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/número/i);
  });

  it("rejeita senha sem letra", () => {
    const r = SignupSchema.safeParse({ ...validSignup, password: "12345678" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/letra/i);
  });

  it("rejeita e-mail inválido", () => {
    const r = SignupSchema.safeParse({ ...validSignup, email: "nao-email" });
    expect(r.success).toBe(false);
  });

  it("exige ao menos um módulo", () => {
    const r = SignupSchema.safeParse({ ...validSignup, moduleIds: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/módulo/i);
  });

  it("rejeita nome do dono vazio", () => {
    const r = SignupSchema.safeParse({ ...validSignup, ownerName: "  " });
    expect(r.success).toBe(false);
  });
});

describe("CreateUserSchema", () => {
  it("aceita básico", () => {
    const r = CreateUserSchema.safeParse({
      name: "João",
      email: "joao@x.com",
      password: "secret12",
      profile: "operador_pdv",
    });
    expect(r.success).toBe(true);
  });

  it("exige perfil", () => {
    const r = CreateUserSchema.safeParse({
      name: "João",
      email: "joao@x.com",
      password: "secret12",
      profile: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("CreateInviteSchema", () => {
  it("aceita e-mail + perfil", () => {
    const r = CreateInviteSchema.safeParse({
      email: "convite@x.com",
      profile: "operador_pdv",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("convite@x.com");
  });

  it("rejeita perfil vazio", () => {
    const r = CreateInviteSchema.safeParse({ email: "x@x.com", profile: "" });
    expect(r.success).toBe(false);
  });
});

describe("AcceptInviteSchema", () => {
  it("aceita token longo + nome + senha forte", () => {
    const r = AcceptInviteSchema.safeParse({
      token: "a".repeat(40),
      name: "Pedro",
      password: "abc12345",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita token curto", () => {
    const r = AcceptInviteSchema.safeParse({
      token: "abc",
      name: "Pedro",
      password: "abc12345",
    });
    expect(r.success).toBe(false);
  });
});

describe("ProductSchema", () => {
  it("aceita produto mínimo e normaliza numéricos ausentes para 0", () => {
    const r = ProductSchema.safeParse({ name: "  Arroz 5kg  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Arroz 5kg");
      expect(r.data.barcode).toBe("");
      expect(r.data.category).toBe("");
      expect(r.data.price).toBe(0);
      expect(r.data.stock).toBe(0);
    }
  });

  it("coage preço e trunca estoque (negativo vira 0)", () => {
    const r = ProductSchema.safeParse({
      name: "Feijão",
      price: "8,5" as unknown as number, // vírgula não coage → 0
      stock: 12.9,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stock).toBe(12);
    }
    const neg = ProductSchema.safeParse({ name: "X", stock: -5 });
    if (neg.success) expect(neg.data.stock).toBe(0);
  });

  it("rejeita nome vazio", () => {
    const r = ProductSchema.safeParse({ name: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/nome/i);
  });
});

describe("StockAdjustSchema", () => {
  it("trunca delta e mantém negativo", () => {
    const r = StockAdjustSchema.safeParse({ id: "abc", delta: -3.7 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.delta).toBe(-3);
  });

  it("rejeita id vazio", () => {
    const r = StockAdjustSchema.safeParse({ id: "", delta: 1 });
    expect(r.success).toBe(false);
  });
});

describe("FinanceEntrySchema", () => {
  it("aceita lançamento válido e arredonda o valor", () => {
    const r = FinanceEntrySchema.safeParse({
      kind: "pagar",
      description: "  Conta de luz  ",
      amount: 199.999,
      dueDate: "2026-07-10",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.description).toBe("Conta de luz");
      expect(r.data.amount).toBe(200);
      expect(r.data.category).toBe("Outros");
    }
  });

  it("rejeita valor zero ou negativo", () => {
    const r = FinanceEntrySchema.safeParse({
      kind: "receber",
      description: "X",
      amount: 0,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/valor/i);
  });

  it("rejeita data inválida", () => {
    const r = FinanceEntrySchema.safeParse({
      kind: "receber",
      description: "X",
      amount: 10,
      dueDate: "31/02/2026",
    });
    expect(r.success).toBe(false);
  });

  it("kind inválido cai para 'receber'", () => {
    const r = FinanceEntrySchema.safeParse({
      kind: "qualquer" as unknown as "receber",
      description: "X",
      amount: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe("receber");
  });
});

describe("FiscalConfigSchema", () => {
  const base = {
    cnpj: "12.345.678/0001-95",
    razaoSocial: "Mercadinho do Zé LTDA",
  };

  it("sanitiza CNPJ (só dígitos) e aplica defaults", () => {
    const r = FiscalConfigSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cnpj).toBe("12345678000195");
      expect(r.data.uf).toBe("SP");
      expect(r.data.ambiente).toBe("2");
      expect(r.data.crt).toBe("1");
      expect(r.data.serie).toBe(1);
      expect(r.data.cscId).toBe("000001");
    }
  });

  it("rejeita CNPJ com dígitos insuficientes", () => {
    const r = FiscalConfigSchema.safeParse({ ...base, cnpj: "123" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/CNPJ/i);
  });

  it("rejeita razão social vazia", () => {
    const r = FiscalConfigSchema.safeParse({ ...base, razaoSocial: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toMatch(/razão social/i);
  });

  it("clampa série em [1, 999] e aceita provider conhecido", () => {
    const r = FiscalConfigSchema.safeParse({
      ...base,
      serie: 5000,
      provider: "focusnfe",
      ambiente: "1",
      crt: "3",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.serie).toBe(999);
      expect(r.data.provider).toBe("focusnfe");
      expect(r.data.ambiente).toBe("1");
      expect(r.data.crt).toBe("3");
    }
  });
});
