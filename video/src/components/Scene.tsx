import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Wrapper de cena com fade-out automático nos últimos `fadeFrames` frames
 * (opacity → 0, scale → 0.96). Centraliza o conteúdo.
 */
export const Scene: React.FC<{
  durationInFrames: number;
  fadeFrames?: number;
  children: React.ReactNode;
  center?: boolean;
}> = ({ durationInFrames, fadeFrames = 12, children, center = true }) => {
  const frame = useCurrentFrame();
  const fadeStart = durationInFrames - fadeFrames;
  const opacity = interpolate(frame, [fadeStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [fadeStart, durationInFrames], [1, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        justifyContent: center ? "center" : "flex-start",
        alignItems: center ? "center" : "stretch",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
