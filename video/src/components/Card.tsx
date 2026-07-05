import { COLORS, SHADOW } from "../theme";

/** Card dark padrão do design system. */
export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 14,
        boxShadow: SHADOW,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
