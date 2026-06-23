import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { Typewriter } from "../components/Typewriter";
import { COLORS, SPRING, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const INSIGHTS = [
  { icon: "📈", text: "Vendas 12% acima da semana passada" },
  { icon: "⚠️", text: "3 clientes sem compra há 30 dias — sugestão de campanha disponível" },
  { icon: "💡", text: "Feijão com margem abaixo do ideal — revise o preço" },
];

export const Scene7IA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Scene durationInFrames={SCENE_FRAMES.ia}>
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {/* Esquerda: chat */}
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
          <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 16, color: COLORS.emeraldBright, marginBottom: 16 }}>
            Assistente Endurance
          </div>

          <ChatBubble who="user">Qual produto teve mais saída essa semana?</ChatBubble>
          <ChatBubble who="ai">
            <Typewriter
              text="Arroz 5kg liderou com 47 unidades vendidas. Seu estoque atual é de 12 unidades — reposição recomendada para quinta-feira."
              start={20}
              end={60}
            />
          </ChatBubble>

          {frame >= 66 && (
            <ChatBubble who="user">E a margem dele?</ChatBubble>
          )}
          {frame >= 70 && (
            <ChatBubble who="ai">
              <Typewriter
                text="Margem atual: 18%. Concorrentes na região praticam 22–25%. Você pode aumentar em R$2,00 sem perder competitividade."
                start={70}
                end={110}
              />
            </ChatBubble>
          )}
        </div>

        {/* Direita: relatórios */}
        <div style={{ width: 420 }}>
          <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 18, color: COLORS.foreground, marginBottom: 16 }}>
            Insights desta semana
          </div>
          {INSIGHTS.map((ins, i) => {
            const enter = spring({ frame: frame - (25 + i * 15), fps, config: SPRING });
            const x = interpolate(enter, [0, 1], [30, 0]);
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
                  transform: `translateX(${x}px)`,
                }}
              >
                <span style={{ fontSize: 22 }}>{ins.icon}</span>
                <span style={{ fontFamily: FONT.body, fontSize: 15, color: COLORS.foreground, lineHeight: 1.4 }}>
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

const ChatBubble: React.FC<{ who: "user" | "ai"; children: React.ReactNode }> = ({ who, children }) => {
  const isUser = who === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
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
