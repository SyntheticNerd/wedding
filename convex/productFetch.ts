"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { parse, type HTMLElement } from "node-html-parser";

const TIMEOUT_MS = 8000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export type FetchOgResult =
  | {
      ok: true;
      fields: {
        title?: string;
        imageUrl?: string;
        priceCents?: number;
      };
      ogTitle?: string;
      ogImageUrl?: string;
    }
  | { ok: false; reason: "network" | "blocked" | "metadata_missing" };

export const fetchOg = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<FetchOgResult> => {
    await requireAdmin(ctx);

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(args.url, {
          headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
          signal: controller.signal,
          redirect: "follow",
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return { ok: false, reason: "network" };
    }

    if (response.status === 403 || response.status === 503) {
      return { ok: false, reason: "blocked" };
    }
    if (!response.ok) {
      return { ok: false, reason: "network" };
    }

    const html = await response.text();
    const parsed = parseProductMetadata(html, args.url);
    if (
      parsed.title === undefined &&
      parsed.imageUrl === undefined &&
      parsed.priceCents === undefined
    ) {
      return { ok: false, reason: "metadata_missing" };
    }
    return {
      ok: true,
      fields: parsed,
      ogTitle: parsed.title,
      ogImageUrl: parsed.imageUrl,
    };
  },
});

/* ----------------------------------------------------------------------
   Pure parser (exported for verification)
   -------------------------------------------------------------------- */

export function parseProductMetadata(
  html: string,
  baseUrl: string,
): { title?: string; imageUrl?: string; priceCents?: number } {
  const root = parse(html);

  const fromJsonLd = readJsonLdProduct(root);
  const fromOg = readOpenGraph(root);
  const fromMicrodata = readMicrodata(root);

  const title =
    fromJsonLd.title ?? fromOg.title ?? fromMicrodata.title;
  const imageUrlRaw =
    fromJsonLd.imageUrl ?? fromOg.imageUrl ?? fromMicrodata.imageUrl;
  const priceCents =
    fromJsonLd.priceCents ?? fromOg.priceCents ?? fromMicrodata.priceCents;

  const imageUrl = imageUrlRaw ? toAbsoluteUrl(imageUrlRaw, baseUrl) : undefined;

  return { title, imageUrl, priceCents };
}

type ParsedFields = { title?: string; imageUrl?: string; priceCents?: number };

function readJsonLdProduct(root: HTMLElement): ParsedFields {
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(s.text);
    } catch {
      continue;
    }
    const product = findProductNode(data);
    if (!product) continue;

    const title =
      typeof product.name === "string" ? product.name : undefined;

    let imageUrl: string | undefined;
    if (typeof product.image === "string") imageUrl = product.image;
    else if (Array.isArray(product.image) && typeof product.image[0] === "string") {
      imageUrl = product.image[0];
    } else if (
      product.image &&
      typeof product.image === "object" &&
      "url" in product.image &&
      typeof product.image.url === "string"
    ) {
      imageUrl = product.image.url;
    }

    let priceCents: number | undefined;
    const offers = product.offers;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer && typeof offer === "object") {
      const p = (offer as Record<string, unknown>).price;
      const dollars =
        typeof p === "number" ? p : typeof p === "string" ? Number(p) : NaN;
      if (Number.isFinite(dollars) && dollars >= 0) {
        priceCents = Math.round(dollars * 100);
      }
    }

    if (title || imageUrl || priceCents !== undefined) {
      return { title, imageUrl, priceCents };
    }
  }
  return {};
}

function findProductNode(
  data: unknown,
): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const type = obj["@type"];
  const isProduct =
    type === "Product" ||
    (Array.isArray(type) && type.includes("Product"));
  if (isProduct) return obj;
  if (obj["@graph"]) return findProductNode(obj["@graph"]);
  return null;
}

function readOpenGraph(root: HTMLElement): ParsedFields {
  function meta(prop: string): string | undefined {
    const node = root.querySelector(`meta[property="${prop}"]`);
    return node?.getAttribute("content") ?? undefined;
  }
  const title = meta("og:title");
  const imageUrl = meta("og:image");
  const priceStr =
    meta("og:price:amount") ?? meta("product:price:amount");
  let priceCents: number | undefined;
  if (priceStr) {
    const dollars = Number(priceStr);
    if (Number.isFinite(dollars) && dollars >= 0) {
      priceCents = Math.round(dollars * 100);
    }
  }
  return { title, imageUrl, priceCents };
}

function readMicrodata(root: HTMLElement): ParsedFields {
  const product = root.querySelector('[itemtype$="schema.org/Product"]');
  if (!product) return {};
  const name = product.querySelector('[itemprop="name"]')?.text?.trim();
  const image =
    product.querySelector('[itemprop="image"]')?.getAttribute("src") ??
    undefined;
  const priceStr =
    product
      .querySelector('[itemprop="price"]')
      ?.getAttribute("content") ??
    product.querySelector('[itemprop="price"]')?.text?.trim();
  let priceCents: number | undefined;
  if (priceStr) {
    const dollars = Number(String(priceStr).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(dollars) && dollars >= 0) {
      priceCents = Math.round(dollars * 100);
    }
  }
  return {
    title: name || undefined,
    imageUrl: image,
    priceCents,
  };
}

function toAbsoluteUrl(possiblyRelative: string, baseUrl: string): string {
  try {
    return new URL(possiblyRelative, baseUrl).toString();
  } catch {
    return possiblyRelative;
  }
}
