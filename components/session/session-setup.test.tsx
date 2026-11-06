// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionSetup } from "./session-setup";
import type { Session, SessionPlayer } from "@/lib/db/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/actions/session-actions", () => ({
  startSessionAction: vi.fn(),
}));

afterEach(cleanup);

function player(
  id: string,
  attendance_status: SessionPlayer["attendance_status"],
): SessionPlayer {
  return {
    id: `session-${id}`,
    session_id: "session-1",
    player_id: id,
    attendance_status,
    queue_position: attendance_status === "waiting" ? 1 : null,
    games_played: 0,
    wins: 0,
    losses: 0,
    win_streak: 0,
    points_for: 0,
    points_against: 0,
    times_skipped: 0,
    checked_in_at: null,
    last_played_at: null,
    last_enqueued_at: null,
    display_name: id,
    skill_level: 3,
    division: null,
    player_missing: false,
  };
}

const session: Pick<Session, "id" | "format" | "court_count" | "status"> = {
  id: "session-1",
  format: "doubles",
  court_count: 3,
  status: "draft",
};

function stat(label: string): string | null {
  return screen.getByText(label).parentElement?.textContent ?? null;
}

describe("SessionSetup", () => {
  it("shows the roster, checked-in count, match size, and court count", () => {
    render(
      <SessionSetup
        session={session}
        roster={[
          player("Alex", "waiting"),
          player("Bo", "break"),
          player("Casey", "checked_out"),
        ]}
      />,
    );

    expect(stat("On roster")).toBe("On roster3");
    expect(stat("Checked in")).toBe("Checked in2");
    expect(stat("Per match")).toBe("Per match4");
    expect(stat("Courts")).toBe("Courts3");
    expect(
      screen.getByText("Check in at least 4 players for a doubles game."),
    ).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
  });

  it("says when there are enough checked-in players", () => {
    render(
      <SessionSetup
        session={{ ...session, format: "singles" }}
        roster={[player("Alex", "waiting"), player("Bo", "playing")]}
      />,
    );

    expect(
      screen.getByText(
        "There are enough checked-in players for every court to start a game.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start session" })).toBeTruthy();
  });
});
