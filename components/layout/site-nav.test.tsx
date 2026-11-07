// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteNav } from "./site-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/protected",
}));

afterEach(cleanup);

describe("SiteNav", () => {
  it("opens an accessible mobile menu and marks the current page", () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign up" })).toBeTruthy();
  });

  it("closes from the keyboard and returns to the compact state", () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeTruthy();
  });
});
