import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Typewriter } from "../components/Typewriter";
import { COLORS, SPRING, SPRING_SNAPPY, SPRING_BOUNCY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const INSIGHTS = [
  { icon: "📈", text: "Vendas 12% acima da semana passada" },
  { icon: "⚠️", text: "3 clientes sem compra há 30 dias" },
  { icon: "💡", text: "Feijão com margem abaixo do ideal" },
];

export const Scene7IA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const layoutReveal = spring({ frame: frame - 1, fps, config: SPRING_SNAPPY });

  return (
    <Scene durationInFrames={SCENE_FRAMES.ia}>
      <div
        style={{
          display: "flex",
          gap: 40,
          alignItems: "flex-start",
          opacity: layoutReveal,
          transform: `translateY(${interpolate(layoutReveal, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            width: 420,
            background: COLORS.card,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 14,
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            padding: 24,
          }}
        >
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 600,
              fontSize: 16,
              color: COLORS.emeraldBright,
              marginBottom: 16,
            }}
          >
            Assistente ENDURANCE
          </div>

          <ChatBubble who="user" frame={frame} delay={4}>
            Qual produto teve mais saída essa semana?
          </ChatBubble>
          <ChatBubble who="ai" frame={frame} delay={10}>
            <Typewriter
              text="Arroz 5kg liderou com 47 unidades vendidas. Seu estoque atual é de 12 unidades — reposição recomendada para quinta-feira."
              start={14}
              end={50}
            />
          </ChatBubble>

          {frame >= 56 && (
            <ChatBubble who="user" frame={frame} delay={56}>
              E a margem dele?
            </ChatBubble>
          )}
          {frame >= 62 && (
            <ChatBubble who="ai" frame={frame} delay={62}>
              <Typewriter
                text="Margem atual: 18%. Concorrentes na região praticam 22–25%. Você pode aumentar em R$2,00 sem perder competitividade."
                start={66}
                end={100}
              />
            </ChatBubble>
          )}
        </div>

        <div style={{ width: 420 }}>
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 700,
              fontSize: 18,
              color: COLORS.foreground,
              marginBottom: 16,
            }}
          >
            Insights desta semana
          </div>
          {INSIGHTS.map((ins, i) => {
            const enter = spring({ frame: frame - (20 + i * 8), fps, config: SPRING_BOUNCY });
            const x = interpolate(enter, [0, 1], [40, 0]);
            const scale = interpolate(enter, [0, 1], [0.8, 1]);
            const hover = 0.98 + 0.02 * Math.sin(frame * 0.08 + i);

            return (
              <div
                key={ins.text}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  background: "rgba(245, 240, 225, 0.06)",
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 10,
                  opacity: enter,
                  transform: `translateX(${x}px) scale(${scale * hover})`,
                }}
              >
                <span style={{ fontSize: 22 }}>{ins.icon}</span>
                <span
                  style={{
                    fontFamily: FONT.body,
                    fontSize: 15,
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

const ChatBubble: React.FC<{
  who: "user" | "ai";
  children: React.ReactNode;
  frame: number;
  delay: number;
}> = ({ who, children, frame, delay }) => {
  const isUser = who === "user";
  const progress = Math.min(1, Math.max(0, (frame - delay) / 5));
  const scale = 0.85 + 0.15 * progress;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
        opacity: progress,
        transform: `scale(${scale}) translateY(${(1 - progress) * 8}px)`,
        transformOrigin: isUser ? "right bottom" : "left bottom",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 14px",
          borderRadius: 12,
          background: isUser ? COLORS.emerald : COLORS.bg,
          color: isUser ? "#06120a" : COLORS.foreground,
          border: isUser ? "none" : `1px solid ${COLORS.cardBorder}`,
          fontFamily: FONT.body,
          fontSize: 14,
          lineHeight: 1.45,
        }}
      >
        {children}
      </div>
    </div>
  );
};
