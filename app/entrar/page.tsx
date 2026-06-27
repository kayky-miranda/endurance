import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/app/components/BrandMark";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

const VERIFY_BANNERS: Record<string, { kind: "ok" | "err"; msg: string }> = {
  ok: { kind: "ok", msg: "E-mail confirmado! Faça login para continuar." },
  expired: { kind: "err", msg: "O link expirou. Solicite um novo dentro do app." },
  invalid: { kind: "err", msg: "Link inválido. Solicite um novo dentro do app." },
  used: { kind: "err", msg: "Este link já foi usado." },
  missing: { kind: "err", msg: "Token ausente." },
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verify?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(`/espaco/${session.slug}`);
  const { next, verify } = await searchParams;
  const banner = verify ? VERIFY_BANNERS[verify] : undefined;

  return (
    <>
      <div className="aurora" aria-hidden />
      <div className="aurora-beacon" aria-hidden />

      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
            <BrandMark className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            ENDURANCE
          </span>
        </Link>

        {banner && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              banner.kind === "ok"
                ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                : "border-amber-700 bg-amber-950/40 text-amber-200"
            }`}
          >
            {banner.msg}
          </div>
        )}

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
