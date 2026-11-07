// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthButton } from "./auth-button";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: mocks.getClaims,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("AuthButton", () => {
  it("shows the current user's email and logout control when authenticated", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { email: "player@example.com" } },
    });

    render(await AuthButton());

    expect(screen.getByText("player@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  });

  it("does not render a stale email or logout control when anonymous", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });

    render(await AuthButton());

    expect(screen.queryByText("player@example.com")).toBeNull();
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign up" })).toBeTruthy();
  });
});
