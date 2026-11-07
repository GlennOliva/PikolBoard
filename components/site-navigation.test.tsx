// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClubTabs } from "@/components/clubs/club-tabs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/clubs/club-1/players",
}));

vi.mock("@/components/layout/site-nav", () => ({
  SiteNav: () => null,
}));

vi.mock("@/components/auth-button", () => ({
  AuthButton: () => null,
}));

vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => null,
}));

afterEach(cleanup);

describe("My clubs navigation", () => {
  it("points desktop header navigation at the dashboard", () => {
    render(<SiteHeader />);

    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    expect(within(navigation).getByRole("link", { name: "My clubs" }).getAttribute("href")).toBe(
      "/protected",
    );
  });

  it("points footer navigation at the dashboard", () => {
    render(<SiteFooter />);

    expect(
      screen.getByRole("link", { name: "My clubs" }).getAttribute("href"),
    ).toBe("/protected");
  });

  it("keeps dynamic club sections on their existing /clubs/[clubId] routes", () => {
    render(<ClubTabs clubId="club-1" canManage />);

    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    ).toBe("/clubs/club-1");
    expect(
      screen.getByRole("link", { name: "Players" }).getAttribute("href"),
    ).toBe("/clubs/club-1/players");
    expect(
      screen.getByRole("link", { name: "Sessions" }).getAttribute("href"),
    ).toBe("/clubs/club-1/sessions");
    expect(
      screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
    ).toBe("/clubs/club-1/settings");
  });
});
