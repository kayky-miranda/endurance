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
  { icon: "📄", name: "Fiscal" },
  { icon: "👥", name: "CRM" },
  { icon: "🔐", name: "Equipe" },
];

export const V5Onboarding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const browserSlide = spring({ frame: frame - 2, fps, config: SPRING_SNAPPY });
  const browserY = interpolate(browserSlide, [0, 1], [80, 0]);

  const headerReveal = spring({ frame: frame - 6, fps, config: SPRING });
  const floatBadge = spring({ frame: frame - 55, fps, config: SPRING_BOUNCY });
  const badgeFloat = Math.sin(frame * 0.08) * 6;

  const moduleCount = frame >= 55
    ? Math.min(6, Math.round(interpolate(frame, [55, 72], [0, 6], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })))
    : 0;

  return (
    <Scene durationInFrames={SCENE_FRAMES.onboarding}>
      <div style={{ position: "relative", transform: `translateY(${browserY}px)`, opacity: browserSlide }}>
        <BrowserWindow url="endurance.app/dashboard" width={920}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              opacity: headerReveal,
              transform: `translateX(${interpolate(headerReveal, [0, 1], [-20, 0])}px)`,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 36, color: COLORS.foreground }}>
              Mercadinho do Zé
            </span>
            <Badge style={{ fontSize: 18, padding: "8px 14px" }}>✓ Configurado por IA</Badge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18, marginTop: 32 }}>
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
                    borderRadius: 16,
                    padding: 28,
                    transform: `scale(${scale * hover})`,
                    opacity: pop,
                  }}
                >
                  <div style={{ fontSize: 48 }}>{m.icon}</div>
                  <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 26, color: COLORS.foreground, marginTop: 12 }}>
                    {m.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: COLORS.emerald,
                        boxShadow: `0 0 8px ${COLORS.emerald}`,
                      }}
                    />
                    <span style={{ fontFamily: FONT.body, fontSize: 18, color: COLORS.emeraldBright }}>
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
            top: -30,
            right: -20,
            transform: `scale(${interpolate(floatBadge, [0, 1], [0.3, 1])}) translateY(${badgeFloat}px)`,
            opacity: floatBadge,
          }}
        >
          <Badge
            style={{
              fontSize: 22,
              padding: "14px 22px",
              boxShadow: `0 8px 30px ${COLORS.emeraldGlow}`,
            }}
          >
            {moduleCount} módulos · 0 configs
          </Badge>
        </div>
      </div>
    </Scene>
  );
};
