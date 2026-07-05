import { Img, staticFile } from "remotion";
import { COLORS } from "../theme";

export const Logo: React.FC<{ size?: number; radius?: number }> = ({
  size = 100,
  radius = 22,
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 8px 30px ${COLORS.emeraldGlow}`,
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile("images/endurance-logo.png")}
        style={{ width: size * 0.85, height: size * 0.85, objectFit: "contain" }}
      />
    </div>
  );
};
