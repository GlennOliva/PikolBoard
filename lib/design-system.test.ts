// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("PikolGo design system", () => {
  it("keeps the canonical dark tokens and reduced-motion guardrail", () => {
    const css = read("app/globals.css");

    for (const token of [
      "--pikol-bg: #0b0b18",
      "--pikol-primary: #0080ff",
      "--pikol-secondary: #d91a72",
      "--pikol-cyan: #00d8e6",
      "--pikol-text: #e8e8f2",
      "--pikol-focus: #00d8e6",
    ]) {
      expect(css).toContain(token);
    }

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".retro-background");
    expect(css).not.toContain(".neo-button");
  });

  it("keeps a retro identity in both light and dark themes", () => {
    const css = read("app/globals.css");
    const rootBlock = css.match(/:root \{[\s\S]*?\n  \}/)?.[0] ?? "";
    const darkBlock = css.match(/\.dark \{[\s\S]*?\n  \}/)?.[0] ?? "";

    for (const token of ["--pikol-cyan", "--pikol-surface", "--pikol-border"]) {
      expect(rootBlock).toContain(token);
      expect(darkBlock).toContain(token);
    }

    expect(rootBlock).toContain("--pikol-bg: #f3f0f8");
    expect(darkBlock).toContain("--pikol-bg: #0b0b18");
    expect(css).toContain("font-family: var(--font-geist-mono)");
    expect(css).toContain(".retro-logo-plate");
  });

  it("uses a static, non-interactive CRT overlay and contains horizontal overflow", () => {
    const css = read("app/globals.css");
    const crt = css.match(/body::before \{[\s\S]*?\n  \}/)?.[0] ?? "";

    expect(crt).toContain("pointer-events: none");
    expect(crt).toContain("z-index: 90");
    expect(crt).toContain("opacity: 0.022");
    expect(crt).toContain("repeating-linear-gradient");
    expect(crt).not.toContain("animation");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("animation: none !important");
  });

  it("ships the supplied logo and generated application metadata images", () => {
    for (const asset of [
      "app/pikolgo_logo.png",
      "app/icon.png",
      "app/apple-icon.png",
      "app/opengraph-image.png",
      "app/twitter-image.png",
    ]) {
      const path = resolve(root, asset);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1_000);
    }

    const manifest = read("app/manifest.ts");
    expect(manifest).toContain('src: "/icon.png"');
    expect(manifest).toContain('src: "/apple-icon.png"');
  });

  it("documents the layout, z-index, accessibility, and responsive contracts", () => {
    const design = read("design.md");
    expect(design).toContain("max-width: 1280px");
    expect(design).toContain("Sticky nav | `100`");
    expect(design).toContain("Dialogs / drawers | `300`");
    expect(design).toContain("WCAG 2.2 AA");
    expect(design).toContain("375px, 768px, 1024px, and 1440px");
  });
});
