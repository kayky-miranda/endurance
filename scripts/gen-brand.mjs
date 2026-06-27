/**
 * Gera a identidade visual do ENDURANCE a partir de um único SVG-mestre da
 * bússola: o componente React (BrandMark), o favicon SVG, o apple-icon e os
 * ícones do PWA. Rasteriza via Playwright (já é dependência).
 *
 * Uso (a partir da raiz):  node scripts/gen-brand.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Geometria da bússola (viewBox 0 0 240 240, centro 120,120) -------------
const C = 120;
const VB = 240;
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (angleDeg, r) => {
  const a = rad(angleDeg);
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};
const f = (n) => Number(n.toFixed(2));

// Um "raio" (spike) = triângulo: ponta + duas asas perto do hub.
function spike(angle, tip, phi, rw) {
  const [tx, ty] = pt(angle, tip);
  const [lx, ly] = pt(angle - phi, rw);
  const [rx, ry] = pt(angle + phi, rw);
  return `M${f(tx)},${f(ty)} L${f(lx)},${f(ly)} L${f(rx)},${f(ry)} Z`;
}

// Cardeais (N/S longos, L/O um pouco menores) — finos, compridos, perfurando
// o anel. As asas (rw) ficam dentro do furo do hub, então os espigões nascem
// limpos da borda do hub, sem entalhe.
const cardinals = [
  spike(0, 118, 9.5, 26),
  spike(180, 118, 9.5, 26),
  spike(90, 110, 9.5, 26),
  spike(270, 110, 9.5, 26),
];
// Diagonais — curtas e largas, terminando dentro do anel.
const diagonals = [45, 135, 225, 315].map((a) => spike(a, 58, 14.5, 26));

const spikesPath = [...cardinals, ...diagonals].join(" ");

// Agulha estilo bússola (losango fino vertical) com um furo central (ponto).
// fill-rule evenodd → o círculo interno vira buraco (mostra o fundo).
const needle =
  `M120,98 L126,120 L120,142 L114,120 Z ` + // losango
  `M123.5,120 a3.5,3.5 0 1,0 -7,0 a3.5,3.5 0 1,0 7,0 Z`; // ponto (furo)

// Markup interno reutilizado por todas as variações. Usa currentColor.
// Sem máscara: a base dos espigões fica em r≈25 (fora da agulha, r<22) e é
// coberta pelo anel do hub — então o miolo fica limpo sem precisar de <mask>
// (evita IDs duplicados quando o componente renderiza várias vezes na página).
const INNER = `
  <path d="${spikesPath}" fill="currentColor"/>
  <circle cx="${C}" cy="${C}" r="76" fill="none" stroke="currentColor" stroke-width="5"/>
  <circle cx="${C}" cy="${C}" r="68" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="${C}" cy="${C}" r="30" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <circle cx="${C}" cy="${C}" r="25" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <path d="${needle}" fill="currentColor" fill-rule="evenodd"/>
`.trim();

const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" fill="none">
${INNER}
</svg>
`;

// Variação "selo" para favicon/PWA: fundo escuro arredondado + bússola branca.
const INK = "#0f1117";
function badge(size, { maskable = false } = {}) {
  // maskable: deixa "safe zone" (bússola menor, fundo cobre tudo).
  const scale = maskable ? 0.62 : 0.78;
  const inset = (VB * (1 - scale)) / 2;
  const radius = maskable ? VB / 2 : VB * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${size}" height="${size}">
  <rect width="${VB}" height="${VB}" rx="${f(radius)}" fill="${INK}"/>
  <g transform="translate(${f(inset)},${f(inset)}) scale(${scale})" color="#ffffff">
    ${INNER}
  </g>
</svg>`;
}

// JSX exige camelCase nos atributos SVG de apresentação.
const INNER_JSX = INNER
  .replace(/stroke-width=/g, "strokeWidth=")
  .replace(/fill-rule=/g, "fillRule=");

// React component (fonte única para uso dentro do app).
const component = `// Gerado por scripts/gen-brand.mjs — não edite à mão.
// Marca ENDURANCE (bússola). Usa currentColor: defina a cor pelo \`color\`/\`text-*\`
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
      viewBox="0 0 ${VB} ${VB}"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      ${INNER_JSX.split("\n").map((l) => "      " + l).join("\n").trimStart()}
    </svg>
  );
}
`;

async function main() {
  await mkdir(join(ROOT, "public", "brand"), { recursive: true });
  await mkdir(join(ROOT, "public", "icons"), { recursive: true });
  await mkdir(join(ROOT, "app", "components"), { recursive: true });
  await mkdir(join(ROOT, "scripts", "_brand-preview"), { recursive: true });

  // 1. SVG-mestre (transparente, currentColor) e favicon SVG (selo).
  await writeFile(join(ROOT, "public", "brand", "compass.svg"), masterSvg);
  await writeFile(join(ROOT, "app", "icon.svg"), badge(512));
  await writeFile(join(ROOT, "app", "components", "BrandMark.tsx"), component);

  // 2. Rasteriza os PNGs (apple-icon, PWA) via Playwright.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const targets = [
    { file: join(ROOT, "app", "apple-icon.png"), size: 180, opts: {} },
    { file: join(ROOT, "public", "icons", "icon-192.png"), size: 192, opts: {} },
    { file: join(ROOT, "public", "icons", "icon-512.png"), size: 512, opts: {} },
    { file: join(ROOT, "public", "icons", "icon-maskable-512.png"), size: 512, opts: { maskable: true } },
    { file: join(ROOT, "scripts", "_brand-preview", "preview-dark.png"), size: 360, opts: {} },
  ];
  for (const t of targets) {
    const svg = badge(t.size, t.opts);
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><html><body style="margin:0">${svg}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.locator("svg").screenshot({ path: t.file, omitBackground: true });
    await page.close();
  }

  // Preview transparente (bússola pura) para inspeção em fundo claro e escuro.
  for (const [name, bg] of [["preview-on-light", "#ffffff"], ["preview-on-dark", "#0f1117"]]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 360 } });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:${bg};display:grid;place-items:center;height:360px">
        <div style="color:${bg === "#ffffff" ? "#0f1117" : "#ffffff"};width:300px;height:300px">${masterSvg}</div>
      </body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.screenshot({ path: join(ROOT, "scripts", "_brand-preview", name + ".png") });
    await page.close();
  }

  await browser.close();
  console.log("✓ Identidade gerada: BrandMark.tsx, app/icon.svg, apple-icon.png, public/icons/*, public/brand/compass.svg");
}

main().catch((e) => {
  console.error("✖", e);
  process.exit(1);
});
