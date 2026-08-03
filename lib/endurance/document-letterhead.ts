import "server-only";
import { prisma } from "@/lib/db";

/**
 * Papel timbrado dos documentos impressos.
 *
 * Antes cada tela de impressão montava o próprio cabeçalho — a receita mostrava
 * só o nome da clínica e a cidade, o recibo mostrava outra coisa, e nenhuma
 * tinha logo, endereço ou assinatura. Aqui a composição é UMA só: toda página
 * imprimível pede o timbre a esta função e o `DocumentShell` desenha igual.
 *
 * Reaproveita o que já existe no sistema em vez de duplicar cadastro:
 *  - logo vem de `ThemeSettings` (já usada no app);
 *  - CNPJ/razão social vêm de `FiscalConfig` (já preenchidos para a NFC-e);
 *  - endereço/telefone/rodapé ficam em `DocumentSettings`, que é o que faltava.
 */

export interface Letterhead {
  clinicName: string;
  /** Razão social, quando difere do nome fantasia. */
  legalName: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  headerNote: string;
  footerText: string;
  logoDataUrl: string | null;
  accentColor: string;
}

export interface SignatureBlock {
  name: string;
  /** Registro profissional (CRM/CRN/CRP/CREF/CRO…). */
  council: string;
  signatureDataUrl: string | null;
}

const ACCENT_FALLBACK = "#0EA5E9";
/** Hex de 3 ou 6 dígitos — evita injetar string arbitrária no `style`. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function getLetterhead(org: string): Promise<Letterhead> {
  const [organization, settings, theme, fiscal] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org },
      select: { name: true, city: true, state: true },
    }),
    prisma.documentSettings.findUnique({ where: { organizationId: org } }),
    prisma.themeSettings.findFirst({
      where: { organizationId: org },
      select: { logoDataUrl: true },
    }),
    prisma.fiscalConfig.findFirst({
      where: { organizationId: org },
      select: { cnpj: true, razaoSocial: true },
    }),
  ]);

  // Sem endereço configurado, cidade/UF da organização já dão um cabeçalho
  // decente — melhor do que deixar a linha vazia.
  const fallbackAddress = [organization?.city, organization?.state]
    .filter(Boolean)
    .join(" / ");

  const accent = settings?.accentColor ?? "";
  return {
    clinicName: settings?.displayName?.trim() || organization?.name || "Clínica",
    legalName: fiscal?.razaoSocial ?? "",
    cnpj: settings?.showCnpj === false ? "" : (fiscal?.cnpj ?? ""),
    address: settings?.address?.trim() || fallbackAddress,
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    website: settings?.website ?? "",
    headerNote: settings?.headerNote ?? "",
    footerText: settings?.footerText ?? "",
    logoDataUrl:
      settings?.showLogo === false ? null : (theme?.logoDataUrl ?? null),
    accentColor: HEX.test(accent) ? accent : ACCENT_FALLBACK,
  };
}

/**
 * Bloco de assinatura do profissional. `userId` nulo cai para o usuário da
 * sessão — o caso comum, em que quem imprime é quem assina.
 */
export async function getSignature(
  org: string,
  userId: string,
  fallbackName = "",
): Promise<SignatureBlock> {
  const [user, profile] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, organizationId: org },
      select: { name: true },
    }),
    prisma.professionalProfile.findFirst({
      where: { organizationId: org, userId },
      select: { council: true, signatureDataUrl: true },
    }),
  ]);
  return {
    name: user?.name || fallbackName,
    council: profile?.council ?? "",
    signatureDataUrl: profile?.signatureDataUrl ?? null,
  };
}

/**
 * Valores atuais para preencher o formulário de configuração. Diferente de
 * `getLetterhead`, que já resolve os fallbacks (cidade/UF no lugar do endereço,
 * por exemplo): aqui devolvemos o que está REALMENTE salvo, senão o usuário
 * salvaria um fallback como se fosse escolha dele.
 */
export interface DocumentSettingsView {
  displayName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  headerNote: string;
  footerText: string;
  showLogo: boolean;
  showCnpj: boolean;
  accentColor: string;
  /** Só para a pré-visualização. */
  orgName: string;
  logoDataUrl: string | null;
}

export async function getDocumentSettings(
  org: string,
): Promise<DocumentSettingsView> {
  const [row, organization, theme] = await Promise.all([
    prisma.documentSettings.findUnique({ where: { organizationId: org } }),
    prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
    prisma.themeSettings.findFirst({
      where: { organizationId: org },
      select: { logoDataUrl: true },
    }),
  ]);
  return {
    displayName: row?.displayName ?? "",
    address: row?.address ?? "",
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    website: row?.website ?? "",
    headerNote: row?.headerNote ?? "",
    footerText: row?.footerText ?? "",
    showLogo: row?.showLogo ?? true,
    showCnpj: row?.showCnpj ?? true,
    accentColor: row?.accentColor ?? ACCENT_FALLBACK,
    orgName: organization?.name ?? "",
    logoDataUrl: theme?.logoDataUrl ?? null,
  };
}

export interface DocumentSettingsInput {
  displayName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  headerNote?: string;
  footerText?: string;
  showLogo?: boolean;
  showCnpj?: boolean;
  accentColor?: string;
}

const str = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);

export async function saveDocumentSettings(
  org: string,
  input: DocumentSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const accent = str(input.accentColor, 7);
  if (accent && !HEX.test(accent))
    return { ok: false, error: "Cor de destaque inválida (use #RRGGBB)." };

  const data = {
    displayName: str(input.displayName, 120),
    address: str(input.address, 200),
    phone: str(input.phone, 40),
    email: str(input.email, 120),
    website: str(input.website, 120),
    headerNote: str(input.headerNote, 160),
    footerText: str(input.footerText, 300),
    showLogo: input.showLogo ?? true,
    showCnpj: input.showCnpj ?? true,
    accentColor: accent || ACCENT_FALLBACK,
  };

  await prisma.documentSettings.upsert({
    where: { organizationId: org },
    create: { organizationId: org, ...data },
    update: data,
  });
  return { ok: true };
}

export async function saveSignature(
  org: string,
  userId: string,
  signatureDataUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
  // Limite conservador: a assinatura vai inline no HTML impresso e é guardada
  // no banco como data URL (mesma abordagem já usada para o logo).
  if (signatureDataUrl && signatureDataUrl.length > 300_000)
    return { ok: false, error: "Imagem de assinatura muito grande (máx. ~200 KB)." };
  if (signatureDataUrl && !/^data:image\/(png|jpeg|webp);base64,/.test(signatureDataUrl))
    return { ok: false, error: "Envie uma imagem PNG, JPEG ou WebP." };

  await prisma.professionalProfile.upsert({
    where: { userId },
    create: { organizationId: org, userId, signatureDataUrl },
    update: { signatureDataUrl },
  });
  return { ok: true };
}
