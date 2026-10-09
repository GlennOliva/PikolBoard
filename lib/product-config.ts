/**
 * Single source of truth for product identity.
 *
 * SOP requirement: the product name must be easy to change from one
 * configuration file. Change `name`, `tagline`, `shortName` here and the
 * landing page, nav, metadata, share dialog, and public pages follow.
 */

export const productConfig = {
  name: "PickleBoard",
  shortName: "PickleBoard",
  tagline: "Open-play queues, live courts, and honest leaderboards",
  description:
    "PickleBoard runs open-play pickleball: check players in, let the matchmaker build fair games, track every score, and share a live court view with a link or QR code.",
  organization: "PickleBoard",
  twitter: "@pickleboard",
  /** Minimum comfortable touch target, in pixels. */
  touchTargetPx: 44,
} as const;

export type ProductConfig = typeof productConfig;

/**
 * Absolute origin for links that leave the page: share links, QR codes, and
 * Open Graph metadata. A QR code encoding a relative path is useless to whoever
 * scans it, so this must never return a bare path.
 *
 * Resolution order: NEXT_PUBLIC_APP_URL, then the Vercel deployment URL, then
 * localhost for development. The trailing slash is trimmed so joining a path
 * does not produce a double slash.
 */
export function siteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  const origin = (configured ?? "http://localhost:3000").trim().replace(
    /\/+$/,
    "",
  );

  return origin;
}

/** Absolute URL for an app-relative path such as `/s/{id}`. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}