// Gerado por scripts/gen-brand.mjs — não edite à mão.
// Marca ENDURANCE (bússola). Usa currentColor: defina a cor pelo `color`/`text-*`
// do contexto e funciona em fundo claro, escuro ou monocromático.
import type { SVGProps } from "react";

export function BrandMark({
  size = 24,
  title = "ENDURANCE",
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M120,2 L114.66,92.51 L125.34,92.51 Z M120,238 L125.34,147.49 L114.66,147.49 Z M230,120 L147.49,114.66 L147.49,125.34 Z M10,120 L92.51,125.34 L92.51,114.66 Z M162.43,77.57 L133.57,95.51 L144.49,106.43 Z M162.43,162.43 L144.49,133.57 L133.57,144.49 Z M77.57,162.43 L106.43,144.49 L95.51,133.57 Z M77.57,77.57 L95.51,106.43 L106.43,95.51 Z" fill="currentColor"/>
        <circle cx="120" cy="120" r="75" fill="none" stroke="currentColor" strokeWidth="7"/>
        <circle cx="120" cy="120" r="64" fill="none" stroke="currentColor" strokeWidth="3"/>
        <circle cx="120" cy="120" r="31" fill="none" stroke="currentColor" strokeWidth="5"/>
        <path d="M120,92 L128,120 L120,148 L112,120 Z M124.5,120 a4.5,4.5 0 1,0 -9,0 a4.5,4.5 0 1,0 9,0 Z" fill="currentColor" fillRule="evenodd"/>
    </svg>
  );
}
