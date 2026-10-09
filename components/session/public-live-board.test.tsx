// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicLiveBoard } from "./public-live-board";
import type {
  PublicLiveCourt,
  PublicLiveSession,
  PublicLineupSection,
  PublicMatchLineupRow,
  PublicSessionPresenceRow,
  PublicSessionStanding,
} from "@/lib/db/types";

vi.mock("./public-live-refresh", () => ({
  PublicLiveRefresh: () => <span>Live</span>,
}));

afterEach(cleanup);

const session: PublicLiveSession = {
  id: "10000000-0000-4000-8000-000000000001",
  club_id: "20000000-0000-4000-8000-000000000001",
  name: "Friday Open Play",
  status: "active",
  format: "doubles",
  matching_mode: "balanced",
  target_score: 11,
  win_by: 2,
  court_count: 2,
  started_at: "2026-01-01T10:00:00.000Z",
  ended_at: null,
  results_published: false,
  club_slug: "riverside",
  club_name: "Riverside Pickleball",
  club_location: "Riverside",
  avg_match_minutes: 15,
  completed_match_count: 4,
};

const playingCourt: PublicLiveCourt = {
  session_id: session.id,
  club_id: session.club_id,
  court_number: 1,
  court_name: "Championship",
  court_status: "playing",
  ladder_position: 1,
  match_status: "playing",
  match_number: 1,
  display_name: "Championship Game",
  winning_team: null,
  target_score: 11,
  match_started_at: "2026-01-01T10:05:00.000Z",
  match_completed_at: null,
  team1_score: 7,
  team2_score: 5,
};

const stagedCourt: PublicLiveCourt = {
  ...playingCourt,
  court_number: 2,
  court_name: null,
  court_status: "staged",
  ladder_position: 2,
  match_status: "staged",
  match_number: 2,
  display_name: "Court Two Lineup",
  match_started_at: null,
  team1_score: null,
  team2_score: null,
};

function lineup(court: number, team: 1 | 2, slot: number, name: string): PublicMatchLineupRow {
  return {
    session_id: session.id,
    court_number: court,
    team_number: team,
    slot_number: slot,
    display_name: name,
    result: null,
    points_for: null,
    points_against: null,
    lineup_id: `${court}-${team}-${slot}`,
  };
}

const lineups = [
  lineup(1, 1, 1, "AG"),
  lineup(1, 1, 2, "Kim"),
  lineup(1, 2, 1, "Jayson"),
  lineup(1, 2, 2, "Mara"),
  lineup(2, 1, 1, "Noah"),
  lineup(2, 1, 2, "Ivy"),
  lineup(2, 2, 1, "Lee"),
  lineup(2, 2, 2, "Pia"),
];

function queuedLineup(
  stage: "preparing" | "up_next",
  matchNumber: number,
  names: string[],
): PublicLineupSection {
  return {
    match_id: `30000000-0000-4000-8000-00000000000${matchNumber}`,
    match_number: matchNumber,
    display_name: `Match ${matchNumber}`,
    matching_mode: "balanced",
    stage,
    prepared_at: "2026-01-01T10:15:00.000Z",
    players: names.map((displayName, index) => ({
      team_number: index < 2 ? 1 : 2,
      slot_number: (index % 2) + 1,
      display_name: displayName,
      skill_level: 3,
      lineup_id: `${stage}-${matchNumber}-${index}`,
    })),
  };
}

const upNext = [queuedLineup("up_next", 3, ["Uma", "Vic", "Wes", "Xena"])];
const preparation = [queuedLineup("preparing", 4, ["Yara", "Zane", "Ana", "Bo"] )];

const presence: PublicSessionPresenceRow[] = [
  {
    session_id: session.id,
    display_name: "Queue One",
    skill_level: 3,
    attendance_status: "waiting",
    queue_position: 1,
    games_played: 4,
    checked_in_at: "2026-01-01T10:00:00Z",
    last_enqueued_at: "2026-01-01T10:10:00Z",
    presence_id: "presence-1",
  },
  {
    session_id: session.id,
    display_name: "Queue Two",
    skill_level: 4,
    attendance_status: "waiting",
    queue_position: 2,
    games_played: 0,
    checked_in_at: "2026-01-01T10:00:00Z",
    last_enqueued_at: "2026-01-01T10:12:00Z",
    presence_id: "presence-2",
  },
];

const standings: PublicSessionStanding[] = [
  {
    session_id: session.id,
    club_id: session.club_id,
    player_id: "player-1",
    display_name: "AG",
    skill_level: 3,
    games_played: 5,
    wins: 4,
    losses: 1,
    points_for: 55,
    points_against: 38,
    first_game_at: "2026-01-01T10:00:00Z",
    last_game_at: "2026-01-01T11:00:00Z",
  },
  {
    session_id: session.id,
    club_id: session.club_id,
    player_id: "player-zero",
    display_name: "Zero Game Player",
    skill_level: 2,
    games_played: 0,
    wins: 0,
    losses: 0,
    points_for: 0,
    points_against: 0,
    first_game_at: null,
    last_game_at: null,
  },
];

function board(overrides: Partial<Parameters<typeof PublicLiveBoard>[0]> = {}) {
  return (
    <PublicLiveBoard
      session={session}
      courts={[playingCourt, stagedCourt]}
      lineups={lineups}
      upNext={upNext}
      preparation={preparation}
      presence={presence}
      standings={standings}
      {...overrides}
    />
  );
}

describe("player Live Board", () => {
  it("shows session information and connection status", () => {
    render(board());
    expect(screen.getByText("Riverside Pickleball")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Friday Open Play" })).toBeTruthy();
    expect(screen.getAllByText("LIVE").length).toBeGreaterThan(0);
    expect(screen.getByText("Doubles")).toBeTruthy();
    expect(screen.getByText("Balanced")).toBeTruthy();
  });

  it("shows only active courts, current score, teams, and persisted timer", () => {
    render(board());
    const section = document.querySelector('[data-live-board-section="courts"]') as HTMLElement;
    expect(within(section).getByText("Court 1 · Championship")).toBeTruthy();
    expect(within(section).queryByText("Court 2")).toBeNull();
    expect(section.textContent).toContain("7–5");
    expect(within(section).getByText("AG", { exact: false })).toBeTruthy();
    expect(within(section).getByText(/Game time:/)).toBeTruthy();
  });

  it("shows staged players as ready on their assigned court", () => {
    render(board());
    const section = document.querySelector('[data-live-board-section="ready"]') as HTMLElement;
    expect(within(section).getByText("Court Two Lineup · Court 2")).toBeTruthy();
    expect(within(section).getByText("Noah")).toBeTruthy();
    expect(within(section).getByText("Pia")).toBeTruthy();
  });

  it("shows the authoritative Up Next and Preparation lineups separately", () => {
    render(board());
    const next = document.querySelector('[data-live-board-section="up-next"]') as HTMLElement;
    const preparing = document.querySelector('[data-live-board-section="preparation"]') as HTMLElement;
    expect(within(next).getByText("Uma")).toBeTruthy();
    expect(within(next).queryByText("Yara")).toBeNull();
    expect(within(preparing).getByText("Yara")).toBeTruthy();
    expect(within(preparing).queryByText("Uma")).toBeNull();
  });

  it("keeps the waiting queue in position order with estimates", () => {
    render(board());
    const table = within(document.querySelector('[data-live-board-section="queue"]') as HTMLElement).getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]?.textContent).toContain("Queue One");
    expect(rows[1]?.textContent).toContain("Queue Two");
    expect(rows[0]?.textContent).toContain("About 15 min");
  });

  it("does not present a playing player as an ordinary waiting row", () => {
    const playing = {
      ...presence[0],
      attendance_status: "playing" as const,
      queue_position: null,
      display_name: "Already Playing",
    };
    render(board({ presence: [playing] }));
    const row = screen.getByText("Already Playing").closest("tr")!;
    expect(row.textContent).toContain("Playing");
    expect(row.textContent).not.toContain("Waiting 00:");
  });

  it("includes a rostered zero-game player in the leaderboard", () => {
    render(board());
    const section = document.querySelector('[data-live-board-section="leaderboard"]') as HTMLElement;
    const row = within(section).getByText("Zero Game Player").closest("tr")!;
    expect(row.textContent).toContain("0");
    expect(row.textContent).toContain("5 more games to qualify");
  });

  it("contains no organizer-only controls", () => {
    render(board());
    for (const label of ["Start Match", "Complete Match", "Edit Score", "Check In another player", "Change queue order", "End Session", "Session Settings"]) {
      expect(screen.queryByText(label, { exact: false })).toBeNull();
    }
  });

  it("moves from no active match to a playing match after a realtime refresh", () => {
    const { rerender } = render(board({ courts: [], lineups: [] }));
    expect(screen.getByText("No match is currently playing.")).toBeTruthy();
    rerender(board({ courts: [playingCourt], lineups: lineups.filter((row) => row.court_number === 1) }));
    expect(screen.getByText("Court 1 · Championship")).toBeTruthy();
  });

  it("changes to final results when the session ends", () => {
    const { rerender } = render(board());
    expect(screen.queryByText("Session completed")).toBeNull();
    rerender(board({ session: { ...session, status: "completed", ended_at: "2026-01-01T13:00:00Z", results_published: true }, courts: [] }));
    expect(screen.getByText("Session completed")).toBeTruthy();
    expect(screen.getByText("Final results are shown below.")).toBeTruthy();
    expect(screen.getByText("ENDED")).toBeTruthy();
  });

  it("renders repeated refreshes without duplicate React key warnings", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(board());
    for (let i = 0; i < 4; i += 1) rerender(board());
    expect(error.mock.calls.flat().join(" ")).not.toContain("same key");
    error.mockRestore();
  });
});
