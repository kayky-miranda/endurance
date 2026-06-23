import { COLORS } from "../theme";
import { FONT } from "../fonts";

/** Badge padrão Endurance (esmeralda) ou variante por cor. */
export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: "emerald" | "red" | "blue" | "orange" | "purple";
  style?: React.CSSProperties;
}> = ({ children, tone = "emerald", style }) => {
  const map = {
    emerald: { bg: COLORS.emeraldLight, border: COLORS.emeraldGlow, text: COLORS.emeraldBright },
    red: { bg: COLORS.redLight, border: "rgba(239,68,68,0.25)", text: "#f87171" },
    blue: { bg: COLORS.blueLight, border: "rgba(59,130,246,0.25)", text: "#60a5fa" },
    orange: { bg: COLORS.orangeLight, border: "rgba(249,115,22,0.25)", text: "#fb923c" },
    purple: { bg: COLORS.purpleLight, border: "rgba(139,92,246,0.25)", text: "#a78bfa" },
  }[tone];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: map.bg,
        border: `1px solid ${map.border}`,
        color: map.text,
        fontFamily: FONT.body,
        fontWeight: 600,
        fontSize: 14,
        padding: "6px 14px",
        borderRadius: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
