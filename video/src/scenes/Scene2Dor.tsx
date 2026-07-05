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

const DIRS: Array<{ x: number; y: number; rot: number }> = [
  { x: -80, y: 40, rot: -4 },
  { x: 0, y: -30, rot: 2 },
  { x: 80, y: 40, rot: 5 },
];

export const Scene2Dor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shake = frame > 60 && frame < 90
    ? Math.sin(frame * 1.8) * interpolate(frame, [60, 75, 90], [0, 3, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const phraseReveal = spring({ frame: frame - 55, fps, config: SPRING_SNAPPY });

  return (
    <Scene durationInFrames={SCENE_FRAMES.dor}>
      <div style={{ textAlign: "center", transform: `translateX(${shake}px)` }}>
        <div style={{ display: "flex", gap: 28, justifyContent: "center" }}>
          {BUSINESSES.map((b, i) => {
            const enter = spring({ frame: frame - i * 8, fps, config: SPRING });
            const dir = DIRS[i];
            const fromX = interpolate(enter, [0, 1], [dir.x, 0]);
            const fromY = interpolate(enter, [0, 1], [dir.y, 0]);
            const rot = interpolate(enter, [0, 1], [dir.rot, 0]);

            const badgeSlam = spring({ frame: frame - (i * 8 + 15), fps, config: SPRING_SNAPPY });
            const badgeScale = interpolate(badgeSlam, [0, 1], [2, 1]);

            const pulse = frame > 40 ? 0.92 + 0.08 * Math.sin(frame * 0.15 + i * 2) : 1;

            return (
              <Card
                key={b.name}
                style={{
                  width: 260,
                  padding: 20,
                  background: "#ffffff",
                  transform: `translate(${fromX}px, ${fromY}px) rotate(${rot}deg) scale(${0.85 + enter * 0.15})`,
                  opacity: enter,
                }}
              >
                <div style={{ fontSize: 40, transform: `scale(${pulse})` }}>{b.emoji}</div>
                <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 20, color: "#1a1d27", marginTop: 10 }}>
                  {b.name}
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {b.sub}
                </div>
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
                <div style={{ marginTop: 14, transform: `scale(${badgeScale})`, opacity: badgeSlam }}>
                  <Badge tone="red">⚠ {b.badge}</Badge>
                </div>
              </Card>
            );
          })}
        </div>

        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.muted,
            marginTop: 40,
            opacity: phraseReveal,
            transform: `scale(${interpolate(phraseReveal, [0, 1], [0.9, 1])})`,
          }}
        >
          Cada negócio diferente.{" "}
          <span style={{ color: COLORS.red }}>Toda configuração igual.</span>
        </p>
      </div>
    </Scene>
  );
};
