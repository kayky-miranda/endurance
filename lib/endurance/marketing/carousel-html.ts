import type { SlideData, BrandKitData } from "./types";

/**
 * Escape de HTML — obrigatório em TODA interpolação de texto deste arquivo.
 *
 * O HTML montado aqui não vai para o navegador do cliente: ele é carregado por
 * um Chromium headless NO SERVIDOR (carousel-renderer.ts) para virar PNG. Isso
 * inverte o risco de lugar. Um "<script>" que entrasse por aqui não atacaria
 * outro usuário — executaria dentro do nosso próprio processo, com acesso à
 * rede interna.
 *
 * Os campos de texto do kit de marca chegavam apenas TRUNCADOS em 60
 * caracteres, e 39 já bastavam para fechar o bloco de estilo e abrir um script.
 * As cores sempre foram validadas por regex de hexadecimal; o texto não era.
 */
function esc(v: unknown): string {
  return String(v ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

/**
 * Cor para dentro de CSS ou de um atributo style. A rota do kit de marca já
 * valida hexadecimal, mas a validação é repetida aqui de propósito: este
 * arquivo escreve HTML que roda no servidor, e não deve depender de um único
 * validador a montante para continuar seguro.
 */
function cssColor(v: unknown, padrao = "#6366F1"): string {
  const c = String(v ?? "");
  return /^#[0-9A-Fa-f]{6}$/.test(c) ? c : padrao;
}

/**
 * Nome de fonte para dentro de uma regra CSS. Só letras, números e espaço —
 * aspas e chaves são exatamente o que permitia sair do `font-family`.
 */
function cssFont(v: unknown): string {
  const limpo = String(v ?? "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 40);
  return limpo || "Plus Jakarta Sans";
}

export const CAROUSEL_VIEW_WIDTH = 420;
export const CAROUSEL_VIEW_HEIGHT = 525;
const TOTAL = 7;

function css(b: BrandKitData): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(cssFont(b.fontHeading))}:wght@300;400;600;700&family=${encodeURIComponent(cssFont(b.fontBody))}:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --brand-primary: ${cssColor(b.primaryColor, "#6366F1")};
      --brand-dark: ${cssColor(b.darkColor, "#312E81")};
      --brand-light: ${cssColor(b.lightColor, "#A5B4FC")};
      --light-bg: ${cssColor(b.lightBg, "#F8F7FF")};
      --dark-bg: ${cssColor(b.darkBg, "#0F0E17")};
    }
    body { background: #f0f0f0; display: flex; justify-content: center; align-items: flex-start; padding: 20px; font-family: '${cssFont(b.fontBody)}', sans-serif; }
    .ig-frame { width: ${CAROUSEL_VIEW_WIDTH}px; background: #fff; border-radius: 12px; box-shadow: 0 8px 40px rgba(0,0,0,0.18); overflow: hidden; }
    .ig-header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; border-bottom: 1px solid #eee; }
    .ig-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--brand-primary); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 700; font-family: '${cssFont(b.fontHeading)}', sans-serif; flex-shrink: 0; }
    .ig-meta { flex: 1; min-width: 0; }
    .ig-handle { font-size: 12px; font-weight: 600; color: #1a1a1a; }
    .ig-sub { font-size: 10px; color: #888; }
    .carousel-viewport { width: ${CAROUSEL_VIEW_WIDTH}px; height: ${CAROUSEL_VIEW_HEIGHT}px; overflow: hidden; position: relative; cursor: grab; user-select: none; }
    .carousel-track { display: flex; width: ${CAROUSEL_VIEW_WIDTH * TOTAL}px; height: 100%; transition: transform 0.3s ease; }
    .slide { width: ${CAROUSEL_VIEW_WIDTH}px; height: ${CAROUSEL_VIEW_HEIGHT}px; flex-shrink: 0; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 36px 52px; }
    .slide.light { background: var(--light-bg); }
    .slide.dark { background: var(--dark-bg); }
    .slide.gradient { background: linear-gradient(165deg, var(--brand-dark) 0%, var(--brand-primary) 55%, var(--brand-light) 100%); }
    .slide.hero, .slide.cta { justify-content: center; }
    .serif { font-family: '${cssFont(b.fontHeading)}', sans-serif; }
    .sans { font-family: '${cssFont(b.fontBody)}', sans-serif; }
    .tag-light { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--brand-primary); margin-bottom: 14px; display: block; }
    .tag-dark { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--brand-light); margin-bottom: 14px; display: block; }
    .tag-grad { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.65); margin-bottom: 14px; display: block; }
    .headline-light { font-size: 30px; font-weight: 700; color: var(--dark-bg); letter-spacing: -0.4px; line-height: 1.1; margin-bottom: 12px; }
    .headline-dark { font-size: 30px; font-weight: 700; color: #fff; letter-spacing: -0.4px; line-height: 1.1; margin-bottom: 12px; }
    .headline-grad { font-size: 30px; font-weight: 700; color: #fff; letter-spacing: -0.4px; line-height: 1.1; margin-bottom: 12px; }
    .body-light { font-size: 14px; color: #6B7280; line-height: 1.5; }
    .body-dark { font-size: 14px; color: rgba(255,255,255,0.65); line-height: 1.5; }
    .body-grad { font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.5; }
    .divider-light { height: 1px; background: rgba(0,0,0,0.07); margin: 14px 0; }
    .divider-dark { height: 1px; background: rgba(255,255,255,0.1); margin: 14px 0; }
    .bullet-row { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; border-bottom: 1px solid; }
    .bullet-row.b-light { border-color: rgba(0,0,0,0.07); }
    .bullet-row.b-dark { border-color: rgba(255,255,255,0.08); }
    .bullet-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; margin-top: 1px; }
    .bullet-label-light { font-size: 13px; font-weight: 600; color: var(--dark-bg); }
    .bullet-label-dark { font-size: 13px; font-weight: 600; color: #fff; }
    .bullet-desc-light { font-size: 11px; color: #8A8580; }
    .bullet-desc-dark { font-size: 11px; color: rgba(255,255,255,0.45); }
    .step-row { display: flex; align-items: flex-start; gap: 14px; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.07); }
    .step-num { font-size: 24px; font-weight: 300; color: var(--brand-primary); min-width: 32px; line-height: 1; font-family: '${cssFont(b.fontHeading)}', sans-serif; }
    .step-title { font-size: 13px; font-weight: 600; color: var(--dark-bg); }
    .step-desc { font-size: 11px; color: #8A8580; margin-top: 2px; }
    .logo-lockup { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .logo-circle { width: 40px; height: 40px; border-radius: 50%; background: var(--brand-primary); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 700; font-family: '${cssFont(b.fontHeading)}', sans-serif; flex-shrink: 0; }
    .logo-name { font-size: 13px; font-weight: 600; letter-spacing: 0.5px; color: #fff; font-family: '${cssFont(b.fontHeading)}', sans-serif; }
    .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; background: var(--light-bg); color: var(--brand-dark); font-weight: 600; font-size: 14px; border-radius: 28px; margin-top: 20px; font-family: '${cssFont(b.fontBody)}', sans-serif; }
    .progress-bar { position: absolute; bottom: 0; left: 0; right: 0; padding: 14px 28px 18px; z-index: 10; display: flex; align-items: center; gap: 10px; }
    .progress-track { flex: 1; height: 3px; border-radius: 2px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 2px; }
    .progress-label { font-size: 11px; font-weight: 500; }
    .ig-dots { display: flex; justify-content: center; gap: 5px; padding: 8px 0; background: #fff; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #d1d5db; transition: background 0.2s; }
    .dot.active { background: #374151; }
    .ig-actions { display: flex; gap: 14px; padding: 10px 14px 2px; background: #fff; }
    .ig-caption { padding: 6px 14px 14px; background: #fff; font-size: 12px; color: #374151; line-height: 1.5; }
    .bg-accent { position: absolute; border-radius: 50%; pointer-events: none; z-index: 0; }
    .content-z { position: relative; z-index: 1; }
  `;
}

function progressBar(index: number, isLight: boolean): string {
  const pct = ((index + 1) / TOTAL) * 100;
  const trackColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
  const fillColor = isLight ? "var(--brand-primary)" : "#fff";
  const labelColor = isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.4)";
  return `<div class="progress-bar">
    <div class="progress-track" style="background:${trackColor}">
      <div class="progress-fill" style="width:${pct}%;background:${fillColor}"></div>
    </div>
    <span class="progress-label sans" style="color:${labelColor}">${index + 1}/${TOTAL}</span>
  </div>`;
}

function swipeArrow(isLight: boolean): string {
  const bg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  const stroke = isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)";
  return `<div style="position:absolute;right:0;top:0;bottom:0;width:48px;z-index:9;display:flex;align-items:center;justify-content:center;background:linear-gradient(to right,transparent,${bg})">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`;
}

function renderSlide(s: SlideData, brand: BrandKitData): string {
  const isLight = s.background === "light";
  const isDark = s.background === "dark";
  const isGrad = s.background === "gradient";
  const bgClass = isLight ? "light" : isDark ? "dark" : "gradient";
  const isHero = s.layout === "hero";
  const isCta = s.layout === "cta";
  const tagClass = isLight ? "tag-light" : isDark ? "tag-dark" : "tag-grad";
  const hlClass = isLight ? "headline-light" : isDark ? "headline-dark" : "headline-grad";
  const bodyClass = isLight ? "body-light" : isDark ? "body-dark" : "body-grad";
  const showArrow = s.index < TOTAL - 1;

  let inner = "";

  if (isHero) {
    inner = `
      <div class="bg-accent" style="width:280px;height:280px;top:-80px;right:-60px;background:radial-gradient(circle,${cssColor(brand.primaryColor, "#6366F1")}22 0%,transparent 70%)"></div>
      <div class="content-z" style="text-align:center">
        <span class="${tagClass} serif">${esc(s.tag || "NOVIDADE")}</span>
        <h1 class="serif ${hlClass}" style="font-size:32px">${esc(s.headline)}</h1>
        <p class="sans ${bodyClass}" style="margin-top:10px">${esc(s.body)}</p>
        <div style="margin-top:20px;width:40px;height:3px;background:${cssColor(brand.primaryColor, "#6366F1")};border-radius:2px;margin-left:auto;margin-right:auto"></div>
      </div>`;
  } else if (isCta) {
    inner = `
      <div class="bg-accent" style="width:300px;height:300px;bottom:-100px;left:-80px;background:radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)"></div>
      <div class="content-z" style="text-align:center">
        <div class="logo-lockup" style="justify-content:center">
          <div class="logo-circle">${esc(brand.logoText?.[0]?.toUpperCase() ?? "E")}</div>
          <span class="logo-name">${esc(brand.logoText || "ENDURANCE")}</span>
        </div>
        <span class="${tagClass} serif">${esc(s.tag || "COMECE AGORA")}</span>
        <h2 class="serif ${hlClass}">${esc(s.headline)}</h2>
        <p class="sans ${bodyClass}">${esc(s.body)}</p>
        <div class="cta-btn sans">${esc(s.ctaText || "Fale conosco")} →</div>
      </div>`;
  } else if (s.layout === "steps") {
    const steps = (s.steps ?? []).slice(0, 3);
    inner = `
      <span class="${tagClass} sans">${esc(s.tag || "COMO FUNCIONA")}</span>
      <h2 class="serif ${hlClass}" style="font-size:24px;margin-bottom:16px">${esc(s.headline)}</h2>
      ${steps.map((st) => `
        <div class="step-row">
          <span class="step-num serif">${esc(st.num)}</span>
          <div>
            <p class="step-title sans">${esc(st.title)}</p>
            <p class="step-desc sans">${esc(st.desc)}</p>
          </div>
        </div>`).join("")}`;
  } else {
    const bullets = (s.bullets ?? []).slice(0, 4);
    const bClass = isLight ? "b-light" : "b-dark";
    const lblClass = isLight ? "bullet-label-light" : "bullet-label-dark";
    const dscClass = isLight ? "bullet-desc-light" : "bullet-desc-dark";
    inner = `
      <span class="${tagClass} sans">${esc(s.tag)}</span>
      <h2 class="serif ${hlClass}" style="font-size:24px;margin-bottom:16px">${esc(s.headline)}</h2>
      ${bullets.length > 0 ? bullets.map((b) => `
        <div class="bullet-row ${bClass}">
          <span class="bullet-icon">${esc(b.icon)}</span>
          <div>
            <p class="sans ${lblClass}">${esc(b.label)}</p>
            <p class="sans ${dscClass}">${esc(b.desc)}</p>
          </div>
        </div>`).join("") : `<p class="sans ${bodyClass}">${esc(s.body)}</p>`}`;
  }

  return `
    <div class="slide ${bgClass}${isHero ? " hero" : ""}${isCta ? " cta" : ""}">
      ${inner}
      ${progressBar(s.index, isLight)}
      ${showArrow ? swipeArrow(isLight) : ""}
    </div>`;
}

export function renderCarouselHTML(
  slides: SlideData[],
  brand: BrandKitData,
): string {
  const handle = brand.instagramHandle
    ? brand.instagramHandle.startsWith("@")
      ? brand.instagramHandle
      : `@${brand.instagramHandle}`
    : `@${(brand.logoText || "endurance").toLowerCase().replace(/\s+/g, "")}`;

  const dots = slides
    .map((_, i) => `<div class="dot${i === 0 ? " active" : ""}" id="dot-${i}"></div>`)
    .join("");

  const slidesHtml = slides.map((s) => renderSlide(s, brand)).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Carrossel — ${esc(brand.logoText)}</title>
<style>${css(brand)}</style>
</head>
<body>
<div class="ig-frame">
  <div class="ig-header">
    <div class="ig-avatar">${esc(brand.logoText?.[0]?.toUpperCase() ?? "E")}</div>
    <div class="ig-meta">
      <div class="ig-handle">${esc(handle)}</div>
      <div class="ig-sub">Patrocinado</div>
    </div>
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="#888"/><circle cx="12" cy="12" r="1.5" fill="#888"/><circle cx="19" cy="12" r="1.5" fill="#888"/></svg>
  </div>
  <div class="carousel-viewport" id="viewport">
    <div class="carousel-track" id="track">${slidesHtml}</div>
  </div>
  <div class="ig-dots">${dots}</div>
  <div class="ig-actions">
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="margin-left:auto"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
  </div>
  <div class="ig-caption"><strong>${esc(handle)}</strong> ${esc(slides[0]?.headline ?? "")}<br><span style="color:#9ca3af;font-size:11px">há 2 horas</span></div>
</div>
<script>
(function(){
  const track = document.getElementById('track');
  const dots = document.querySelectorAll('.dot');
  const W = ${CAROUSEL_VIEW_WIDTH};
  let cur = 0, startX = 0, dx = 0, dragging = false;
  function go(i){ cur=Math.max(0,Math.min(${TOTAL-1},i)); track.style.transition='transform 0.3s ease'; track.style.transform='translateX('+(-cur*W)+'px)'; dots.forEach((d,j)=>d.classList.toggle('active',j===cur)); }
  const vp = document.getElementById('viewport');
  vp.addEventListener('mousedown',e=>{ dragging=true; startX=e.clientX; dx=0; track.style.transition='none'; });
  window.addEventListener('mousemove',e=>{ if(!dragging) return; dx=e.clientX-startX; track.style.transform='translateX('+(-cur*W+dx)+'px)'; });
  window.addEventListener('mouseup',()=>{ if(!dragging) return; dragging=false; if(dx<-50) go(cur+1); else if(dx>50) go(cur-1); else go(cur); });
  vp.addEventListener('touchstart',e=>{ startX=e.touches[0].clientX; dx=0; track.style.transition='none'; },{passive:true});
  vp.addEventListener('touchmove',e=>{ dx=e.touches[0].clientX-startX; track.style.transform='translateX('+(-cur*W+dx)+'px)'; },{passive:true});
  vp.addEventListener('touchend',()=>{ if(dx<-50) go(cur+1); else if(dx>50) go(cur-1); else go(cur); });
})();
</script>
</body>
</html>`;
}
