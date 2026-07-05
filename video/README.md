# Endurance — Vídeo de Introdução (Remotion)

Projeto **isolado** do app Next.js (toolchain próprio). Recria o vídeo de
Product Hunt descrito em `../PROMPT.md`: 9 cenas, 1920×1080, 30fps, ~46s.

## Rodar

```bash
cd video
npm install
npm run studio      # abre o Remotion Studio (preview interativo)
npm run render      # renderiza out/endurance-intro.mp4
npm run render:still # renderiza um frame só (out/frame.png) pra checar rápido
```

## Estado atual

✅ Todas as 9 cenas construídas em React animado (sem screenshots), com o
design system do Endurance (dark + esmeralda), springs e fontes Google
(Inter + Instrument Serif).

⏳ **Áudio desligado por padrão.** O vídeo renderiza em silêncio. Para ligar:

### 1. Gerar a narração (ElevenLabs)

Para cada cena, chame a API do ElevenLabs com:

| Setting | Value |
|---|---|
| Voice ID | `gJx1vCzNCD1EQHT212Ls` (fallback grátis: `FGY2WhTYpPnrIDTdsKH5`) |
| Model | `eleven_multilingual_v2` |
| Stability | 0.3 · Similarity 0.8 · Style 0.8 · Speaker boost on |

Salve em `public/audio/v1-s01.mp3` … `v1-s09.mp3`. Os textos estão no PROMPT.md.

### 2. Música de fundo

Baixe uma faixa royalty-free (Pixabay) → `public/audio/music/background.mp3`.

### 3. Medir durações e ajustar timings

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 public/audio/v1-s01.mp3
```

Para cada áudio: `frames = ceil(segundos × 30) + 5`. Atualize `SCENE_FRAMES`
em `src/theme.ts` com os valores reais — as cenas e a narração realinham
automaticamente (a narração usa o início de cada cena via `Series`).

### 4. Ligar o áudio

Em `src/Main.tsx`, mude:

```ts
const HAS_NARRATION = true;
const HAS_MUSIC = true;
```

## Assets opcionais

- `public/images/endurance-logo.png` — logo quadrado claro. Sem ele, o
  componente `Logo` desenha um mark "E" em esmeralda (já funciona).

## Estrutura

```
src/
  index.ts            registerRoot
  Root.tsx            Composition (EnduranceIntro)
  Main.tsx            Series de 9 cenas + áudio plugável
  theme.ts            cores, spring, SCENE_FRAMES (ajuste aqui)
  fonts.ts            Inter + Instrument Serif
  components/         Background, BrowserWindow, Badge, Card, Typewriter, Scene, Logo
  scenes/             Scene1Intro … Scene9CTA
```
