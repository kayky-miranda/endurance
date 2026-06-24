import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { COLORS, SPRING, SPRING_SNAPPY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const BUSINESSES = [
  { emoji: "🛒", name: "Mercadinho do Zé", sub: "Campinas, SP · Varejo de bairro", badge: "sem sistema" },
  { emoji: "🏋️", name: "Academia Força Total", sub: "São Paulo, SP · Academia", badge: "planilha Excel" },
  { emoji: "✂️", name: "Salão da Mari", sub: "Belo Horizonte, MG · Cabeleireiro", badge: "caderno papel" },
];

const DIRS = [
  { x: -120, rot: -3 },
  { x: 120, rot: 2 },
  { x: -120, rot: 4 },
];

export const V2Dor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shake = frame > 100 && frame < 130
    ? Math.sin(frame * 1.8) * interpolate(frame, [100, 115, 130], [0, 5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const phraseReveal = spring({ frame: frame - 90, fps, config: SPRING_SNAPPY });

  return (
    <Scene durationInFrames={SCENE_FRAMES.dor}>
      <div style={{ textAlign: "center", transform: `translateX(${shake}px)`, padding: "0 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {BUSINESSES.map((b, i) => {
            const enter = spring({ frame: frame - i * 10, fps, config: SPRING });
            const dir = DIRS[i];
            const fromX = interpolate(enter, [0, 1], [dir.x, 0]);
            const rot = interpolate(enter, [0, 1], [dir.rot, 0]);

            const badgeSlam = spring({ frame: frame - (i * 10 + 18), fps, config: SPRING_SNAPPY });
            const badgeScale = interpolate(badgeSlam, [0, 1], [2, 1]);

            const pulse = frame > 50 ? 0.92 + 0.08 * Math.sin(frame * 0.15 + i * 2) : 1;

            return (
              <Card
                key={b.name}
                style={{
                  width: 820,
                  padding: 32,
                  background: "#ffffff",
                  transform: `translateX(${fromX}px) rotate(${rot}deg) scale(${0.85 + enter * 0.15})`,
                  opacity: enter,
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 90, transform: `scale(${pulse})` }}>{b.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 34, color: "#1a1d27" }}>
                    {b.name}
                  </div>
                  <div style={{ fontFamily: FONT.body, fontSize: 22, color: "#6b7280", marginTop: 6 }}>
                    {b.sub}
                  </div>
                  <div style={{ marginTop: 14, transform: `scale(${badgeScale})`, opacity: badgeSlam, display: "inline-block" }}>
                    <Badge tone="red" style={{ fontSize: 20, padding: "8px 18px" }}>⚠ {b.badge}</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.muted,
            marginTop: 60,
            opacity: phraseReveal,
            transform: `scale(${interpolate(phraseReveal, [0, 1], [0.9, 1])})`,
            lineHeight: 1.2,
          }}
        >
          Cada negócio diferente.{" "}
          <span style={{ color: COLORS.red }}>Toda configuração igual.</span>
        </p>
      </div>
    </Scene>
  );
};
