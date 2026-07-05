"use client";

// ---------------------------------------------------------------------------
// Mr. Chippy — avatar exclusivo do assistente.
// Inspirado em Mrs. Chippy, o gato que acompanhou a tripulação do navio
// Endurance na expedição de Shackleton (1914–1916). Desenhado com a paleta
// "polar" do sistema (ciano glacial + âmbar de farol) e um cachecol de
// explorador. Os traços são propositalmente grossos para legibilidade em
// tamanhos pequenos (até h-3.5 / 14px).
// ---------------------------------------------------------------------------

type Mood = "idle" | "happy" | "thinking";

export default function MrChippy({
  className = "h-6 w-6",
  mood = "idle",
  title = "Mr. Chippy",
}: {
  className?: string;
  mood?: Mood;
  title?: string;
}) {
  // Olhos: fechadinhos/contentes quando "happy"; piscando suave quando pensa.
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="chippy-fur" x1="12" y1="8" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {/* Orelhas */}
      <path d="M12 18 L9 6 L21 13 Z" fill="url(#chippy-fur)" />
      <path d="M36 18 L39 6 L27 13 Z" fill="url(#chippy-fur)" />
      <path d="M13.5 15.5 L12 9 L18 12.5 Z" fill="#f59e0b" opacity="0.85" />
      <path d="M34.5 15.5 L36 9 L30 12.5 Z" fill="#f59e0b" opacity="0.85" />

      {/* Cabeça */}
      <path
        d="M24 11c8.3 0 14 5.7 14 14.5S33 41 24 41 10 35.3 10 25.5 15.7 11 24 11Z"
        fill="url(#chippy-fur)"
      />

      {/* Cachecol de explorador (âmbar de farol) */}
      <path
        d="M14 33.5c3 2.6 6.4 3.9 10 3.9s7-1.3 10-3.9c-1 3.3-5 5.6-10 5.6s-9-2.3-10-5.6Z"
        fill="#f59e0b"
      />
      <path d="M31.5 37.2c1.7.4 2.7 1.6 3 3.4l-3.6-1.1.6-2.3Z" fill="#d97706" />

      {/* Focinho */}
      <circle cx="24" cy="27.5" r="6.5" fill="#ecfeff" opacity="0.92" />

      {/* Olhos */}
      {mood === "happy" ? (
        <>
          <path d="M16.5 24.5q2.5-2.4 5 0" stroke="#0a0f1d" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M26.5 24.5q2.5-2.4 5 0" stroke="#0a0f1d" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="19" cy="24.5" r="2.6" fill="#0a0f1d" />
          <circle cx="29" cy="24.5" r="2.6" fill="#0a0f1d" />
          <circle cx="20" cy="23.6" r="0.9" fill="#ecfeff" />
          <circle cx="30" cy="23.6" r="0.9" fill="#ecfeff" />
        </>
      )}

      {/* Nariz + boca */}
      <path d="M22.6 28.2h2.8L24 29.9Z" fill="#f59e0b" />
      <path d="M24 29.9v1.4m0 0q-1.6 1.3-3.1 0m3.1 0q1.6 1.3 3.1 0" stroke="#0a0f1d" strokeWidth="1.4" strokeLinecap="round" />

      {/* Bigodes */}
      <g stroke="#0a0f1d" strokeWidth="1.2" strokeLinecap="round" opacity="0.8">
        <path d="M17.5 27.5 11 26.5M17.5 29 11.5 30" />
        <path d="M30.5 27.5 37 26.5M30.5 29 36.5 30" />
      </g>
    </svg>
  );
}
