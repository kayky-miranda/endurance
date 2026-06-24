import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 73.5) % 1080,
  y: (i * 137.3) % 1920,
  size: 2 + (i % 4),
  speed: 0.3 + (i % 5) * 0.15,
  opacity: 0.08 + (i % 3) * 0.06,
}));

export const BackgroundVertical: React.FC = () => {
  const frame = useCurrentFrame();

  const blobX = interpolate(frame, [0, 2111], [0, 60], { extrapolateRight: "clamp" });
  const blobY = interpolate(frame, [0, 2111], [0, -80], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(to right, ${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(to bottom, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -200 + blobY,
          right: -150 + blobX,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -180 - blobY * 0.5,
          left: -150 - blobX * 0.5,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      {PARTICLES.map((p, i) => {
        const y = (p.y - frame * p.speed * 30) % 2100;
        const float = Math.sin(frame * 0.04 + i) * 8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x + float,
              top: y < -20 ? y + 2100 : y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: COLORS.emerald,
              opacity: p.opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
