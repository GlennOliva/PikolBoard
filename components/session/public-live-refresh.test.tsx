// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  removeChannel: vi.fn(),
  subscriptions: [] as Array<{
    table: string;
    filter: string;
    callback: () => void;
  }>,
  statusCallback: null as null | ((status: string) => void),
}));

const channel = {
  on: vi.fn(
    (
      _event: string,
      config: { table: string; filter: string },
      callback: () => void,
    ) => {
      mocks.subscriptions.push({ ...config, callback });
      return channel;
    },
  ),
  subscribe: vi.fn((callback: (status: string) => void) => {
    mocks.statusCallback = callback;
    return channel;
  }),
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => channel,
    removeChannel: mocks.removeChannel,
  }),
}));

import { PublicLiveRefresh } from "./public-live-refresh";

beforeEach(() => {
  vi.useFakeTimers();
  mocks.refresh.mockClear();
  mocks.removeChannel.mockClear();
  mocks.subscriptions.length = 0;
  mocks.statusCallback = null;
  channel.on.mockClear();
  channel.subscribe.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PublicLiveRefresh", () => {
  it("subscribes once to every session-scoped source, including session ending", () => {
    render(<PublicLiveRefresh sessionId="session-1" />);

    expect(mocks.subscriptions.map((item) => item.table)).toEqual([
      "courts",
      "matches",
      "match_players",
      "session_players",
      "sessions",
    ]);
    expect(mocks.subscriptions.slice(0, 4).every((item) => item.filter === "session_id=eq.session-1")).toBe(true);
    expect(mocks.subscriptions[4]?.filter).toBe("id=eq.session-1");
  });

  it("refreshes after a match change and after reconnecting", () => {
    render(<PublicLiveRefresh sessionId="session-1" />);
    act(() => mocks.statusCallback?.("SUBSCRIBED"));
    expect(screen.getByText("Live")).toBeTruthy();

    const matches = mocks.subscriptions.find((item) => item.table === "matches")!;
    act(() => matches.callback());
    act(() => vi.advanceTimersByTime(400));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    act(() => mocks.statusCallback?.("TIMED_OUT"));
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    expect(screen.getByText(/Live updates are temporarily unavailable/)).toBeTruthy();

    act(() => mocks.statusCallback?.("SUBSCRIBED"));
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("cleans up its one channel and all timers on unmount", () => {
    const { unmount } = render(<PublicLiveRefresh sessionId="session-1" />);
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });
});
