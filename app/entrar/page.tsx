import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(`/espaco/${session.slug}`);
  const { next } = await searchParams;

  return (
    <>
      <div className="aurora" aria-hidden />
      <div className="aurora-beacon" aria-hidden />

      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
            <Compass className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            ENDURANCE
          </span>
        </Link>

        <div className="rounded-2xl border border-ink-700 bg-ink-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="mt-1 text-sm text-slate-400">
            Acesse o espaço do seu negócio.
          </p>
          <LoginForm next={next} />
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Ainda não tem um espaço?{" "}
          <Link href="/" className="text-brand-300 hover:underline">
            Criar agora
          </Link>
        </p>
      </main>
    </>
  );
}
