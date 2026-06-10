import { encodeCode128, barcodeBars } from "@/lib/endurance/barcode";

/**
 * Renderiza um código de barras Code128 como SVG. Componente puro (sem hooks),
 * então funciona tanto em Server Components quanto em Client Components.
 */
export default function BarcodeSvg({
  value,
  moduleWidth = 2,
  height = 56,
  showValue = true,
}: {
  value: string;
  moduleWidth?: number;
  height?: number;
  showValue?: boolean;
}) {
  if (!value) return null;
  const { rects, width } = barcodeBars(encodeCode128(value), moduleWidth, height);
  const textH = showValue ? 16 : 0;
  return (
    <svg
      viewBox={`0 0 ${width} ${height + textH}`}
      width={width}
      height={height + textH}
      className="max-w-full"
      role="img"
      aria-label={`Código de barras ${value}`}
    >
      <rect x={0} y={0} width={width} height={height + textH} fill="#ffffff" />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={height} fill="#111111" />
      ))}
      {showValue && (
        <text
          x={width / 2}
          y={height + 13}
          textAnchor="middle"
          fontSize="13"
          fontFamily="monospace"
          letterSpacing="2"
          fill="#111111"
        >
          {value}
        </text>
      )}
    </svg>
  );
}
