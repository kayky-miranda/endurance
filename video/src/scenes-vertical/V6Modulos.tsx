import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { BrowserWindow } from "../components/BrowserWindow";
import { Badge } from "../components/Badge";
import { COLORS, SPRING, SPRING_SNAPPY, MONO, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const CART = [
  { name: "Arroz 5kg", price: "R$ 22,90" },
  { name: "Feijão 1kg", price: "R$ 8,50" },
  { name: "Óleo de soja", price: "R$ 7,20" },
];
const PAYMENTS = ["Dinheiro", "Crédito", "Débito", "PIX"];

export const V6Modulos: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phase2 = frame >= 95;
  const phaseTransition = phase2
    ? interpolate(frame, [95, 100], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <Scene durationInFrames={SCENE_FRAMES.modulos}>
      <div
        style={{
          position: "relative",
          transform: phase2
            ? `scale(${interpolate(phaseTransition, [0, 1], [0.95, 1])})`
            : undefined,
        }}
      >
        {!phase2 ? <Pdv frame={frame} fps={fps} /> : <Nfce frame={frame - 95} fps={fps} opacity={phaseTransition} />}
      </div>
    </Scene>
  );
};

const Pdv: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const browserReveal = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });
  const suggestion = spring({ frame: frame - 65, fps, config: SPRING });

  return (
    <div
      style={{
        position: "relative",
        transform: `scale(${interpolate(browserReveal, [0, 1], [0.9, 1])})`,
        opacity: browserReveal,
      }}
    >
      <BrowserWindow url="endurance.app/pdv" width={950}>
        <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 34, color: COLORS.foreground, marginBottom: 22 }}>
          Frente de Caixa
        </div>
        {CART.map((item, i) => {
          const enter = spring({ frame: frame - i * 6, fps, config: SPRING_SNAPPY });
          const x = interpolate(enter, [0, 1], [50, 0]);
          return (
            <div
              key={item.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "20px 24px",
                background: COLORS.bg,
                borderRadius: 14,
                marginBottom: 12,
                opacity: enter,
                transform: `translateX(${x}px)`,
                fontFamily: FONT.body,
                fontSize: 28,
                color: COLORS.foreground,
              }}
            >
              <span>{item.name}</span>
              <span>{item.price}</span>
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "20px 24px",
            marginTop: 14,
            fontFamily: FONT.body,
            fontWeight: 700,
            fontSize: 36,
            color: COLORS.emeraldBright,
          }}
        >
          <span>Total</span>
          <span>R$ 38,60</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          {PAYMENTS.map((p, i) => {
            const enter = spring({ frame: frame - (35 + i * 3), fps, config: SPRING });
            const isPix = p === "PIX";
            return (
              <div
                key={p}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "20px 0",
                  borderRadius: 14,
                  background: isPix ? COLORS.emerald : COLORS.bg,
                  border: `1px solid ${COLORS.cardBorder}`,
                  color: isPix ? "#06120a" : COLORS.foreground,
                  fontFamily: FONT.body,
                  fontWeight: 600,
                  fontSize: 22,
                  opacity: enter,
                  transform: `scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
                  boxShadow: isPix ? `0 4px 16px ${COLORS.emeraldGlow}` : "none",
                }}
              >
                {p}
              </div>
            );
          })}
        </div>
      </BrowserWindow>

      <div
        style={{
          position: "absolute",
          right: -10,
          top: 180,
          opacity: suggestion,
          transform: `translateX(${interpolate(suggestion, [0, 1], [30, 0])}px)`,
        }}
      >
        <Badge style={{ fontStyle: "italic", background: "rgba(16,185,129,0.18)", fontSize: 18, padding: "10px 16px" }}>
          💡 IA: Adicionar pão?
        </Badge>
      </div>
    </div>
  );
};

const Nfce: React.FC<{ frame: number; fps: number; opacity: number }> = ({ frame, fps, opacity }) => {
  const cardSlam = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });
  const cardScale = interpolate(cardSlam, [0, 1], [0.7, 1]);
  const qrProgress = interpolate(frame, [5, 22], [0, 64], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const successGlow = frame > 25 ? 0.15 + 0.1 * Math.sin(frame * 0.12) : 0;

  return (
    <div
      style={{
        width: 880,
        padding: 48,
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 22,
        boxShadow: `0 25px 60px rgba(0,0,0,0.4), 0 0 ${50 * successGlow}px ${COLORS.emerald}`,
        transform: `scale(${cardScale})`,
        opacity,
      }}
    >
      <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 36, color: COLORS.emeraldBright }}>
        NFC-e 000042 emitida ✓
      </div>
      <div style={{ display: "flex", gap: 32, marginTop: 32, alignItems: "center" }}>
        <div
          style={{
            width: 160,
            height: 160,
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 3,
            background: "#fff",
            padding: 12,
            borderRadius: 12,
            flexShrink: 0,
          }}
        >
          {Array.from({ length: 64 }).map((_, k) => (
            <div
              key={k}
              style={{
                background: k < qrProgress && (k * 7 + 3) % 5 < 3 ? "#0f1117" : "transparent",
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div>
          <div style={{ fontFamily: FONT.body, fontSize: 26, color: COLORS.foreground }}>
            Total: R$ 38,60
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 20, color: COLORS.muted, marginTop: 6 }}>
            3 itens · Mercadinho do Zé
          </div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: COLORS.muted, marginTop: 14, maxWidth: 380, wordBreak: "break-all" }}>
            3512 3456 7890 1234 5678 9012
          </div>
          <div style={{ marginTop: 16 }}>
            <Badge tone="blue" style={{ fontSize: 18, padding: "8px 16px" }}>DANFE disponível</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
