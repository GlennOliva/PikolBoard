// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PartnerLock, SessionPlayer } from "@/lib/db/types";
import { PartnerLocksPanel } from "./partner-locks-panel";

vi.mock("@/app/actions/session-actions", () => ({
  createPartnerLockAction: vi.fn(),
  releasePartnerLockAction: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

const sessionId = "10000000-0000-4000-8000-000000000001";

function player(index: number, name: string): SessionPlayer {
  const id = `20000000-0000-4000-8000-00000000000${index}`;
  return {
    id: `30000000-0000-4000-8000-00000000000${index}`,
    session_id: sessionId,
    player_id: id,
    attendance_status: "waiting",
    queue_position: index,
    games_played: 0,
    wins: 0,
    losses: 0,
    win_streak: 0,
    points_for: 0,
    points_against: 0,
    times_skipped: 0,
    checked_in_at: "2026-11-07T10:00:00Z",
    last_played_at: null,
    last_enqueued_at: "2026-11-07T10:00:00Z",
    display_name: name,
    skill_level: index + 1,
    division: null,
    player_missing: false,
  };
}

const roster = [
  player(1, "Alex"),
  player(2, "Blair"),
  player(3, "Casey"),
  player(4, "Drew"),
];

const lock: PartnerLock = {
  id: "40000000-0000-4000-8000-000000000001",
  session_id: sessionId,
  player_a_id: roster[0].player_id,
  player_b_id: roster[1].player_id,
  active: true,
  created_at: "2026-11-07T10:00:00Z",
  player_a_name: "Alex",
  player_b_name: "Blair",
  player_a_skill: 2,
  player_b_skill: 3,
};

describe("PartnerLocksPanel", () => {
  it("shows active pair details and organizer controls", () => {
    render(
      <PartnerLocksPanel
        sessionId={sessionId}
        roster={roster}
        matches={[]}
        locks={[lock]}
        canManage
      />,
    );

    expect(screen.getByText("Alex + Blair")).toBeTruthy();
    expect(screen.getByText(/Levels 2 \+ 3 · average 2.5/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lock a pair" })).toBeTruthy();
  });

  it("reviews two eligible unlocked players before confirmation", async () => {
    render(
      <PartnerLocksPanel
        sessionId={sessionId}
        roster={roster}
        matches={[]}
        locks={[lock]}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lock a pair" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Create partner lock",
    });

    fireEvent.change(within(dialog).getByLabelText("Player A"), {
      target: { value: roster[2].player_id },
    });
    fireEvent.change(within(dialog).getByLabelText("Player B"), {
      target: { value: roster[3].player_id },
    });

    expect(within(dialog).getByText("Casey + Drew")).toBeTruthy();
    expect(within(dialog).getByText(/Combined level 9 · average 4.5/)).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Confirm partner lock" }),
    ).toBeTruthy();
  });

  it("is read-only for viewers who cannot manage the session", () => {
    render(
      <PartnerLocksPanel
        sessionId={sessionId}
        roster={roster}
        matches={[]}
        locks={[lock]}
        canManage={false}
      />,
    );

    expect(screen.getByText("Alex + Blair")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
