import { describe, expect, it, vi } from "vitest";

import ClubsIndexPage from "@/app/clubs/page";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("/clubs compatibility route", () => {
  it("redirects the legacy index to the authenticated dashboard", () => {
    expect(() => ClubsIndexPage()).toThrow("NEXT_REDIRECT:/protected");
    expect(redirectMock).toHaveBeenCalledWith("/protected");
  });
});
