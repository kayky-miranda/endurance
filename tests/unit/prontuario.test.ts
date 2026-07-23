import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Prontuário clínico: as garantias que protegem o dado sensível — anotação
 * sempre de um paciente da própria org, conteúdo não-vazio, e exclusão LÓGICA
 * (nunca hard-delete). O acesso é isolado por organização.
 */
const { prisma } = vi.hoisted(() => ({
  prisma: {
    customer: { findFirst: vi.fn() },
    appointment: { findFirst: vi.fn() },
    clinicalNote: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  createNote,
  updateNote,
  deleteNote,
} from "@/lib/endurance/prontuario";

const ORG = "org1";
const ACTOR = { id: "u1", name: "Dra. Ana" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.clinicalNote.create.mockResolvedValue({ id: "note1" });
  prisma.clinicalNote.update.mockResolvedValue({});
});

describe("createNote", () => {
  it("recusa conteúdo vazio antes de tocar no banco", async () => {
    const res = await createNote(ORG, ACTOR, { customerId: "c1", content: "  " });
    expect(res.ok).toBe(false);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it("recusa paciente inexistente na org", async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    const res = await createNote(ORG, ACTOR, { customerId: "c1", content: "ok" });
    expect(res.ok).toBe(false);
    expect(prisma.clinicalNote.create).not.toHaveBeenCalled();
  });

  it("cria a anotação com autor e conteúdo aparado", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    const res = await createNote(ORG, ACTOR, {
      customerId: "c1",
      title: " Retorno ",
      content: "  evoluiu bem  ",
    });
    expect(res.ok).toBe(true);
    const data = prisma.clinicalNote.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe(ORG);
    expect(data.customerId).toBe("c1");
    expect(data.authorId).toBe("u1");
    expect(data.content).toBe("evoluiu bem");
    expect(data.title).toBe("Retorno");
  });

  it("só vincula o atendimento se for do mesmo paciente e org", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "c1" });
    // atendimento de OUTRO paciente → não vincula
    prisma.appointment.findFirst.mockResolvedValue({ id: "a1", customerId: "cX" });
    await createNote(ORG, ACTOR, {
      customerId: "c1",
      appointmentId: "a1",
      content: "x",
    });
    expect(prisma.clinicalNote.create.mock.calls[0][0].data.appointmentId).toBeNull();

    prisma.clinicalNote.create.mockClear();
    // atendimento do MESMO paciente → vincula
    prisma.appointment.findFirst.mockResolvedValue({ id: "a1", customerId: "c1" });
    await createNote(ORG, ACTOR, {
      customerId: "c1",
      appointmentId: "a1",
      content: "x",
    });
    expect(prisma.clinicalNote.create.mock.calls[0][0].data.appointmentId).toBe("a1");
  });
});

describe("updateNote", () => {
  it("recusa conteúdo vazio", async () => {
    const res = await updateNote(ORG, "note1", { content: "" });
    expect(res.ok).toBe(false);
    expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
  });

  it("recusa anotação de outra org", async () => {
    prisma.clinicalNote.findFirst.mockResolvedValue(null);
    const res = await updateNote(ORG, "note1", { content: "ok" });
    expect(res.ok).toBe(false);
  });

  it("edita quando existe na org", async () => {
    prisma.clinicalNote.findFirst.mockResolvedValue({ id: "note1" });
    const res = await updateNote(ORG, "note1", { content: "nova conduta" });
    expect(res.ok).toBe(true);
    expect(prisma.clinicalNote.update.mock.calls[0][0].data.content).toBe("nova conduta");
  });
});

describe("deleteNote", () => {
  it("faz exclusão LÓGICA (deletedAt), nunca delete físico", async () => {
    prisma.clinicalNote.findFirst.mockResolvedValue({ id: "note1" });
    const res = await deleteNote(ORG, "note1");
    expect(res.ok).toBe(true);
    const call = prisma.clinicalNote.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "note1" });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it("recusa remover anotação de outra org", async () => {
    prisma.clinicalNote.findFirst.mockResolvedValue(null);
    const res = await deleteNote(ORG, "note1");
    expect(res.ok).toBe(false);
    expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
  });
});
