import { useCurrentFrame, interpolate } from "remotion";

/**
 * Efeito typewriter: digita `text` entre os frames `start` e `end`.
 * Cursor piscante (|) some ao completar.
 */
export const Typewriter: React.FC<{
  text: string;
  start: number;
  end: number;
  style?: React.CSSProperties;
}> = ({ text, start, end, style }) => {
  const frame = useCurrentFrame();
  const count = Math.floor(
    interpolate(frame, [start, end], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const done = count >= text.length;
  const showCursor = !done && Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={style}>
      {text.slice(0, count)}
      {!done && (
        <span style={{ opacity: showCursor ? 1 : 0 }}>|</span>
      )}
    </span>
  );
};
