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

export const Scene6Modulos: React.FC = () => {
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
        {!phase2 ? (
          <PdvPhase frame={frame} fps={fps} />
        ) : (
          <NfcePhase frame={frame - 95} fps={fps} opacity={phaseTransition} />
        )}
      </div>
    </Scene>
  );
};

const PdvPhase: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
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
      <BrowserWindow url="endurance.app/pdv" width={880}>
        <div
          style={{
            fontFamily: FONT.body,
            fontWeight: 700,
            fontSize: 22,
            color: COLORS.foreground,
            marginBottom: 16,
          }}
        >
          Frente de Caixa
        </div>
        {CART.map((item, i) => {
          const enter = spring({ frame: frame - i * 6, fps, config: SPRING_SNAPPY });
          const x = interpolate(enter, [0, 1], [40, 0]);
          return (
            <div
              key={item.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: COLORS.bg,
                borderRadius: 10,
                marginBottom: 8,
                opacity: enter,
                transform: `translateX(${x}px)`,
                fontFamily: FONT.body,
                fontSize: 18,
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
            padding: "14px 16px",
            marginTop: 8,
            fontFamily: FONT.body,
            fontWeight: 700,
            fontSize: 22,
            color: COLORS.emeraldBright,
          }}
        >
          <span>Total</span>
          <span>R$ 38,60</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {PAYMENTS.map((p, i) => {
            const enter = spring({ frame: frame - (35 + i * 3), fps, config: SPRING });
            const isPix = p === "PIX";
            return (
              <div
                key={p}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px 0",
                  borderRadius: 10,
                  background: isPix ? COLORS.emerald : COLORS.bg,
                  border: `1px solid ${COLORS.cardBorder}`,
                  color: isPix ? "#06120a" : COLORS.foreground,
                  fontFamily: FONT.body,
                  fontWeight: 600,
                  fontSize: 16,
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
          right: -30,
          top: 120,
          opacity: suggestion,
          transform: `translateX(${interpolate(suggestion, [0, 1], [20, 0])}px)`,
        }}
      >
        <Badge style={{ fontStyle: "italic", background: "rgba(16,185,129,0.18)" }}>
          💡 Sugestão IA: Adicionar pão de forma?
        </Badge>
      </div>
    </div>
  );
};

const NfcePhase: React.FC<{ frame: number; fps: number; opacity: number }> = ({
  frame,
  fps,
  opacity,
}) => {
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
        width: 620,
        padding: 32,
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 16,
        boxShadow: `0 25px 60px rgba(0,0,0,0.4), 0 0 ${40 * successGlow}px ${COLORS.emerald}`,
        transform: `scale(${cardScale})`,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT.body,
          fontWeight: 700,
          fontSize: 24,
          color: COLORS.emeraldBright,
        }}
      >
        NFC-e 000042 · Emitida com sucesso
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 24, alignItems: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 2,
            background: "#fff",
            padding: 8,
            borderRadius: 8,
          }}
        >
          {Array.from({ length: 64 }).map((_, k) => (
            <div
              key={k}
              style={{
                background:
                  k < qrProgress && (k * 7 + 3) % 5 < 3 ? "#0f1117" : "transparent",
                borderRadius: 1,
              }}
            />
          ))}
        </div>
        <div>
          <div style={{ fontFamily: FONT.body, fontSize: 16, color: COLORS.foreground }}>
            Total: R$ 38,60
          </div>
          <div
            style={{
              fontFamily: FONT.body,
              fontSize: 14,
              color: COLORS.muted,
              marginTop: 4,
            }}
          >
            3 itens · Mercadinho do Zé
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: COLORS.muted,
              marginTop: 10,
              maxWidth: 300,
              wordBreak: "break-all",
            }}
          >
            3512 3456 7890 1234 5678 9012 3456 7890 1234 5678
          </div>
          <div style={{ marginTop: 12 }}>
            <Badge tone="blue">DANFE disponível</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
