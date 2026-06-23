import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { Scene } from "../components/Scene";
import { BrowserWindow } from "../components/BrowserWindow";
import { Badge } from "../components/Badge";
import { COLORS, SPRING, SCENE_FRAMES } from "../theme";
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

  const browser = spring({ frame: frame - 3, fps, config: SPRING });
  const headerOpacity = interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgePulse = 0.85 + 0.15 * Math.abs(Math.sin(frame / 12));
  const floatBadge = spring({ frame: frame - 70, fps, config: SPRING });

  return (
    <Scene durationInFrames={SCENE_FRAMES.onboarding}>
      <div style={{ position: "relative", transform: `scale(${0.9 + browser * 0.1})` }}>
        <BrowserWindow url="endurance.app/dashboard" width={800}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: headerOpacity }}>
            <span style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 26, color: COLORS.foreground }}>
              Mercadinho do Zé
            </span>
            <Badge style={{ opacity: badgePulse }}>✓ Configurado por IA</Badge>
          </div>

          {/* Grade de módulos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 26 }}>
            {MODULES.map((m, i) => {
              const enter = spring({ frame: frame - (15 + i * 10), fps, config: SPRING });
              const fromLeft = i % 2 === 0;
              const x = interpolate(enter, [0, 1], [fromLeft ? -30 : 30, 0]);
              return (
                <div
                  key={m.name}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.cardBorder}`,
                    borderRadius: 12,
                    padding: 18,
                    opacity: enter,
                    transform: `translateX(${x}px)`,
                  }}
                >
                  <div style={{ fontSize: 28 }}>{m.icon}</div>
                  <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 16, color: COLORS.foreground, marginTop: 8 }}>
                    {m.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.emerald }} />
                    <span style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.emeraldBright }}>Ativo</span>
                  </div>
                </div>
              );
            })}
          </div>
        </BrowserWindow>

        {/* Badge flutuante */}
        <div
          style={{
            position: "absolute",
            top: -18,
            right: -40,
            transform: `scale(${interpolate(floatBadge, [0, 1], [0.5, 1])})`,
            opacity: floatBadge,
          }}
        >
          <Badge style={{ fontSize: 15, padding: "10px 18px", boxShadow: `0 8px 30px ${COLORS.emeraldGlow}` }}>
            6 módulos · 0 configurações manuais
          </Badge>
        </div>
      </div>
    </Scene>
  );
};
