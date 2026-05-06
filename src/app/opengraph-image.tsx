import { ImageResponse } from "next/og";
import { COUPLE, WEDDING } from "@/lib/site-config";
import { AjMark } from "./_og/aj-mark";
import { loadGoogleFont } from "./_og/load-font";

export const alt = `${COUPLE.groom} ${COUPLE.joiner} ${COUPLE.bride}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [ephesis, cormorant, cormorantItalic, inter] = await Promise.all([
    loadGoogleFont("Ephesis"),
    loadGoogleFont("Cormorant Garamond", 500),
    loadEphesisItalic(),
    loadGoogleFont("Inter", 500),
  ]);

  const subtitleParts = [
    WEDDING.dateISO,
    WEDDING.location && WEDDING.location !== "TBD" ? WEDDING.location : null,
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FAF6F1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AjMark fontSize={420} strokeScale={3.4} />
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: "Cormorant",
            fontSize: 64,
            color: "#2E2A26",
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "baseline",
            gap: 18,
          }}
        >
          <span>{COUPLE.groom}</span>
          <span style={{ fontFamily: "CormorantItalic", color: "#B5614F" }}>
            {COUPLE.joiner}
          </span>
          <span>{COUPLE.bride}</span>
        </div>
        {subtitleParts.length > 0 && (
          <div
            style={{
              marginTop: 28,
              fontFamily: "Inter",
              fontSize: 22,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#8A827A",
              display: "flex",
            }}
          >
            {subtitleParts.join(" · ")}
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Ephesis", data: ephesis, weight: 400, style: "normal" },
        { name: "Cormorant", data: cormorant, weight: 500, style: "normal" },
        {
          name: "CormorantItalic",
          data: cormorantItalic,
          weight: 500,
          style: "italic",
        },
        { name: "Inter", data: inter, weight: 500, style: "normal" },
      ],
    },
  );
}

async function loadEphesisItalic(): Promise<ArrayBuffer> {
  // Cormorant Garamond italic via the same TTF-forcing UA trick.
  const cssUrl =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&display=swap";
  const css = await fetch(cssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.4 (KHTML, like Gecko) Chrome/22.0.1229.94 Safari/537.4",
    },
  }).then((r) => r.text());
  const match = css.match(/src:\s*url\((https:[^)]+)\)/);
  if (!match) throw new Error("Could not resolve Cormorant italic URL");
  const r = await fetch(match[1]);
  return r.arrayBuffer();
}
