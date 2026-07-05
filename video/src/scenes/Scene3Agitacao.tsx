import { AbsoluteFill, useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { COLORS, SPRING, SPRING_SNAPPY, MONO, SCENE_FRAMES } from "../theme";
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

  const linesOpacity = interpolate(frame, [40, 70], [0, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerSlam = spring({ frame: frame - 2, fps, config: SPRING_SNAPPY });

  const chaos = frame > 80
    ? interpolate(frame, [80, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  return (
    <Scene durationInFrames={SCENE_FRAMES.agitacao}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", opacity: linesOpacity }}
        >
          {FLOATING.map((c, i) => {
            const next = FLOATING[(i + 1) % FLOATING.length];
            const wobble = Math.sin(frame * 0.08 + i) * 4;
            return (
              <line
                key={i}
                x1={960 + c.x + 100 + wobble}
                y1={540 + c.y + 40}
                x2={960 + next.x + 100 - wobble}
                y2={540 + next.y + 40}
                stroke={COLORS.muted}
                strokeWidth={1.5}
                strokeDasharray="8"
              />
            );
          })}
        </svg>

        <div style={{ position: "absolute", top: 110, textAlign: "center", zIndex: 2 }}>
          <div
            style={{
              fontFamily: FONT.body,
              fontSize: 30,
              fontWeight: 700,
              color: COLORS.foreground,
              transform: `scale(${interpolate(headerSlam, [0, 1], [0.6, 1])})`,
              opacity: headerSlam,
            }}
          >
            Dias de configuração
          </div>
          <div
            style={{
              fontFamily: FONT.body,
              fontSize: 22,
              color: COLORS.muted,
              marginTop: 8,
              opacity: interpolate(frame, [10, 22], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Módulos que não servem. Telas que não fazem sentido.
          </div>
        </div>

        {FLOATING.map((c, i) => {
          const enter = spring({ frame: frame - i * 6, fps, config: SPRING });
          const scale = interpolate(enter, [0, 1], [0.2, 1]);
          const drift = chaos * (i % 2 === 0 ? 1 : -1) * 12;
          const rotDrift = chaos * (i % 2 === 0 ? 3 : -3);
          const bob = Math.sin(frame * 0.06 + i * 1.2) * 4;

          return (
            <div
              key={c.title}
              style={{
                position: "absolute",
                transform: `translate(${c.x + drift}px, ${c.y + bob}px) rotate(${c.rot + rotDrift}deg) scale(${scale})`,
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
