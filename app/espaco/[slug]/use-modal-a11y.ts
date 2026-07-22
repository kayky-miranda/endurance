"use client";

import { useEffect, useRef } from "react";

/**
 * Acessibilidade de modal, em um lugar só.
 *
 * Devolve a ref do contêiner do diálogo e cuida de:
 *  - focar o primeiro campo ao abrir (o operador já começa digitando);
 *  - PRENDER o Tab dentro do modal (sem isso, o teclado "escapa" para a
 *    página atrás, que está visualmente coberta);
 *  - fechar no ESC;
 *  - DEVOLVER o foco ao elemento que abriu o modal quando ele fecha — sem
 *    isso, quem usa teclado ou leitor de tela é jogado para o topo da página.
 *
 * Uso:
 *   const ref = useModalA11y<HTMLDivElement>(onClose);
 *   <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="…">
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalA11y<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Guarda o onClose em ref para o efeito rodar UMA vez por abertura, mesmo
  // que o callback venha como arrow inline (o caso comum).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Focar no próximo frame: o conteúdo pode não estar pintado ainda.
    const t = window.setTimeout(() => {
      const list = focusables();
      (list[0] ?? ref.current)?.focus();
    }, 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !ref.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      // Devolve o foco para quem abriu (se ainda estiver na tela).
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return ref;
}
