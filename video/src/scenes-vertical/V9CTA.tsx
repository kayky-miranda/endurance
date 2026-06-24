import { useCurrentFrame, spring, interpolate, useVideoConfig, AbsoluteFill } from "remotion";
import { Logo } from "../components/Logo";
import { COLORS, SPRING_SNAPPY, SPRING_BOUNCY } from "../theme";
import { FONT } from "../fonts";

export const V9CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSlam = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });
  const logoScale = interpolate(logoSlam, [0, 1], [1.5, 1]);

  const textReveal = spring({ frame: frame - 4, fps, config: SPRING_SNAPPY });

  const underline = interpolate(frame, [10, 30], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeReveal = spring({ frame: frame - 35, fps, config: SPRING_BOUNCY });
  const glowPulse = 0.2 + 0.15 * Math.sin(frame * 0.15);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", padding: "0 60px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            transform: `scale(${logoScale})`,
            filter: `drop-shadow(0 0 ${40 * glowPulse}px ${COLORS.emerald})`,
          }}
        >
          <Logo size={160} radius={36} />
        </div>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 90,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "48px 0 0",
            opacity: textReveal,
            transform: `translateY(${interpolate(textReveal, [0, 1], [20, 0])}px)`,
            lineHeight: 1.15,
          }}
        >
          comece grátis em{"\n"}
          <span style={{ position: "relative", color: COLORS.emeraldBright, display: "inline-block" }}>
            endurance.app
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: -8,
                height: 6,
                width: `${underline}%`,
                background: COLORS.emerald,
                borderRadius: 3,
                boxShadow: `0 0 16px ${COLORS.emeraldGlow}`,
              }}
            />
          </span>
        </h1>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 28,
            color: COLORS.muted,
            marginTop: 40,
            opacity: badgeReveal,
            transform: `scale(${interpolate(badgeReveal, [0, 1], [0.9, 1])})`,
          }}
        >
          Sem cartão de crédito · Setup em 2 minutos
        </p>
      </div>
    </AbsoluteFill>
  );
};
