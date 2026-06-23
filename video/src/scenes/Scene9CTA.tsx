import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { AbsoluteFill } from "remotion";
import { Logo } from "../components/Logo";
import { COLORS, SPRING, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const Scene9CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - 2, fps, config: SPRING });
  const textY = interpolate(frame, [8, 24], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Sublinhado cresce do frame 20 ao 45.
  const underline = interpolate(frame, [20, 45], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [50, 64], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // CTA não tem fade out — fica até o fim.
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", transform: `scale(${logoScale})` }}>
          <Logo size={80} radius={18} />
        </div>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 64,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "32px 0 0",
            transform: `translateY(${textY}px)`,
            opacity: textOpacity,
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
              }}
            />
          </span>
        </h1>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 18,
            color: COLORS.muted,
            marginTop: 28,
            opacity: badgeOpacity,
          }}
        >
          Sem cartão de crédito · Setup em 2 minutos
        </p>
      </div>
    </AbsoluteFill>
  );
};
