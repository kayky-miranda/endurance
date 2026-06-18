import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import RedefinirForm from "./redefinir-form";

export const metadata: Metadata = {
  title: "Redefinir senha — ENDURANCE",
};

export default async function RedefinirPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);
  const found = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { usedAt: true, expiresAt: true },
  });

  const valid = !!found && !found.usedAt && found.expiresAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-ink-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-ink-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Redefinir senha
        </h1>
        {valid ? (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Escolha uma nova senha para sua conta.
            </p>
            <div className="mt-6">
              <RedefinirForm token={token} />
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              Link inválido ou expirado.
            </p>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
              Solicite um novo link em{" "}
              <a href="/recuperar" className="underline underline-offset-2 font-medium">
                Recuperar senha
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
