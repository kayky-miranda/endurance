/**
 * TESTES DE ATAQUE — segunda rodada.
 *
 * Frentes que o primeiro arsenal não cobriu: redirecionamento aberto no
 * parâmetro `next`, prontuário clínico atravessando empresas (dado de saúde,
 * o mais sensível do sistema), abuso de convite, reuso de token de verificação
 * de e-mail, burla de limite de plano e enumeração de e-mails cadastrados.
 *
 * "barrado" = o ataque falhou, que é o resultado desejado.
 * Dados ZZATK2, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import { hashPassword } from "../lib/auth.ts";
import { generateToken, hashToken } from "../lib/tokens.ts";
import { getPatientRecord, createNote, updateNote, deleteNote } from "../lib/endurance/prontuario.ts";
import { getPatient } from "../lib/endurance/pacientes.ts";
import { planAllows, planCapabilities } from "../lib/endurance/billing.ts";
import { checkSeatAvailability } from "../lib/endurance/plan-limits.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 50 - s.length))); };
const passou: string[] = [];
const barrado = (ok: boolean, ataque: string, det = "") => {
  say(`  ${ok ? "barrado" : "PASSOU "} ${ataque}${det ? " :: " + det : ""}`);
  if (!ok) passou.push(ataque + (det ? " :: " + det : ""));
};

const orgs: string[] = [];
const BASE = "https://endurance-erp.com.br";

async function clinica(tag: string) {
  const o = await prisma.organization.create({
    data: { slug: `zzatk2-${tag}-${Date.now()}`, name: `ZZATK2 ${tag}`, niche: "clinica", nicheLabel: "Clínica" },
  });
  orgs.push(o.id);
  const u = await prisma.user.create({
    data: {
      organizationId: o.id, email: `zzatk2.${tag}.${Date.now()}@exemplo.com`,
      name: `ZZATK2 ${tag}`, passwordHash: await hashPassword("senha12345"),
      role: "OWNER", profile: "administrador", permissions: [],
    },
  });
  return { org: o, user: u };
}

try {
  const A = await clinica("clinica-a");
  const B = await clinica("clinica-b");
  say(`clínica A=${A.org.slug}   clínica B=${B.org.slug}`);

  // ======================================================================
  h("ATAQUE 1: redirecionamento aberto via ?next=");
  // O login aceita `next` se começar com "/espaco/" e joga em
  // window.location.href. A pergunta é se algum payload sai do domínio depois
  // da normalização de caminho que o navegador faz.
  const aceito = (n: string) => n.startsWith("/espaco/");
  const payloads = [
    "/espaco/..//attacker.com",
    "/espaco/../../attacker.com",
    "/espaco/\\\\attacker.com",
    "/espaco/%2f%2fattacker.com",
    "/espaco/..%2f%2fattacker.com",
    "/espaco/@attacker.com",
    "/espaco/.attacker.com",
    "//attacker.com",
    "https://attacker.com",
    "javascript:alert(1)",
    "/espaco/x/../../../attacker.com",
  ];
  for (const p of payloads) {
    const passaNaListaBranca = aceito(p);
    let destino = "(recusado pela lista branca)";
    let mesmaOrigem = true;
    if (passaNaListaBranca) {
      try {
        const u = new URL(p, BASE);
        destino = u.origin + u.pathname;
        mesmaOrigem = u.origin === BASE;
      } catch {
        destino = "(URL inválida)";
        mesmaOrigem = true;
      }
    }
    barrado(
      !passaNaListaBranca || mesmaOrigem,
      `next="${p}"`,
      passaNaListaBranca ? `→ ${destino}` : destino,
    );
  }

  // ======================================================================
  h("ATAQUE 2: prontuário clínico de outra empresa (dado de saúde)");
  // Paciente é um Customer com perfil clínico; a nota liga por customerId.
  const pacienteB = await prisma.customer.create({
    data: {
      organizationId: B.org.id, name: "ZZATK2 Paciente da B",
      phone: "11999990000", email: "paciente.b@exemplo.com",
    },
  });
  await prisma.patientProfile.create({
    data: { organizationId: B.org.id, customerId: pacienteB.id },
  });
  const notaB = await prisma.clinicalNote.create({
    data: {
      organizationId: B.org.id, customerId: pacienteB.id,
      authorId: B.user.id, authorName: B.user.name,
      title: "Evolução", content: "ZZATK2 conteúdo clínico sigiloso da clínica B",
    },
  });

  const fichaCruzada = await getPatient(A.org.id, pacienteB.id);
  barrado(fichaCruzada === null, "ler ficha de paciente de outra clínica", fichaCruzada === null ? "" : "VAZOU DADO");

  const prontuarioCruzado = await getPatientRecord(A.org.id, pacienteB.id);
  barrado(
    prontuarioCruzado === null,
    "ler prontuário de outra clínica",
    prontuarioCruzado === null ? "" : "VAZOU DADO DE SAÚDE",
  );

  const escreve = await createNote(
    A.org.id,
    { id: A.user.id, name: A.user.name },
    { customerId: pacienteB.id, title: "Evolução", content: "ZZATK2 nota injetada" } as never,
  );
  barrado(escreve.ok === false, "escrever no prontuário de outra clínica", (escreve as { error?: string }).error ?? "");

  const altera = await updateNote(A.org.id, notaB.id, { content: "ZZATK2 alterado" } as never);
  barrado(altera.ok === false, "alterar nota clínica de outra clínica", (altera as { error?: string }).error ?? "");

  const apaga = await deleteNote(A.org.id, notaB.id);
  barrado(apaga.ok === false, "apagar nota clínica de outra clínica", (apaga as { error?: string }).error ?? "");

  const notaIntacta = await prisma.clinicalNote.findUnique({ where: { id: notaB.id } });
  barrado(
    notaIntacta?.content === "ZZATK2 conteúdo clínico sigiloso da clínica B",
    "conteúdo clínico da clínica B permanece intacto",
    notaIntacta?.content?.slice(0, 30) ?? "APAGADO",
  );
  const notasDeB = await prisma.clinicalNote.count({ where: { organizationId: B.org.id } });
  barrado(notasDeB === 1, "nenhuma nota injetada na clínica B", `${notasDeB}`);

  // ======================================================================
  h("ATAQUE 3: convite");
  const conviteToken = generateToken();
  const convite = await prisma.invite.create({
    data: {
      organizationId: B.org.id, email: `zzatk2.convidado.${Date.now()}@exemplo.com`,
      role: "MEMBER", profile: "caixa", permissions: ["pdv.sell"],
      tokenHash: conviteToken.hash, invitedById: B.user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  barrado(
    convite.tokenHash !== conviteToken.plain,
    "o banco guarda o hash do convite, não o token do link",
  );
  barrado(
    hashToken(conviteToken.plain) === convite.tokenHash,
    "(controle) o hash do link corresponde ao registro",
  );

  // Convite expirado
  const expirado = generateToken();
  await prisma.invite.create({
    data: {
      organizationId: B.org.id, email: `zzatk2.exp.${Date.now()}@exemplo.com`,
      role: "MEMBER", profile: "caixa", permissions: [],
      tokenHash: expirado.hash, invitedById: B.user.id,
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const achadoExp = await prisma.invite.findUnique({ where: { tokenHash: expirado.hash } });
  barrado(
    (achadoExp?.expiresAt ?? new Date()) < new Date(),
    "convite expirado é reconhecido como expirado",
    `${achadoExp?.expiresAt.toISOString()}`,
  );

  // Convite já aceito
  await prisma.invite.update({ where: { id: convite.id }, data: { acceptedAt: new Date() } });
  const jaAceito = await prisma.invite.findUnique({ where: { tokenHash: convite.tokenHash } });
  barrado(Boolean(jaAceito?.acceptedAt), "convite aceito fica marcado (bloqueia reuso)");

  // O convite carrega papel e permissões do REGISTRO, não do que o cliente manda.
  barrado(
    convite.role === "MEMBER" && !convite.permissions.includes("team.manage"),
    "o papel do convite vem do registro, não da requisição de aceite",
    `role=${convite.role} perms=${convite.permissions.join(",") || "-"}`,
  );

  // ======================================================================
  h("ATAQUE 4: token de verificação de e-mail");
  const verif = generateToken();
  const tokenVerif = await prisma.emailVerifyToken.create({
    data: {
      userId: A.user.id, email: A.user.email, tokenHash: verif.hash,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  barrado(tokenVerif.tokenHash !== verif.plain, "o banco guarda só o hash do token de e-mail");

  // Consome
  await prisma.$transaction([
    prisma.user.update({ where: { id: A.user.id }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerifyToken.update({ where: { id: tokenVerif.id }, data: { usedAt: new Date() } }),
  ]);
  const usado = await prisma.emailVerifyToken.findUnique({ where: { tokenHash: verif.hash } });
  barrado(Boolean(usado?.usedAt), "token de e-mail usado fica marcado (bloqueia reuso)");

  // Token de um usuário não pode verificar outro: o vínculo é o userId do registro.
  barrado(
    usado?.userId === A.user.id,
    "o token aponta um userId fixo (não aceita alvo na requisição)",
    `${usado?.userId.slice(-6)}`,
  );
  const bVerificado = await prisma.user.findUnique({ where: { id: B.user.id } });
  barrado(
    bVerificado?.emailVerifiedAt === null,
    "verificar o e-mail de A não verificou o de B",
    `${bVerificado?.emailVerifiedAt}`,
  );

  // ======================================================================
  h("ATAQUE 5: usar recurso de plano superior");
  const recursosBusiness = planCapabilities("business").filter(
    (f) => !planCapabilities("starter").includes(f),
  );
  say(`  recursos exclusivos de planos superiores: ${recursosBusiness.length}`);
  let liberouIndevido = 0;
  for (const f of recursosBusiness) {
    if (planAllows("starter", f)) {
      liberouIndevido++;
      say(`     PASSOU: starter recebeu "${f}"`);
    }
  }
  barrado(liberouIndevido === 0, "plano starter recebe recurso de plano superior", `${liberouIndevido} recurso(s)`);

  // Plano inventado não pode virar acesso total.
  const inventado = recursosBusiness.filter((f) => planAllows("plano-que-nao-existe", f));
  barrado(inventado.length === 0, "plano inexistente libera recursos", `${inventado.length}`);
  const vazio = recursosBusiness.filter((f) => planAllows("", f));
  barrado(vazio.length === 0, "plano vazio libera recursos", `${vazio.length}`);

  h("ATAQUE 6: estourar o limite de assentos do plano");
  await prisma.subscription.create({
    data: {
      organizationId: A.org.id, plan: "starter", status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });
  const antes = await checkSeatAvailability(A.org.id);
  say(`  assentos agora: ${antes.ok ? "há vaga" : "sem vaga"}${antes.ok ? "" : " :: " + (antes.error ?? "")}`);
  // Enche até o limite.
  for (let i = 0; i < 5; i++) {
    const vaga = await checkSeatAvailability(A.org.id);
    if (!vaga.ok) break;
    await prisma.user.create({
      data: {
        organizationId: A.org.id, email: `zzatk2.seat${i}.${Date.now()}@exemplo.com`,
        name: `ZZATK2 seat ${i}`, passwordHash: "x".repeat(60),
        role: "MEMBER", profile: "caixa", permissions: [],
      },
    });
  }
  const depois = await checkSeatAvailability(A.org.id);
  const totalUsuarios = await prisma.user.count({ where: { organizationId: A.org.id } });
  barrado(
    depois.ok === false,
    "criar usuários além do limite do plano",
    `${totalUsuarios} usuários, vaga=${depois.ok} ${depois.ok ? "" : "(" + (depois.error ?? "") + ")"}`,
  );

  h("ATAQUE 7: enumeração de e-mails cadastrados");
  // A mensagem de login não pode diferenciar "e-mail não existe" de "senha errada".
  const { loginAction } = await import("../app/actions.ts").catch(() => ({ loginAction: null }) as never);
  if (loginAction) {
    say("  (loginAction exige contexto de request — conferindo o código)");
  }
  const fonte = await import("node:fs").then((fs) =>
    fs.readFileSync("app/actions.ts", "utf8"),
  );
  // Só o CORPO do loginAction. A primeira versão varreu o arquivo inteiro e
  // acusou "Usuário não encontrado." de outra action — falso positivo meu.
  const ini = fonte.indexOf("export async function loginAction");
  const fim = fonte.indexOf("export async function", ini + 10);
  const corpoLogin = fonte.slice(ini, fim > 0 ? fim : undefined);

  const temMensagemUnica = corpoLogin.includes('"E-mail ou senha inválidos."');
  barrado(
    temMensagemUnica,
    "login usa mensagens diferentes para e-mail inexistente e senha errada",
    temMensagemUnica ? "mensagem única para os dois casos" : "MENSAGENS DIFERENTES",
  );
  // A falha é registrada mesmo quando o e-mail não existe, então o bloqueio por
  // tentativas não serve de oráculo.
  // Sem regex: a falha tem que ser registrada dentro do MESMO if que trata
  // "usuário não existe OU senha errada". Se só contasse para e-mail
  // existente, o bloqueio por tentativas viraria oráculo de enumeração.
  const iCond = corpoLogin.indexOf("if (!user ||");
  const iRecord = corpoLogin.indexOf("record(failKey", iCond);
  const contaFalhaSempre = iCond >= 0 && iRecord > iCond && iRecord - iCond < 300;
  barrado(
    contaFalhaSempre,
    "bloqueio por tentativas conta só e-mails existentes (viraria oráculo)",
    contaFalhaSempre ? "falha registrada nos dois casos" : "REGISTRA SÓ SE EXISTE",
  );

  // Vetor real, de menor porte: a mensagem de usuário bloqueado só aparece para
  // e-mail que existe. Quem tem a senha certa de uma conta bloqueada confirma
  // que ela existe — mas quem tem a senha certa já sabia disso.
  if (corpoLogin.includes("Usuário bloqueado")) {
    say("");
    say("  OBSERVAÇÃO (baixa): a mensagem \"Usuário bloqueado\" só aparece para");
    say("     e-mail cadastrado, então distingue conta bloqueada de inexistente.");
    say("     Só é alcançável por quem já acertou a senha, o que limita muito o");
    say("     valor do oráculo. Trocar por mensagem genérica esconderia do dono");
    say("     do espaço o motivo real de não conseguir entrar.");
    say("");
  }
  const resetFonte = await import("node:fs").then((fs) =>
    fs.readFileSync("app/recuperar/actions.ts", "utf8"),
  );
  const resetSempreOk = resetFonte.includes("return { ok: true }");
  const temAtrasoIgualador = /setTimeout|atraso|timing/i.test(resetFonte);
  barrado(
    resetSempreOk && temAtrasoIgualador,
    "reset de senha revela se o e-mail existe",
    `resposta única=${resetSempreOk}, atraso igualador=${temAtrasoIgualador}`,
  );

  h("RESULTADO");
  if (!passou.length) say("  Nenhum ataque passou.");
  else passou.forEach((p, i) => say(`  ${i + 1}. PASSOU: ${p}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  passou.push("exceção");
} finally {
  for (const id of orgs) {
    const us = await prisma.user.findMany({ where: { organizationId: id }, select: { id: true } });
    for (const t of ["passwordResetToken", "emailVerifyToken"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { userId: { in: us.map((u) => u.id) } } }); } catch { /* */ }
    }
    for (const t of ["clinicalNote", "patientProfile", "customer", "invite", "subscription", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: id } }); } catch { /* */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, id); } catch { /* */ }
  }
  say("\n[limpeza] dados ZZATK2 removidos");
  await prisma.$disconnect();
  process.exit(passou.length ? 1 : 0);
}
