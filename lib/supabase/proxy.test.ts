import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("public route gating", () => {
  it("opens the canonical Live Board without authentication", () => {
    expect(
      isPublicPath("/live/550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
  });

  it("keeps the organizer dashboard private", () => {
    expect(isPublicPath("/sessions/10000000-0000-4000-8000-000000000001")).toBe(false);
    expect(isPublicPath("/clubs/20000000-0000-4000-8000-000000000001")).toBe(false);
  });
});
