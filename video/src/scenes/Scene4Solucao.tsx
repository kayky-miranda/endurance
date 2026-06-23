import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Badge } from "../components/Badge";
import { Logo } from "../components/Logo";
import { Typewriter } from "../components/Typewriter";
import { COLORS, SPRING, SHADOW, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const Scene4Solucao: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardScale = spring({ frame: frame - 2, fps, config: SPRING });

  // Thinking dots após 57
  const thinking = frame >= 57 && frame < 75;
  const dotPulse = (i: number) => 0.4 + 0.6 * Math.abs(Math.sin((frame - 57) / 6 + i));

  const answer = spring({ frame: frame - 75, fps, config: SPRING });

  return (
    <Scene durationInFrames={SCENE_FRAMES.solucao}>
      <div
        style={{
          width: 780,
          padding: 40,
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 16,
          boxShadow: SHADOW,
          transform: `scale(${0.92 + cardScale * 0.08})`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={32} radius={9} />
          <span style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 20, color: COLORS.foreground }}>
            Endurance
          </span>
          <Badge style={{ marginLeft: 4, fontSize: 12, padding: "3px 10px" }}>IA</Badge>
        </div>

        <div style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 14, color: COLORS.muted, marginTop: 28 }}>
          Descreva seu negócio:
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 20,
            background: COLORS.bg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 12,
            minHeight: 80,
            fontFamily: FONT.body,
            fontSize: 20,
            color: COLORS.foreground,
            lineHeight: 1.5,
          }}
        >
          <Typewriter
            text="Tenho um mercadinho de bairro em Campinas, SP. Vendo de tudo um pouco, tenho 2 funcionários."
            start={10}
            end={55}
          />
        </div>

        {thinking && (
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: COLORS.emerald,
                  opacity: dotPulse(i),
                }}
              />
            ))}
          </div>
        )}

        {frame >= 75 && (
          <div style={{ marginTop: 20, opacity: answer, transform: `translateY(${interpolate(answer, [0, 1], [10, 0])}px)` }}>
            <Badge style={{ fontSize: 16, padding: "10px 18px" }}>
              ✓ Nicho identificado: Mercado/Varejo · 97% de confiança
            </Badge>
          </div>
        )}
      </div>
    </Scene>
  );
};
