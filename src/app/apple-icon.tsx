import { ImageResponse } from "next/og";
import { AjMark } from "./_og/aj-mark";
import { loadGoogleFont } from "./_og/load-font";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
        }}
      >
        <AjMark fontSize={170} strokeScale={1.4} />
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
