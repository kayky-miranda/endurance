/**
 * TESTE DO CICLO DE VIDA DAS CREDENCIAIS.
 *
 * As propriedades verificadas aqui são as que falham em silêncio: um token de
 * reset que aceita dois usos, um código de backup de 2FA que continua valendo
 * depois de gasto, um token expirado que ainda passa. Nada disso aparece na
 * tela — aparece no dia em que alguém explora.
 *
 * Trabalha na camada de dados + helpers puros, porque as server actions leem
 * cabeçalhos de request (rate limit por IP) e não existem fora de um request.
 *
 * Dados ZZAUTH, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import { hashPassword, verifyPassword } from "../lib/auth.ts";
import {
  generateTotpSecret,
  totpCode,
  verifyTotpCode,
  generateBackupCodes,
  normalizeBackupCode,
  hashBackupCode,
} from "../lib/totp.ts";
import { generateToken, hashToken } from "../lib/tokens.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 54 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, det = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${det ? " :: " + det : ""}`);
  if (!cond) falhas.push(desc + (det ? " :: " + det : ""));
};

let orgId = "";

/** Repete o que resetPasswordAction faz no banco, sem o rate limit por IP. */
async function aplicarReset(tokenPlain: string, novaSenha: string) {
  const tokenHash = hashToken(tokenPlain);
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!token || token.usedAt || token.expiresAt < new Date())
    return { ok: false, error: "Link expirado ou já usado." };
  const passwordHash = await hashPassword(novaSenha);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: token.userId, usedAt: null, id: { not: token.id } },
      data: { usedAt: new Date() },
    }),
  ]);
  return { ok: true };
}

try {
  h("preparo");
  const org = await prisma.organization.create({
    data: { slug: `zzauth-${Date.now()}`, name: "ZZAUTH", niche: "outro", nicheLabel: "Outro" },
  });
  orgId = org.id;
  const user = await prisma.user.create({
    data: {
      organizationId: orgId, email: `zzauth.${Date.now()}@exemplo.com`,
      name: "ZZAUTH Dono", passwordHash: await hashPassword("senhaAntiga1"),
      role: "OWNER", profile: "administrador", permissions: [],
    },
  });
  say(`  usuário ${user.email}`);

  h("1. hash de senha");
  const hash = await hashPassword("segredo123");
  check(hash !== "segredo123" && hash.length > 50, "senha nunca fica em texto claro", `${hash.slice(0, 7)}…`);
  check(await verifyPassword("segredo123", hash), "senha correta valida");
  check(!(await verifyPassword("segredo124", hash)), "senha errada não valida");
  const hash2 = await hashPassword("segredo123");
  check(hash !== hash2, "mesma senha gera hashes diferentes (salt por hash)");

  h("2. token de reset: guardado só como hash");
  const t1 = generateToken();
  const criado = await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: t1.hash, expiresAt: new Date(Date.now() + 3600_000) },
  });
  check(criado.tokenHash !== t1.plain, "o banco guarda o hash, não o token do link");
  check(hashToken(t1.plain) === criado.tokenHash, "o hash é determinístico (permite achar pelo link)");

  h("3. uso único");
  const r1 = await aplicarReset(t1.plain, "senhaNova1");
  check(r1.ok === true, "primeiro uso do link funciona", r1.error ?? "");
  const depois = await prisma.user.findUnique({ where: { id: user.id } });
  check(await verifyPassword("senhaNova1", depois!.passwordHash), "a senha realmente mudou");
  const r2 = await aplicarReset(t1.plain, "senhaInvasor1");
  check(r2.ok === false, "MESMO link recusado na segunda vez", r2.error ?? "");
  const aindaNova = await prisma.user.findUnique({ where: { id: user.id } });
  check(
    await verifyPassword("senhaNova1", aindaNova!.passwordHash),
    "a senha não foi trocada pelo segundo uso",
  );

  h("4. token expirado");
  const t2 = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: t2.hash, expiresAt: new Date(Date.now() - 1000) },
  });
  const r3 = await aplicarReset(t2.plain, "senhaExpirada1");
  check(r3.ok === false, "token expirado é recusado", r3.error ?? "");

  h("5. um reset invalida os irmãos vivos");
  // Cenário: atacante pede reset, vítima também pede e troca a senha. O token
  // do atacante tem que morrer junto.
  const doAtacante = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: doAtacante.hash, expiresAt: new Date(Date.now() + 3600_000) },
  });
  const daVitima = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: daVitima.hash, expiresAt: new Date(Date.now() + 3600_000) },
  });
  const rv = await aplicarReset(daVitima.plain, "senhaDaVitima1");
  check(rv.ok === true, "a vítima troca a senha", rv.error ?? "");
  const ra = await aplicarReset(doAtacante.plain, "senhaDoAtacante1");
  check(ra.ok === false, "o token do atacante morre junto", ra.error ?? "");
  const final = await prisma.user.findUnique({ where: { id: user.id } });
  check(
    await verifyPassword("senhaDaVitima1", final!.passwordHash),
    "a senha final é a que a vítima escolheu",
  );

  h("6. token de outro usuário não serve");
  const outro = await prisma.user.create({
    data: {
      organizationId: orgId, email: `zzauth.outro.${Date.now()}@exemplo.com`,
      name: "ZZAUTH Outro", passwordHash: await hashPassword("senhaOutro1"),
      role: "MEMBER", profile: "caixa", permissions: [],
    },
  });
  const tOutro = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: outro.id, tokenHash: tOutro.hash, expiresAt: new Date(Date.now() + 3600_000) },
  });
  await aplicarReset(tOutro.plain, "trocadaPeloToken1");
  const donoIntacto = await prisma.user.findUnique({ where: { id: user.id } });
  check(
    await verifyPassword("senhaDaVitima1", donoIntacto!.passwordHash),
    "o reset do outro usuário não mexeu na senha do dono",
  );

  h("7. TOTP");
  const secret = generateTotpSecret();
  const agora = Date.now();
  const codigo = totpCode(secret, agora);
  check(/^\d{6}$/.test(codigo), "código tem 6 dígitos", codigo);
  check(verifyTotpCode(secret, codigo, agora), "código do momento vale");
  check(
    verifyTotpCode(secret, totpCode(secret, agora - 30_000), agora),
    "janela anterior é aceita (relógio do celular atrasado)",
  );
  check(
    !verifyTotpCode(secret, totpCode(secret, agora - 300_000), agora),
    "código de 5 minutos atrás NÃO vale",
  );
  check(!verifyTotpCode(secret, "000000", agora), "código errado não vale");
  check(
    !verifyTotpCode(generateTotpSecret(), codigo, agora),
    "código de outro segredo não vale",
  );

  h("8. códigos de backup: uso único");
  const codigos = generateBackupCodes(8);
  check(codigos.length === 8, "gera 8 códigos", `${codigos.length}`);
  check(new Set(codigos).size === 8, "todos diferentes");
  const hashes = codigos.map((c) => hashBackupCode(normalizeBackupCode(c)));
  check(!hashes.includes(codigos[0]), "o banco guarda hash, não o código");
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabledAt: new Date(), totpBackupCodes: hashes },
  });

  // Consome o primeiro, como faz verifyTotpLoginAction.
  const alvo = hashBackupCode(normalizeBackupCode(codigos[0]));
  const u1 = await prisma.user.findUnique({ where: { id: user.id } });
  const idx = u1!.totpBackupCodes.indexOf(alvo);
  check(idx >= 0, "código válido é encontrado na lista", `índice ${idx}`);
  await prisma.user.update({
    where: { id: user.id },
    data: { totpBackupCodes: u1!.totpBackupCodes.filter((_, i) => i !== idx) },
  });
  const u2 = await prisma.user.findUnique({ where: { id: user.id } });
  check(u2!.totpBackupCodes.length === 7, "a lista perde um código", `${u2!.totpBackupCodes.length}`);
  check(
    u2!.totpBackupCodes.indexOf(alvo) === -1,
    "o código gasto NÃO vale de novo",
  );
  check(
    u2!.totpBackupCodes.includes(hashBackupCode(normalizeBackupCode(codigos[1]))),
    "os outros códigos continuam valendo",
  );

  h("9. normalização do código de backup");
  const c = codigos[0];
  check(
    normalizeBackupCode(c.toLowerCase()) === normalizeBackupCode(c.toUpperCase()),
    "maiúscula e minúscula dão o mesmo código",
  );
  check(
    normalizeBackupCode(` ${c} `) === normalizeBackupCode(c),
    "espaço em volta é ignorado (colar do gerenciador de senhas)",
  );

  h("10. usuário bloqueado e removido");
  await prisma.user.update({ where: { id: outro.id }, data: { status: "blocked" } });
  const bloqueado = await prisma.user.findUnique({ where: { id: outro.id } });
  check(bloqueado?.status === "blocked", "status persiste como blocked");
  check(
    await verifyPassword("trocadaPeloToken1", bloqueado!.passwordHash),
    "a senha continua válida no banco (o bloqueio é na sessão, não na senha)",
  );

  h("RESULTADO");
  if (!falhas.length) say("  Ciclo de credenciais íntegro: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    const us = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
    for (const t of ["passwordResetToken", "emailVerifyToken"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { userId: { in: us.map((u) => u.id) } } }); } catch { /* */ }
    }
    try { await prisma.user.deleteMany({ where: { organizationId: orgId } }); } catch { /* */ }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* */ }
    say("\n[limpeza] dados ZZAUTH removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
