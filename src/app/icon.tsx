import { ImageResponse } from "next/og";
import { AjMark } from "./_og/aj-mark";
import { loadGoogleFont } from "./_og/load-font";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const ephesis = await loadGoogleFont("Ephesis");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF6F1",
          borderRadius: 12,
        }}
      >
        {/* AjMark's tuck overlap pushes total width to ~1.18em, so a 44px
            font keeps the mark inside a 64px canvas with breathing room
            on every side once browsers downscale to 16/32. */}
        <AjMark fontSize={44} strokeScale={0.4} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Ephesis", data: ephesis, weight: 400, style: "normal" },
      ],
    },
  );
}
