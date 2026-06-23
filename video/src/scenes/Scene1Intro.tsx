import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Logo } from "../components/Logo";
import { COLORS, SPRING, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - 2, fps, config: SPRING });

  const titleY = interpolate(frame, [8, 26], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subY = interpolate(frame, [18, 34], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Scene durationInFrames={SCENE_FRAMES.intro}>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", transform: `scale(${logoScale})` }}>
          <Logo size={100} radius={22} />
        </div>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 76,
            color: COLORS.foreground,
            fontWeight: 400,
            margin: "40px 0 0",
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
          }}
        >
          Apresentando o Endurance
        </h1>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 28,
            color: COLORS.muted,
            margin: "18px 0 0",
            transform: `translateY(${subY}px)`,
            opacity: subOpacity,
          }}
        >
          ERP com IA para pequenos negócios brasileiros
        </p>
      </div>
    </Scene>
  );
};
