import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Typewriter } from "../components/Typewriter";
import { COLORS, SPRING_SNAPPY, SPRING_BOUNCY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const INSIGHTS = [
  { icon: "📈", text: "Vendas 12% acima da semana" },
  { icon: "⚠️", text: "3 clientes sem comprar há 30d" },
  { icon: "💡", text: "Feijão com margem baixa" },
];

export const V7IA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const layoutReveal = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });

  return (
    <Scene durationInFrames={SCENE_FRAMES.ia}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 32,
          alignItems: "center",
          opacity: layoutReveal,
          transform: `translateY(${interpolate(layoutReveal, [0, 1], [40, 0])}px)`,
          padding: "0 60px",
        }}
      >
        <div
          style={{
            width: 900,
            background: COLORS.card,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 18,
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            padding: 32,
          }}
        >
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 600,
              fontSize: 22,
              color: COLORS.emeraldBright,
              marginBottom: 20,
            }}
          >
            Assistente ENDURANCE
          </div>

          <Bubble who="user" frame={frame} delay={4}>
            Qual produto vendeu mais essa semana?
          </Bubble>
          <Bubble who="ai" frame={frame} delay={10}>
            <Typewriter
              text="Arroz 5kg liderou com 47 unidades. Estoque atual: 12 — reposição recomendada para quinta."
              start={14}
              end={50}
            />
          </Bubble>

          {frame >= 56 && (
            <Bubble who="user" frame={frame} delay={56}>
              E a margem dele?
            </Bubble>
          )}
          {frame >= 62 && (
            <Bubble who="ai" frame={frame} delay={62}>
              <Typewriter
                text="Margem: 18%. Concorrentes praticam 22–25%. Pode aumentar R$2 sem perder venda."
                start={66}
                end={100}
              />
            </Bubble>
          )}
        </div>

        <div style={{ width: 900 }}>
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 700,
              fontSize: 26,
              color: COLORS.foreground,
              marginBottom: 16,
            }}
          >
            Insights desta semana
          </div>
          {INSIGHTS.map((ins, i) => {
            const enter = spring({ frame: frame - (20 + i * 8), fps, config: SPRING_BOUNCY });
            const x = interpolate(enter, [0, 1], [50, 0]);
            const scale = interpolate(enter, [0, 1], [0.8, 1]);
            const hover = 0.98 + 0.02 * Math.sin(frame * 0.08 + i);

            return (
              <div
                key={ins.text}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  background: "rgba(245, 240, 225, 0.06)",
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 12,
                  opacity: enter,
                  transform: `translateX(${x}px) scale(${scale * hover})`,
                }}
              >
                <span style={{ fontSize: 32 }}>{ins.icon}</span>
                <span
                  style={{
                    fontFamily: FONT.body,
                    fontSize: 22,
                    color: COLORS.foreground,
                    lineHeight: 1.4,
                  }}
                >
                  {ins.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Scene>
  );
};

const Bubble: React.FC<{ who: "user" | "ai"; children: React.ReactNode; frame: number; delay: number }> = ({
  who,
  children,
  frame,
  delay,
}) => {
  const isUser = who === "user";
  const progress = Math.min(1, Math.max(0, (frame - delay) / 5));
  const scale = 0.85 + 0.15 * progress;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
        opacity: progress,
        transform: `scale(${scale}) translateY(${(1 - progress) * 10}px)`,
        transformOrigin: isUser ? "right bottom" : "left bottom",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "14px 20px",
          borderRadius: 16,
          background: isUser ? COLORS.emerald : COLORS.bg,
          color: isUser ? "#06120a" : COLORS.foreground,
          border: isUser ? "none" : `1px solid ${COLORS.cardBorder}`,
          fontFamily: FONT.body,
          fontSize: 20,
          lineHeight: 1.45,
        }}
      >
        {children}
      </div>
    </div>
  );
};
