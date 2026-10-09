import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl, siteUrl } from "./product-config";

const KEYS = ["NEXT_PUBLIC_APP_URL", "VERCEL_URL"] as const;

/**
 * siteUrl reads process.env at call time, so each case sets the keys it cares
 * about and the cleanup below restores whatever the developer had locally.
 */
const original = new Map<string, string | undefined>(
  KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const [key, value] of original) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://board.example.com";
    process.env.VERCEL_URL = "pickleboard-abc.vercel.app";

    expect(siteUrl()).toBe("https://board.example.com");
  });

  it("falls back to the Vercel deployment url", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = "pickleboard-abc.vercel.app";

    expect(siteUrl()).toBe("https://pickleboard-abc.vercel.app");
  });

  it("falls back to localhost when nothing is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;

    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("trims a trailing slash so joined paths do not double up", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://board.example.com///";

    expect(siteUrl()).toBe("https://board.example.com");
    expect(absoluteUrl("/s/abc")).toBe("https://board.example.com/s/abc");
  });
});

describe("absoluteUrl", () => {
  it("returns an absolute url for a rooted path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://board.example.com";

    expect(absoluteUrl("/s/abc")).toBe("https://board.example.com/s/abc");
  });

  it("adds the missing leading slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://board.example.com";

    expect(absoluteUrl("c/harbour")).toBe("https://board.example.com/c/harbour");
  });

  // A QR code encoding "/s/abc" scans to nothing usable, which is the whole
  // reason this helper exists.
  it("never returns a relative url", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;

    expect(absoluteUrl("/s/abc")).toBe("http://localhost:3000/s/abc");
  });
});