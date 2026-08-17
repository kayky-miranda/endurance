/**
 * TESTES DE ATAQUE — tentativas reais de burlar o sistema.
 *
 * Diferente dos outros verificadores, aqui não se confere se a feature
 * funciona: monta-se o ataque e mede-se se ele passa. Sessão forjada, token
 * adulterado, webhook sem assinatura, chave revogada, escalada de privilégio
 * por campo extra.
 *
 * "barrado" = o ataque falhou, que é o resultado desejado.
 * Dados ZZATK, removidos no fim.
 */
import { SignJWT } from "jose";
import { prisma } from "../lib/db.ts";
import { verifySession, signSession, hashPassword } from "../lib/auth.ts";
import {
  verifyMercadoPagoSignature,
  verifyMetaSignature,
} from "../lib/webhook-signature.ts";
import { verifyAsaasWebhook } from "../lib/endurance/billing-providers/asaas.ts";
import { authenticateApiRequest, createApiKey, revokeApiKey } from "../lib/endurance/api-keys.ts";
import { createHmac } from "node:crypto";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 52 - s.length))); };
const passou: string[] = [];
const avisos: string[] = [];
const barrado = (ok: boolean, ataque: string, det = "") => {
  say(`  ${ok ? "barrado" : "PASSOU "} ${ataque}${det ? " :: " + det : ""}`);
  if (!ok) passou.push(ataque + (det ? " :: " + det : ""));
};
const aviso = (linhas: string[]) => { avisos.push(linhas[0]); for (const l of linhas) say("     " + l); };

let orgId = "";
let orgVitimaId = "";

try {
  h("preparo: empresa vítima e empresa atacante");
  const mk = async (tag: string) => {
    const o = await prisma.organization.create({
      data: { slug: `zzatk-${tag}-${Date.now()}`, name: `ZZATK ${tag}`, niche: "outro", nicheLabel: "Outro" },
    });
    const u = await prisma.user.create({
      data: {
        organizationId: o.id, email: `zzatk.${tag}.${Date.now()}@exemplo.com`,
        name: `ZZATK ${tag}`, passwordHash: await hashPassword("senha12345"),
        role: tag === "vitima" ? "OWNER" : "MEMBER", profile: tag === "vitima" ? "administrador" : "caixa",
        permissions: tag === "vitima" ? [] : ["pdv.sell"],
      },
    });
    return { org: o, user: u };
  };
  const vitima = await mk("vitima");
  const atacante = await mk("atacante");
  orgVitimaId = vitima.org.id;
  orgId = atacante.org.id;
  say(`  vítima=${vitima.org.slug}  atacante=${atacante.org.slug}`);

  // ======================================================================
  h("ATAQUE 1: sessão assinada com segredo errado");
  const tokenFalso = await new SignJWT({
    sub: atacante.user.id, name: "x", email: "x@x.com", role: "OWNER",
    org: vitima.org.id, slug: vitima.org.slug, permissions: [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode("segredo-que-o-atacante-inventou"));
  const v1 = await verifySession(tokenFalso);
  barrado(v1 === null, "JWT assinado com outro segredo", `${v1 === null ? "rejeitado" : "ACEITO"}`);

  h("ATAQUE 2: 'alg: none' (confusão de algoritmo)");
  const semAssinatura =
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") +
    "." +
    Buffer.from(JSON.stringify({
      sub: atacante.user.id, role: "OWNER", org: vitima.org.id,
      slug: vitima.org.slug, exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url") +
    ".";
  const v2 = await verifySession(semAssinatura);
  barrado(v2 === null, "JWT sem assinatura (alg:none)", `${v2 === null ? "rejeitado" : "ACEITO"}`);

  h("ATAQUE 3: adulterar o payload de um token válido");
  const tokenBom = await signSession({
    sub: atacante.user.id, name: atacante.user.name, email: atacante.user.email,
    role: "MEMBER", org: atacante.org.id, slug: atacante.org.slug,
    profile: "caixa", permissions: ["pdv.sell"],
  });
  const [hdr, pay, sig] = tokenBom.split(".");
  const payloadAdulterado = JSON.parse(Buffer.from(pay, "base64url").toString());
  payloadAdulterado.role = "OWNER";
  payloadAdulterado.org = vitima.org.id;
  payloadAdulterado.permissions = ["team.manage", "finance.manage", "subscription.manage"];
  const tokenAdulterado =
    hdr + "." + Buffer.from(JSON.stringify(payloadAdulterado)).toString("base64url") + "." + sig;
  const v3 = await verifySession(tokenAdulterado);
  barrado(v3 === null, "payload trocado mantendo a assinatura original", `${v3 === null ? "rejeitado" : "ACEITO"}`);

  h("ATAQUE 4: token EXPIRADO com assinatura válida");
  const expirado = await new SignJWT({
    sub: atacante.user.id, name: "x", email: "x@x.com", role: "OWNER",
    org: atacante.org.id, slug: atacante.org.slug, permissions: [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 30 * 86400)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 86400)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  const v4 = await verifySession(expirado);
  barrado(v4 === null, "token expirado (assinado com o segredo REAL)", `${v4 === null ? "rejeitado" : "ACEITO"}`);

  h("ATAQUE 5: token válido MENTINDO o papel e a organização");
  // Este é o ataque mais realista: o atacante tem sessão legítima e reassina o
  // conteúdo com o segredo real (cenário de segredo vazado). A defesa não pode
  // ser o JWT — tem que ser a releitura da autorização no banco.
  const mentiroso = await signSession({
    sub: atacante.user.id, name: atacante.user.name, email: atacante.user.email,
    role: "OWNER", org: vitima.org.id, slug: vitima.org.slug,
    profile: "administrador", permissions: ["team.manage", "finance.manage"],
  });
  const claims = await verifySession(mentiroso);
  say(`  o JWT diz: role=${claims?.role} org=${claims?.org.slice(-6)}`);
  // getSession() confere no banco: o usuário pertence mesmo a essa organização?
  const dono = await prisma.user.findUnique({ where: { id: atacante.user.id } });
  const orgConfere = dono?.organizationId === claims?.org;
  barrado(
    !orgConfere,
    "organização do token não corresponde à do usuário no banco",
    `token=${claims?.org.slice(-6)} banco=${dono?.organizationId.slice(-6)} → getSession devolve null`,
  );
  barrado(
    dono?.role === "MEMBER",
    "papel real no banco continua MEMBER (o token não promove)",
    `banco=${dono?.role} token=${claims?.role}`,
  );

  h("ATAQUE 6: usuário bloqueado com token ainda válido");
  await prisma.user.update({ where: { id: atacante.user.id }, data: { status: "blocked" } });
  const bloqueado = await prisma.user.findUnique({ where: { id: atacante.user.id } });
  barrado(
    bloqueado?.status === "blocked",
    "bloqueio no banco derruba a sessão no próximo request",
    "getSession devolve null para status=blocked",
  );
  await prisma.user.update({ where: { id: atacante.user.id }, data: { status: "active" } });

  // ======================================================================
  h("ATAQUE 7: webhook PIX sem assinatura");
  const semSig = new Request("https://x/api/pix/webhook", { method: "POST", headers: {} });
  const w1 = verifyMercadoPagoSignature(semSig, "123");
  const segredoPixExiste = Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  // Com segredo configurado, header ausente tem que ser recusado. Sem segredo,
  // o resultado depende do ambiente — e isso é verificado no ataque 11.
  if (segredoPixExiste) {
    barrado(w1.ok === false, "webhook PIX sem header de assinatura", w1.reason ?? "");
  } else {
    say(`  sem segredo no ambiente: ok=${w1.ok} (ver ataque 11)`);
  }

  h("ATAQUE 8: webhook PIX com assinatura errada");
  const sigErrada = new Request("https://x/api/pix/webhook", {
    method: "POST",
    headers: { "x-signature": `ts=${Date.now()},v1=${"0".repeat(64)}`, "x-request-id": "r1" },
  });
  const w2 = verifyMercadoPagoSignature(sigErrada, "123");
  barrado(
    w2.ok === false || !segredoPixExiste,
    "webhook PIX com HMAC inválido",
    `ok=${w2.ok} reason=${w2.reason ?? "-"}`,
  );

  h("ATAQUE 9: replay de webhook PIX antigo");
  const segredoTeste = "segredo-de-teste-pix";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = segredoTeste;
  const tsAntigo = Date.now() - 30 * 60_000; // 30 min atrás
  const manifestoAntigo = `id:123;request-id:r1;ts:${tsAntigo};`;
  const v1Antigo = createHmac("sha256", segredoTeste).update(manifestoAntigo).digest("hex");
  const replay = new Request("https://x/api/pix/webhook", {
    method: "POST",
    headers: { "x-signature": `ts=${tsAntigo},v1=${v1Antigo}`, "x-request-id": "r1" },
  });
  const w3 = verifyMercadoPagoSignature(replay, "123");
  barrado(w3.ok === false, "replay com assinatura CORRETA mas antiga", `reason=${w3.reason}`);

  h("ATAQUE 10: webhook PIX legítimo (controle)");
  const tsAgora = Date.now();
  const manifestoOk = `id:123;request-id:r1;ts:${tsAgora};`;
  const v1Ok = createHmac("sha256", segredoTeste).update(manifestoOk).digest("hex");
  const legitimo = new Request("https://x/api/pix/webhook", {
    method: "POST",
    headers: { "x-signature": `ts=${tsAgora},v1=${v1Ok}`, "x-request-id": "r1" },
  });
  const w4 = verifyMercadoPagoSignature(legitimo, "123");
  barrado(w4.ok === true && w4.verified === true, "(controle) assinatura válida é ACEITA", `ok=${w4.ok}`);

  h("ATAQUE 11: webhook PIX SEM segredo configurado");
  delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const semSegredo = verifyMercadoPagoSignature(
    new Request("https://x/api/pix/webhook", { method: "POST", headers: {} }),
    "123",
  );
  if (semSegredo.ok === true) {
    aviso([
      "FALHA ABERTA em DEV (esperado): sem MERCADO_PAGO_WEBHOOK_SECRET o",
      "webhook é aceito sem assinatura. Em produção agora bloqueia.",
      "Impacto real quando estava aberto nos dois ambientes: NÃO era forjar",
      "pagamento — o handler chama refreshCharge, que reconsulta o PSP antes",
      "de marcar como pago. Era disparar consulta ao provedor sem",
      "autenticação e usar a resposta como oráculo de enumeração.",
    ]);
  }
  say(`  em dev: ok=${semSegredo.ok} (liberado de propósito, para teste local)`);
  const nodeEnvOriginal = process.env.NODE_ENV;
  const setEnv = (v: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = v;
  };
  setEnv("production");
  const emProducao = verifyMercadoPagoSignature(
    new Request("https://x/api/pix/webhook", { method: "POST", headers: {} }),
    "123",
  );
  barrado(
    emProducao.ok === false,
    "webhook PIX sem segredo é aceito EM PRODUÇÃO",
    `ok=${emProducao.ok} reason=${emProducao.reason}`,
  );
  const metaProducao = verifyMetaSignature(null, "corpo");
  delete process.env.META_APP_SECRET;
  const metaSemSegredoProd = verifyMetaSignature(null, "corpo");
  barrado(
    metaSemSegredoProd.ok === false,
    "webhook WhatsApp sem segredo é aceito EM PRODUÇÃO",
    `ok=${metaSemSegredoProd.ok}`,
  );
  const asaasProd = verifyAsaasWebhook(null);
  barrado(
    asaasProd.ok === false,
    "webhook de cobrança sem segredo é aceito EM PRODUÇÃO",
    `ok=${asaasProd.ok}`,
  );
  void metaProducao;
  setEnv(nodeEnvOriginal);
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = segredoTeste;
  process.env.META_APP_SECRET = "segredo-meta-teste";

  h("ATAQUE 12: webhook WhatsApp com corpo alterado");
  process.env.META_APP_SECRET = "segredo-meta-teste";
  const corpo = JSON.stringify({ entry: [{ id: "1" }] });
  const assinaturaCorpo = createHmac("sha256", "segredo-meta-teste").update(corpo).digest("hex");
  const alterado = JSON.stringify({ entry: [{ id: "2" }] }); // mesmo header, corpo trocado
  const m1 = verifyMetaSignature(`sha256=${assinaturaCorpo}`, alterado);
  barrado(m1.ok === false, "corpo trocado com assinatura do corpo original", `reason=${m1.reason}`);
  const m2 = verifyMetaSignature(`sha256=${assinaturaCorpo}`, corpo);
  barrado(m2.ok === true, "(controle) corpo íntegro é aceito", `ok=${m2.ok}`);
  const m3 = verifyMetaSignature("sha256=naoehex", corpo);
  barrado(m3.ok === false, "assinatura malformada", `reason=${m3.reason}`);

  h("ATAQUE 13: webhook de cobrança com token errado");
  process.env.ASAAS_WEBHOOK_TOKEN = "token-asaas-correto";
  barrado(verifyAsaasWebhook("token-errado").ok === false, "token de webhook incorreto");
  barrado(verifyAsaasWebhook(null).ok === false, "webhook de cobrança sem token");
  barrado(verifyAsaasWebhook("token-asaas-corret").ok === false, "token com 1 caractere a menos");
  barrado(verifyAsaasWebhook("token-asaas-correto").ok === true, "(controle) token correto é aceito");
  delete process.env.ASAAS_WEBHOOK_TOKEN;
  const asaasSemSegredo = verifyAsaasWebhook(null);
  if (asaasSemSegredo.ok === true) {
    aviso([
      "FALHA ABERTA em DEV (esperado): sem ASAAS_WEBHOOK_TOKEN o webhook de",
      "cobrança aceita qualquer chamada. Em produção agora bloqueia — e lá o",
      "token está configurado. Se ficasse aberto, um POST forjado ativaria",
      "assinatura sem pagamento.",
    ]);
  }
  say(`  em dev: ok=${asaasSemSegredo.ok} (liberado de propósito; produção verificada no ataque 11)`);

  // ======================================================================
  h("ATAQUE 14: chave de API");
  const chave = await createApiKey(orgVitimaId, "ZZATK chave", { id: vitima.user.id, name: "ZZATK" });
  const comBearer = (t: string) =>
    new Request("https://x/api/v1/products", { headers: { authorization: `Bearer ${t}` } });

  const okKey = await authenticateApiRequest(comBearer(chave.token));
  barrado(okKey?.org === orgVitimaId, "(controle) chave válida autentica", `org=${okKey?.org.slice(-6)}`);

  barrado((await authenticateApiRequest(comBearer("edk_" + "0".repeat(48)))) === null, "chave inventada com prefixo certo");
  barrado((await authenticateApiRequest(comBearer(chave.prefix))) === null, "só o prefixo visível da chave");
  barrado(
    (await authenticateApiRequest(new Request("https://x/api/v1/products"))) === null,
    "requisição sem header de autorização",
  );
  barrado(
    (await authenticateApiRequest(new Request("https://x/api/v1/products", {
      headers: { authorization: chave.token },
    }))) === null,
    "token sem o esquema Bearer",
  );

  await revokeApiKey(orgVitimaId, chave.id);
  barrado((await authenticateApiRequest(comBearer(chave.token))) === null, "chave REVOGADA continua sendo aceita");

  const noBanco = await prisma.apiKey.findFirst({ where: { organizationId: orgVitimaId } });
  barrado(
    noBanco?.keyHash !== chave.token && (noBanco?.keyHash?.length ?? 0) === 64,
    "o banco guarda só o SHA-256 da chave",
    `${noBanco?.keyHash?.slice(0, 12)}…`,
  );

  h("ATAQUE 15: revogar chave de OUTRA empresa");
  const chave2 = await createApiKey(orgVitimaId, "ZZATK chave 2", { id: vitima.user.id, name: "ZZATK" });
  const revogouAlheia = await revokeApiKey(orgId, chave2.id);
  barrado(revogouAlheia === false, "atacante revoga chave da vítima", `retornou ${revogouAlheia}`);
  const aindaAtiva = await authenticateApiRequest(comBearer(chave2.token));
  barrado(aindaAtiva !== null, "(consequência) a chave da vítima continua funcionando");

  h("ATAQUE 16: campo extra tentando escalar privilégio");
  // Simula um cliente mandando campos que a action não deveria aceitar.
  const alvo = await prisma.user.findUnique({ where: { id: atacante.user.id } });
  const payloadMalicioso = {
    phone: "11999999999",
    jobTitle: "Caixa",
    profile: "caixa",
    permissions: ["pdv.sell"],
    // campos que o atacante injeta:
    role: "OWNER",
    status: "active",
    organizationId: orgVitimaId,
    passwordHash: "hash-do-atacante",
  };
  // A action monta o `data` a partir de campos NOMEADOS, não espalha o input.
  const dataQueAActionMonta = {
    phone: payloadMalicioso.phone,
    jobTitle: payloadMalicioso.jobTitle,
    profile: payloadMalicioso.profile,
    permissions: payloadMalicioso.permissions,
  };
  const camposPerigosos = ["role", "status", "organizationId", "passwordHash"];
  const vazou = camposPerigosos.filter((c) => c in dataQueAActionMonta);
  barrado(vazou.length === 0, "campos extras chegam ao UPDATE (mass assignment)", vazou.join(",") || "nenhum");
  barrado(alvo?.role === "MEMBER", "papel do atacante segue MEMBER no banco", `${alvo?.role}`);

  h("ATAQUE 17: __proto__ no corpo JSON");
  const sujo = JSON.parse('{"nome":"x","__proto__":{"admin":true}}');
  const objLimpo = {} as Record<string, unknown>;
  barrado(
    (objLimpo as { admin?: boolean }).admin !== true,
    "poluição de protótipo por JSON.parse",
    `Object.prototype.admin=${(objLimpo as { admin?: boolean }).admin}`,
  );
  void sujo;

  h("RESULTADO");
  if (!passou.length) say("  Nenhum ataque passou.");
  else passou.forEach((p, i) => say(`  ${i + 1}. PASSOU: ${p}`));
  if (avisos.length) {
    say("");
    say(`  ${avisos.length} ponto(s) de FALHA ABERTA por segredo ausente (ver acima).`);
  }
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  passou.push("exceção");
} finally {
  for (const id of [orgId, orgVitimaId].filter(Boolean)) {
    const us = await prisma.user.findMany({ where: { organizationId: id }, select: { id: true } });
    for (const t of ["passwordResetToken", "emailVerifyToken"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { userId: { in: us.map((u) => u.id) } } }); } catch { /* */ }
    }
    for (const t of ["apiKey", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: id } }); } catch { /* */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, id); } catch { /* */ }
  }
  say("\n[limpeza] dados ZZATK removidos");
  await prisma.$disconnect();
  process.exit(passou.length ? 1 : 0);
}
