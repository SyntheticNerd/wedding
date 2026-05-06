/**
 * Fetches a Google Font as a TTF ArrayBuffer for use with next/og's
 * ImageResponse. The fake User-Agent forces the CSS API to serve TTF/OTF
 * URLs instead of WOFF2 (which Satori cannot consume).
 */
export async function loadGoogleFont(
  family: string,
  weight: number = 400,
): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(
    / /g,
    "+",
  )}:wght@${weight}&display=swap`;
  const css = await fetch(cssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.4 (KHTML, like Gecko) Chrome/22.0.1229.94 Safari/537.4",
    },
  }).then((r) => r.text());

  const match = css.match(/src:\s*url\((https:[^)]+)\)/);
  if (!match) {
    throw new Error(`Could not resolve font URL for ${family}`);
  }
  const fontResp = await fetch(match[1]);
  if (!fontResp.ok) {
    throw new Error(`Failed to download font ${family}: ${fontResp.status}`);
  }
  return fontResp.arrayBuffer();
}
