# Endurance Product Hunt Video — Replication Prompt

> Use este prompt com Claude para recriar o vídeo de introdução do Endurance usando Remotion.

---

## Tech Stack

- **Remotion 4.x** (React + TypeScript)
- **Fonts**: `@remotion/google-fonts` — **Inter** (weights: 400, 500, 600, 700) e **Instrument Serif** (weight: 400)
- **TTS**: ElevenLabs API
- **Background music**: Royalty-free do Pixabay

## Video Settings

| Propriedade | Valor |
|-------------|-------|
| Resolução | 1080x1920 (9:16 landscape) |
| FPS | 30 |
| Duração total | 1380 frames (~46 segundos) |

---

## Voice Narration (ElevenLabs)

| Setting | Value |
|---------|-------|
| Voice ID | `ohZOfA9iwlZ5nOsoY7LB` |
| Fallback voice (free) | Roberta — `mBvW81C9wY6qV9V9R01I` |
| Model | `eleven_multilingual_v2` |
| Stability | 0.3 |
| Similarity boost | 0.8 |
| Style | 0.8 |
| Speaker boost | true |

Gere um MP3 por cena com essas configurações. Nomeie como `v1-s01.mp3` até `v1-s09.mp3`.

## Background Music

- **Arquivo**: `background.mp3` (royalty-free do Pixabay)
- **Volume**: 0.15 (bem baixo, abaixo da narração)
- **Começa em**: frame 45 (1.5 segundos no vídeo)
- Toca durante toda a duração restante

---

## Narration Script (por cena)

| Cena | Arquivo de áudio | Texto da narração |
|------|-----------------|-------------------|
| 1 — Intro | v1-s01.mp3 | "Apresentando o Endurance. ERP com IA para pequenos negócios brasileiros." |
| 2 — Dor | v1-s02.mp3 | "Você tem um mercadinho. Uma academia. Um salão. Mas configurar um sistema leva dias — e ainda assim não encaixa no seu negócio." |
| 3 — Agitação | v1-s03.mp3 | "Ferramentas genéricas. Módulos que você não usa. Configurações que não fazem sentido pro seu nicho." |
| 4 — Solução | v1-s04.mp3 | "Com o Endurance, você descreve o seu negócio em texto livre. A IA classifica, extrai os dados e já configura tudo." |
| 5 — Onboarding | v1-s05.mp3 | "Em segundos, o seu espaço nasce pronto: PDV, estoque, financeiro, fiscal e CRM — só o que você precisa." |
| 6 — Módulos | v1-s06.mp3 | "Venda, controle o caixa, emita NFC-e, gerencie fornecedores e entenda seus clientes — tudo integrado, tudo em um lugar." |
| 7 — IA no dia a dia | v1-s07.mp3 | "A IA não some depois do cadastro. Ela sugere preços, prevê recompras, gera relatórios e responde suas dúvidas em qualquer tela." |
| 8 — Payoff | v1-s08.mp3 | "Do zero a um ERP completo, configurado pro seu negócio. Em menos de dois minutos." |
| 9 — CTA | v1-s09.mp3 | "Comece grátis em endurance.app" |

---

## Scene-by-Scene Breakdown

### Scene 1: Intro
- **Frames**: 0–140 (140 frames)
- **Conteúdo**: Logo do Endurance (100×100, rounded 22px, fundo esmeralda escuro) faz spring de scale 0 → 1. Título "Apresentando o Endurance" em Instrument Serif 76px, cor foreground. Subtítulo "ERP com IA para pequenos negócios brasileiros" em Inter 28px, muted.
- **Animação**: Logo spring no frame 2 (scale 0→1). Título no frame 8 (slide up 30px, opacity 0→1). Subtítulo no frame 18 (slide up 15px). Fade out começa no frame 128 (opacity → 0, scale → 0.96 em 12 frames).

### Scene 2: Dor — O negócio existe, o sistema não encaixa
- **Frames**: 140–310 (170 frames)
- **Conteúdo**: Três cards de negócio (260px wide, padding 20px, rounded 14px, white bg, shadow suave) aparecem lado a lado representando nichos reais:
  - 🛒 **Mercadinho do Zé** — "Campinas, SP · Varejo de bairro" — com mini estante de produtos esquemática e badge vermelho "sem sistema"
  - 🏋️ **Academia Força Total** — "São Paulo, SP · Academia" — com grade de horários esquemática e badge vermelho "planilha Excel"
  - ✂️ **Salão da Mari** — "Belo Horizonte, MG · Cabeleireiro" — com calendário esquemático e badge vermelho "caderno papel"
- Texto abaixo: Inter 22px weight 500 muted — *"Cada negócio diferente. Toda configuração igual."*
- **Animação**: Cards entram a cada 14 frames (scale 0.85→1, slide up 20px). Badges aparecem 8 frames após cada card. Frase desliza de baixo no frame 60. Fade out no frame 158.

### Scene 3: Agitação — Complexidade genérica
- **Frames**: 310–470 (160 frames)
- **Conteúdo**: Header "Dias de configuração" (28px, weight 600) + "Módulos que não servem. Telas que não fazem sentido." (22px, muted). Seis cards flutuantes (200px, padding 16px 20px, rounded 12px, white bg, sombra leve) espalhados com rotação, conectados por linhas SVG tracejadas bagunçadas (strokeWidth 1.5, dashArray 8, 60% opacidade):
  - **ERP Genérico** (azul, x:-310 y:-185 rot:-5) — mostra lista de abas: Contabilidade / RH / Jurídico / Internacional
  - **Módulo Fiscal** (roxo, x:90 y:-205 rot:4) — mostra campos CNAE / CST / CFOP / CEST em fonte mono
  - **Controle de Caixa** (laranja, x:-195 y:-15 rot:-4) — mostra formulário com 14 campos em branco
  - **Relatórios** (verde, x:185 y:-35 rot:5) — mostra gráfico de barras com dados genéricos sem contexto
  - **Cadastro de Produtos** (vermelho, x:-275 y:145 rot:-7) — mostra grade com 200+ colunas
  - **Permissões** (roxo, x:125 y:155 rot:6) — mostra matriz de checkboxes sem fim
- **Animação**: Cards entram a cada 12 frames (scale 0.3→1). Linhas de conexão aparecem entre frames 55–105. Fade out no frame 148.

### Scene 4: Solução — Descreva em texto livre
- **Frames**: 470–620 (150 frames)
- **Conteúdo**: Card grande (780px wide, padding 40px, rounded 16px, white bg, sombra prominent) com:
  - Header: Logo Endurance (32px height) + nome "Endurance" + badge verde "IA"
  - Label cinza "Descreva seu negócio:" (14px, weight 500, muted)
  - Efeito typewriter digita a frase: `"Tenho um mercadinho de bairro em Campinas, SP. Vendo de tudo um pouco, tenho 2 funcionários."` (frames 10–55)
  - Após frame 57: três dots de thinking animados (pulsando verde/cinza)
  - Após frame 75: resposta aparece — badge "✓ Nicho identificado: Mercado/Varejo · 97% de confiança" (verde, rounded 20px)
- **Fade out**: frame 138.

### Scene 5: Onboarding — Espaço nasce configurado
- **Frames**: 620–790 (170 frames)
- **Conteúdo**: BrowserWindow component (800px wide, URL: "endurance.app/dashboard") mostrando dashboard recém-criado. Header com nome "Mercadinho do Zé" + badge verde pulsante "✓ Configurado por IA". Abaixo, grade 2×3 de módulos ativos com ícone + nome + status "Ativo":
  - PDV (ícone caixa registradora, verde)
  - Estoque (ícone caixas, verde)
  - Financeiro (ícone gráfico, verde)
  - Fiscal / NFC-e (ícone documento, verde)
  - Clientes CRM (ícone pessoas, verde)
  - Equipe (ícone permissões, verde)
- Badge flutuante top-right: "6 módulos · 0 configurações manuais" (verde, rounded 24px, shadow verde)
- **Animação**: Browser spring no frame 3 (scale 0.9→1). Header no frame 8. Cada card de módulo entra alternando esquerda/direita a cada 10 frames (frames 15–65). Badge aparece no frame 70 com spring scale 0.5→1. Fade out no frame 158.

### Scene 6: Módulos em Ação — PDV e NFC-e
- **Frames**: 790–980 (190 frames)
- **Duas fases**:
  - **Fase 1 (frames 0–95)**: BrowserWindow (880px) mostrando tela de PDV. Carrinho com 3 itens (Arroz 5kg R$22,90 / Feijão 1kg R$8,50 / Óleo de soja R$7,20). Total R$38,60. Botões de pagamento: Dinheiro / Crédito / Débito / PIX. Badge lateral: "Sugestão IA: Adicionar pão de forma?" (verde claro, italic). Animação: itens do carrinho entram a cada 12 frames com slide da direita. Botões de pagamento no frame 55 (stagger 8px). Sugestão IA no frame 70 com fade in.
  - **Fase 2 (a partir do frame 95)**: Transição suave para tela de Fiscal. Card de NFC-e emitida (620px, padding 32px): "NFC-e 000042 · Emitida com sucesso" em verde bold 24px. QR code esquemático (80×80, grid de quadradinhos). Dados da venda resumidos. Chave de acesso em fonte mono 11px. Badge "DANFE disponível" azul. Animação: card spring scale 0.85→1 no frame 97. QR code monta quadradinho a quadradinho do frame 105 ao 125.
- **Fade out**: frame 178.

### Scene 7: IA no Dia a Dia — Assistente e Relatórios
- **Frames**: 980–1150 (170 frames)
- **Conteúdo**: Layout dividido verticalmente (linha divisória suave no centro):
  - **Esquerda** — Widget do assistente IA (380px, rounded 14px, shadow). Histórico de chat:
    - Usuário: "Qual produto teve mais saída essa semana?"
    - IA: "Arroz 5kg liderou com 47 unidades vendidas. Seu estoque atual é de 12 unidades — reposição recomendada para quinta-feira." (texto aparece com efeito de stream, letra a letra, frame 20–60)
    - Usuário: "E a margem dele?"
    - IA: "Margem atual: 18%. Concorrentes na região praticam 22–25%. Você pode aumentar em R$2,00 sem perder competitividade." (stream frames 70–110)
  - **Direita** — Card de Relatórios IA (380px): Headline "Insights desta semana" (18px, weight 700). Três insight cards em cream rounded:
    1. 📈 "Vendas 12% acima da semana passada"
    2. ⚠️ "3 clientes sem compra há 30 dias — sugestão de campanha disponível"
    3. 💡 "Feijão com margem abaixo do ideal — revise o preço"
  - Cada insight entra com slide da direita a cada 15 frames (frames 25, 40, 55).
- **Fade out**: frame 158.

### Scene 8: Payoff — Mic Drop
- **Frames**: 1150–1270 (120 frames)
- **Conteúdo**: Subtítulo Inter 24px weight 500 muted: "do zero a um ERP completo, configurado pro seu negócio". Texto principal Instrument Serif 100px foreground: "Em menos de 2 minutos."
- **Animação**: Texto principal spring no frame 4 (scale 0.7→1). Subtítulo fade in + slide up 15px no frame 14. Fade out no frame 108.

### Scene 9: CTA
- **Frames**: 1270–1380 (110 frames)
- **Conteúdo**: Logo Endurance (80×80, rounded 18px). Instrument Serif 64px: "comece grátis em endurance.app". Sublinhado animado verde sob "endurance.app" (cresce de 0% a 100% de largura). Badge extra abaixo: Inter 18px muted "Sem cartão de crédito · Setup em 2 minutos"
- **Animação**: Logo spring no frame 2. Texto slide up no frame 8. Sublinhado anima do frame 20 ao 45. Badge fade in no frame 50. **Sem fade out** — mantém até o fim.

---

## Visual Design System

### Cores
```
bg:            #0f1117  (ardósia escura — dark mode)
card:          #1a1d27  (card dark)
cardBorder:    #2a2d3a  (borda sutil)
foreground:    #f0f2f8  (texto principal, quase branco)
muted:         #6b7280  (texto secundário)
emerald:       #10b981  (verde esmeralda — cor primária Endurance)
emeraldLight:  rgba(16, 185, 129, 0.12)  — badge/tag backgrounds
emeraldGlow:   rgba(16, 185, 129, 0.25)  — glow effects
emeraldBright: #34d399  (versão mais brilhante para destaques)
slate:         #64748b  (ardósia média)
blue:          #3b82f6
blueLight:     rgba(59, 130, 246, 0.12)
orange:        #f97316
orangeLight:   rgba(249, 115, 22, 0.12)
purple:        #8b5cf6
purpleLight:   rgba(139, 92, 246, 0.12)
red:           #ef4444
redLight:      rgba(239, 68, 68, 0.12)
gridLine:      rgba(240, 242, 248, 0.04)  — linhas da grade de fundo
```

### Fonts
- **Body**: Inter (via `@remotion/google-fonts/Inter`) — weights 400, 500, 600, 700
- **Headlines/texto emocional**: Instrument Serif (via `@remotion/google-fonts/InstrumentSerif`) — weight 400
- **Monospace** (código, chaves fiscais): `'SF Mono', 'Fira Code', 'Cascadia Code', monospace`

### Background
- Ardósia escura (#0f1117) com grade sutil (60px spacing, gridLine color, 60% opacidade)
- Blob radial esmeralda (canto superior direito, 700px diâmetro, 8% alpha, blur 60px) — identidade Endurance
- Blob radial azul (canto inferior esquerdo, 600px diâmetro, 6% alpha, blur 50px)

### Cards
- Background #1a1d27, borda 1px solid #2a2d3a, rounded 12–16px
- Shadow: `0 25px 60px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.25)`

### BrowserWindow Component
- Estilo macOS — três dots (vermelho #ff5f57, amarelo #ffbd2e, verde #28c840)
- URL bar centralizada em pill ardósia (#1a1d27) com borda sutil
- Rounded 14px corners
- Header background: #0f1117

### Animation Defaults
- **Spring**: damping 10, stiffness 150, mass 0.8, overshootClamping false
- **Fade out**: Últimos 12 frames de cada cena → opacity 0, scale 0.96
- **Stagger**: 8–15 frames entre itens

### Efeito Typewriter
- Digita caractere a caractere via `Math.floor(interpolate(frame, [start, end], [0, text.length]))`
- Cursor piscante (|) que desaparece após completar

### Badge Padrão Endurance
- Background: `emeraldLight`
- Border: `1px solid rgba(16, 185, 129, 0.25)`
- Text: `emeraldBright`, weight 600, 13–14px
- Padding: `6px 14px`, rounded 20px

---

## Processo para Recriar

1. **Gerar áudios**: Use a API do ElevenLabs com as configurações de voz acima e o script de narração. Salve como `v1-s01.mp3` até `v1-s09.mp3`.
2. **Medir durações**: Use `ffprobe` para obter a duração de cada arquivo em segundos, multiplique por 30 (fps) para obter frames. Adicione 5 frames de padding.
3. **Ajustar timings**: Os valores de frames acima são estimativas. Recalcule `from` e `durationInFrames` com base nos seus arquivos de áudio.
4. **Construir cenas**: Siga as descrições acima. Toda a UI é construída em React (sem screenshots).
5. **Adicionar música**: Coloque em `public/audio/music/background.mp3`, volume 0.15, iniciando no frame 45.
6. **Assets necessários**: Logo do Endurance em `public/images/endurance-logo.png` (quadrado, versão clara para fundo escuro).

---

## Arco Narrativo

```
Cena 1 → Identidade    "O que é o Endurance"
Cena 2 → Empatia       "Conheço o seu negócio"
Cena 3 → Dor           "O problema atual é real"
Cena 4 → Virada        "Uma descrição. A IA faz o resto."
Cena 5 → Revelação     "Seu espaço já nasce pronto"
Cena 6 → Prova         "Veja funcionando de verdade"
Cena 7 → Diferencial   "A IA fica com você"
Cena 8 → Impacto       "Dois minutos. ERP completo."
Cena 9 → Ação          "Comece agora"
```

---

## Princípios de Design

- **Dark mode nativo** — reflete a stack (Next.js, Tailwind tema escuro, ardósia + esmeralda)
- **Sem screenshots** — toda a UI é componente React animado
- **Contexto brasileiro real** — nomes, cidades, produtos e preços do dia a dia (Arroz, Feijão, Campinas, NFC-e)
- **IA como personagem** — a IA aparece na cena 4 (onboarding), na 7 (assistente) e nos badges ao longo do vídeo
- **Arco emocional**: Empatia → Dor → Alívio → Prova → Confiança
- **Audio-first timing**: Gere o áudio → meça → construa as cenas em torno do áudio
- **Spring em tudo**: Nunca use easing linear
