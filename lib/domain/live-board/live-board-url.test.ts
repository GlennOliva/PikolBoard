import { describe, expect, it } from "vitest";
import {
  canShowPlayerLiveQr,
  isLoopbackOrigin,
  liveBoardPath,
  LOOPBACK_WARNING,
  resolveLiveBoardUrl,
} from "./live-board-url";

describe("organizer QR activation", () => {
  it("does not expose an active QR while the session is draft", () => {
    expect(canShowPlayerLiveQr({ status: "draft", enabled: false, publicToken: null })).toBe(false);
  });

  it("requires the enabled flag and a token before showing a QR", () => {
    expect(canShowPlayerLiveQr({ status: "active", enabled: true, publicToken: base.publicToken })).toBe(true);
    expect(canShowPlayerLiveQr({ status: "active", enabled: true, publicToken: null })).toBe(false);
    expect(canShowPlayerLiveQr({ status: "active", enabled: false, publicToken: base.publicToken })).toBe(false);
  });

  it("keeps the link reachable after the session ends, because the token survives", () => {
    expect(canShowPlayerLiveQr({ status: "completed", enabled: true, publicToken: base.publicToken })).toBe(true);
    expect(canShowPlayerLiveQr({ status: "cancelled", enabled: true, publicToken: base.publicToken })).toBe(false);
  });
});

const base = { publicToken: "550e8400-e29b-41d4-a716-446655440000" };

describe("the encoded URL is always absolute", () => {
  it("returns a full origin plus path, never a bare path", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "https://pickle.example.com",
    });

    expect(result.url).toBe(`https://pickle.example.com/live/${base.publicToken}`);
    expect(() => new URL(result.url)).not.toThrow();
  });

  it("is parseable as a URL on every branch", () => {
    for (const input of [
      { appUrl: "https://pickle.example.com" },
      { appUrl: "http://192.168.1.4:3000" },
      { appUrl: "", browserOrigin: "http://192.168.1.4:3000" },
      { appUrl: undefined, browserOrigin: undefined },
    ]) {
      const { url } = resolveLiveBoardUrl({ ...base, ...input });
      expect(new URL(url).pathname).toBe(`/live/${base.publicToken}`);
      expect(["http:", "https:"]).toContain(new URL(url).protocol);
    }
  });

  it("keeps a non-default port, which LAN addresses depend on", () => {
    const { url } = resolveLiveBoardUrl({ ...base, appUrl: "http://192.168.1.4:3000" });
    expect(new URL(url).port).toBe("3000");
  });

  it("uses the session-specific /live/[token] convention", () => {
    expect(liveBoardPath(base.publicToken)).toBe(`/live/${base.publicToken}`);
  });

  it("puts the secure public token in the QR path", () => {
    const { url } = resolveLiveBoardUrl({ ...base, appUrl: "https://pickle.example.com" });
    expect(url).toContain(base.publicToken);
  });
});

describe("production never encodes localhost", () => {
  it("prefers the configured origin over the browser origin", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "https://pickle.example.com",
      browserOrigin: "http://localhost:3000",
    });

    expect(result.origin).toBe("https://pickle.example.com");
    expect(result.url).not.toContain("localhost");
    expect(result.source).toBe("configured");
  });

  it("falls back to a reachable browser origin when nothing is configured", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: undefined,
      browserOrigin: "https://staging.pickle.example.com",
    });

    expect(result.origin).toBe("https://staging.pickle.example.com");
    expect(result.url).not.toContain("localhost");
  });

  it("ignores a configured localhost and uses the reachable browser origin", () => {
    // A .env.local carrying the default localhost value must not defeat a
    // developer running --hostname 0.0.0.0 and browsing to their LAN address.
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "http://localhost:3000",
      browserOrigin: "http://192.168.1.4:3000",
    });

    expect(result.origin).toBe("http://192.168.1.4:3000");
    expect(result.isUnreachableFromAnotherDevice).toBe(false);
    expect(result.warning).toBeNull();
  });

  it("accepts a LAN origin as the configured value", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "http://192.168.1.4:3000",
      browserOrigin: "http://localhost:3000",
    });

    expect(result.url).toBe(`http://192.168.1.4:3000/live/${base.publicToken}`);
    expect(result.warning).toBeNull();
  });
});

describe("an unusable QR is reported, never returned silently", () => {
  it("warns when everything available is loopback", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "http://localhost:3000",
      browserOrigin: "http://localhost:3000",
    });

    expect(result.isUnreachableFromAnotherDevice).toBe(true);
    expect(result.warning).toBe(LOOPBACK_WARNING);
  });

  it("warns when nothing is configured at all", () => {
    const result = resolveLiveBoardUrl({ ...base });

    expect(result.isUnreachableFromAnotherDevice).toBe(true);
    expect(result.warning).toBe(LOOPBACK_WARNING);
  });

  it("warns on 127.0.0.1, which a phone also cannot reach", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "http://127.0.0.1:3000",
      browserOrigin: "http://127.0.0.1:3000",
    });

    expect(result.isUnreachableFromAnotherDevice).toBe(true);
  });

  it("names the fix in the warning text", () => {
    expect(LOOPBACK_WARNING).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("still returns an absolute URL alongside the warning", () => {
    // The organizer can copy the link and message it by hand, so the URL has to
    // exist even when it is not scannable from another device.
    const result = resolveLiveBoardUrl({ ...base });
    expect(new URL(result.url).pathname).toBe(`/live/${base.publicToken}`);
  });

  it("never returns the 0.0.0.0 bind address, which resolves nowhere", () => {
    for (const input of [
      { appUrl: "http://0.0.0.0:3000", browserOrigin: "http://0.0.0.0:3000" },
      { appUrl: undefined, browserOrigin: "http://0.0.0.0:3000" },
      { appUrl: "http://[::]:3000", browserOrigin: "http://localhost:3000" },
    ]) {
      const result = resolveLiveBoardUrl({ ...base, ...input });
      expect(result.isUnreachableFromAnotherDevice).toBe(true);
      expect(result.url).not.toContain("0.0.0.0");
      expect(new URL(result.url).host).toBe("localhost:3000");
      expect(new URL(result.url).pathname).toBe(`/live/${base.publicToken}`);
    }
  });

  it("falls back to the reachable browser origin when the configured one is a bind address", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "http://0.0.0.0:3000",
      browserOrigin: "http://192.168.1.4:3000",
    });

    expect(result.url).toBe(`http://192.168.1.4:3000/live/${base.publicToken}`);
    expect(result.warning).toBeNull();
  });
});

describe("host classification", () => {
  it.each([
    ["http://localhost:3000", true],
    ["http://127.0.0.1:3000", true],
    ["http://127.1.2.3:3000", true],
    ["http://[::1]:3000", true],
    ["http://0.0.0.0:3000", true],
    ["http://[::]:3000", true],
    ["0.0.0.0", true],
    ["::", true],
    ["http://192.168.1.4:3000", false],
    ["http://10.0.0.7:3000", false],
    ["http://172.20.3.4:3000", false],
    ["https://pickle.example.com", false],
  ])("classifies %s as loopback=%s", (origin, expected) => {
    expect(isLoopbackOrigin(origin)).toBe(expected);
  });
});

describe("hostile input does not produce a bad URL", () => {
  it("rejects a non-http scheme rather than encoding it", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "javascript:alert(1)",
      browserOrigin: "https://pickle.example.com",
    });
    expect(result.origin).toBe("https://pickle.example.com");
  });

  it("ignores a value that is not a URL at all", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "not a url",
      browserOrigin: "https://pickle.example.com",
    });
    expect(result.origin).toBe("https://pickle.example.com");
  });

  it("treats whitespace and empty strings as unset", () => {
    for (const appUrl of ["", "   ", undefined, null]) {
      const result = resolveLiveBoardUrl({
        ...base,
        appUrl,
        browserOrigin: "https://pickle.example.com",
      });
      expect(result.source).toBe("browser");
    }
  });

  it("drops a path from the configured origin instead of duplicating it", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "https://pickle.example.com/",
      browserOrigin: undefined,
    });
    expect(result.url).toBe(`https://pickle.example.com/live/${base.publicToken}`);
  });

  it("never produces a double slash in the path", () => {
    const result = resolveLiveBoardUrl({
      ...base,
      appUrl: "https://pickle.example.com//",
      browserOrigin: undefined,
    });
    expect(result.url).not.toContain("//live/");
  });
});
