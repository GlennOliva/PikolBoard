// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PikolgoLogo } from "./pikolgo-logo";

afterEach(cleanup);

describe("PikolgoLogo", () => {
  it("renders the supplied wordmark with an accessible name and source dimensions", () => {
    render(<PikolgoLogo />);
    const image = screen.getByRole("img", { name: "PikolGo" });

    expect(image.getAttribute("width")).toBe("2172");
    expect(image.getAttribute("height")).toBe("724");
    expect(image.getAttribute("src")).toContain("pikolgo_logo");
    expect(image.parentElement?.className).toContain("retro-logo-plate");
  });

  it("can sit on a light surface without the dark-mode brand plate", () => {
    render(<PikolgoLogo plate={false} />);
    const image = screen.getByRole("img", { name: "PikolGo" });
    expect(image.parentElement?.className).not.toContain("retro-logo-plate");
  });
});
