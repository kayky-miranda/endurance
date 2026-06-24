import { AbsoluteFill, useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { COLORS, SPRING, SPRING_SNAPPY, MONO, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const FLOATING = [
  { title: "ERP Genérico", tone: COLORS.blue, x: -260, y: -320, rot: -5, lines: ["Contabilidade", "RH", "Jurídico"] },
  { title: "Módulo Fiscal", tone: COLORS.purple, x: 200, y: -360, rot: 4, lines: ["CNAE", "CFOP", "CEST"], mono: true },
  { title: "Caixa", tone: COLORS.orange, x: -280, y: -50, rot: -4, lines: ["14 campos vazios"] },
  { title: "Relatórios", tone: COLORS.emerald, x: 230, y: -20, rot: 5, lines: ["Gráfico sem contexto"] },
  { title: "Cadastro", tone: COLORS.red, x: -230, y: 240, rot: -7, lines: ["200+ colunas"] },
  { title: "Permissões", tone: COLORS.purple, x: 240, y: 280, rot: 6, lines: ["Matriz infinita"] },
];

export const V3Agitacao: React.FC = () => {
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
        <svg width={1080} height={1920} style={{ position: "absolute", opacity: linesOpacity }}>
          {FLOATING.map((c, i) => {
            const next = FLOATING[(i + 1) % FLOATING.length];
            const wobble = Math.sin(frame * 0.08 + i) * 4;
            return (
              <line
                key={i}
                x1={540 + c.x + 100 + wobble}
                y1={960 + c.y + 40}
                x2={540 + next.x + 100 - wobble}
                y2={960 + next.y + 40}
                stroke={COLORS.muted}
                strokeWidth={2}
                strokeDasharray="10"
              />
            );
          })}
        </svg>

        <div style={{ position: "absolute", top: 180, textAlign: "center", zIndex: 2, padding: "0 60px" }}>
          <div
            style={{
              fontFamily: FONT.body,
              fontSize: 56,
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
              fontSize: 32,
              color: COLORS.muted,
              marginTop: 16,
              opacity: interpolate(frame, [10, 22], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              lineHeight: 1.3,
            }}
          >
            Módulos que não servem.{"\n"}Telas que não fazem sentido.
          </div>
        </div>

        {FLOATING.map((c, i) => {
          const enter = spring({ frame: frame - i * 6, fps, config: SPRING });
          const scale = interpolate(enter, [0, 1], [0.2, 1]);
          const drift = chaos * (i % 2 === 0 ? 1 : -1) * 14;
          const rotDrift = chaos * (i % 2 === 0 ? 3 : -3);
          const bob = Math.sin(frame * 0.06 + i * 1.2) * 5;

          return (
            <div
              key={c.title}
              style={{
                position: "absolute",
                transform: `translate(${c.x + drift}px, ${c.y + bob}px) rotate(${c.rot + rotDrift}deg) scale(${scale})`,
                opacity: enter,
                width: 250,
                padding: "20px 24px",
                background: "#ffffff",
                borderRadius: 14,
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                borderTop: `4px solid ${c.tone}`,
              }}
            >
              <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 20, color: "#1a1d27" }}>
                {c.title}
              </div>
              <div style={{ marginTop: 8 }}>
                {c.lines.map((l) => (
                  <div
                    key={l}
                    style={{
                      fontFamily: c.mono ? MONO : FONT.body,
                      fontSize: 16,
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
