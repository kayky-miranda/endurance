import { useCurrentFrame, spring, interpolate, useVideoConfig, AbsoluteFill } from "remotion";
import { Scene } from "../components/Scene";
import { Logo } from "../components/Logo";
import { COLORS, SPRING_SNAPPY, SPRING_BOUNCY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const V1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flash = interpolate(frame, [0, 3, 8], [1, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoSlam = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });
  const logoScale = interpolate(logoSlam, [0, 1], [2.5, 1]);
  const logoRotate = interpolate(logoSlam, [0, 1], [-15, 0]);

  const ringScale = spring({ frame: frame - 4, fps, config: { ...SPRING_BOUNCY, damping: 6 } });
  const ringOpacity = interpolate(frame, [4, 20], [0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleReveal = spring({ frame: frame - 6, fps, config: SPRING_SNAPPY });
  const subReveal = spring({ frame: frame - 12, fps, config: SPRING_SNAPPY });
  const glowPulse = 0.15 + 0.1 * Math.sin(frame * 0.12);

  return (
    <Scene durationInFrames={SCENE_FRAMES.intro}>
      {flash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle, ${COLORS.emerald}, transparent 70%)`,
            opacity: flash,
            zIndex: 10,
          }}
        />
      )}

      <div style={{ textAlign: "center", position: "relative", padding: "0 60px" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 110,
            transform: `translate(-50%, 0) scale(${ringScale * 3})`,
            width: 180,
            height: 180,
            borderRadius: "50%",
            border: `3px solid ${COLORS.emerald}`,
            opacity: ringOpacity,
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            transform: `scale(${logoScale}) rotate(${logoRotate}deg)`,
            filter: `drop-shadow(0 0 ${50 * glowPulse}px ${COLORS.emerald})`,
          }}
        >
          <Logo size={200} radius={42} />
        </div>

        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 96,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "60px 0 0",
            opacity: titleReveal,
            transform: `translateY(${interpolate(titleReveal, [0, 1], [40, 0])}px)`,
            letterSpacing: -1,
            lineHeight: 1.05,
          }}
        >
          Apresentando o{" "}
          <span style={{ color: COLORS.emeraldBright }}>ENDURANCE</span>
        </h1>

        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 40,
            color: COLORS.muted,
            margin: "32px 0 0",
            opacity: subReveal,
            transform: `translateY(${interpolate(subReveal, [0, 1], [20, 0])}px)`,
            lineHeight: 1.3,
          }}
        >
          ERP com IA para pequenos negócios brasileiros
        </p>
      </div>
    </Scene>
  );
};
