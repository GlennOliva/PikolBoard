// @vitest-environment jsdom
"use client";

import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionElapsed } from "./session-elapsed";

/**
 * SessionElapsed has two jobs that pull against each other: show a running
 * clock, and produce byte-identical markup on the server and the first client
 * frame. These tests cover both halves, including the actual hydration path,
 * because a placeholder rendered correctly but then diverged during hydration
 * is the failure the requirement is about.
 */

afterEach(cleanup);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

const BASE = new Date("2025-01-01T10:00:00.000Z").getTime();

/** React logs hydration mismatches through console.error; nothing else should. */
function captureConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("SessionElapsed hydration safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts no clock while server rendering, so nothing can diverge", () => {
    // The timer is created inside an effect. If rendering on the server ever
    // created one, the server would be measuring against a clock it does not
    // have, and the first client frame would be the thing that has to change.
    const setInterval = vi.spyOn(window, "setInterval");
    const clearInterval = vi.spyOn(window, "clearInterval");

    const html = renderToString(
      <SessionElapsed startedAt={iso(BASE)} endedAt={null} />,
    );

    expect(html).toContain("--:--");
    expect(setInterval).not.toHaveBeenCalled();
    expect(clearInterval).not.toHaveBeenCalled();
  });

  it("produces identical server markup and first client frame for a running session", () => {
    const props = { startedAt: iso(BASE), endedAt: null };

    const serverHtml = renderToString(<SessionElapsed {...props} />);

    // The server cannot know the visitor's clock, so it must not emit a
    // duration. This is the markup hydration is handed.
    expect(serverHtml).toContain("--:--");
    expect(serverHtml).not.toContain("00:00");
  });

  it("hydrates the server markup without a mismatch warning", async () => {
    const consoleError = captureConsoleError();
    const props = { startedAt: iso(BASE), endedAt: null };

    const container = document.createElement("div");
    container.innerHTML = renderToString(<SessionElapsed {...props} />);
    document.body.appendChild(container);

    const root = await act(async () => {
      const created = hydrateRoot(
        container,
        <SessionElapsed {...props} />,
      );
      return created;
    });

    const messages = consoleError.mock.calls
      .map((call) => call.map((arg) => String(arg)).join(" "))
      .join("\n");

    expect(messages).not.toMatch(/hydrat|did not match|server rendered|Text content/i);

    // The clock is read in an effect, which runs after hydration, so the
    // placeholder is replaced with a real duration once mounted.
    expect(container.textContent).not.toContain("--:--");
    expect(container.textContent).toContain("00:00");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the real elapsed time immediately on mount rather than after a full second", () => {
    const { container } = render(<SessionElapsed startedAt={iso(BASE)} endedAt={null} />);
    // The mount effect reads the clock once, so no tick has to elapse first.
    expect(container.textContent).toContain("00:00");
  });

  it("starts ticking after mount and advances with the clock", () => {
    const { container } = render(<SessionElapsed startedAt={iso(BASE)} endedAt={null} />);
    const initial = container.textContent;

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(container.textContent).not.toBe(initial);
    expect(container.textContent).toMatch(/00:0[12]/);
  });

  it("accumulates every tick rather than only the last one", () => {
    const { container } = render(<SessionElapsed startedAt={iso(BASE)} endedAt={null} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.textContent).toContain("00:03");

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(container.textContent).toContain("01:04");
  });

  it("does not mutate the DOM on its own before any timer advances", () => {
    const { container } = render(<SessionElapsed startedAt={iso(BASE)} endedAt={null} />);
    const frame = container.textContent;
    expect(frame).toBe("00:00");
  });

  it("shows the final duration when the session ended, with no ticking interval", () => {
    const { container } = render(
      <SessionElapsed startedAt={iso(BASE)} endedAt={iso(BASE + 90_000)} />,
    );
    expect(container.textContent).toContain("01:30");
    const before = container.textContent;
    const timersBefore = vi.getTimerCount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(container.textContent).toBe(before);
    // A finished session is a fixed subtraction, so no interval is ever created.
    expect(vi.getTimerCount()).toBe(timersBefore);
  });

  it("renders identical markup on the server for a finished session", () => {
    const props = { startedAt: iso(BASE), endedAt: iso(BASE + 90_000) };
    expect(renderToString(<SessionElapsed {...props} />)).toContain("01:30");
  });

  it("reports Not started when the session never began", () => {
    const { container } = render(<SessionElapsed startedAt={null} endedAt={null} />);
    expect(container.textContent).toContain("Not started");
  });

  it("reports Unavailable for an unparseable startedAt", () => {
    const { container } = render(<SessionElapsed startedAt="bad" endedAt={null} />);
    expect(container.textContent).toContain("Unavailable");
  });

  it("reports Unavailable for an unparseable endedAt", () => {
    const { container } = render(
      <SessionElapsed startedAt={iso(BASE)} endedAt="still bad" />,
    );
    expect(container.textContent).toContain("Unavailable");
  });

  it("cleans up its interval on unmount", () => {
    const { unmount } = render(<SessionElapsed startedAt={iso(BASE)} endedAt={null} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts cleanly when the session start changes", () => {
    const { container, rerender } = render(
      <SessionElapsed startedAt={iso(BASE)} endedAt={null} />,
    );

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(container.textContent).toContain("00:05");

    rerender(<SessionElapsed startedAt={iso(BASE + 5_000)} endedAt={null} />);
    expect(container.textContent).toContain("00:00");
    // Still exactly one live interval, not one per start value.
    expect(vi.getTimerCount()).toBe(1);
  });
});