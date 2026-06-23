import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { COLORS, SPRING, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const Scene8Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainScale = spring({ frame: frame - 4, fps, config: SPRING });
  const subY = interpolate(frame, [14, 30], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [14, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Scene durationInFrames={SCENE_FRAMES.payoff}>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 24,
            color: COLORS.muted,
            margin: 0,
            transform: `translateY(${subY}px)`,
            opacity: subOpacity,
          }}
        >
          do zero a um ERP completo, configurado pro seu negócio
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 100,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "20px 0 0",
            transform: `scale(${interpolate(mainScale, [0, 1], [0.7, 1])})`,
          }}
        >
          Em menos de 2 minutos.
        </h1>
      </div>
    </Scene>
  );
};
