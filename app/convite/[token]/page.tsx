import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import ConviteForm from "./convite-form";

export const metadata: Metadata = {
  title: "Aceitar convite — ENDURANCE",
};

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      email: true,
      acceptedAt: true,
      expiresAt: true,
      organization: { select: { name: true } },
    },
  });

  const valid = !!invite && !invite.acceptedAt && invite.expiresAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-ink-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-ink-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {valid ? "Você foi convidado(a)!" : "Convite inválido"}
        </h1>

        {valid ? (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Você foi convidado para o espaço{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {invite!.organization.name}
              </strong>
              . Para aceitar, complete seu cadastro abaixo.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              E-mail: <span className="font-mono">{invite!.email}</span>
            </p>
            <div className="mt-6">
              <ConviteForm token={token} />
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              Este convite expirou ou já foi usado.
            </p>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
              Peça um novo link para quem te convidou.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
