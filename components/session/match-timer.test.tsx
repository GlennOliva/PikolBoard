// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchTimer, MatchTimerLabeled } from "./match-timer";

/**
 * Timer component behaviour.
 *
 * These assert the properties the feature actually promises -- that the clock
 * comes from the persisted timestamp rather than component state, that it ticks
 * without writing anywhere, that two courts tick independently, and that the
 * interval is cleaned up -- rather than re-testing the arithmetic, which
 * lib/domain/session/match-timer.test.ts covers directly.
 */

const BASE = Date.UTC(2026, 2, 1, 10, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

/** The text of the timer element, e.g. "Game time: 08:42". */
function timerText(): string | null {
  const element = document.querySelector("[data-testid='match-timer']");
  return element?.textContent ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("starting a match displays the timer", () => {
  it("renders nothing while the match is staged", () => {
    render(<MatchTimer startedAt={null} status="staged" />);
    expect(timerText()).toBeNull();
  });

  it("renders a running clock the moment the match is playing", () => {
    render(<MatchTimer startedAt={iso(BASE)} status="playing" />);
    // setSystemTime froze the clock, so "now" is exactly the start instant.
    expect(timerText()).toBe("Game time:00:00");
  });

  it("shows the labeled form on the court card", () => {
    render(<MatchTimerLabeled startedAt={iso(BASE)} status="playing" />);
    expect(screen.getByText(/Game time:/)).toBeTruthy();
    expect(screen.getByText("00:00")).toBeTruthy();
  });

  it("shows Cancelled for a cancelled match", () => {
    render(<MatchTimer startedAt={iso(BASE)} status="cancelled" />);
    expect(timerText()).toBe("Game time:Cancelled");
  });

  it("reports a playing match with no started_at and falls back safely", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MatchTimer startedAt={null} status="playing" />);

    expect(timerText()).toBe("Game time:Timer unavailable");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("no started_at"),
      expect.anything(),
    );
  });

  it("does not report a completed match that predates started_at", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MatchTimer
        startedAt={null}
        completedAt={iso(BASE + 1000)}
        status="completed"
      />,
    );
    expect(error).not.toHaveBeenCalled();
    expect(timerText()).toBe("Game time:Timer unavailable");
  });
});

describe("the timer ticks without writing to the database", () => {
  it("advances one second at a time", () => {
    render(<MatchTimer startedAt={iso(BASE)} status="playing" />);

    act(() => void vi.advanceTimersByTime(1000));
    expect(timerText()).toBe("Game time:00:01");

    act(() => void vi.advanceTimersByTime(4000));
    expect(timerText()).toBe("Game time:00:05");
  });

  it("reaches the documented 05:24", () => {
    render(<MatchTimer startedAt={iso(BASE)} status="playing" />);
    act(() => void vi.advanceTimersByTime(324_000));
    expect(timerText()).toBe("Game time:05:24");
  });

  it("switches to the hour form past sixty minutes", () => {
    render(<MatchTimer startedAt={iso(BASE)} status="playing" />);
    act(() => void vi.advanceTimersByTime(3_932_000));
    expect(timerText()).toBe("Game time:1:05:32");
  });

  it("writes nothing while ticking", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("no network")));

    render(<MatchTimer startedAt={iso(BASE)} status="playing" />);
    act(() => void vi.advanceTimersByTime(10_000));

    // Supabase writes go over fetch, so ten ticks producing none is the direct
    // evidence that a second of clock is not a second of database traffic.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("reloading does not reset the timer", () => {
  it("reads elapsed time from started_at after a fresh mount", () => {
    const startedAt = iso(BASE);

    const first = render(<MatchTimer startedAt={startedAt} status="playing" />);
    act(() => void vi.advanceTimersByTime(90_000));
    expect(first.container.textContent).toBe("Game time:01:30");
    first.unmount();

    // A reload is a new component tree with the same persisted timestamp and a
    // later wall clock. It must continue, not restart.
    vi.setSystemTime(BASE + 90_000);
    render(<MatchTimer startedAt={startedAt} status="playing" />);
    expect(timerText()).toBe("Game time:01:30");
  });

  it("agrees across two independent mounts at the same instant", () => {
    const startedAt = iso(BASE);
    const { unmount } = render(<MatchTimer startedAt={startedAt} status="playing" />);
    act(() => void vi.advanceTimersByTime(3671));
    const organizer = timerText();
    unmount();

    // A second device joining mid-game reads the same row at the same instant.
    render(<MatchTimer startedAt={startedAt} status="playing" />);
    expect(timerText()).toBe(organizer);
  });
});

describe("completing a match stops the timer", () => {
  it("freezes at completed_at - started_at and stops advancing", () => {
    const { rerender } = render(
      <MatchTimer startedAt={iso(BASE)} status="playing" />,
    );
    act(() => void vi.advanceTimersByTime(8420));

    rerender(
      <MatchTimer
        startedAt={iso(BASE)}
        completedAt={iso(BASE + 8420)}
        status="completed"
      />,
    );
    expect(timerText()).toBe("Game time:00:08");

    // No ticker survives the transition, so later wall time changes nothing.
    act(() => void vi.advanceTimersByTime(600_000));
    expect(timerText()).toBe("Game time:00:08");
  });

  it("shows the same final duration whatever the current time", () => {
    vi.setSystemTime(BASE + 10_000_000);
    render(
      <MatchTimer
        startedAt={iso(BASE)}
        completedAt={iso(BASE + 3_932_000)}
        status="completed"
      />,
    );
    expect(timerText()).toBe("Game time:1:05:32");
  });
});

describe("multiple courts tick independently", () => {
  it("gives each match its own elapsed time from its own started_at", () => {
    // Court 1 started five minutes ago, court 2 only thirty seconds ago.
    render(
      <div>
        <div data-testid="court-1">
          <MatchTimer startedAt={iso(BASE - 300_000)} status="playing" />
        </div>
        <div data-testid="court-2">
          <MatchTimer startedAt={iso(BASE - 30_000)} status="playing" />
        </div>
      </div>,
    );

    const court1 = screen.getByTestId("court-1").textContent;
    const court2 = screen.getByTestId("court-2").textContent;

    expect(court1).toBe("Game time:05:00");
    expect(court2).toBe("Game time:00:30");
    expect(court1).not.toBe(court2);
  });

  it("keeps two courts separate when one completes and the other runs on", () => {
    const { rerender } = render(
      <div>
        <div data-testid="court-1">
          <MatchTimer startedAt={iso(BASE)} status="playing" />
        </div>
        <div data-testid="court-2">
          <MatchTimer startedAt={iso(BASE)} status="playing" />
        </div>
      </div>,
    );

    act(() => void vi.advanceTimersByTime(60_000));

    rerender(
      <div>
        <div data-testid="court-1">
          <MatchTimer
            startedAt={iso(BASE)}
            completedAt={iso(BASE + 60_000)}
            status="completed"
          />
        </div>
        <div data-testid="court-2">
          <MatchTimer startedAt={iso(BASE)} status="playing" />
        </div>
      </div>,
    );

    act(() => void vi.advanceTimersByTime(30_000));

    expect(screen.getByTestId("court-1").textContent).toBe("Game time:01:00");
    expect(screen.getByTestId("court-2").textContent).toBe("Game time:01:30");
  });
});

describe("interval cleanup", () => {
  it("stops ticking after unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = render(
      <MatchTimer startedAt={iso(BASE)} status="playing" />,
    );

    const clearsBefore = clearSpy.mock.calls.length;
    unmount();
    expect(clearSpy.mock.calls.length).toBeGreaterThan(clearsBefore);

    // No React update warning and no lingering timer work after unmount.
    act(() => void vi.advanceTimersByTime(5000));
  });

  it("holds no interval for a staged, completed, or cancelled match", () => {
    const setSpy = vi.spyOn(globalThis, "setInterval");
    setSpy.mockClear();

    render(<MatchTimer startedAt={iso(BASE)} status="staged" />);
    cleanup();
    render(
      <MatchTimer
        startedAt={iso(BASE)}
        completedAt={iso(BASE + 1000)}
        status="completed"
      />,
    );
    cleanup();
    render(<MatchTimer startedAt={iso(BASE)} status="cancelled" />);
    cleanup();

    expect(setSpy).not.toHaveBeenCalled();
  });

  it("creates exactly one interval per playing match", () => {
    const setSpy = vi.spyOn(globalThis, "setInterval");
    setSpy.mockClear();

    render(<MatchTimer startedAt={iso(BASE)} status="playing" />);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy.mock.calls[0]?.[1]).toBe(1000);
  });
});