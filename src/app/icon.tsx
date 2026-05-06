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
        }}
      >
        <AjMark fontSize={64} strokeScale={0.6} />
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
