// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
    push: mocks.push,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "player@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-horse" },
  });

  const form = screen.getByRole("button", { name: "Sign in" }).closest("form");
  if (!form) throw new Error("Login form not found");
  fireEvent.submit(form);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.signInWithPassword.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("LoginForm", () => {
  it("starts clean with the expected autofill and password controls", () => {
    localStorage.setItem("email", "previous-user@example.com");
    render(<LoginForm />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: "Sign in" });

    expect(email.value).toBe("");
    expect(email.name).toBe("email");
    expect(email.autocomplete).toBe("email");
    expect(password.type).toBe("password");
    expect(password.name).toBe("password");
    expect(password.autocomplete).toBe("current-password");
    expect(submit.getAttribute("type")).toBe("submit");
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("redirects to /protected only after a successful sign-in", async () => {
    render(<LoginForm />);

    const form = submitLogin();
    expect(mocks.replace).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/protected");
    });

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "correct-horse",
    });
    expect(
      mocks.signInWithPassword.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.replace.mock.invocationCallOrder[0]);
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
      "",
    );
    expect(localStorage.length).toBe(0);
    expect(form).toBeTruthy();
  });

  it("keeps invalid credentials on the login page with a safe message", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      },
    });

    render(<LoginForm />);
    submitLogin();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Email or password is incorrect. Please try again.",
    );
    expect(alert.textContent).not.toContain("Invalid login credentials");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("never exposes raw auth errors for other failures", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: {
        code: "unexpected_failure",
        message: "Database error saving new user",
      },
    });

    render(<LoginForm />);
    submitLogin();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "We could not sign you in right now. Please try again.",
    );
    expect(alert.textContent).not.toContain("Database error");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while the request is pending", async () => {
    let resolveRequest!: (value: { error: null }) => void;
    mocks.signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<LoginForm />);
    const form = submitLogin();

    const pendingButton = screen.getByRole("button", {
      name: "Signing in…",
    }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);

    fireEvent.submit(form);
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();

    resolveRequest({ error: null });
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/protected");
    });
  });

  it("ignores external redirect parameters and always targets /protected", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/login?next=https%3A%2F%2Fevil.example",
    );

    render(<LoginForm />);
    submitLogin();

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/protected");
    });
    expect(mocks.replace).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example"),
    );
  });
});
