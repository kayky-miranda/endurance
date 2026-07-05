import { COLORS, SHADOW } from "../theme";
import { FONT } from "../fonts";

/** Janela estilo macOS com 3 dots e barra de URL em pill. */
export const BrowserWindow: React.FC<{
  url: string;
  width: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ url, width, children, style }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 14,
        overflow: "hidden",
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        boxShadow: SHADOW,
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{ width: 12, height: 12, borderRadius: "50%", background: c }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 999,
              padding: "5px 18px",
              color: COLORS.muted,
              fontFamily: FONT.body,
              fontSize: 14,
            }}
          >
            {url}
          </div>
        </div>
        <div style={{ width: 52 }} />
      </div>
      {/* Conteúdo */}
      <div style={{ padding: 28 }}>{children}</div>
    </div>
  );
};
