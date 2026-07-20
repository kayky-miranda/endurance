"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { importCustomersCsvAction } from "./csv-import-actions";
import CsvImportModal, { type CsvField } from "./csv-import-modal";

const CUSTOMER_CSV_FIELDS: CsvField[] = [
  { key: "name", label: "Nome", required: true, hints: ["nome", "cliente"] },
  { key: "phone", label: "Telefone", hints: ["telefone", "celular", "fone", "whats"] },
  { key: "email", label: "E-mail", hints: ["mail"] },
  { key: "document", label: "CPF/CNPJ", hints: ["cpf", "cnpj", "documento", "doc"] },
];

export default function ImportCustomersButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
      >
        <UploadCloud className="h-4 w-4" /> Importar CSV
      </button>
      {open && (
        <CsvImportModal
          title="Importar clientes por planilha"
          fields={CUSTOMER_CSV_FIELDS}
          templateExample="Nome;Telefone;E-mail;CPF/CNPJ"
          onImport={importCustomersCsvAction}
          onClose={() => setOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
    </>
  );
}
