import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { BrowserWindow } from "../components/BrowserWindow";
import { Badge } from "../components/Badge";
import { COLORS, SPRING, SPRING_SNAPPY, SPRING_BOUNCY, SCENE_FRAMES } from "../theme";
import { FONT } from "../fonts";

const MODULES = [
  { icon: "🧾", name: "PDV" },
  { icon: "📦", name: "Estoque" },
  { icon: "📊", name: "Financeiro" },
  { icon: "📄", name: "Fiscal / NFC-e" },
  { icon: "👥", name: "Clientes CRM" },
  { icon: "🔐", name: "Equipe" },
];

export const Scene5Onboarding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const browserSlide = spring({ frame: frame - 2, fps, config: SPRING_SNAPPY });
  const browserY = interpolate(browserSlide, [0, 1], [60, 0]);

  const headerReveal = spring({ frame: frame - 6, fps, config: SPRING });

  const floatBadge = spring({ frame: frame - 55, fps, config: SPRING_BOUNCY });
  const badgeFloat = Math.sin(frame * 0.08) * 5;

  const moduleCount = frame >= 55
    ? Math.min(6, Math.round(interpolate(frame, [55, 72], [0, 6], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })))
    : 0;

  return (
    <Scene durationInFrames={SCENE_FRAMES.onboarding}>
      <div
        style={{
          position: "relative",
          transform: `translateY(${browserY}px)`,
          opacity: browserSlide,
        }}
      >
        <BrowserWindow url="endurance.app/dashboard" width={800}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: headerReveal,
              transform: `translateX(${interpolate(headerReveal, [0, 1], [-20, 0])}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT.body,
                fontWeight: 700,
                fontSize: 26,
                color: COLORS.foreground,
              }}
            >
              Mercadinho do Zé
            </span>
            <Badge>✓ Configurado por IA</Badge>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              marginTop: 26,
            }}
          >
            {MODULES.map((m, i) => {
              const pop = spring({ frame: frame - (10 + i * 5), fps, config: SPRING_BOUNCY });
              const scale = interpolate(pop, [0, 1], [0.3, 1]);
              const hover = 0.98 + 0.02 * Math.sin(frame * 0.1 + i * 1.5);

              return (
                <div
                  key={m.name}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.cardBorder}`,
                    borderRadius: 12,
                    padding: 18,
                    transform: `scale(${scale * hover})`,
                    opacity: pop,
                  }}
                >
                  <div style={{ fontSize: 28 }}>{m.icon}</div>
                  <div
                    style={{
                      fontFamily: FONT.body,
                      fontWeight: 600,
                      fontSize: 16,
                      color: COLORS.foreground,
                      marginTop: 8,
                    }}
                  >
                    {m.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.emerald,
                        boxShadow: `0 0 6px ${COLORS.emerald}`,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: FONT.body,
                        fontSize: 13,
                        color: COLORS.emeraldBright,
                      }}
                    >
                      Ativo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </BrowserWindow>

        <div
          style={{
            position: "absolute",
            top: -18,
            right: -40,
            transform: `scale(${interpolate(floatBadge, [0, 1], [0.3, 1])}) translateY(${badgeFloat}px)`,
            opacity: floatBadge,
          }}
        >
          <Badge
            style={{
              fontSize: 15,
              padding: "10px 18px",
              boxShadow: `0 8px 30px ${COLORS.emeraldGlow}`,
            }}
          >
            {moduleCount} módulos · 0 configurações manuais
          </Badge>
        </div>
      </div>
    </Scene>
  );
};
