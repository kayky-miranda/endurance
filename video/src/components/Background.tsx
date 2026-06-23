import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

/**
 * Fundo padrão: ardósia escura + grade sutil + dois blobs radiais
 * (esmeralda no topo-direito, azul embaixo-esquerda) = identidade Endurance.
 */
export const Background: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Grade sutil */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(to right, ${COLORS.gridLine} 1px, transparent 1px),
            linear-gradient(to bottom, ${COLORS.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Blob esmeralda (topo-direito) */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -150,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(16,185,129,0.08), transparent 70%)`,
          filter: "blur(60px)",
        }}
      />
      {/* Blob azul (baixo-esquerda) */}
      <div
        style={{
          position: "absolute",
          bottom: -180,
          left: -150,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
    </AbsoluteFill>
  );
};
