import { useCurrentFrame, spring, interpolate, useVideoConfig, AbsoluteFill } from "remotion";
import { Scene } from "../components/Scene";
import { COLORS, SPRING_SNAPPY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const V8Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subReveal = spring({ frame: frame - 2, fps, config: SPRING_SNAPPY });
  const mainSlam = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 280, mass: 0.4 } });
  const mainScale = interpolate(mainSlam, [0, 1], [1.8, 1]);

  const shake = frame >= 8 && frame < 16
    ? Math.sin(frame * 3) * interpolate(frame, [8, 16], [4, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const flash = interpolate(frame, [8, 10, 14], [0, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const minuteCount = frame >= 8
    ? Math.min(2, interpolate(frame, [8, 25], [0, 2], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }))
    : 0;

  const glowPulse = frame >= 14 ? 0.12 + 0.08 * Math.sin(frame * 0.1) : 0;

  return (
    <Scene durationInFrames={SCENE_FRAMES.payoff}>
      {flash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle, ${COLORS.emerald}, transparent 60%)`,
            opacity: flash,
            zIndex: 5,
          }}
        />
      )}

      <div style={{ textAlign: "center", transform: `translateX(${shake}px)`, padding: "0 60px" }}>
        <p
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 36,
            color: COLORS.muted,
            margin: 0,
            opacity: subReveal,
            transform: `translateY(${interpolate(subReveal, [0, 1], [15, 0])}px)`,
            lineHeight: 1.3,
          }}
        >
          do zero a um ERP completo,{"\n"}configurado pro seu negócio
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 140,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "32px 0 0",
            transform: `scale(${mainScale})`,
            opacity: mainSlam,
            filter: `drop-shadow(0 0 ${40 * glowPulse}px ${COLORS.emerald})`,
            lineHeight: 1.05,
          }}
        >
          Em menos de{" "}
          <span style={{ color: COLORS.emeraldBright }}>
            {minuteCount < 2 ? minuteCount.toFixed(0) : "2"}
          </span>{" "}
          minutos.
        </h1>
      </div>
    </Scene>
  );
};
