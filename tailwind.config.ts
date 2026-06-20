import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

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
        // White-label: a paleta `brand` agora vem de CSS variables. Cada org
        // pode sobrescrever via <style> injetado pelo shell. Defaults em
        // globals.css.
        brand: {
          50: "var(--color-brand-50)",
          200: "var(--color-brand-200)",
          300: "var(--color-brand-300)",
          400: "var(--color-brand-400)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
        },
        // Sidebar/header — também via vars pra permitir custom de chrome.
        ink: {
          950: "var(--color-ink-950)",
          900: "var(--color-ink-900)",
          800: "var(--color-ink-800)",
          700: "var(--color-ink-700)",
          600: "var(--color-ink-600)",
        },
        // farol (âmbar quente) — usado com parcimônia, sem white-label.
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
  plugins: [typography],
};

export default config;
