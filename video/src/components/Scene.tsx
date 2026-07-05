import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const Scene: React.FC<{
  durationInFrames: number;
  fadeFrames?: number;
  children: React.ReactNode;
  center?: boolean;
  zoom?: boolean;
}> = ({ durationInFrames, fadeFrames = 6, children, center = true, zoom = true }) => {
  const frame = useCurrentFrame();
  const fadeStart = durationInFrames - fadeFrames;
  const opacity = interpolate(frame, [fadeStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const zoomScale = zoom
    ? interpolate(frame, [0, durationInFrames], [1, 1.04], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${zoomScale})`,
        justifyContent: center ? "center" : "flex-start",
        alignItems: center ? "center" : "stretch",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
