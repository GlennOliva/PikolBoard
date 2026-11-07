// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogoutButton } from "./logout-button";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: mocks.signOut,
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("LogoutButton", () => {
  it("shows a pending state and disables repeat clicks", async () => {
    let resolveSignOut!: (value: { error: null }) => void;
    mocks.signOut.mockReturnValue(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    render(<LogoutButton />);
    const button = screen.getByRole("button", { name: "Log out" });

    fireEvent.click(button);
    fireEvent.click(button);

    const pendingButton = screen.getByRole("button", {
      name: "Signing out…",
    }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    expect(pendingButton.getAttribute("aria-busy")).toBe("true");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();

    resolveSignOut({ error: null });
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/auth/login");
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("clears the session before redirecting to the login page", async () => {
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/auth/login");
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.replace.mock.invocationCallOrder[0],
    );
  });

  it("stays put and shows a safe message when sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({
      error: { message: "Auth session missing!" },
    });

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "We could not sign you out. Please try again.",
    );
    expect(alert.textContent).not.toContain("Auth session missing");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Log out" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("handles a thrown sign-out failure without navigating", async () => {
    mocks.signOut.mockRejectedValue(new Error("network down"));

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We could not sign you out. Please try again.",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
