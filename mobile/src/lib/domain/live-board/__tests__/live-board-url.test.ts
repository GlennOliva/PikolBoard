import {
  extractPublicTokenFromScan,
  resolveLiveBoardUrl,
  canShowPlayerLiveQr,
} from "@/lib/domain/live-board/live-board-url";

const TOKEN = "3d0f5a2e-1111-4a2b-9c3d-abcdef123456";

describe("extractPublicTokenFromScan", () => {
  it("accepts a bare token", () => {
    expect(extractPublicTokenFromScan(TOKEN)).toBe(TOKEN);
  });

  it("pulls the token out of a full Live Board URL", () => {
    expect(extractPublicTokenFromScan(`https://pickle.example.com/live/${TOKEN}`)).toBe(TOKEN);
  });

  it("ignores query and hash fragments", () => {
    expect(
      extractPublicTokenFromScan(`https://pickle.example.com/live/${TOKEN}?ref=qr#top`),
    ).toBe(TOKEN);
  });

  it("returns null for unrelated content", () => {
    expect(extractPublicTokenFromScan("https://example.com/hello")).toBeNull();
    expect(extractPublicTokenFromScan("")).toBeNull();
  });
});

describe("resolveLiveBoardUrl", () => {
  it("uses a configured non-loopback origin", () => {
    const result = resolveLiveBoardUrl({ appUrl: "https://pickle.example.com", publicToken: TOKEN });
    expect(result.url).toBe(`https://pickle.example.com/live/${TOKEN}`);
    expect(result.isUnreachableFromAnotherDevice).toBe(false);
    expect(result.warning).toBeNull();
  });

  it("flags localhost as unreachable from another device", () => {
    const result = resolveLiveBoardUrl({ appUrl: "http://localhost:3000", publicToken: TOKEN });
    expect(result.isUnreachableFromAnotherDevice).toBe(true);
    expect(result.warning).not.toBeNull();
  });

  it("falls back when no origin is configured", () => {
    const result = resolveLiveBoardUrl({ publicToken: TOKEN });
    expect(result.source).toBe("loopback");
  });
});

describe("canShowPlayerLiveQr", () => {
  it("is false for a draft session", () => {
    expect(canShowPlayerLiveQr({ status: "draft", enabled: true, publicToken: TOKEN })).toBe(false);
  });

  it("is true for a live session with a token", () => {
    expect(canShowPlayerLiveQr({ status: "active", enabled: true, publicToken: TOKEN })).toBe(true);
  });

  it("is false when the token is missing", () => {
    expect(canShowPlayerLiveQr({ status: "active", enabled: true, publicToken: null })).toBe(false);
  });
});
