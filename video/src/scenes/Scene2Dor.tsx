import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { COLORS, SPRING, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const BUSINESSES = [
  { emoji: "🛒", name: "Mercadinho do Zé", sub: "Campinas, SP · Varejo de bairro", badge: "sem sistema" },
  { emoji: "🏋️", name: "Academia Força Total", sub: "São Paulo, SP · Academia", badge: "planilha Excel" },
  { emoji: "✂️", name: "Salão da Mari", sub: "Belo Horizonte, MG · Cabeleireiro", badge: "caderno papel" },
];

export const Scene2Dor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phraseY = interpolate(frame, [60, 80], [25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phraseOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Scene durationInFrames={SCENE_FRAMES.dor}>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", gap: 28, justifyContent: "center" }}>
          {BUSINESSES.map((b, i) => {
            const enter = spring({ frame: frame - i * 14, fps, config: SPRING });
            const y = interpolate(enter, [0, 1], [20, 0]);
            const badgeOpacity = interpolate(frame, [i * 14 + 8, i * 14 + 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <Card
                key={b.name}
                style={{
                  width: 260,
                  padding: 20,
                  background: "#ffffff",
                  transform: `scale(${0.85 + enter * 0.15}) translateY(${y}px)`,
                  opacity: enter,
                }}
              >
                <div style={{ fontSize: 40 }}>{b.emoji}</div>
                <div
                  style={{
                    fontFamily: FONT.body,
                    fontWeight: 700,
                    fontSize: 20,
                    color: "#1a1d27",
                    marginTop: 10,
                  }}
                >
                  {b.name}
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {b.sub}
                </div>
                {/* Mini-esquema */}
                <div
                  style={{
                    marginTop: 14,
                    height: 60,
                    borderRadius: 8,
                    background: "#f3f4f6",
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 4,
                    padding: 8,
                  }}
                >
                  {Array.from({ length: 8 }).map((_, k) => (
                    <div key={k} style={{ background: "#e5e7eb", borderRadius: 3 }} />
                  ))}
                </div>
                <div style={{ marginTop: 14, opacity: badgeOpacity }}>
                  <Badge tone="red">⚠ {b.badge}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 22,
            fontWeight: 500,
            color: COLORS.muted,
            marginTop: 40,
            transform: `translateY(${phraseY}px)`,
            opacity: phraseOpacity,
          }}
        >
          Cada negócio diferente. Toda configuração igual.
        </p>
      </div>
    </Scene>
  );
};
