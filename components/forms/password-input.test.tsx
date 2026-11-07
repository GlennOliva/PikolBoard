// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordInput } from "./password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("keeps the password hidden by default and exposes password autofill hints", () => {
    render(<PasswordInput id="password" name="password" label="Password" required />);

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(input.type).toBe("password");
    expect(input.name).toBe("password");
    expect(input.autocomplete).toBe("current-password");
    expect(input.required).toBe(true);
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows and hides the same value without submitting the form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput
          id="password"
          defaultValue="forehand-slice"
          label="Password"
        />
      </form>,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    expect(input.value).toBe("forehand-slice");
    expect(
      screen.getByRole("button", { name: "Hide password" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
    expect(input.value).toBe("forehand-slice");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is keyboard focusable and supports disabled and error states", () => {
    const { rerender } = render(
      <PasswordInput id="password" label="Password" />,
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.tabIndex).toBe(0);

    rerender(
      <PasswordInput
        id="password"
        label="Password"
        error="Password is required."
        disabled
      />,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("password-error");
    expect(screen.getByRole("alert").textContent).toBe("Password is required.");
    expect(
      (screen.getByRole("button", { name: "Show password" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
