// Verifica se a IA de onboarding está ativa, batendo no endpoint local.
// Uso: npm run check:ai            (porta padrão 3100)
//      PORT=3000 npm run check:ai  (outra porta)
//
// Mostra se a classificação veio do Claude ("ai") ou do fallback por
// palavras-chave ("fallback"). Requer o dev server rodando.

const port = process.env.PORT || "3100";
const url = `http://localhost:${port}/api/onboarding`;
const description = "Tenho um mercadinho de bairro em Campinas, SP.";

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    console.error(`Endpoint respondeu ${res.status}. O servidor está rodando?`);
    process.exit(1);
  }
  const data = await res.json();
  console.log(`\nDescrição: ${description}`);
  console.log(`Nicho:     ${data.nicheLabel} (${Math.round(data.confidence * 100)}%)`);
  console.log(`Origem:    ${data.source}`);
  if (data.source === "ai") {
    console.log("\n✅ IA ATIVA — a classificação veio do provedor de IA.\n");
  } else {
    console.log(
      "\n⚠️  MODO DEMONSTRAÇÃO — sem chave de IA, ou erro/sem créditos na chamada.",
    );
    console.log(
      "   Cole uma chave (GEMINI_API_KEY) em .env e reinicie o servidor.\n",
    );
  }
} catch (e) {
  console.error(`Não consegui acessar ${url}.`);
  console.error("Suba o servidor com: npm run dev -- -p " + port);
  process.exit(1);
}
