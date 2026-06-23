import { AbsoluteFill, useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { COLORS, SPRING, MONO, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const FLOATING = [
  { title: "ERP Genérico", tone: COLORS.blue, x: -310, y: -185, rot: -5, lines: ["Contabilidade", "RH", "Jurídico", "Internacional"] },
  { title: "Módulo Fiscal", tone: COLORS.purple, x: 90, y: -205, rot: 4, lines: ["CNAE", "CST", "CFOP", "CEST"], mono: true },
  { title: "Controle de Caixa", tone: COLORS.orange, x: -195, y: -15, rot: -4, lines: ["14 campos em branco"] },
  { title: "Relatórios", tone: COLORS.emerald, x: 185, y: -35, rot: 5, lines: ["Gráfico sem contexto"] },
  { title: "Cadastro de Produtos", tone: COLORS.red, x: -275, y: 145, rot: -7, lines: ["200+ colunas"] },
  { title: "Permissões", tone: COLORS.purple, x: 125, y: 155, rot: 6, lines: ["Matriz infinita"] },
];

export const Scene3Agitacao: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const linesOpacity = interpolate(frame, [55, 105], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Scene durationInFrames={SCENE_FRAMES.agitacao}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {/* Linhas de conexão bagunçadas */}
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", opacity: linesOpacity }}
        >
          {FLOATING.map((c, i) => {
            const next = FLOATING[(i + 1) % FLOATING.length];
            return (
              <line
                key={i}
                x1={960 + c.x + 100}
                y1={540 + c.y + 40}
                x2={960 + next.x + 100}
                y2={540 + next.y + 40}
                stroke={COLORS.muted}
                strokeWidth={1.5}
                strokeDasharray="8"
              />
            );
          })}
        </svg>

        {/* Header */}
        <div style={{ position: "absolute", top: 120, textAlign: "center", zIndex: 2 }}>
          <div style={{ fontFamily: FONT.body, fontSize: 28, fontWeight: 600, color: COLORS.foreground }}>
            Dias de configuração
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 22, color: COLORS.muted, marginTop: 8 }}>
            Módulos que não servem. Telas que não fazem sentido.
          </div>
        </div>

        {/* Cards flutuantes */}
        {FLOATING.map((c, i) => {
          const enter = spring({ frame: frame - i * 12, fps, config: SPRING });
          const scale = interpolate(enter, [0, 1], [0.3, 1]);
          return (
            <div
              key={c.title}
              style={{
                position: "absolute",
                transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rot}deg) scale(${scale})`,
                opacity: enter,
                width: 200,
                padding: "16px 20px",
                background: "#ffffff",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                borderTop: `3px solid ${c.tone}`,
              }}
            >
              <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 15, color: "#1a1d27" }}>
                {c.title}
              </div>
              <div style={{ marginTop: 8 }}>
                {c.lines.map((l) => (
                  <div
                    key={l}
                    style={{
                      fontFamily: c.mono ? MONO : FONT.body,
                      fontSize: 12,
                      color: "#6b7280",
                      padding: "3px 0",
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </Scene>
  );
};
