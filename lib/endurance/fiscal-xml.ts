/**
 * Busca, de forma best-effort, o conteúdo do XML autorizado a partir da URL
 * que o provedor (ex.: Focus NFe) devolve na emissão. Guardar o XML é
 * obrigação legal (5 anos), então capturamos uma cópia própria assim que a
 * nota é autorizada.
 *
 * Best-effort: se a URL exigir autenticação, expirar ou cair, retorna "" sem
 * derrubar a emissão — a nota já está autorizada na SEFAZ; o XML pode ser
 * recuperado depois pelo `xmlUrl` do provedor. (O download autenticado direto
 * pelo provedor é uma melhoria futura.)
 *
 * `fetchImpl` é injetável para testes sem rede.
 */
export async function fetchXmlContent(
  url: string | undefined | null,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<string> {
  if (!url) return "";
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    if (!res.ok) return "";
    const text = await res.text();
    // Sanidade: precisa parecer XML (evita guardar uma página de erro HTML/JSON).
    return text.trimStart().startsWith("<?xml") || text.trimStart().startsWith("<")
      ? text
      : "";
  } catch {
    return "";
  }
}
