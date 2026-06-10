import type { Config } from "tailwindcss";

const config: Config = {
  // Tema por classe `.dark` num ancestral — o app (shell) controla o tema
  // localmente, sem afetar a landing (que é sempre escura).
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tema "polar" — inspirado no navio Endurance preso no gelo (1915).
        // Azul-noite (céu polar) + ciano glacial como cor principal,
        // e âmbar de "farol" como acento quente contra o frio.
        ink: {
          950: "#060912",
          900: "#0a0f1d",
          800: "#0f1628",
          700: "#18223a",
          600: "#273456",
        },
        // ciano glacial
        brand: {
          50: "#ecfeff",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        // farol (âmbar quente) — usado com parcimônia
        beacon: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
