import type { Metadata } from "next";
import RecuperarForm from "./recuperar-form";

export const metadata: Metadata = {
  title: "Recuperar senha — ENDURANCE",
};

export default function RecuperarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-ink-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-ink-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Recuperar senha
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
        </p>
        <div className="mt-6">
          <RecuperarForm />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          <a href="/entrar" className="underline underline-offset-2 hover:text-slate-600">
            Voltar ao login
          </a>
        </p>
      </div>
    </main>
  );
}
