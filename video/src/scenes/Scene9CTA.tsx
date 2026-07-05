import { useCurrentFrame, spring, interpolate, useVideoConfig, AbsoluteFill } from "remotion";
import { Logo } from "../components/Logo";
import { COLORS, SPRING_SNAPPY, SPRING_BOUNCY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const Scene9CTA: React.FC = () => {
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
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            transform: `scale(${logoScale})`,
            filter: `drop-shadow(0 0 ${30 * glowPulse}px ${COLORS.emerald})`,
          }}
        >
          <Logo size={80} radius={18} />
        </div>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 64,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "28px 0 0",
            opacity: textReveal,
            transform: `translateY(${interpolate(textReveal, [0, 1], [15, 0])}px)`,
          }}
        >
          comece grátis em{" "}
          <span style={{ position: "relative", color: COLORS.emeraldBright }}>
            endurance.app
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: -6,
                height: 4,
                width: `${underline}%`,
                background: COLORS.emerald,
                borderRadius: 2,
                boxShadow: `0 0 12px ${COLORS.emeraldGlow}`,
              }}
            />
          </span>
        </h1>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 18,
            color: COLORS.muted,
            marginTop: 24,
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
