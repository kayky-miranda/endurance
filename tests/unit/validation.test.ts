import { describe, it, expect } from "vitest";
import {
  SignupSchema,
  CreateUserSchema,
  CreateInviteSchema,
  AcceptInviteSchema,
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
