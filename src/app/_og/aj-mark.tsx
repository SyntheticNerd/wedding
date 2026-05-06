/**
 * AJ monogram element shared by icon.tsx, apple-icon.tsx, and
 * opengraph-image.tsx — all three render via next/og's ImageResponse.
 *
 * Satori (the engine behind ImageResponse) has no support for
 * -webkit-text-stroke, so the "bold J" effect from the chosen B4 design
 * is emulated by stacking the J glyph at small offsets.
 */
const STROKE_OFFSETS = [
  { left: -2, top: 0 },
  { left: 2, top: 0 },
  { left: 0, top: -2 },
  { left: 0, top: 2 },
  { left: -1.4, top: -1.4 },
  { left: 1.4, top: -1.4 },
  { left: -1.4, top: 1.4 },
  { left: 1.4, top: 1.4 },
  { left: 0, top: 0 },
];

interface AjMarkProps {
  /** Pixel font-size for the mark (drives all proportions). */
  fontSize: number;
  /** Stroke offset scale — bigger marks need bigger offsets to look bold. */
  strokeScale?: number;
  /** Override colors (defaults to charcoal A on cream, blush J). */
  charcoal?: string;
  blush?: string;
}

export function AjMark({
  fontSize,
  strokeScale = 1,
  charcoal = "#2E2A26",
  blush = "#B5614F",
}: AjMarkProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: "Ephesis",
        fontSize,
        lineHeight: 1,
      }}
    >
      <span style={{ color: charcoal }}>A</span>
      <div
        style={{
          marginLeft: `-${0.32 * fontSize}px`,
          position: "relative",
          width: `${0.5 * fontSize}px`,
          height: `${fontSize}px`,
          display: "flex",
        }}
      >
        {STROKE_OFFSETS.map((offset, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: offset.left * strokeScale,
              top: offset.top * strokeScale,
              color: blush,
            }}
          >
            J
          </span>
        ))}
      </div>
    </div>
  );
}
