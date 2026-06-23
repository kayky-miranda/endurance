import { COLORS } from "../theme";
import { FONT } from "../fonts";

/**
 * Logo do Endurance. Tenta usar /images/endurance-logo.png; como fallback
 * (enquanto o asset não existe), desenha um mark "E" em esmeralda — assim o
 * vídeo renderiza mesmo sem o PNG.
 */
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
        background: "linear-gradient(160deg, #064e3b, #065f46)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 8px 30px ${COLORS.emeraldGlow}`,
        border: `1px solid rgba(52,211,153,0.3)`,
      }}
    >
      <span
        style={{
          fontFamily: FONT.serif,
          fontSize: size * 0.52,
          color: COLORS.emeraldBright,
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        E
      </span>
    </div>
  );
};
