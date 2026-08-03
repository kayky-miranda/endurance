import type {
  Letterhead,
  SignatureBlock,
} from "@/lib/endurance/document-letterhead";

/**
 * Moldura A4 dos documentos impressos — cabeçalho timbrado, corpo, bloco de
 * assinatura e rodapé.
 *
 * É o que garante que receita, atestado, laudo, declaração e relatório saiam
 * IGUAIS: cada página cuida só do próprio conteúdo e delega a identidade visual
 * para cá. Antes cada tela desenhava o seu cabeçalho e nenhuma tinha logo,
 * endereço ou assinatura.
 *
 * Regras de impressão embutidas:
 *  - largura fixa de A4 com margens, para não depender do zoom do navegador;
 *  - `print-color-adjust: exact` preserva a cor de destaque no papel (por
 *    padrão os navegadores removem fundos ao imprimir);
 *  - `.no-print` some na impressão (barra de ações);
 *  - `break-inside: avoid` nas seções evita cortar um bloco entre páginas;
 *  - o rodapé repete em todas as páginas via `position: fixed`.
 */

export interface DocumentShellProps {
  letterhead: Letterhead;
  /** Título do documento, ex.: "Atestado médico". */
  title: string;
  /** Linha discreta abaixo do título (paciente, período, nº do documento). */
  subtitle?: string;
  /** Assinatura ao pé; omita em documentos que não são assinados. */
  signature?: SignatureBlock | null;
  /** Texto do local/data acima da assinatura. */
  place?: string;
  issuedAt?: Date;
  children: React.ReactNode;
}

const fullDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export function DocumentShell({
  letterhead: lh,
  title,
  subtitle,
  signature,
  place,
  issuedAt = new Date(),
  children,
}: DocumentShellProps) {
  const contact = [lh.phone, lh.email, lh.website].filter(Boolean).join(" · ");
  const legal = [lh.legalName, lh.cnpj ? `CNPJ ${lh.cnpj}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="doc mx-auto bg-white text-slate-800">
      <style>{PRINT_CSS}</style>

      {/* Cabeçalho timbrado */}
      <header className="doc-head" style={{ borderColor: lh.accentColor }}>
        {lh.logoDataUrl && (
          /* eslint-disable-next-line @next/next/no-img-element -- data URL; o
             otimizador do Next não se aplica e quebraria a impressão. */
          <img src={lh.logoDataUrl} alt="" className="doc-logo" />
        )}
        <div className="doc-head-text">
          <h1 className="doc-clinic" style={{ color: lh.accentColor }}>
            {lh.clinicName}
          </h1>
          {lh.headerNote && <p className="doc-note">{lh.headerNote}</p>}
          {lh.address && <p className="doc-line">{lh.address}</p>}
          {contact && <p className="doc-line">{contact}</p>}
          {legal && <p className="doc-line doc-legal">{legal}</p>}
        </div>
      </header>

      {/* Título */}
      <div className="doc-title-wrap">
        <h2 className="doc-title">{title}</h2>
        {subtitle && <p className="doc-subtitle">{subtitle}</p>}
      </div>

      <main className="doc-body">{children}</main>

      {/* Assinatura */}
      {signature && (
        <section className="doc-sign">
          <p className="doc-place">
            {[place || lh.address.split(",")[0] || "", fullDate(issuedAt)]
              .filter(Boolean)
              .join(", ")}
          </p>
          {signature.signatureDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- ver acima */
            <img src={signature.signatureDataUrl} alt="" className="doc-sign-img" />
          )}
          <div className="doc-sign-line" />
          <p className="doc-sign-name">{signature.name}</p>
          {signature.council && (
            <p className="doc-sign-council">{signature.council}</p>
          )}
        </section>
      )}

      {lh.footerText && <footer className="doc-foot">{lh.footerText}</footer>}
    </div>
  );
}

/**
 * Corte de página — use entre documentos na impressão em lote para cada um
 * começar numa folha nova.
 */
export function PageBreak() {
  return <div className="doc-break" aria-hidden="true" />;
}

/** Bloco de conteúdo que não deve ser partido entre duas folhas. */
export function DocSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="doc-section">
      {title && <h3 className="doc-section-title">{title}</h3>}
      {children}
    </section>
  );
}

/** Par rótulo/valor — o formato que quase todo documento usa nos dados. */
export function DocField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="doc-field">
      <span className="doc-field-label">{label}</span>
      <span className="doc-field-value">{value || "—"}</span>
    </div>
  );
}

const PRINT_CSS = `
.doc {
  width: 210mm;
  min-height: 297mm;
  padding: 16mm 18mm 22mm;
  box-sizing: border-box;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 11.5pt;
  line-height: 1.45;
}
.doc-head {
  display: flex; align-items: center; gap: 14px;
  border-bottom-width: 2px; border-bottom-style: solid;
  padding-bottom: 10px;
}
.doc-logo { max-height: 22mm; max-width: 42mm; object-fit: contain; }
.doc-head-text { min-width: 0; }
.doc-clinic { font-size: 16pt; font-weight: 700; letter-spacing: -0.2px; margin: 0; }
.doc-note { font-size: 9.5pt; font-style: italic; color: #475569; margin: 2px 0 4px; }
.doc-line { font-size: 9pt; color: #475569; margin: 1px 0; }
.doc-legal { color: #64748b; }
.doc-title-wrap { margin-top: 12mm; text-align: center; }
.doc-title { font-size: 14pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
.doc-subtitle { font-size: 10pt; color: #475569; margin-top: 3px; }
.doc-body { margin-top: 8mm; }
.doc-section { margin-top: 6mm; break-inside: avoid; page-break-inside: avoid; }
.doc-section-title {
  font-size: 10pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: #334155;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;
}
.doc-field { display: flex; gap: 6px; font-size: 10.5pt; padding: 1.5px 0; }
.doc-field-label { color: #64748b; min-width: 34mm; }
.doc-field-value { font-weight: 500; }
.doc-sign { margin-top: 16mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
.doc-place { font-size: 10pt; color: #475569; margin-bottom: 12mm; }
.doc-sign-img { max-height: 18mm; margin: 0 auto -4mm; display: block; }
.doc-sign-line { width: 70mm; border-top: 1px solid #334155; margin: 0 auto 4px; }
.doc-sign-name { font-size: 11pt; font-weight: 600; }
.doc-sign-council { font-size: 9.5pt; color: #475569; }
.doc-foot {
  margin-top: 12mm; padding-top: 6px; border-top: 1px solid #e2e8f0;
  font-size: 8.5pt; color: #64748b; text-align: center;
}
.doc-break { break-after: page; page-break-after: always; height: 0; }

/* Conteúdo dos documentos */
.doc-paragraph { margin: 3mm 0; text-align: justify; }
.doc-prewrap { white-space: pre-wrap; text-align: left; }
.doc-empty { font-size: 10pt; color: #64748b; font-style: italic; padding: 4mm 0; }
.doc-cid { font-size: 9.5pt; color: #475569; margin-bottom: 2px; }
.doc-author { font-size: 8.5pt; color: #94a3b8; margin-top: 2px; }
.doc-muted { color: #64748b; }
.doc-strong { font-weight: 600; }
.doc-right { text-align: right; }
.doc-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.doc-table th {
  text-align: left; font-size: 8.5pt; text-transform: uppercase;
  letter-spacing: 0.4px; color: #64748b; font-weight: 600;
  border-bottom: 1px solid #cbd5e1; padding: 3px 6px 3px 0;
}
.doc-table td { padding: 3px 6px 3px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.doc-qa-item { margin-bottom: 3mm; break-inside: avoid; page-break-inside: avoid; }
.doc-qa-q { font-size: 9.5pt; font-weight: 600; color: #334155; }
.doc-qa-a { font-size: 10.5pt; margin: 1px 0 0; white-space: pre-wrap; }
/* Pedido de exames: linhas para preencher à mão na consulta. */
.doc-request-list { list-style: none; padding: 0; margin: 4mm 0 0; }
.doc-request-line { border-bottom: 1px solid #cbd5e1; height: 9mm; }

@media print {
  /* Sem isto o navegador descarta cores de fundo/borda e o timbre sai apagado. */
  html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .doc { width: auto; min-height: 0; padding: 0; box-shadow: none !important; }
  @page { size: A4; margin: 14mm 15mm; }
}
`;
