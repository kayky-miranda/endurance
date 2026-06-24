import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Badge } from "../components/Badge";
import { Logo } from "../components/Logo";
import { Typewriter } from "../components/Typewriter";
import { COLORS, SPRING_SNAPPY, SHADOW, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const V4Solucao: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSlam = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });
  const cardScale = interpolate(cardSlam, [0, 1], [0.8, 1]);

  const thinking = frame >= 50 && frame < 68;
  const dotPulse = (i: number) => 0.4 + 0.6 * Math.abs(Math.sin((frame - 50) / 5 + i));

  const answerReveal = spring({ frame: frame - 68, fps, config: SPRING_SNAPPY });
  const answerScale = interpolate(answerReveal, [0, 1], [1.3, 1]);

  const confPct = frame >= 68
    ? Math.min(97, Math.round(interpolate(frame, [68, 85], [0, 97], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })))
    : 0;

  const glowPulse = frame >= 68 ? 0.2 + 0.15 * Math.sin(frame * 0.15) : 0;

  return (
    <Scene durationInFrames={SCENE_FRAMES.solucao}>
      <div
        style={{
          width: 900,
          padding: 56,
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 22,
          boxShadow: SHADOW,
          transform: `scale(${cardScale})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Logo size={56} radius={14} />
          <span style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 32, color: COLORS.foreground }}>
            ENDURANCE
          </span>
          <Badge style={{ marginLeft: 6, fontSize: 18, padding: "5px 14px" }}>IA</Badge>
        </div>

        <div style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 22, color: COLORS.muted, marginTop: 36 }}>
          Descreva seu negócio:
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 28,
            background: COLORS.bg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 16,
            minHeight: 140,
            fontFamily: FONT.body,
            fontSize: 30,
            color: COLORS.foreground,
            lineHeight: 1.45,
          }}
        >
          <Typewriter
            text="Tenho um mercadinho de bairro em Campinas, SP. Vendo de tudo um pouco, tenho 2 funcionários."
            start={6}
            end={48}
          />
        </div>

        {thinking && (
          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: COLORS.emerald,
                  opacity: dotPulse(i),
                  transform: `scale(${dotPulse(i)})`,
                }}
              />
            ))}
          </div>
        )}

        {frame >= 68 && (
          <div
            style={{
              marginTop: 28,
              opacity: answerReveal,
              transform: `scale(${answerScale})`,
              filter: `drop-shadow(0 0 ${20 * glowPulse}px ${COLORS.emerald})`,
            }}
          >
            <Badge style={{ fontSize: 22, padding: "14px 22px" }}>
              ✓ Nicho: Mercado/Varejo · {confPct}% de confiança
            </Badge>
          </div>
        )}
      </div>
    </Scene>
  );
};
