import { DocSection, DocField } from "../components/DocumentShell";
import { EXAM_FLAG_LABEL } from "@/lib/endurance/lab-exam-rules";
import { formatMetric } from "@/lib/endurance/metrics";
import { formatCpf } from "@/lib/endurance/patient";
import type { DocumentPayload } from "@/lib/endurance/document-data";

/**
 * Corpo de cada documento. Só a parte específica: o timbre, a assinatura e o
 * rodapé vêm do `DocumentShell`, então acrescentar um documento novo é escrever
 * a função daqui — sem repetir cabeçalho nem CSS de impressão.
 *
 * Todo conteúdo sai de dado REGISTRADO. Onde não há registro, o documento diz
 * que não há (em vez de imprimir uma seção vazia que parece erro).
 */

const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dtHour = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="doc-empty">{children}</p>;
}

export function renderDocument(payload: DocumentPayload): React.ReactNode {
  switch (payload.type) {
    case "declaracao-comparecimento":
      return <Declaracao p={payload} />;
    case "solicitacao-exames":
      return <SolicitacaoExames p={payload} />;
    case "anamnese":
      return <Anamnese p={payload} />;
    case "prontuario":
      return <Prontuario p={payload} />;
    case "evolucao":
      return <Evolucao p={payload} />;
    case "resultados-exames":
      return <ResultadosExames p={payload} />;
    case "historico-consultas":
      return <HistoricoConsultas p={payload} />;
    case "ficha-cadastral":
      return <FichaCadastral p={payload} />;
  }
}

function Declaracao({ p }: { p: Extract<DocumentPayload, { type: "declaracao-comparecimento" }> }) {
  const { patient, visit } = p;
  return (
    <>
      <p className="doc-paragraph">
        Declaro para os devidos fins que <strong>{patient.name}</strong>
        {patient.cpf ? `, portador(a) do CPF ${formatCpf(patient.cpf)},` : ""}{" "}
        compareceu a atendimento nesta unidade
        {visit ? (
          <>
            {" "}
            no dia <strong>{dt(visit.startsAt)}</strong>, no horário de{" "}
            <strong>{visit.startTime}</strong> às <strong>{visit.endTime}</strong>
            {visit.professional ? `, sob responsabilidade de ${visit.professional}` : ""}.
          </>
        ) : (
          "."
        )}
      </p>
      <p className="doc-paragraph">
        Declaração emitida a pedido do(a) interessado(a).
      </p>
    </>
  );
}

function SolicitacaoExames({ p }: { p: Extract<DocumentPayload, { type: "solicitacao-exames" }> }) {
  const { patient } = p;
  return (
    <>
      <DocSection title="Paciente">
        <DocField label="Nome" value={patient.name} />
        {patient.birthDate && <DocField label="Nascimento" value={dt(patient.birthDate)} />}
        {patient.cpf && <DocField label="CPF" value={formatCpf(patient.cpf)} />}
        {patient.insuranceName && (
          <DocField label="Convênio" value={patient.insuranceName} />
        )}
      </DocSection>

      {p.hypothesis && (
        <DocSection title="Hipótese diagnóstica / indicação">
          <p className="doc-paragraph">{p.hypothesis}</p>
        </DocSection>
      )}

      <DocSection title="Exames solicitados">
        {/* Linhas em branco: o pedido costuma ser preenchido à mão na consulta. */}
        <ol className="doc-request-list">
          {Array.from({ length: 10 }).map((_, i) => (
            <li key={i} className="doc-request-line" />
          ))}
        </ol>
      </DocSection>
    </>
  );
}

function Anamnese({ p }: { p: Extract<DocumentPayload, { type: "anamnese" }> }) {
  return (
    <>
      <PatientHeader patient={p.patient} />
      <DocSection title={`Questionário${p.status ? ` (${p.status})` : ""}`}>
        {p.items.length === 0 ? (
          <Empty>Nenhuma resposta registrada.</Empty>
        ) : (
          <dl className="doc-qa">
            {p.items.map((it, i) => (
              <div key={i} className="doc-qa-item">
                <dt className="doc-qa-q">{it.question}</dt>
                <dd className="doc-qa-a">{it.answer || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </DocSection>
    </>
  );
}

function Prontuario({ p }: { p: Extract<DocumentPayload, { type: "prontuario" }> }) {
  return (
    <>
      <PatientHeader patient={p.patient} />
      {p.notes.length === 0 ? (
        <Empty>Nenhuma anotação clínica registrada.</Empty>
      ) : (
        p.notes.map((n, i) => (
          <DocSection
            key={i}
            title={`${dtHour(n.createdAt)}${n.title ? ` · ${n.title}` : ""}`}
          >
            {n.cid && (
              <p className="doc-cid">
                CID {n.cid}
                {n.cidDescription ? ` — ${n.cidDescription}` : ""}
              </p>
            )}
            <p className="doc-paragraph doc-prewrap">{n.content}</p>
            {n.authorName && <p className="doc-author">Registrado por {n.authorName}</p>}
          </DocSection>
        ))
      )}
    </>
  );
}

function Evolucao({ p }: { p: Extract<DocumentPayload, { type: "evolucao" }> }) {
  return (
    <>
      <PatientHeader patient={p.patient} />
      {p.trends.length === 0 ? (
        <Empty>Nenhuma medição registrada.</Empty>
      ) : (
        p.trends.map((t) => (
          <DocSection key={t.metric} title={t.label}>
            <DocField
              label="Atual"
              value={`${formatMetric(t.stats.last, t.decimals)} ${t.unit}`}
            />
            <DocField
              label="Primeira medição"
              value={`${formatMetric(t.stats.first, t.decimals)} ${t.unit}`}
            />
            <DocField
              label="Variação"
              value={`${t.stats.delta > 0 ? "+" : ""}${formatMetric(t.stats.delta, t.decimals)} ${t.unit}`}
            />
            <DocField label="Última em" value={dt(t.lastAt)} />
          </DocSection>
        ))
      )}
    </>
  );
}

function ResultadosExames({ p }: { p: Extract<DocumentPayload, { type: "resultados-exames" }> }) {
  return (
    <>
      <PatientHeader patient={p.patient} />
      <DocSection title="Resultados registrados">
        {p.exams.length === 0 ? (
          <Empty>Nenhum resultado registrado.</Empty>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Exame</th>
                <th className="doc-right">Resultado</th>
                <th>Referência</th>
                <th>Situação</th>
                <th>Coleta</th>
              </tr>
            </thead>
            <tbody>
              {p.exams.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.name}
                    {e.panel && <span className="doc-muted"> · {e.panel}</span>}
                  </td>
                  <td className="doc-right doc-strong">
                    {e.value}
                    {e.unit ? ` ${e.unit}` : ""}
                  </td>
                  <td className="doc-muted">{e.rangeLabel}</td>
                  <td className={e.flag === "normal" ? "" : "doc-strong"}>
                    {EXAM_FLAG_LABEL[e.flag]}
                  </td>
                  <td className="doc-muted">{dt(e.collectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocSection>
    </>
  );
}

function HistoricoConsultas({ p }: { p: Extract<DocumentPayload, { type: "historico-consultas" }> }) {
  return (
    <>
      <PatientHeader patient={p.patient} />
      <DocSection title={`Atendimentos (${p.appointments.length})`}>
        {p.appointments.length === 0 ? (
          <Empty>Nenhum atendimento registrado.</Empty>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Atendimento</th>
                <th>Profissional</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {p.appointments.map((a, i) => (
                <tr key={i}>
                  <td>{dtHour(a.startsAt)}</td>
                  <td>{a.service || "—"}</td>
                  <td>{a.professional || "—"}</td>
                  <td className="doc-muted">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocSection>
    </>
  );
}

function FichaCadastral({ p }: { p: Extract<DocumentPayload, { type: "ficha-cadastral" }> }) {
  const d = p.detail;
  return (
    <>
      <DocSection title="Dados pessoais">
        <DocField label="Nome" value={d.name} />
        <DocField label="CPF" value={d.cpf ? formatCpf(d.cpf) : ""} />
        <DocField label="RG" value={d.rg} />
        <DocField label="Nascimento" value={d.birthDate ? dt(d.birthDate) : ""} />
        <DocField label="Sexo" value={d.sex} />
        <DocField label="Estado civil" value={d.maritalStatus} />
        <DocField label="Profissão" value={d.profession} />
      </DocSection>

      <DocSection title="Contato">
        <DocField label="Telefone" value={d.phone} />
        <DocField label="E-mail" value={d.email} />
      </DocSection>

      <DocSection title="Endereço">
        <DocField
          label="Logradouro"
          value={[d.street, d.number, d.complement].filter(Boolean).join(", ")}
        />
        <DocField label="Bairro" value={d.district} />
        <DocField
          label="Cidade / UF"
          value={[d.city, d.state].filter(Boolean).join(" / ")}
        />
        <DocField label="CEP" value={d.cep} />
      </DocSection>

      {(d.insuranceName || d.insurancePlan || d.insuranceCard) && (
        <DocSection title="Convênio">
          <DocField label="Convênio" value={d.insuranceName} />
          <DocField label="Plano" value={d.insurancePlan} />
          <DocField label="Carteirinha" value={d.insuranceCard} />
          <DocField
            label="Validade"
            value={d.insuranceValidity ? dt(d.insuranceValidity) : ""}
          />
        </DocSection>
      )}

      {(d.responsibleName || d.responsiblePhone) && (
        <DocSection title="Responsável">
          <DocField label="Nome" value={d.responsibleName} />
          <DocField label="Telefone" value={d.responsiblePhone} />
          <DocField label="Parentesco" value={d.responsibleRelation} />
        </DocSection>
      )}
    </>
  );
}

function PatientHeader({
  patient,
}: {
  patient: { name: string; birthDate?: string | null; cpf?: string; insuranceName?: string };
}) {
  return (
    <DocSection title="Paciente">
      <DocField label="Nome" value={patient.name} />
      {patient.birthDate && <DocField label="Nascimento" value={dt(patient.birthDate)} />}
      {patient.cpf && <DocField label="CPF" value={formatCpf(patient.cpf)} />}
      {patient.insuranceName && <DocField label="Convênio" value={patient.insuranceName} />}
    </DocSection>
  );
}
