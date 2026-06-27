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
      <path d="M120,2 L115.71,94.36 L124.29,94.36 Z M120,238 L124.29,145.64 L115.71,145.64 Z M230,120 L145.64,115.71 L145.64,124.29 Z M10,120 L94.36,124.29 L94.36,115.71 Z M161.01,78.99 L133.2,97.6 L142.4,106.8 Z M161.01,161.01 L142.4,133.2 L133.2,142.4 Z M78.99,161.01 L106.8,142.4 L97.6,133.2 Z M78.99,78.99 L97.6,106.8 L106.8,97.6 Z" fill="currentColor"/>
        <circle cx="120" cy="120" r="76" fill="none" stroke="currentColor" strokeWidth="5"/>
        <circle cx="120" cy="120" r="68" fill="none" stroke="currentColor" strokeWidth="2"/>
        <circle cx="120" cy="120" r="30" fill="none" stroke="currentColor" strokeWidth="3.5"/>
        <circle cx="120" cy="120" r="25" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M120,98 L126,120 L120,142 L114,120 Z M123.5,120 a3.5,3.5 0 1,0 -7,0 a3.5,3.5 0 1,0 7,0 Z" fill="currentColor" fillRule="evenodd"/>
    </svg>
  );
}
